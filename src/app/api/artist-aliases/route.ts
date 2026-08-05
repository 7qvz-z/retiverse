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

  try {
    const dictionary = await appendAliasMerge({ canonical, mergeFrom });
    return NextResponse.json({
      ok: true,
      canonical,
      mergeFrom,
      aliases: dictionary[canonical] ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "エイリアス辞書の更新に失敗しました",
      },
      { status: 500 },
    );
  }
}
