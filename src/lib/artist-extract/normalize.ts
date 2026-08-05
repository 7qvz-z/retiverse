import aliasDictionaryJson from "./alias-dictionary.json";
import { cleanExtractedName } from "./clean";

/** canonical → 表記ゆれ一覧 */
export type AliasDictionary = Record<string, string[]>;

export type FlatArtistDict = Record<string, string>;

export const ALIAS_DICTIONARY: AliasDictionary =
  aliasDictionaryJson as AliasDictionary;

export function dictKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000・･._\-–—']/g, "")
    .replace(/[’'`]/g, "")
    .trim();
}

/**
 * エイリアス辞書から「表記 → 正式名」の逆引きマップを構築
 */
export function buildAliasLookup(
  dictionary: AliasDictionary = ALIAS_DICTIONARY,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(dictionary)) {
    map.set(dictKey(canonical), canonical);
    for (const alias of aliases) {
      map.set(dictKey(alias), canonical);
    }
  }
  return map;
}

/** @deprecated 互換用: flat dict（alias→canonical） */
export type ArtistDict = FlatArtistDict;

export const ARTIST_DICT: FlatArtistDict = (() => {
  const flat: FlatArtistDict = {};
  for (const [canonical, aliases] of Object.entries(ALIAS_DICTIONARY)) {
    flat[dictKey(canonical)] = canonical;
    for (const alias of aliases) {
      flat[dictKey(alias)] = canonical;
    }
  }
  return flat;
})();

/**
 * ステップB: エイリアス正規化
 * 一致すれば canonical name に置き換え
 */
export function normalizeArtistName(
  raw: string,
  dictionary: AliasDictionary = ALIAS_DICTIONARY,
): string {
  const cleaned = cleanExtractedName(raw);
  if (!cleaned) return "";

  const lookup = buildAliasLookup(dictionary);
  const hit = lookup.get(dictKey(cleaned));
  if (hit) return hit;

  // 括弧ノイズ除去後にもう一度
  const withoutParen = cleaned
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutParen && withoutParen !== cleaned) {
    const hit2 = lookup.get(dictKey(withoutParen));
    if (hit2) return hit2;
    return withoutParen;
  }

  return cleaned;
}

export function normalizeArtistNames(
  names: string[],
  dictionary: AliasDictionary = ALIAS_DICTIONARY,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const n = normalizeArtistName(name, dictionary);
    if (!n) continue;
    const key = dictKey(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

/**
 * 手動マージ結果を辞書に反映（メモリ上）
 * canonical に mergeFrom をエイリアスとして追加
 */
export function mergeAliasIntoDictionary(
  dictionary: AliasDictionary,
  canonical: string,
  mergeFrom: string,
): AliasDictionary {
  const next: AliasDictionary = { ...dictionary };
  const canon = canonical.trim();
  const from = mergeFrom.trim();
  if (!canon || !from || dictKey(canon) === dictKey(from)) {
    return next;
  }

  // mergeFrom が別 canonical だった場合、そのエイリアスも吸収
  const absorbedAliases = [...(next[from] ?? [])];
  if (next[from]) {
    delete next[from];
  }

  // 他のエントリから from / canon をエイリアス参照している場合は付け替え
  for (const [key, aliases] of Object.entries(next)) {
    next[key] = aliases.filter(
      (a) => dictKey(a) !== dictKey(from) && dictKey(a) !== dictKey(canon),
    );
  }

  const existing = next[canon] ?? [];
  const merged = [...existing];
  for (const alias of [from, ...absorbedAliases]) {
    if (
      dictKey(alias) !== dictKey(canon) &&
      !merged.some((a) => dictKey(a) === dictKey(alias))
    ) {
      merged.push(alias);
    }
  }
  next[canon] = merged;
  return next;
}
