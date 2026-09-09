import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import TopBar from '../../components/TopBar'

const RESTAURANT = '애슐리퀸즈 강남점'

/**
 * 석식 참석/미참석 한 번 누르면 저장되고, 마음이 바뀌면 다시 눌러 바꿀 수 있다.
 * 집계는 여기서 안 보여준다 — 관리자 대시보드에서만.
 * 배경 brand(보라)는 입장·로비와 같은 계열. O/X 가 아니므로 truth/fake 색은 쓰지 않는다.
 */
export default function DinnerRsvp({ participant }) {
  const [choice, setChoice] = useState(null) // 'yes' | 'no' | null
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    supabase
      .rpc('get_dinner_rsvp', { p_knox_id: participant.knox_id })
      .then(({ data }) => {
        if (!alive) return
        setChoice(data?.choice ?? null)
        setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [participant.knox_id])

  async function pick(next) {
    if (busy || next === choice) return
    const prev = choice
    setBusy(true)
    setError(null)
    setChoice(next) // 낙관적 반영
    const { error } = await supabase.rpc('submit_dinner_rsvp', {
      p_knox_id: participant.knox_id,
      p_choice: next,
    })
    setBusy(false)
    if (error) {
      setChoice(prev)
      setError('저장에 실패했습니다. 다시 시도해 주세요.')
    }
  }

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
          참석 여부를 알려주세요. 마음이 바뀌면 다시 눌러 변경할 수 있어요.
        </p>

        <div className="mt-[20px] flex flex-col gap-[14px]">
          <Choice label="참석" selected={choice === 'yes'} onClick={() => pick('yes')} />
          <Choice label="미참석" selected={choice === 'no'} onClick={() => pick('no')} />
        </div>

        {error ? (
          <p className="text-[13px] font-semibold text-brand-lime">{error}</p>
        ) : (
          loaded &&
          choice && (
            <p className="text-[13px] font-semibold text-white">
              현재 응답: {choice === 'yes' ? '참석' : '미참석'}
            </p>
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
