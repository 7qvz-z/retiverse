import { MOODS, ENVIRONMENTS } from "@/lib/constants";
import type { EnvironmentTag, Mood } from "@/lib/types";

export type GenerationSummary = {
  id: string;
  mood: string | null;
  environments: string[];
  title: string | null;
  youtubePlaylistId: string | null;
  isFavorite: boolean;
  createdAt: string;
  trackCount: number;
};

export function moodLabel(mood: string | null): string {
  if (!mood) return "気分なし";
  return MOODS.find((m) => m.id === mood)?.label ?? mood;
}

export function moodEmoji(mood: string | null): string {
  if (!mood) return "🎵";
  return MOODS.find((m) => m.id === mood)?.emoji ?? "🎵";
}

export function environmentLabels(envs: string[]): string {
  if (envs.length === 0) return "";
  return envs
    .map(
      (id) =>
        ENVIRONMENTS.find((e) => e.id === id)?.label ?? id,
    )
    .join("・");
}

export function isMood(value: string): value is Mood {
  return MOODS.some((m) => m.id === value);
}

export function isEnvironment(value: string): value is EnvironmentTag {
  return ENVIRONMENTS.some((e) => e.id === value);
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}
