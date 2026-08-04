import type { EnvironmentTag, Mood } from "@/lib/types";

export const APP_NAME = "リテイバース";
export const APP_CATCHCOPY = "いまのあなただけにあったプレイリストを自動生成";

export const MOODS: { id: Mood; label: string; emoji: string }[] = [
  { id: "energetic", label: "元気", emoji: "😊" },
  { id: "want_to_cry", label: "泣きたい", emoji: "😭" },
  { id: "relax", label: "リラックス", emoji: "😌" },
  { id: "drive", label: "ドライブ", emoji: "🚗" },
  { id: "study", label: "勉強", emoji: "📚" },
  { id: "game", label: "ゲーム", emoji: "🎮" },
  { id: "workout", label: "筋トレ", emoji: "💪" },
  { id: "angry", label: "怒り", emoji: "😡" },
  { id: "hype", label: "テンションを上げたい", emoji: "⚡" },
  { id: "before_sleep", label: "寝る前", emoji: "😴" },
];

export const ENVIRONMENTS: { id: EnvironmentTag; label: string; emoji: string }[] =
  [
    { id: "sunny", label: "晴れ", emoji: "☀" },
    { id: "rainy", label: "雨", emoji: "☔" },
    { id: "spring", label: "春", emoji: "🌸" },
    { id: "summer", label: "夏", emoji: "🌻" },
    { id: "autumn", label: "秋", emoji: "🍁" },
    { id: "winter", label: "冬", emoji: "❄" },
    { id: "night", label: "夜", emoji: "🌙" },
  ];

export const TRACK_COUNT = { min: 10, max: 300, default: 100 } as const;
export const ARTIST_MAX_TRACKS = { min: 5, max: 100, default: 5 } as const;
export const RANDOMNESS_STEP = 5;
