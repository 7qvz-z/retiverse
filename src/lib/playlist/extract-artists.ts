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

const CJK_RE = /[\u3040-\u30ff\u4e00-\u9fff]/;

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

function hasJapaneseScript(name: string): boolean {
  return CJK_RE.test(name);
}

/** ほぼローマ字のみ（ラテン文字中心） */
function isRomajiHeavy(name: string): boolean {
  if (hasJapaneseScript(name)) return false;
  const letters = name.replace(/[^a-zA-Z]/g, "");
  return letters.length >= 2;
}

/**
 * 表記優先度: 漢字・ひらがな・カタカナ > その他 > ローマ字
 * （数値が大きいほど優先）
 */
function scriptPriority(name: string): number {
  const hiragana = (name.match(/[\u3040-\u309f]/g) ?? []).length;
  const katakana = (name.match(/[\u30a0-\u30ff]/g) ?? []).length;
  const kanji = (name.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const jp = hiragana + katakana + kanji;
  if (jp > 0) {
    // 日本語表記を強く優先（漢字・かな同列で文字数も少し加点）
    return 100 + Math.min(jp, 20);
  }
  if (isRomajiHeavy(name)) return 10;
  return 40;
}

/** 同一アーティストの別表記なら true（チャンネル表記を残す判定用） */
function isSameArtist(a: string, b: string): boolean {
  const ka = normalizeKey(a);
  const kb = normalizeKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.includes(kb) || kb.includes(ka)) return true;
  return false;
}

/** 同じキーなら日本語表記を最優先、次に文字数 */
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

function pickPreferredName(names: string[]): string | null {
  if (names.length === 0) return null;
  return names.reduce((best, name) => preferDisplayName(best, name));
}

function isUsableArtistName(name: string): boolean {
  if (!name || name.length > 60) return false;
  if (name.length < 2 && !hasJapaneseScript(name)) {
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

  // 日本語表記を先に
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

/** ローマ字はスコアを下げ、日本語表記は上げる */
function withScriptWeight(base: number, name: string): number {
  if (hasJapaneseScript(name)) return base + 3;
  if (isRomajiHeavy(name)) return Math.max(1, Math.floor(base * 0.45));
  return base;
}

/**
 * 原則: チャンネル名をそのまま使う
 * タイトル上のアーティスト名と明らかに違うときだけ、アーティスト名を優先
 * ただしローマ字よりひらがな・カタカナ・漢字を常に優先
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
    const name = pickPreferredName(titleArtists);
    if (!name) return [];
    return [{ name, score: withScriptWeight(weight, name) }];
  }

  const different = titleArtists.filter(
    (artist) => !isSameArtist(artist, channelArtist),
  );

  if (different.length > 0) {
    const titleArtist = pickPreferredName(different);
    if (!titleArtist) {
      return [
        {
          name: channelArtist,
          score: withScriptWeight(weight, channelArtist),
        },
      ];
    }

    // チャンネルが日本語・タイトルがローマ字 → チャンネル（日本語）を残す
    if (hasJapaneseScript(channelArtist) && isRomajiHeavy(titleArtist)) {
      return [
        {
          name: channelArtist,
          score: withScriptWeight(weight, channelArtist),
        },
      ];
    }

    // チャンネルがローマ字・タイトルが日本語 → タイトル（日本語）を優先
    if (isRomajiHeavy(channelArtist) && hasJapaneseScript(titleArtist)) {
      return [
        {
          name: titleArtist,
          score: withScriptWeight(weight + 1, titleArtist),
        },
      ];
    }

    // 別人で表記種別が同じ系統 → アーティスト名（タイトル）を優先
    return [
      {
        name: titleArtist,
        score: withScriptWeight(weight + 1, titleArtist),
      },
    ];
  }

  return [
    {
      name: channelArtist,
      score: withScriptWeight(weight, channelArtist),
    },
  ];
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
        scriptPriority(b.name) - scriptPriority(a.name) ||
        b.score - a.score ||
        cjkScore(b.name) - cjkScore(a.name) ||
        a.name.localeCompare(b.name, "ja"),
    )
    .slice(0, limit);
}
