import TopBar from '../../components/TopBar'
import { PHASE_LABEL } from '../../lib/phases'

/**
 * 구현 2단계용 임시 화면.
 *
 * 3~5단계에서 각 phase 의 실제 화면(A3~A17)으로 하나씩 교체된다.
 * 지금은 "관리자가 phase 를 바꾸면 모든 폰이 따라 바뀌는가"만 검증한다.
 */
export default function PhaseStub({ participant, teamName, gameState, status, onLogout }) {
  const phase = gameState?.phase ?? '…'

  return (
    <div className="flex h-full flex-col bg-surface">
      <TopBar participant={participant} teamName={teamName} />

      <div className="flex flex-1 flex-col items-center justify-center gap-[20px] p-[24px] text-center">
        <span
          className={`rounded-full px-[11px] py-[5px] text-[11px] font-bold ${
            status === 'live'
              ? 'bg-success-tint text-success-on'
              : status === 'error'
                ? 'bg-fake-tint text-fake-on'
                : 'bg-line text-muted'
          }`}
        >
          {status === 'live' ? '실시간 연결됨' : status === 'error' ? '연결 끊김' : '연결 중…'}
        </span>

        <div className="flex flex-col gap-[8px]">
          <p className="text-[13px] font-semibold text-muted">현재 단계</p>
          <p className="text-[26px] font-bold tracking-[-0.02em] text-ink">
            {PHASE_LABEL[phase] ?? phase}
          </p>
          <p className="num text-[13px] text-muted">{phase}</p>
        </div>

        <p className="max-w-[280px] text-[13px] leading-[1.6] text-muted">
          이 화면은 구현 2단계 확인용입니다. Supabase 에서 <span className="num">game_state.phase</span> 를
          바꾸면 이 문구가 2초 안에 바뀌어야 합니다.
        </p>
      </div>

      <div
        className="px-[20px]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}
      >
        <button
          onClick={onLogout}
          className="h-[60px] w-full rounded-cta border-2 border-line bg-white text-[19px] font-bold text-muted"
        >
          세션 초기화
        </button>
      </div>
    </div>
  )
}
