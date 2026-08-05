/**
 * ステップA: 抽出直後のチャンネル名／候補クリーニング
 */

import { countNormalChars, stripDecorativeChars } from "./chars";

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
 */
function stripFuriganaHyphen(raw: string): string {
  const parts = raw
    .split(/\s*[-–—]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return raw.trim();

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

  // 絵文字・装飾記号を除去
  name = stripDecorativeChars(name);

  name = stripChannelDecorations(name);
  name = stripFuriganaHyphen(name);
  name = stripChannelDecorations(name);

  name = name.replace(/\s+/g, " ").trim();

  // 装飾除去後に通常文字がほぼ無い → 候補破棄
  if (countNormalChars(name) <= 1) {
    return "";
  }

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
