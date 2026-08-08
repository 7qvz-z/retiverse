"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ENVIRONMENTS } from "@/lib/constants";
import type { EnvironmentTag } from "@/lib/types";
import {
  seasonFromDate,
  timeOfDayFromDate,
  type WeatherSnapshot,
} from "@/lib/weather";

type Props = {
  considerWeather: boolean;
  considerSeason: boolean;
  considerTimeOfDay: boolean;
  onApply: (tags: EnvironmentTag[], weather: WeatherSnapshot | null) => void;
};

type Status = "idle" | "locating" | "loading" | "ready" | "denied" | "error";

export function ContextHints({
  considerWeather,
  considerSeason,
  considerTimeOfDay,
  onApply,
}: Props) {
  const enabled = considerWeather || considerSeason || considerTimeOfDay;
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [suggested, setSuggested] = useState<EnvironmentTag[]>([]);

  const buildSuggestions = useCallback(
    (weatherSnap: WeatherSnapshot | null) => {
      const tags: EnvironmentTag[] = [];
      if (considerWeather && weatherSnap) tags.push(weatherSnap.environment);
      if (considerSeason) tags.push(seasonFromDate());
      if (considerTimeOfDay) tags.push(timeOfDayFromDate());
      return [...new Set(tags)];
    },
    [considerWeather, considerSeason, considerTimeOfDay],
  );

  const detect = useCallback(async () => {
    if (!enabled) return;

    setMessage(null);
    let weatherSnap: WeatherSnapshot | null = null;

    if (considerWeather) {
      if (!navigator.geolocation) {
        setStatus("error");
        setMessage("このブラウザでは位置情報を使えません");
        const tags = buildSuggestions(null);
        setSuggested(tags);
        onApply(tags, null);
        return;
      }

      setStatus("locating");
      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 12000,
              maximumAge: 10 * 60 * 1000,
            });
          },
        );

        setStatus("loading");
        const res = await fetch(
          `/api/weather?lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
        );
        const data = (await res.json()) as WeatherSnapshot & { error?: string };
        if (!res.ok) {
          throw new Error(data.error ?? "天気の取得に失敗しました");
        }
        weatherSnap = data;
        setWeather(data);
      } catch (error) {
        const geoError = error as GeolocationPositionError;
        if (geoError?.code === 1) {
          setStatus("denied");
          setMessage("位置情報の許可が必要です（設定の「天気を考慮」用）");
        } else {
          setStatus("error");
          setMessage(
            error instanceof Error ? error.message : "天気の取得に失敗しました",
          );
        }
      }
    }

    const tags = buildSuggestions(weatherSnap);
    setSuggested(tags);
    setStatus((prev) =>
      prev === "denied" || prev === "error" ? prev : "ready",
    );
    onApply(tags, weatherSnap);
  }, [enabled, considerWeather, buildSuggestions, onApply]);

  useEffect(() => {
    if (!enabled) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- weather detect on enable
    void detect();
  }, [enabled, detect]);

  if (!enabled) {
    return (
      <p className="text-xs text-[#e8dfd0]/45">
        天気・季節・時間帯の自動反映は設定で ON にできます。
        <Link href="/settings" className="ml-1 underline underline-offset-2">
          設定を開く
        </Link>
      </p>
    );
  }

  const labelText = suggested
    .map((id) => ENVIRONMENTS.find((e) => e.id === id)?.label ?? id)
    .join("・");

  return (
    <div className="rounded-2xl border border-[#e8dfd0]/10 bg-[#14161c]/85 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-[#e8dfd0]/80">いまの環境（自動）</p>
        <button
          type="button"
          onClick={() => void detect()}
          className="text-xs text-[#c9a66b] underline-offset-2 hover:underline"
        >
          再取得
        </button>
      </div>

      {status === "locating" || status === "loading" ? (
        <p className="mt-2 text-xs text-[#e8dfd0]/50">
          {status === "locating"
            ? "位置情報を取得中…"
            : "天気を取得中…"}
        </p>
      ) : null}

      {weather ? (
        <p className="mt-2 text-[#e8dfd0]/70">
          {weather.label} {Math.round(weather.temperatureC)}℃
        </p>
      ) : null}

      {suggested.length > 0 ? (
        <p className="mt-1 text-xs text-[#e8dfd0]/55">
          反映候補: {labelText}（環境チップに自動選択済み。手動で外せます）
        </p>
      ) : null}

      {message ? (
        <p className="mt-2 text-xs text-[#b42318]" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}
