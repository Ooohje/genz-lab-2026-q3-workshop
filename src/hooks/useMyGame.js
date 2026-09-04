import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * 내 3T1F 문장 + 우리 팀 명단(작성 현황 포함) + 팀 이름.
 *
 * statements 는 RLS 로 잠겨 있어 직접 select 할 수 없다. 전부 RPC 로 읽는다.
 * 팀원 작성 현황은 남의 폰에서 벌어지는 일이라 Realtime 구독 대신
 * 짧은 폴링으로 따라간다(기획서 §8 에서 3~5초 폴링을 허용한다).
 */
export function useMyGame(participant) {
  const [statements, setStatements] = useState(null)   // null = 아직 모름
  const [roster, setRoster] = useState([])
  const [teams, setTeams] = useState([])
  const knoxId = participant?.knox_id ?? null
  const teamNo = participant?.team_no ?? null
  const busy = useRef(false)

  const refresh = useCallback(async () => {
    if (!knoxId || busy.current) return
    busy.current = true
    try {
      const [mine, team] = await Promise.all([
        supabase.rpc('get_my_statements', { p_knox_id: knoxId }),
        teamNo != null
          ? supabase.rpc('get_team_roster', { p_knox_id: knoxId })
          : Promise.resolve({ data: [] }),
      ])
      setStatements(mine.data ?? [])
      setRoster(team.data ?? [])
    } finally {
      busy.current = false
    }
  }, [knoxId, teamNo])

  useEffect(() => {
    supabase.from('teams').select('*').order('ord').then(({ data }) => setTeams(data ?? []))
  }, [])

  useEffect(() => {
    if (!knoxId) return
    refresh()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 5000)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [knoxId, refresh])

  const teamName = teams.find((t) => t.team_no === teamNo)?.name ?? null

  return { statements, roster, teams, teamName, refresh }
}
