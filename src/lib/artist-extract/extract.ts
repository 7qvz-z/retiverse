/**
 * タイトル・チャンネル名からアーティスト候補文字列を抜き出す
 */

import { cleanChannelName, cleanExtractedName } from "./clean";

const CJK = /[\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9d]/;
const HIRAGANA = /[\u3040-\u309f]/g;

export type ExtractHints = {
  segments: string[];
  confidence: "high" | "low";
};

const TITLE_JUNK =
  /Official\s*(Music\s*)?(Video|Audio)|Music\s*Video|\bMV\b|公式\s*MV|カバー|cover|踊ってみた/gi;

/** 短い曲名としても既知のもの（アーティスト誤認防止） */
const KNOWN_SONG_TITLES = new Set([
  "アイドル",
  "idol",
  "怪獣の花唄",
  "夜に駆ける",
  "群青",
  "炎",
  "ドライフラワー",
  "残響散歌",
  "柠檬",
]);

function stripDecorations(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/【[^】]*】/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikeSongTitle(name: string): boolean {
  const t = name.trim();
  if (!t) return false;
  if (KNOWN_SONG_TITLES.has(t.toLowerCase()) || KNOWN_SONG_TITLES.has(t)) {
    return true;
  }
  if (t.length >= 12) return true;
  if ((t.match(/[をがにとへでもはの]/g) ?? []).length >= 2) return true;
  if (/の歌$|の曲$|テーマ$|ソング$|の唄$/i.test(t)) return true;
  if (/[〜～！？!?…]/.test(t)) return true;
  if (/\b(?:feat\.?|ft\.?|featuring)\b/i.test(t)) return true;
  // ひらがな比率が高い短いフレーズは曲名っぽい
  const hira = (t.match(HIRAGANA) ?? []).length;
  if (t.length >= 4 && t.length <= 10 && hira / t.length >= 0.7) {
    return true;
  }
  return false;
}

function looksLikeArtistToken(name: string): boolean {
  const t = name.trim();
  if (!t || t.length > 40) return false;
  if (looksLikeSongTitle(t)) return false;
  return true;
}

function hasCjk(name: string): boolean {
  return CJK.test(name);
}

function isLatinHeavy(name: string): boolean {
  if (hasCjk(name)) return false;
  return /[a-zA-Z]/.test(name);
}

/**
 * 「曲名/アーティスト」→ 右
 * 「漢字/ローマ字」（同一アーティストの併記）→ 左（漢字）
 */
export function resolveSlashParts(left: string, right: string): string[] {
  const l = left.trim();
  const r = right.trim();
  if (!l || !r) return [l || r].filter(Boolean);

  const rightClean = r
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const leftSong = looksLikeSongTitle(l);
  const rightArtist =
    looksLikeArtistToken(rightClean) && rightClean.length <= 24;

  if (leftSong && rightArtist) return [rightClean || r];
  if (
    l.length <= 12 &&
    rightClean.length >= 2 &&
    rightClean.length <= 24 &&
    hasCjk(rightClean) &&
    !hasCjk(l)
  ) {
    return [rightClean];
  }
  if (
    l.length <= 12 &&
    rightClean.length >= 2 &&
    rightClean.length <= 24 &&
    hasCjk(rightClean)
  ) {
    return [rightClean];
  }

  if (hasCjk(l) && isLatinHeavy(rightClean)) return [l];
  if (hasCjk(rightClean) && isLatinHeavy(l)) return [rightClean];

  return [l, rightClean || r];
}

export { cleanChannelName, cleanExtractedName };

/**
 * タイトルから候補セグメントを優先順位付きで抽出
 */
export function extractTitleSegments(title: string): {
  segments: string[];
  confidence: "high" | "low";
} {
  const raw = title.normalize("NFKC").trim();
  if (!raw) return { segments: [], confidence: "low" };

  const work = stripDecorations(raw);

  const jpQuoted = work.match(/^(.{1,40}?)[「『]([^」』]+)[」』]/);
  if (jpQuoted?.[1] && !looksLikeSongTitle(jpQuoted[1])) {
    return { segments: [jpQuoted[1].trim()], confidence: "high" };
  }

  const afterQuoteDash = work.match(
    /[「『][^」』]+[」』]\s*[-–—]\s*(.+)$/,
  );
  if (afterQuoteDash?.[1]) {
    const seg = afterQuoteDash[1].replace(TITLE_JUNK, " ").trim();
    if (seg) return { segments: [seg], confidence: "high" };
  }

  const slash = work.match(/^(.+?)\s*[/／]\s*(.+)$/);
  if (slash?.[1] && slash[2]) {
    const right = slash[2].replace(TITLE_JUNK, " ").trim();
    const left = slash[1].trim();
    const featInLeft = left.match(/\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i);
    const resolved = resolveSlashParts(
      featInLeft ? left.slice(0, featInLeft.index).trim() : left,
      right,
    );
    if (resolved.length > 0) {
      return { segments: resolved, confidence: "high" };
    }
  }

  const dash = work.match(/^(.{1,80}?)\s*[-–—]\s*(.{1,120})$/);
  if (dash?.[1] && dash[2]) {
    const left = dash[1].replace(TITLE_JUNK, " ").trim();
    const right = dash[2].replace(TITLE_JUNK, " ").trim();
    if (/\sx\s|[×✕]|\s+with\s+|\s+vs\.?\s+/i.test(right)) {
      return { segments: [right], confidence: "high" };
    }
    if (
      left.length <= 24 &&
      looksLikeArtistToken(left) &&
      looksLikeSongTitle(right)
    ) {
      return { segments: [left], confidence: "high" };
    }
    // 右側がアーティストっぽくても low → 単独では確定タグにしない
    if (
      right.length <= 40 &&
      looksLikeArtistToken(right) &&
      !looksLikeSongTitle(right)
    ) {
      return { segments: [right], confidence: "low" };
    }
  }

  const byMatch = work.match(/\s+by\s+(.{1,40})$/i);
  if (byMatch?.[1] && !looksLikeSongTitle(byMatch[1])) {
    return { segments: [byMatch[1].trim()], confidence: "high" };
  }

  return { segments: [], confidence: "low" };
}

export function extractChannelSegments(channelTitle: string): {
  segments: string[];
  confidence: "high" | "low";
} {
  const cleaned = cleanChannelName(channelTitle);
  if (!cleaned) return { segments: [], confidence: "low" };
  return { segments: [cleaned], confidence: "high" };
}
