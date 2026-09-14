/**
 * #/bye — 나가기(로그아웃) 뒤에 보여주는 인사 화면.
 *
 * 예전엔 로그아웃하자마자 바로 로그인 화면으로 되돌아갔는데, 그러면 "껐다"는
 * 느낌 없이 밋밋하다. TopBar 의 logout() 이 window.close() 를 먼저 시도하고
 * (스크립트가 연 탭이 아니면 대부분 조용히 실패한다 — 브라우저 보안 정책이라
 * 웹에서 우회할 방법이 없다), 실패하면 이 화면으로 온다.
 */
export default function Goodbye() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-[20px] bg-brand px-[32px] text-center">
      <img
        src="./genzlab-logo.png"
        alt="Gen Z Lab."
        className="h-[56px] w-[56px] rounded-full"
      />
      <div className="flex flex-col gap-[8px]">
        <h1 className="text-[24px] font-bold text-white">안녕히 가세요 👋</h1>
        <p className="text-[14px] leading-[1.6] text-[#D5C6FF]">
          이 창은 이제 닫으셔도 됩니다.
          <br />
          다시 들어오려면 아래에서 새로 시작해 주세요.
        </p>
      </div>
      <a
        href="./"
        className="mt-[8px] rounded-cta bg-white px-[24px] py-[14px] text-[15px] font-bold text-brand-deep"
      >
        처음 화면으로
      </a>
    </div>
  )
}
