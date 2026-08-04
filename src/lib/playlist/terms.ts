import type { EnvironmentTag, Mood } from "@/lib/types";

export const MOOD_SEARCH_TERMS: Record<Mood, string[]> = {
  energetic: ["元気が出る曲", "アップテンポ", "明るい曲"],
  want_to_cry: ["泣ける曲", "バラード", "切ない曲"],
  relax: ["リラックス音楽", "チルアウト", "癒しの曲"],
  drive: ["ドライブソング", "車で聴きたい曲", "ロードトリップ"],
  study: ["勉強用BGM", "集中できる曲", "作業用音楽"],
  game: ["ゲーム実況BGM", "ゲーミングミュージック"],
  workout: ["筋トレBGM", "ワークアウトミュージック", "ランニングソング"],
  angry: ["激しい曲", "ロック 激しめ", "怒り 解放"],
  hype: ["テンション上がる曲", "パーティーソング", "盛り上がる曲"],
  before_sleep: ["眠れる音楽", "寝る前に聴きたい曲", "安眠BGM"],
};

export const ENV_SEARCH_TERMS: Record<EnvironmentTag, string[]> = {
  sunny: ["晴れの日の曲", "青空"],
  cloudy: ["曇りの日の曲", "落ち着いた曲"],
  rainy: ["雨の日の曲", "雨音 音楽"],
  snow: ["雪の日の曲", "冬ソング"],
  morning: ["朝に聴きたい曲", "モーニングソング"],
  daytime: ["昼間に聴きたい曲", "昼のBGM"],
  night: ["夜に聴きたい曲", "ナイトミュージック"],
  spring: ["春の曲", "桜ソング"],
  summer: ["夏の曲", "夏フェス"],
  autumn: ["秋の曲", "秋うた"],
  winter: ["冬の曲", "ウィンターソング"],
};

export type TrackCandidate = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  query: string;
};
