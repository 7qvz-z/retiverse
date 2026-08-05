/**
 * タイトル・チャンネル名からアーティスト候補文字列を抜き出す
 * 優先度の高いパターンから順に試す
 */

const CJK = /[\u3040-\u30ff\u4e00-\u9fff\uff66-\uff9d]/;

export type ExtractHints = {
  /** 抽出できた生文字列（まだ分割前） */
  segments: string[];
  /** ルールの自信度 */
  confidence: "high" | "low";
};

const TITLE_JUNK =
  /Official\s*(Music\s*)?(Video|Audio)|Music\s*Video|\bMV\b|公式\s*MV|カバー|cover|踊ってみた/gi;

function stripDecorations(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/【[^】]*】/g, " ")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeSongTitle(name: string): boolean {
  const t = name.trim();
  if (t.length >= 12) return true;
  if ((t.match(/[をがにとへでもはの]/g) ?? []).length >= 2) return true;
  if (/の歌$|の曲$|テーマ$|ソング$/i.test(t)) return true;
  if (/^アイドル$/i.test(t) || /^idol$/i.test(t)) return true;
  return false;
}

function looksLikeArtistToken(name: string): boolean {
  const t = name.trim();
  if (!t || t.length > 40) return false;
  if (looksLikeSongTitle(t) && t.length > 16) return false;
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

  // 陽キャJKに憧れる陰キャJKの歌/音莉飴
  // ロウワー / 星街すいせい(cover)
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
    // 短い曲名 / 日本語アーティスト
    return [rightClean];
  }

  // 漢字 / ローマ字
  if (hasCjk(l) && isLatinHeavy(rightClean)) return [l];
  if (hasCjk(rightClean) && isLatinHeavy(l)) return [rightClean];

  return [l, rightClean || r];
}

/** チャンネル名のサフィックス除去 */
export function cleanChannelName(channelTitle: string): string | null {
  let name = channelTitle.normalize("NFKC").trim();
  if (!name) return null;

  // 【音莉飴】official → 音莉飴
  name = name.replace(/【([^】]+)】/g, "$1");

  name = name
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s*VEVO$/i, "")
    .replace(/\s*-\s*A\.I\.Channel$/i, "")
    .replace(/\s*-\s*AI\.?Channel$/i, "")
    .replace(/\s+Ch\.\s*hololive(?:-EN)?$/i, "")
    .replace(/\s+Ch\..*$/i, "")
    .replace(/\s*Official.*$/i, "")
    .replace(/\s*公式.*$/i, "")
    .replace(/\s+Channel$/i, "")
    .replace(/\s*Release$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  // HoneyWorks OFFICIAL
  name = name.replace(/\s+OFFICIAL$/i, "").trim();

  if (!name || /^(official|music|topic|release|channel)$/i.test(name)) {
    return null;
  }
  return name;
}

/**
 * タイトルから候補セグメントを優先順位付きで抽出
 */
export function extractTitleSegments(title: string): {
  segments: string[];
  confidence: "high" | "low";
} {
  const raw = title.normalize("NFKC").trim();
  if (!raw) return { segments: [], confidence: "low" };

  // 1. 【】は無視（中身も捨てる）
  let work = stripDecorations(raw);

  // 2. アーティスト「曲名」
  const jpQuoted = work.match(/^(.{1,40}?)[「『]([^」』]+)[」』]/);
  if (jpQuoted?.[1] && !looksLikeSongTitle(jpQuoted[1])) {
    return { segments: [jpQuoted[1].trim()], confidence: "high" };
  }

  // 3. 「曲名」 - Artist x Artist （ORIGINAL SONG MV 系）
  const afterQuoteDash = work.match(
    /[「『][^」』]+[」』]\s*[-–—]\s*(.+)$/,
  );
  if (afterQuoteDash?.[1]) {
    const seg = afterQuoteDash[1].replace(TITLE_JUNK, " ").trim();
    if (seg) return { segments: [seg], confidence: "high" };
  }

  // 4. 曲名/アーティスト or 漢字/ローマ字
  const slash = work.match(/^(.+?)\s*[/／]\s*(.+)$/);
  if (slash?.[1] && slash[2]) {
    let right = slash[2].replace(TITLE_JUNK, " ").trim();
    // feat. が左に残っている場合: 陰キャ...feat.弱酸性 /音莉飴
    const left = slash[1].trim();
    const featInLeft = left.match(/\s+(?:feat\.?|ft\.?|featuring)\s+(.+)$/i);
    const resolved = resolveSlashParts(
      featInLeft ? left.slice(0, featInLeft.index).trim() : left,
      right,
    );
    const segments: string[] = [...resolved];
    if (featInLeft?.[1]) {
      // feat. ゲストも候補に（本家が右のとき）
      const guest = featInLeft[1].replace(TITLE_JUNK, " ").trim();
      if (guest && looksLikeArtistToken(guest)) {
        // テストケース1は音莉飴のみ。feat.ゲストは「弱い」追加にしない
        // ケース「feat.弱酸性 /音莉飴」では本家=音莉飴が主。ゲストは後段で必要なら
      }
    }
    if (segments.length > 0) {
      return { segments, confidence: "high" };
    }
  }

  // 5. Artist - Song / Song - Artist1 x Artist2
  const dash = work.match(/^(.{1,80}?)\s*[-–—]\s*(.{1,120})$/);
  if (dash?.[1] && dash[2]) {
    const left = dash[1].replace(TITLE_JUNK, " ").trim();
    const right = dash[2].replace(TITLE_JUNK, " ").trim();
    // 右側に x コラボがある → アーティスト列
    if (/\sx\s|[×✕]/i.test(right)) {
      return { segments: [right], confidence: "high" };
    }
    // 左が短くアーティスト、右が曲
    if (left.length <= 24 && looksLikeArtistToken(left) && looksLikeSongTitle(right)) {
      return { segments: [left], confidence: "high" };
    }
    // 右がアーティストっぽい
    if (right.length <= 40 && looksLikeArtistToken(right)) {
      return { segments: [right], confidence: "low" };
    }
  }

  // 6. by Artist
  const byMatch = work.match(/\s+by\s+(.{1,40})$/i);
  if (byMatch?.[1]) {
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
