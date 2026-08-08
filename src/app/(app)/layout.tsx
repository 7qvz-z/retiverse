import { AppHeader } from "@/components/layout/AppHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0b0d] text-[#e8dfd0]">
      <AppHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
