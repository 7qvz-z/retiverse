import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mapYouTubeApiErrorMessage } from "@/lib/setup-options";
import {
  getYouTubeAccessToken,
  YOUTUBE_TOKEN_MISSING_MESSAGE,
} from "@/lib/youtube/auth";
import {
  listMinePlaylists,
  mergeMineAndSavedPlaylists,
  normalizeSavedPlaylists,
} from "@/lib/youtube/playlists";

export async function GET() {
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

  try {
    const mine = await listMinePlaylists(accessToken);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("saved_youtube_playlists")
      .eq("id", session.user.id)
      .maybeSingle();

    let saved = normalizeSavedPlaylists(null);
    if (profileError) {
      if (
        profileError.message.includes("saved_youtube_playlists") ||
        profileError.code === "PGRST204"
      ) {
        // カラム未作成時は自分の PL のみ返す
        return NextResponse.json({
          playlists: mergeMineAndSavedPlaylists(mine, []),
        });
      }
      throw new Error(profileError.message);
    } else {
      saved = normalizeSavedPlaylists(profile?.saved_youtube_playlists);
    }

    return NextResponse.json({
      playlists: mergeMineAndSavedPlaylists(mine, saved),
    });
  } catch (error) {
    const raw =
      error instanceof Error
        ? error.message
        : "プレイリスト一覧の取得に失敗しました";
    return NextResponse.json(
      { error: mapYouTubeApiErrorMessage(raw) },
      { status: 502 },
    );
  }
}
