import Link from "next/link";
import { GenerateWorkspace } from "@/components/generate/GenerateWorkspace";
import { isEnvironment, isMood } from "@/lib/home";
import { analyzeOtherNote, describeAnalysis } from "@/lib/note-analysis";

type SearchParams = Promise<{
  mood?: string;
  moods?: string;
  environments?: string;
  note?: string;
  weather?: string;
  weatherLabel?: string;
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

      {!hasSelection ? (
        <div className="mt-6 space-y-4">
          <p className="text-[#1a1612]/70">
            気分が選ばれていません。ホームから選び直してください。
          </p>
          <Link
            href="/"
            className="inline-block text-sm text-[#2a6f6a] underline-offset-2 hover:underline"
          >
            ホームに戻る
          </Link>
        </div>
      ) : (
        <div className="mt-8">
          <GenerateWorkspace
            moods={moods}
            environments={environments}
            note={note}
            weatherLabel={params.weatherLabel?.trim() || null}
            analysisText={
              noteAnalysis ? describeAnalysis(noteAnalysis) : null
            }
          />
        </div>
      )}
    </main>
  );
}
