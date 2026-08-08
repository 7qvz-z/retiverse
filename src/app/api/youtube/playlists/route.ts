import { NextResponse } from "next/server";
import {
  addVideoToPlaylist,
  createYouTubePlaylist,
} from "@/lib/youtube/api";
import { createClient } from "@/lib/supabase/server";
import type { TrackCandidate } from "@/lib/playlist/terms";
import { mapYouTubeApiErrorMessage } from "@/lib/setup-options";
import {
  getYouTubeAccessToken,
  YOUTUBE_TOKEN_MISSING_MESSAGE,
} from "@/lib/youtube/auth";
import { APP_NAME } from "@/lib/constants";

type Body = {
  title?: string;
  generationId?: string | null;
  tracks?: TrackCandidate[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let accessToken: string | null;
  try {
    accessToken = await getYouTubeAccessToken(supabase, session);
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : YOUTUBE_TOKEN_MISSING_MESSAGE,
      },
      { status: 500 },
    );
  }
  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "YouTube への書き込み権限がありません。設定から YouTube 連携をやり直してください。",
      },
      { status: 400 },
    );
  }

  const body = (await request.json()) as Body;
  const tracks = body.tracks ?? [];
  const title =
    body.title?.trim() ||
    `${APP_NAME} ${new Date().toLocaleString("ja-JP")}`;

  if (tracks.length === 0) {
    return NextResponse.json({ error: "曲がありません" }, { status: 400 });
  }

  if (tracks.length > 300) {
    return NextResponse.json(
      { error: "曲数は最大300曲までです" },
      { status: 400 },
    );
  }

  try {
    const playlistId = await createYouTubePlaylist(
      accessToken,
      title,
      `${APP_NAME} で自動生成されたプレイリスト`,
      { userId: session.user.id },
    );

    const failed: string[] = [];
    for (const track of tracks) {
      try {
        await addVideoToPlaylist(
          accessToken,
          playlistId,
          track.videoId,
          { userId: session.user.id },
        );
      } catch {
        failed.push(track.videoId);
      }
    }

    const trackIds = tracks.map((t) => t.videoId);

    if (body.generationId) {
      await supabase
        .from("playlist_generations")
        .update({
          youtube_playlist_id: playlistId,
          track_ids: trackIds,
          title,
        })
        .eq("id", body.generationId)
        .eq("user_id", session.user.id);
    } else {
      await supabase.from("playlist_generations").insert({
        user_id: session.user.id,
        title,
        youtube_playlist_id: playlistId,
        track_ids: trackIds,
        is_favorite: false,
      });
    }

    return NextResponse.json({
      playlistId,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      addedCount: tracks.length - failed.length,
      failedCount: failed.length,
    });
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : "YouTubeへの追加に失敗しました";
    return NextResponse.json(
      { error: mapYouTubeApiErrorMessage(raw) },
      { status: 502 },
    );
  }
}
