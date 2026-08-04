import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMinePlaylists } from "@/lib/youtube/playlists";

export async function GET() {
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
          "YouTube 連携トークンがありません。設定または初回設定から YouTube 連携をやり直してください。",
      },
      { status: 400 },
    );
  }

  try {
    const playlists = await listMinePlaylists(accessToken);
    return NextResponse.json({ playlists });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "プレイリスト一覧の取得に失敗しました",
      },
      { status: 502 },
    );
  }
}
