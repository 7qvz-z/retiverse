import type { PlaylistAnalysis } from "@/lib/playlist/analysis-types";
import {
  DEFAULT_PREFERENCES,
  type Profile,
  type UserPreferences,
} from "@/lib/types";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  youtube_channel_id: string | null;
  onboarding_completed: boolean;
  terms_accepted_at?: string | null;
  favorite_artists: string[] | null;
  favorite_genres: string[] | null;
  preferences: UserPreferences | null;
  plan: "free" | "premium";
  analyzed_playlist_ids?: string[] | null;
  playlist_analysis?: PlaylistAnalysis | null;
  created_at: string;
  updated_at: string;
};

export function mapProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    youtubeChannelId: row.youtube_channel_id,
    onboardingCompleted: row.onboarding_completed,
    termsAcceptedAt: row.terms_accepted_at ?? null,
    favoriteArtists: row.favorite_artists ?? [],
    favoriteGenres: row.favorite_genres ?? [],
    preferences: { ...DEFAULT_PREFERENCES, ...(row.preferences ?? {}) },
    plan: row.plan,
    analyzedPlaylistIds: row.analyzed_playlist_ids ?? [],
    playlistAnalysis: row.playlist_analysis ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
