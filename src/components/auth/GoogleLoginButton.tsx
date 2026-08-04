"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  className?: string;
};

export function GoogleLoginButton({ className }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${siteUrl}/auth/callback`,
          scopes: "openid email profile",
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
      setError(
        e instanceof Error
          ? e.message
          : "ログインに失敗しました。環境変数を確認してください。",
      );
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        className="group inline-flex w-full max-w-sm items-center justify-center gap-3 rounded-full bg-[#f4f0e8] px-8 py-4 text-base font-semibold text-[#1a1612] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f4f0e8] disabled:cursor-not-allowed disabled:opacity-70"
      >
        <GoogleIcon />
        <span>{loading ? "接続中…" : "Googleでログイン"}</span>
      </button>
      {error ? (
        <p className="mt-3 max-w-sm text-sm text-[#ffb4a2]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      className="shrink-0"
    >
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.8-.1-1.2H12z"
      />
    </svg>
  );
}
