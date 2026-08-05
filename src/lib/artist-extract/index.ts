import { extractArtistsWithClaude } from "./claude-fallback";
import {
  extractChannelSegments,
  extractTitleSegments,
} from "./extract";
import { normalizeArtistNames, type ArtistDict, ARTIST_DICT } from "./normalize";
import { splitArtistCandidates } from "./split";

export type ArtistExtractInput = {
  title?: string;
  channelTitle?: string;
  description?: string;
  /** テストや上書き用 */
  dict?: ArtistDict;
  /** true のとき低自信度で Claude を呼ぶ（デフォルト false＝ルールのみ） */
  useClaudeFallback?: boolean;
};

export type ArtistExtractResult = {
  artists: string[];
  confidence: "high" | "low";
  source: "rules" | "claude";
};

function collectFromSegments(segments: string[]): string[] {
  const names: string[] = [];
  for (const seg of segments) {
    for (const part of splitArtistCandidates(seg)) {
      const cleaned = part
        .replace(/[（(][^）)]*[）)]/g, "")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned) names.push(cleaned);
    }
  }
  return names;
}

/**
 * 動画メタデータからアーティスト名を抽出する
 *
 * 1. 抽出 → 2. 分割 → 3. 正規化
 * 自信度が低い場合のみ Claude フォールバック（オプション）
 */
export function extractArtistsFromVideo(
  input: ArtistExtractInput,
): ArtistExtractResult {
  const dict = input.dict ?? ARTIST_DICT;
  const title = input.title?.trim() ?? "";
  const channelTitle = input.channelTitle?.trim() ?? "";

  const fromTitle = title
    ? extractTitleSegments(title)
    : { segments: [] as string[], confidence: "low" as const };
  const fromChannel = channelTitle
    ? extractChannelSegments(channelTitle)
    : { segments: [] as string[], confidence: "low" as const };

  let segments: string[] = [];
  let confidence: "high" | "low" = "low";

  // タイトル高自信を優先。無ければチャンネル。
  if (fromTitle.segments.length > 0 && fromTitle.confidence === "high") {
    segments = fromTitle.segments;
    confidence = "high";
  } else if (fromChannel.segments.length > 0) {
    segments = fromChannel.segments;
    confidence = fromChannel.confidence;
    // タイトルにも何かあればマージ（コラボ補完など）
    if (fromTitle.segments.length > 0) {
      segments = [...fromTitle.segments, ...fromChannel.segments];
    }
  } else if (fromTitle.segments.length > 0) {
    segments = fromTitle.segments;
    confidence = fromTitle.confidence;
  }

  const split = collectFromSegments(segments);
  const artists = normalizeArtistNames(split, dict);

  if (artists.length > 0) {
    return { artists, confidence, source: "rules" };
  }

  return { artists: [], confidence: "low", source: "rules" };
}

/**
 * 非同期版（低自信度時に Claude フォールバック可能）
 */
export async function extractArtistsFromVideoAsync(
  input: ArtistExtractInput,
): Promise<ArtistExtractResult> {
  const ruled = extractArtistsFromVideo(input);
  if (ruled.artists.length > 0 && ruled.confidence === "high") {
    return ruled;
  }
  if (!input.useClaudeFallback) {
    return ruled;
  }

  const fromClaude = await extractArtistsWithClaude({
    title: input.title,
    channelTitle: input.channelTitle,
    description: input.description,
  });
  if (fromClaude && fromClaude.length > 0) {
    return {
      artists: normalizeArtistNames(fromClaude, input.dict ?? ARTIST_DICT),
      confidence: "high",
      source: "claude",
    };
  }
  return ruled;
}

export {
  extractTitleSegments,
  extractChannelSegments,
  cleanChannelName,
  resolveSlashParts,
} from "./extract";
export { splitArtistCandidates } from "./split";
export {
  normalizeArtistName,
  normalizeArtistNames,
  ARTIST_DICT,
  dictKey,
} from "./normalize";
