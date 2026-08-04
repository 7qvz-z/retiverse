import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type YoutubeChannelsResponse = {
  items?: { id: string }[];
  error?: { message?: string };
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const token = session.provider_token;
  if (!token) {
    return NextResponse.json(
      {
        connected: false,
        channelId: null,
        error:
          "YouTube のアクセストークンがありません。「YouTubeと連携する」から許可し直してください。",
      },
      { status: 400 },
    );
  }

  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
    {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    },
  );

  const data = (await res.json()) as YoutubeChannelsResponse;

  if (!res.ok) {
    return NextResponse.json(
      {
        connected: true,
        channelId: null,
        error:
          data.error?.message ??
          "YouTube API の呼び出しに失敗しました。Google Cloud で YouTube Data API v3 を有効にしてください。",
      },
      { status: 502 },
    );
  }

  const channelId = data.items?.[0]?.id ?? null;

  if (channelId) {
    await supabase
      .from("profiles")
      .upsert({
        id: session.user.id,
        youtube_channel_id: channelId,
        updated_at: new Date().toISOString(),
      });
  }

  return NextResponse.json({
    connected: true,
    channelId,
  });
}
