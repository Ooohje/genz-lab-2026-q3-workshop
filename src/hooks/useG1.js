import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 게임 1 상태. get_g1_view 하나로 화면에 필요한 모든 것을 받는다.
 *
 * 조별 진행이라 game_state Realtime 으로는 턴 전환을 알 수 없다(조마다 다르다).
 * 그래서 2초 폴링으로 따라간다. 서버가 폴링 때마다 턴 전환 판정을 함께
 * 수행하므로, 발표자 폰이 죽어도 다른 조원의 폴링이 턴을 넘겨준다.
 */
export function useG1(knoxId, { enabled = true } = {}) {
  const [view, setView] = useState(null)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (!knoxId || busy.current) return
    busy.current = true
    try {
      const { data } = await supabase.rpc('get_g1_view', { p_knox_id: knoxId })
      // 'advancing' 은 서버가 방금 턴을 넘겼다는 뜻이다. 곧바로 다시 읽는다.
      if (data?.state === 'advancing') {
        const { data: again } = await supabase.rpc('get_g1_view', { p_knox_id: knoxId })
        setView(again ?? data)
      } else if (data) {
        setView(data)
      }
    } finally {
      busy.current = false
    }
  }, [knoxId])

  useEffect(() => {
    if (!enabled || !knoxId) return
    refresh()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 2000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [enabled, knoxId, refresh])

  return { view, refresh }
}

/** 서버가 준 시각을 기준으로 경과 초를 센다. 클라이언트 시계로 카운트하지 않는다. */
export function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  if (!startedAt) return 0
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
}
