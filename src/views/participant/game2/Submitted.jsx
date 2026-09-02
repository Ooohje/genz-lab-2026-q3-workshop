const OPTION_COLORS = ['bg-option-1', 'bg-option-2', 'bg-option-3', 'bg-option-4']
const OPTION_TEXT = ['text-white', 'text-[#3D2600]', 'text-white', 'text-white']

/** A15 — 제출 완료. 정답 여부는 공개 전까지 알려주지 않는다(옆사람에게 샌다). */
export default function Submitted({ question, remaining }) {
  const isOx = question.type === 'ox'
  const choice = question.my_choice
  const idx = isOx ? -1 : Number(choice) - 1

  const box = isOx
    ? choice === 'O' ? 'bg-truth text-white' : 'bg-fake text-white'
    : `${OPTION_COLORS[idx]} ${OPTION_TEXT[idx]}`

  return (
    <div className="flex h-full flex-col items-center justify-center gap-[20px] bg-ink p-[24px] text-center">
      <div
        className={`flex h-[112px] w-[112px] animate-bob items-center justify-center rounded-[32px] ${box}`}
      >
        <span className="num text-[48px] font-bold leading-none">{isOx ? choice : idx + 1}</span>
      </div>

      <div className="flex flex-col gap-[6px]">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] text-white">제출 완료</h1>
        <p className="text-[14px] text-white/50">변경할 수 없어요</p>
      </div>

      <span className="num rounded-full bg-white/10 px-[14px] py-[7px] text-[12px] font-bold text-white/70">
        {remaining > 0 ? `${Math.ceil(remaining)}초 남음` : '정답 공개를 기다리는 중'}
      </span>

      <div className="mt-[8px] flex flex-col items-center gap-[2px]">
        <span className="text-[12px] font-semibold text-white/40">현재 내 점수</span>
        <span className="num text-[26px] font-bold text-brand-lime">{question.my_total ?? 0}</span>
      </div>
    </div>
  )
}
