import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 전체 동기화의 심장.
 *
 * game_state 는 id=1 단일 행이고, 전 단말(참여자 60 + 스크린 + 관리자)이 이 행을
 * 구독한다. 관리자가 행을 바꾸면 모두의 화면이 2초 내 전환된다.
 *
 * 주의 1 — 채널 이름은 매번 유니크해야 한다.
 *   고정 이름을 쓰면 StrictMode 의 이펙트 2회 실행이나 재구독 시
 *   같은 토픽으로 채널이 겹쳐 두 번째 구독이 SUBSCRIBED 에 도달하지 못한다.
 *
 * 주의 2 — 재구독을 빼먹지 말 것.
 *   행사장에서 실제로 가장 자주 터지는 건 Realtime 자체가 아니라 "폰 화면이 꺼져
 *   채널이 죽는" 상황이다. 재조회만 하고 재구독을 안 하면 그 뒤 전환을 전부 놓친다.
 */
export function useGameState() {
  const [gameState, setGameState] = useState(null)
  const [status, setStatus] = useState('connecting')  // connecting | live | error
  const [error, setError] = useState(null)
  const refetchRef = useRef(null)

  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('game_state').select('*').eq('id', 1).single()
    if (error) {
      setError(error.message)
      return null
    }
    setGameState(data)
    setError(null)
    return data
  }, [])
  refetchRef.current = refetch

  useEffect(() => {
    let cancelled = false
    let channel = null

    const connect = () => {
      if (cancelled) return
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
      setStatus('connecting')
      channel = supabase
        .channel(`game_state:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'game_state', filter: 'id=eq.1' },
          (payload) => { if (!cancelled && payload.new) setGameState(payload.new) },
        )
        .subscribe((s) => {
          if (cancelled) return
          if (s === 'SUBSCRIBED') setStatus('live')
          else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('error')
        })
    }

    refetchRef.current()
    connect()

    const resync = () => {
      if (document.visibilityState !== 'visible') return
      refetchRef.current()
      // 채널이 살아 있으면 굳이 끊지 않는다. 죽었을 때만 새로 연결한다.
      if (!channel || channel.state !== 'joined') connect()
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return { gameState, status, error, refetch }
}
