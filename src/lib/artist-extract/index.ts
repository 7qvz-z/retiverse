import { extractArtistsWithClaude } from "./claude-fallback";
import { cleanExtractedName } from "./clean";
import {
  extractChannelSegments,
  extractTitleSegments,
} from "./extract";
import {
  ALIAS_DICTIONARY,
  normalizeArtistNames,
  type AliasDictionary,
  type ArtistDict,
  ARTIST_DICT,
} from "./normalize";
import { splitArtistCandidates } from "./split";

export type ArtistExtractInput = {
  title?: string;
  channelTitle?: string;
  description?: string;
  /** テストや上書き用（canonical → aliases） */
  dictionary?: AliasDictionary;
  /** @deprecated flat dict。dictionary を優先 */
  dict?: ArtistDict;
  /** true のとき低自信度で Claude を呼ぶ（デフォルト false＝ルールのみ） */
  useClaudeFallback?: boolean;
};

export type ArtistExtractResult = {
  artists: string[];
  confidence: "high" | "low";
  source: "rules" | "claude";
};

function resolveDictionary(input: ArtistExtractInput): AliasDictionary {
  if (input.dictionary) return input.dictionary;
  if (input.dict) {
    // flat → alias dictionary に変換（テスト互換）
    const inverted: AliasDictionary = {};
    for (const [aliasKey, canonical] of Object.entries(input.dict)) {
      const list = inverted[canonical] ?? [];
      if (!list.includes(aliasKey)) list.push(aliasKey);
      inverted[canonical] = list;
    }
    return inverted;
  }
  return ALIAS_DICTIONARY;
}

/**
 * 1. 抽出セグメント → ステップAクリーニング → 2. 分割 → 3. ステップB正規化
 */
function collectFromSegments(segments: string[]): string[] {
  const names: string[] = [];
  for (const seg of segments) {
    // ステップA（抽出直後）
    const cleanedSeg = cleanExtractedName(seg);
    if (!cleanedSeg) continue;
    for (const part of splitArtistCandidates(cleanedSeg)) {
      const cleaned = cleanExtractedName(
        part.replace(/[（(][^）)]*[）)]/g, "").trim(),
      );
      if (cleaned) names.push(cleaned);
    }
  }
  return names;
}

/**
 * 動画メタデータからアーティスト名を抽出する
 *
 * 1. 抽出 → ステップAクリーニング → 2. 分割 → 3. ステップBエイリアス正規化
 */
export function extractArtistsFromVideo(
  input: ArtistExtractInput,
): ArtistExtractResult {
  const dictionary = resolveDictionary(input);
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

  if (fromTitle.segments.length > 0 && fromTitle.confidence === "high") {
    segments = fromTitle.segments;
    confidence = "high";
  } else if (fromChannel.segments.length > 0) {
    segments = fromChannel.segments;
    confidence = fromChannel.confidence;
    if (fromTitle.segments.length > 0) {
      segments = [...fromTitle.segments, ...fromChannel.segments];
    }
  } else if (fromTitle.segments.length > 0) {
    segments = fromTitle.segments;
    confidence = fromTitle.confidence;
  }

  const split = collectFromSegments(segments);
  const artists = normalizeArtistNames(split, dictionary);

  if (artists.length > 0) {
    return { artists, confidence, source: "rules" };
  }

  return { artists: [], confidence: "low", source: "rules" };
}

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
      artists: normalizeArtistNames(fromClaude, resolveDictionary(input)),
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
export { cleanExtractedName } from "./clean";
export { splitArtistCandidates } from "./split";
export {
  normalizeArtistName,
  normalizeArtistNames,
  mergeAliasIntoDictionary,
  ALIAS_DICTIONARY,
  ARTIST_DICT,
  dictKey,
  buildAliasLookup,
} from "./normalize";
export type { AliasDictionary, ArtistDict } from "./normalize";
