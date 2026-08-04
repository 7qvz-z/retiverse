import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildPlaylistAnalysis,
  listMinePlaylists,
  listPlaylistVideoSnippets,
} from "@/lib/youtube/playlists";

type Body = {
  playlistIds?: string[];
  mergeArtistsToFavorites?: boolean;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const accessToken = session.provider_token;
  if (!accessToken) {
    return NextResponse.json(
      {
        error:
          "YouTube 連携トークンがありません。YouTube 連携をやり直してください。",
      },
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
    const allPlaylists = await listMinePlaylists(accessToken);
    const selected = allPlaylists.filter((p) => playlistIds.includes(p.id));
    if (selected.length === 0) {
      return NextResponse.json(
        { error: "選択したプレイリストが見つかりません" },
        { status: 404 },
      );
    }

    const videos = [];
    for (const playlist of selected) {
      const items = await listPlaylistVideoSnippets(
        accessToken,
        playlist.id,
        50,
      );
      videos.push(...items);
    }

    const analysis = buildPlaylistAnalysis(
      selected.map((p) => ({ id: p.id, title: p.title })),
      videos,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("favorite_artists")
      .eq("id", session.user.id)
      .maybeSingle();

    const currentArtists =
      (profile as { favorite_artists?: string[] } | null)?.favorite_artists ??
      [];

    let favoriteArtists = currentArtists;
    if (body.mergeArtistsToFavorites) {
      favoriteArtists = [
        ...new Set([...currentArtists, ...analysis.artists.slice(0, 20)]),
      ];
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        analyzed_playlist_ids: analysis.playlistIds,
        playlist_analysis: analysis,
        ...(body.mergeArtistsToFavorites
          ? { favorite_artists: favoriteArtists }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    if (updateError) {
      // マイグレーション未実行の可能性
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
      favoriteArtists,
      videoCount: analysis.videoIds.length,
      artistCount: analysis.artists.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "プレイリスト解析に失敗しました",
      },
      { status: 502 },
    );
  }
}
