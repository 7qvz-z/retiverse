import type { TrackCandidate } from "@/lib/playlist/terms";

/** タイトルに含まれていたら除外（メドレー・予告・非楽曲など） */
const EXCLUDED_TITLE_PATTERNS: RegExp[] = [
  /メドレー/i,
  /medley/i,
  /ティザー/i,
  /teaser/i,
  /トレーラー/i,
  /trailer/i,
  /予告/i,
  /スポット\s*CM/i,
  /\bCM\b/i,
  /コマーシャル/i,
  /behind\s*the\s*scenes/i,
  /メイキング/i,
  /making\s*(of|video)?/i,
  /インタビュー/i,
  /interview/i,
  /リアクション/i,
  /reaction/i,
  /歌ってみた/i,
  /踊ってみた/i,
  /弾いてみた/i,
  /カバーしてみた/i,
  /karaoke/i,
  /カラオケ/i,
  /オフボーカル/i,
  /instrumental\s*only/i,
  /live\s*(at|from|in|concert|tour|ver|version|映像)/i,
  /ライブ\s*(映像|動画|フル|ver|版)/i,
  /コンサート/i,
  /digest/i,
  /ダイジェスト/i,
  /まとめ/i,
  /best\s*of/i,
  /ヒットメドレー/i,
  /ノンストップ/i,
  /non[\s-]?stop/i,
  /mix\s*tape/i,
  /remix\s*medley/i,
  /1時間/i,
  /\d+\s*時間/i,
  /hour\s*mix/i,
  /playlist\s*mix/i,
  /スピードアップ/i,
  /nightcore/i,
  /歌詞\s*付き\s*まとめ/i,
];

export type MusicSourceKind = "mv" | "topic";

export function isTopicChannel(channelTitle: string): boolean {
  return /(?:^|\s)-\s*Topic$/i.test(channelTitle.trim());
}

function isVevoChannel(channelTitle: string): boolean {
  return /vevo/i.test(channelTitle);
}

function isOfficialMusicChannel(channelTitle: string): boolean {
  return (
    /official/i.test(channelTitle) ||
    /公式/.test(channelTitle) ||
    /ミュージックビデオ/.test(channelTitle)
  );
}

/** MV（ミュージックビデオ）っぽいタイトル */
export function looksLikeOfficialMvTitle(title: string): boolean {
  return (
    /\bMV\b/i.test(title) ||
    /ミュージック\s*ビデオ/i.test(title) ||
    /music\s*video/i.test(title) ||
    /official\s*(music\s*)?video/i.test(title) ||
    /公式\s*(ミュージック\s*)?(ビデオ|mv)/i.test(title)
  );
}

/** MV として優先するソース（VEVO / 公式MV） */
export function isMvSource(track: TrackCandidate): boolean {
  const { channelTitle, title } = track;
  if (isTopicChannel(channelTitle)) return false;
  if (isVevoChannel(channelTitle)) return true;
  if (looksLikeOfficialMvTitle(title)) {
    return isOfficialMusicChannel(channelTitle) || isVevoChannel(channelTitle);
  }
  return false;
}

export function getMusicSourceKind(
  track: TrackCandidate,
): MusicSourceKind | null {
  if (isExcludedNonSongTitle(track.title)) return null;
  if (isMvSource(track)) return "mv";
  if (isTopicChannel(track.channelTitle)) return "topic";
  return null;
}

export function isAllowedMusicSource(track: TrackCandidate): boolean {
  return getMusicSourceKind(track) !== null;
}

export function isExcludedNonSongTitle(title: string): boolean {
  return EXCLUDED_TITLE_PATTERNS.some((pattern) => pattern.test(title));
}

export function filterToSongsOnly(tracks: TrackCandidate[]): TrackCandidate[] {
  return tracks.filter((track) => getMusicSourceKind(track) !== null);
}

/**
 * MV を優先し、足りない分を Topic チャンネルで埋める
 */
export function preferMvThenTopic(
  tracks: TrackCandidate[],
  targetCount: number,
  shuffleFn: <T>(items: T[], enabled: boolean) => T[],
  randomnessEnabled: boolean,
): TrackCandidate[] {
  return pickBySourceOrder(
    tracks,
    targetCount,
    shuffleFn,
    randomnessEnabled,
    ["mv", "topic"],
  );
}

/**
 * Topic を優先し、足りない分を MV で埋める
 */
export function preferTopicThenMv(
  tracks: TrackCandidate[],
  targetCount: number,
  shuffleFn: <T>(items: T[], enabled: boolean) => T[],
  randomnessEnabled: boolean,
): TrackCandidate[] {
  return pickBySourceOrder(
    tracks,
    targetCount,
    shuffleFn,
    randomnessEnabled,
    ["topic", "mv"],
  );
}

function pickBySourceOrder(
  tracks: TrackCandidate[],
  targetCount: number,
  shuffleFn: <T>(items: T[], enabled: boolean) => T[],
  randomnessEnabled: boolean,
  order: MusicSourceKind[],
): TrackCandidate[] {
  const buckets = order.map((kind) =>
    shuffleFn(
      tracks.filter((t) => getMusicSourceKind(t) === kind),
      randomnessEnabled,
    ),
  );

  const merged: TrackCandidate[] = [];
  const seen = new Set<string>();

  for (const track of buckets.flat()) {
    if (seen.has(track.videoId)) continue;
    seen.add(track.videoId);
    merged.push(track);
    if (merged.length >= targetCount) break;
  }

  return merged;
}
