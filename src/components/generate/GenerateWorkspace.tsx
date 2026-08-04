"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { environmentLabels, moodLabels } from "@/lib/home";
import type { TrackCandidate } from "@/lib/playlist/terms";
import type { EnvironmentTag, Mood } from "@/lib/types";

type Props = {
  moods: Mood[];
  environments: EnvironmentTag[];
  note: string;
  analysisText: string | null;
  weatherLabel?: string | null;
};

type Phase = "loading" | "preview" | "publishing" | "done" | "error";

export function GenerateWorkspace({
  moods,
  environments,
  note,
  analysisText,
  weatherLabel = null,
}: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [progress, setProgress] = useState("曲を探しています…");
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackCandidate[]>([]);
  const [title, setTitle] = useState("");
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<string | null>(null);

  const runGenerate = useCallback(async () => {
    setPhase("loading");
    setError(null);
    setPlaylistUrl(null);
    setPublishResult(null);
    setProgress("プロフィールと履歴を読み込み中…");

    const progressTimer = window.setTimeout(() => {
      setProgress("YouTube から候補曲を検索中…");
    }, 800);
    const progressTimer2 = window.setTimeout(() => {
      setProgress("重複を除外して並べ替えています…");
    }, 2500);

    try {
      const res = await fetch("/api/playlists/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moods, environments, note }),
      });
      const data = (await res.json()) as {
        error?: string;
        tracks?: TrackCandidate[];
        title?: string;
        generationId?: string | null;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "生成に失敗しました");
      }

      setTracks(data.tracks ?? []);
      setTitle(data.title ?? "リテイバース プレイリスト");
      setGenerationId(data.generationId ?? null);
      setPhase("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
      setPhase("error");
    } finally {
      window.clearTimeout(progressTimer);
      window.clearTimeout(progressTimer2);
    }
  }, [moods, environments, note]);

  useEffect(() => {
    void runGenerate();
  }, [runGenerate]);

  async function handleExclude(videoId: string) {
    setTracks((prev) => prev.filter((t) => t.videoId !== videoId));
  }

  async function handleReplace(track: TrackCandidate) {
    setReplacingId(track.videoId);
    setError(null);
    try {
      const res = await fetch("/api/playlists/replace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seedQuery: track.query || track.title,
          excludeVideoIds: tracks.map((t) => t.videoId),
          moods,
          environments,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        track?: TrackCandidate;
      };
      if (!res.ok || !data.track) {
        throw new Error(data.error ?? "差し替えに失敗しました");
      }
      setTracks((prev) =>
        prev.map((t) => (t.videoId === track.videoId ? data.track! : t)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "差し替えに失敗しました");
    } finally {
      setReplacingId(null);
    }
  }

  async function handlePublish() {
    if (tracks.length === 0) return;
    setPhase("publishing");
    setError(null);
    setProgress("YouTube にプレイリストを作成しています…");

    try {
      const res = await fetch("/api/youtube/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          generationId,
          tracks,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        playlistUrl?: string;
        addedCount?: number;
        failedCount?: number;
      };

      if (!res.ok) {
        throw new Error(data.error ?? "YouTubeへの追加に失敗しました");
      }

      setPlaylistUrl(data.playlistUrl ?? null);
      setPublishResult(
        `${data.addedCount ?? tracks.length}曲を追加しました` +
          (data.failedCount ? `（失敗 ${data.failedCount}曲）` : ""),
      );
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "YouTubeへの追加に失敗しました");
      setPhase("preview");
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-sm text-[#1a1612]/65">
        {moods.length > 0 ? <p>気分: {moodLabels(moods)}</p> : null}
        {environments.length > 0 ? (
          <p>環境: {environmentLabels(environments)}</p>
        ) : null}
        {note ? <p>その他: {note}</p> : null}
        {weatherLabel ? <p>取得した天気: {weatherLabel}</p> : null}
        {analysisText ? (
          <p className="text-[#1f4f4b]">解析: {analysisText}</p>
        ) : null}
      </div>

      {phase === "loading" || phase === "publishing" ? (
        <div className="rounded-3xl bg-white/70 px-6 py-16 text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#1a1612]/15 border-t-[#2a6f6a]" />
          <p className="mt-6 font-[family-name:var(--font-display)] text-2xl">
            {phase === "publishing" ? "YouTubeへ追加中" : "プレイリスト生成中"}
          </p>
          <p className="mt-3 text-sm text-[#1a1612]/55">{progress}</p>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="space-y-4">
          <p className="text-[#b42318]" role="alert">
            {error}
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void runGenerate()}
              className="rounded-full bg-[#1a1612] px-5 py-2.5 text-sm text-[#f4f0e8]"
            >
              再生成
            </button>
            <Link href="/" className="rounded-full px-5 py-2.5 text-sm underline">
              ホームに戻る
            </Link>
          </div>
        </div>
      ) : null}

      {phase === "preview" || phase === "done" ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-2xl">
                プレビュー
              </h2>
              <p className="mt-1 text-sm text-[#1a1612]/55">
                {tracks.length}曲 · {title}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runGenerate()}
                className="rounded-full border border-[#1a1612]/20 bg-white px-4 py-2 text-sm"
              >
                もう一度生成
              </button>
              {phase === "preview" ? (
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={tracks.length === 0}
                  className="rounded-full bg-[#1a1612] px-5 py-2 text-sm font-semibold text-[#f4f0e8] disabled:opacity-40"
                >
                  YouTubeへ追加
                </button>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="text-sm text-[#b42318]" role="alert">
              {error}
            </p>
          ) : null}

          {phase === "done" ? (
            <div className="rounded-2xl bg-[#2a6f6a]/10 px-4 py-4 text-sm text-[#1f4f4b]">
              <p>{publishResult}</p>
              {playlistUrl ? (
                <a
                  href={playlistUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block underline underline-offset-2"
                >
                  YouTubeで開く
                </a>
              ) : null}
            </div>
          ) : null}

          <ul className="divide-y divide-[#1a1612]/10 border-y border-[#1a1612]/10">
            {tracks.map((track, index) => (
              <li
                key={`${track.videoId}-${index}`}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-6 shrink-0 text-xs text-[#1a1612]/35">
                    {index + 1}
                  </span>
                  {track.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={track.thumbnailUrl}
                      alt=""
                      className="h-14 w-24 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-14 w-24 shrink-0 rounded-lg bg-[#1a1612]/10" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="truncate text-xs text-[#1a1612]/45">
                      {track.channelTitle}
                    </p>
                  </div>
                </div>
                {phase === "preview" ? (
                  <div className="flex gap-2 sm:shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleReplace(track)}
                      disabled={replacingId === track.videoId}
                      className="rounded-full border border-[#1a1612]/15 px-3 py-1.5 text-xs disabled:opacity-50"
                    >
                      {replacingId === track.videoId ? "差し替え中…" : "差し替え"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleExclude(track.videoId)}
                      className="rounded-full border border-[#1a1612]/15 px-3 py-1.5 text-xs"
                    >
                      除外
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          <Link
            href="/"
            className="inline-block text-sm text-[#2a6f6a] underline-offset-2 hover:underline"
          >
            ホームに戻る
          </Link>
        </div>
      ) : null}
    </div>
  );
}
