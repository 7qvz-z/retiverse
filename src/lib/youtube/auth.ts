import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import {
  accessTokenHasYouTubeScope,
  googleOAuthCredentials,
  hasYouTubeApiScope,
} from "@/lib/youtube/oauth";

type TokenRow = {
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_token_expires_at: string | null;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

const EXPIRY_SKEW_MS = 60_000;

const MISSING_COLS_HINT =
  "YouTube トークン用カラムがありません。supabase/migrations/20260805010000_youtube_credentials.sql を SQL Editor で実行してください。";

function isAccessTokenFresh(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() > Date.now() + EXPIRY_SKEW_MS;
}

function isMissingColumnError(error: {
  message?: string;
  code?: string;
}): boolean {
  const message = error.message ?? "";
  return (
    message.includes("google_refresh_token") ||
    message.includes("google_access_token") ||
    message.includes("google_token_expires_at") ||
    message.includes("schema cache") ||
    error.code === "PGRST204"
  );
}

async function clearYouTubeTokens(userId: string): Promise<void> {
  try {
    const admin = createServiceClient();
    await admin
      .from("profiles")
      .update({
        google_refresh_token: null,
        google_access_token: null,
        google_token_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  } catch (e) {
    console.warn("[youtube/auth] clear tokens failed:", e);
  }
}

/**
 * OAuth 直後の provider トークンを profiles に永続化。
 * YouTube API スコープが無いトークンは保存しない（スコープ不足の原因になるため）。
 */
export async function persistYouTubeCredentials(
  userId: string,
  session: Session,
): Promise<void> {
  const accessToken = session.provider_token ?? null;
  const refreshToken = session.provider_refresh_token ?? null;
  if (!accessToken && !refreshToken) return;

  if (accessToken) {
    const ok = await accessTokenHasYouTubeScope(accessToken);
    if (!ok) {
      console.warn(
        "[youtube/auth] skip persist: provider_token に YouTube スコープがありません（専用 YouTube 連携を使ってください）",
      );
      return;
    }
  }

  const admin = createServiceClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("google_refresh_token")
    .eq("id", userId)
    .maybeSingle();

  const nextRefresh =
    refreshToken ??
    (existing as TokenRow | null)?.google_refresh_token ??
    null;
  if (!nextRefresh && !accessToken) return;

  const patch: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };
  if (nextRefresh) patch.google_refresh_token = nextRefresh;
  if (accessToken) {
    patch.google_access_token = accessToken;
    patch.google_token_expires_at = new Date(
      Date.now() + 55 * 60 * 1000,
    ).toISOString();
  }

  const { error } = await admin.from("profiles").update(patch).eq("id", userId);

  if (error) {
    if (isMissingColumnError(error)) {
      console.warn("[youtube/auth]", MISSING_COLS_HINT);
      return;
    }
    throw new Error(error.message);
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: string;
  refreshToken?: string;
  scope: string;
} | null> {
  const creds = googleOAuthCredentials();

  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.access_token) {
    return null;
  }

  const expiresIn = data.expires_in ?? 3600;
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    refreshToken: data.refresh_token,
    scope: data.scope ?? "",
  };
}

async function tokenUsableForYouTube(accessToken: string): Promise<boolean> {
  try {
    return await accessTokenHasYouTubeScope(accessToken);
  } catch {
    return false;
  }
}

/**
 * YouTube Data API 用のアクセストークンを返す。
 * 専用 YouTube OAuth で profiles に保存したトークンを優先する。
 * セッションの provider_token は YouTube スコープがある場合のみ使う。
 */
export async function getYouTubeAccessToken(
  _supabase: SupabaseClient,
  session: Session | null,
): Promise<string | null> {
  if (!session?.user) return null;

  const userId = session.user.id;

  let row: TokenRow | null = null;
  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("profiles")
      .select(
        "google_refresh_token, google_access_token, google_token_expires_at",
      )
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) {
        console.warn("[youtube/auth]", MISSING_COLS_HINT);
      } else {
        throw new Error(error.message);
      }
    } else {
      row = data as TokenRow | null;
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("GOOGLE_CLIENT")) {
      throw e;
    }
    console.warn("[youtube/auth] load failed:", e);
  }

  if (row?.google_refresh_token) {
    if (
      row.google_access_token &&
      isAccessTokenFresh(row.google_token_expires_at)
    ) {
      if (await tokenUsableForYouTube(row.google_access_token)) {
        return row.google_access_token;
      }
      // スコープ不足の古い access token は捨てて refresh を試す
    }

    const refreshed = await refreshAccessToken(row.google_refresh_token);
    if (refreshed) {
      const scoped = refreshed.scope
        ? hasYouTubeApiScope(refreshed.scope)
        : await tokenUsableForYouTube(refreshed.accessToken);

      if (scoped) {
        const admin = createServiceClient();
        const { error: updateError } = await admin
          .from("profiles")
          .update({
            google_refresh_token:
              refreshed.refreshToken ?? row.google_refresh_token,
            google_access_token: refreshed.accessToken,
            google_token_expires_at: refreshed.expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError && !isMissingColumnError(updateError)) {
          console.warn(
            "[youtube/auth] update after refresh:",
            updateError.message,
          );
        }
        return refreshed.accessToken;
      }

      // 古い refresh token に YouTube スコープが無い
      await clearYouTubeTokens(userId);
    } else {
      await clearYouTubeTokens(userId);
    }
  }

  // フォールバック: セッショントークンに YouTube スコープがある場合のみ
  if (session.provider_token) {
    if (await tokenUsableForYouTube(session.provider_token)) {
      try {
        await persistYouTubeCredentials(userId, session);
      } catch (e) {
        console.warn("[youtube/auth] persist failed:", e);
      }
      return session.provider_token;
    }
  }

  return null;
}

export const YOUTUBE_TOKEN_MISSING_MESSAGE =
  "YouTube 連携トークンがありません。「YouTube連携する」を押して許可してください。";
