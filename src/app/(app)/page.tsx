import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="font-[family-name:var(--font-display)] text-4xl">ホーム</h1>
      <p className="mt-3 text-[#1a1612]/70">
        気分・環境の選択とプレイリスト生成は次の画面実装で追加します。
      </p>
      <Link
        href="/generate"
        className="mt-8 inline-block rounded-full bg-[#1a1612] px-6 py-3 text-sm text-[#f4f0e8]"
      >
        プレイリスト生成へ（仮）
      </Link>
    </main>
  );
}
