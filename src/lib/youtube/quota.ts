import { createServiceClient } from "@/lib/supabase/service";
import { isMissingRelationError } from "@/lib/supabase/migration-hints";

/** YouTube Data API の主なコスト（公式ドキュメント準拠の推定） */
export const YOUTUBE_QUOTA_UNITS = {
  "search.list": 100,
  "videos.list": 1,
  "channels.list": 1,
  "playlists.list": 1,
  "playlists.insert": 50,
  "playlistItems.list": 1,
  "playlistItems.insert": 50,
} as const;

export type YouTubeQuotaOperation = keyof typeof YOUTUBE_QUOTA_UNITS;

export const YOUTUBE_API_USAGE_MIGRATION =
  "supabase/migrations/20260807000000_youtube_api_usage.sql";

/** デフォルトの1日あたりクォータ（プロジェクト単位） */
export const DEFAULT_YOUTUBE_DAILY_QUOTA = 10_000;

export type YouTubeUsageSummary = {
  dailyLimit: number;
  /** 本日（太平洋時間）のプロジェクト全体の消費単位 */
  projectUnitsToday: number;
  /** 本日のあなた起因の消費単位 */
  userUnitsToday: number;
  /** キャッシュヒットで回避した search.list 回数 */
  searchCacheHitsToday: number;
  /** 実 API の search.list 回数 */
  searchApiCallsToday: number;
  /** キャッシュで節約した推定単位（hits * 100） */
  unitsSavedByCacheToday: number;
  remainingUnits: number;
  usedPercent: number;
  /** クォータ日の開始（ISO） */
  quotaDayStartIso: string;
  /** 次リセット目安（ISO, PT 翌日 0:00） */
  quotaResetsAtIso: string;
  byOperation: { operation: string; units: number; count: number }[];
  migrationMissing: boolean;
};

let missingTableWarned = false;

function warnMissingOnce() {
  if (missingTableWarned) return;
  missingTableWarned = true;
  console.warn(
    "[youtube/quota]",
    `利用量テーブルがありません。${YOUTUBE_API_USAGE_MIGRATION} を SQL Editor で実行してください。`,
  );
}

export function getDailyQuotaLimit(): number {
  const raw = process.env.YOUTUBE_API_DAILY_QUOTA?.trim();
  const n = raw ? Number(raw) : DEFAULT_YOUTUBE_DAILY_QUOTA;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_YOUTUBE_DAILY_QUOTA;
}

/** YouTube クォータ日境界は America/Los_Angeles の 0:00 */
export function getQuotaDayBounds(now = new Date()): {
  start: Date;
  end: Date;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  const offsetMinutes = getTimeZoneOffsetMinutes("America/Los_Angeles", now);
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const oh = String(Math.floor(abs / 60)).padStart(2, "0");
  const om = String(abs % 60).padStart(2, "0");
  const start = new Date(
    `${year}-${month}-${day}T00:00:00${sign}${oh}:${om}`,
  );
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const tz =
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "shortOffset",
      hour: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/i);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hours = Number(m[2] ?? 0);
  const mins = Number(m[3] ?? 0);
  return sign * (hours * 60 + mins);
}

export async function recordYouTubeApiUsage(input: {
  userId?: string | null;
  operation: YouTubeQuotaOperation | string;
  units?: number;
  fromCache?: boolean;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const units =
    input.units ??
    (input.operation in YOUTUBE_QUOTA_UNITS
      ? YOUTUBE_QUOTA_UNITS[input.operation as YouTubeQuotaOperation]
      : 0);

  try {
    const admin = createServiceClient();
    const { error } = await admin.from("youtube_api_usage").insert({
      user_id: input.userId ?? null,
      operation: input.operation,
      units: input.fromCache ? 0 : units,
      from_cache: Boolean(input.fromCache),
      meta: input.meta ?? {},
    });

    if (error) {
      if (isMissingRelationError(error, "youtube_api_usage")) {
        warnMissingOnce();
        return;
      }
      console.warn("[youtube/quota] record failed:", error.message);
    }
  } catch (e) {
    console.warn("[youtube/quota] record error:", e);
  }
}

type UsageRow = {
  user_id: string | null;
  operation: string;
  units: number;
  from_cache: boolean;
};

export async function getYouTubeUsageSummary(
  userId: string,
): Promise<YouTubeUsageSummary> {
  const dailyLimit = getDailyQuotaLimit();
  const { start, end } = getQuotaDayBounds();
  const empty: YouTubeUsageSummary = {
    dailyLimit,
    projectUnitsToday: 0,
    userUnitsToday: 0,
    searchCacheHitsToday: 0,
    searchApiCallsToday: 0,
    unitsSavedByCacheToday: 0,
    remainingUnits: dailyLimit,
    usedPercent: 0,
    quotaDayStartIso: start.toISOString(),
    quotaResetsAtIso: end.toISOString(),
    byOperation: [],
    migrationMissing: false,
  };

  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("youtube_api_usage")
      .select("user_id, operation, units, from_cache")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());

    if (error) {
      if (isMissingRelationError(error, "youtube_api_usage")) {
        warnMissingOnce();
        return { ...empty, migrationMissing: true };
      }
      console.warn("[youtube/quota] summary failed:", error.message);
      return empty;
    }

    const rows = (data as UsageRow[] | null) ?? [];
    let projectUnitsToday = 0;
    let userUnitsToday = 0;
    let searchCacheHitsToday = 0;
    let searchApiCallsToday = 0;
    const opMap = new Map<string, { units: number; count: number }>();

    for (const row of rows) {
      projectUnitsToday += row.units ?? 0;
      if (row.user_id === userId) userUnitsToday += row.units ?? 0;

      if (row.operation === "search.list") {
        if (row.from_cache) searchCacheHitsToday += 1;
        else searchApiCallsToday += 1;
      }

      if (!row.from_cache && (row.units ?? 0) > 0) {
        const prev = opMap.get(row.operation) ?? { units: 0, count: 0 };
        prev.units += row.units;
        prev.count += 1;
        opMap.set(row.operation, prev);
      }
    }

    const unitsSavedByCacheToday =
      searchCacheHitsToday * YOUTUBE_QUOTA_UNITS["search.list"];
    const remainingUnits = Math.max(0, dailyLimit - projectUnitsToday);
    const usedPercent = Math.min(
      100,
      Math.round((projectUnitsToday / dailyLimit) * 100),
    );

    const byOperation = [...opMap.entries()]
      .map(([operation, v]) => ({
        operation,
        units: v.units,
        count: v.count,
      }))
      .sort((a, b) => b.units - a.units);

    return {
      dailyLimit,
      projectUnitsToday,
      userUnitsToday,
      searchCacheHitsToday,
      searchApiCallsToday,
      unitsSavedByCacheToday,
      remainingUnits,
      usedPercent,
      quotaDayStartIso: start.toISOString(),
      quotaResetsAtIso: end.toISOString(),
      byOperation,
      migrationMissing: false,
    };
  } catch (e) {
    console.warn("[youtube/quota] summary error:", e);
    return empty;
  }
}
