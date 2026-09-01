"use client";

import Link from "next/link";
import { chakra } from "./layout";

const navItems = [
  { href: "/vision", label: "Vision", meta: "What guides the lab" },
  { href: "/research", label: "Research", meta: "Current questions" },
  { href: "/members", label: "Members", meta: "People in the lab" },
  { href: "/pupillometry", label: "Pupillometry", meta: "Measurement work" },
  { href: "/publications", label: "Publications", meta: "Papers and output" },
  { href: "/alumni", label: "Alumni", meta: "Former members" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 sm:px-8 sm:py-24">
      {/* ===== Header: Tree + Logo + Green Path + Postbox ===== */}
      <div className="relative">
        {/* 로고 */}
        <h1
          className={`${chakra.className} text-center text-[4.4rem] font-[600] leading-none tracking-wide sm:text-[5.8rem] lg:text-[6.6rem]`}
        >
          QnFP Lab
        </h1>
        <p className="mx-auto mt-8 max-w-2xl text-center text-base italic leading-7 text-gray-500 sm:text-lg">
          Quantitative and forensic psychology lab studying measurable signals
          of cognition, behavior, and pupil response.
        </p>

        {/* 길 + 오브젝트를 감싸는 래퍼 */}
        <div className="relative mt-14 sm:mt-16">
          {/* 🌱 초록색 길 (기준선) */}
          <div
            className="h-px w-full bg-gray-300"
          />

          {/* 📮 우편함 – 길 중앙 기준 */}
          <Link
            href="/contact"
            className="absolute right-0 top-1/2 -translate-y-[100%] flex flex-col items-center group"
            aria-label="Go to Contact Page"
          >
            <span
              className={`${chakra.className} font-[300] text-xs text-gray-500 mb-4 opacity-0 group-hover:opacity-100 transition`}
            >
              Contact us
            </span>
            <span className="text-5xl sm:text-6xl transition group-hover:scale-110">
              📮
            </span>
          </Link>
        </div>
      </div>

      {/* ===== Icon Launcher ===== */}
      <section className="mt-24 sm:mt-28">
        <div className="grid grid-cols-1 border-t border-gray-200 sm:grid-cols-2 lg:grid-cols-3">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex min-h-36 flex-col items-center justify-center border-b border-gray-200 px-6 py-9 text-center transition hover:bg-gray-50"
            >
              <span
                className={`${chakra.className} block text-2xl font-[500] transition group-hover:text-gray-500`}
              >
                {item.label}
              </span>
              <span className="mt-3 block text-sm leading-6 text-gray-400">
                {item.meta}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
