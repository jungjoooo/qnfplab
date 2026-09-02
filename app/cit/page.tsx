import Link from "next/link";
import CitClient from "./cit-client";

export default function CitPage() {
  return (
    <main className="min-h-screen bg-[#e8edf0] text-slate-800">
      <header className="flex h-12 items-center justify-between border-b border-slate-300 bg-white px-4 text-sm sm:px-6">
        <Link href="/odyssey" className="font-semibold text-slate-600 transition hover:text-slate-900">← 보물찾기로 돌아가기</Link>
        <span className="font-medium text-slate-500">CIT 본검사</span>
      </header>
      <CitClient />
    </main>
  );
}
