import { NextResponse } from "next/server";
import { analyzeOtherNote } from "@/lib/note-analysis";
import { mapProfile, type ProfileRow } from "@/lib/profile";
import { generateTrackList } from "@/lib/playlist/generate";
import { isEnvironment, isMood, filterEnvironmentsByPreferences } from "@/lib/home";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import { TRACK_COUNT, APP_NAME } from "@/lib/constants";
import { getYouTubeAccessToken } from "@/lib/youtube/auth";

type Body = {
  moods?: string[];
  environments?: string[];
  note?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const moods = (body.moods ?? []).filter(isMood);
  const environments = (body.environments ?? []).filter(isEnvironment);
  const note = body.note?.trim() ?? "";

  if (moods.length === 0 && !note) {
    return NextResponse.json(
      { error: "気分またはその他の内容が必要です" },
      { status: 400 },
    );
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileRow ? mapProfile(profileRow as ProfileRow) : null;
  const preferences = profile?.preferences ?? DEFAULT_PREFERENCES;

  // 「最近聴いた曲を除外」が ON のときだけ履歴・再生を除外する
  // （常時除外だと同じ人気曲が弾かれて「曲が見つからない」になりやすい）
  const excludeVideoIds: string[] = [];
  if (preferences.excludeRecentlyPlayed) {
    const { data: historyRows } = await supabase
      .from("playlist_generations")
      .select("track_ids")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    for (const row of historyRows ?? []) {
      excludeVideoIds.push(
        ...((row as { track_ids: string[] | null }).track_ids ?? []),
      );
    }

    const { data: playEvents } = await supabase
      .from("track_events")
      .select("youtube_video_id")
      .eq("user_id", session.user.id)
      .eq("event_type", "play")
      .order("created_at", { ascending: false })
      .limit(100);

    for (const event of playEvents ?? []) {
      excludeVideoIds.push(
        (event as { youtube_video_id: string }).youtube_video_id,
      );
    }
  }

  const noteAnalysis = note ? analyzeOtherNote(note) : null;
  const mergedMoods = [
    ...new Set([...(moods ?? []), ...(noteAnalysis?.moods ?? [])]),
  ];
  const mergedEnvs = filterEnvironmentsByPreferences(
    [
      ...new Set([
        ...(environments ?? []),
        ...(noteAnalysis?.environments ?? []),
      ]),
    ],
    preferences,
  );

  let accessToken: string | null = null;
  try {
    accessToken = await getYouTubeAccessToken(supabase, session);
  } catch {
    accessToken = null;
  }
  const apiKey = process.env.YOUTUBE_API_KEY ?? null;

  if (!accessToken && !apiKey) {
    return NextResponse.json(
      {
        error:
          "YouTube 連携が必要です。下の「YouTube連携する」を押して、許可画面で YouTube へのアクセスを許可してください。",
        needsYouTubeConnect: true,
      },
      { status: 400 },
    );
  }

  try {
    const { tracks, queriesUsed } = await generateTrackList({
      artists: profile?.favoriteArtists ?? [],
      genres: profile?.favoriteGenres ?? [],
      moods: mergedMoods,
      environments: mergedEnvs,
      noteKeywords: noteAnalysis?.unmatchedKeywords ?? [],
      preferences: {
        ...preferences,
        trackCount: Math.min(
          preferences.trackCount || TRACK_COUNT.default,
          TRACK_COUNT.max,
        ),
      },
      excludeVideoIds: [...new Set(excludeVideoIds)],
      accessToken,
      apiKey,
      userId: session.user.id,
    });

    if (tracks.length === 0) {
      const hasTaste =
        (profile?.favoriteArtists.length ?? 0) > 0 ||
        (profile?.favoriteGenres.length ?? 0) > 0;
      return NextResponse.json(
        {
          error: hasTaste
            ? "条件に合う曲が見つかりませんでした。気分を変えるか、しばらくしてから再試行してください。YouTube API の枠不足の可能性もあります。"
            : "曲を見つけられませんでした。設定の「あなたの音楽スタイル」でアーティスト／ジャンルを追加してから再試行してください。",
          queriesUsed,
        },
        { status: 404 },
      );
    }

    const titleBase =
      mergedMoods.length > 0
        ? mergedMoods.join("-")
        : "custom";
    const title = `${APP_NAME} ${titleBase} ${new Date().toLocaleDateString("ja-JP")}`;

    const { data: saved, error: saveError } = await supabase
      .from("playlist_generations")
      .insert({
        user_id: session.user.id,
        mood: mergedMoods.join(",") || null,
        environments: mergedEnvs,
        track_ids: tracks.map((t) => t.videoId),
        title,
        is_favorite: false,
      })
      .select("id")
      .single();

    if (saveError) {
      // 履歴保存失敗でもプレビューは返す
      console.error(saveError);
    }

    return NextResponse.json({
      generationId: saved?.id ?? null,
      title,
      tracks,
      queriesUsed,
      excludedCount: excludeVideoIds.length,
    });
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : "プレイリスト生成に失敗しました";
    const { mapYouTubeApiErrorMessage } = await import("@/lib/setup-options");
    const mapped = mapYouTubeApiErrorMessage(raw);
    return NextResponse.json(
      {
        error: mapped,
        needsYouTubeConnect:
          mapped !== raw ||
          /insufficient|scope|権限|連携|トークン/i.test(mapped),
      },
      { status: 502 },
    );
  }
}
