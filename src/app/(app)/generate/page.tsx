import Link from "next/link";
import {
  environmentLabels,
  isEnvironment,
  isMood,
  moodLabels,
} from "@/lib/home";
import { analyzeOtherNote, describeAnalysis } from "@/lib/note-analysis";

type SearchParams = Promise<{
  mood?: string;
  moods?: string;
  environments?: string;
  note?: string;
}>;

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const moodsFromList = (params.moods ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(isMood);
  const legacyMood =
    params.mood && isMood(params.mood) ? [params.mood] : [];
  const moods = moodsFromList.length > 0 ? moodsFromList : legacyMood;

  const environments = (params.environments ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(isEnvironment);

  const note = params.note?.trim() ?? "";
  const noteAnalysis = note ? analyzeOtherNote(note) : null;

  const hasSelection = moods.length > 0 || note.length > 0;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        プレイリスト生成
      </h1>

      {hasSelection ? (
        <div className="mt-4 space-y-2 text-[#1a1612]/70">
          {moods.length > 0 ? (
            <p>気分: {moodLabels(moods)}</p>
          ) : null}
          {environments.length > 0 ? (
            <p>環境: {environmentLabels(environments)}</p>
          ) : null}
          {note ? <p>その他: {note}</p> : null}
          {noteAnalysis ? (
            <p className="text-sm text-[#1f4f4b]">
              解析: {describeAnalysis(noteAnalysis)}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-[#1a1612]/70">
          気分が選ばれていません。ホームから選び直してください。
        </p>
      )}

      <p className="mt-6 text-sm text-[#1a1612]/55">
        生成中表示・プレビュー・YouTube 追加は次の画面実装で追加します。
      </p>

      <Link
        href="/"
        className="mt-8 inline-block text-sm text-[#2a6f6a] underline-offset-2 hover:underline"
      >
        ホームに戻る
      </Link>
    </main>
  );
}
