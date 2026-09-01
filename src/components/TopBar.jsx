/**
 * README §5 — 상단 고정 바. 높이 52.
 * 참여자 전 화면에 예외 없이 표시한다. 이름과 조가 항상 보여야
 * 잘못 매칭된 사람이 스스로 알아채고 진행자에게 문의할 수 있다.
 */
export default function TopBar({ participant, right, dark = false }) {
  const waiting = participant?.team_no == null

  return (
    <header
      className={`flex h-[52px] flex-none items-center justify-between px-[20px] ${
        dark ? 'bg-white/[0.07]' : 'bg-white'
      }`}
    >
      <div className="flex items-center gap-[8px]">
        <span className={`text-[14px] font-bold ${dark ? 'text-white' : 'text-ink'}`}>
          {participant?.name ?? '—'}
        </span>
        <span
          className={`rounded-full px-[8px] py-[3px] text-[11px] font-bold ${
            waiting ? 'bg-warn-tint text-warn-on' : 'bg-brand-tint text-brand-on'
          }`}
        >
          {waiting ? '조 배정 대기' : `${participant.team_no}조`}
        </span>
      </div>
      <div className={`num text-[12px] font-medium ${dark ? 'text-white/60' : 'text-muted'}`}>
        {right ?? participant?.knox_id}
      </div>
    </header>
  )
}
