import dictJson from "./dict.json";

export type ArtistDict = Record<string, string>;

/** 手動追加可能な正規化辞書（JSON） */
export const ARTIST_DICT: ArtistDict = dictJson as ArtistDict;

export function dictKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000・･._\-–—']/g, "")
    .replace(/[’'`]/g, "")
    .trim();
}

/**
 * 辞書に照らして統一表記へ。
 * ヒットしなければ元の文字列（前後トリム・NFKC）を返す。
 */
export function normalizeArtistName(
  raw: string,
  dict: ArtistDict = ARTIST_DICT,
): string {
  const trimmed = raw.normalize("NFKC").trim();
  if (!trimmed) return "";

  const hit = dict[dictKey(trimmed)];
  if (hit) return hit;

  // 括弧付きノイズを落として再検索: 星街すいせい(cover)
  const withoutParen = trimmed
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutParen && withoutParen !== trimmed) {
    const hit2 = dict[dictKey(withoutParen)];
    if (hit2) return hit2;
    return withoutParen;
  }

  return trimmed;
}

export function normalizeArtistNames(
  names: string[],
  dict: ArtistDict = ARTIST_DICT,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const n = normalizeArtistName(name, dict);
    if (!n) continue;
    const key = dictKey(n);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}
