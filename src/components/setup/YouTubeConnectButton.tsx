"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { YOUTUBE_SCOPES } from "@/lib/setup-options";

type Props = {
  connected?: boolean;
  channelId?: string | null;
  /** 連携後に戻るパス */
  returnTo?: string;
  className?: string;
};

export function YouTubeConnectButton({
  connected = false,
  channelId = null,
  returnTo = "/settings/playlists",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConnect() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const nextPath = returnTo.startsWith("/") ? returnTo : "/settings/playlists";

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          scopes: YOUTUBE_SCOPES,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "YouTube連携に失敗しました");
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            connected
              ? "bg-[#2a6f6a]/15 text-[#1f4f4b]"
              : "bg-[#1a1612]/8 text-[#1a1612]/60"
          }`}
        >
          {connected ? "チャンネル情報あり" : "要再連携"}
        </span>
        {channelId ? (
          <span className="text-xs text-[#1a1612]/45">ID: {channelId}</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className="mt-4 inline-flex items-center justify-center rounded-full border border-[#1a1612]/20 bg-white px-5 py-2.5 text-sm font-medium text-[#1a1612] transition hover:border-[#1a1612]/40 disabled:opacity-60"
      >
        {loading ? "接続中…" : "YouTube連携をやり直す"}
      </button>

      {error ? (
        <p className="mt-2 text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-[#1a1612]/50">
        Googleの許可画面で YouTube へのアクセスを許可してください。終わるとこの画面に戻ります。
      </p>
    </div>
  );
}
