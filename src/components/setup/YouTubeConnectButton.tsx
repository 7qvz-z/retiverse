"use client";

import { useEffect, useState } from "react";

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
  const [justConnected, setJustConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const youtubeError = params.get("youtube_error");
    const youtubeConnected = params.get("youtube_connected");
    if (youtubeError) {
      setError(youtubeError);
    }
    if (youtubeConnected === "1") {
      setJustConnected(true);
      // サーバー側に保存した channelId / トークンを反映
      window.setTimeout(() => {
        window.location.reload();
      }, 50);
    }
    if (youtubeError || youtubeConnected) {
      params.delete("youtube_error");
      params.delete("youtube_connected");
      const next = `${window.location.pathname}${
        params.toString() ? `?${params}` : ""
      }${window.location.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  function handleConnect() {
    setLoading(true);
    setError(null);
    const nextPath = returnTo.startsWith("/") ? returnTo : "/settings/playlists";
    // Supabase Auth 経由だと YouTube スコープが付かないことがあるため、専用 OAuth を使う
    window.location.href = `/api/youtube/oauth/start?returnTo=${encodeURIComponent(nextPath)}`;
  }

  const isConnected = connected || justConnected;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
            isConnected
              ? "bg-[#c9a66b]/15 text-[#c9a66b]"
              : "bg-[#e8dfd0]/8 text-[#e8dfd0]/60"
          }`}
        >
          {isConnected ? "連携済み" : "未連携"}
        </span>
        {channelId ? (
          <span className="text-xs text-[#e8dfd0]/45">ID: {channelId}</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        className="mt-4 inline-flex items-center justify-center rounded-full border border-[#e8dfd0]/20 bg-[#14161c] px-5 py-2.5 text-sm font-medium text-[#e8dfd0] transition hover:border-[#e8dfd0]/40 disabled:opacity-60"
      >
        {loading
          ? "接続中…"
          : isConnected
            ? "YouTube連携を更新する"
            : "YouTube連携する"}
      </button>

      {error ? (
        <p className="mt-2 text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-[#e8dfd0]/50">
        「YouTube連携する」を押すと Google
        の許可画面が開きます。YouTube（再生リストの閲覧・作成）へのアクセスを必ず許可してください。
        ログイン用の Google 認証とは別に、YouTube API
        用の権限を取得します。
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[#e8dfd0]/40">
        Google で「リクエストは無効」と出る場合は、OAuth クライアントの
        「承認済みのリダイレクト URI」に次が<strong>一字一句同じ</strong>で入っているか確認してください:
        <br />
        <code className="mt-1 block break-all text-[#c9a66b]/90">
          http://127.0.0.1:3000/api/youtube/oauth/callback
        </code>
        ブラウザも必ず{" "}
        <code className="text-[#c9a66b]/90">http://127.0.0.1:3000</code>{" "}
        で開いてください（localhost だとずれることがあります）。
      </p>
    </div>
  );
}
