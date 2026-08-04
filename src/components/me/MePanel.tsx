"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  environmentLabels,
  formatRelativeTime,
  moodEmoji,
  moodLabel,
  type GenerationSummary,
} from "@/lib/home";
import { createClient } from "@/lib/supabase/client";

export type TrackEventSummary = {
  id: string;
  youtubeVideoId: string;
  eventType: "play" | "skip" | "favorite";
  createdAt: string;
};

type Props = {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  youtubeChannelId: string | null;
  plan: "free" | "premium";
  artistCount: number;
  genreCount: number;
  generations: GenerationSummary[];
  favorites: GenerationSummary[];
  createdPlaylists: GenerationSummary[];
  playEvents: TrackEventSummary[];
  skipEvents: TrackEventSummary[];
};

type Tab = "generations" | "favorites" | "playlists" | "plays" | "skips";

export function MePanel({
  displayName,
  email,
  avatarUrl,
  youtubeChannelId,
  plan,
  artistCount,
  genreCount,
  generations: initialGenerations,
  favorites: initialFavorites,
  createdPlaylists: _createdPlaylists,
  playEvents,
  skipEvents,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("generations");
  const [generations, setGenerations] = useState(initialGenerations);
  const [favorites, setFavorites] = useState(initialFavorites);
  const createdPlaylists = generations.filter((g) => g.youtubePlaylistId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  async function toggleFavorite(item: GenerationSummary) {
    setBusyId(item.id);
    setError(null);
    const next = !item.isFavorite;

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("playlist_generations")
        .update({ is_favorite: next })
        .eq("id", item.id);

      if (updateError) throw new Error(updateError.message);

      setGenerations((prev) =>
        prev.map((g) => (g.id === item.id ? { ...g, isFavorite: next } : g)),
      );

      setFavorites((prev) => {
        if (next) {
          const updated = { ...item, isFavorite: true };
          if (prev.some((g) => g.id === item.id)) {
            return prev.map((g) => (g.id === item.id ? updated : g));
          }
          return [updated, ...prev];
        }
        return prev.filter((g) => g.id !== item.id);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "お気に入りの更新に失敗しました");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "generations", label: "生成履歴", count: generations.length },
    { id: "favorites", label: "お気に入り", count: favorites.length },
    { id: "playlists", label: "作成済み", count: createdPlaylists.length },
    { id: "plays", label: "再生", count: playEvents.length },
    { id: "skips", label: "スキップ", count: skipEvents.length },
  ];

  return (
    <div className="space-y-10">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1a1612] text-xl text-[#f4f0e8]">
              {(displayName ?? "U").slice(0, 1)}
            </div>
          )}
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl">
              {displayName ?? "ユーザー"}
            </h1>
            <p className="mt-1 text-sm text-[#1a1612]/55">
              {email ?? "メール未取得"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#1a1612]/55">
              <span className="rounded-full bg-[#1a1612] px-2.5 py-1 text-[#f4f0e8]">
                {plan === "premium" ? "Premium" : "無料プラン"}
              </span>
              <span>アーティスト {artistCount}</span>
              <span>ジャンル {genreCount}</span>
              {youtubeChannelId ? (
                <span className="truncate">YouTube: {youtubeChannelId}</span>
              ) : (
                <span>YouTube未連携</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings"
            className="rounded-full border border-[#1a1612]/15 bg-white px-4 py-2 text-sm"
          >
            設定
          </Link>
          <Link
            href="/settings/tastes"
            className="rounded-full border border-[#1a1612]/15 bg-white px-4 py-2 text-sm"
          >
            好み
          </Link>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="rounded-full border border-[#1a1612]/15 px-4 py-2 text-sm disabled:opacity-50"
          >
            {signingOut ? "ログアウト中…" : "ログアウト"}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-[#1a1612]/10 pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              tab === item.id
                ? "bg-[#1a1612] text-[#f4f0e8]"
                : "text-[#1a1612]/60 hover:bg-white"
            }`}
          >
            {item.label}
            <span className="ml-1 opacity-70">{item.count}</span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}

      {tab === "generations" ? (
        <GenerationList
          items={generations}
          empty="まだ生成履歴がありません"
          busyId={busyId}
          onToggleFavorite={toggleFavorite}
        />
      ) : null}

      {tab === "favorites" ? (
        <GenerationList
          items={favorites}
          empty="お気に入りはまだありません"
          busyId={busyId}
          onToggleFavorite={toggleFavorite}
        />
      ) : null}

      {tab === "playlists" ? (
        <GenerationList
          items={createdPlaylists}
          empty="YouTubeに追加したプレイリストはまだありません"
          busyId={busyId}
          onToggleFavorite={toggleFavorite}
        />
      ) : null}

      {tab === "plays" ? (
        <EventList
          items={playEvents}
          empty="再生履歴はまだありません（今後、再生操作の記録に対応予定）"
        />
      ) : null}

      {tab === "skips" ? (
        <EventList
          items={skipEvents}
          empty="スキップ履歴はまだありません（今後、スキップ操作の記録に対応予定）"
        />
      ) : null}
    </div>
  );
}

function GenerationList({
  items,
  empty,
  busyId,
  onToggleFavorite,
}: {
  items: GenerationSummary[];
  empty: string;
  busyId: string | null;
  onToggleFavorite: (item: GenerationSummary) => void;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[#1a1612]/45">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-[#1a1612]/10 border-y border-[#1a1612]/10">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="text-xl" aria-hidden>
              {moodEmoji(item.mood)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {item.title ?? moodLabel(item.mood)}
              </p>
              <p className="mt-1 text-xs text-[#1a1612]/45">
                {formatRelativeTime(item.createdAt)}
                {item.trackCount > 0 ? ` · ${item.trackCount}曲` : ""}
                {environmentLabels(item.environments)
                  ? ` · ${environmentLabels(item.environments)}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite(item)}
              disabled={busyId === item.id}
              className="rounded-full border border-[#1a1612]/15 px-3 py-1.5 text-xs disabled:opacity-50"
            >
              {item.isFavorite ? "★ お気に入り解除" : "☆ お気に入り"}
            </button>
            {item.youtubePlaylistId ? (
              <a
                href={`https://www.youtube.com/playlist?list=${item.youtubePlaylistId}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-[#1a1612] px-3 py-1.5 text-xs text-[#f4f0e8]"
              >
                YouTubeで開く
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function EventList({
  items,
  empty,
}: {
  items: TrackEventSummary[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[#1a1612]/45">{empty}</p>;
  }

  return (
    <ul className="divide-y divide-[#1a1612]/10 border-y border-[#1a1612]/10">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 py-3 text-sm"
        >
          <a
            href={`https://www.youtube.com/watch?v=${item.youtubeVideoId}`}
            target="_blank"
            rel="noreferrer"
            className="truncate underline-offset-2 hover:underline"
          >
            {item.youtubeVideoId}
          </a>
          <span className="shrink-0 text-xs text-[#1a1612]/45">
            {formatRelativeTime(item.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
