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
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [customGenre, setCustomGenre] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedArtists = useMemo(
    () => [...artists].sort((a, b) => a.localeCompare(b, "ja")),
    [artists],
  );

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

  function toggleSelectArtist(name: string) {
    setSelectedArtists((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name],
    );
  }

  function selectAllArtists() {
    setSelectedArtists(artists);
  }

  function clearArtistSelection() {
    setSelectedArtists([]);
  }

  function bulkDeleteArtists() {
    if (selectedArtists.length === 0) return;
    setArtists((prev) => prev.filter((a) => !selectedArtists.includes(a)));
    setSelectedArtists([]);
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
      setSelectedArtists([]);
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
            追加・選択削除ができます。変更後は保存してください。
          </p>
        </div>

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
          <button
            type="button"
            onClick={bulkDeleteArtists}
            disabled={selectedArtists.length === 0}
            className="rounded-full border border-[#b42318]/30 px-3 py-1.5 text-xs text-[#b42318] disabled:opacity-40"
          >
            選択を一括削除（{selectedArtists.length}）
          </button>
        </div>

        {artists.length === 0 ? (
          <p className="text-sm text-[#1a1612]/45">未登録</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sortedArtists.map((artist) => {
              const checked = selectedArtists.includes(artist);
              return (
                <button
                  key={artist}
                  type="button"
                  onClick={() => toggleSelectArtist(artist)}
                  className={`rounded-full px-3 py-1.5 text-xs transition ${
                    checked
                      ? "bg-[#b42318] text-white"
                      : "bg-[#1a1612] text-[#f4f0e8]"
                  }`}
                >
                  {checked ? "削除予定 · " : ""}
                  {artist}
                </button>
              );
            })}
          </div>
        )}

        <TagInput
          values={artists}
          onChange={(values) => {
            setArtists(values);
            setSelectedArtists((prev) =>
              prev.filter((a) => values.includes(a)),
            );
            setMessage(null);
          }}
          placeholder="例: 米津玄師 / GILTY×GILTY"
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
          href="/settings/playlists"
          className="text-sm text-[#2a6f6a] underline-offset-2 hover:underline"
        >
          PL解析へ
        </Link>
        <Link
          href="/settings"
          className="text-sm text-[#2a6f6a] underline-offset-2 hover:underline"
        >
          設定に戻る
        </Link>
      </div>
    </div>
  );
}
