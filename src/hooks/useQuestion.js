import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 현재 문항 + 내 제출 상태.
 *
 * 문항 전환 자체는 game_state Realtime 으로 즉시 오지만, 응답 수 카운터와
 * 정답 공개 같은 부수 정보는 폴링으로 따라간다.
 */
export function useQuestion(knoxId, gameState) {
  const [q, setQ] = useState(null)
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (!knoxId || busy.current) return
    busy.current = true
    try {
      const { data } = await supabase.rpc('get_current_question', { p_knox_id: knoxId })
      if (data) setQ(data)
    } finally {
      busy.current = false
    }
  }, [knoxId])

  // game_state 가 바뀌면(출제·정답공개) 즉시 다시 읽는다.
  useEffect(() => { refresh() }, [refresh, gameState?.current_question_id, gameState?.revealed, gameState?.phase])

  useEffect(() => {
    if (!knoxId) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 2000)
    return () => clearInterval(id)
  }, [knoxId, refresh])

  return { question: q, refresh }
}

/**
 * 서버가 준 시작 시각 기준 남은 초.
 * 전 단말이 같은 마감시각을 공유하므로 늦게 들어온 사람도 형평성이 유지된다.
 */
export function useRemaining(startedAt, limitSec) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [])
  if (!startedAt || !limitSec) return 0
  const end = new Date(startedAt).getTime() + limitSec * 1000
  return Math.max(0, (end - now) / 1000)
}
