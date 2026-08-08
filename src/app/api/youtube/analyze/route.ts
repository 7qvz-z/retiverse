import { NextResponse } from "next/server";
import {
  buildOverrides,
  correctionFromDbRow,
  EMPTY_OVERRIDES,
} from "@/lib/artist-extract/overrides";
import { createClient } from "@/lib/supabase/server";
import { mapYouTubeApiErrorMessage } from "@/lib/setup-options";
import { isMissingRelationError } from "@/lib/supabase/migration-hints";
import {
  getYouTubeAccessToken,
  YOUTUBE_TOKEN_MISSING_MESSAGE,
} from "@/lib/youtube/auth";
import {
  buildPlaylistAnalysis,
  getPlaylistsByIds,
  listPlaylistVideoSnippets,
} from "@/lib/youtube/playlists";

type Body = {
  playlistIds?: string[];
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
      { error: YOUTUBE_TOKEN_MISSING_MESSAGE },
      { status: 400 },
    );
  }

  const body = (await request.json()) as Body;
  const playlistIds = [...new Set(body.playlistIds ?? [])].slice(0, 5);
  if (playlistIds.length === 0) {
    return NextResponse.json(
      { error: "解析するプレイリストを選んでください" },
      { status: 400 },
    );
  }

  try {
    const selected = await getPlaylistsByIds(accessToken, playlistIds);
    if (selected.length === 0) {
      return NextResponse.json(
        {
          error:
            "選択したプレイリストが見つかりません。公開設定や URL を確認してください。",
        },
        { status: 404 },
      );
    }

    // リクエスト順を保つ（見つかったものだけ）
    const byId = new Map(selected.map((p) => [p.id, p]));
    const ordered = playlistIds
      .map((id) => byId.get(id))
      .filter((p): p is NonNullable<typeof p> => Boolean(p));

    const videos = [];
    for (const playlist of ordered) {
      const items = await listPlaylistVideoSnippets(
        accessToken,
        playlist.id,
        100,
      );
      videos.push(...items);
    }

    const { data: correctionRows, error: correctionsError } = await supabase
      .from("artist_corrections")
      .select("kind, raw_name, canonical_name, split_into")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true })
      .limit(500);

    if (correctionsError) {
      if (isMissingRelationError(correctionsError, "artist_corrections")) {
        return NextResponse.json(
          {
            error:
              "artist_corrections テーブルがありません。supabase/migrations/20260805000000_artist_corrections.sql を SQL Editor で実行してください。",
          },
          { status: 500 },
        );
      }
      throw new Error(correctionsError.message);
    }

    const overrides =
      correctionRows && correctionRows.length > 0
        ? buildOverrides(
            correctionRows.map((row) =>
              correctionFromDbRow(
                row as {
                  kind: string;
                  raw_name: string;
                  canonical_name?: string | null;
                  split_into?: string[] | null;
                },
              ),
            ),
          )
        : EMPTY_OVERRIDES;

    const analysis = buildPlaylistAnalysis(
      ordered.map((p) => ({ id: p.id, title: p.title })),
      videos,
      overrides,
    );

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        analyzed_playlist_ids: analysis.playlistIds,
        playlist_analysis: analysis,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    if (updateError) {
      if (
        updateError.message.includes("analyzed_playlist_ids") ||
        updateError.message.includes("playlist_analysis") ||
        updateError.code === "PGRST204"
      ) {
        return NextResponse.json(
          {
            error:
              "DBに解析用カラムがありません。supabase/migrations/20260804000001_playlist_analysis.sql を SQL Editor で実行してください。",
            analysis,
          },
          { status: 500 },
        );
      }
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      analysis,
      videoCount: analysis.videoIds.length,
      artistCount: analysis.artists.length,
    });
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : "プレイリスト解析に失敗しました";
    return NextResponse.json(
      { error: mapYouTubeApiErrorMessage(raw) },
      { status: 502 },
    );
  }
}
