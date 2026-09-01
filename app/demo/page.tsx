import Link from "next/link";

export default function Demo() {
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#dbeaf4]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-sky-200 bg-white/90 px-4 text-sm backdrop-blur sm:px-6">
        <Link href="/" className="font-semibold text-slate-700 transition hover:text-sky-600">
          ← QnFP Lab
        </Link>
        <span className="text-slate-500">보물찾기 · 시연</span>
      </header>
      <iframe
        title="보물찾기 시연"
        src="/treasure-hunt/index.html"
        className="min-h-0 flex-1 border-0"
        allow="fullscreen"
      />
    </main>
  );
}
