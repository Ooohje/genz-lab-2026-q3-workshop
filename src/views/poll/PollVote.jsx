import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import TopBar from '../../components/TopBar'

/**
 * 범용 투표 화면. kind: 'binary' 는 poll.options 를 그대로 보여주고,
 * kind: 'team' 은 teams 테이블에서 활성 팀을 불러와 본인 팀만 빼고 보여준다.
 * 재선택 허용(upsert) — 게임 2 답안과 달리 여긴 다시 눌러 바꿀 수 있다.
 * 서버(submit_poll_vote)가 choice 유효성을 다시 검증하므로, 여기서 목록을
 * 잘못 필터해도(본인 팀을 안 뺐다든가) 실제로 그 값을 못 저장한다.
 */
export default function PollVote({ poll, participant }) {
  const [options, setOptions] = useState(poll.kind === 'binary' ? poll.options : null)
  const [choice, setChoice] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (poll.kind !== 'team') return
    let alive = true
    supabase
      .from('teams')
      .select('team_no, name, topic, is_active, ord')
      .eq('is_active', true)
      .order('ord')
      .then(({ data }) => {
        if (!alive) return
        const opts = (data ?? [])
          .filter((t) => t.team_no !== participant.team_no)
          .map((t) => ({
            value: String(t.team_no),
            // 발표 주제를 등록해 둔 팀만 "N팀 - 주제" 로, 없으면 팀 이름 그대로.
            label: t.topic ? `${t.team_no}팀 - ${t.topic}` : t.name,
          }))
        setOptions(opts)
      })
    return () => {
      alive = false
    }
  }, [poll.kind, participant.team_no])

  useEffect(() => {
    let alive = true
    supabase
      .rpc('get_poll_vote', { p_poll_id: poll.id, p_knox_id: participant.knox_id })
      .then(({ data }) => {
        if (!alive) return
        setChoice(data?.choice ?? null)
        setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [poll.id, participant.knox_id])

  async function pick(next) {
    if (busy || next === choice) return
    const prev = choice
    setBusy(true)
    setError(null)
    setChoice(next) // 낙관적 반영
    const { error } = await supabase.rpc('submit_poll_vote', {
      p_poll_id: poll.id,
      p_knox_id: participant.knox_id,
      p_choice: next,
    })
    setBusy(false)
    if (error) {
      setChoice(prev)
      setError(
        error.message.includes('CANNOT_VOTE_OWN_TEAM')
          ? '우리 팀은 선택할 수 없어요.'
          : '저장에 실패했습니다. 다시 시도해 주세요.',
      )
    }
  }

  const currentLabel = options?.find((o) => o.value === choice)?.label

  return (
    <div className="flex h-full flex-col bg-brand">
      <TopBar participant={participant} teamName={null} dark />

      <div className="flex flex-1 flex-col gap-[10px] overflow-y-auto px-[24px] pt-[32px]">
        <h1 className="text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-white">
          {poll.title}
        </h1>
        <p className="text-[14px] leading-[1.6] text-[#D5C6FF]">{poll.subtitle}</p>

        {options === null ? (
          <p className="mt-[20px] text-[13px] text-white/60">불러오는 중…</p>
        ) : options.length === 0 ? (
          <p className="mt-[20px] text-[13px] text-white/60">선택할 수 있는 항목이 없습니다.</p>
        ) : (
          <div className="mt-[20px] flex flex-col gap-[12px]">
            {options.map((o) => (
              <Choice
                key={o.value}
                label={o.label}
                selected={choice === o.value}
                onClick={() => pick(o.value)}
              />
            ))}
          </div>
        )}

        {error ? (
          <p className="text-[13px] font-semibold text-brand-lime">{error}</p>
        ) : (
          loaded &&
          currentLabel && (
            <p className="text-[13px] font-semibold text-white">현재 응답: {currentLabel}</p>
          )
        )}
      </div>
    </div>
  )
}

function Choice({ label, selected, onClick }) {
  // 선택 표시는 border 가 아니라 box-shadow 링. 레이아웃이 안 흔들린다(README §4.3).
  return (
    <button
      onClick={onClick}
      className={`flex min-h-[56px] items-center justify-center rounded-[16px] px-[16px] py-[14px] text-center text-[17px] font-bold transition-shadow ${
        selected
          ? 'bg-white text-brand-deep shadow-[0_0_0_3px_#D8FF4F]'
          : 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]'
      }`}
    >
      {label}
    </button>
  )
}
