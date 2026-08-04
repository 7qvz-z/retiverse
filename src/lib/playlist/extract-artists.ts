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

/** アーティスト本人ではなく番組・レーベル系 */
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
 * ローマ字 → 日本語（全アーティスト共通。既知のものだけ変換）
 * 未知のローマ字はタイトル側の日本語を優先し、無ければチャンネル名を使う
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

/** タイトル中にあれば拾う既知の日本語名（例） */
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

/** コラボ区切り（×）。半角xは両側に空白があるときだけ */
const COLLAB_SPLIT = /\s*[×✕✖ｘ]\s*|\s+x\s+/i;

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
    .replace(/[×✕✖ｘx]/g, "x")
    .trim();
}

function cjkScore(name: string): number {
  return (name.match(/[\u3040-\u30ff\u4e00-\u9fff]/g) ?? []).length;
}

function hasJapaneseScript(name: string): boolean {
  return CJK_RE.test(name);
}

function isLatinOnly(name: string): boolean {
  if (hasJapaneseScript(name)) return false;
  return /[a-zA-Z]/.test(name);
}

function scriptPriority(name: string): number {
  const jp = cjkScore(name);
  if (jp > 0) return 100 + Math.min(jp, 20);
  if (isLatinOnly(name)) return 10;
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

function isSameArtist(a: string, b: string): boolean {
  const ka = normalizeKey(a);
  const kb = normalizeKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;
  return false;
}

/**
 * × は原則コラボ → 分割。
 * 例外: 左右が同じ（GILTY×GILTY など）はグループ名としてそのまま
 */
export function expandCollabNames(raw: string): string[] {
  const name = raw.trim();
  if (!name || !COLLAB_SPLIT.test(name)) return [name];

  const parts = name
    .split(COLLAB_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return [name];

  const allSame = parts.every((p) => normalizeKey(p) === normalizeKey(parts[0]));
  if (allSame) return [name];

  return parts;
}

/** 既知ローマ字は日本語へ。日本語はそのまま。未知ラテンは呼び出し側で優先度処理 */
function canonicalizeName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (hasJapaneseScript(trimmed)) {
    return isUsableArtistName(trimmed) ? trimmed : null;
  }

  const mapped = ROMAJI_TO_JAPANESE[normalizeKey(trimmed)];
  if (mapped) return mapped;

  if (!isUsableArtistName(trimmed)) return null;
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

function tokenizeArtistRaw(raw: string): string[] {
  const names: string[] = [];
  for (const part of expandCollabNames(raw.normalize("NFKC").trim())) {
    let name = part
      .replace(TITLE_JUNK, " ")
      .replace(/\s+/g, " ")
      .trim();
    name = name.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0]?.trim() ?? name;
    const canon = canonicalizeName(name);
    if (canon) names.push(canon);
  }
  return names;
}

export function artistNameFromChannel(channelTitle: string): string | null {
  if (!channelTitle?.trim()) return null;
  const name = stripChannelSuffix(channelTitle.trim());
  if (isLikelyNonArtistChannel(name) || isLikelyNonArtistChannel(channelTitle)) {
    return null;
  }
  const names = tokenizeArtistRaw(name);
  return names[0] ?? null;
}

function artistsFromChannel(channelTitle: string): string[] {
  if (!channelTitle?.trim()) return [];
  const name = stripChannelSuffix(channelTitle.trim());
  if (isLikelyNonArtistChannel(name) || isLikelyNonArtistChannel(channelTitle)) {
    return [];
  }
  return tokenizeArtistRaw(name);
}

function knownArtistsInText(text: string): string[] {
  return KNOWN_JP_ARTISTS.filter((name) => text.includes(name));
}

/**
 * タイトルから高確度のアーティスト名だけ取る
 */
function artistsFromTitle(
  title: string,
  opts: { allowLooseSplit: boolean },
): string[] {
  const found: string[] = [];
  const workRaw = title.normalize("NFKC");

  found.push(...knownArtistsInText(workRaw));

  const jpQuoted =
    workRaw.match(/^(.{1,40}?)[「『]([^」』]{1,80})[」』]/) ||
    workRaw.match(/^(.{1,40}?)[\u201c\u2018](.+)[\u201d\u2019]/);
  if (jpQuoted?.[1]) {
    found.push(...tokenizeArtistRaw(jpQuoted[1]));
  }

  const bracketName = workRaw.match(/^[【\[](.{1,30}?)[】\]]/);
  if (bracketName?.[1]) {
    found.push(...tokenizeArtistRaw(bracketName[1]));
  }

  const byMatch = workRaw.match(/\s+by\s+(.{1,40})$/i);
  if (byMatch?.[1]) {
    found.push(...tokenizeArtistRaw(byMatch[1]));
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
      const left = tokenizeArtistRaw(split[1]);
      const right = tokenizeArtistRaw(split[2]);
      const candidates = [...left, ...right].sort(
        (a, b) =>
          scriptPriority(b) - scriptPriority(a) || a.length - b.length,
      );
      if (candidates[0]) found.push(candidates[0]);
    }
  }

  return [...new Set(found)].sort(
    (a, b) => scriptPriority(b) - scriptPriority(a),
  );
}

function channelWeight(channelTitle: string): number {
  if (isTopicChannel(channelTitle)) return 6;
  if (/vevo/i.test(channelTitle)) return 5;
  if (/official|公式/i.test(channelTitle)) return 4;
  return 3;
}

function withScriptWeight(base: number, name: string): number {
  if (hasJapaneseScript(name)) return base + 4;
  // ラテン表記は全アーティスト共通で優先度を下げる
  if (isLatinOnly(name)) return Math.max(1, Math.floor(base * 0.4));
  return base;
}

/**
 * チャンネル優先。例外だけタイトルの出演者名を優先。
 * ローマ字より日本語を全件で優先。
 */
export function scoreArtistHints(
  title: string,
  channelTitle: string,
): { name: string; score: number }[] {
  if (!title || isExcludedNonSongTitle(title)) return [];

  const weight = channelWeight(channelTitle);
  const channelNames = artistsFromChannel(channelTitle);
  const titleHigh = artistsFromTitle(title, { allowLooseSplit: false });
  const titleLoose = artistsFromTitle(title, { allowLooseSplit: true });

  const channelIsNonArtist =
    Boolean(channelTitle?.trim()) &&
    channelNames.length === 0 &&
    (isLikelyNonArtistChannel(stripChannelSuffix(channelTitle)) ||
      isLikelyNonArtistChannel(channelTitle));

  const titleJp = titleHigh.filter((n) => hasJapaneseScript(n));
  const channelJp = channelNames.filter((n) => hasJapaneseScript(n));
  const channelLatin = channelNames.filter((n) => isLatinOnly(n));

  // 例外: グループ／レーベルチャンネルなのに、タイトルが別人（ソロ）を明示
  const soloOverride = titleJp.filter(
    (solo) => !channelNames.some((ch) => isSameArtist(solo, ch)),
  );

  const useTitleOverChannel =
    channelIsNonArtist ||
    (channelNames.length > 0 && soloOverride.length > 0) ||
    (channelLatin.length > 0 && titleJp.length > 0);

  let chosen: string[] = [];

  if (useTitleOverChannel) {
    // タイトルの日本語（ソロ）を優先。無ければ緩い分割
    if (soloOverride.length > 0) chosen = soloOverride;
    else if (titleJp.length > 0) chosen = titleJp;
    else if (titleHigh.length > 0) chosen = titleHigh;
    else chosen = titleLoose;
  } else if (channelNames.length > 0) {
    // 原則: チャンネル名（日本語があればそれを、なければラテン）
    chosen = channelJp.length > 0 ? channelJp : channelNames;
    // タイトルに同じ人の日本語表記があれば差し替え
    if (channelLatin.length > 0 && titleJp.length > 0) {
      chosen = titleJp;
    }
  } else {
    chosen = titleJp.length > 0 ? titleJp : titleHigh;
  }

  // 最終: 同じ人が日本語とラテンでいたら日本語だけ残す
  const preferred = preferJapaneseNames(chosen);

  const best = new Map<string, { name: string; score: number }>();
  for (const name of preferred) {
    if (!isUsableArtistName(name)) continue;
    const score = withScriptWeight(
      weight + (useTitleOverChannel && hasJapaneseScript(name) ? 1 : 0),
      name,
    );
    const key = normalizeKey(name);
    const prev = best.get(key);
    if (!prev || score > prev.score) best.set(key, { name, score });
  }
  return [...best.values()];
}

/** ラテンと日本語が混在したら日本語を優先（全アーティスト共通） */
function preferJapaneseNames(names: string[]): string[] {
  const unique = [...new Set(names)];
  const jp = unique.filter((n) => hasJapaneseScript(n));
  if (jp.length === 0) return unique;
  // 日本語があるならラテンは落とす（別名併記を防ぐ）
  return jp;
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

  // 全体でも: 日本語名があるアーティスト集合に対し、低スコアのラテンを下げた上でソート
  return [...totals.values()]
    .filter(
      (a) =>
        a.score >= 3 &&
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
