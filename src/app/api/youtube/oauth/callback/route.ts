import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  decodeOAuthState,
  exchangeYouTubeAuthCode,
  hasYouTubeApiScope,
  resolveRequestOrigin,
  YOUTUBE_OAUTH_STATE_COOKIE,
} from "@/lib/youtube/oauth";

function redirectWithError(origin: string, returnTo: string, message: string) {
  const dest = new URL(returnTo, origin);
  dest.searchParams.set("youtube_error", message);
  return NextResponse.redirect(dest);
}

export async function GET(request: Request) {
  const origin = resolveRequestOrigin(request);
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateNonce = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const rawState = cookieStore.get(YOUTUBE_OAUTH_STATE_COOKIE)?.value;
  const state = rawState ? decodeOAuthState(rawState) : null;
  const returnTo = state?.returnTo ?? "/settings/playlists";

  const clearAndRedirect = (response: NextResponse) => {
    response.cookies.set({
      name: YOUTUBE_OAUTH_STATE_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
    return response;
  };

  if (oauthError) {
    return clearAndRedirect(
      redirectWithError(
        origin,
        returnTo,
        oauthError === "access_denied"
          ? "YouTube へのアクセスが拒否されました。許可画面で承認してください。"
          : `Google OAuth エラー: ${oauthError}`,
      ),
    );
  }

  if (!user) {
    return clearAndRedirect(
      NextResponse.redirect(new URL("/login?error=auth", origin)),
    );
  }

  if (!code || !stateNonce || !state) {
    return clearAndRedirect(
      redirectWithError(
        origin,
        returnTo,
        "YouTube 連携の状態が無効です。もう一度やり直してください。",
      ),
    );
  }

  if (state.nonce !== stateNonce || state.userId !== user.id) {
    return clearAndRedirect(
      redirectWithError(
        origin,
        returnTo,
        "YouTube 連携の検証に失敗しました。もう一度やり直してください。",
      ),
    );
  }

  try {
    const tokens = await exchangeYouTubeAuthCode({ code, origin });

    if (!hasYouTubeApiScope(tokens.scope)) {
      return clearAndRedirect(
        redirectWithError(
          origin,
          returnTo,
          "YouTube スコープが付与されませんでした。Google Cloud の OAuth 同意画面（Data Access）に「YouTube Data API」の youtube.force-ssl を追加し、再連携してください。",
        ),
      );
    }

    const admin = createServiceClient();
    const { data: existing } = await admin
      .from("profiles")
      .select("google_refresh_token")
      .eq("id", user.id)
      .maybeSingle();

    const refreshToken =
      tokens.refreshToken ??
      (existing as { google_refresh_token?: string | null } | null)
        ?.google_refresh_token ??
      null;

    if (!refreshToken) {
      return clearAndRedirect(
        redirectWithError(
          origin,
          returnTo,
          "refresh token が取得できませんでした。https://myaccount.google.com/permissions で本アプリのアクセスを削除してから、もう一度「YouTube連携する」を押してください。",
        ),
      );
    }

    const patch: Record<string, string | null> = {
      google_refresh_token: refreshToken,
      google_access_token: tokens.accessToken,
      google_token_expires_at: tokens.expiresAt,
      updated_at: new Date().toISOString(),
    };

    const chRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        next: { revalidate: 0 },
      },
    );
    const chData = (await chRes.json()) as {
      items?: { id: string }[];
      error?: { message?: string };
    };

    if (!chRes.ok) {
      return clearAndRedirect(
        redirectWithError(
          origin,
          returnTo,
          chData.error?.message ??
            "YouTube チャンネルの取得に失敗しました。Google Cloud で YouTube Data API v3 を有効にしてください。",
        ),
      );
    }

    const channelId = chData.items?.[0]?.id ?? null;
    if (channelId) patch.youtube_channel_id = channelId;

    const { error: updateError } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", user.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const dest = new URL(returnTo, origin);
    dest.searchParams.delete("youtube_error");
    dest.searchParams.set("youtube_connected", "1");
    return clearAndRedirect(NextResponse.redirect(dest));
  } catch (e) {
    return clearAndRedirect(
      redirectWithError(
        origin,
        returnTo,
        e instanceof Error ? e.message : "YouTube 連携に失敗しました",
      ),
    );
  }
}
