/**
 * 文字クラス共通定義（clean / validate で共有）
 */

/** 通常の人名に使える文字（英数字・かな・漢字・半角カナ） */
export const NORMAL_CHAR =
  /[a-zA-Z0-9\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9d]/g;

/** 装飾的 unicode（絵文字・記号・結合文字など） */
export const DECORATIVE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2300}-\u{23FF}\u{2B50}\u{2B55}★☆♪♫♥♡◆◇■□●○※✨☀☁☂☃❄☄⚡☀︎]/gu;

/** 装飾除去用（【】などは clean 側で別処理するため絵文字・装飾記号中心） */
export const DECORATIVE_STRIP =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2300}-\u{23FF}\u{2B50}\u{2B55}★☆♪♫♥♡◆◇■□●○※✨]+/gu;

export function countNormalChars(text: string): number {
  return (text.match(NORMAL_CHAR) ?? []).length;
}

export function stripDecorativeChars(text: string): string {
  return text
    .replace(DECORATIVE_STRIP, " ")
    .replace(/\s+/g, " ")
    .trim();
}
