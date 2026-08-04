import { TRACK_COUNT } from "@/lib/constants";
import {
  ENV_SEARCH_TERMS,
  MOOD_SEARCH_TERMS,
  type TrackCandidate,
} from "@/lib/playlist/terms";
import { youtubeSearch } from "@/lib/youtube/api";
import type { EnvironmentTag, Mood, UserPreferences } from "@/lib/types";

export type GenerateInput = {
  artists: string[];
  genres: string[];
  moods: Mood[];
  environments: EnvironmentTag[];
  noteKeywords: string[];
  preferences: UserPreferences;
  excludeVideoIds: string[];
  accessToken: string | null;
  apiKey: string | null;
};

function shuffle<T>(items: T[], enabled: boolean): T[] {
  if (!enabled) return [...items];
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clampTrackCount(n: number): number {
  return Math.min(TRACK_COUNT.max, Math.max(TRACK_COUNT.min, n));
}

/** クォータ節約のため検索クエリ数を抑える */
export function buildSearchQueries(input: GenerateInput): string[] {
  const queries: string[] = [];
  const { artists, genres, moods, environments, noteKeywords, preferences } =
    input;

  for (const artist of artists.slice(0, 8)) {
    queries.push(`${artist} 公式`);
    if (moods[0]) {
      const term = MOOD_SEARCH_TERMS[moods[0]][0];
      queries.push(`${artist} ${term}`);
    }
  }

  for (const genre of genres.slice(0, 6)) {
    const moodTerm = moods[0] ? MOOD_SEARCH_TERMS[moods[0]][0] : "おすすめ";
    queries.push(`${genre} ${moodTerm}`);
  }

  for (const mood of moods.slice(0, 4)) {
    queries.push(...MOOD_SEARCH_TERMS[mood].slice(0, 1));
  }

  for (const env of environments.slice(0, 4)) {
    queries.push(...ENV_SEARCH_TERMS[env].slice(0, 1));
  }

  for (const keyword of noteKeywords.slice(0, 3)) {
    queries.push(`${keyword} 曲`);
  }

  if (preferences.mixNewTracks) {
    queries.push("新曲 おすすめ 2024", "話題曲");
  }

  // 重複除去・上限（search は 100 ユニット／回）
  return [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(
    0,
    12,
  );
}

function applyArtistBiasLimit(
  tracks: TrackCandidate[],
  maxPerArtist: number,
): TrackCandidate[] {
  const counts = new Map<string, number>();
  const result: TrackCandidate[] = [];

  for (const track of tracks) {
    const key = track.channelTitle || "unknown";
    const count = counts.get(key) ?? 0;
    if (count >= maxPerArtist) continue;
    counts.set(key, count + 1);
    result.push(track);
  }

  return result;
}

export async function generateTrackList(
  input: GenerateInput,
): Promise<{ tracks: TrackCandidate[]; queriesUsed: string[] }> {
  const target = clampTrackCount(input.preferences.trackCount);
  const queries = buildSearchQueries(input);
  const exclude = new Set(input.excludeVideoIds);
  const pool: TrackCandidate[] = [];
  const seen = new Set<string>();

  const perQuery = Math.min(
    25,
    Math.max(8, Math.ceil((target * 1.5) / Math.max(queries.length, 1))),
  );

  for (const query of queries) {
    const found = await youtubeSearch(
      query,
      input.accessToken,
      input.apiKey,
      perQuery,
    );
    for (const track of found) {
      if (exclude.has(track.videoId) || seen.has(track.videoId)) continue;
      seen.add(track.videoId);
      pool.push(track);
    }
  }

  let selected = shuffle(pool, input.preferences.randomnessEnabled);

  if (input.preferences.preventArtistBias) {
    selected = applyArtistBiasLimit(
      selected,
      input.preferences.maxTracksPerArtist,
    );
  }

  // ランダム性が高いほど先頭寄りを崩す（すでに shuffle 済み）
  if (
    input.preferences.randomnessEnabled &&
    input.preferences.randomnessPercent < 50
  ) {
    // 低ランダム時はクエリ順プールをやや優先（先頭半分を固定寄りに）
    const keep = Math.floor(selected.length * 0.4);
    selected = [...pool.slice(0, keep), ...selected].filter(
      (track, index, arr) =>
        arr.findIndex((t) => t.videoId === track.videoId) === index,
    );
  }

  return {
    tracks: selected.slice(0, target),
    queriesUsed: queries,
  };
}

export async function findReplacementTrack(
  input: GenerateInput & { seedQuery: string },
): Promise<TrackCandidate | null> {
  const queries = [
    input.seedQuery,
    ...buildSearchQueries(input).slice(0, 3),
  ];

  for (const query of queries) {
    const found = await youtubeSearch(
      query,
      input.accessToken,
      input.apiKey,
      15,
    );
    const hit = found.find((t) => !input.excludeVideoIds.includes(t.videoId));
    if (hit) return hit;
  }

  return null;
}
