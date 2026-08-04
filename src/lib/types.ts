export type Mood =
  | "energetic"
  | "want_to_cry"
  | "relax"
  | "drive"
  | "study"
  | "game"
  | "workout"
  | "angry"
  | "hype"
  | "before_sleep";

export type EnvironmentTag =
  | "sunny"
  | "rainy"
  | "spring"
  | "summer"
  | "autumn"
  | "winter"
  | "night";

export type UserPreferences = {
  considerSeason: boolean;
  considerWeather: boolean;
  considerTimeOfDay: boolean;
  mixNewTracks: boolean;
  excludeRecentlyPlayed: boolean;
  preventArtistBias: boolean;
  randomnessEnabled: boolean;
  trackCount: number;
  maxTracksPerArtist: number;
  randomnessPercent: number;
};

export type Profile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  youtubeChannelId: string | null;
  onboardingCompleted: boolean;
  favoriteArtists: string[];
  favoriteGenres: string[];
  preferences: UserPreferences;
  plan: "free" | "premium";
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  considerSeason: false,
  considerWeather: false,
  considerTimeOfDay: false,
  mixNewTracks: false,
  excludeRecentlyPlayed: false,
  preventArtistBias: true,
  randomnessEnabled: true,
  trackCount: 100,
  maxTracksPerArtist: 5,
  randomnessPercent: 30,
};
