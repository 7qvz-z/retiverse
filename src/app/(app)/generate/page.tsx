import Link from "next/link";
import {
  environmentLabels,
  isEnvironment,
  isMood,
  moodLabel,
} from "@/lib/home";

type SearchParams = Promise<{
  mood?: string;
  environments?: string;
}>;

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const mood = params.mood && isMood(params.mood) ? params.mood : null;
  const environments = (params.environments ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(isEnvironment);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">
        プレイリスト生成
      </h1>

      {mood ? (
        <p className="mt-4 text-[#1a1612]/70">
          選択中: {moodLabel(mood)}
          {environments.length > 0
            ? ` × ${environmentLabels(environments)}`
            : ""}
        </p>
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
