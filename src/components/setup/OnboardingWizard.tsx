"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { TagInput } from "@/components/setup/TagInput";
import { YouTubeConnectButton } from "@/components/setup/YouTubeConnectButton";
import { SUGGESTED_ARTISTS } from "@/lib/onboarding-suggestions";
import { GENRE_OPTIONS } from "@/lib/setup-options";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_PREFERENCES,
  type Profile,
  type UserPreferences,
} from "@/lib/types";

type Step = "welcome" | "connect" | "style" | "prefs";

type Props = {
  profile: Profile | null;
  userId: string;
  youtubeConnected: boolean;
  initialChannelId: string | null;
  displayName: string | null;
};

const STEPS: Step[] = ["welcome", "connect", "style", "prefs"];

export function OnboardingWizard({
  profile,
  userId,
  youtubeConnected,
  initialChannelId,
  displayName,
}: Props) {
  const router = useRouter();
  const hasChannel = Boolean(
    initialChannelId ?? profile?.youtubeChannelId ?? null,
  );
  const [step, setStep] = useState<Step>(() =>
    youtubeConnected && hasChannel ? "style" : "welcome",
  );
  const [artists, setArtists] = useState(profile?.favoriteArtists ?? []);
  const [genres, setGenres] = useState(profile?.favoriteGenres ?? []);
  const [preferences, setPreferences] = useState<UserPreferences>(
    profile?.preferences ?? DEFAULT_PREFERENCES,
  );
  const [channelId, setChannelId] = useState(
    initialChannelId ?? profile?.youtubeChannelId ?? null,
  );
  const [connected, setConnected] = useState(youtubeConnected && hasChannel);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function syncChannel() {
      setSyncing(true);
      try {
        const res = await fetch("/api/youtube/channel");
        const data = (await res.json()) as {
          channelId?: string | null;
          connected?: boolean;
          needsReconnect?: boolean;
          error?: string;
        };
        if (cancelled) return;

        if (res.ok && data.connected && data.channelId) {
          setConnected(true);
          setChannelId(data.channelId);
          setError(null);
          return;
        }

        setConnected(false);
        if (data.needsReconnect || !res.ok) {
          setChannelId(null);
          setStep((prev) =>
            prev === "style" || prev === "prefs" ? "connect" : prev,
          );
          if (data.error) setError(data.error);
        }
      } catch {
        if (!cancelled) {
          // ネットワーク一時失敗はスキップ（既存 channelId があれば維持）
        }
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }

    void syncChannel();
    return () => {
      cancelled = true;
    };
  }, []);

  const stepIndex = STEPS.indexOf(step);
  const greeting = displayName ? `${displayName} さん` : "ようこそ";

  const suggested = useMemo(
    () =>
      SUGGESTED_ARTISTS.filter(
        (name) => !artists.some((a) => a.toLowerCase() === name.toLowerCase()),
      ),
    [artists],
  );

  function toggleGenre(genre: string) {
    setGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  function toggleSuggestedArtist(name: string) {
    setArtists((prev) =>
      prev.some((a) => a.toLowerCase() === name.toLowerCase())
        ? prev.filter((a) => a.toLowerCase() !== name.toLowerCase())
        : [...prev, name],
    );
  }

  function goNext() {
    setError(null);
    if (step === "connect" && !connected && !channelId) {
      setError("先に YouTube / Google と連携してください");
      return;
    }
    if (step === "style") {
      if (artists.length === 0) {
        setError("好きなアーティストを1人以上選んでください");
        return;
      }
      if (genres.length === 0) {
        setError("好きなジャンルを1つ以上選んでください");
        return;
      }
    }
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  }

  function goBack() {
    setError(null);
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  }

  async function finish() {
    setError(null);
    if (!connected && !channelId) {
      setError("先に YouTube / Google と連携してください");
      setStep("connect");
      return;
    }
    if (artists.length === 0 || genres.length === 0) {
      setError("アーティストとジャンルを選んでください");
      setStep("style");
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
        setError(upsertError.message);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-8 sm:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <BrandLogo variant="wordmark" width={140} className="h-auto w-[8rem]" />
        <p className="text-xs tracking-[0.2em] text-[#c9a66b]/80">
          はじめての設定 {stepIndex + 1} / {STEPS.length}
        </p>
      </div>

      <div className="mb-6 h-1 overflow-hidden rounded-full bg-[#e8dfd0]/10">
        <div
          className="h-full rounded-full bg-[#c9a66b] transition-all duration-500"
          style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      {step === "welcome" ? (
        <StepShell
          imageSrc="/onboarding/welcome.png"
          imageAlt="宇宙をイメージしたウェルカムビジュアル"
          title={`${greeting}、Retiverse へ`}
          body="いまの気分にぴったりのプレイリスト宇宙をつくります。最初に、あなたの音楽スタイルを教えてください。"
        >
          <button
            type="button"
            onClick={goNext}
            className="rounded-full bg-[#c9a66b] px-8 py-3.5 text-sm font-semibold text-[#0a0b0d]"
          >
            はじめる
          </button>
        </StepShell>
      ) : null}

      {step === "connect" ? (
        <StepShell
          imageSrc="/onboarding/connect.png"
          imageAlt="連携をイメージしたビジュアル"
          title="Google / YouTube と連携"
          body="プレイリストの解析と作成に使います。ログインと同じ Google アカウントで連携できます。"
        >
          <YouTubeConnectButton
            connected={connected}
            channelId={channelId}
            returnTo="/setup"
          />
          {syncing ? (
            <p className="mt-3 text-xs text-[#e8dfd0]/50">連携状態を確認中…</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goBack}
              className="rounded-full border border-[#e8dfd0]/20 px-5 py-2.5 text-sm"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-full bg-[#c9a66b] px-6 py-2.5 text-sm font-semibold text-[#0a0b0d]"
            >
              次へ
            </button>
          </div>
        </StepShell>
      ) : null}

      {step === "style" ? (
        <StepShell
          imageSrc="/onboarding/music.png"
          imageAlt="音楽スタイルをイメージしたビジュアル"
          title="あなたの音楽スタイル"
          body="好きなアーティストとジャンルを選ぶと、生成の精度が上がります。あとからいつでも変更できます。"
        >
          <div className="space-y-8">
            <section className="space-y-3">
              <h3 className="text-sm font-medium tracking-wide text-[#c9a66b]">
                人気から選ぶ
              </h3>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_ARTISTS.map((name) => {
                  const active = artists.some(
                    (a) => a.toLowerCase() === name.toLowerCase(),
                  );
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleSuggestedArtist(name)}
                      className={`rounded-full px-3.5 py-2 text-xs transition ${
                        active
                          ? "bg-[#c9a66b] text-[#0a0b0d]"
                          : "border border-[#e8dfd0]/15 bg-[#14161c] text-[#e8dfd0] hover:border-[#c9a66b]/40"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
              {suggested.length === 0 ? null : (
                <p className="text-xs text-[#e8dfd0]/45">
                  タップで追加／解除できます
                </p>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium tracking-wide text-[#c9a66b]">
                好きなアーティスト
              </h3>
              <TagInput
                values={artists}
                onChange={setArtists}
                placeholder="例: 米津玄師 / Official髭男dism"
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium tracking-wide text-[#c9a66b]">
                好きなジャンル
              </h3>
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
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goBack}
              className="rounded-full border border-[#e8dfd0]/20 px-5 py-2.5 text-sm"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={goNext}
              className="rounded-full bg-[#c9a66b] px-6 py-2.5 text-sm font-semibold text-[#0a0b0d]"
            >
              次へ
            </button>
          </div>
        </StepShell>
      ) : null}

      {step === "prefs" ? (
        <StepShell
          imageSrc="/onboarding/welcome.png"
          imageAlt="設定完了前のビジュアル"
          title="あと少しだけ"
          body="季節や天気を軽く反映するかどうか選べます。スキップしても、あとから設定で変えられます。"
        >
          <ul className="divide-y divide-[#e8dfd0]/10 border-y border-[#e8dfd0]/10">
            {(
              [
                {
                  key: "considerSeason" as const,
                  label: "季節を考慮",
                  description: "今の季節に合いそうな曲を少し多めにします",
                },
                {
                  key: "considerWeather" as const,
                  label: "天気を考慮",
                  description: "天気をおすすめに軽く反映します",
                },
                {
                  key: "considerTimeOfDay" as const,
                  label: "時間帯を考慮",
                  description: "朝・昼・夜を軽く反映します",
                },
              ] as const
            ).map((field) => (
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
                  onClick={() =>
                    setPreferences((prev) => ({
                      ...prev,
                      [field.key]: !prev[field.key],
                    }))
                  }
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

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={goBack}
              className="rounded-full border border-[#e8dfd0]/20 px-5 py-2.5 text-sm"
            >
              戻る
            </button>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={saving}
              className="rounded-full bg-[#c9a66b] px-6 py-2.5 text-sm font-semibold text-[#0a0b0d] disabled:opacity-50"
            >
              {saving ? "保存中…" : "はじめる"}
            </button>
          </div>
        </StepShell>
      ) : null}

      {error ? (
        <p className="mt-6 text-sm text-[#ffb4a2]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function StepShell({
  imageSrc,
  imageAlt,
  title,
  body,
  children,
}: {
  imageSrc: string;
  imageAlt: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid flex-1 gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-12">
      <div className="relative aspect-[16/10] overflow-hidden rounded-3xl border border-[#c9a66b]/15 bg-[#14161c] lg:aspect-auto lg:min-h-[28rem]">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a0b0d]/55 via-transparent to-transparent" />
      </div>
      <div className="animate-fade-up">
        <h1 className="font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-[#e8dfd0]/65">
          {body}
        </p>
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
