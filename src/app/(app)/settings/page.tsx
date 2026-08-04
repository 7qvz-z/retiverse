import { SettingsForm } from "@/components/settings/SettingsForm";
import { mapProfile, type ProfileRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFERENCES, type Profile } from "@/lib/types";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: row } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profile: Profile = row
    ? mapProfile(row as ProfileRow)
    : {
        id: user.id,
        displayName:
          (user.user_metadata?.full_name as string | undefined) ?? null,
        avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
        youtubeChannelId: null,
        onboardingCompleted: false,
        favoriteArtists: [],
        favoriteGenres: [],
        preferences: DEFAULT_PREFERENCES,
        plan: "free",
        analyzedPlaylistIds: [],
        playlistAnalysis: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">設定</h1>
      <p className="mt-3 text-[#1a1612]/65">
        生成の好みや曲数をいつでも変えられます。
      </p>
      <div className="mt-10">
        <SettingsForm profile={profile} />
      </div>
    </main>
  );
}
