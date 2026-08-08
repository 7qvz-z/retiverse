"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { APP_NAME } from "@/lib/constants";

const NAV_ITEMS = [
  { href: "/", label: "ホーム" },
  { href: "/settings/tastes", label: "あなたの音楽スタイル" },
  { href: "/settings/playlists", label: "プレイリスト解析" },
  { href: "/settings", label: "設定" },
  { href: "/me", label: "マイページ" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/settings") {
    return pathname === "/settings";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header className="relative z-40 border-b border-[#c9a66b]/20 bg-[#0a0b0d]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5" aria-label={APP_NAME}>
          <BrandLogo variant="mark" width={34} className="h-[34px] w-[34px]" />
          <BrandLogo
            variant="wordmark"
            width={128}
            className="h-auto w-[7.5rem]"
          />
        </Link>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#c9a66b]/30 text-[#e8dfd0] transition hover:border-[#c9a66b]/60 hover:text-[#c9a66b]"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        >
          <span className="sr-only">{open ? "閉じる" : "メニュー"}</span>
          <span className="flex w-5 flex-col gap-[5px]" aria-hidden>
            <span
              className={`h-[1.5px] w-full bg-current transition ${
                open ? "translate-y-[6.5px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-[1.5px] w-full bg-current transition ${
                open ? "opacity-0" : ""
              }`}
            />
            <span
              className={`h-[1.5px] w-full bg-current transition ${
                open ? "-translate-y-[6.5px] -rotate-45" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/55"
            aria-label="メニューを閉じる"
            onClick={() => setOpen(false)}
          />
          <nav
            id={panelId}
            className="absolute inset-x-0 top-full z-50 border-b border-[#c9a66b]/20 bg-[#0a0b0d] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
          >
            <ul className="mx-auto max-w-5xl px-6 py-3">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center justify-between border-b border-[#e8dfd0]/08 py-3.5 text-base transition last:border-b-0 ${
                        active
                          ? "text-[#c9a66b]"
                          : "text-[#e8dfd0]/85 hover:text-[#c9a66b]"
                      }`}
                      aria-current={active ? "page" : undefined}
                    >
                      <span>{item.label}</span>
                      {active ? (
                        <span className="text-xs tracking-wide text-[#c9a66b]/70">
                          表示中
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      ) : null}
    </header>
  );
}
