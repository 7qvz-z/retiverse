import { APP_NAME } from "@/lib/constants";
import Link from "next/link";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#f7f3ec] text-[#1a1612]">
      <header className="border-b border-[#1a1612]/10">
        <div className="mx-auto flex max-w-2xl items-center px-6 py-4">
          <Link
            href="/setup"
            className="font-[family-name:var(--font-display)] text-lg tracking-tight"
          >
            {APP_NAME}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
