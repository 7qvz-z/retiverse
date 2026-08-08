import { TastesForm } from "@/components/settings/TastesForm";
import { mapProfile, type ProfileRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function TastesSettingsPage() {
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
        あなたの音楽スタイル
      </h1>
      <p className="mt-3 text-[#e8dfd0]/65">
        好きなアーティストとジャンルをいつでも追加・削除できます。変更はすぐ次の生成に反映されます。
      </p>

      <div className="mt-10">
        <TastesForm
          userId={user.id}
          initialArtists={profile?.favoriteArtists ?? []}
          initialGenres={profile?.favoriteGenres ?? []}
        />
      </div>
    </main>
  );
}
