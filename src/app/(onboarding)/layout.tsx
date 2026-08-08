import { SiteFooter } from "@/components/layout/SiteFooter";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#0a0b0d] text-[#e8dfd0]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(201,166,107,0.14)_0%,transparent_50%),radial-gradient(ellipse_at_90%_80%,rgba(40,50,70,0.35)_0%,transparent_45%)]" />
      </div>
      <div className="relative z-10 flex-1">{children}</div>
      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
}
