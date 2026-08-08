"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { TagInput } from "@/components/setup/TagInput";
import { YouTubeConnectButton } from "@/components/setup/YouTubeConnectButton";
import { GENRE_OPTIONS, SETUP_TOGGLE_FIELDS } from "@/lib/setup-options";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PREFERENCES,
  type Profile,
  type UserPreferences,
} from "@/lib/types";

type Props = {
  profile: Profile | null;
  userId: string;
  youtubeConnected: boolean;
  initialChannelId: string | null;
};

export function SetupForm({
  profile,
  userId,
  youtubeConnected,
  initialChannelId,
}: Props) {
  const router = useRouter();
  const [artists, setArtists] = useState(profile?.favoriteArtists ?? []);
  const [genres, setGenres] = useState(profile?.favoriteGenres ?? []);
  const [preferences, setPreferences] = useState<UserPreferences>(
    profile?.preferences ?? DEFAULT_PREFERENCES,
  );
  const [channelId, setChannelId] = useState(
    initialChannelId ?? profile?.youtubeChannelId ?? null,
  );
  const [connected, setConnected] = useState(
    youtubeConnected &&
      Boolean(initialChannelId ?? profile?.youtubeChannelId),
  );
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function togglePreference(key: (typeof SETUP_TOGGLE_FIELDS)[number]["key"]) {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleGenre(genre: string) {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  async function syncYouTubeChannel() {
    setSyncing(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/youtube/channel");
      const data = (await res.json()) as {
        channelId?: string | null;
        connected?: boolean;
        needsReconnect?: boolean;
        error?: string;
      };

      if (!res.ok || data.needsReconnect) {
        setConnected(false);
        setChannelId(null);
        setError(data.error ?? "YouTubeチャンネルの取得に失敗しました");
        return;
      }

      setConnected(Boolean(data.connected && data.channelId));
      if (data.channelId) {
        setChannelId(data.channelId);
        setMessage("YouTubeチャンネルを取得しました");
      } else if (data.connected) {
        setMessage(
          "YouTube連携は確認できました。チャンネルIDの取得は後で再試行できます。",
        );
      }
    } catch {
      setError("YouTubeチャンネルの取得に失敗しました");
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!connected && !channelId) {
      setError("先に YouTube と連携してください");
      return;
    }
    if (artists.length === 0) {
      setError("好きなアーティストを1人以上追加してください");
      return;
    }
    if (genres.length === 0) {
      setError("好きなジャンルを1つ以上選んでください");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: userId,
        favorite_artists: artists,
        favorite_genres: genres,
        preferences,
        youtube_channel_id: channelId,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      });

      if (upsertError) {
        setError(
          upsertError.message.includes("Could not find the table")
            ? "profiles テーブルがありません。Supabase でマイグレーション SQL を実行してください。"
            : upsertError.message,
        );
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-12">
      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            YouTube連携
          </h2>
          <p className="mt-1 text-sm text-[#e8dfd0]/60">
            プレイリストの解析・作成に使います
          </p>
        </div>
        <YouTubeConnectButton
          connected={connected}
          channelId={channelId}
          returnTo="/setup"
        />
        <button
          type="button"
          onClick={syncYouTubeChannel}
          disabled={syncing}
          className="text-sm text-[#c9a66b] underline-offset-2 hover:underline disabled:opacity-50"
        >
          {syncing ? "チャンネル情報を取得中…" : "連携後にチャンネル情報を取得"}
        </button>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            好きなアーティスト
          </h2>
          <p className="mt-1 text-sm text-[#e8dfd0]/60">
            生成の最重要材料になります
          </p>
        </div>
        <TagInput
          values={artists}
          onChange={setArtists}
          placeholder="例: 米津玄師"
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            好きなジャンル
          </h2>
          <p className="mt-1 text-sm text-[#e8dfd0]/60">複数選択できます</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {GENRE_OPTIONS.map((genre) => {
            const active = genres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  active
                    ? "bg-[#c9a66b] text-[#0a0b0d]"
                    : "border border-[#e8dfd0]/15 bg-[#14161c] text-[#e8dfd0] hover:border-[#e8dfd0]/35"
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            各種設定
          </h2>
          <p className="mt-1 text-sm text-[#e8dfd0]/60">
            あとから設定画面でも変更できます
          </p>
        </div>
        <ul className="divide-y divide-[#e8dfd0]/10 border-y border-[#e8dfd0]/10">
          {SETUP_TOGGLE_FIELDS.map((field) => (
            <li
              key={field.key}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div>
                <p className="text-sm font-medium">{field.label}</p>
                <p className="mt-0.5 text-xs text-[#e8dfd0]/50">
                  {field.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences[field.key]}
                onClick={() => togglePreference(field.key)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  preferences[field.key] ? "bg-[#c9a66b]" : "bg-[#e8dfd0]/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-[#14161c] transition ${
                    preferences[field.key] ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error ? (
        <p className="text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-[#c9a66b]">{message}</p> : null}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-[#c9a66b] px-6 py-4 text-sm font-semibold text-[#0a0b0d] transition hover:opacity-90 disabled:opacity-60 sm:w-auto sm:min-w-[14rem]"
      >
        {saving ? "保存中…" : "設定を保存して始める"}
      </button>
    </form>
  );
}
