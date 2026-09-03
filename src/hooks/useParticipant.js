import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { saveSession } from '../lib/session'

/**
 * 본인 participants 행을 구독한다.
 * 관리자가 조를 옮기면 그 즉시 이 참여자의 화면이 새 조로 바뀌어야 한다(기획서 §3.3).
 * 채널 이름 규칙은 useGameState 와 동일하다 — 매번 유니크하게.
 *
 * onGone 은 내 행이 정말로 사라졌을 때만 불린다(관리자가 오타 난 ID 를 지운 경우).
 * 네트워크 실패와 반드시 구분해야 한다 — 잘못 부르면 순간 끊김에 60명이
 * 한꺼번에 로그인 화면으로 튕긴다.
 */
export function useParticipant(initial, { onGone } = {}) {
  const [participant, setParticipant] = useState(initial ?? null)
  const knoxId = participant?.knox_id ?? null
  const applyRef = useRef(null)
  const goneRef = useRef(null)
  goneRef.current = onGone

  const apply = useCallback((row) => {
    // Realtime 의 DELETE 이벤트는 payload.new 가 빈 객체({})로 온다.
    // 빈 객체는 truthy 라 그냥 통과시키면 participant 가 {} 로 덮여
    // knox_id 를 잃고 localStorage 까지 오염된다.
    if (!row || !row.knox_id) return
    setParticipant(row)
    saveSession(row)
  }, [])
  applyRef.current = apply

  // PGRST116 = 조회 결과 0행. participants 는 RLS 로 읽기가 열려 있으므로
  // 이 코드는 "행이 실제로 없다"를 뜻한다. 네트워크 오류는 다른 코드로 온다.
  const readOne = useCallback(async () => {
    if (!knoxId) return
    const { data, error } = await supabase
      .from('participants').select('*').eq('knox_id', knoxId).single()
    if (error?.code === 'PGRST116') { goneRef.current?.(); return }
    applyRef.current(data)
  }, [knoxId])

  const refetch = readOne

  // 생존 신호. last_seen 을 갱신해 대시보드의 "접속 중 N/전체" 가 실시간이 되게 한다.
  // 화면이 보일 때만 보내므로 폰을 끈 사람은 45초 뒤 접속자에서 빠진다.
  const beat = useCallback(() => {
    if (!knoxId || document.visibilityState !== 'visible') return
    supabase.rpc('heartbeat', { p_knox_id: knoxId }).then(() => {}, () => {})
  }, [knoxId])

  useEffect(() => {
    if (!knoxId) return
    let cancelled = false
    let channel = null

    const connect = () => {
      if (cancelled) return
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
      channel = supabase
        .channel(`participant:${knoxId}:${crypto.randomUUID()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'participants', filter: `knox_id=eq.${knoxId}` },
          (payload) => {
            if (cancelled) return
            if (payload.eventType === 'DELETE') { goneRef.current?.(); return }
            applyRef.current(payload.new)
          },
        )
        .subscribe()
    }
    connect()

    const pull = () => { if (!cancelled) readOne() }
    // 마운트 직후 한 번 읽는다. localStorage 에 남은 세션이 이미 삭제된 사람이면
    // 첫 폴링(15초)까지 유령 상태로 화면이 떠 있었다 — 여기서 바로 튕겨낸다.
    pull()
    beat()

    const resync = () => {
      if (document.visibilityState !== 'visible') return
      pull()
      beat()
      connect()
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)

    // useGameState 와 같은 이유의 폴링 안전망. 팀 배정은 phase 전환만큼
    // 급하지 않아 주기를 길게 잡는다.
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') pull()
    }, 15000)
    const pulse = setInterval(beat, 20000)

    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(pulse)
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      if (channel) supabase.removeChannel(channel)
    }
  }, [knoxId, readOne, beat])

  return { participant, setParticipant: apply, refetch }
}
