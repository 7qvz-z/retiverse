import { NextResponse } from "next/server";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  getYouTubeAccessToken,
  YOUTUBE_TOKEN_MISSING_MESSAGE,
} from "@/lib/youtube/auth";
import {
  getPlaylistsByIds,
  MAX_SAVED_PLAYLISTS,
  normalizeSavedPlaylists,
  parseYouTubePlaylistId,
} from "@/lib/youtube/playlists";

const MISSING_COL_HINT =
  "saved_youtube_playlists カラムがありません。supabase/migrations/20260806000000_saved_youtube_playlists.sql を SQL Editor で実行してください。";

function isMissingSavedColumn(error: {
  message?: string;
  code?: string;
}): boolean {
  return (
    (error.message ?? "").includes("saved_youtube_playlists") ||
    error.code === "PGRST204"
  );
}

type AuthOk = {
  supabase: SupabaseClient;
  session: Session;
  accessToken: string;
};

async function requireYouTubeSession(): Promise<
  AuthOk | { error: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }),
    };
  }

  let accessToken: string | null;
  try {
    accessToken = await getYouTubeAccessToken(supabase, session);
  } catch (e) {
    return {
      error: NextResponse.json(
        {
          error:
            e instanceof Error ? e.message : YOUTUBE_TOKEN_MISSING_MESSAGE,
        },
        { status: 500 },
      ),
    };
  }

  if (!accessToken) {
    return {
      error: NextResponse.json(
        { error: YOUTUBE_TOKEN_MISSING_MESSAGE },
        { status: 400 },
      ),
    };
  }

  return { supabase, session, accessToken };
}

export async function POST(request: Request) {
  const auth = await requireYouTubeSession();
  if ("error" in auth) return auth.error;
  const { supabase, session, accessToken } = auth;

  const body = (await request.json()) as { urlOrId?: string };
  const playlistId = parseYouTubePlaylistId(body.urlOrId ?? "");
  if (!playlistId) {
    return NextResponse.json(
      {
        error:
          "プレイリストの URL または ID を入力してください（例: https://www.youtube.com/playlist?list=PLxxx）",
      },
      { status: 400 },
    );
  }

  try {
    const found = await getPlaylistsByIds(accessToken, [playlistId], "saved");
    if (found.length === 0) {
      return NextResponse.json(
        {
          error:
            "プレイリストが見つかりません。公開されているか、URL を確認してください。",
        },
        { status: 404 },
      );
    }

    const playlist = found[0];

    const { data: profile, error: readError } = await supabase
      .from("profiles")
      .select("saved_youtube_playlists")
      .eq("id", session.user.id)
      .maybeSingle();

    if (readError) {
      if (isMissingSavedColumn(readError)) {
        return NextResponse.json({ error: MISSING_COL_HINT }, { status: 500 });
      }
      throw new Error(readError.message);
    }

    const existing = normalizeSavedPlaylists(profile?.saved_youtube_playlists);
    if (existing.some((p) => p.id === playlist.id)) {
      return NextResponse.json({
        playlist: { ...playlist, source: "saved" as const },
        playlists: existing,
        alreadyExists: true,
      });
    }

    if (existing.length >= MAX_SAVED_PLAYLISTS) {
      return NextResponse.json(
        {
          error: `登録できるプレイリストは最大 ${MAX_SAVED_PLAYLISTS} 件です`,
        },
        { status: 400 },
      );
    }

    const next = [
      ...existing,
      {
        id: playlist.id,
        title: playlist.title,
        itemCount: playlist.itemCount,
        thumbnailUrl: playlist.thumbnailUrl,
      },
    ];

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        saved_youtube_playlists: next,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session.user.id);

    if (updateError) {
      if (isMissingSavedColumn(updateError)) {
        return NextResponse.json({ error: MISSING_COL_HINT }, { status: 500 });
      }
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      playlist: { ...playlist, source: "saved" as const },
      playlists: normalizeSavedPlaylists(next),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "プレイリストの登録に失敗しました",
      },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireYouTubeSession();
  if ("error" in auth) return auth.error;
  const { supabase, session } = auth;

  const body = (await request.json()) as { playlistId?: string };
  const playlistId = body.playlistId?.trim();
  if (!playlistId) {
    return NextResponse.json(
      { error: "playlistId が必要です" },
      { status: 400 },
    );
  }

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("saved_youtube_playlists")
    .eq("id", session.user.id)
    .maybeSingle();

  if (readError) {
    if (isMissingSavedColumn(readError)) {
      return NextResponse.json({ error: MISSING_COL_HINT }, { status: 500 });
    }
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const existing = normalizeSavedPlaylists(profile?.saved_youtube_playlists);
  const next = existing
    .filter((p) => p.id !== playlistId)
    .map(({ id, title, itemCount, thumbnailUrl }) => ({
      id,
      title,
      itemCount,
      thumbnailUrl,
    }));

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      saved_youtube_playlists: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.user.id);

  if (updateError) {
    if (isMissingSavedColumn(updateError)) {
      return NextResponse.json({ error: MISSING_COL_HINT }, { status: 500 });
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    playlists: normalizeSavedPlaylists(next),
  });
}
