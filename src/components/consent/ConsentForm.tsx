"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { APP_NAME } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export function ConsentForm() {
  const router = useRouter();
  const [privacyOk, setPrivacyOk] = useState(false);
  const [termsOk, setTermsOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = privacyOk && termsOk && !busy;

  async function accept() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }

      const now = new Date().toISOString();
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .maybeSingle();

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        terms_accepted_at: now,
        updated_at: now,
      });

      if (upsertError) {
        setError(
          upsertError.message.includes("terms_accepted_at")
            ? "同意記録用のカラムが未作成です。Supabase でマイグレーション 20260808000000_terms_accepted.sql を実行してください。"
            : upsertError.message,
        );
        return;
      }

      const onboardingDone = Boolean(profile?.onboarding_completed);
      router.replace(onboardingDone ? "/" : "/setup");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "同意の保存に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0b0d] text-[#e8dfd0]">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16">
        <BrandLogo
          variant="wordmark"
          width={140}
          className="mx-auto h-auto w-[8.5rem]"
        />
        <h1 className="mt-10 text-center font-[family-name:var(--font-display)] text-2xl tracking-tight sm:text-3xl">
          利用前の確認
        </h1>
        <p className="mt-4 text-center text-sm leading-relaxed text-[#e8dfd0]/70">
          {APP_NAME}{" "}
          をご利用いただくには、プライバシーポリシーと利用規約への同意が必要です。
        </p>

        <div className="mt-8 space-y-4 text-sm">
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e8dfd0]/12 bg-[#12141a] px-4 py-3">
            <input
              type="checkbox"
              checked={privacyOk}
              onChange={(e) => setPrivacyOk(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#c9a66b]"
            />
            <span className="leading-relaxed text-[#e8dfd0]/80">
              <Link
                href="/privacy"
                className="text-[#c9a66b] underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                プライバシーポリシー
              </Link>
              に同意します
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#e8dfd0]/12 bg-[#12141a] px-4 py-3">
            <input
              type="checkbox"
              checked={termsOk}
              onChange={(e) => setTermsOk(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#c9a66b]"
            />
            <span className="leading-relaxed text-[#e8dfd0]/80">
              <Link
                href="/terms"
                className="text-[#c9a66b] underline-offset-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                利用規約
              </Link>
              に同意します
            </span>
          </label>
        </div>

        <p className="mt-8 text-center text-sm text-[#e8dfd0]/80">
          上記に同意しますか？
        </p>

        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => void accept()}
          className="mt-5 w-full rounded-xl bg-[#c9a66b] px-4 py-3.5 text-sm font-medium text-[#0a0b0d] transition hover:bg-[#d4b57a] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "保存中…" : "同意して続ける"}
        </button>

        {error ? (
          <p className="mt-4 text-center text-sm text-[#ffb4a2]" role="alert">
            {error}
          </p>
        ) : null}

        <p className="mt-6 text-center text-xs text-[#e8dfd0]/40">
          同意しない場合は本サービスをご利用いただけません。
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
