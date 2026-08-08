import { createHash, randomBytes } from "crypto";

/** YouTube Data API 用（ログイン用 openid とは分離） */
export const YOUTUBE_API_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
].join(" ");

export const YOUTUBE_OAUTH_STATE_COOKIE = "retiverse_yt_oauth";

export type YouTubeOAuthState = {
  nonce: string;
  returnTo: string;
  userId: string;
};

export function googleOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET が未設定です。.env.local に、Supabase の Google プロバイダと同じ OAuth クライアントを設定してください。",
    );
  }
  return { clientId, clientSecret };
}

export function resolveRequestOrigin(request: Request): string {
  // Cookie と redirect_uri のホストを一致させるため、実際のリクエスト origin を使う。
  // Google Cloud には localhost / 127.0.0.1 の両方を登録すること。
  try {
    return new URL(request.url).origin;
  } catch {
    return (
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      "http://127.0.0.1:3000"
    );
  }
}

export function youtubeOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/youtube/oauth/callback`;
}

export function createOAuthNonce(): string {
  return randomBytes(24).toString("hex");
}

export function encodeOAuthState(state: YouTubeOAuthState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeOAuthState(raw: string): YouTubeOAuthState | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    ) as Partial<YouTubeOAuthState>;
    if (
      typeof parsed.nonce !== "string" ||
      typeof parsed.returnTo !== "string" ||
      typeof parsed.userId !== "string"
    ) {
      return null;
    }
    return {
      nonce: parsed.nonce,
      returnTo: parsed.returnTo.startsWith("/") ? parsed.returnTo : "/",
      userId: parsed.userId,
    };
  } catch {
    return null;
  }
}

export function buildGoogleYouTubeAuthUrl(input: {
  origin: string;
  nonce: string;
}): string {
  const { clientId } = googleOAuthCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: youtubeOAuthCallbackUrl(input.origin),
    response_type: "code",
    scope: YOUTUBE_API_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: input.nonce,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type GoogleTokenExchange = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeYouTubeAuthCode(input: {
  code: string;
  origin: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scope: string;
}> {
  const { clientId, clientSecret } = googleOAuthCredentials();
  const body = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: youtubeOAuthCallbackUrl(input.origin),
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as GoogleTokenExchange;
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ??
        data.error ??
        "Google トークン交換に失敗しました",
    );
  }

  const expiresIn = data.expires_in ?? 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: data.scope ?? "",
  };
}

export function hasYouTubeApiScope(scope: string | string[] | null | undefined): boolean {
  const parts = Array.isArray(scope)
    ? scope
    : (scope ?? "").split(/[\s,]+/).filter(Boolean);
  return parts.some(
    (s) =>
      s === "https://www.googleapis.com/auth/youtube.force-ssl" ||
      s === "https://www.googleapis.com/auth/youtube" ||
      s === "https://www.googleapis.com/auth/youtube.readonly",
  );
}

type TokenInfo = {
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function fetchAccessTokenScope(
  accessToken: string,
): Promise<string | null> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
    { next: { revalidate: 0 } },
  );
  const data = (await res.json()) as TokenInfo;
  if (!res.ok) return null;
  return data.scope ?? null;
}

export async function accessTokenHasYouTubeScope(
  accessToken: string,
): Promise<boolean> {
  const scope = await fetchAccessTokenScope(accessToken);
  return hasYouTubeApiScope(scope);
}

/** デバッグ用の短い指紋（トークン本体は出さない） */
export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 8);
}
