import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { APP_NAME } from "@/lib/constants";

type Section = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

type Props = {
  title: string;
  updatedAt: string;
  sections: Section[];
};

export function LegalDocument({ title, updatedAt, sections }: Props) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0b0d] text-[#e8dfd0]">
      <header className="border-b border-[#e8dfd0]/10 px-6 py-5">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <Link href="/login" className="inline-flex items-center gap-2">
            <BrandLogo variant="wordmark" width={120} className="h-auto w-[7rem]" />
            <span className="sr-only">{APP_NAME}</span>
          </Link>
          <Link
            href="/login"
            className="text-xs text-[#c9a66b] underline-offset-2 hover:underline"
          >
            ログインへ
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 sm:py-14">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-[#e8dfd0]/50">最終更新日: {updatedAt}</p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed text-[#e8dfd0]/80">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-base font-medium tracking-wide text-[#c9a66b]">
                {section.heading}
              </h2>
              {section.paragraphs.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
              {section.bullets && section.bullets.length > 0 ? (
                <ul className="list-disc space-y-1.5 pl-5 text-[#e8dfd0]/75">
                  {section.bullets.map((b) => (
                    <li key={b.slice(0, 40)}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <p className="border-t border-[#e8dfd0]/10 pt-6 text-xs text-[#e8dfd0]/45">
            本ページの内容はサービス提供のための草案であり、弁護士等による法的レビューを経た確定文書ではありません。必要に応じて内容を改定します。
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
