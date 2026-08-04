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
  // 曲名の誤検知（YOASOBI「アイドル」など）
  /^アイドル$/,
  /^idol$/i,
];

/** 曲名でありアーティスト名ではない語 */
const SONG_TITLE_NAMES = [/^アイドル$/, /^idol$/i];

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

const CJK_RE = /[\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9d]/;

/**
 * ローマ字 → 日本語（既知のみ）
 */
const ROMAJI_TO_JAPANESE: Record<string, string> = {
  // 初星学園 / 学マス
  hatsuhoshigakuen: "初星学園",
  hatsuboshigakuen: "初星学園",
  hatsuhoshi: "初星学園",
  hatsuboshi: "初星学園",
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
  // その他
  itoguruma: "イトグルマ",
  itoguruuma: "イトグルマ",
  leen: "リーン",
  sumireuesaka: "上坂すみれ",
  uesakasumire: "上坂すみれ",
  asumisena: "空澄セナ",
  senaasumi: "空澄セナ",
  asumisenaasumi: "空澄セナ",
};

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
  "イトグルマ",
  "リーン",
  "上坂すみれ",
  "空澄セナ",
] as const;

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
    .replace(/[（(]cv[:：]?[^）)]*[）)]/gi, "")
    .replace(/[×✕✖ｘx]/g, "x")
    .trim();
}

function cjkScore(name: string): number {
  return (name.match(/[\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9d]/g) ?? []).length;
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
  if (SONG_TITLE_NAMES.some((re) => re.test(name.trim()))) return true;
  // CV 付き表記は人名として許可
  if (/\(?\s*CV\s*[:：]/i.test(name)) return false;
  if (name.length > 40) return true;
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
  // 短い片方の包含は別人を潰すので使わない（空澄セナ など）
  const [longer, shorter] = ka.length >= kb.length ? [ka, kb] : [kb, ka];
  if (shorter.length < 4) return false;
  // 「名前Official」のような拡張だけ同一扱い
  if (longer.startsWith(shorter) && /official|公式|channel|topic$/.test(longer)) {
    return true;
  }
  return false;
}

/**
 * 「漢字 / ローマ字」形式 → 漢字側だけ残す
 */
export function preferKanjiFromSlash(raw: string): string[] {
  const parts = raw
    .split(/\s*[/／]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return [raw.trim()].filter(Boolean);

  const jp = parts.filter((p) => hasJapaneseScript(p));
  const latin = parts.filter((p) => isLatinOnly(p));

  // 日本語とローマ字が混在 → 日本語だけ
  if (jp.length > 0 && latin.length > 0) return jp;

  return parts;
}

/**
 * × は原則コラボ分割。左右同じならグループ名のまま（GILTY×GILTY）
 */
export function expandCollabNames(raw: string): string[] {
  const name = raw.trim();
  if (!name || !COLLAB_SPLIT.test(name)) return [name];

  const parts = name
    .split(COLLAB_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) return [name];

  const allSame = parts.every(
    (p) => normalizeKey(p) === normalizeKey(parts[0]),
  );
  if (allSame) return [name];

  return parts;
}

/**
 * 「雷成きゅぴ アステル・レダ」のように空白区切りの別人は個別候補に
 * （・でつながる1人名は分割しない）
 */
export function expandSpaceSeparatedArtists(raw: string): string[] {
  const name = raw.trim();
  if (!name) return [];

  const parts = name.split(/[\s\u3000]+/).filter(Boolean);
  if (parts.length < 2) return [name];

  // すべて日本語っぽい短いトークンなら個別アーティスト
  const allJpNames = parts.every(
    (p) =>
      hasJapaneseScript(p) &&
      p.length >= 2 &&
      p.length <= 24 &&
      !looksLikeSongTitle(p),
  );
  if (allJpNames) return parts;

  return [name];
}

/**
 * leen(CV:Sumire Uesaka) → リーン（CV:上坂すみれ）
 */
export function formatCvArtistName(raw: string): string | null {
  const m = raw
    .trim()
    .match(/^(.+?)\s*[（(]\s*CV\s*[:：]\s*(.+?)\s*[）)]\s*$/i);
  if (!m?.[1] || !m[2]) return null;

  const character = mapRomajiOrKeep(m[1].trim());
  const cv = mapRomajiOrKeep(m[2].trim());
  if (!character || !cv) return null;
  return `${character}（CV:${cv}）`;
}

function mapRomajiOrKeep(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (hasJapaneseScript(trimmed)) return trimmed;

  const mapped = ROMAJI_TO_JAPANESE[normalizeKey(trimmed)];
  if (mapped) return mapped;

  // スペース区切りの欧文氏名もキー化して試す
  const compact = ROMAJI_TO_JAPANESE[normalizeKey(trimmed.replace(/\s+/g, ""))];
  if (compact) return compact;

  return isLatinOnly(trimmed) ? trimmed : trimmed;
}

function canonicalizeName(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const cvForm = formatCvArtistName(trimmed);
  if (cvForm) {
    return isUsableArtistName(cvForm) ? cvForm : null;
  }

  if (hasJapaneseScript(trimmed)) {
    const nfkc = trimmed.normalize("NFKC");
    return isUsableArtistName(nfkc) ? nfkc : null;
  }

  const mapped = mapRomajiOrKeep(trimmed);
  if (!mapped) return null;
  if (hasJapaneseScript(mapped)) {
    return isUsableArtistName(mapped) ? mapped : null;
  }
  if (!isUsableArtistName(mapped)) return null;
  return mapped;
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
  let text = raw.normalize("NFKC").trim();
  text = text.replace(TITLE_JUNK, " ").replace(/\s+/g, " ").trim();
  text = text.split(/\s+(?:feat\.?|ft\.?|featuring)\s+/i)[0]?.trim() ?? text;
  if (!text) return [];

  // 1) 漢字/ローマ字 → 漢字だけ
  for (const slashPart of preferKanjiFromSlash(text)) {
    // 2) × コラボ
    for (const collabPart of expandCollabNames(slashPart)) {
      // 3) 空白区切りの別人
      for (const spacePart of expandSpaceSeparatedArtists(collabPart)) {
        const canon = canonicalizeName(spacePart);
        if (canon) names.push(canon);
      }
    }
  }

  return [...new Set(names)];
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

function artistsFromTitle(
  title: string,
  opts: { allowLooseSplit: boolean },
): string[] {
  const found: string[] = [];
  const workRaw = title.normalize("NFKC");

  // 【】は無視
  const work = workRaw.replace(/【[^】]*】/g, " ").replace(/\s+/g, " ").trim();

  found.push(...knownArtistsInText(work));

  const jpQuoted =
    work.match(/^(.{1,40}?)[「『]([^」』]{1,80})[」』]/) ||
    work.match(/^(.{1,40}?)[\u201c\u2018](.+)[\u201d\u2019]/);
  if (jpQuoted?.[1]) {
    found.push(...tokenizeArtistRaw(jpQuoted[1]));
  }

  const byMatch = work.match(/\s+by\s+(.{1,40})$/i);
  if (byMatch?.[1]) {
    found.push(...tokenizeArtistRaw(byMatch[1]));
  }

  if (opts.allowLooseSplit) {
    const loose = work
      .replace(/\[[^\]]*]/g, " ")
      .replace(/\([^)]*\)/g, " ")
      .replace(/「[^」]*」/g, " ")
      .replace(/『[^』]*』/g, " ")
      .replace(TITLE_JUNK, " ")
      .replace(/\s+/g, " ")
      .trim();

    // A / B が漢字/ローマ字なら漢字だけ
    const slashParts = preferKanjiFromSlash(loose);
    if (slashParts.length >= 1 && /[/／]/.test(loose)) {
      for (const part of slashParts) {
        found.push(...tokenizeArtistRaw(part));
      }
    }

    const split = loose.match(/^(.{1,40}?)\s*[-–—|｜]\s*(.{1,80})$/);
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
  if (isLatinOnly(name)) return Math.max(1, Math.floor(base * 0.4));
  return base;
}

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

  const soloOverride = titleJp.filter(
    (solo) => !channelNames.some((ch) => isSameArtist(solo, ch)),
  );

  const useTitleOverChannel =
    channelIsNonArtist ||
    (channelNames.length > 0 && soloOverride.length > 0) ||
    (channelLatin.length > 0 && titleJp.length > 0);

  let chosen: string[] = [];

  if (useTitleOverChannel) {
    if (soloOverride.length > 0) chosen = soloOverride;
    else if (titleJp.length > 0) chosen = titleJp;
    else if (titleHigh.length > 0) chosen = titleHigh;
    else chosen = titleLoose;
  } else if (channelNames.length > 0) {
    // チャンネルから複数（空白区切り別人）なら全部候補に
    chosen = channelJp.length > 0 ? channelJp : channelNames;
    if (channelLatin.length > 0 && titleJp.length > 0) {
      chosen = [...new Set([...channelJp, ...titleJp])];
      if (chosen.length === 0) chosen = titleJp;
    }
  } else {
    chosen = titleJp.length > 0 ? titleJp : titleHigh;
  }

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

function preferJapaneseNames(names: string[]): string[] {
  const unique = [...new Set(names)];
  const jp = unique.filter((n) => hasJapaneseScript(n));
  if (jp.length === 0) return unique;
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

  const collator = new Intl.Collator("ja", { sensitivity: "base" });

  return [...totals.values()]
    .filter(
      (a) =>
        a.score >= 3 &&
        !looksLikeSongTitle(a.name) &&
        !ARTIST_NOISE.some((re) => re.test(a.name)) &&
        !SONG_TITLE_NAMES.some((re) => re.test(a.name)),
    )
    // 表示は五十音順
    .sort((a, b) => collator.compare(a.name, b.name))
    .slice(0, limit);
}
