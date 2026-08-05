import { extractArtistsFromVideo } from "@/lib/artist-extract";
import type { PlaylistAnalysis } from "@/lib/playlist/analysis-types";
import { isExcludedNonSongTitle } from "@/lib/playlist/filters";

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
  maxItems = 100,
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
      const title = item.snippet?.title ?? "";
      // 非楽曲は解析対象から除外（メドレー・予告など）
      if (isExcludedNonSongTitle(title)) continue;

      videos.push({
        videoId,
        title,
        channelTitle: item.snippet?.videoOwnerChannelTitle ?? "",
      });
      if (videos.length >= maxItems) break;
    }

    pageToken = data.nextPageToken;
  } while (pageToken && videos.length < maxItems);

  return videos;
}

/** @deprecated artist-extract の extractArtistsFromVideo を使用 */
export function extractArtistHints(
  title: string,
  channelTitle: string,
): string[] {
  return extractArtistsFromVideo({ title, channelTitle }).artists;
}

export function buildPlaylistAnalysis(
  playlistMeta: { id: string; title: string }[],
  videos: { videoId: string; title: string; channelTitle: string }[],
): PlaylistAnalysis {
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
  }

  const artistScores = new Map<string, number>();
  for (const video of videos) {
    const { artists } = extractArtistsFromVideo({
      title: video.title,
      channelTitle: video.channelTitle,
    });
    for (const name of artists) {
      artistScores.set(name, (artistScores.get(name) ?? 0) + 1);
    }
  }

  const artists = [...artistScores.entries()]
    .filter(([, score]) => score >= 1)
    .sort(
      (a, b) =>
        b[1] - a[1] || a[0].localeCompare(b[0], "ja"),
    )
    .slice(0, 40)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b, "ja"));

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
