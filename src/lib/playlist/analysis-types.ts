export type UnclassifiedArtist = {
  name: string;
  reasons: string[];
};

export type SimilarArtistPair = {
  a: string;
  b: string;
  similarity: number;
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
};
