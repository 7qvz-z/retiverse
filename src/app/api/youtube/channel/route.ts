import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { INSUFFICIENT_YOUTUBE_SCOPES_MESSAGE } from "@/lib/setup-options";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getYouTubeAccessToken,
  YOUTUBE_TOKEN_MISSING_MESSAGE,
} from "@/lib/youtube/auth";
import { recordYouTubeApiUsage } from "@/lib/youtube/quota";

type YoutubeChannelsResponse = {
  items?: { id: string }[];
  error?: {
    message?: string;
    status?: string;
    errors?: { reason?: string }[];
  };
};

function isInsufficientScopesError(
  status: number,
  data: YoutubeChannelsResponse,
): boolean {
  const message = data.error?.message ?? "";
  const reason = data.error?.errors?.[0]?.reason ?? "";
  return (
    status === 401 ||
    status === 403 ||
    message.toLowerCase().includes("insufficient") ||
    message.toLowerCase().includes("scope") ||
    reason === "insufficientPermissions" ||
    reason === "ACCESS_TOKEN_SCOPE_INSUFFICIENT"
  );
}

async function clearStoredYouTubeTokens(userId: string) {
  try {
    const admin = createServiceClient();
    await admin
      .from("profiles")
      .update({
        google_refresh_token: null,
        google_access_token: null,
        google_token_expires_at: null,
        youtube_channel_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  } catch (e) {
    console.warn("[youtube/channel] clear tokens failed:", e);
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let token: string | null;
  try {
    token = await getYouTubeAccessToken(supabase, session);
  } catch (e) {
    return NextResponse.json(
      {
        connected: false,
        channelId: null,
        needsReconnect: true,
        error:
          e instanceof Error ? e.message : YOUTUBE_TOKEN_MISSING_MESSAGE,
      },
      { status: 500 },
    );
  }

  if (!token) {
    return NextResponse.json(
      {
        connected: false,
        channelId: null,
        needsReconnect: true,
        error: YOUTUBE_TOKEN_MISSING_MESSAGE,
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
    if (isInsufficientScopesError(res.status, data)) {
      await clearStoredYouTubeTokens(session.user.id);
      return NextResponse.json(
        {
          connected: false,
          channelId: null,
          needsReconnect: true,
          error: INSUFFICIENT_YOUTUBE_SCOPES_MESSAGE,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        connected: false,
        channelId: null,
        error:
          data.error?.message ??
          "YouTube API の呼び出しに失敗しました。Google Cloud で YouTube Data API v3 を有効にしてください。",
      },
      { status: 502 },
    );
  }

  const channelId = data.items?.[0]?.id ?? null;

  void recordYouTubeApiUsage({
    userId: session.user.id,
    operation: "channels.list",
  });

  if (channelId) {
    await supabase.from("profiles").upsert({
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
