"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TagInput } from "@/components/setup/TagInput";
import { GENRE_OPTIONS } from "@/lib/setup-options";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  initialArtists: string[];
  initialGenres: string[];
};

export function TastesForm({
  userId,
  initialArtists,
  initialGenres,
}: Props) {
  const [artists, setArtists] = useState(initialArtists);
  const [genres, setGenres] = useState(initialGenres);
  const [savedArtists, setSavedArtists] = useState(initialArtists);
  const [savedGenres, setSavedGenres] = useState(initialGenres);
  const [customGenre, setCustomGenre] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = useMemo(() => {
    return (
      JSON.stringify(artists) !== JSON.stringify(savedArtists) ||
      JSON.stringify(genres) !== JSON.stringify(savedGenres)
    );
  }, [artists, genres, savedArtists, savedGenres]);

  const genreChoices = useMemo(() => {
    const extras = genres.filter(
      (g) => !(GENRE_OPTIONS as readonly string[]).includes(g),
    );
    return [...GENRE_OPTIONS, ...extras];
  }, [genres]);

  function toggleGenre(genre: string) {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
    setMessage(null);
  }

  function addCustomGenre() {
    const genre = customGenre.trim();
    if (!genre) return;
    if (!genres.some((g) => g.toLowerCase() === genre.toLowerCase())) {
      setGenres((prev) => [...prev, genre]);
    }
    setCustomGenre("");
    setMessage(null);
  }

  async function handleSave() {
    setError(null);
    setMessage(null);

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
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          favorite_artists: artists,
          favorite_genres: genres,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) throw new Error(updateError.message);

      await supabase.from("preference_change_logs").insert({
        user_id: userId,
        changes: {
          favorite_artists: { from: savedArtists, to: artists },
          favorite_genres: { from: savedGenres, to: genres },
        },
      });

      setSavedArtists(artists);
      setSavedGenres(genres);
      setMessage("好みを保存しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            好きなアーティスト
          </h2>
          <p className="mt-1 text-sm text-[#1a1612]/60">
            追加・削除できます。生成の最重要材料です。
          </p>
        </div>
        <TagInput
          values={artists}
          onChange={(values) => {
            setArtists(values);
            setMessage(null);
          }}
          placeholder="例: 米津玄師"
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            好きなジャンル
          </h2>
          <p className="mt-1 text-sm text-[#1a1612]/60">
            タップで選択／解除。一覧にないものは下で追加できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {genreChoices.map((genre) => {
            const active = genres.includes(genre);
            return (
              <button
                key={genre}
                type="button"
                onClick={() => toggleGenre(genre)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  active
                    ? "bg-[#1a1612] text-[#f4f0e8]"
                    : "border border-[#1a1612]/15 bg-white text-[#1a1612] hover:border-[#1a1612]/35"
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={customGenre}
            onChange={(e) => setCustomGenre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomGenre();
              }
            }}
            placeholder="一覧にないジャンルを追加"
            className="min-w-[12rem] flex-1 rounded-full border border-[#1a1612]/15 bg-white px-4 py-2 text-sm outline-none focus:border-[#1a1612]/35"
          />
          <button
            type="button"
            onClick={addCustomGenre}
            className="rounded-full border border-[#1a1612]/20 bg-white px-4 py-2 text-sm"
          >
            追加
          </button>
        </div>
      </section>

      {error ? (
        <p className="text-sm text-[#b42318]" role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-[#1f4f4b]">{message}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !dirty}
          className="rounded-full bg-[#1a1612] px-6 py-3 text-sm font-semibold text-[#f4f0e8] disabled:opacity-40"
        >
          {saving ? "保存中…" : "好みを保存"}
        </button>
        <Link
          href="/settings"
          className="text-sm text-[#2a6f6a] underline-offset-2 hover:underline"
        >
          設定に戻る
        </Link>
        <Link
          href="/"
          className="text-sm text-[#1a1612]/50 underline-offset-2 hover:underline"
        >
          ホーム
        </Link>
      </div>
    </div>
  );
}
