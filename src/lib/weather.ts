import type { EnvironmentTag } from "@/lib/types";

export type WeatherSnapshot = {
  weatherCode: number;
  temperatureC: number;
  label: string;
  environment: EnvironmentTag;
  latitude: number;
  longitude: number;
};

/** WMO Weather interpretation codes → 環境タグ */
export function weatherCodeToEnvironment(code: number): EnvironmentTag {
  if (code === 0 || code === 1) return "sunny";
  if (code === 2 || code === 3 || code === 45 || code === 48) return "cloudy";
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82) ||
    (code >= 95 && code <= 99)
  ) {
    return "rainy";
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return "snow";
  }
  return "cloudy";
}

export function weatherCodeToLabel(code: number): string {
  if (code === 0) return "快晴";
  if (code === 1) return "晴れ";
  if (code === 2) return "一部曇り";
  if (code === 3) return "曇り";
  if (code === 45 || code === 48) return "霧";
  if (code >= 51 && code <= 55) return "霧雨";
  if (code >= 56 && code <= 57) return "着氷性の霧雨";
  if (code >= 61 && code <= 65) return "雨";
  if (code >= 66 && code <= 67) return "着氷性の雨";
  if (code >= 71 && code <= 75) return "雪";
  if (code === 77) return "霧雪";
  if (code >= 80 && code <= 82) return "にわか雨";
  if (code === 85 || code === 86) return "にわか雪";
  if (code >= 95 && code <= 99) return "雷雨";
  return "不明";
}

type OpenMeteoCurrent = {
  weather_code?: number;
  temperature_2m?: number;
};

type OpenMeteoResponse = {
  current?: OpenMeteoCurrent;
  error?: boolean;
  reason?: string;
};

export async function fetchWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "weather_code,temperature_2m",
    timezone: "auto",
  });

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
    { cache: "no-store" },
  );

  const data = (await res.json()) as OpenMeteoResponse;
  if (!res.ok || data.error) {
    throw new Error(data.reason ?? "天気の取得に失敗しました");
  }

  const code = data.current?.weather_code ?? 3;
  const temperatureC = data.current?.temperature_2m ?? 0;

  return {
    weatherCode: code,
    temperatureC,
    label: weatherCodeToLabel(code),
    environment: weatherCodeToEnvironment(code),
    latitude,
    longitude,
  };
}

export function seasonFromDate(date = new Date()): EnvironmentTag {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function timeOfDayFromDate(date = new Date()): EnvironmentTag {
  const hour = date.getHours();
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "daytime";
  return "night";
}
