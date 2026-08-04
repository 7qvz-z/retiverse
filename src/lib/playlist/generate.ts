import { TRACK_COUNT } from "@/lib/constants";
import {
  filterToSongsOnly,
  getMusicSourceKind,
  preferMvThenTopic,
} from "@/lib/playlist/filters";
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
  /** 解析済みプレイリスト由来のアーティスト */
  analyzedArtists?: string[];
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

/** MV 検索を先に、Topic を後に並べる */
export function buildSearchQueries(input: GenerateInput): string[] {
  const mvQueries: string[] = [];
  const topicQueries: string[] = [];
  const { artists, genres, moods, environments, noteKeywords, preferences } =
    input;

  const analyzedArtists = input.analyzedArtists ?? [];
  const mergedArtists = [
    ...new Set([...artists, ...analyzedArtists]),
  ].slice(0, 12);

  for (const artist of mergedArtists.slice(0, 8)) {
    mvQueries.push(`${artist} Official Music Video`);
    mvQueries.push(`${artist} 公式 MV`);
    topicQueries.push(`${artist} Topic`);
    if (moods[0]) {
      const term = MOOD_SEARCH_TERMS[moods[0]][0];
      topicQueries.push(`${artist} ${term} Topic`);
    }
  }

  for (const genre of genres.slice(0, 6)) {
    const moodTerm = moods[0] ? MOOD_SEARCH_TERMS[moods[0]][0] : "人気";
    mvQueries.push(`${genre} ${moodTerm} Official Music Video`);
    topicQueries.push(`${genre} ${moodTerm} Topic`);
  }

  for (const mood of moods.slice(0, 4)) {
    const term = MOOD_SEARCH_TERMS[mood][0];
    mvQueries.push(`${term} Official Music Video`);
    topicQueries.push(`${term} Topic`);
  }

  for (const env of environments.slice(0, 4)) {
    const term = ENV_SEARCH_TERMS[env][0];
    topicQueries.push(`${term} Topic`);
  }

  for (const keyword of noteKeywords.slice(0, 3)) {
    mvQueries.push(`${keyword} Official Music Video`);
    topicQueries.push(`${keyword} Topic`);
  }

  if (preferences.mixNewTracks) {
    mvQueries.push("新曲 Official Music Video");
    topicQueries.push("話題曲 Topic");
  }

  const merged = [...mvQueries, ...topicQueries];
  return [...new Set(merged.map((q) => q.trim()).filter(Boolean))].slice(0, 12);
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
    const found = filterToSongsOnly(
      await youtubeSearch(query, input.accessToken, input.apiKey, perQuery),
    );
    for (const track of found) {
      if (exclude.has(track.videoId) || seen.has(track.videoId)) continue;
      seen.add(track.videoId);
      pool.push(track);
    }
  }

  // MV 優先 → 不足分を Topic で補完
  let selected = preferMvThenTopic(
    pool,
    target * 2,
    shuffle,
    input.preferences.randomnessEnabled,
  );

  if (input.preferences.preventArtistBias) {
    selected = applyArtistBiasLimit(
      selected,
      input.preferences.maxTracksPerArtist,
    );
    // bias 適用後も MV→Topic の順を維持して詰め直す
    selected = preferMvThenTopic(
      selected,
      target,
      shuffle,
      false,
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
  const mvQueries = [
    `${input.seedQuery} Official Music Video`,
    `${input.seedQuery} 公式 MV`,
    ...buildSearchQueries(input).filter((q) =>
      /Official Music Video|公式 MV/i.test(q),
    ).slice(0, 2),
  ];
  const topicQueries = [
    `${input.seedQuery} Topic`,
    ...buildSearchQueries(input).filter((q) => /Topic/i.test(q)).slice(0, 2),
  ];

  for (const query of [...mvQueries, ...topicQueries]) {
    const found = filterToSongsOnly(
      await youtubeSearch(query, input.accessToken, input.apiKey, 15),
    );
    // 差し替えも MV を先に探す
    const ordered = [
      ...found.filter((t) => getMusicSourceKind(t) === "mv"),
      ...found.filter((t) => getMusicSourceKind(t) === "topic"),
    ];
    const hit = ordered.find((t) => !input.excludeVideoIds.includes(t.videoId));
    if (hit) return hit;
  }

  return null;
}
