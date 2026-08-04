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
  moodLabels,
  type GenerationSummary,
} from "@/lib/home";
import {
  analyzeOtherNote,
  describeAnalysis,
  type NoteAnalysis,
} from "@/lib/note-analysis";
import type { EnvironmentTag, Mood } from "@/lib/types";

type Props = {
  displayName: string | null;
  recent: GenerationSummary[];
  favorites: GenerationSummary[];
  artistCount: number;
  genreCount: number;
};

const ENV_GROUPS: {
  key: "weather" | "time" | "season";
  label: string;
}[] = [
  { key: "weather", label: "天気" },
  { key: "time", label: "時間帯" },
  { key: "season", label: "季節" },
];

export function HomePanel({
  displayName,
  recent,
  favorites,
  artistCount,
  genreCount,
}: Props) {
  const router = useRouter();
  const [moods, setMoods] = useState<Mood[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentTag[]>([]);
  const [otherNote, setOtherNote] = useState("");
  const [analysis, setAnalysis] = useState<NoteAnalysis | null>(null);

  const canGenerate = moods.length > 0 || otherNote.trim().length > 0;

  const summary = useMemo(() => {
    if (moods.length === 0 && !otherNote.trim()) {
      return "気分を選ぶか、その他に書いて生成できます";
    }
    const parts = [moods.length > 0 ? moodLabels(moods) : null];
    const env = environmentLabels(environments);
    if (env) parts.push(env);
    if (otherNote.trim()) parts.push(`その他: ${otherNote.trim()}`);
    return parts.filter(Boolean).join(" × ");
  }, [moods, environments, otherNote]);

  function toggleMood(id: Mood) {
    setMoods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
    );
  }

  function toggleEnvironment(id: EnvironmentTag) {
    setEnvironments((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id],
    );
  }

  function handleAnalyze() {
    const result = analyzeOtherNote(otherNote);
    setAnalysis(result);

    setMoods((prev) => {
      const next = [...prev];
      for (const mood of result.moods) {
        if (!next.includes(mood)) next.push(mood);
      }
      return next;
    });

    setEnvironments((prev) => {
      const next = [...prev];
      for (const env of result.environments) {
        if (!next.includes(env)) next.push(env);
      }
      return next;
    });
  }

  function handleGenerate() {
    if (!canGenerate) return;
    const params = new URLSearchParams();
    if (moods.length > 0) params.set("moods", moods.join(","));
    if (environments.length > 0) {
      params.set("environments", environments.join(","));
    }
    if (otherNote.trim()) params.set("note", otherNote.trim());
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
          気分は複数選べます。環境や「その他」の自由記述も使えます。
        </p>
        <p className="mt-3 text-xs text-[#1a1612]/45">
          登録済み: アーティスト {artistCount} / ジャンル {genreCount}
          {" · "}
          <Link
            href="/settings/tastes"
            className="underline underline-offset-2 hover:text-[#1a1612]"
          >
            好みを編集
          </Link>
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium tracking-wide text-[#1a1612]/55">
          気分（複数可）
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {MOODS.map((item) => {
            const active = moods.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleMood(item.id)}
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
          その他（自由記述）
        </h2>
        <textarea
          value={otherNote}
          onChange={(e) => {
            setOtherNote(e.target.value);
            setAnalysis(null);
          }}
          rows={3}
          placeholder="例: 朝の通勤、雨の日に集中したい、ちょっと悲しい…"
          className="w-full rounded-2xl border border-[#1a1612]/15 bg-white px-4 py-3 text-sm outline-none placeholder:text-[#1a1612]/35 focus:border-[#1a1612]/35"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!otherNote.trim()}
            className="rounded-full border border-[#1a1612]/20 bg-white px-4 py-2 text-sm disabled:opacity-40"
          >
            内容を解析して反映
          </button>
          {analysis ? (
            <p className="text-xs text-[#1f4f4b]">{describeAnalysis(analysis)}</p>
          ) : (
            <p className="text-xs text-[#1a1612]/45">
              キーワードから気分・環境を自動で追加します
            </p>
          )}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-sm font-medium tracking-wide text-[#1a1612]/55">
          環境（任意・複数可）
        </h2>
        {ENV_GROUPS.map((group) => (
          <div key={group.key} className="space-y-2">
            <p className="text-xs text-[#1a1612]/45">{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {ENVIRONMENTS.filter((item) => item.group === group.key).map(
                (item) => {
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
                },
              )}
            </div>
          </div>
        ))}
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
        <HistoryBlock
          title="直近の生成"
          items={recent}
          empty="まだ生成履歴がありません"
        />
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
