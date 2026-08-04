import { isExcludedNonSongTitle, isTopicChannel } from "@/lib/playlist/filters";

const ARTIST_NOISE = [
  /^official$/i,
  /^music$/i,
  /^video$/i,
  /^audio$/i,
  /^lyrics$/i,
  /^topic$/i,
  /^vevo$/i,
  /^mv$/i,
  /^hq$/i,
  /^hd$/i,
  /^公式$/,
  /^歌詞$/,
  /^フル$/,
  /^フルサイズ$/,
  /^歌ってみた$/,
  /^cover$/i,
  /^auto[\s-]?generated$/i,
];

const TITLE_JUNK =
  /Official\s*(Music\s*)?(Video|Audio)|Music\s*Video|\bMV\b|\bHD\b|\bHQ\b|歌詞付き?|フルサイズ|フルVer\.?|Official\s*Lyric\s*Video|Lyric\s*Video|Audio\s*Only|Visualizer|Performance\s*Video|Dance\s*Practice/gi;

function isVevoChannel(channelTitle: string): boolean {
  return /vevo/i.test(channelTitle);
}

function normalizeKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[’'`]/g, "")
    .trim();
}

function cleanArtistName(raw: string): string | null {
  let name = raw
    .normalize("NFKC")
    .replace(TITLE_JUNK, " ")
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s*VEVO$/i, "")
    .replace(/\s*Official$/i, "")
    .replace(/\s*公式(チャンネル|Channel)?$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // feat. 以降は別アーティスト扱いにせず主アーティストだけ残す
  name = name.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0]?.trim() ?? name;

  // コラボ「A × B」は先頭を優先（両方欲しい場合は呼び出し側で分割）
  if (/[×xX]/.test(name) && name.length > 3) {
    const parts = name.split(/\s*[×xX]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2 && parts[0].length <= 30) {
      name = parts[0];
    }
  }

  if (!name || name.length > 40) return null;
  if (name.length < 2 && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(name)) {
    return null;
  }
  if (ARTIST_NOISE.some((re) => re.test(name))) return null;
  if (/^\d+$/.test(name)) return null;

  return name;
}

function pushHint(
  scores: Map<string, { name: string; score: number }>,
  raw: string,
  weight: number,
) {
  const cleaned = cleanArtistName(raw);
  if (!cleaned) return;
  const key = normalizeKey(cleaned);
  if (!key) return;
  const prev = scores.get(key);
  if (prev) {
    prev.score += weight;
    // より「きれい」な表記を残す（短い／スペース少なめ優先ではない、既存を維持）
  } else {
    scores.set(key, { name: cleaned, score: weight });
  }
}

/**
 * 1動画からアーティスト候補を重み付きで抽出
 * Topic / VEVO / 公式MV を高く評価
 */
export function scoreArtistHints(
  title: string,
  channelTitle: string,
): { name: string; score: number }[] {
  if (!title || isExcludedNonSongTitle(title)) return [];

  const scores = new Map<string, { name: string; score: number }>();

  // 1) Topic チャンネル名は最も信頼できる
  if (isTopicChannel(channelTitle)) {
    const topicArtist = channelTitle.replace(/\s*-\s*Topic$/i, "").trim();
    pushHint(scores, topicArtist, 6);
  }

  // 2) VEVO → チャンネル名からアーティスト
  if (isVevoChannel(channelTitle)) {
    pushHint(scores, channelTitle.replace(/\s*VEVO$/i, "").trim(), 5);
  }

  // 3) 公式チャンネル名（雑多なチャンネルは低め）
  if (/official|公式/i.test(channelTitle) && !isTopicChannel(channelTitle)) {
    const ch = channelTitle
      .replace(/\s*Official.*$/i, "")
      .replace(/\s*公式.*$/i, "")
      .trim();
    pushHint(scores, ch, 2);
  }

  // タイトル前処理（括弧内は除去しすぎない：一部は曲名）
  let work = title.normalize("NFKC");

  // 「アーティスト『曲名』」「アーティスト「曲名」」
  const jpQuoted =
    work.match(/^(.{1,40}?)[「『]([^」』]+)[」』]/) ||
    work.match(/^(.{1,40}?)[\u201c\u2018](.+)[\u201d\u2019]/);
  if (jpQuoted?.[1]) {
    pushHint(scores, jpQuoted[1], 4);
  }

  // 装飾を落としてから分割
  work = work
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/「[^」]*」/g, " ")
    .replace(/『[^』]*』/g, " ")
    .replace(TITLE_JUNK, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Artist - Song / Artist – Song / Artist | Song / Artist / Song
  const split = work.match(
    /^(.{1,40}?)\s*[-–—|/／｜]\s*(.{1,80})$/,
  );
  if (split?.[1] && split[2]) {
    // 右側が明らかに長い＝曲名側、左をアーティストに
    pushHint(scores, split[1], 3);
  }

  // Song by Artist
  const byMatch = work.match(/\s+by\s+(.{1,40})$/i);
  if (byMatch?.[1]) {
    pushHint(scores, byMatch[1], 3);
  }

  return [...scores.values()];
}

export function rankArtistsFromVideos(
  videos: { title: string; channelTitle: string; videoId: string }[],
  limit = 40,
): { name: string; score: number }[] {
  const totals = new Map<string, { name: string; score: number }>();

  for (const video of videos) {
    for (const hint of scoreArtistHints(video.title, video.channelTitle)) {
      const key = normalizeKey(hint.name);
      const prev = totals.get(key);
      if (prev) {
        prev.score += hint.score;
      } else {
        totals.set(key, { name: hint.name, score: hint.score });
      }
    }
  }

  return [...totals.values()]
    .filter((a) => a.score >= 3) // 弱い1発ヒットは捨てる
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ja"))
    .slice(0, limit);
}
