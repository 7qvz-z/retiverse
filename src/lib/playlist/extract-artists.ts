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
  /^release$/i,
  /^releases$/i,
  /^records$/i,
  /^entertainment$/i,
  /^channel$/i,
  /^label$/i,
  /^studio$/i,
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

/** アーティスト名ではなくレーベル／番組系チャンネル */
const NON_ARTIST_CHANNEL = [
  /the\s*first\s*take/i,
  /sony\s*music/i,
  /universal\s*music/i,
  /warner\s*music/i,
  /emi\s*records/i,
  /virgin\s*music/i,
  /\bavex\b/i,
  /tower\s*records/i,
  /spotify/i,
  /apple\s*music/i,
  /amazon\s*music/i,
  /music\s*station/i,
  /cdtv/i,
  /カウントダウン/i,
  /音楽番組/i,
  /^vevo$/i,
  /^release$/i,
];

const TITLE_JUNK =
  /Official\s*(Music\s*)?(Video|Audio)|Music\s*Video|\bMV\b|\bHD\b|\bHQ\b|歌詞付き?|フルサイズ|フルVer\.?|Official\s*Lyric\s*Video|Lyric\s*Video|Audio\s*Only|Visualizer|Performance\s*Video|Dance\s*Practice/gi;

const CJK_RE = /[\u3040-\u30ff\u4e00-\u9fff]/;

/**
 * 学マス（初星学園）など、ローマ字 Topic を日本語名へ寄せる
 * key は normalizeKey 後
 */
const ROMAJI_TO_JAPANESE: Record<string, string> = {
  hatsuhoshigakuen: "初星学園",
  hatsuhoshi: "初星学園",
  gakuenidolmaster: "初星学園",
  gakumas: "初星学園",
  hanamisaki: "花海咲季",
  sakihanami: "花海咲季",
  tsukimuratemari: "月村手毬",
  temaritsukimura: "月村手毬",
  fujitakotone: "藤田ことね",
  kotonefujita: "藤田ことね",
  arimuramao: "有村麻央",
  maoarimura: "有村麻央",
  katsuragililja: "葛城リーリヤ",
  katsuragililya: "葛城リーリヤ",
  liljakatsuragi: "葛城リーリヤ",
  kuramotochina: "倉本千奈",
  chinakuramoto: "倉本千奈",
  shiunsumika: "紫雲清夏",
  sumikashiun: "紫雲清夏",
  shinosawahiro: "篠澤広",
  hiroshinosawa: "篠澤広",
  himesakirinami: "姫崎莉波",
  rinamihimesaki: "姫崎莉波",
  hanamiume: "花海佑芽",
  umehanami: "花海佑芽",
  hatayamisuzu: "秦谷美鈴",
  misuzuhataya: "秦谷美鈴",
  juousena: "十王星南",
  juosena: "十王星南",
  senajuo: "十王星南",
  amayatsubame: "雨夜燕",
  tsubameamaya: "雨夜燕",
};

/** タイトル中に出てきたら拾う日本語の固有名 */
const KNOWN_JP_ARTISTS = [
  "初星学園",
  "花海咲季",
  "月村手毬",
  "藤田ことね",
  "有村麻央",
  "葛城リーリヤ",
  "倉本千奈",
  "紫雲清夏",
  "篠澤広",
  "姫崎莉波",
  "花海佑芽",
  "秦谷美鈴",
  "十王星南",
  "雨夜燕",
] as const;

function stripChannelSuffix(channelTitle: string): string {
  return channelTitle
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s*VEVO$/i, "")
    .replace(/\s*Official\s*(Music\s*)?(Channel|Video)?$/i, "")
    .replace(/\s*公式(ミュージック)?(チャンネル|Channel)?$/i, "")
    .replace(/\s*Release$/i, "")
    .trim();
}

function normalizeKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000・･._\-–—']/g, "")
    .replace(/[’'`]/g, "")
    .trim();
}

function cjkScore(name: string): number {
  return (name.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) ?? []).length;
}

function hasJapaneseScript(name: string): boolean {
  return CJK_RE.test(name);
}

function isRomajiHeavy(name: string): boolean {
  if (hasJapaneseScript(name)) return false;
  const letters = name.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 2;
}

function scriptPriority(name: string): number {
  const jp = cjkScore(name);
  if (jp > 0) return 100 + Math.min(jp, 20);
  if (isRomajiHeavy(name)) return 10;
  return 40;
}

function isLikelyNonArtistChannel(name: string): boolean {
  return NON_ARTIST_CHANNEL.some((re) => re.test(name));
}

function looksLikeSongTitle(name: string): boolean {
  if (name.length > 24) return true;
  if (
    /バージョン|ver\.?\b|remix|アコースティック|劇場版|映画|主題歌|エンディング|オープニング|フルサイズ|歌詞/i.test(
      name,
    )
  ) {
    return true;
  }
  if ((name.match(/[をがにとへでもは]/g) ?? []).length >= 2) return true;
  if (/[をが]/.test(name) && name.length >= 8) return true;
  if (!hasJapaneseScript(name) && name.trim().split(/\s+/).length >= 4) {
    return true;
  }
  return false;
}

/** ローマ字を既知の日本語名へ。未知のローマ字は null（出さない） */
function toJapaneseDisplayName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (hasJapaneseScript(trimmed)) return trimmed;

  const mapped = ROMAJI_TO_JAPANESE[normalizeKey(trimmed)];
  if (mapped) return mapped;

  // 未知のローマ字は採用しない
  if (isRomajiHeavy(trimmed)) return null;
  return trimmed;
}

function preferDisplayName(current: string, candidate: string): string {
  const scriptDiff = scriptPriority(candidate) - scriptPriority(current);
  if (scriptDiff !== 0) return scriptDiff > 0 ? candidate : current;
  const cjkDiff = cjkScore(candidate) - cjkScore(current);
  if (cjkDiff !== 0) return cjkDiff > 0 ? candidate : current;
  if (candidate.length !== current.length) {
    return candidate.length >= current.length ? candidate : current;
  }
  return current;
}

function isUsableArtistName(name: string): boolean {
  if (!name || name.length > 60) return false;
  if (name.length < 2 && !hasJapaneseScript(name)) return false;
  if (ARTIST_NOISE.some((re) => re.test(name))) return false;
  if (/^\d+$/.test(name)) return false;
  if (looksLikeSongTitle(name)) return false;
  return true;
}

function cleanArtistToken(raw: string): string | null {
  let name = raw
    .normalize("NFKC")
    .replace(TITLE_JUNK, " ")
    .replace(/\s+/g, " ")
    .trim();

  name = name.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0]?.trim() ?? name;
  if (!isUsableArtistName(name)) return null;
  return toJapaneseDisplayName(name);
}

export function artistNameFromChannel(channelTitle: string): string | null {
  if (!channelTitle?.trim()) return null;
  const name = stripChannelSuffix(channelTitle.trim());
  if (!isUsableArtistName(name)) return null;
  if (isLikelyNonArtistChannel(name)) return null;
  return toJapaneseDisplayName(name);
}

/** タイトル本文に含まれる既知の日本語アーティスト名 */
function knownArtistsInText(text: string): string[] {
  const found: string[] = [];
  for (const name of KNOWN_JP_ARTISTS) {
    if (text.includes(name)) found.push(name);
  }
  return found;
}

function artistsFromTitle(
  title: string,
  opts: { allowLooseSplit: boolean },
): string[] {
  const found: string[] = [];
  const workRaw = title.normalize("NFKC");

  found.push(...knownArtistsInText(workRaw));

  const jpQuoted =
    workRaw.match(/^(.{1,30}?)[「『]([^」』]{1,80})[」』]/) ||
    workRaw.match(/^(.{1,30}?)[\u201c\u2018](.+)[\u201d\u2019]/);
  if (jpQuoted?.[1]) {
    const cleaned = cleanArtistToken(jpQuoted[1]);
    if (cleaned) found.push(cleaned);
  }

  // 【花海咲季】曲名
  const bracketName = workRaw.match(/^[【\[](.{1,20}?)[】\]]/);
  if (bracketName?.[1]) {
    const cleaned = cleanArtistToken(bracketName[1]);
    if (cleaned) found.push(cleaned);
  }

  const byMatch = workRaw.match(/\s+by\s+(.{1,30})$/i);
  if (byMatch?.[1]) {
    const cleaned = cleanArtistToken(byMatch[1]);
    if (cleaned) found.push(cleaned);
  }

  if (opts.allowLooseSplit) {
    let work = workRaw
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
      const left = cleanArtistToken(split[1]);
      const right = cleanArtistToken(split[2]);
      const candidates = [left, right].filter((x): x is string => Boolean(x));
      candidates.sort(
        (a, b) =>
          scriptPriority(b) - scriptPriority(a) || a.length - b.length,
      );
      if (candidates[0]) found.push(candidates[0]);
    }
  }

  return [...new Set(found)]
    .filter((n) => hasJapaneseScript(n))
    .sort((a, b) => scriptPriority(b) - scriptPriority(a));
}

function channelWeight(channelTitle: string): number {
  if (isTopicChannel(channelTitle)) return 6;
  if (/vevo/i.test(channelTitle)) return 5;
  if (/official|公式/i.test(channelTitle)) return 4;
  return 3;
}

function withScriptWeight(base: number, name: string): number {
  if (hasJapaneseScript(name)) return base + 4;
  return Math.max(1, Math.floor(base * 0.2));
}

/**
 * 原則: チャンネル名を日本語表記で使う
 * ローマ字 Topic は既知マップ／タイトル内の日本語名へ寄せる
 */
export function scoreArtistHints(
  title: string,
  channelTitle: string,
): { name: string; score: number }[] {
  if (!title || isExcludedNonSongTitle(title)) return [];

  const channelArtist = artistNameFromChannel(channelTitle);
  const weight = channelWeight(channelTitle);
  const fromTitle = artistsFromTitle(title, {
    allowLooseSplit: !channelArtist,
  });
  const results: { name: string; score: number }[] = [];

  const push = (name: string, score: number) => {
    if (!hasJapaneseScript(name)) return;
    if (!isUsableArtistName(name)) return;
    results.push({ name, score: withScriptWeight(score, name) });
  };

  if (channelArtist && hasJapaneseScript(channelArtist)) {
    push(channelArtist, weight);
  }

  // タイトルに出たアイドル名（初星学園メンバーなど）を必ず候補に
  for (const name of fromTitle) {
    push(name, weight + (channelArtist ? 0 : 1));
  }

  // チャンネルが取れずレーベル等 → タイトル頼み
  if (results.length === 0) {
    const nonArtist =
      Boolean(channelTitle?.trim()) &&
      (isLikelyNonArtistChannel(stripChannelSuffix(channelTitle)) ||
        isLikelyNonArtistChannel(channelTitle));
    const loose = artistsFromTitle(title, { allowLooseSplit: nonArtist });
    for (const name of loose) push(name, weight + 1);
  }

  // 同一名のスコア合算は rank 側で行う。ここではユニーク化
  const best = new Map<string, { name: string; score: number }>();
  for (const hint of results) {
    const key = normalizeKey(hint.name);
    const prev = best.get(key);
    if (!prev || hint.score > prev.score) best.set(key, hint);
  }
  return [...best.values()];
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
    .filter(
      (a) =>
        a.score >= 3 &&
        hasJapaneseScript(a.name) &&
        !looksLikeSongTitle(a.name) &&
        !ARTIST_NOISE.some((re) => re.test(a.name)),
    )
    .sort(
      (a, b) =>
        scriptPriority(b.name) - scriptPriority(a.name) ||
        b.score - a.score ||
        cjkScore(b.name) - cjkScore(a.name) ||
        a.name.localeCompare(b.name, "ja"),
    )
    .slice(0, limit);
}
