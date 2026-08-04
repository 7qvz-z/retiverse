import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#f7f3ec] text-[#1a1612]">
      <header className="border-b border-[#1a1612]/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-xl tracking-tight"
          >
            {APP_NAME}
          </Link>
          <nav className="flex flex-wrap gap-4 text-sm sm:gap-5">
            <Link href="/" className="hover:opacity-70">
              ホーム
            </Link>
            <Link href="/settings/tastes" className="hover:opacity-70">
              好み
            </Link>
            <Link href="/settings" className="hover:opacity-70">
              設定
            </Link>
            <Link href="/me" className="hover:opacity-70">
              マイページ
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
