"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ENVIRONMENTS, MOODS } from "@/lib/constants";
import {
  environmentLabels,
  formatRelativeTime,
  moodEmoji,
  moodLabel,
  type GenerationSummary,
} from "@/lib/home";
import type { EnvironmentTag, Mood } from "@/lib/types";

type Props = {
  displayName: string | null;
  recent: GenerationSummary[];
  favorites: GenerationSummary[];
  artistCount: number;
  genreCount: number;
};

export function HomePanel({
  displayName,
  recent,
  favorites,
  artistCount,
  genreCount,
}: Props) {
  const router = useRouter();
  const [mood, setMood] = useState<Mood | null>(null);
  const [environments, setEnvironments] = useState<EnvironmentTag[]>([]);

  const canGenerate = mood !== null;

  const summary = useMemo(() => {
    if (!mood) return "気分を選ぶと生成できます";
    const env = environmentLabels(environments);
    return env
      ? `${moodLabel(mood)} × ${env}`
      : `${moodLabel(mood)} のプレイリスト`;
  }, [mood, environments]);

  function toggleEnvironment(id: EnvironmentTag) {
    setEnvironments((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  }

  function handleGenerate() {
    if (!mood) return;
    const params = new URLSearchParams();
    params.set("mood", mood);
    if (environments.length > 0) {
      params.set("environments", environments.join(","));
    }
    router.push(`/generate?${params.toString()}`);
  }

  return (
    <div className="space-y-12">
      <section>
        <p className="text-sm text-[#1a1612]/55">
          {displayName ? `${displayName} さん` : "ようこそ"}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-tight">
          いまの気分は？
        </h1>
        <p className="mt-3 max-w-xl text-[#1a1612]/65">
          気分と環境を選んで、あなた向けのプレイリストを作ります。
        </p>
        <p className="mt-3 text-xs text-[#1a1612]/45">
          登録済み: アーティスト {artistCount} / ジャンル {genreCount}
          {" · "}
          <Link
            href="/settings/tastes"
            className="underline underline-offset-2 hover:text-[#1a1612]"
          >
            好みを編集（準備中）
          </Link>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium tracking-wide text-[#1a1612]/55">
          気分（必須）
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {MOODS.map((item) => {
            const active = mood === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setMood(item.id)}
                className={`flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-center transition ${
                  active
                    ? "bg-[#1a1612] text-[#f4f0e8]"
                    : "bg-white/70 text-[#1a1612] hover:bg-white"
                }`}
              >
                <span className="text-2xl" aria-hidden>
                  {item.emoji}
                </span>
                <span className="text-xs font-medium leading-snug">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium tracking-wide text-[#1a1612]/55">
          環境（任意・複数可）
        </h2>
        <div className="flex flex-wrap gap-2">
          {ENVIRONMENTS.map((item) => {
            const active = environments.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleEnvironment(item.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                  active
                    ? "bg-[#2a6f6a] text-white"
                    : "border border-[#1a1612]/12 bg-white text-[#1a1612] hover:border-[#1a1612]/30"
                }`}
              >
                <span aria-hidden>{item.emoji}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="rounded-full bg-[#1a1612] px-8 py-4 text-sm font-semibold text-[#f4f0e8] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          プレイリスト生成
        </button>
        <p className="text-sm text-[#1a1612]/55">{summary}</p>
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <HistoryBlock title="直近の生成" items={recent} empty="まだ生成履歴がありません" />
        <HistoryBlock
          title="お気に入り"
          items={favorites}
          empty="お気に入りはまだありません"
        />
      </section>
    </div>
  );
}

function HistoryBlock({
  title,
  items,
  empty,
}: {
  title: string;
  items: GenerationSummary[];
  empty: string;
}) {
  return (
    <div>
      <h2 className="font-[family-name:var(--font-display)] text-2xl">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-[#1a1612]/45">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-[#1a1612]/10 border-y border-[#1a1612]/10">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-4">
              <span className="text-xl" aria-hidden>
                {moodEmoji(item.mood)}
              </span>
              <div className="min-w-0 flex-1">
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
              {item.isFavorite ? (
                <span className="text-xs text-[#8b4513]">★</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
