import { BrandLogo } from "@/components/brand/BrandLogo";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { APP_CATCHCOPY, APP_TAGLINE } from "@/lib/constants";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const authFailed = params.error === "auth";

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-[#050608]">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(212,165,116,0.18)_0%,transparent_55%),radial-gradient(ellipse_at_80%_90%,rgba(42,80,90,0.35)_0%,transparent_50%),linear-gradient(165deg,#050608_0%,#0c1014_50%,#121018_100%)]" />
        <div className="absolute inset-0 opacity-40">
          <BrandLogo
            variant="mark"
            width={720}
            className="absolute -right-16 top-[-4%] h-auto w-[min(90vw,42rem)] opacity-30 animate-float-soft sm:right-[-4%] sm:top-[6%] sm:opacity-40"
            priority
          />
        </div>
        <div className="login-grain absolute inset-0 opacity-[0.25]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-12">
        <div className="flex w-full max-w-lg flex-col items-center text-center animate-fade-up">
          <BrandLogo
            variant="lockup"
            width={280}
            priority
            className="h-auto w-[min(70vw,17.5rem)] animate-fade-up drop-shadow-[0_0_40px_rgba(212,165,116,0.15)]"
          />
          <p className="mt-8 font-[family-name:var(--font-display)] text-xs tracking-[0.42em] text-[#d4a574]/90 uppercase">
            {APP_TAGLINE}
          </p>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-[#f4f0e8]/72 sm:text-lg">
            {APP_CATCHCOPY}
          </p>

          <div className="mt-10 w-full flex justify-center animate-fade-up-delayed">
            <GoogleLoginButton className="flex w-full flex-col items-center" />
          </div>
          {authFailed ? (
            <p className="mt-3 text-sm text-[#ffb4a2]" role="alert">
              認証に失敗しました。もう一度お試しください。
            </p>
          ) : null}
          <p className="mt-8 max-w-sm text-xs leading-relaxed text-[#f4f0e8]/40">
            Google
            でログインすると、気分や環境に合わせたプレイリストを自動でつくれます。利用にはプライバシーポリシーと利用規約への同意が必要です。
          </p>
        </div>
      </div>
      <div className="relative z-10">
        <SiteFooter />
      </div>
    </main>
  );
}
