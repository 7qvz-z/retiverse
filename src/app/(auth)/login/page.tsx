import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { APP_CATCHCOPY, APP_NAME } from "@/lib/constants";

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const authFailed = params.error === "auth";

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_10%,#2a6f6a_0%,transparent_50%),radial-gradient(ellipse_at_90%_80%,#8b4513_0%,transparent_45%),linear-gradient(160deg,#0c1214_0%,#152428_45%,#1a1410_100%)]" />
        <div className="absolute -left-24 top-1/4 h-[28rem] w-[28rem] rounded-full border border-white/5" />
        <div className="absolute -left-8 top-[28%] h-[20rem] w-[20rem] rounded-full border border-white/5" />
        <div className="absolute -left-0 top-[32%] h-[12rem] w-[12rem] rounded-full border border-[#d4a574]/20" />
        <div className="login-grain absolute inset-0 opacity-[0.35]" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-end px-6 pb-16 pt-24 sm:justify-center sm:px-12 lg:px-20">
        <div className="max-w-xl animate-fade-up">
          <p className="mb-4 font-[family-name:var(--font-display)] text-sm tracking-[0.35em] text-[#d4a574]">
            YOUTUBE PLAYLIST
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-medium leading-[1.1] tracking-tight text-[#f4f0e8] sm:text-7xl">
            {APP_NAME}
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#f4f0e8]/75 sm:text-xl">
            {APP_CATCHCOPY}
          </p>

          <div className="mt-10 animate-fade-up-delayed">
            <GoogleLoginButton />
            {authFailed ? (
              <p className="mt-3 text-sm text-[#ffb4a2]" role="alert">
                認証に失敗しました。もう一度お試しください。
              </p>
            ) : null}
            <p className="mt-6 max-w-sm text-xs leading-relaxed text-[#f4f0e8]/45">
              ログインすると、気分や環境に合わせたプレイリストを自動生成できます。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
