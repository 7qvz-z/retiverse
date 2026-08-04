"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ARTIST_MAX_TRACKS,
  RANDOMNESS_STEP,
  TRACK_COUNT,
} from "@/lib/constants";
import { SETUP_TOGGLE_FIELDS } from "@/lib/setup-options";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PREFERENCES,
  type Profile,
  type UserPreferences,
} from "@/lib/types";

type Props = {
  profile: Profile;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snapRandomness(n: number) {
  const stepped =
    Math.round(n / RANDOMNESS_STEP) * RANDOMNESS_STEP;
  return clamp(stepped, 0, 100);
}

export function SettingsForm({ profile }: Props) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    ...DEFAULT_PREFERENCES,
    ...profile.preferences,
  });
  const [savedPreferences, setSavedPreferences] = useState<UserPreferences>({
    ...DEFAULT_PREFERENCES,
    ...profile.preferences,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planLabel = profile.plan === "premium" ? "Premium" : "無料";

  const dirty = useMemo(() => {
    return JSON.stringify(preferences) !== JSON.stringify(savedPreferences);
  }, [preferences, savedPreferences]);

  function toggle(key: (typeof SETUP_TOGGLE_FIELDS)[number]["key"]) {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
    setMessage(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);

    const next: UserPreferences = {
      ...preferences,
      trackCount: clamp(
        preferences.trackCount,
        TRACK_COUNT.min,
        TRACK_COUNT.max,
      ),
      maxTracksPerArtist: clamp(
        preferences.maxTracksPerArtist,
        ARTIST_MAX_TRACKS.min,
        ARTIST_MAX_TRACKS.max,
      ),
      randomnessPercent: snapRandomness(preferences.randomnessPercent),
    };

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          preferences: next,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of Object.keys(next) as (keyof UserPreferences)[]) {
        if (savedPreferences[key] !== next[key]) {
          changes[key] = { from: savedPreferences[key], to: next[key] };
        }
      }

      if (Object.keys(changes).length > 0) {
        await supabase.from("preference_change_logs").insert({
          user_id: profile.id,
          changes,
        });
      }

      setPreferences(next);
      setSavedPreferences(next);
      setMessage("設定を保存しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-12">
      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          プラン
        </h2>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="rounded-full bg-[#1a1612] px-3 py-1 text-[#f4f0e8]">
            {planLabel}
          </span>
          <span className="text-[#1a1612]/55">
            曲数 10〜300・重複回避つき。Premium 機能は今後追加予定です。
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          好み
        </h2>
        <p className="text-sm text-[#1a1612]/55">
          アーティスト {profile.favoriteArtists.length} / ジャンル{" "}
          {profile.favoriteGenres.length}
        </p>
        <Link
          href="/settings/tastes"
          className="inline-block text-sm text-[#2a6f6a] underline-offset-2 hover:underline"
        >
          アーティスト・ジャンルを編集
        </Link>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          生成オプション
        </h2>
        <ul className="divide-y divide-[#1a1612]/10 border-y border-[#1a1612]/10">
          {SETUP_TOGGLE_FIELDS.map((field) => (
            <li
              key={field.key}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div>
                <p className="text-sm font-medium">{field.label}</p>
                <p className="mt-0.5 text-xs text-[#1a1612]/50">
                  {field.description}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences[field.key]}
                onClick={() => toggle(field.key)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  preferences[field.key] ? "bg-[#2a6f6a]" : "bg-[#1a1612]/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white transition ${
                    preferences[field.key] ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-6">
        <h2 className="font-[family-name:var(--font-display)] text-2xl">
          プレイリスト設定
        </h2>

        <NumberField
          label="曲数"
          unit="曲"
          min={TRACK_COUNT.min}
          max={TRACK_COUNT.max}
          step={1}
          value={preferences.trackCount}
          onChange={(value) => {
            setPreferences((prev) => ({ ...prev, trackCount: value }));
            setMessage(null);
          }}
        />

        <NumberField
          label="アーティスト最大曲数"
          unit="曲"
          min={ARTIST_MAX_TRACKS.min}
          max={ARTIST_MAX_TRACKS.max}
          step={1}
          value={preferences.maxTracksPerArtist}
          onChange={(value) => {
            setPreferences((prev) => ({
              ...prev,
              maxTracksPerArtist: value,
            }));
            setMessage(null);
          }}
        />

        <NumberField
          label="ランダム性の強さ"
          unit="%"
          min={0}
          max={100}
          step={RANDOMNESS_STEP}
          value={preferences.randomnessPercent}
          disabled={!preferences.randomnessEnabled}
          normalize={snapRandomness}
          hint="「ランダム性」が OFF のときは並びのばらつきを抑えめにします。5%刻みで入力できます。"
          onChange={(value) => {
            setPreferences((prev) => ({
              ...prev,
              randomnessPercent: value,
            }));
            setMessage(null);
          }}
        />
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
          {saving ? "保存中…" : "設定を保存"}
        </button>
        <Link
          href="/"
          className="text-sm text-[#2a6f6a] underline-offset-2 hover:underline"
        >
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  hint?: string;
  normalize?: (n: number) => number;
  onChange: (value: number) => void;
};

function NumberField({
  label,
  unit,
  min,
  max,
  step,
  value,
  disabled = false,
  hint,
  normalize,
  onChange,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit(raw: string) {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = clamp(parsed, min, max);
    const next = normalize ? normalize(clamped) : clamped;
    setDraft(String(next));
    onChange(next);
  }

  return (
    <div className={`space-y-2 ${disabled ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={draft}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            className="w-20 rounded-lg border border-[#1a1612]/15 bg-white px-2 py-1.5 text-right text-sm outline-none focus:border-[#1a1612]/40 disabled:cursor-not-allowed"
            aria-label={`${label}の数値入力`}
          />
          <span className="text-sm text-[#1a1612]/55">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = Number(e.target.value);
          const normalized = normalize ? normalize(next) : next;
          onChange(normalized);
        }}
        className="w-full accent-[#2a6f6a] disabled:cursor-not-allowed"
        aria-label={`${label}のスライダー`}
      />
      <div className="flex justify-between text-xs text-[#1a1612]/40">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
      {hint ? <p className="text-xs text-[#1a1612]/45">{hint}</p> : null}
    </div>
  );
}
