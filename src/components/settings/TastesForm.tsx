"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TagInput } from "@/components/setup/TagInput";
import { GENRE_OPTIONS } from "@/lib/setup-options";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  initialArtists: string[];
  initialGenres: string[];
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function TastesForm({ userId, initialArtists, initialGenres }: Props) {
  const [artists, setArtists] = useState(initialArtists);
  const [genres, setGenres] = useState(initialGenres);
  const [savedArtists, setSavedArtists] = useState(initialArtists);
  const [savedGenres, setSavedGenres] = useState(initialGenres);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [customGenre, setCustomGenre] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeq = useRef(0);
  const artistsRef = useRef(artists);
  const genresRef = useRef(genres);
  artistsRef.current = artists;
  genresRef.current = genres;

  const sortedArtists = useMemo(
    () => [...artists].sort((a, b) => a.localeCompare(b, "ja")),
    [artists],
  );

  const genreChoices = useMemo(() => {
    const extras = genres.filter(
      (g) => !(GENRE_OPTIONS as readonly string[]).includes(g),
    );
    return [...GENRE_OPTIONS, ...extras];
  }, [genres]);

  const persist = useCallback(
    async (nextArtists: string[], nextGenres: string[]) => {
      const seq = ++saveSeq.current;
      setStatus("saving");
      setError(null);

      const prevArtists = savedArtists;
      const prevGenres = savedGenres;

      try {
        const supabase = createClient();
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            favorite_artists: nextArtists,
            favorite_genres: nextGenres,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError) throw new Error(updateError.message);

        // ログ失敗は保存自体を失敗扱いにしない
        await supabase.from("preference_change_logs").insert({
          user_id: userId,
          changes: {
            favorite_artists: { from: prevArtists, to: nextArtists },
            favorite_genres: { from: prevGenres, to: nextGenres },
          },
        });

        if (seq !== saveSeq.current) return;
        setSavedArtists(nextArtists);
        setSavedGenres(nextGenres);
        setStatus("saved");
      } catch (e) {
        if (seq !== saveSeq.current) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "保存に失敗しました");
      }
    },
    [savedArtists, savedGenres, userId],
  );

  const schedulePersist = useCallback(
    (nextArtists: string[], nextGenres: string[]) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setStatus("saving");
      saveTimer.current = setTimeout(() => {
        void persist(nextArtists, nextGenres);
      }, 350);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function commitArtists(next: string[]) {
    setArtists(next);
    setSelectedArtists((prev) => prev.filter((a) => next.includes(a)));
    schedulePersist(next, genresRef.current);
  }

  function commitGenres(next: string[]) {
    setGenres(next);
    schedulePersist(artistsRef.current, next);
  }

  function toggleGenre(genre: string) {
    const next = genres.includes(genre)
      ? genres.filter((g) => g !== genre)
      : [...genres, genre];
    commitGenres(next);
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
    const remove = new Set(selectedArtists);
    const next = artists.filter((a) => !remove.has(a));
    setSelectedArtists([]);
    commitArtists(next);
  }

  function addCustomGenre() {
    const genre = customGenre.trim();
    if (!genre) return;
    if (!genres.some((g) => g.toLowerCase() === genre.toLowerCase())) {
      commitGenres([...genres, genre]);
    }
    setCustomGenre("");
  }

  const statusLabel =
    status === "saving"
      ? "保存中…"
      : status === "saved"
        ? "保存済み"
        : status === "error"
          ? "保存に失敗"
          : null;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-2xl">
              好きなアーティスト
            </h2>
            <p className="mt-1 text-sm text-[#e8dfd0]/60">
              追加・削除すると自動で保存されます。
            </p>
          </div>
          {statusLabel ? (
            <p
              className={`text-xs ${
                status === "error" ? "text-[#ffb4a2]" : "text-[#c9a66b]/80"
              }`}
              aria-live="polite"
            >
              {statusLabel}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectAllArtists}
            className="rounded-full border border-[#e8dfd0]/15 px-3 py-1.5 text-xs"
          >
            全選択
          </button>
          <button
            type="button"
            onClick={clearArtistSelection}
            className="rounded-full border border-[#e8dfd0]/15 px-3 py-1.5 text-xs"
          >
            選択解除
          </button>
          <button
            type="button"
            onClick={bulkDeleteArtists}
            disabled={selectedArtists.length === 0}
            className="rounded-full border border-[#b42318]/30 px-3 py-1.5 text-xs text-[#ffb4a2] disabled:opacity-40"
          >
            選択を一括削除（{selectedArtists.length}）
          </button>
        </div>

        {artists.length === 0 ? (
          <p className="text-sm text-[#e8dfd0]/45">
            未登録です。下の欄から追加できます。
          </p>
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
                      : "bg-[#c9a66b] text-[#0a0b0d]"
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
          onChange={commitArtists}
          placeholder="例: 米津玄師 / Official髭男dism / YOASOBI"
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl">
            好きなジャンル
          </h2>
          <p className="mt-1 text-sm text-[#e8dfd0]/60">
            タップで選択／解除。変更は自動保存されます。
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
                    ? "bg-[#c9a66b] text-[#0a0b0d]"
                    : "border border-[#e8dfd0]/15 bg-[#14161c] text-[#e8dfd0] hover:border-[#e8dfd0]/35"
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
            className="min-w-[12rem] flex-1 rounded-full border border-[#e8dfd0]/15 bg-[#14161c] px-4 py-2 text-sm outline-none focus:border-[#e8dfd0]/35"
          />
          <button
            type="button"
            onClick={addCustomGenre}
            className="rounded-full border border-[#e8dfd0]/20 bg-[#14161c] px-4 py-2 text-sm"
          >
            追加
          </button>
        </div>
      </section>

      {error ? (
        <p className="text-sm text-[#ffb4a2]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/settings/playlists"
          className="text-sm text-[#c9a66b] underline-offset-2 hover:underline"
        >
          プレイリスト解析へ
        </Link>
        <Link
          href="/settings"
          className="text-sm text-[#c9a66b] underline-offset-2 hover:underline"
        >
          設定に戻る
        </Link>
      </div>
    </div>
  );
}
