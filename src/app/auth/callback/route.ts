import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { persistYouTubeCredentials } from "@/lib/youtube/auth";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user && data.session) {
      const meta = data.user.user_metadata ?? {};
      await supabase.from("profiles").upsert({
        id: data.user.id,
        display_name: meta.full_name ?? meta.name ?? null,
        avatar_url: meta.avatar_url ?? meta.picture ?? null,
        updated_at: new Date().toISOString(),
      });

      try {
        await persistYouTubeCredentials(data.user.id, data.session);
      } catch (e) {
        console.error("[auth/callback] persistYouTubeCredentials:", e);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_completed, terms_accepted_at")
        .eq("id", data.user.id)
        .maybeSingle();

      let termsAccepted = Boolean(profile?.terms_accepted_at);
      let onboardingDone = Boolean(profile?.onboarding_completed);

      if (profileError && /terms_accepted_at/i.test(profileError.message)) {
        const { data: fallback } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", data.user.id)
          .maybeSingle();
        termsAccepted = true; // カラム未作成時は同意ゲートをスキップ
        onboardingDone = Boolean(fallback?.onboarding_completed);
      }

      const requested = next.startsWith("/") ? next : "/";

      let destination = requested;
      if (!termsAccepted) {
        destination = "/consent";
      } else if (!onboardingDone) {
        // 初回は専用セットアップへ。YouTube 再連携で /setup に戻す場合はそのまま
        destination =
          requested.startsWith("/setup") || requested.startsWith("/settings")
            ? requested
            : "/setup";
      } else if (requested === "/login") {
        destination = "/";
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
