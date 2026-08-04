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
  favorite_artists: string[] | null;
  favorite_genres: string[] | null;
  preferences: UserPreferences | null;
  plan: "free" | "premium";
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
    favoriteArtists: row.favorite_artists ?? [],
    favoriteGenres: row.favorite_genres ?? [],
    preferences: { ...DEFAULT_PREFERENCES, ...(row.preferences ?? {}) },
    plan: row.plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
