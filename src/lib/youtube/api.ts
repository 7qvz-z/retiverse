import type { TrackCandidate } from "@/lib/playlist/terms";
import { recordYouTubeApiUsage } from "@/lib/youtube/quota";
import {
  buildYouTubeSearchCacheKey,
  getYouTubeSearchCache,
  setYouTubeSearchCache,
} from "@/lib/youtube/search-cache";

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

/** キャッシュ保存時は常にこの件数で取得（読み出し時に slice） */
const CACHE_FETCH_SIZE = 25;

export type YouTubeApiContext = {
  userId?: string | null;
};

function mapSearchItems(
  items: SearchItem[] | undefined,
  query: string,
): TrackCandidate[] {
  return (items ?? [])
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

export async function youtubeSearch(
  query: string,
  accessToken: string | null,
  apiKey: string | null,
  maxResults: number,
  ctx: YouTubeApiContext = {},
): Promise<TrackCandidate[]> {
  const capped = Math.min(Math.max(maxResults, 1), CACHE_FETCH_SIZE);
  const queryKey = buildYouTubeSearchCacheKey(query);

  const cached = await getYouTubeSearchCache(queryKey);
  if (cached) {
    void recordYouTubeApiUsage({
      userId: ctx.userId,
      operation: "search.list",
      fromCache: true,
      meta: { queryKey },
    });
    return cached.slice(0, capped).map((track) => ({ ...track, query }));
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    maxResults: String(CACHE_FETCH_SIZE),
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

  const results = mapSearchItems(data.items, query);
  await setYouTubeSearchCache(queryKey, results);
  void recordYouTubeApiUsage({
    userId: ctx.userId,
    operation: "search.list",
    fromCache: false,
    meta: { queryKey },
  });
  return results.slice(0, capped);
}

export async function createYouTubePlaylist(
  accessToken: string,
  title: string,
  description: string,
  ctx: YouTubeApiContext = {},
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

  void recordYouTubeApiUsage({
    userId: ctx.userId,
    operation: "playlists.insert",
  });

  return data.id;
}

export async function addVideoToPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string,
  ctx: YouTubeApiContext = {},
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

  void recordYouTubeApiUsage({
    userId: ctx.userId,
    operation: "playlistItems.insert",
  });
}
