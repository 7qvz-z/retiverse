/**
 * ステップA: 抽出直後のチャンネル名／候補クリーニング
 */

const KANA_ONLY = /^[\u3040-\u309f\u30a0-\u30ff\uff66-\uff9dーｰ\s]+$/;

function isKanaOnly(text: string): boolean {
  const t = text.normalize("NFKC").trim();
  return t.length > 0 && KANA_ONLY.test(t);
}

/**
 * 末尾の装飾・チャンネルサフィックスを繰り返し除去
 */
function stripChannelDecorations(raw: string): string {
  let name = raw.trim();
  let prev = "";
  while (prev !== name) {
    prev = name;
    name = name
      .replace(/\s*[-–—]?\s*YouTube\s*$/i, "")
      .replace(/\s*[（(]\s*YouTube\s*[）)]\s*$/i, "")
      .replace(/\s*-\s*Topic$/i, "")
      .replace(/\s*VEVO$/i, "")
      .replace(/\s*-\s*A\.I\.Channel$/i, "")
      .replace(/\s*-\s*AI\.?Channel$/i, "")
      .replace(/\s+Ch\.\s*hololive(?:-EN)?$/i, "")
      .replace(/\s+Ch\..*$/i, "")
      .replace(/\s*Official(?:\s*(?:Music\s*)?(?:Channel|Video|MV))?$/i, "")
      .replace(/\s*OFFICIAL$/i, "")
      .replace(/\s*公式(?:ミュージック)?(?:チャンネル|Channel)?$/i, "")
      .replace(/\s+Channel$/i, "")
      .replace(/\s*Release$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return name;
}

/**
 * 「本体名-ふりがな」形式: 2番目がかなのみなら読みとみなして除去
 * 例: 天月-あまつき → 天月
 *     天月-あまつき-YouTube（YouTube除去後）→ 天月
 */
function stripFuriganaHyphen(raw: string): string {
  const parts = raw
    .split(/\s*[-–—]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return raw.trim();

  // 2番目がかなのみ → 本体は先頭
  if (isKanaOnly(parts[1])) {
    return parts[0];
  }

  return raw.trim();
}

/**
 * ステップA本体: 抽出直後に適用するクリーニング
 */
export function cleanExtractedName(raw: string): string {
  if (!raw?.trim()) return "";

  let name = raw.normalize("NFKC").trim();

  // 【音莉飴】 → 音莉飴（中身を残す）
  name = name.replace(/【([^】]*)】/g, "$1");
  name = name.replace(/\[([^\]]*)\]/g, "$1");

  name = stripChannelDecorations(name);
  name = stripFuriganaHyphen(name);
  // ふりがな除去後にもう一度サフィックス（順序の揺れ対策）
  name = stripChannelDecorations(name);

  name = name.replace(/\s+/g, " ").trim();

  if (!name || /^(official|music|topic|release|channel|youtube)$/i.test(name)) {
    return "";
  }
  return name;
}

/** チャンネル名専用（null 可） */
export function cleanChannelName(channelTitle: string): string | null {
  const cleaned = cleanExtractedName(channelTitle);
  return cleaned || null;
}
