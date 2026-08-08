import { OnboardingWizard } from "@/components/setup/OnboardingWizard";
import { mapProfile, type ProfileRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const { data: row } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = row ? mapProfile(row as ProfileRow) : null;

  if (profile?.onboardingCompleted) {
    redirect("/");
  }

  // provider_token だけでは YouTube スコープ有無が分からないため、チャンネルIDのみを信頼する
  const youtubeConnected = Boolean(profile?.youtubeChannelId);

  return (
    <OnboardingWizard
      profile={profile}
      userId={session.user.id}
      youtubeConnected={youtubeConnected}
      initialChannelId={profile?.youtubeChannelId ?? null}
      displayName={
        profile?.displayName ??
        session.user.user_metadata?.full_name ??
        session.user.user_metadata?.name ??
        null
      }
    />
  );
}
