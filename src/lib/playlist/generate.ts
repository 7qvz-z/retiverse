import { TRACK_COUNT } from "@/lib/constants";
import {
  filterToSongsOnly,
  getMusicSourceKind,
  preferTopicThenMv,
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
  preferences: UserPreferences;
  excludeVideoIds: string[];
  accessToken: string | null;
  apiKey: string | null;
  /** クォータ記録用 */
  userId?: string | null;
};

export type SearchQueryPlan = {
  topicQueries: string[];
  mvQueries: string[];
};

/** Topic 先行の上限（search.list 枠節約） */
const TOPIC_QUERY_LIMIT = 8;
/** Topic で足りないときだけ使う MV フォールバック上限 */
const MV_QUERY_LIMIT = 6;

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

function uniqueQueries(queries: string[]): string[] {
  return [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
}

/**
 * Topic 用と MV 用を分けて返す。
 * 実行側は Topic を先に叩き、足りないときだけ MV にフォールバックする。
 */
export function buildSearchQueries(input: GenerateInput): SearchQueryPlan {
  const topicQueries: string[] = [];
  const mvQueries: string[] = [];
  const { artists, genres, moods, environments, noteKeywords, preferences } =
    input;

  // 好きなアーティストのみ（PL解析結果は生成に混ぜない）
  const mergedArtists = [...new Set(artists)].slice(0, 8);

  // アーティスト: Topic 1本 / MV フォールバックは Official Music Video のみ
  for (const artist of mergedArtists.slice(0, 6)) {
    topicQueries.push(`${artist} Topic`);
    mvQueries.push(`${artist} Official Music Video`);
  }

  for (const genre of genres.slice(0, 3)) {
    const moodTerm = moods[0] ? MOOD_SEARCH_TERMS[moods[0]][0] : "人気";
    topicQueries.push(`${genre} ${moodTerm} Topic`);
    mvQueries.push(`${genre} ${moodTerm} Official Music Video`);
  }

  for (const mood of moods.slice(0, 2)) {
    const term = MOOD_SEARCH_TERMS[mood][0];
    topicQueries.push(`${term} Topic`);
    mvQueries.push(`${term} Official Music Video`);
  }

  for (const env of environments.slice(0, 2)) {
    const term = ENV_SEARCH_TERMS[env][0];
    topicQueries.push(`${term} Topic`);
  }

  for (const keyword of noteKeywords.slice(0, 2)) {
    topicQueries.push(`${keyword} Topic`);
    mvQueries.push(`${keyword} Official Music Video`);
  }

  if (preferences.mixNewTracks) {
    topicQueries.push("話題曲 Topic");
    mvQueries.push("新曲 Official Music Video");
  }

  return {
    topicQueries: uniqueQueries(topicQueries).slice(0, TOPIC_QUERY_LIMIT),
    mvQueries: uniqueQueries(mvQueries).slice(0, MV_QUERY_LIMIT),
  };
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

async function searchIntoPool(input: {
  queries: string[];
  accessToken: string | null;
  apiKey: string | null;
  perQuery: number;
  exclude: Set<string>;
  seen: Set<string>;
  pool: TrackCandidate[];
  enough: number;
  queriesUsed: string[];
  userId?: string | null;
}): Promise<void> {
  const {
    queries,
    accessToken,
    apiKey,
    perQuery,
    exclude,
    seen,
    pool,
    enough,
    queriesUsed,
    userId,
  } = input;

  for (const query of queries) {
    if (pool.length >= enough) break;

    const found = filterToSongsOnly(
      await youtubeSearch(query, accessToken, apiKey, perQuery, { userId }),
    );
    queriesUsed.push(query);

    // まず未除外を優先して入れる
    const deferred: TrackCandidate[] = [];
    for (const track of found) {
      if (seen.has(track.videoId)) continue;
      if (exclude.has(track.videoId)) {
        deferred.push(track);
        continue;
      }
      seen.add(track.videoId);
      pool.push(track);
    }

    // 足りないときだけ除外対象も補充（全滅防止）
    if (pool.length < enough) {
      for (const track of deferred) {
        if (seen.has(track.videoId)) continue;
        seen.add(track.videoId);
        pool.push(track);
        if (pool.length >= enough) break;
      }
    }
  }
}

export async function generateTrackList(
  input: GenerateInput,
): Promise<{ tracks: TrackCandidate[]; queriesUsed: string[] }> {
  const target = clampTrackCount(input.preferences.trackCount);
  const plan = buildSearchQueries(input);
  const exclude = new Set(input.excludeVideoIds);
  const pool: TrackCandidate[] = [];
  const seen = new Set<string>();
  const queriesUsed: string[] = [];

  // 目標の 1.5 倍集まれば打ち切り（追加の search.list を節約）
  const enough = Math.max(target, Math.ceil(target * 1.5));
  const plannedCount = Math.max(
    plan.topicQueries.length + plan.mvQueries.length,
    1,
  );
  const perQuery = Math.min(
    25,
    Math.max(8, Math.ceil((target * 1.5) / Math.min(plannedCount, TOPIC_QUERY_LIMIT))),
  );

  // 1) Topic のみ
  await searchIntoPool({
    queries: plan.topicQueries,
    accessToken: input.accessToken,
    apiKey: input.apiKey,
    perQuery,
    exclude,
    seen,
    pool,
    enough,
    queriesUsed,
    userId: input.userId,
  });

  // 2) 足りなければ MV フォールバック
  if (pool.length < enough) {
    await searchIntoPool({
      queries: plan.mvQueries,
      accessToken: input.accessToken,
      apiKey: input.apiKey,
      perQuery,
      exclude,
      seen,
      pool,
      enough,
      queriesUsed,
      userId: input.userId,
    });
  }

  // Topic 優先 → 不足分を MV で補完
  let selected = preferTopicThenMv(
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
    selected = preferTopicThenMv(selected, target, shuffle, false);
  }

  return {
    tracks: selected.slice(0, target),
    queriesUsed,
  };
}

export async function findReplacementTrack(
  input: GenerateInput & { seedQuery: string },
): Promise<TrackCandidate | null> {
  const plan = buildSearchQueries(input);
  const topicQueries = uniqueQueries([
    `${input.seedQuery} Topic`,
    ...plan.topicQueries.slice(0, 2),
  ]);
  const mvQueries = uniqueQueries([
    `${input.seedQuery} Official Music Video`,
    ...plan.mvQueries.slice(0, 2),
  ]);

  for (const query of [...topicQueries, ...mvQueries]) {
    const found = filterToSongsOnly(
      await youtubeSearch(query, input.accessToken, input.apiKey, 15, {
        userId: input.userId,
      }),
    );
    // 差し替えも Topic → MV
    const ordered = [
      ...found.filter((t) => getMusicSourceKind(t) === "topic"),
      ...found.filter((t) => getMusicSourceKind(t) === "mv"),
    ];
    const hit = ordered.find((t) => !input.excludeVideoIds.includes(t.videoId));
    if (hit) return hit;
  }

  return null;
}
