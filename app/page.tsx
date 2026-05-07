"use client";

import Link from "next/link";
import { chakra } from "./layout";

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto min-h-screen px-6 sm:px-8 py-20 sm:py-24 flex flex-col justify-center gap-24 sm:gap-28">
      {/* ===== Header: Tree + Logo + Green Path + Postbox ===== */}
      <div className="relative">
        {/* 로고 */}
        <h1
          className={`${chakra.className} text-[4.75rem] sm:text-[6rem] lg:text-[7rem] font-[600] tracking-wide text-center leading-none`}
        >
          QnFP Lab
        </h1>

        {/* 길 + 오브젝트를 감싸는 래퍼 */}
        <div className="relative mt-12 sm:mt-14">
          {/* 🌱 초록색 길 (기준선) */}
          <div
            className="w-full h-3 rounded-full opacity-75"
            style={{ backgroundColor: "#008000" }}
          />

          {/* 🌳 나무 – 길 중앙 기준 */}
          <div className="absolute left-0 top-1/2 -translate-y-[100%]">
            <span className="text-6xl sm:text-7xl">🌳</span>
          </div>

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
            <span className="text-5xl sm:text-6xl group-hover:scale-110 transition">
              📮
            </span>
          </Link>
        </div>
      </div>

      {/* ===== Icon Launcher ===== */}
      <section>
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-20 sm:gap-y-24 text-center">
          <Link href="/vision" className="flex flex-col items-center gap-5">
            <span className="text-5xl hover:scale-110 transition">💭</span>
            <span
              className={`${chakra.className} font-[300] text-base`}
            >
              Vision
            </span>
          </Link>

          <Link href="/members" className="flex flex-col items-center gap-5">
            <span className="text-5xl hover:scale-110 transition">🙂</span>
            <span
              className={`${chakra.className} font-[300] text-base`}
            >
              Members
            </span>
          </Link>

          <Link href="/research" className="flex flex-col items-center gap-5">
            <span className="text-5xl hover:scale-110 transition">🔍</span>
            <span
              className={`${chakra.className} font-[300] text-base`}
            >
              Research
            </span>
          </Link>

          <Link href="/alumni" className="flex flex-col items-center gap-5">
            <span className="text-5xl hover:scale-110 transition">🎓</span>
            <span
              className={`${chakra.className} font-[300] text-base`}
            >
              Alumni
            </span>
          </Link>

          <Link
            href="/pupillometry"
            className="flex flex-col items-center gap-5"
          >
            <span className="text-5xl hover:scale-110 transition">👀</span>
            <span
              className={`${chakra.className} font-[300] text-base`}
            >
              Pupillometry
            </span>
          </Link>

          <Link
            href="/publications"
            className="flex flex-col items-center gap-5"
          >
            <span className="text-5xl hover:scale-110 transition">📚</span>
            <span
              className={`${chakra.className} font-[300] text-base`}
            >
              Publications
            </span>
          </Link>
        </div>
      </section>
    </main>
  );
}
