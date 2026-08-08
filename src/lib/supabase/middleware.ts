import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

async function withTimeout<T>(
  promise: PromiseLike<T>,
  ms: number,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isLegalPublic =
    pathname === "/privacy" || pathname === "/terms";
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    isLegalPublic;

  // Auth サーバ応答待ちでページ全体が固まるのを防ぐ
  const userResult = await withTimeout(supabase.auth.getUser(), 4000);
  const user = userResult?.data.user ?? null;

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user) {
    let onboardingCompleted = true;
    let termsAccepted = true;
    let profileLoaded = false;

    const profileResult = await withTimeout(
      supabase
        .from("profiles")
        .select("onboarding_completed, terms_accepted_at")
        .eq("id", user.id)
        .maybeSingle(),
      3000,
    );

    if (profileResult && !profileResult.error) {
      profileLoaded = true;
      onboardingCompleted =
        profileResult.data?.onboarding_completed ?? false;
      termsAccepted = Boolean(profileResult.data?.terms_accepted_at);
    } else if (
      profileResult?.error &&
      /terms_accepted_at/i.test(profileResult.error.message)
    ) {
      // マイグレーション未適用時は同意チェックをスキップ（アプリをロックしない）
      const fallback = await withTimeout(
        supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", user.id)
          .maybeSingle(),
        3000,
      );
      if (fallback && !fallback.error) {
        profileLoaded = true;
        onboardingCompleted = fallback.data?.onboarding_completed ?? false;
      }
    }

    const isConsent = pathname === "/consent";
    const isSetup = pathname === "/setup";
    const skipGate =
      isLegalPublic ||
      isConsent ||
      pathname.startsWith("/auth/");

    if (pathname === "/login") {
      const redirectUrl = request.nextUrl.clone();
      if (profileLoaded && !termsAccepted) {
        redirectUrl.pathname = "/consent";
      } else {
        redirectUrl.pathname = onboardingCompleted ? "/" : "/setup";
      }
      return NextResponse.redirect(redirectUrl);
    }

    if (profileLoaded && !termsAccepted && !skipGate) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/consent";
      return NextResponse.redirect(redirectUrl);
    }

    if (
      profileLoaded &&
      termsAccepted &&
      !onboardingCompleted &&
      !isSetup &&
      !skipGate
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/setup";
      return NextResponse.redirect(redirectUrl);
    }

    // 同意済みで /consent に来たら先へ送る
    if (profileLoaded && termsAccepted && isConsent) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = onboardingCompleted ? "/" : "/setup";
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
