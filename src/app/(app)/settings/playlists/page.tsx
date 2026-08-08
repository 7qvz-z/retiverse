import { PlaylistAnalyzePanel } from "@/components/settings/PlaylistAnalyzePanel";
import { mapProfile, type ProfileRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PlaylistAnalyzePage() {
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

  const profile = row ? mapProfile(row as ProfileRow) : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-sm text-[#e8dfd0]/50">設定</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl">
        YouTubeプレイリスト解析
      </h1>
      <p className="mt-3 text-[#e8dfd0]/65">
        既存のプレイリストからよく出るアーティストを抽出し、生成の材料にします。
      </p>

      <div className="mt-10">
        <PlaylistAnalyzePanel
          initialSelectedIds={profile?.analyzedPlaylistIds ?? []}
          initialAnalysis={profile?.playlistAnalysis ?? null}
          channelId={profile?.youtubeChannelId ?? null}
        />
      </div>
    </main>
  );
}
