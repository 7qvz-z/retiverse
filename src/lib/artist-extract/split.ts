/**
 * 複数アーティストを区切り文字で配列に分割する
 * （左右が同じ GILTY×GILTY のようなグループ名は分割しない）
 */

const SPLIT_RE =
  /\s*[×✕✖ｘ]\s*|\s+[xX]\s+|\s*[&＆]\s*|\s*(?:feat\.?|ft\.?|featuring)\s+|\s*[、,]\s*/i;

function key(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]/g, "")
    .trim();
}

export function splitArtistCandidates(raw: string): string[] {
  const text = raw.normalize("NFKC").trim();
  if (!text) return [];

  // コラボ x が無い場合でもそのまま返す前に軽く掃除
  if (!SPLIT_RE.test(text) && !/\sx\s/i.test(` ${text} `)) {
    // "A x B x C" の x（両側スペース）は SPLIT_RE で拾う
    return [text];
  }

  // Calliope Mori x Gawr Gura x DECO*27
  const parts = text
    .split(SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return [text];

  const allSame = parts.every((p) => key(p) === key(parts[0]));
  if (allSame) return [text];

  return parts;
}
