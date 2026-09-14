import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import TopBar from '../../components/TopBar'
import BottomBar from '../../components/BottomBar'
import Cta from '../../components/Cta'

/**
 * 범용 투표 화면. 고르기만 하고 끝나면 "저장됐나?" 헷갈려해서(2026-09-14 피드백),
 * 선택 → 하단 "완료" 버튼으로 확정 → 완료 화면 → "재투표"로 다시 고르기,
 * 3단계로 명확히 나눴다. StatementForm 의 하단 CTA 패턴과 같다.
 *
 * kind: 'binary' 는 poll.options 를 그대로 보여주고,
 * kind: 'team' 은 teams 테이블에서 활성 팀을 불러와 본인 팀만 빼고 보여준다.
 * 서버(submit_poll_vote)가 choice 유효성을 다시 검증하므로, 여기서 목록을
 * 잘못 필터해도(본인 팀을 안 뺐다든가) 실제로 그 값을 못 저장한다.
 */
export default function PollVote({ poll, participant }) {
  const [options, setOptions] = useState(poll.kind === 'binary' ? poll.options : null)
  const [saved, setSaved] = useState(null) // 서버에 저장된 현재 값
  const [pending, setPending] = useState(null) // 선택 화면에서 고르는 중인 값(아직 미확정)
  const [mode, setMode] = useState('loading') // 'loading' | 'pick' | 'done'
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
        const c = data?.choice ?? null
        setSaved(c)
        setPending(c)
        setMode(c ? 'done' : 'pick')
      })
    return () => {
      alive = false
    }
  }, [poll.id, participant.knox_id])

  async function confirm() {
    if (!pending || busy) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('submit_poll_vote', {
      p_poll_id: poll.id,
      p_knox_id: participant.knox_id,
      p_choice: pending,
    })
    setBusy(false)
    if (error) {
      setError(
        error.message.includes('CANNOT_VOTE_OWN_TEAM')
          ? '우리 팀은 선택할 수 없어요.'
          : '저장에 실패했습니다. 다시 시도해 주세요.',
      )
      return
    }
    setSaved(pending)
    setMode('done')
  }

  if (mode === 'loading' || options === null) {
    return (
      <div className="flex h-full flex-col bg-brand">
        <TopBar participant={participant} teamName={null} dark />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-[13px] text-white/60">불러오는 중…</p>
        </div>
      </div>
    )
  }

  if (mode === 'done') {
    const label = options.find((o) => o.value === saved)?.label ?? saved
    return (
      <div className="flex h-full flex-col bg-brand">
        <TopBar participant={participant} teamName={null} dark />
        <div className="flex flex-1 flex-col items-center justify-center gap-[16px] px-[24px] text-center">
          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-brand-lime text-[30px] font-bold text-brand-deep">
            ✓
          </div>
          <div className="flex flex-col gap-[4px]">
            <h1 className="text-[22px] font-bold text-white">투표 완료</h1>
            <p className="text-[13px] text-[#D5C6FF]">{poll.title}</p>
          </div>
          <p className="rounded-[16px] bg-white/10 px-[20px] py-[12px] text-[17px] font-bold text-white">
            {label}
          </p>
        </div>
        <BottomBar>
          <Cta variant="ghost" onClick={() => setMode('pick')}>
            재투표
          </Cta>
        </BottomBar>
      </div>
    )
  }

  // mode === 'pick'
  return (
    <div className="flex h-full flex-col bg-brand">
      <TopBar participant={participant} teamName={null} dark />

      <div className="flex flex-1 flex-col gap-[10px] overflow-y-auto px-[24px] pt-[32px]">
        <h1 className="text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-white">
          {poll.title}
        </h1>
        <p className="text-[14px] leading-[1.6] text-[#D5C6FF]">{poll.subtitle}</p>

        {options.length === 0 ? (
          <p className="mt-[20px] text-[13px] text-white/60">선택할 수 있는 항목이 없습니다.</p>
        ) : (
          <div className="mt-[20px] flex flex-col gap-[12px] pb-[20px]">
            {options.map((o) => (
              <Choice
                key={o.value}
                label={o.label}
                selected={pending === o.value}
                onClick={() => setPending(o.value)}
              />
            ))}
          </div>
        )}

        {error && <p className="text-[13px] font-semibold text-brand-lime">{error}</p>}
      </div>

      <BottomBar>
        <Cta variant="lime" disabled={!pending || busy} onClick={confirm}>
          {busy ? '저장 중…' : '완료'}
        </Cta>
      </BottomBar>
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
