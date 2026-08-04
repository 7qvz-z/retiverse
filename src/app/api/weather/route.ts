import { NextResponse } from "next/server";
import { fetchWeather } from "@/lib/weather";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json(
      { error: "lat と lon が必要です" },
      { status: 400 },
    );
  }

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return NextResponse.json(
      { error: "緯度経度の範囲が不正です" },
      { status: 400 },
    );
  }

  try {
    const weather = await fetchWeather(lat, lon);
    return NextResponse.json(weather);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "天気の取得に失敗しました",
      },
      { status: 502 },
    );
  }
}
