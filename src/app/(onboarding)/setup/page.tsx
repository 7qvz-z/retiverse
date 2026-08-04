import { SetupForm } from "@/components/setup/SetupForm";
import { APP_NAME } from "@/lib/constants";
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
  const youtubeConnected = Boolean(
    session.provider_token || profile?.youtubeChannelId,
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <p className="text-xs tracking-[0.25em] text-[#2a6f6a]">{APP_NAME}</p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl text-[#1a1612]">
        初回設定
      </h1>
      <p className="mt-3 text-[#1a1612]/65">
        あなた好みのプレイリストを作るための、最初の準備です。
      </p>

      <div className="mt-10">
        <SetupForm
          profile={profile}
          userId={session.user.id}
          youtubeConnected={youtubeConnected}
          initialChannelId={profile?.youtubeChannelId ?? null}
        />
      </div>
    </main>
  );
}
