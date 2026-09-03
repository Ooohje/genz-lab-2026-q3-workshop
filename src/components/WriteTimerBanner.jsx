import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { noteServerTime, serverNow } from '../lib/clock'

/**
 * 3T1F 작성 제한시간 배너 (소프트).
 *
 * 관리자가 game_state.write_started_at 을 켜면 남은 시간을 화면 위에 띄운다.
 * 0 이 돼도 폼을 막지 않는다 — 진행자가 눈으로 보고 게임 1 을 시작한다(규칙 #10).
 * 스크린(빔)과 참여자 폰이 같은 컴포넌트를 쓰고 size 로 크기만 다르게 한다.
 *
 * 작성 단계에는 시계 보정 RPC 가 따로 안 돌기 때문에 여기서 get_write_timer 의
 * server_now 로 직접 보정한다. 없으면 폰 시계가 어긋난 만큼 남은 시간이 틀어진다.
 */
export default function WriteTimerBanner({ size = 'phone' }) {
  const [t, setT] = useState(null) // { started_at, limit_sec }
  const [now, setNow] = useState(() => serverNow())
  const busy = useRef(false)

  useEffect(() => {
    const pull = async () => {
      if (busy.current) return
      busy.current = true
      try {
        const { data } = await supabase.rpc('get_write_timer')
        if (data) {
          noteServerTime(data.server_now)
          setT(data)
        }
      } finally {
        busy.current = false
      }
    }
    pull()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') pull()
    }, 3000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), 500)
    return () => clearInterval(id)
  }, [])

  if (!t?.started_at || !t?.limit_sec) return null

  const end = new Date(t.started_at).getTime() + t.limit_sec * 1000
  const left = Math.max(0, Math.round((end - now) / 1000))
  const over = left === 0
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`

  if (size === 'screen') {
    return (
      <div className={`flex items-center gap-[16px] rounded-full px-[32px] py-[16px] ${over ? 'bg-fake' : 'bg-white/15'}`}>
        <span className="text-[28px] font-semibold text-white/80">작성 시간</span>
        <span className="num text-[44px] font-bold text-white">{over ? '시간 종료' : mmss}</span>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-none items-center justify-center gap-[8px] py-[8px] text-[13px] font-bold ${
        over ? 'bg-fake text-white' : 'bg-brand-tint text-brand-on'
      }`}
    >
      <span>3T1F 작성 시간</span>
      <span className="num">{over ? '시간 종료 — 진행자를 기다려 주세요' : `${mmss} 남음`}</span>
    </div>
  )
}
