"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ContextHints } from "@/components/home/ContextHints";
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
import type { WeatherSnapshot } from "@/lib/weather";

type Props = {
  displayName: string | null;
  recent: GenerationSummary[];
  favorites: GenerationSummary[];
  artistCount: number;
  genreCount: number;
  considerWeather: boolean;
  considerSeason: boolean;
  considerTimeOfDay: boolean;
};

type EnvGroupKey = "weather" | "time" | "season";

const ENV_GROUPS: {
  key: EnvGroupKey;
  label: string;
}[] = [
  { key: "weather", label: "天気" },
  { key: "time", label: "時間帯" },
  { key: "season", label: "季節" },
];

function envGroupOf(id: EnvironmentTag): EnvGroupKey | null {
  return ENVIRONMENTS.find((item) => item.id === id)?.group ?? null;
}

export function HomePanel({
  displayName,
  recent,
  favorites,
  artistCount,
  genreCount,
  considerWeather,
  considerSeason,
  considerTimeOfDay,
}: Props) {
  const router = useRouter();
  const [moods, setMoods] = useState<Mood[]>([]);
  const [environments, setEnvironments] = useState<EnvironmentTag[]>([]);
  const [otherNote, setOtherNote] = useState("");
  const [analysis, setAnalysis] = useState<NoteAnalysis | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  const enabledGroups = useMemo(() => {
    const groups = new Set<EnvGroupKey>();
    if (considerWeather) groups.add("weather");
    if (considerTimeOfDay) groups.add("time");
    if (considerSeason) groups.add("season");
    return groups;
  }, [considerWeather, considerSeason, considerTimeOfDay]);

  const visibleEnvGroups = useMemo(
    () => ENV_GROUPS.filter((group) => enabledGroups.has(group.key)),
    [enabledGroups],
  );

  const isEnvAllowed = useCallback(
    (id: EnvironmentTag) => {
      const group = envGroupOf(id);
      return group !== null && enabledGroups.has(group);
    },
    [enabledGroups],
  );

  // 設定 OFF のグループは選択・天気表示から外す
  useEffect(() => {
    setEnvironments((prev) => prev.filter(isEnvAllowed));
    if (!considerWeather) setWeather(null);
  }, [considerWeather, isEnvAllowed]);

  const canGenerate = moods.length > 0 || otherNote.trim().length > 0;

  const handleApplyHints = useCallback(
    (tags: EnvironmentTag[], weatherSnap: WeatherSnapshot | null) => {
      setWeather(considerWeather ? weatherSnap : null);
      setEnvironments((prev) => {
        const next = prev.filter(isEnvAllowed);
        for (const tag of tags) {
          if (isEnvAllowed(tag) && !next.includes(tag)) next.push(tag);
        }
        return next;
      });
    },
    [considerWeather, isEnvAllowed],
  );

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
    if (!isEnvAllowed(id)) return;
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
      const next = prev.filter(isEnvAllowed);
      for (const env of result.environments) {
        if (isEnvAllowed(env) && !next.includes(env)) next.push(env);
      }
      return next;
    });
  }

  function handleGenerate() {
    if (!canGenerate) return;
    const allowedEnvironments = environments.filter(isEnvAllowed);
    const params = new URLSearchParams();
    if (moods.length > 0) params.set("moods", moods.join(","));
    if (allowedEnvironments.length > 0) {
      params.set("environments", allowedEnvironments.join(","));
    }
    if (otherNote.trim()) params.set("note", otherNote.trim());
    if (considerWeather && weather) {
      params.set("weather", weather.environment);
      params.set("weatherLabel", weather.label);
    }
    router.push(`/generate?${params.toString()}`);
  }

  return (
    <div className="space-y-12">
      <section>
        <p className="text-sm text-[#e8dfd0]/55">
          {displayName ? `${displayName} さん` : "ようこそ"}
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-tight">
          いまの気分は？
        </h1>
        <p className="mt-3 max-w-xl text-[#e8dfd0]/65">
          気分は複数選べます。環境や「その他」の自由記述も使えます。
        </p>
        <p className="mt-3 text-xs text-[#e8dfd0]/45">
          登録済み: アーティスト {artistCount} / ジャンル {genreCount}
          {" · "}
          <Link
            href="/settings/tastes"
            className="underline underline-offset-2 hover:text-[#e8dfd0]"
          >
            あなたの音楽スタイルを編集
          </Link>
        </p>

        <div className="mt-5">
          <ContextHints
            considerWeather={considerWeather}
            considerSeason={considerSeason}
            considerTimeOfDay={considerTimeOfDay}
            onApply={handleApplyHints}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium tracking-wide text-[#e8dfd0]/55">
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
                    ? "bg-[#c9a66b] text-[#0a0b0d]"
                    : "bg-[#14161c]/85 text-[#e8dfd0] hover:bg-[#1a1d24]"
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
        <h2 className="text-sm font-medium tracking-wide text-[#e8dfd0]/55">
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
          className="w-full rounded-2xl border border-[#e8dfd0]/15 bg-[#14161c] px-4 py-3 text-sm outline-none placeholder:text-[#e8dfd0]/35 focus:border-[#e8dfd0]/35"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!otherNote.trim()}
            className="rounded-full border border-[#e8dfd0]/20 bg-[#14161c] px-4 py-2 text-sm disabled:opacity-40"
          >
            内容を解析して反映
          </button>
          {analysis ? (
            <p className="text-xs text-[#c9a66b]">{describeAnalysis(analysis)}</p>
          ) : (
            <p className="text-xs text-[#e8dfd0]/45">
              キーワードから気分・環境を自動で追加します
              {enabledGroups.size === 0
                ? "（環境の自動反映は設定で ON にした項目のみ）"
                : ""}
            </p>
          )}
        </div>
      </section>

      {visibleEnvGroups.length > 0 ? (
        <section className="space-y-6">
          <h2 className="text-sm font-medium tracking-wide text-[#e8dfd0]/55">
            環境（任意・複数可）
          </h2>
          {visibleEnvGroups.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-xs text-[#e8dfd0]/45">{group.label}</p>
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
                            ? "bg-[#c9a66b] text-white"
                            : "border border-[#e8dfd0]/12 bg-[#14161c] text-[#e8dfd0] hover:border-[#e8dfd0]/30"
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
      ) : (
        <section className="space-y-2">
          <h2 className="text-sm font-medium tracking-wide text-[#e8dfd0]/55">
            環境
          </h2>
          <p className="text-xs text-[#e8dfd0]/45">
            季節・天気・時間帯は設定でオフのため、ホームでは使いません。
            <Link
              href="/settings"
              className="ml-1 underline underline-offset-2 hover:text-[#e8dfd0]"
            >
              設定を開く
            </Link>
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="rounded-full bg-[#c9a66b] px-8 py-4 text-sm font-semibold text-[#f4f0e8] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          プレイリスト生成
        </button>
        <p className="text-sm text-[#e8dfd0]/55">{summary}</p>
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
        <p className="mt-4 text-sm text-[#e8dfd0]/45">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-[#e8dfd0]/10 border-y border-[#e8dfd0]/10">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-4">
              <span className="text-xl" aria-hidden>
                {moodEmoji(item.mood)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {item.title ?? moodLabel(item.mood)}
                </p>
                <p className="mt-1 text-xs text-[#e8dfd0]/45">
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
