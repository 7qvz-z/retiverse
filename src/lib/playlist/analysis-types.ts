export type UnclassifiedArtist = {
  name: string;
  reasons: string[];
};

export type SimilarArtistPair = {
  a: string;
  b: string;
  similarity: number;
};

/** 候補の採用根拠（UI表示用） */
export type ArtistAdoptedBy =
  | "alias"
  | "channel"
  | "high"
  | "multi"
  | "confirm"
  | "group"
  | "unit"
  | "unknown";

export type ArtistEvidence = {
  name: string;
  sampleTitle: string | null;
  sampleChannel: string | null;
  occurrenceCount: number;
  adoptedBy: ArtistAdoptedBy;
};

export type PlaylistAnalysis = {
  playlistIds: string[];
  playlistTitles: string[];
  /** 確定タグ */
  artists: string[];
  /** 未分類 / 要確認（自動では好みに追加しない想定） */
  unclassifiedArtists?: UnclassifiedArtist[];
  /** 「もしかして同じ？」候補 */
  similarPairs?: SimilarArtistPair[];
  /** 候補ごとの由来（曲名・チャンネル・採用理由） */
  artistEvidence?: ArtistEvidence[];
  channels: string[];
  sampleTitles: string[];
  videoIds: string[];
  analyzedAt: string;
};

export type YoutubePlaylistSummary = {
  id: string;
  title: string;
  itemCount: number;
  thumbnailUrl: string | null;
  /** mine: 自分が作成 / saved: URL 登録した他人の PL */
  source?: "mine" | "saved";
};
