import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Body = {
  artists?: string[];
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const toAdd = [...new Set((body.artists ?? []).map((a) => a.trim()).filter(Boolean))];
  if (toAdd.length === 0) {
    return NextResponse.json(
      { error: "追加するアーティストを選んでください" },
      { status: 400 },
    );
  }

  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("favorite_artists")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    return NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const current =
    (profile as { favorite_artists?: string[] } | null)?.favorite_artists ?? [];
  const favoriteArtists = [...new Set([...current, ...toAdd])];

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      favorite_artists: favoriteArtists,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("preference_change_logs").insert({
    user_id: user.id,
    changes: {
      favorite_artists: { from: current, to: favoriteArtists },
      source: "playlist_analysis_select",
    },
  });

  return NextResponse.json({
    favoriteArtists,
    addedCount: favoriteArtists.length - current.length,
  });
}
