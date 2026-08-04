import type { PlaylistAnalysis } from "@/lib/playlist/analysis-types";

type PlaylistListItem = {
  id?: string;
  snippet?: {
    title?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
  contentDetails?: { itemCount?: number };
};

type PlaylistItemsResponse = {
  items?: {
    contentDetails?: { videoId?: string };
    snippet?: {
      title?: string;
      videoOwnerChannelTitle?: string;
      resourceId?: { videoId?: string };
    };
  }[];
  nextPageToken?: string;
  error?: { message?: string };
};

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listMinePlaylists(accessToken: string) {
  const playlists: {
    id: string;
    title: string;
    itemCount: number;
    thumbnailUrl: string | null;
  }[] = [];

  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      mine: "true",
      maxResults: "50",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?${params}`,
      { headers: authHeaders(accessToken), cache: "no-store" },
    );
    const data = (await res.json()) as {
      items?: PlaylistListItem[];
      nextPageToken?: string;
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(data.error?.message ?? "プレイリスト一覧の取得に失敗しました");
    }

    for (const item of data.items ?? []) {
      if (!item.id) continue;
      playlists.push({
        id: item.id,
        title: item.snippet?.title ?? "無題",
        itemCount: item.contentDetails?.itemCount ?? 0,
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          null,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken && playlists.length < 100);

  return playlists;
}

export async function listPlaylistVideoSnippets(
  accessToken: string,
  playlistId: string,
  maxItems = 50,
) {
  const videos: {
    videoId: string;
    title: string;
    channelTitle: string;
  }[] = [];

  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      { headers: authHeaders(accessToken), cache: "no-store" },
    );
    const data = (await res.json()) as PlaylistItemsResponse;

    if (!res.ok) {
      throw new Error(
        data.error?.message ?? "プレイリスト曲一覧の取得に失敗しました",
      );
    }

    for (const item of data.items ?? []) {
      const videoId =
        item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      videos.push({
        videoId,
        title: item.snippet?.title ?? "",
        channelTitle: item.snippet?.videoOwnerChannelTitle ?? "",
      });
      if (videos.length >= maxItems) break;
    }

    pageToken = data.nextPageToken;
  } while (pageToken && videos.length < maxItems);

  return videos;
}

/** タイトル・チャンネルからアーティスト候補を抽出 */
export function extractArtistHints(
  title: string,
  channelTitle: string,
): string[] {
  const hints: string[] = [];

  if (/ - Topic$/i.test(channelTitle)) {
    const name = channelTitle.replace(/\s*-\s*Topic$/i, "").trim();
    if (name) hints.push(name);
  }

  const cleaned = title
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/「[^」]*」/g, " ")
    .replace(/Official\s*(Music\s*)?Video/gi, " ")
    .replace(/\bMV\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const split = cleaned.match(/^(.{1,40}?)\s*[-–—\/|]\s*(.+)$/);
  if (split?.[1]) {
    const artist = split[1].trim();
    if (artist.length >= 1 && artist.length <= 40) hints.push(artist);
  }

  return hints;
}

export function buildPlaylistAnalysis(
  playlistMeta: { id: string; title: string }[],
  videos: { videoId: string; title: string; channelTitle: string }[],
): PlaylistAnalysis {
  const artistCounts = new Map<string, number>();
  const channelCounts = new Map<string, number>();
  const sampleTitles: string[] = [];
  const videoIds: string[] = [];

  for (const video of videos) {
    videoIds.push(video.videoId);
    if (sampleTitles.length < 20 && video.title) {
      sampleTitles.push(video.title);
    }

    if (video.channelTitle) {
      channelCounts.set(
        video.channelTitle,
        (channelCounts.get(video.channelTitle) ?? 0) + 1,
      );
    }

    for (const hint of extractArtistHints(video.title, video.channelTitle)) {
      const key = hint.trim();
      if (!key) continue;
      artistCounts.set(key, (artistCounts.get(key) ?? 0) + 1);
    }
  }

  const artists = [...artistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([name]) => name);

  const channels = [...channelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([name]) => name);

  return {
    playlistIds: playlistMeta.map((p) => p.id),
    playlistTitles: playlistMeta.map((p) => p.title),
    artists,
    channels,
    sampleTitles,
    videoIds: [...new Set(videoIds)].slice(0, 300),
    analyzedAt: new Date().toISOString(),
  };
}
