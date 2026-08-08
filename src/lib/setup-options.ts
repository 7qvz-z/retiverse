export const GENRE_OPTIONS = [
  "J-POP",
  "アニソン",
  "ボカロ",
  "シティポップ",
  "ロック",
  "ヒップホップ",
  "R&B / ソウル",
  "ジャズ",
  "クラシック",
  "エレクトロニック",
  "K-POP",
  "メタル",
  "フォーク / アコースティック",
  "インストゥルメンタル",
  "アイドル",
  "その他",
] as const;

export const SETUP_TOGGLE_FIELDS = [
  {
    key: "considerSeason",
    label: "季節を考慮",
    description: "今の季節に合いそうな曲を少し多めにします",
  },
  {
    key: "considerWeather",
    label: "天気を考慮",
    description: "位置情報から天気を取得し、おすすめに反映します",
  },
  {
    key: "considerTimeOfDay",
    label: "時間帯を考慮",
    description: "朝・昼・夜など、いまの時間帯を軽く反映します",
  },
  {
    key: "mixNewTracks",
    label: "新しい曲を混ぜる",
    description: "知らない曲もプレイリストに含めます",
  },
  {
    key: "excludeRecentlyPlayed",
    label: "最近聴いた曲を除外",
    description: "直近で聴いた曲を生成から外します",
  },
  {
    key: "preventArtistBias",
    label: "アーティスト偏り防止",
    description: "同じアーティストばかりにならないようにします",
  },
  {
    key: "randomnessEnabled",
    label: "ランダム性",
    description: "毎回まったく同じ並びになりにくくします",
  },
] as const;

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.force-ssl",
].join(" ");

export const INSUFFICIENT_YOUTUBE_SCOPES_MESSAGE =
  "YouTube への権限が不足しています。「YouTube連携する」を押して、許可画面で YouTube へのアクセスを許可してください。";

export function mapYouTubeApiErrorMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("insufficient") ||
    lower.includes("scope") ||
    lower.includes("insufficientpermissions")
  ) {
    return INSUFFICIENT_YOUTUBE_SCOPES_MESSAGE;
  }
  return message;
}
