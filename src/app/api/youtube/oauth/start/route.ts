import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildGoogleYouTubeAuthUrl,
  createOAuthNonce,
  encodeOAuthState,
  resolveRequestOrigin,
  youtubeOAuthCallbackUrl,
  YOUTUBE_OAUTH_STATE_COOKIE,
} from "@/lib/youtube/oauth";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const returnToRaw = searchParams.get("returnTo") ?? "/settings/playlists";
  const returnTo = returnToRaw.startsWith("/")
    ? returnToRaw
    : "/settings/playlists";
  const origin = resolveRequestOrigin(request);
  const nonce = createOAuthNonce();
  const redirectUri = youtubeOAuthCallbackUrl(origin);

  let authUrl: string;
  try {
    authUrl = buildGoogleYouTubeAuthUrl({ origin, nonce });
    console.info("[youtube/oauth/start]", {
      origin,
      redirectUri,
      clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.slice(0, 24),
    });
  } catch (e) {
    const dest = new URL(returnTo, origin);
    dest.searchParams.set(
      "youtube_error",
      e instanceof Error ? e.message : "OAuth 設定エラー",
    );
    return NextResponse.redirect(dest);
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({
    name: YOUTUBE_OAUTH_STATE_COOKIE,
    value: encodeOAuthState({ nonce, returnTo, userId: user.id }),
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
