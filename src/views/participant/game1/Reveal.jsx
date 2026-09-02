import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import TopBar from '../../../components/TopBar'
import BottomBar from '../../../components/BottomBar'
import Cta from '../../../components/Cta'

const LABELS = ['A', 'B', 'C', 'D']
const REVEAL_SEC = 5

/**
 * A12 — 개인 리빌. 진실 = 파랑, 거짓 = 빨강. 이 색 의미는 고정이다.
 * 5초 뒤 서버가 자동으로 다음 발표자로 넘긴다.
 */
export default function Reveal({ participant, teamName, view, phaseElapsed, onAdvanced }) {
  const [busy, setBusy] = useState(false)
  const statements = view.statements ?? []
  const lieLabel = LABELS[statements.findIndex((s) => s.is_lie)]
  const maxVotes = Math.max(1, ...statements.map((s) => s.votes ?? 0))
  const left = Math.max(0, REVEAL_SEC - phaseElapsed)
  const fooled = view.fooled ?? []

  async function next() {
    if (!view.is_me) return
    setBusy(true)
    await supabase.rpc('g1_next', { p_knox_id: participant.knox_id })
    setBusy(false)
    onAdvanced()
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <TopBar participant={participant} teamName={teamName} right={`${left}초 후 다음`} />

      <div className="h-[4px] flex-none bg-line">
        <div
          className="h-full bg-brand transition-[width] duration-500 ease-linear"
          style={{ width: `${Math.min(100, (phaseElapsed / REVEAL_SEC) * 100)}%` }}
        />
      </div>

      <div className="flex flex-1 flex-col gap-[16px] overflow-y-auto p-[20px]">
        <div className="flex flex-col gap-[4px]">
          <span className="text-[12px] font-semibold text-muted">{view.speaker?.name}님의 정답</span>
          <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">
            거짓은 <span className="text-fake">{lieLabel}</span> 였습니다
          </h1>
        </div>

        <ul className="flex flex-col gap-[10px]">
          {statements.map((s, i) => {
            const mine = view.my_vote === s.ord
            return (
              <li
                key={s.ord}
                className={`flex flex-col gap-[8px] rounded-[20px] bg-white p-[16px] ${
                  s.is_lie ? 'shadow-[0_0_0_3px_#F0392B]' : 'shadow-[inset_0_0_0_2px_#2F5CF0]'
                }`}
              >
                <div className="flex items-center gap-[10px]">
                  <span
                    className={`num flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px] text-[12px] font-bold text-white ${
                      s.is_lie ? 'bg-fake' : 'bg-truth'
                    }`}
                  >
                    {LABELS[i]}
                  </span>
                  <span className="flex-1 text-[15px] leading-[1.45] text-ink">{s.content}</span>
                  {mine && <span className="shrink-0 text-[11px] font-bold text-brand">내 선택</span>}
                </div>
                <div className="flex items-center gap-[10px]">
                  <div className="h-[8px] flex-1 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${s.is_lie ? 'bg-fake' : 'bg-truth'}`}
                      style={{ width: `${((s.votes ?? 0) / maxVotes) * 100}%` }}
                    />
                  </div>
                  <span className="num w-[36px] shrink-0 text-right text-[12px] font-bold text-muted">
                    {s.votes ?? 0}표
                  </span>
                </div>
              </li>
            )
          })}
        </ul>

        {fooled.length > 0 && (
          <div className="flex flex-col gap-[8px]">
            <span className="text-[13px] font-semibold text-muted">속은 사람</span>
            <div className="flex flex-wrap gap-[6px]">
              {fooled.map((n) => (
                <span
                  key={n}
                  className={`rounded-full px-[11px] py-[5px] text-[11px] font-bold ${
                    n === participant.name ? 'bg-brand-tint text-brand-on' : 'bg-white text-muted'
                  }`}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomBar>
        {view.is_me ? (
          <Cta variant="ink" onClick={next} disabled={busy}>바로 다음 발표자로</Cta>
        ) : (
          <Cta variant="ghost" disabled>{left}초 후 다음 발표자</Cta>
        )}
      </BottomBar>
    </div>
  )
}
