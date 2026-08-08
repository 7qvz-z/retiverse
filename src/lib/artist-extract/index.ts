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
  dictKey,
} from "./normalize";
import {
  EMPTY_OVERRIDES,
  expandUserSplits,
  isRejectedName,
  isUserConfirmedName,
  mergeDictionaryWithOverrides,
  type ArtistOverrides,
} from "./overrides";
import { resolveFranchiseArtists } from "./groups";
import { splitArtistCandidates } from "./split";
import {
  isBlockedName,
  validateArtistNames,
  type AggregateResult,
  type ArtistAdoptedBy,
  type ArtistEvidence,
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
  overrides?: ArtistOverrides;
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
  let base: AliasDictionary;
  if (input.dictionary) {
    base = input.dictionary;
  } else if (input.dict) {
    const inverted: AliasDictionary = {};
    for (const [aliasKey, canonical] of Object.entries(input.dict)) {
      const list = inverted[canonical] ?? [];
      if (!list.includes(aliasKey)) list.push(aliasKey);
      inverted[canonical] = list;
    }
    base = inverted;
  } else {
    base = ALIAS_DICTIONARY;
  }

  const overrides = input.overrides ?? EMPTY_OVERRIDES;
  return mergeDictionaryWithOverrides(base, overrides);
}

function resolveOverrides(input: ArtistExtractInput): ArtistOverrides {
  return input.overrides ?? EMPTY_OVERRIDES;
}

type Collected = {
  names: string[];
  unclassified: UnclassifiedItem[];
};

function collectFromSegments(
  segments: string[],
  dictionary: AliasDictionary,
  overrides: ArtistOverrides,
): Collected {
  const names: string[] = [];
  const unclassified: UnclassifiedItem[] = [];

  for (const seg of segments) {
    const cleanedSeg = cleanExtractedName(seg);
    if (!cleanedSeg) continue;

    // ユーザー分割が最優先
    const userSplit = expandUserSplits(cleanedSeg, overrides.splits);
    if (userSplit.length >= 2) {
      for (const part of userSplit) {
        const cleaned = cleanExtractedName(part);
        if (!cleaned) continue;
        if (isRejectedName(cleaned, overrides.rejected)) continue;
        const normalized = normalizeArtistName(cleaned, dictionary);
        if (!normalized) continue;
        if (isRejectedName(normalized, overrides.rejected)) continue;
        names.push(normalized);
      }
      continue;
    }

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
      for (const expanded of expandUserSplits(part, overrides.splits)) {
        const cleaned = cleanExtractedName(expanded);
        if (!cleaned) continue;
        if (isRejectedName(cleaned, overrides.rejected)) continue;
        const normalized = normalizeArtistName(cleaned, dictionary);
        if (!normalized) continue;
        if (isRejectedName(normalized, overrides.rejected)) continue;
        names.push(normalized);
      }
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
  franchiseKind: "solo" | "unit" | "group" | "none";
};

function extractVideoCandidates(
  input: ArtistExtractInput,
): VideoExtract {
  const dictionary = resolveDictionary(input);
  const overrides = resolveOverrides(input);
  const title = input.title?.trim() ?? "";
  const channelTitle = input.channelTitle?.trim() ?? "";

  // フランチャイズ優先（ソロ > ユニット > グループのみ）。該当時は通常抽出を上書き
  const franchise = resolveFranchiseArtists(title, channelTitle, dictionary);
  if (franchise.kind !== "none") {
    const highNames =
      franchise.kind === "solo"
        ? franchise.artists.filter(
            (n) => !franchise.group || dictKey(n) !== dictKey(franchise.group),
          )
        : franchise.kind === "unit"
          ? [...franchise.artists]
          : [];
    const channelNames =
      franchise.kind === "group"
        ? [...franchise.artists]
        : franchise.kind === "solo" && franchise.group
          ? [franchise.group]
          : [];

    return {
      highNames: highNames.filter(
        (n) => !isRejectedName(n, overrides.rejected),
      ),
      lowNames: [],
      channelNames: channelNames.filter(
        (n) => !isRejectedName(n, overrides.rejected),
      ),
      unclassified: [],
      confidence: "high",
      franchiseKind: franchise.kind,
    };
  }

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

  const high = collectFromSegments(highSegs, dictionary, overrides);
  const low = collectFromSegments(lowSegs, dictionary, overrides);
  const channel = collectFromSegments(
    fromChannel.segments,
    dictionary,
    overrides,
  );

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
    ].filter((u) => !isRejectedName(u.name, overrides.rejected)),
    confidence,
    franchiseKind: "none",
  };
}

/**
 * 単一動画: high/channel は確定候補、low のみは要確認
 */
export function extractArtistsFromVideo(
  input: ArtistExtractInput,
): ArtistExtractResult {
  const dictionary = resolveDictionary(input);
  const overrides = resolveOverrides(input);
  const lookup = buildAliasLookup(dictionary);
  const extracted = extractVideoCandidates(input);

  const confirmedSeed: string[] = [];
  const weak: UnclassifiedItem[] = [];

  const pushConfirmed = (name: string) => {
    if (isRejectedName(name, overrides.rejected)) return;
    if (!isBlockedName(name)) confirmedSeed.push(name);
  };

  for (const name of extracted.channelNames) pushConfirmed(name);
  for (const name of extracted.highNames) pushConfirmed(name);

  for (const name of extracted.lowNames) {
    if (isRejectedName(name, overrides.rejected)) continue;
    // エイリアスヒット or ユーザー確認なら確定扱い
    if (
      lookup.has(dictKey(name)) ||
      isUserConfirmedName(name, overrides.confirmed)
    ) {
      pushConfirmed(name);
      continue;
    }
    // low 単独は確定にしない
    if (
      !extracted.channelNames.includes(name) &&
      !extracted.highNames.includes(name)
    ) {
      weak.push({
        name,
        reasons: ["低自信度のタイトル抽出（単独では未確定）"],
      });
    }
  }

  // ユーザー confirm で未出現の名前はここでは追加しない（集約側で扱う）
  // グループ全員展開はしない（extractVideoCandidates 内の franchise 解決に委譲）

  const validation = validateArtistNames(confirmedSeed, [
    ...extracted.unclassified,
    ...weak,
  ]);

  return toResult(validation, extracted.confidence, "rules");
}

/**
 * 複数動画分をまとめて検証（PL解析用）
 * 採用基準:
 * 1. エイリアス辞書ヒット（ユーザー override 含む）
 * 2. チャンネル名由来
 * 3. confidence high 由来
 * 4. 2曲以上で出現
 * 5. ユーザー confirm
 */
export function aggregateValidatedArtists(
  videos: { title: string; channelTitle: string }[],
  dictionary?: AliasDictionary,
  overrides: ArtistOverrides = EMPTY_OVERRIDES,
): AggregateResult {
  const dict = mergeDictionaryWithOverrides(
    dictionary ?? ALIAS_DICTIONARY,
    overrides,
  );
  const lookup = buildAliasLookup(dict);

  type Acc = {
    name: string;
    occurrences: number;
    fromChannel: boolean;
    highConfidence: boolean;
    aliasHit: boolean;
    fromUnit: boolean;
    sampleTitle: string | null;
    sampleChannel: string | null;
  };

  const acc = new Map<string, Acc>();
  const unclassifiedMap = new Map<string, UnclassifiedItem>();

  const bump = (
    name: string,
    flags: Partial<
      Omit<Acc, "name" | "occurrences" | "sampleTitle" | "sampleChannel">
    >,
    meta?: { title?: string; channel?: string },
  ) => {
    if (isRejectedName(name, overrides.rejected)) return;
    const k = dictKey(name);
    const prev = acc.get(k);
    const title = meta?.title?.trim() || null;
    const channel = meta?.channel?.trim() || null;
    if (prev) {
      prev.occurrences += 1;
      prev.fromChannel ||= Boolean(flags.fromChannel);
      prev.highConfidence ||= Boolean(flags.highConfidence);
      prev.aliasHit ||= Boolean(flags.aliasHit) || lookup.has(k);
      prev.fromUnit ||= Boolean(flags.fromUnit);
      if (!prev.sampleTitle && title) prev.sampleTitle = title;
      if (!prev.sampleChannel && channel) prev.sampleChannel = channel;
    } else {
      acc.set(k, {
        name,
        occurrences: 1,
        fromChannel: Boolean(flags.fromChannel),
        highConfidence: Boolean(flags.highConfidence),
        aliasHit: Boolean(flags.aliasHit) || lookup.has(k),
        fromUnit: Boolean(flags.fromUnit),
        sampleTitle: title,
        sampleChannel: channel,
      });
    }
  };

  for (const video of videos) {
    const meta = { title: video.title, channel: video.channelTitle };
    const extracted = extractVideoCandidates({
      title: video.title,
      channelTitle: video.channelTitle,
      dictionary: dict,
      overrides,
    });
    const fromUnit = extracted.franchiseKind === "unit";

    for (const name of extracted.channelNames) {
      bump(name, { fromChannel: true, highConfidence: true }, meta);
    }
    for (const name of extracted.highNames) {
      bump(
        name,
        { highConfidence: true, fromUnit },
        meta,
      );
    }
    for (const name of extracted.lowNames) {
      bump(name, { highConfidence: false }, meta);
    }
    for (const item of extracted.unclassified) {
      if (isRejectedName(item.name, overrides.rejected)) continue;
      bump(item.name, { highConfidence: false }, meta);
      if (!unclassifiedMap.has(item.name)) {
        unclassifiedMap.set(item.name, item);
      }
    }
  }

  const resolveAdoptedBy = (item: Acc): ArtistAdoptedBy => {
    if (isUserConfirmedName(item.name, overrides.confirmed)) return "confirm";
    if (item.fromUnit) return "unit";
    if (item.aliasHit) return "alias";
    if (item.fromChannel) return "channel";
    if (item.occurrences >= 2) return "multi";
    if (item.highConfidence) return "high";
    return "unknown";
  };

  const confirmed: string[] = [];
  for (const item of acc.values()) {
    if (isBlockedName(item.name)) continue;
    if (isRejectedName(item.name, overrides.rejected)) continue;

    const adopt =
      item.aliasHit ||
      item.fromChannel ||
      item.highConfidence ||
      item.occurrences >= 2 ||
      item.fromUnit ||
      isUserConfirmedName(item.name, overrides.confirmed);

    if (adopt) {
      confirmed.push(item.name);
    } else {
      unclassifiedMap.set(item.name, {
        name: item.name,
        reasons: ["出現1回かつ低自信度のため要確認"],
      });
    }
  }

  const validated = validateArtistNames(confirmed, [
    ...unclassifiedMap.values(),
  ]);

  const finalConfirmed = validated.confirmed.filter(
    (n) => !isRejectedName(n, overrides.rejected),
  );
  const finalUnclassified = validated.unclassified.filter(
    (u) => !isRejectedName(u.name, overrides.rejected),
  );
  const finalSimilar = validated.similarPairs.filter(
    (p) =>
      !isRejectedName(p.a, overrides.rejected) &&
      !isRejectedName(p.b, overrides.rejected),
  );

  const evidenceNames = new Set([
    ...finalConfirmed,
    ...finalUnclassified.map((u) => u.name),
  ]);
  const evidence: ArtistEvidence[] = [];
  for (const name of evidenceNames) {
    const item = acc.get(dictKey(name));
    if (item) {
      evidence.push({
        name: item.name,
        sampleTitle: item.sampleTitle,
        sampleChannel: item.sampleChannel,
        occurrenceCount: item.occurrences,
        adoptedBy: resolveAdoptedBy(item),
      });
    } else {
      evidence.push({
        name,
        sampleTitle: null,
        sampleChannel: null,
        occurrenceCount: 1,
        adoptedBy: "unknown",
      });
    }
  }
  evidence.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  return {
    confirmed: finalConfirmed,
    unclassified: finalUnclassified,
    similarPairs: finalSimilar,
    evidence,
  };
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
      .filter(Boolean)
      .filter((n) => !isRejectedName(n, resolveOverrides(input).rejected));
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
export {
  buildOverrides,
  correctionFromDbRow,
  EMPTY_OVERRIDES,
  mergeDictionaryWithOverrides,
  expandUserSplits,
} from "./overrides";
export { expandGroupMembers, getGroupMembers, GROUP_MEMBERS, UNIT_MEMBERS, resolveFranchiseArtists } from "./groups";
export type { AliasDictionary, ArtistDict } from "./normalize";
export type { UnclassifiedItem, SimilarPair, ValidationResult, AggregateResult, ArtistEvidence, ArtistAdoptedBy } from "./validate";
export type {
  ArtistCorrection as PipelineArtistCorrection,
  ArtistOverrides,
} from "./overrides";
