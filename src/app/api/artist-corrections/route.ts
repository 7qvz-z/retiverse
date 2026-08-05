import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ArtistCorrectionKind } from "@/lib/artist-extract/corrections";

type Body = {
  kind?: ArtistCorrectionKind;
  rawName?: string;
  canonicalName?: string | null;
  splitInto?: string[];
  sourceTitle?: string | null;
  sourceChannel?: string | null;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("artist_corrections")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ corrections: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const body = (await request.json()) as Body;
  const kind = body.kind;
  const rawName = body.rawName?.trim() ?? "";

  if (!kind || !rawName) {
    return NextResponse.json(
      { error: "kind と rawName が必要です" },
      { status: 400 },
    );
  }

  const allowed: ArtistCorrectionKind[] = [
    "alias",
    "reject",
    "rename",
    "confirm",
    "split",
  ];
  if (!allowed.includes(kind)) {
    return NextResponse.json({ error: "不正な kind です" }, { status: 400 });
  }

  if ((kind === "alias" || kind === "rename") && !body.canonicalName?.trim()) {
    return NextResponse.json(
      { error: "canonicalName が必要です" },
      { status: 400 },
    );
  }
  if (kind === "split" && (!body.splitInto || body.splitInto.length < 2)) {
    return NextResponse.json(
      { error: "splitInto に2つ以上の名前が必要です" },
      { status: 400 },
    );
  }

  const row = {
    user_id: session.user.id,
    kind,
    raw_name: rawName,
    canonical_name:
      kind === "reject" ? null : (body.canonicalName?.trim() ?? rawName),
    split_into:
      kind === "split"
        ? (body.splitInto ?? []).map((s) => s.trim()).filter(Boolean)
        : [],
    source_title: body.sourceTitle ?? null,
    source_channel: body.sourceChannel ?? null,
  };

  const { data, error } = await supabase
    .from("artist_corrections")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    // テーブル未作成時のヒント
    if (
      error.message.includes("artist_corrections") ||
      error.code === "PGRST205" ||
      error.code === "42P01"
    ) {
      return NextResponse.json(
        {
          error:
            "artist_corrections テーブルがありません。supabase/migrations/20260805000000_artist_corrections.sql を SQL Editor で実行してください。",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ correction: data });
}
