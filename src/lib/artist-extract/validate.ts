import blocklistJson from "./blocklist.json";
import { dictKey } from "./normalize";

export type UnclassifiedItem = {
  name: string;
  reasons: string[];
};

export type SimilarPair = {
  a: string;
  b: string;
  similarity: number;
};

export type ValidationResult = {
  confirmed: string[];
  unclassified: UnclassifiedItem[];
  similarPairs: SimilarPair[];
};

const BLOCKLIST = (blocklistJson as string[]).map((s) => s.trim()).filter(Boolean);

const BLOCKLIST_KEYS = new Set(BLOCKLIST.map((s) => dictKey(s)));

/** 単体の一般語・レーベルっぽいパターン */
const BLOCK_PATTERNS: RegExp[] = [
  /^official$/i,
  /^records?$/i,
  /^channel$/i,
  /^music$/i,
  /^label$/i,
  /^labels$/i,
  /^entertainment$/i,
  /^studio$/i,
  /^release$/i,
  /^topic$/i,
  /^vevo$/i,
  /^mv$/i,
  /^公式$/,
  /^公式チャンネル$/,
  /\blabels?\b/i,
  /^imod(\s*jp)?$/i,
  /^hybe(\s*labels)?$/i,
];

const NORMAL_CHAR =
  /[a-zA-Z0-9\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9d]/g;

/** 装飾的 unicode（絵文字・記号類のおおまかな範囲） */
const DECORATIVE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}★☆♪♫♥♡◆◇■□●○※…〜～【】『』「」〈〉《》]/u;

export function isBlockedName(name: string): boolean {
  const t = name.trim();
  if (!t) return true;
  if (BLOCKLIST_KEYS.has(dictKey(t))) return true;
  if (BLOCK_PATTERNS.some((re) => re.test(t))) return true;
  return false;
}

export function detectAnomalies(name: string): string[] {
  const reasons: string[] = [];
  const t = name.normalize("NFKC").trim();
  if (!t) {
    reasons.push("空文字");
    return reasons;
  }

  if (t.length <= 2) {
    reasons.push("1〜2文字の断片");
  }

  const normalMatches = t.match(NORMAL_CHAR) ?? [];
  const normalCount = normalMatches.length;
  const ratio = normalCount / Math.max(t.length, 1);

  if (DECORATIVE.test(t) && normalCount <= 2) {
    reasons.push("装飾文字が多く通常文字が少ない");
  }

  if (ratio < 0.5 && t.length >= 3) {
    reasons.push("ひらがな/カタカナ/英数字以外の割合が高い");
  }

  return reasons;
}

/** レーベンシュタイン距離 */
export function levenshtein(a: string, b: string): number {
  const s = a.normalize("NFKC");
  const t = b.normalize("NFKC");
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const tmp = dp[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[n];
}

/** 0〜1（1が同一） */
export function stringSimilarity(a: string, b: string): number {
  const ka = dictKey(a);
  const kb = dictKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const dist = levenshtein(ka, kb);
  const maxLen = Math.max(ka.length, kb.length);
  if (maxLen === 0) return 0;
  return 1 - dist / maxLen;
}

export function findSimilarPairs(
  names: string[],
  threshold = 0.78,
): SimilarPair[] {
  const pairs: SimilarPair[] = [];
  const unique = [...new Set(names)];
  for (let i = 0; i < unique.length; i += 1) {
    for (let j = i + 1; j < unique.length; j += 1) {
      const a = unique[i];
      const b = unique[j];
      const similarity = stringSimilarity(a, b);
      if (similarity >= threshold && similarity < 1) {
        pairs.push({ a, b, similarity });
      }
    }
  }
  return pairs.sort((x, y) => y.similarity - x.similarity);
}

/**
 * バリデーション（検証）ステップ
 * ブロックリスト除外 → 異常検出 → 類似度ペア
 */
export function validateArtistNames(
  names: string[],
  extraUnclassified: UnclassifiedItem[] = [],
): ValidationResult {
  const confirmed: string[] = [];
  const unclassified: UnclassifiedItem[] = [...extraUnclassified];
  const seen = new Set<string>();

  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const k = dictKey(name);
    if (seen.has(k)) continue;
    seen.add(k);

    if (isBlockedName(name)) {
      // ブロックはタグ化しない（未分類にも載せない＝完全除外）
      continue;
    }

    const anomalies = detectAnomalies(name);
    if (anomalies.length > 0) {
      unclassified.push({ name, reasons: anomalies });
      continue;
    }

    confirmed.push(name);
  }

  const similarPairs = findSimilarPairs(confirmed);

  return {
    confirmed: confirmed.sort((a, b) => a.localeCompare(b, "ja")),
    unclassified: unclassified.sort((a, b) =>
      a.name.localeCompare(b.name, "ja"),
    ),
    similarPairs,
  };
}
