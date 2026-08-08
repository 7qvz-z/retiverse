import { createServiceClient } from "@/lib/supabase/service";
import { isMissingRelationError } from "@/lib/supabase/migration-hints";
import type { TrackCandidate } from "@/lib/playlist/terms";

export const YOUTUBE_SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const YOUTUBE_SEARCH_CACHE_MIGRATION =
  "supabase/migrations/20260806010000_youtube_search_cache.sql";

const MISSING_TABLE_HINT =
  `YouTube 検索キャッシュテーブルがありません。${YOUTUBE_SEARCH_CACHE_MIGRATION} を SQL Editor で実行してください。`;

type CacheRow = {
  results: unknown;
  expires_at: string;
  hit_count: number | null;
};

function isTrackCandidate(value: unknown): value is TrackCandidate {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.videoId === "string" &&
    typeof row.title === "string" &&
    typeof row.channelTitle === "string" &&
    typeof row.thumbnailUrl === "string" &&
    typeof row.query === "string"
  );
}

export function parseCachedTrackCandidates(
  value: unknown,
): TrackCandidate[] | null {
  if (!Array.isArray(value)) return null;
  const out: TrackCandidate[] = [];
  for (const item of value) {
    if (!isTrackCandidate(item)) return null;
    out.push(item);
  }
  return out;
}

/**
 * 検索キャッシュのキー。大文字小文字・全角半角・連続空白を正規化する。
 * maxResults は含めない（常に最大件数で保存し、読み出し時に slice する）。
 */
export function buildYouTubeSearchCacheKey(query: string): string {
  const normalized = query
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return `ytsearch:v1:${normalized}`;
}

let missingTableWarned = false;

function warnMissingTableOnce() {
  if (missingTableWarned) return;
  missingTableWarned = true;
  console.warn("[youtube/search-cache]", MISSING_TABLE_HINT);
}

async function bumpHitCount(
  admin: ReturnType<typeof createServiceClient>,
  queryKey: string,
  current: number,
): Promise<void> {
  const { error } = await admin
    .from("youtube_search_cache")
    .update({ hit_count: current + 1 })
    .eq("query_key", queryKey);
  if (error && !isMissingRelationError(error, "youtube_search_cache")) {
    console.warn("[youtube/search-cache] hit_count update failed:", error.message);
  }
}

export async function getYouTubeSearchCache(
  queryKey: string,
): Promise<TrackCandidate[] | null> {
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("youtube_search_cache")
      .select("results, expires_at, hit_count")
      .eq("query_key", queryKey)
      .maybeSingle();

    if (error) {
      if (isMissingRelationError(error, "youtube_search_cache")) {
        warnMissingTableOnce();
        return null;
      }
      console.warn("[youtube/search-cache] get failed:", error.message);
      return null;
    }

    const row = data as CacheRow | null;
    if (!row) return null;

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      const { error: delError } = await admin
        .from("youtube_search_cache")
        .delete()
        .eq("query_key", queryKey);
      if (
        delError &&
        !isMissingRelationError(delError, "youtube_search_cache")
      ) {
        console.warn(
          "[youtube/search-cache] expire delete failed:",
          delError.message,
        );
      }
      return null;
    }

    const parsed = parseCachedTrackCandidates(row.results);
    if (!parsed) return null;

    void bumpHitCount(admin, queryKey, row.hit_count ?? 0);

    return parsed;
  } catch (e) {
    console.warn("[youtube/search-cache] get error:", e);
    return null;
  }
}

export async function setYouTubeSearchCache(
  queryKey: string,
  results: TrackCandidate[],
): Promise<void> {
  try {
    const admin = createServiceClient();
    const expiresAt = new Date(
      Date.now() + YOUTUBE_SEARCH_CACHE_TTL_MS,
    ).toISOString();

    const { error } = await admin.from("youtube_search_cache").upsert(
      {
        query_key: queryKey,
        results,
        hit_count: 0,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: "query_key" },
    );

    if (error) {
      if (isMissingRelationError(error, "youtube_search_cache")) {
        warnMissingTableOnce();
        return;
      }
      console.warn("[youtube/search-cache] set failed:", error.message);
    }
  } catch (e) {
    console.warn("[youtube/search-cache] set error:", e);
  }
}
