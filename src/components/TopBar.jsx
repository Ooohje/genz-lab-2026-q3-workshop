/**
 * README §5 — 상단 고정 바.
 * 참여자 전 화면에 예외 없이 표시한다. 이름과 조가 항상 보여야
 * 잘못 매칭된 사람이 스스로 알아채고 진행자에게 문의할 수 있다.
 */
export default function TopBar({ participant, teamName, right, dark = false }) {
  const waiting = participant?.team_no == null
  const chip = waiting
    ? '조 배정 대기'
    : `${participant.team_no}조${teamName ? ` ${teamName}` : ''}`

  return (
    <header
      className={`flex flex-none items-center justify-between px-[20px] py-[16px] ${
        dark ? 'bg-white/[0.07]' : 'border-b border-[#E6E5EC] bg-white'
      }`}
    >
      <div className="flex min-w-0 items-center gap-[8px]">
        <span className={`shrink-0 text-[14px] font-bold ${dark ? 'text-white' : 'text-ink'}`}>
          {participant?.name ?? '—'}
        </span>
        <span
          className={`truncate rounded-full px-[10px] py-[4px] text-[11px] font-bold ${
            waiting ? 'bg-warn-tint text-warn-on' : 'bg-brand-tint text-brand-on'
          }`}
        >
          {chip}
        </span>
      </div>
      <span className={`num shrink-0 pl-[8px] text-[11px] font-semibold ${dark ? 'text-white/60' : 'text-[#9A98A6]'}`}>
        {right ?? participant?.knox_id}
      </span>
    </header>
  )
}
