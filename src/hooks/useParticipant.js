import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { saveSession } from '../lib/session'

/**
 * 본인 participants 행을 구독한다.
 * 관리자가 조를 옮기면 그 즉시 이 참여자의 화면이 새 조로 바뀌어야 한다(기획서 §3.3).
 * 채널 이름 규칙은 useGameState 와 동일하다 — 매번 유니크하게.
 */
export function useParticipant(initial) {
  const [participant, setParticipant] = useState(initial ?? null)
  const knoxId = participant?.knox_id ?? null
  const applyRef = useRef(null)

  const apply = useCallback((row) => {
    if (!row) return
    setParticipant(row)
    saveSession(row)
  }, [])
  applyRef.current = apply

  const refetch = useCallback(async () => {
    if (!knoxId) return
    const { data } = await supabase
      .from('participants').select('*').eq('knox_id', knoxId).single()
    apply(data)
  }, [knoxId, apply])

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
          (payload) => { if (!cancelled) applyRef.current(payload.new) },
        )
        .subscribe()
    }
    connect()

    const resync = () => {
      if (document.visibilityState !== 'visible') return
      supabase.from('participants').select('*').eq('knox_id', knoxId).single()
        .then(({ data }) => { if (!cancelled) applyRef.current(data) })
      if (!channel || channel.state !== 'joined') connect()
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('online', resync)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('online', resync)
      if (channel) supabase.removeChannel(channel)
    }
  }, [knoxId])

  return { participant, setParticipant: apply, refetch }
}
