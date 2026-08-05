import { NextResponse } from "next/server";
import { appendAliasMerge } from "@/lib/artist-extract/alias-io";
import { createClient } from "@/lib/supabase/server";

type Body = {
  canonical?: string;
  mergeFrom?: string;
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
  const canonical = body.canonical?.trim() ?? "";
  const mergeFrom = body.mergeFrom?.trim() ?? "";

  if (!canonical || !mergeFrom) {
    return NextResponse.json(
      { error: "canonical と mergeFrom が必要です" },
      { status: 400 },
    );
  }
  if (canonical === mergeFrom) {
    return NextResponse.json(
      { error: "同じ名前同士は統合できません" },
      { status: 400 },
    );
  }

  // ユーザー単位で DB に永続化（本番FSは読み取り専用のためこちらが正）
  const { error: insertError } = await supabase.from("artist_corrections").insert({
    user_id: session.user.id,
    kind: "alias",
    raw_name: mergeFrom,
    canonical_name: canonical,
    split_into: [],
  });

  if (insertError) {
    if (
      insertError.message.includes("artist_corrections") ||
      insertError.code === "PGRST205" ||
      insertError.code === "42P01"
    ) {
      return NextResponse.json(
        {
          error:
            "artist_corrections テーブルがありません。supabase/migrations/20260805000000_artist_corrections.sql を SQL Editor で実行してください。",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // ローカル開発向け: 共有辞書ファイルへの追記はベストエフォート
  let aliases: string[] = [mergeFrom];
  try {
    const dictionary = await appendAliasMerge({ canonical, mergeFrom });
    aliases = dictionary[canonical] ?? aliases;
  } catch {
    // ignore fs errors (Vercel 等)
  }

  return NextResponse.json({
    ok: true,
    canonical,
    mergeFrom,
    aliases,
  });
}
