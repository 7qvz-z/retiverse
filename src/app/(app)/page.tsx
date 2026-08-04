import { HomePanel } from "@/components/home/HomePanel";
import { mapProfile, type ProfileRow } from "@/lib/profile";
import type { GenerationSummary } from "@/lib/home";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type GenerationRow = {
  id: string;
  mood: string | null;
  environments: string[] | null;
  title: string | null;
  youtube_playlist_id: string | null;
  is_favorite: boolean;
  created_at: string;
  track_ids: string[] | null;
};

function mapGeneration(row: GenerationRow): GenerationSummary {
  return {
    id: row.id,
    mood: row.mood,
    environments: row.environments ?? [],
    title: row.title,
    youtubePlaylistId: row.youtube_playlist_id,
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    trackCount: row.track_ids?.length ?? 0,
  };
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileRow ? mapProfile(profileRow as ProfileRow) : null;

  const { data: recentRows } = await supabase
    .from("playlist_generations")
    .select(
      "id, mood, environments, title, youtube_playlist_id, is_favorite, created_at, track_ids",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: favoriteRows } = await supabase
    .from("playlist_generations")
    .select(
      "id, mood, environments, title, youtube_playlist_id, is_favorite, created_at, track_ids",
    )
    .eq("user_id", user.id)
    .eq("is_favorite", true)
    .order("created_at", { ascending: false })
    .limit(5);

  const recent = (recentRows as GenerationRow[] | null)?.map(mapGeneration) ?? [];
  const favorites =
    (favoriteRows as GenerationRow[] | null)?.map(mapGeneration) ?? [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <HomePanel
        displayName={
          profile?.displayName ??
          (user.user_metadata?.full_name as string | undefined) ??
          null
        }
        recent={recent}
        favorites={favorites}
        artistCount={profile?.favoriteArtists.length ?? 0}
        genreCount={profile?.favoriteGenres.length ?? 0}
      />
    </main>
  );
}
