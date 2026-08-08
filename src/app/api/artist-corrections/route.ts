import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ArtistCorrectionKind } from "@/lib/artist-extract/corrections";
import { isMissingRelationError } from "@/lib/supabase/migration-hints";

type Body = {
  kind?: ArtistCorrectionKind;
  rawName?: string;
  canonicalName?: string | null;
  splitInto?: string[];
  sourceTitle?: string | null;
  sourceChannel?: string | null;
};

const MISSING_TABLE_ERROR =
  "artist_corrections テーブルがありません。supabase/migrations/20260805000000_artist_corrections.sql を SQL Editor で実行してください。";

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
    if (isMissingRelationError(error, "artist_corrections")) {
      return NextResponse.json({ error: MISSING_TABLE_ERROR }, { status: 500 });
    }
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
    if (isMissingRelationError(error, "artist_corrections")) {
      return NextResponse.json({ error: MISSING_TABLE_ERROR }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ correction: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let id = "";
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { id?: string };
    id = body.id?.trim() ?? "";
  }
  if (!id) {
    id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  }
  if (!id) {
    return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  }

  const { error } = await supabase
    .from("artist_corrections")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    if (isMissingRelationError(error, "artist_corrections")) {
      return NextResponse.json({ error: MISSING_TABLE_ERROR }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
