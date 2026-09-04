import TopBar from '../../components/TopBar'
import BottomBar from '../../components/BottomBar'
import Cta from '../../components/Cta'
import WriteTimerBanner from '../../components/WriteTimerBanner'

/** A6 — 로비. 게임 1 시작을 기다리며 팀원 작성 현황을 본다. */
export default function Lobby({ participant, teamName, roster, onEditStatements }) {
  const done = roster.filter((r) => r.has_statements).length

  return (
    <div className="flex h-full flex-col bg-surface">
      <TopBar participant={participant} teamName={teamName} />
      <WriteTimerBanner />

      <div className="flex flex-1 flex-col gap-[20px] overflow-y-auto p-[22px_20px]">
        <div className="flex flex-col gap-[10px] rounded-card bg-brand p-[24px]">
          <h1 className="text-[30px] font-bold tracking-[-0.02em] text-white">곧 시작합니다</h1>
          <p className="text-[14px] leading-[1.6] text-[#D5C6FF]">
            진행자가 게임을 시작하면 자동으로 넘어갑니다.<br />
            화면이 꺼지거나 새로고침해도 지금 상태로 돌아옵니다.
          </p>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-muted">우리 팀 작성 현황</span>
          <span className="num text-[13px] font-bold text-ink">{done}/{roster.length}</span>
        </div>

        <ul className="flex flex-col gap-[8px]">
          {roster.map((m) => (
            <li
              key={m.knox_id}
              className="flex items-center justify-between rounded-[18px] bg-white p-[14px_16px]"
            >
              <span className={`text-[15px] font-semibold ${m.is_active ? 'text-ink' : 'text-muted line-through'}`}>
                {m.name}
                {m.knox_id === participant.knox_id && (
                  <span className="ml-[6px] text-[12px] font-bold text-brand">나</span>
                )}
              </span>
              <span
                className={`rounded-full px-[11px] py-[5px] text-[11px] font-bold ${
                  m.has_statements ? 'bg-success-tint text-success-on' : 'bg-warn-tint text-warn-on'
                }`}
              >
                {m.has_statements ? '완료' : '작성 중'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <BottomBar>
        <Cta variant="ghost" onClick={onEditStatements}>내 문장 다시 보기</Cta>
      </BottomBar>
    </div>
  )
}
