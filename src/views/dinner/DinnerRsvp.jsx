import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import TopBar from '../../components/TopBar'
import BottomBar from '../../components/BottomBar'
import Cta from '../../components/Cta'

const RESTAURANT = '애슐리퀸즈 강남점'
const LABEL = { yes: '참석', no: '미참석' }

/**
 * 선택 → 하단 "완료" 버튼으로 확정 → 완료 화면 → "재투표"로 다시 고르기.
 * 예전엔 누르자마자 바로 저장돼서 "저장이 됐나?" 헷갈려했다(2026-09-14 피드백).
 * src/views/poll/PollVote.jsx 와 같은 3단계 패턴 — StatementForm 하단 CTA 스타일.
 */
export default function DinnerRsvp({ participant }) {
  const [saved, setSaved] = useState(null) // 서버에 저장된 현재 값
  const [pending, setPending] = useState(null) // 선택 화면에서 고르는 중인 값(아직 미확정)
  const [mode, setMode] = useState('loading') // 'loading' | 'pick' | 'done'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    supabase
      .rpc('get_dinner_rsvp', { p_knox_id: participant.knox_id })
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
  }, [participant.knox_id])

  async function confirm() {
    if (!pending || busy) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('submit_dinner_rsvp', {
      p_knox_id: participant.knox_id,
      p_choice: pending,
    })
    setBusy(false)
    if (error) {
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
      return
    }
    setSaved(pending)
    setMode('done')
  }

  if (mode === 'loading') {
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
    return (
      <div className="flex h-full flex-col bg-brand">
        <TopBar participant={participant} teamName={null} dark />
        <div className="flex flex-1 flex-col items-center justify-center gap-[16px] px-[24px] text-center">
          <div className="flex h-[64px] w-[64px] items-center justify-center rounded-full bg-brand-lime text-[30px] font-bold text-brand-deep">
            ✓
          </div>
          <div className="flex flex-col gap-[4px]">
            <h1 className="text-[22px] font-bold text-white">응답 완료</h1>
            <p className="text-[13px] text-[#D5C6FF]">석식({RESTAURANT})</p>
          </div>
          <p className="rounded-[16px] bg-white/10 px-[20px] py-[12px] text-[17px] font-bold text-white">
            {LABEL[saved]}
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
        <span className="text-[14px] font-semibold text-[#CBB4FF]">
          2026년 3분기 워크샵 · 석식
        </span>
        <h1 className="text-[26px] font-bold leading-[1.35] tracking-[-0.02em] text-white">
          석식({RESTAURANT})에
          <br />
          참여하시겠습니까?
        </h1>
        <p className="text-[14px] leading-[1.6] text-[#D5C6FF]">
          참석 여부를 골라 주세요. 완료 뒤에도 다시 눌러 변경할 수 있어요.
        </p>

        <div className="mt-[20px] flex flex-col gap-[14px]">
          <Choice label="참석" selected={pending === 'yes'} onClick={() => setPending('yes')} />
          <Choice label="미참석" selected={pending === 'no'} onClick={() => setPending('no')} />
        </div>

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
      className={`flex h-[64px] items-center justify-center rounded-[18px] text-[19px] font-bold transition-shadow ${
        selected
          ? 'bg-white text-brand-deep shadow-[0_0_0_3px_#D8FF4F]'
          : 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]'
      }`}
    >
      {label}
    </button>
  )
}
