"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [pickedArtists, setPickedArtists] = useState<string[]>([]);
  const [mergePair, setMergePair] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [adding, setAdding] = useState(false);
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

  useEffect(() => {
    setPickedArtists([]);
    setMergePair([]);
  }, [analysis?.analyzedAt]);

  const [artistNames, setArtistNames] = useState<string[]>([]);

  useEffect(() => {
    const names = analysis?.artists ?? [];
    setArtistNames([...names].sort((a, b) => a.localeCompare(b, "ja")));
  }, [analysis?.artists]);

  const allArtistNames = artistNames;
  const allPicked = useMemo(
    () =>
      allArtistNames.length > 0 &&
      allArtistNames.every((a) => pickedArtists.includes(a)),
    [allArtistNames, pickedArtists],
  );

  function togglePlaylist(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
    setMessage(null);
  }

  function toggleArtist(name: string) {
    setPickedArtists((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name],
    );
    setMessage(null);
  }

  function toggleMergeTag(name: string) {
    setMergePair((prev) => {
      if (prev.includes(name)) return prev.filter((a) => a !== name);
      if (prev.length >= 2) return [prev[1], name];
      return [...prev, name];
    });
    setMessage(null);
  }

  async function handleMerge(canonical: string) {
    if (mergePair.length !== 2) {
      setError("統合するにはタグを2つ選んでください");
      return;
    }
    const mergeFrom = mergePair.find((n) => n !== canonical);
    if (!mergeFrom) {
      setError("統合元のタグが見つかりません");
      return;
    }
    setMerging(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/artist-aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canonical, mergeFrom }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "統合に失敗しました");

      setArtistNames((prev) =>
        [...new Set(prev.map((n) => (n === mergeFrom ? canonical : n)))].sort(
          (a, b) => a.localeCompare(b, "ja"),
        ),
      );
      setPickedArtists((prev) =>
        [...new Set(prev.map((n) => (n === mergeFrom ? canonical : n)))],
      );
      setMergePair([]);
      setMessage(
        `「${mergeFrom}」を「${canonical}」に統合し、辞書へ追記しました`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "統合に失敗しました");
    } finally {
      setMerging(false);
    }
  }

  function selectAllArtists() {
    setPickedArtists(allArtistNames);
    setMessage(null);
  }

  function clearArtistSelection() {
    setPickedArtists([]);
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
        body: JSON.stringify({ playlistIds: selected }),
      });
      const data = (await res.json()) as {
        error?: string;
        analysis?: PlaylistAnalysis;
        artistCount?: number;
        videoCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "解析に失敗しました");
      setAnalysis(data.analysis ?? null);
      setPickedArtists([]);
      setMessage(
        `解析完了: ${data.videoCount ?? 0}曲から候補 ${data.artistCount ?? 0} 件。追加したい人だけ選んでください。`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析に失敗しました");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleAddSelected() {
    if (pickedArtists.length === 0) {
      setError("追加するアーティストを選んでください");
      return;
    }
    setAdding(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/tastes/artists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artists: pickedArtists }),
      });
      const data = (await res.json()) as {
        error?: string;
        addedCount?: number;
      };
      if (!res.ok) throw new Error(data.error ?? "追加に失敗しました");
      setMessage(
        `${data.addedCount ?? pickedArtists.length} 件を好きなアーティストに追加しました`,
      );
      setPickedArtists([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "追加に失敗しました");
    } finally {
      setAdding(false);
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
                    onChange={() => togglePlaylist(playlist.id)}
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={selectAllArtists}
              className="rounded-full border border-[#1a1612]/15 px-3 py-1.5 text-xs"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={clearArtistSelection}
              className="rounded-full border border-[#1a1612]/15 px-3 py-1.5 text-xs"
            >
              選択解除
            </button>
            <span className="self-center text-xs text-[#1a1612]/45">
              {pickedArtists.length} / {allArtistNames.length} 選択中
              {allPicked ? "（すべて）" : ""}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {allArtistNames.length === 0 ? (
              <span className="text-xs text-[#1a1612]/45">候補なし</span>
            ) : (
              allArtistNames.map((artist) => {
                const checked = pickedArtists.includes(artist);
                const inMerge = mergePair.includes(artist);
                return (
                  <div key={artist} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleArtist(artist)}
                      className={`rounded-full px-3 py-1.5 text-xs transition ${
                        checked
                          ? "bg-[#2a6f6a] text-white"
                          : "border border-[#1a1612]/15 bg-white text-[#1a1612]"
                      }`}
                    >
                      {artist}
                    </button>
                    <button
                      type="button"
                      title="統合用に選択"
                      onClick={() => toggleMergeTag(artist)}
                      className={`rounded-full px-2 py-1 text-[10px] transition ${
                        inMerge
                          ? "bg-[#8b4513] text-white"
                          : "border border-[#1a1612]/10 text-[#1a1612]/45"
                      }`}
                    >
                      統
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {mergePair.length > 0 ? (
            <div className="space-y-2 rounded-xl border border-[#8b4513]/25 bg-[#8b4513]/5 px-3 py-3">
              <p className="text-xs text-[#1a1612]/65">
                統合選択（茶色）: {mergePair.join(" ＋ ")}
                {mergePair.length < 2 ? "（もう1つ選んでください）" : ""}
              </p>
              {mergePair.length === 2 ? (
                <div className="flex flex-wrap gap-2">
                  <span className="self-center text-xs text-[#1a1612]/55">
                    正式名にする側:
                  </span>
                  {mergePair.map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={merging}
                      onClick={() => void handleMerge(name)}
                      className="rounded-full bg-[#8b4513] px-3 py-1.5 text-xs text-white disabled:opacity-40"
                    >
                      「{name}」に統合
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-[#1a1612]/45">
              表記ゆれをまとめるときは、タグ横の「統」で2つ選び、正式名側のボタンを押します（辞書へ自動追記）。
            </p>
          )}

          <button
            type="button"
            onClick={() => void handleAddSelected()}
            disabled={adding || pickedArtists.length === 0}
            className="rounded-full bg-[#1a1612] px-5 py-2.5 text-sm font-semibold text-[#f4f0e8] disabled:opacity-40"
          >
            {adding
              ? "追加中…"
              : `選択した ${pickedArtists.length} 件を好きなアーティストに追加`}
          </button>

          <p className="text-xs text-[#1a1612]/45">
            解析済み曲ID: {analysis.videoIds.length}（生成時の重複回避にも使用）
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/settings/tastes"
          className="text-[#2a6f6a] underline-offset-2 hover:underline"
        >
          好みの編集・一括削除へ
        </Link>
        <Link
          href="/settings"
          className="text-[#2a6f6a] underline-offset-2 hover:underline"
        >
          設定に戻る
        </Link>
        <Link
          href="/"
          className="text-[#1a1612]/50 underline-offset-2 hover:underline"
        >
          ホーム
        </Link>
      </div>
    </div>
  );
}
