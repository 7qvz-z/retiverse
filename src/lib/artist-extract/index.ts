import { extractArtistsWithClaude } from "./claude-fallback";
import { cleanExtractedName } from "./clean";
import {
  extractChannelSegments,
  extractTitleSegments,
} from "./extract";
import {
  ALIAS_DICTIONARY,
  normalizeArtistName,
  type AliasDictionary,
  type ArtistDict,
  ARTIST_DICT,
} from "./normalize";
import { splitArtistCandidates } from "./split";
import {
  validateArtistNames,
  type SimilarPair,
  type UnclassifiedItem,
  type ValidationResult,
} from "./validate";

export type ArtistExtractInput = {
  title?: string;
  channelTitle?: string;
  description?: string;
  dictionary?: AliasDictionary;
  dict?: ArtistDict;
  useClaudeFallback?: boolean;
};

export type ArtistExtractResult = {
  /** 確定タグ（後方互換） */
  artists: string[];
  unclassified: UnclassifiedItem[];
  similarPairs: SimilarPair[];
  confidence: "high" | "low";
  source: "rules" | "claude";
};

function resolveDictionary(input: ArtistExtractInput): AliasDictionary {
  if (input.dictionary) return input.dictionary;
  if (input.dict) {
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

type Collected = {
  names: string[];
  unclassified: UnclassifiedItem[];
};

/**
 * 抽出 → Aクリーニング → 厳格分割 → B正規化（バリデーション前）
 */
function collectFromSegments(
  segments: string[],
  dictionary: AliasDictionary,
): Collected {
  const names: string[] = [];
  const unclassified: UnclassifiedItem[] = [];

  for (const seg of segments) {
    const cleanedSeg = cleanExtractedName(seg);
    if (!cleanedSeg) continue;

    const split = splitArtistCandidates(cleanedSeg);
    for (const part of split.discarded) {
      // feat. 欠落などは破棄（表示しない）
      void part;
    }
    for (const part of split.unclassified) {
      const cleaned = cleanExtractedName(part);
      if (cleaned) {
        unclassified.push({
          name: cleaned,
          reasons: ["括弧の開閉が不揃い、または分割修復できず"],
        });
      }
    }
    for (const part of split.artists) {
      const cleaned = cleanExtractedName(part);
      if (!cleaned) continue;
      const normalized = normalizeArtistName(cleaned, dictionary);
      if (normalized) names.push(normalized);
    }
  }

  return { names, unclassified };
}

function toResult(
  validation: ValidationResult,
  confidence: "high" | "low",
  source: "rules" | "claude",
): ArtistExtractResult {
  return {
    artists: validation.confirmed,
    unclassified: validation.unclassified,
    similarPairs: validation.similarPairs,
    confidence,
    source,
  };
}

/**
 * 動画メタデータからアーティスト名を抽出する
 * 抽出 → 分割 → 正規化 → バリデーション
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

  const collected = collectFromSegments(segments, dictionary);
  const validation = validateArtistNames(
    collected.names,
    collected.unclassified,
  );

  return toResult(validation, confidence, "rules");
}

/**
 * 複数動画分をまとめて検証（PL解析用）
 */
export function aggregateValidatedArtists(
  videos: { title: string; channelTitle: string }[],
  dictionary?: AliasDictionary,
): ValidationResult {
  const score = new Map<string, number>();
  const unclassifiedMap = new Map<string, UnclassifiedItem>();

  for (const video of videos) {
    const result = extractArtistsFromVideo({
      title: video.title,
      channelTitle: video.channelTitle,
      dictionary,
    });
    for (const name of result.artists) {
      score.set(name, (score.get(name) ?? 0) + 1);
    }
    for (const item of result.unclassified) {
      const prev = unclassifiedMap.get(item.name);
      if (!prev) unclassifiedMap.set(item.name, item);
    }
  }

  const names = [...score.entries()]
    .filter(([, s]) => s >= 1)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, 60)
    .map(([name]) => name);

  return validateArtistNames(names, [...unclassifiedMap.values()]);
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
    const names = fromClaude
      .map((n) => normalizeArtistName(n, resolveDictionary(input)))
      .filter(Boolean);
    const validation = validateArtistNames(names);
    return toResult(validation, "high", "claude");
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
export {
  validateArtistNames,
  findSimilarPairs,
  stringSimilarity,
  isBlockedName,
  detectAnomalies,
} from "./validate";
export type { AliasDictionary, ArtistDict } from "./normalize";
export type { UnclassifiedItem, SimilarPair, ValidationResult } from "./validate";
