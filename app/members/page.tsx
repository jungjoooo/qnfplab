import Image from "next/image";
import Link from "next/link";
import { chakra } from "../layout";

const categories = [
  "Lab Director",
  "Postdoc.",
  "Doctoral student",
  "Master's student",
];

const members = [
  {
    image: "/members/member1.png",
    name: "조영일",
    role: "Lab Director",
    email: "yicho@dongguk.edu",
    details: ["동국대학교 경찰행정학부 교수", "한국심리측정평가학회 회장"],
    featured: true,
  },
  {
    image: "/members/member2.png",
    name: "조영선",
    role: "Postdoc.",
    email: "jo_oseon@naver.com",
    details: ["상담심리학", "임상심리학", "측정심리학", "디지털 치료"],
  },
  {
    image: "/members/member3.png",
    name: "맹세호",
    role: "Postdoc.",
    email: "dev.psy511@gmail.com",
    details: ["인지발달", "방법론", "Pupillometry", "Vocal biomarker"],
  },
  {
    image: "/members/member4.png",
    name: "박은서",
    role: "Postdoc.",
    email: "eun661784@gmail.com",
    details: ["계량범죄", "계량심리", "범죄심리학"],
  },
  {
    image: "/members/member5.png",
    name: "김윤희",
    role: "Doctoral student",
    email: "uneekim92@gmail.com",
    details: ["산업 및 조직심리학", "내부조사 및 감사", "관계범죄"],
  },
  {
    image: "/members/member6.png",
    name: "조원희",
    role: "Doctoral student",
    email: "jwonhee.cho@dgu.ac.kr",
    details: ["산업 및 조직심리학", "기업범죄", "관계범죄"],
  },
  {
    image: "/members/member7.png",
    name: "문형진",
    role: "Master's student",
    email: "jellymoon99@naver.com",
    details: ["범죄심리학", "교정심리"],
  },
  {
    image: "/members/member8.png",
    name: "유재효",
    role: "Master's student",
    email: "youjaehyo001@naver.com",
    details: ["관계범죄", "다층모형"],
  },
  {
    image: "/members/member9.jpg",
    name: "이정주",
    role: "Master's student",
    email: "jung-joo@naver.com",
    details: ["Pupillometry", "Emotion", "기계학습"],
  },
  {
    image: "/members/member10.png",
    name: "한화진",
    role: "Master's student",
    email: "amanda6864@naver.com",
    details: ["계량범죄", "측정모형"],
  },
];

export default function Members() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-16 sm:px-8 lg:px-12">
      <div
        className={`${chakra.className} fixed left-8 top-8 z-10 text-3xl font-[600] tracking-wide text-black`}
      >
        QnFP Lab
      </div>

      <div className="grid items-start gap-14 lg:grid-cols-[220px_1fr]">
        <aside className="hidden flex-col pt-20 lg:sticky lg:top-10 lg:flex lg:h-[calc(100vh-5rem)]">
          <div>
            <h1 className={`${chakra.className} text-4xl font-[600]`}>Members</h1>
            <p className="mt-5 text-sm leading-6 text-black/45">
              People working across measurement, forensic psychology, and
              pupillometry.
            </p>

            <nav className="mt-12 space-y-6 border-t border-black/10 pt-8">
              {categories.map((category) => (
                <a
                  key={category}
                  href={`#${category.toLowerCase().replaceAll(" ", "-").replace(".", "")}`}
                  className={`${chakra.className} block text-lg font-[500] transition hover:text-black/50`}
                >
                  {category}
                </a>
              ))}
            </nav>
          </div>

          <Link
            href="/"
            className="group relative mt-12 flex justify-center lg:mt-auto"
            aria-label="Back to Home"
          >
            <span
              className={`${chakra.className} absolute -top-7 text-xs text-black/45 opacity-0 transition group-hover:opacity-100`}
            >
              Back to Home
            </span>
            <span className="text-6xl transition group-hover:scale-110">🏡</span>
          </Link>
        </aside>

        <div>
          <header className="mb-12 pt-20 lg:hidden">
            <h1 className={`${chakra.className} text-4xl font-[600]`}>
              Members
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-black/45">
              People working across measurement, forensic psychology, and
              pupillometry.
            </p>
          </header>

          <section className="grid grid-cols-1 border-l border-t border-black/10 sm:grid-cols-2 xl:grid-cols-3">
            {members.map((member) => (
              <article
                key={member.email}
                id={member.role.toLowerCase().replaceAll(" ", "-").replace(".", "")}
                className={`group border-b border-r border-black/10 ${
                  member.featured ? "xl:col-span-3" : ""
                }`}
              >
                <div
                  className={`relative ml-auto aspect-square overflow-hidden bg-neutral-100 ${
                    member.featured ? "w-[58%] xl:w-[34%] xl:max-w-sm" : "w-[58%]"
                  }`}
                >
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    sizes={
                      member.featured
                        ? "(min-width: 1280px) 34vw, (min-width: 640px) 50vw, 58vw"
                        : "(min-width: 1280px) 30vw, (min-width: 640px) 50vw, 58vw"
                    }
                    className="object-cover object-[center_28%] grayscale transition duration-500 group-hover:grayscale-0"
                  />
                </div>

                <div
                  className={`px-8 pb-8 pt-10 ${
                    member.featured ? "min-h-64 xl:min-h-56 xl:px-12" : "min-h-64"
                  }`}
                >
                  <p
                    className={`${chakra.className} text-xs font-[500] uppercase text-black/35`}
                  >
                    {member.role}
                  </p>
                  <h2
                    className={`${chakra.className} mt-6 text-4xl font-[600] leading-tight ${
                      member.featured ? "xl:text-6xl" : ""
                    }`}
                  >
                    {member.name}
                  </h2>
                  <p className="mt-3 text-lg text-black/45">{member.email}</p>
                  <div className="mt-8 flex flex-wrap gap-x-4 gap-y-2 text-sm text-black/55">
                    {member.details.map((detail) => (
                      <span key={detail}>{detail}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </section>

          <Link
            href="/"
            className="group mt-16 flex flex-col items-center lg:hidden"
            aria-label="Back to Home"
          >
            <span
              className={`${chakra.className} mb-3 text-xs text-black/45 opacity-0 transition group-hover:opacity-100`}
            >
              Back to Home
            </span>
            <span className="text-6xl transition group-hover:scale-110">🏡</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
