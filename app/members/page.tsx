import PageTemplate from "../components/PageTemplate";
import Image from "next/image";

/* ================= 공통 멤버 카드 ================= */
function MemberRow({
  image,
  name,
  email,
  interests,
}: {
  image: string;
  name: string;
  email?: string;
  interests?: string[];
}) {
  return (
    <div className="max-w-5xl mx-auto border-b border-black/10 py-10">
      <div className="flex gap-10 items-center justify-center">

        {/* 사진 */}
        <Image
          src={image}
          alt={name}
          width={120}
          height={150}
          className="rounded-md object-cover"
        />

        {/* 이름 / 이메일 */}
        <div className="w-[220px] text-sm leading-relaxed">
          <p className="font-medium">{name}</p>
          {email && <p className="text-black/60">{email}</p>}
        </div>

        {/* 관심분야 */}
        {interests && (
          <div className="w-[260px] text-sm text-black/70">
            <ul className="list-disc list-inside space-y-1">
              {interests.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          </div>
        )}

      </div>
    </div>
  );
}

/* ================= 페이지 ================= */
export default function Members() {
  return (
    <PageTemplate title="Members">
      <div className="mt-16 space-y-24 leading-relaxed">

        {/* ================= Lab Director ================= */}
        <section className="space-y-12">
          <h3 className="text-lg font-medium text-center">Lab Director</h3>

          <div className="max-w-3xl mx-auto border-b border-black/10 pb-14">
           <div className="flex flex-col items-center text-center">

  {/* 사진 */}
  <Image
    src="/members/member1.png"
    alt="조영일"
    width={180}
    height={220}
    className="rounded-md object-cover mb-6"
  />

  {/* 이름 */}
  <p className="font-medium text-base mb-1">
    조영일
  </p>

  {/* 이메일 */}
  <p className="text-sm text-black/60 mb-10">
    yicho@dongguk.edu
  </p>

  {/* 직위 / 소속 */}
  <div className="text-sm text-black/70 space-y-1 mb-10">
    <p>동국대학교 경찰행정학부 교수</p>
    <p>한국심리측정평가학회 회장</p>
  </div>

  {/* 학력 */}
  <div className="text-sm text-black/70 space-y-1 mb-4">
    <p>성균관대학교 산업심리학 학사</p>
    <p>Middle Tennessee State University 석사</p>
    <p>University of California, Davis 박사</p>
  </div>

</div>
          </div>
        </section>

        {/* ================= Postdoc ================= */}
        <section className="space-y-10">
          <h3 className="text-lg font-medium text-center">Postdoc.</h3>

          <MemberRow
            image="/members/member2.png"
            name="조영선"
            email="jo_oseon@naver.com"
            interests={["상담심리학", "임상심리학", "측정심리학", "디지털 치료"]}
          />

          <MemberRow
            image="/members/member3.png"
            name="맹세호"
            email="dev.psy511@gmail.com"
            interests={["인지발달", "방법론", "Pupillometry", "Vocal biomarker"]}
          />

          <MemberRow
            image="/members/member4.png"
            name="박은서"
            email="eun661784@gmail.com"
            interests={["계량범죄", "계량심리", "범죄심리학"]}
          />
        </section>

        {/* ================= Doctoral Student ================= */}
        <section className="space-y-10">
          <h3 className="text-lg font-medium text-center">Doctoral student</h3>

          <MemberRow
            image="/members/member5.png"
            name="김윤희"
            email="uneekim92@gmail.com"
            interests={["산업 및 조직심리학", "내부조사 및 감사", "관계범죄"]}
          />

          <MemberRow
            image="/members/member6.png"
            name="조원희"
            email="jwonhee.cho@dgu.ac.kr"
            interests={["산업 및 조직심리학", "기업범죄", "관계범죄"]}
          />
        </section>

        {/* ================= Master’s Student ================= */}
        <section className="space-y-10">
          <h3 className="text-lg font-medium text-center">Master’s student</h3>

          <MemberRow
            image="/members/member7.png"
            name="문형진"
            email="jellymoon99@naver.com"
            interests={["범죄심리학", "교정심리"]}
          />

          <MemberRow
            image="/members/member8.png"
            name="유재효"
            email="youjaehyo001@naver.com"
            interests={["관계범죄", "다층모형"]}
          />

          <MemberRow
            image="/members/member9.jpg"
            name="이정주"
            email="jung-joo@naver.com"
            interests={["Pupillometry", "Emotion", "기계학습"]}
          />

          <MemberRow
            image="/members/member10.png"
            name="한화진"
            email="amanda6864@naver.com"
            interests={["계량범죄", "측정모형"]}
          />
        </section>

      </div>
    </PageTemplate>
  );
}
