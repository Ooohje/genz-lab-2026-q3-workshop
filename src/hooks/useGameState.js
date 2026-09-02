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
      // channel.state 가 'joined' 라고 해서 소켓이 살아 있다는 보장이 없다.
      // 클라이언트가 아직 끊김을 눈치채지 못한 상태일 수 있으므로 무조건 새로 붙는다.
      connect()
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)
    window.addEventListener('focus', resync)

    // 폴링 안전망.
    //
    // 폰을 켜둔 채로 소켓만 조용히 죽으면 visibilitychange·focus·online 중
    // 아무것도 발생하지 않는다. LTE 의 캐리어 NAT 타임아웃이나 순간 끊김에서
    // 실제로 일어나며, 그러면 참여자는 멈춘 화면을 보며 계속 기다리게 된다.
    // 60명이 30분간 붙어 있으면 누군가에게는 반드시 생긴다.
    //
    // Realtime 은 빠른 경로(1초 이내)로 그대로 두고, 이 폴링은 그게 죽었을 때
    // 최대 POLL_MS 안에 따라잡게 하는 보험이다. game_state 는 단일 행이라
    // 60명이 5초마다 조회해도 초당 12건, 무료 티어에서 문제되지 않는다.
    const POLL_MS = 5000
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      refetchRef.current()
    }, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(poll)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      window.removeEventListener('focus', resync)
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  return { gameState, status, error, refetch }
}
