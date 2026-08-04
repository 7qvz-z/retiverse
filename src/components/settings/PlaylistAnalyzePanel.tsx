"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { YouTubeConnectButton } from "@/components/setup/YouTubeConnectButton";
import type { PlaylistAnalysis } from "@/lib/playlist/analysis-types";
import type { YoutubePlaylistSummary } from "@/lib/playlist/analysis-types";

type Props = {
  initialSelectedIds: string[];
  initialAnalysis: PlaylistAnalysis | null;
  channelId: string | null;
};

export function PlaylistAnalyzePanel({
  initialSelectedIds,
  initialAnalysis,
  channelId,
}: Props) {
  const [playlists, setPlaylists] = useState<YoutubePlaylistSummary[]>([]);
  const [selected, setSelected] = useState<string[]>(initialSelectedIds);
  const [analysis, setAnalysis] = useState<PlaylistAnalysis | null>(
    initialAnalysis,
  );
  const [mergeArtists, setMergeArtists] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadPlaylists = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/youtube/my-playlists");
      const data = (await res.json()) as {
        error?: string;
        playlists?: YoutubePlaylistSummary[];
      };
      if (!res.ok) throw new Error(data.error ?? "一覧の取得に失敗しました");
      setPlaylists(data.playlists ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "一覧の取得に失敗しました");
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
    setMessage(null);
  }

  async function handleAnalyze() {
    if (selected.length === 0) {
      setError("解析するプレイリストを1つ以上選んでください");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/youtube/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlistIds: selected,
          mergeArtistsToFavorites: mergeArtists,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        analysis?: PlaylistAnalysis;
        artistCount?: number;
        videoCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "解析に失敗しました");
      setAnalysis(data.analysis ?? null);
      setMessage(
        `解析完了: ${data.videoCount ?? 0}曲からアーティスト候補 ${data.artistCount ?? 0} 件を抽出しました`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析に失敗しました");
    } finally {
      setAnalyzing(false);
    }
  }

  const needsReconnect =
    Boolean(error) &&
    (error?.includes("トークン") ||
      error?.includes("連携") ||
      error?.includes("認証"));

  return (
    <div className="space-y-8">
      {needsReconnect ? (
        <section className="rounded-2xl border border-[#b42318]/25 bg-white px-4 py-4">
          <p className="text-sm text-[#b42318]">{error}</p>
          <div className="mt-4">
            <YouTubeConnectButton
              connected={false}
              channelId={channelId}
              returnTo="/settings/playlists"
            />
          </div>
        </section>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void loadPlaylists()}
          className="rounded-full border border-[#1a1612]/20 bg-white px-4 py-2 text-sm"
        >
          一覧を再読み込み
        </button>
        <p className="text-xs text-[#1a1612]/45">最大5件まで選択できます</p>
      </div>

      {loadingList ? (
        <p className="text-sm text-[#1a1612]/55">プレイリストを読み込み中…</p>
      ) : playlists.length === 0 ? (
        <p className="text-sm text-[#1a1612]/55">
          プレイリストが見つかりません。YouTube 連携を確認してください。
        </p>
      ) : (
        <ul className="divide-y divide-[#1a1612]/10 border-y border-[#1a1612]/10">
          {playlists.map((playlist) => {
            const checked = selected.includes(playlist.id);
            return (
              <li key={playlist.id}>
                <label className="flex cursor-pointer items-center gap-3 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(playlist.id)}
                    className="h-4 w-4 accent-[#2a6f6a]"
                  />
                  {playlist.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={playlist.thumbnailUrl}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-[#1a1612]/10" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {playlist.title}
                    </span>
                    <span className="text-xs text-[#1a1612]/45">
                      {playlist.itemCount}曲
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <label className="flex items-center gap-2 text-sm text-[#1a1612]/70">
        <input
          type="checkbox"
          checked={mergeArtists}
          onChange={(e) => setMergeArtists(e.target.checked)}
          className="accent-[#2a6f6a]"
        />
        抽出したアーティストを「好きなアーティスト」にも追加する
      </label>

      <button
        type="button"
        onClick={() => void handleAnalyze()}
        disabled={analyzing || selected.length === 0}
        className="rounded-full bg-[#1a1612] px-6 py-3 text-sm font-semibold text-[#f4f0e8] disabled:opacity-40"
      >
        {analyzing ? "解析中…" : "選択したプレイリストを解析"}
      </button>

      {error && !needsReconnect ? (
        <p className="text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-[#1f4f4b]">{message}</p> : null}

      {analysis ? (
        <section className="space-y-4 rounded-2xl border border-[#1a1612]/10 bg-white/70 px-4 py-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl">
            解析結果
          </h2>
          <p className="text-xs text-[#1a1612]/45">
            対象: {analysis.playlistTitles.join(" / ")}
          </p>
          <div>
            <p className="text-sm font-medium">抽出アーティスト（信頼度順）</p>
            <p className="mt-1 text-xs text-[#1a1612]/45">
              Topic / 公式MV を優先し、メドレー・予告などは除外しています
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {analysis.artists.length === 0 ? (
                <span className="text-xs text-[#1a1612]/45">なし</span>
              ) : (
                analysis.artists.map((artist, index) => (
                  <span
                    key={artist}
                    className="rounded-full bg-[#1a1612] px-3 py-1 text-xs text-[#f4f0e8]"
                    title={`順位 ${index + 1}`}
                  >
                    {artist}
                  </span>
                ))
              )}
            </div>
          </div>
          <p className="text-xs text-[#1a1612]/45">
            解析済み曲ID: {analysis.videoIds.length}（生成時の重複回避にも使用）
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/settings"
          className="text-[#2a6f6a] underline-offset-2 hover:underline"
        >
          設定に戻る
        </Link>
        <Link href="/" className="text-[#1a1612]/50 underline-offset-2 hover:underline">
          ホーム
        </Link>
      </div>
    </div>
  );
}
