import Link from "next/link";

export default function TreasureHunt() {
  return (
    <main className="flex h-screen flex-col bg-[#c6d8e5]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b-2 border-slate-800 bg-[#f8edcf] px-4 text-sm sm:px-6">
        <Link href="/" className="font-semibold text-slate-800 transition hover:text-slate-500">
          ← QnFP Lab
        </Link>
        <span className="text-slate-600">보물찾기 · 테스트 시연</span>
      </header>
      <iframe
        title="보물찾기 게임"
        src="/treasure-hunt/index.html"
        className="min-h-0 flex-1 border-0"
        allow="fullscreen"
      />
    </main>
  );
}
