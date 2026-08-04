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
];

const TITLE_JUNK =
  /Official\s*(Music\s*)?(Video|Audio)|Music\s*Video|\bMV\b|\bHD\b|\bHQ\b|歌詞付き?|フルサイズ|フルVer\.?|Official\s*Lyric\s*Video|Lyric\s*Video|Audio\s*Only|Visualizer|Performance\s*Video|Dance\s*Practice/gi;

const CJK_RE = /[\u3040-\u30ff\u4e00-\u9fff]/;

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

/** 曲名っぽい文字列をアーティスト候補から除外 */
function looksLikeSongTitle(name: string): boolean {
  if (name.length > 24) return true;
  if (
    /バージョン|ver\.?\b|remix|アコースティック|劇場版|映画|主題歌|エンディング|オープニング|フルサイズ|歌詞/i.test(
      name,
    )
  ) {
    return true;
  }
  // 助詞が多く文・曲名っぽい
  if ((name.match(/[をがにとへでもは]/g) ?? []).length >= 2) return true;
  if (/[をが]/.test(name) && name.length >= 8) return true;
  // 空白区切りが多い英語曲名
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
  return name;
}

export function artistNameFromChannel(channelTitle: string): string | null {
  if (!channelTitle?.trim()) return null;
  const name = stripChannelSuffix(channelTitle.trim());
  if (!isUsableArtistName(name)) return null;
  if (isLikelyNonArtistChannel(name)) return null;
  return name;
}

/**
 * タイトルからは高確度パターンだけ取る（曲名誤認を防ぐ）
 * - アーティスト「曲名」
 * - ... by Artist
 * - レーベル系チャンネルのときだけ A / B 分割（短い方・日本語優先）
 */
function artistsFromTitle(
  title: string,
  opts: { allowLooseSplit: boolean },
): string[] {
  const found: string[] = [];
  const workRaw = title.normalize("NFKC");

  const jpQuoted =
    workRaw.match(/^(.{1,30}?)[「『]([^」』]{1,80})[」』]/) ||
    workRaw.match(/^(.{1,30}?)[\u201c\u2018](.+)[\u201d\u2019]/);
  if (jpQuoted?.[1]) {
    const cleaned = cleanArtistToken(jpQuoted[1]);
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
      // 短い方・日本語を優先（長い方は曲名になりやすい）
      candidates.sort(
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
  if (isRomajiHeavy(name)) return Math.max(1, Math.floor(base * 0.35));
  return base;
}

/**
 * 原則: チャンネル名をそのまま使う（漢字チャンネルは絶対にローマ字で上書きしない）
 * タイトルは「別人・レーベル動画」のときだけ補完
 */
export function scoreArtistHints(
  title: string,
  channelTitle: string,
): { name: string; score: number }[] {
  if (!title || isExcludedNonSongTitle(title)) return [];

  const channelArtist = artistNameFromChannel(channelTitle);
  const weight = channelWeight(channelTitle);
  const nonArtistChannel =
    !channelArtist &&
    Boolean(channelTitle?.trim()) &&
    (isLikelyNonArtistChannel(stripChannelSuffix(channelTitle)) ||
      isLikelyNonArtistChannel(channelTitle));

  // 漢字・かなチャンネル → 常にそのまま（タイトルで上書きしない）
  if (channelArtist && hasJapaneseScript(channelArtist)) {
    return [
      {
        name: channelArtist,
        score: withScriptWeight(weight, channelArtist),
      },
    ];
  }

  // ローマ字チャンネル → タイトルに日本語アーティスト（「」付き）があればそれへ昇格
  if (channelArtist) {
    const titleJp = artistsFromTitle(title, { allowLooseSplit: false }).filter(
      (a) => hasJapaneseScript(a) && !isSameArtist(a, channelArtist),
    );
    if (titleJp[0]) {
      return [
        {
          name: titleJp[0],
          score: withScriptWeight(weight + 1, titleJp[0]),
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

  // レーベル等 → タイトルから高確度で拾う
  if (nonArtistChannel) {
    const fromTitle = artistsFromTitle(title, { allowLooseSplit: true });
    if (fromTitle[0]) {
      return [
        {
          name: fromTitle[0],
          score: withScriptWeight(weight + 1, fromTitle[0]),
        },
      ];
    }
  }

  // チャンネル不明 → 「」パターンのみ
  const fallback = artistsFromTitle(title, { allowLooseSplit: false });
  if (fallback[0]) {
    return [
      {
        name: fallback[0],
        score: withScriptWeight(Math.max(weight, 3), fallback[0]),
      },
    ];
  }

  return [];
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
    .filter((a) => a.score >= 3 && !looksLikeSongTitle(a.name))
    .sort(
      (a, b) =>
        scriptPriority(b.name) - scriptPriority(a.name) ||
        b.score - a.score ||
        cjkScore(b.name) - cjkScore(a.name) ||
        a.name.localeCompare(b.name, "ja"),
    )
    .slice(0, limit);
}
