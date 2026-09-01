import { useGameState } from '../hooks/useGameState'
import { PHASE_LABEL } from '../lib/phases'

/**
 * 관리자 뷰 (#/admin). 기준 해상도 1440 × 900.
 * 구현 7단계에서 C1~C4 로 교체된다.
 *
 * 지금은 읽기 전용이다. game_state 에 UPDATE 정책이 없어서 anon 키로는
 * 바꿀 수 없고, 바꾸려면 PIN 을 검증하는 RPC 를 거쳐야 한다(7단계).
 * 그때까지 phase 전환 테스트는 Supabase Table Editor 에서 직접 한다.
 */
export default function AdminView() {
  const { gameState, status } = useGameState()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-[26px] bg-surface p-[40px]">
      <div className="flex w-full max-w-[520px] flex-col gap-[20px] rounded-[32px] bg-white p-[40px] shadow-[0_12px_40px_rgba(23,22,28,.1)]">
        <div className="flex items-center gap-[12px]">
          <img
            src="./genzlab-logo.png"
            alt="Gen Z Lab."
            className="h-[36px] w-[36px] rounded-full"
          />
          <span className="text-[17px] font-bold text-ink">Gen Z Lab. 관리자</span>
        </div>

        <div className="flex flex-col gap-[8px]">
          <span className="text-[13px] font-semibold text-muted">현재 phase</span>
          <span className="text-[26px] font-bold tracking-[-0.02em] text-ink">
            {PHASE_LABEL[gameState?.phase] ?? '…'}
          </span>
          <span className="num text-[13px] text-muted">{gameState?.phase ?? '…'}</span>
        </div>

        <span
          className={`self-start rounded-full px-[11px] py-[5px] text-[11px] font-bold ${
            status === 'live' ? 'bg-success-tint text-success-on' : 'bg-fake-tint text-fake-on'
          }`}
        >
          {status === 'live' ? '실시간 연결됨' : '연결 끊김'}
        </span>

        <p className="rounded-[18px] bg-brand-tint p-[16px] text-[13px] leading-[1.6] text-brand-on">
          진행 컨트롤(PIN 로그인 · phase 전환 · 조 편성 · 문항 관리)은 구현 7단계에서 붙습니다.
          지금은 Supabase Table Editor 의 <span className="num">game_state</span> 행을 직접 고쳐
          동기화를 확인하세요.
        </p>
      </div>
    </div>
  )
}
