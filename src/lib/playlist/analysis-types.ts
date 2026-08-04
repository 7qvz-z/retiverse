export type PlaylistAnalysis = {
  playlistIds: string[];
  playlistTitles: string[];
  artists: string[];
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
