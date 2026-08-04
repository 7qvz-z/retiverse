import type { TrackCandidate } from "@/lib/playlist/terms";

type SearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
};

type SearchResponse = {
  items?: SearchItem[];
  error?: { message?: string; errors?: { reason?: string }[] };
};

export async function youtubeSearch(
  query: string,
  accessToken: string | null,
  apiKey: string | null,
  maxResults: number,
): Promise<TrackCandidate[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    maxResults: String(Math.min(Math.max(maxResults, 1), 25)),
    q: query,
    relevanceLanguage: "ja",
  });

  const headers: HeadersInit = {};
  let url = `https://www.googleapis.com/youtube/v3/search?${params}`;

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (apiKey) {
    url += `&key=${encodeURIComponent(apiKey)}`;
  } else {
    throw new Error("YouTube API の認証情報がありません");
  }

  const res = await fetch(url, { headers, cache: "no-store" });
  const data = (await res.json()) as SearchResponse;

  if (!res.ok) {
    throw new Error(
      data.error?.message ?? `YouTube検索に失敗しました (${res.status})`,
    );
  }

  return (data.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;
      return {
        videoId,
        title: item.snippet?.title ?? "無題",
        channelTitle: item.snippet?.channelTitle ?? "",
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url ??
          "",
        query,
      } satisfies TrackCandidate;
    })
    .filter((v): v is TrackCandidate => v !== null);
}

export async function createYouTubePlaylist(
  accessToken: string,
  title: string,
  description: string,
): Promise<string> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: { title, description },
        status: { privacyStatus: "private" },
      }),
      cache: "no-store",
    },
  );

  const data = (await res.json()) as {
    id?: string;
    error?: { message?: string };
  };

  if (!res.ok || !data.id) {
    throw new Error(data.error?.message ?? "プレイリスト作成に失敗しました");
  }

  return data.id;
}

export async function addVideoToPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string,
): Promise<void> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: { kind: "youtube#video", videoId },
        },
      }),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const data = (await res.json()) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `曲の追加に失敗: ${videoId}`);
  }
}
