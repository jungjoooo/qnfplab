import Link from "next/link";

type OdysseyPageProps = {
  searchParams: Promise<{ condition?: string; participant?: string; cit?: string; session?: string }>;
};

export default async function OdysseyPage({ searchParams }: OdysseyPageProps) {
  const params = await searchParams;
  const condition = params.condition === "coins" ? "coins" : "gem";
  const iframeQuery = new URLSearchParams({ study: "1", condition });
  if (params.participant) iframeQuery.set("participant", params.participant);
  if (params.cit === "complete") iframeQuery.set("cit", "complete");
  if (params.session) iframeQuery.set("session", params.session);
  return (
    <main className="flex h-screen flex-col overflow-hidden bg-[#dbeaf4]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-sky-200 bg-white/90 px-4 text-sm backdrop-blur sm:px-6">
        <Link href="/" className="font-semibold text-slate-700 transition hover:text-sky-600">← QnFP Lab</Link>
        <span className="text-slate-500">보물찾기</span>
      </header>
      <iframe title="보물찾기" src={`/treasure-hunt/index.html?${iframeQuery.toString()}`} className="min-h-0 flex-1 border-0" allow="fullscreen" />
    </main>
  );
}
