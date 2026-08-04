import { NextResponse } from "next/server";
import { analyzeOtherNote } from "@/lib/note-analysis";
import { mapProfile, type ProfileRow } from "@/lib/profile";
import { generateTrackList } from "@/lib/playlist/generate";
import { isEnvironment, isMood } from "@/lib/home";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import { TRACK_COUNT } from "@/lib/constants";

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

  // 無料プランでも重複回避
  const { data: historyRows } = await supabase
    .from("playlist_generations")
    .select("track_ids")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const excludeVideoIds = [
    ...new Set(
      (historyRows ?? []).flatMap(
        (row: { track_ids: string[] | null }) => row.track_ids ?? [],
      ),
    ),
  ];

  if (preferences.excludeRecentlyPlayed) {
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
  const mergedEnvs = [
    ...new Set([...(environments ?? []), ...(noteAnalysis?.environments ?? [])]),
  ];

  const accessToken = session.provider_token ?? null;
  const apiKey = process.env.YOUTUBE_API_KEY ?? null;

  if (!accessToken && !apiKey) {
    return NextResponse.json(
      {
        error:
          "YouTube API を使える状態ではありません。初回設定で YouTube 連携し直すか、YOUTUBE_API_KEY を設定してください。",
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
    });

    if (tracks.length === 0) {
      return NextResponse.json(
        {
          error:
            "曲を見つけられませんでした。アーティスト／ジャンルを増やすか、気分を変えて再試行してください。",
          queriesUsed,
        },
        { status: 404 },
      );
    }

    const titleBase =
      mergedMoods.length > 0
        ? mergedMoods.join("-")
        : "custom";
    const title = `リテイバース ${titleBase} ${new Date().toLocaleDateString("ja-JP")}`;

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
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "プレイリスト生成に失敗しました",
      },
      { status: 502 },
    );
  }
}
