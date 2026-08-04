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
  /^various\s*artists$/i,
  /^ヴァリアス・?アーティスト$/,
];

const TITLE_JUNK =
  /Official\s*(Music\s*)?(Video|Audio)|Music\s*Video|\bMV\b|\bHD\b|\bHQ\b|歌詞付き?|フルサイズ|フルVer\.?|Official\s*Lyric\s*Video|Lyric\s*Video|Audio\s*Only|Visualizer|Performance\s*Video|Dance\s*Practice/gi;

/** チャンネル名から落とすサフィックスだけ（漢字など表記は維持） */
function stripChannelSuffix(channelTitle: string): string {
  return channelTitle
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s*VEVO$/i, "")
    .replace(/\s*Official\s*(Music\s*)?(Channel|Video)?$/i, "")
    .replace(/\s*公式(ミュージック)?(チャンネル|Channel)?$/i, "")
    .trim();
}

function normalizeKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[’'`]/g, "")
    .trim();
}

function cjkScore(name: string): number {
  return (name.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) ?? []).length;
}

/** 同一アーティストの別表記なら true（チャンネル表記を残す判定用） */
function isSameArtist(a: string, b: string): boolean {
  const ka = normalizeKey(a);
  const kb = normalizeKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  // 片方に他方が含まれる（例: 米津玄師 / 米津玄師 Official）
  if (ka.includes(kb) || kb.includes(ka)) return true;
  return false;
}

/** 同じキーなら漢字多めの YouTube 表記を残す */
function preferDisplayName(current: string, candidate: string): string {
  const cjkDiff = cjkScore(candidate) - cjkScore(current);
  if (cjkDiff !== 0) return cjkDiff > 0 ? candidate : current;
  if (candidate.length !== current.length) {
    return candidate.length >= current.length ? candidate : current;
  }
  return current;
}

function isUsableArtistName(name: string): boolean {
  if (!name || name.length > 60) return false;
  if (name.length < 2 && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(name)) {
    return false;
  }
  if (ARTIST_NOISE.some((re) => re.test(name))) return false;
  if (/^\d+$/.test(name)) return false;
  return true;
}

function cleanTitleArtist(raw: string): string | null {
  let name = raw
    .normalize("NFKC")
    .replace(TITLE_JUNK, " ")
    .replace(/\s+/g, " ")
    .trim();

  name = name.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0]?.trim() ?? name;

  if (!isUsableArtistName(name)) return null;
  return name;
}

/**
 * YouTube チャンネル名をそのまま（サフィックスのみ除去）
 */
export function artistNameFromChannel(channelTitle: string): string | null {
  if (!channelTitle?.trim()) return null;
  const name = stripChannelSuffix(channelTitle.trim());
  if (!isUsableArtistName(name)) return null;
  return name;
}

/** タイトルからアーティスト名候補を拾う（チャンネルと違うとき用） */
function artistsFromTitle(title: string): string[] {
  const found: string[] = [];
  let work = title.normalize("NFKC");

  const jpQuoted =
    work.match(/^(.{1,40}?)[「『]([^」』]+)[」』]/) ||
    work.match(/^(.{1,40}?)[\u201c\u2018](.+)[\u201d\u2019]/);
  if (jpQuoted?.[1]) {
    const cleaned = cleanTitleArtist(jpQuoted[1]);
    if (cleaned) found.push(cleaned);
  }

  work = work
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/「[^」]*」/g, " ")
    .replace(/『[^』]*』/g, " ")
    .replace(TITLE_JUNK, " ")
    .replace(/\s+/g, " ")
    .trim();

  const split = work.match(/^(.{1,40}?)\s*[-–—|/／｜]\s*(.{1,80})$/);
  if (split?.[1] && split[2]) {
    const cleaned = cleanTitleArtist(split[1]);
    if (cleaned) found.push(cleaned);
  }

  const byMatch = work.match(/\s+by\s+(.{1,40})$/i);
  if (byMatch?.[1]) {
    const cleaned = cleanTitleArtist(byMatch[1]);
    if (cleaned) found.push(cleaned);
  }

  return [...new Set(found)];
}

function channelWeight(channelTitle: string): number {
  if (isTopicChannel(channelTitle)) return 6;
  if (/vevo/i.test(channelTitle)) return 5;
  if (/official|公式/i.test(channelTitle)) return 4;
  return 3;
}

/**
 * 原則: チャンネル名をそのまま使う
 * タイトル上のアーティスト名と明らかに違うときだけ、アーティスト名を優先
 */
export function scoreArtistHints(
  title: string,
  channelTitle: string,
): { name: string; score: number }[] {
  if (!title || isExcludedNonSongTitle(title)) return [];

  const channelArtist = artistNameFromChannel(channelTitle);
  const titleArtists = artistsFromTitle(title);
  const weight = channelWeight(channelTitle);

  if (!channelArtist) {
    return titleArtists.slice(0, 1).map((name) => ({ name, score: weight }));
  }

  // タイトルから取れた名前のうち、チャンネルと「別人」なもの
  const different = titleArtists.filter(
    (artist) => !isSameArtist(artist, channelArtist),
  );

  if (different.length > 0) {
    // チャンネル名 ≠ アーティスト名 → アーティスト名を優先
    return [{ name: different[0], score: weight + 1 }];
  }

  // 同じ／タイトルに別表記なし → チャンネル名のまま（漢字も維持）
  return [{ name: channelArtist, score: weight }];
}

export function rankArtistsFromVideos(
  videos: { title: string; channelTitle: string; videoId: string }[],
  limit = 40,
): { name: string; score: number }[] {
  const totals = new Map<string, { name: string; score: number }>();

  for (const video of videos) {
    for (const hint of scoreArtistHints(video.title, video.channelTitle)) {
      const key = normalizeKey(hint.name);
      if (!key) continue;
      const prev = totals.get(key);
      if (prev) {
        prev.score += hint.score;
        prev.name = preferDisplayName(prev.name, hint.name);
      } else {
        totals.set(key, { name: hint.name, score: hint.score });
      }
    }
  }

  return [...totals.values()]
    .filter((a) => a.score >= 3)
    .sort(
      (a, b) =>
        b.score - a.score ||
        cjkScore(b.name) - cjkScore(a.name) ||
        a.name.localeCompare(b.name, "ja"),
    )
    .slice(0, limit);
}
