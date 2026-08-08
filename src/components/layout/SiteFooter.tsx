import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[#e8dfd0]/8 px-6 py-5">
      <nav
        aria-label="法務情報"
        className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] tracking-wide text-[#e8dfd0]/40"
      >
        <Link
          href="/privacy"
          className="underline-offset-2 transition hover:text-[#e8dfd0]/70 hover:underline"
        >
          プライバシーポリシー
        </Link>
        <span aria-hidden>·</span>
        <Link
          href="/terms"
          className="underline-offset-2 transition hover:text-[#e8dfd0]/70 hover:underline"
        >
          利用規約
        </Link>
      </nav>
    </footer>
  );
}
