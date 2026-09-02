import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

/** A17 — 최종. 우리 조 순위 + 개인 스탯. */
export default function Final({ participant }) {
  const [stats, setStats] = useState(null)
  const [board, setBoard] = useState([])

  useEffect(() => {
    supabase.rpc('get_my_stats', { p_knox_id: participant.knox_id })
      .then(({ data }) => setStats(data))
    supabase.rpc('get_leaderboard').then(({ data }) => setBoard(data ?? []))
  }, [participant.knox_id])

  const rank = board.findIndex((t) => t.team_no === participant.team_no) + 1
  const mine = board.find((t) => t.team_no === participant.team_no)

  return (
    <div className="flex h-full flex-col gap-[20px] overflow-y-auto bg-brand p-[24px_20px]">
      <div className="flex flex-col items-center gap-[4px] pt-[20px]">
        <span className="num text-[82px] font-bold leading-none tracking-[-0.03em] text-white">
          {rank > 0 ? `${rank}위` : '—'}
        </span>
        <span className="text-[20px] font-bold text-brand-lime">
          {mine?.name ?? `${participant.team_no}조`}
        </span>
        <span className="num text-[14px] font-semibold text-[#CBB4FF]">
          조 평균 {mine?.avg ?? 0}점
        </span>
      </div>

      <div className="grid grid-cols-2 gap-[10px]">
        <Stat label="내 총점" value={stats?.total ?? 0} />
        <Stat label="정답" value={`${stats?.correct ?? 0}/${stats?.questions ?? 0}`} />
        <Stat label="응답한 문항" value={`${stats?.answered ?? 0}문항`} />
        <Stat label="거짓 적중" value={`${stats?.lies_caught ?? 0}회`} />
      </div>

      {stats?.best_liar && (
        <div className="flex flex-col gap-[6px] rounded-card bg-brand-lime p-[20px]">
          <span className="text-[13px] font-bold text-brand-deep/70">
            우리 조에서 가장 잘 속인 사람
          </span>
          <span className="text-[26px] font-bold tracking-[-0.02em] text-brand-deep">
            {stats.best_liar}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-[8px] rounded-card bg-white/10 p-[18px]">
        <span className="text-[13px] font-bold text-white/70">전체 순위</span>
        {board.map((t, i) => (
          <div
            key={t.team_no}
            className={`flex items-center justify-between rounded-[14px] px-[12px] py-[9px] ${
              t.team_no === participant.team_no ? 'bg-white/15' : ''
            }`}
          >
            <span className="flex items-center gap-[10px]">
              <span className="num w-[20px] text-[13px] font-bold text-brand-lime">{i + 1}</span>
              <span className="text-[14px] font-semibold text-white">{t.name}</span>
            </span>
            <span className="num text-[14px] font-bold text-white/80">{t.avg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="flex flex-col gap-[4px] rounded-[20px] bg-white/10 p-[16px]">
      <span className="text-[12px] font-semibold text-white/60">{label}</span>
      <span className="num text-[24px] font-bold text-white">{value}</span>
    </div>
  )
}
