import { extractArtistsWithClaude } from "./claude-fallback";
import { cleanExtractedName } from "./clean";
import {
  extractChannelSegments,
  extractTitleSegments,
} from "./extract";
import {
  ALIAS_DICTIONARY,
  buildAliasLookup,
  normalizeArtistName,
  type AliasDictionary,
  type ArtistDict,
  ARTIST_DICT,
  dictKey,
} from "./normalize";
import { splitArtistCandidates } from "./split";
import {
  isBlockedName,
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
  artists: string[];
  unclassified: UnclassifiedItem[];
  similarPairs: SimilarPair[];
  confidence: "high" | "low";
  source: "rules" | "claude";
};

/** 候補の由来（採用基準用） */
export type CandidateMeta = {
  name: string;
  fromChannel: boolean;
  highConfidence: boolean;
  aliasHit: boolean;
  occurrences: number;
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

function collectFromSegments(
  segments: string[],
  dictionary: AliasDictionary,
): Collected {
  const names: string[] = [];
  const unclassified: UnclassifiedItem[] = [];
  const lookup = buildAliasLookup(dictionary);

  for (const seg of segments) {
    const cleanedSeg = cleanExtractedName(seg);
    if (!cleanedSeg) continue;

    // 中黒のみで繋がる曖昧名は未分類へ（split 側が条件付き分割）
    if (
      (cleanedSeg.includes("・") || cleanedSeg.includes("･")) &&
      cleanedSeg.split(/[・･]/).length > 2
    ) {
      unclassified.push({
        name: cleanedSeg,
        reasons: ["中黒区切りが複雑で自動分割を保留"],
      });
      continue;
    }

    const split = splitArtistCandidates(cleanedSeg);
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
      if (!normalized) continue;
      // aliasHit は呼び出し側で判定
      void lookup;
      names.push(normalized);
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

type VideoExtract = {
  highNames: string[];
  lowNames: string[];
  channelNames: string[];
  unclassified: UnclassifiedItem[];
  confidence: "high" | "low";
};

function extractVideoCandidates(
  input: ArtistExtractInput,
): VideoExtract {
  const dictionary = resolveDictionary(input);
  const title = input.title?.trim() ?? "";
  const channelTitle = input.channelTitle?.trim() ?? "";

  const fromTitle = title
    ? extractTitleSegments(title)
    : { segments: [] as string[], confidence: "low" as const };
  const fromChannel = channelTitle
    ? extractChannelSegments(channelTitle)
    : { segments: [] as string[], confidence: "low" as const };

  const highSegs =
    fromTitle.confidence === "high" ? fromTitle.segments : [];
  const lowSegs =
    fromTitle.confidence === "low" ? fromTitle.segments : [];

  const high = collectFromSegments(highSegs, dictionary);
  const low = collectFromSegments(lowSegs, dictionary);
  const channel = collectFromSegments(fromChannel.segments, dictionary);

  let confidence: "high" | "low" = "low";
  if (highSegs.length > 0) confidence = "high";
  else if (fromChannel.segments.length > 0) confidence = "high";
  else if (lowSegs.length > 0) confidence = "low";

  return {
    highNames: high.names,
    lowNames: low.names,
    channelNames: channel.names,
    unclassified: [
      ...high.unclassified,
      ...low.unclassified,
      ...channel.unclassified,
    ],
    confidence,
  };
}

/**
 * 単一動画: high/channel は確定候補、low のみは要確認
 */
export function extractArtistsFromVideo(
  input: ArtistExtractInput,
): ArtistExtractResult {
  const dictionary = resolveDictionary(input);
  const lookup = buildAliasLookup(dictionary);
  const extracted = extractVideoCandidates(input);

  const confirmedSeed: string[] = [];
  const weak: UnclassifiedItem[] = [];

  const pushConfirmed = (name: string) => {
    if (!isBlockedName(name)) confirmedSeed.push(name);
  };

  for (const name of extracted.channelNames) pushConfirmed(name);
  for (const name of extracted.highNames) pushConfirmed(name);

  for (const name of extracted.lowNames) {
    // エイリアスヒットなら確定扱い
    if (lookup.has(dictKey(name))) {
      pushConfirmed(name);
      continue;
    }
    // low 単独は確定にしない
    if (!extracted.channelNames.includes(name) && !extracted.highNames.includes(name)) {
      weak.push({
        name,
        reasons: ["低自信度のタイトル抽出（単独では未確定）"],
      });
    }
  }

  const validation = validateArtistNames(confirmedSeed, [
    ...extracted.unclassified,
    ...weak,
  ]);

  return toResult(validation, extracted.confidence, "rules");
}

/**
 * 複数動画分をまとめて検証（PL解析用）
 * 採用基準:
 * 1. エイリアス辞書ヒット
 * 2. チャンネル名由来
 * 3. confidence high 由来
 * 4. 2曲以上で出現
 */
export function aggregateValidatedArtists(
  videos: { title: string; channelTitle: string }[],
  dictionary?: AliasDictionary,
): ValidationResult {
  const dict = dictionary ?? ALIAS_DICTIONARY;
  const lookup = buildAliasLookup(dict);

  type Acc = {
    name: string;
    occurrences: number;
    fromChannel: boolean;
    highConfidence: boolean;
    aliasHit: boolean;
  };

  const acc = new Map<string, Acc>();
  const unclassifiedMap = new Map<string, UnclassifiedItem>();

  const bump = (
    name: string,
    flags: Partial<Omit<Acc, "name" | "occurrences">>,
  ) => {
    const k = dictKey(name);
    const prev = acc.get(k);
    if (prev) {
      prev.occurrences += 1;
      prev.fromChannel ||= Boolean(flags.fromChannel);
      prev.highConfidence ||= Boolean(flags.highConfidence);
      prev.aliasHit ||= Boolean(flags.aliasHit) || lookup.has(k);
    } else {
      acc.set(k, {
        name,
        occurrences: 1,
        fromChannel: Boolean(flags.fromChannel),
        highConfidence: Boolean(flags.highConfidence),
        aliasHit: Boolean(flags.aliasHit) || lookup.has(k),
      });
    }
  };

  for (const video of videos) {
    const extracted = extractVideoCandidates({
      title: video.title,
      channelTitle: video.channelTitle,
      dictionary: dict,
    });

    for (const name of extracted.channelNames) {
      bump(name, { fromChannel: true, highConfidence: true });
    }
    for (const name of extracted.highNames) {
      bump(name, { highConfidence: true });
    }
    for (const name of extracted.lowNames) {
      bump(name, { highConfidence: false });
    }
    for (const item of extracted.unclassified) {
      if (!unclassifiedMap.has(item.name)) {
        unclassifiedMap.set(item.name, item);
      }
    }
  }

  const confirmed: string[] = [];
  for (const item of acc.values()) {
    if (isBlockedName(item.name)) continue;

    const adopt =
      item.aliasHit ||
      item.fromChannel ||
      item.highConfidence ||
      item.occurrences >= 2;

    if (adopt) {
      // 異常検出は validate に任せるため一旦リストへ
      confirmed.push(item.name);
    } else {
      unclassifiedMap.set(item.name, {
        name: item.name,
        reasons: ["出現1回かつ低自信度のため要確認"],
      });
    }
  }

  return validateArtistNames(confirmed, [...unclassifiedMap.values()]);
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
  looksLikeSongTitle,
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
