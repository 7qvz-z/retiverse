import { MePanel } from "@/components/me/MePanel";
import type { GenerationSummary } from "@/lib/home";
import { mapProfile, type ProfileRow } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { getYouTubeUsageSummary } from "@/lib/youtube/quota";
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

type TrackEventRow = {
  id: string;
  youtube_video_id: string;
  event_type: "play" | "skip" | "favorite";
  created_at: string;
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

export default async function MePage() {
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

  const { data: generationRows } = await supabase
    .from("playlist_generations")
    .select(
      "id, mood, environments, title, youtube_playlist_id, is_favorite, created_at, track_ids",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const generations =
    (generationRows as GenerationRow[] | null)?.map(mapGeneration) ?? [];
  const favorites = generations.filter((g) => g.isFavorite);
  const createdPlaylists = generations.filter((g) => g.youtubePlaylistId);

  const { data: eventRows } = await supabase
    .from("track_events")
    .select("id, youtube_video_id, event_type, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const events = (eventRows as TrackEventRow[] | null) ?? [];
  const playEvents = events
    .filter((e) => e.event_type === "play")
    .map((e) => ({
      id: e.id,
      youtubeVideoId: e.youtube_video_id,
      eventType: e.event_type,
      createdAt: e.created_at,
    }));
  const skipEvents = events
    .filter((e) => e.event_type === "skip")
    .map((e) => ({
      id: e.id,
      youtubeVideoId: e.youtube_video_id,
      eventType: e.event_type,
      createdAt: e.created_at,
    }));

  const youtubeUsage = await getYouTubeUsageSummary(user.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
      <MePanel
        displayName={
          profile?.displayName ??
          (user.user_metadata?.full_name as string | undefined) ??
          null
        }
        email={user.email ?? null}
        avatarUrl={
          profile?.avatarUrl ??
          (user.user_metadata?.avatar_url as string | undefined) ??
          null
        }
        youtubeChannelId={profile?.youtubeChannelId ?? null}
        plan={profile?.plan ?? "free"}
        artistCount={profile?.favoriteArtists.length ?? 0}
        genreCount={profile?.favoriteGenres.length ?? 0}
        generations={generations}
        favorites={favorites}
        createdPlaylists={createdPlaylists}
        playEvents={playEvents}
        skipEvents={skipEvents}
        youtubeUsage={youtubeUsage}
      />
    </main>
  );
}
