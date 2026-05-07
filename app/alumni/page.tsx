import PageTemplate from "../components/PageTemplate";

export default function Alumni() {
  return (
    <PageTemplate title="Alumni">
      {/* 박수진 */}
      <div className="grid grid-cols-[160px_1fr] gap-x-10 py-6 border-b border-black/10 text-base">
        {/* 왼쪽: 이름 / 기간 */}
        <div className="space-y-2">
          <p>박수진 석사</p>
          <p className="text-xs text-black/60">~ 2021.08</p>
        </div>

        {/* 오른쪽: 논문 / 현 재직 */}
        <div className="space-y-2">
          <p className="text-black/80">
            &lt;내적 일치도 계수의 비교: 알파와 오메가&gt;
          </p>
          <p className="text-xs text-black/60">
            LS 인사팀 재직
          </p>
        </div>
      </div>

      {/* 이나라 */}
      <div className="grid grid-cols-[160px_1fr] gap-x-10 py-6 border-b border-black/10 text-base">
        <div className="space-y-2">
          <p>이나라 박사</p>
          <p className="text-xs text-black/60">~ 2025.02</p>
        </div>

        <div className="space-y-2">
          <p className="text-black/80">
            &lt;성범죄자의 분류 및 재범 위험성 예측을 위한 특성 분석&gt;
          </p>
          <p className="text-xs text-black/60">
            명지전문대 객원조교수 재직
          </p>
        </div>
      </div>
    </PageTemplate>
  );
}
