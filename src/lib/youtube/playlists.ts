import { aggregateValidatedArtists } from "@/lib/artist-extract";
import {
  EMPTY_OVERRIDES,
  type ArtistOverrides,
} from "@/lib/artist-extract/overrides";
import type {
  PlaylistAnalysis,
  YoutubePlaylistSummary,
} from "@/lib/playlist/analysis-types";
import { isExcludedNonSongTitle } from "@/lib/playlist/filters";

const MAX_SAVED_PLAYLISTS = 50;

type PlaylistListItem = {
  id?: string;
  snippet?: {
    title?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
  contentDetails?: { itemCount?: number };
};

function toSummary(
  item: PlaylistListItem,
  source?: YoutubePlaylistSummary["source"],
): YoutubePlaylistSummary | null {
  if (!item.id) return null;
  return {
    id: item.id,
    title: item.snippet?.title ?? "無題",
    itemCount: item.contentDetails?.itemCount ?? 0,
    thumbnailUrl:
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    ...(source ? { source } : {}),
  };
}

/**
 * URL または生 ID からプレイリスト ID を取り出す。
 * 例: https://www.youtube.com/playlist?list=PLxxx / watch?v=..&list=PLxxx / PLxxx
 */
export function parseYouTubePlaylistId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    const list =
      url.searchParams.get("list") ??
      url.searchParams.get("playlist_id") ??
      url.searchParams.get("playlistId");
    if (list && /^[\w-]+$/.test(list)) return list;
  } catch {
    // not a URL — fall through
  }

  const bare = raw.replace(/^["']|["']$/g, "");
  if (/^[\w-]{10,}$/.test(bare)) return bare;
  return null;
}

export function isSavedPlaylistRow(
  value: unknown,
): value is YoutubePlaylistSummary {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.itemCount === "number"
  );
}

export function normalizeSavedPlaylists(
  value: unknown,
): YoutubePlaylistSummary[] {
  if (!Array.isArray(value)) return [];
  const out: YoutubePlaylistSummary[] = [];
  for (const item of value) {
    if (!isSavedPlaylistRow(item)) continue;
    out.push({
      id: item.id,
      title: item.title,
      itemCount: item.itemCount,
      thumbnailUrl:
        typeof item.thumbnailUrl === "string" ? item.thumbnailUrl : null,
      source: "saved",
    });
    if (out.length >= MAX_SAVED_PLAYLISTS) break;
  }
  return out;
}

export { MAX_SAVED_PLAYLISTS };

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

export async function listMinePlaylists(
  accessToken: string,
): Promise<YoutubePlaylistSummary[]> {
  const playlists: YoutubePlaylistSummary[] = [];

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
      const summary = toSummary(item, "mine");
      if (summary) playlists.push(summary);
    }

    pageToken = data.nextPageToken;
  } while (pageToken && playlists.length < 100);

  return playlists;
}

/** id 指定でメタ取得（公開 PL / 自分の PL）。最大 50 件ずつ。 */
export async function getPlaylistsByIds(
  accessToken: string,
  ids: string[],
  source?: YoutubePlaylistSummary["source"],
): Promise<YoutubePlaylistSummary[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  const playlists: YoutubePlaylistSummary[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      id: chunk.join(","),
      maxResults: "50",
    });

    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?${params}`,
      { headers: authHeaders(accessToken), cache: "no-store" },
    );
    const data = (await res.json()) as {
      items?: PlaylistListItem[];
      error?: { message?: string };
    };

    if (!res.ok) {
      throw new Error(
        data.error?.message ?? "プレイリスト情報の取得に失敗しました",
      );
    }

    for (const item of data.items ?? []) {
      const summary = toSummary(item, source);
      if (summary) playlists.push(summary);
    }
  }

  return playlists;
}

export function mergeMineAndSavedPlaylists(
  mine: YoutubePlaylistSummary[],
  saved: YoutubePlaylistSummary[],
): YoutubePlaylistSummary[] {
  const mineIds = new Set(mine.map((p) => p.id));
  const extras = saved.filter((p) => !mineIds.has(p.id));
  return [
    ...mine.map((p) => ({ ...p, source: "mine" as const })),
    ...extras.map((p) => ({ ...p, source: "saved" as const })),
  ];
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
  return aggregateValidatedArtists([{ title, channelTitle }]).confirmed;
}

export function buildPlaylistAnalysis(
  playlistMeta: { id: string; title: string }[],
  videos: { videoId: string; title: string; channelTitle: string }[],
  overrides: ArtistOverrides = EMPTY_OVERRIDES,
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

  const validated = aggregateValidatedArtists(
    videos.map((v) => ({ title: v.title, channelTitle: v.channelTitle })),
    undefined,
    overrides,
  );

  const channels = [...channelCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([name]) => name);

  return {
    playlistIds: playlistMeta.map((p) => p.id),
    playlistTitles: playlistMeta.map((p) => p.title),
    artists: validated.confirmed,
    unclassifiedArtists: validated.unclassified,
    similarPairs: validated.similarPairs,
    artistEvidence: validated.evidence,
    channels,
    sampleTitles,
    videoIds: [...new Set(videoIds)].slice(0, 300),
    analyzedAt: new Date().toISOString(),
  };
}
