import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { mapProfile, type ProfileRow } from "@/lib/profile";
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
      <p className="text-sm text-[#1a1612]/50">設定</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl">
        アーティスト・ジャンル
      </h1>
      <p className="mt-3 text-[#1a1612]/65">
        編集画面はこれから作ります。いまは登録内容の確認だけできます。
      </p>

      <section className="mt-10 space-y-6">
        <div>
          <h2 className="text-sm font-medium text-[#1a1612]/55">
            好きなアーティスト
          </h2>
          {profile?.favoriteArtists.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {profile.favoriteArtists.map((artist) => (
                <li
                  key={artist}
                  className="rounded-full bg-[#1a1612] px-3 py-1 text-xs text-[#f4f0e8]"
                >
                  {artist}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#1a1612]/45">未登録</p>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-[#1a1612]/55">
            好きなジャンル
          </h2>
          {profile?.favoriteGenres.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {profile.favoriteGenres.map((genre) => (
                <li
                  key={genre}
                  className="rounded-full border border-[#1a1612]/15 bg-white px-3 py-1 text-xs"
                >
                  {genre}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-[#1a1612]/45">未登録</p>
          )}
        </div>
      </section>

      <Link
        href="/"
        className="mt-10 inline-block text-sm text-[#2a6f6a] underline-offset-2 hover:underline"
      >
        ホームに戻る
      </Link>
    </main>
  );
}
