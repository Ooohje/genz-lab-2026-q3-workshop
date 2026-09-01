import { useGameState } from '../hooks/useGameState'
import { PHASE_LABEL } from '../lib/phases'

/**
 * 빔프로젝터용 스크린 뷰 (#/screen). 기준 해상도 1920 × 1080.
 * 구현 6단계에서 B1~B5 로 교체된다. 지금은 동기화 확인용.
 * 스크린 뷰에는 24px 미만 텍스트를 두지 않는다 (README §4.2).
 */
export default function ScreenView() {
  const { gameState, status } = useGameState()
  const phase = gameState?.phase ?? '…'

  return (
    <div className="flex h-full flex-col items-center justify-center gap-[40px] bg-brand p-[80px] text-center">
      <div className="flex items-center gap-[20px]">
        <img
          src="./genzlab-logo.png"
          alt="Gen Z Lab."
          className="h-[72px] w-[72px] rounded-full"
        />
        <span className="text-[40px] font-bold text-white">Gen Z Lab.</span>
      </div>
      <p className="text-[32px] font-semibold text-[#CBB4FF]">2026년 3분기 워크샵</p>

      <h1 className="text-[108px] font-bold leading-[1.1] tracking-[-0.03em] text-white">
        {PHASE_LABEL[phase] ?? phase}
      </h1>

      <span
        className={`rounded-full px-[24px] py-[12px] text-[24px] font-bold ${
          status === 'live' ? 'bg-brand-lime text-brand-deep' : 'bg-fake text-white'
        }`}
      >
        {status === 'live' ? '실시간 연결됨' : status === 'error' ? '연결 끊김' : '연결 중…'}
      </span>
    </div>
  )
}
