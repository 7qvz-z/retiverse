import { ENVIRONMENTS, MOODS } from "@/lib/constants";
import type { EnvironmentTag, Mood } from "@/lib/types";

export type NoteAnalysis = {
  moods: Mood[];
  environments: EnvironmentTag[];
  unmatchedKeywords: string[];
};

const MOOD_KEYWORDS: { mood: Mood; keywords: string[] }[] = [
  {
    mood: "energetic",
    keywords: ["元気", "ハッピー", "楽しい", "うれしい", "明るい", "爽快"],
  },
  {
    mood: "want_to_cry",
    keywords: ["泣", "悲しい", "切ない", "寂しい", "しんみり", "うるうる"],
  },
  {
    mood: "relax",
    keywords: ["リラックス", "落ち着", "癒し", "のんびり", "穏やか", "チル"],
  },
  {
    mood: "drive",
    keywords: ["ドライブ", "車", "ツーリング", "走行", "高速"],
  },
  {
    mood: "study",
    keywords: ["勉強", "作業", "集中", "仕事", "デスク", "学習"],
  },
  {
    mood: "game",
    keywords: ["ゲーム", "プレイ", "配信", "eスポーツ"],
  },
  {
    mood: "workout",
    keywords: ["筋トレ", "運動", "ジム", "ランニング", "トレーニング", "ワークアウト"],
  },
  {
    mood: "angry",
    keywords: ["怒", "イライラ", "むかつ", "激昂"],
  },
  {
    mood: "hype",
    keywords: ["テンション", "盛り上", "アゲ", "ハイテンション", "ノリノリ"],
  },
  {
    mood: "before_sleep",
    keywords: ["寝る前", "眠", "就寝", "おやすみ", "ベッド"],
  },
];

const ENV_KEYWORDS: { env: EnvironmentTag; keywords: string[] }[] = [
  { env: "sunny", keywords: ["晴れ", "快晴", "晴天", "日差し", "青空"] },
  { env: "cloudy", keywords: ["曇", "くもり", "どんより"] },
  { env: "rainy", keywords: ["雨", "しとしと", "びしょ", "傘"] },
  { env: "snow", keywords: ["雪", "吹雪", "粉雪", "積雪"] },
  { env: "morning", keywords: ["朝", "モーニング", "早朝", "起床", "あさ"] },
  { env: "daytime", keywords: ["昼", "午後", "昼間", "ランチ", "ひる"] },
  { env: "night", keywords: ["夜", "深夜", "宵", "よる", "ナイト"] },
  { env: "spring", keywords: ["春", "桜", "花見"] },
  { env: "summer", keywords: ["夏", "海", "花火", "猛暑"] },
  { env: "autumn", keywords: ["秋", "紅葉", "落ち葉"] },
  { env: "winter", keywords: ["冬", "こたつ", "年末"] },
];

/** 「その他」自由記述から気分・環境キーワードを抽出する */
export function analyzeOtherNote(text: string): NoteAnalysis {
  const normalized = text.trim();
  if (!normalized) {
    return { moods: [], environments: [], unmatchedKeywords: [] };
  }

  const moods: Mood[] = [];
  const environments: EnvironmentTag[] = [];
  const hitSpans: string[] = [];

  for (const rule of MOOD_KEYWORDS) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword)) {
        if (!moods.includes(rule.mood)) moods.push(rule.mood);
        hitSpans.push(keyword);
      }
    }
  }

  for (const rule of ENV_KEYWORDS) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword)) {
        if (!environments.includes(rule.env)) environments.push(rule.env);
        hitSpans.push(keyword);
      }
    }
  }

  // ヒットしなかった断片をざっくり残す（生成時のヒント用）
  let remainder = normalized;
  for (const hit of hitSpans) {
    remainder = remainder.split(hit).join(" ");
  }
  const unmatchedKeywords = remainder
    .split(/[\s、,。・!！?？]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);

  return {
    moods,
    environments,
    unmatchedKeywords: [...new Set(unmatchedKeywords)],
  };
}

export function describeAnalysis(analysis: NoteAnalysis): string {
  const parts: string[] = [];
  if (analysis.moods.length > 0) {
    parts.push(
      `気分: ${analysis.moods.map((id) => MOODS.find((m) => m.id === id)?.label ?? id).join("・")}`,
    );
  }
  if (analysis.environments.length > 0) {
    parts.push(
      `環境: ${analysis.environments
        .map((id) => ENVIRONMENTS.find((e) => e.id === id)?.label ?? id)
        .join("・")}`,
    );
  }
  if (analysis.unmatchedKeywords.length > 0) {
    parts.push(`その他キーワード: ${analysis.unmatchedKeywords.join("・")}`);
  }
  return parts.join(" / ") || "キーワードを検出できませんでした";
}
