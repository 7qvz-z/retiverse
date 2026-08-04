import { NextResponse } from "next/server";
import { isEnvironment, isMood } from "@/lib/home";
import { mapProfile, type ProfileRow } from "@/lib/profile";
import { findReplacementTrack } from "@/lib/playlist/generate";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFERENCES } from "@/lib/types";

type Body = {
  seedQuery?: string;
  excludeVideoIds?: string[];
  moods?: string[];
  environments?: string[];
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
  const excludeVideoIds = body.excludeVideoIds ?? [];
  const moods = (body.moods ?? []).filter(isMood);
  const environments = (body.environments ?? []).filter(isEnvironment);
  const seedQuery = body.seedQuery?.trim() || "おすすめ 曲";

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  const profile = profileRow ? mapProfile(profileRow as ProfileRow) : null;

  try {
    const track = await findReplacementTrack({
      artists: profile?.favoriteArtists ?? [],
      genres: profile?.favoriteGenres ?? [],
      moods,
      environments,
      noteKeywords: [],
      preferences: profile?.preferences ?? DEFAULT_PREFERENCES,
      excludeVideoIds,
      accessToken: session.provider_token ?? null,
      apiKey: process.env.YOUTUBE_API_KEY ?? null,
      seedQuery,
    });

    if (!track) {
      return NextResponse.json(
        { error: "差し替え曲が見つかりませんでした" },
        { status: 404 },
      );
    }

    return NextResponse.json({ track });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "差し替えに失敗しました",
      },
      { status: 502 },
    );
  }
}
