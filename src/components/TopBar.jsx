import { clearSession } from '../lib/session'

/**
 * README §5 — 상단 고정 바.
 * 참여자 전 화면에 예외 없이 표시한다. 이름과 팀이 항상 보여야
 * 잘못 매칭된 사람이 스스로 알아채고 진행자에게 문의할 수 있다.
 *
 * 오른쪽 Knox ID 는 로그아웃 버튼이다. 남의 폰으로 잘못 들어왔거나 다른 ID 로
 * 다시 들어와야 할 때 쓴다. 세션은 localStorage 뿐이라 여기서 지우고 새로고침하면 끝.
 */
function logout() {
  if (!confirm('로그아웃할까요? 다시 들어오려면 Knox ID 를 입력해야 합니다.')) return
  clearSession()
  window.location.reload()
}

export default function TopBar({ participant, teamName, right, dark = false }) {
  const waiting = participant?.team_no == null
  // 팀 이름만 보여준다. 번호를 앞에 붙이면 자동 이름('N팀')과 겹쳐 '1팀 1팀'이 된다.
  // 이름이 아직 안 왔으면(teams 조회 전) 번호로 잠깐 대신한다.
  const chip = waiting
    ? '팀 배정 대기'
    : (teamName ?? `${participant.team_no}팀`)

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
      {right != null ? (
        <span className={`num shrink-0 pl-[8px] text-[11px] font-semibold ${dark ? 'text-white/60' : 'text-[#9A98A6]'}`}>
          {right}
        </span>
      ) : (
        <button
          onClick={logout}
          title="로그아웃"
          className={`num flex shrink-0 items-center gap-[4px] pl-[8px] text-[11px] font-semibold ${dark ? 'text-white/60' : 'text-[#9A98A6]'}`}
        >
          <span>{participant?.knox_id}</span>
          <span className="text-[10px]">· 나가기</span>
        </button>
      )}
    </header>
  )
}
