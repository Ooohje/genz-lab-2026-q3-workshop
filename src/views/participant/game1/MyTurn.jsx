import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import BottomBar from '../../../components/BottomBar'
import Cta from '../../../components/Cta'

const LABELS = ['A', 'B', 'C', 'D']

/**
 * A11 — 발표자 본인 화면. 배경 brand-deep 전면.
 * 본인 문장은 보여주되 투표는 못 한다.
 * [다음으로 넘기기]는 미투표자를 기권 처리하는 수동 백업이다
 * (팀원 1명이 폰을 안 봐도 팀이 막히지 않게).
 */
export default function MyTurn({ participant, view, elapsed, onAdvanced }) {
  const [busy, setBusy] = useState(false)
  const remaining = Math.max(0, view.voters_expected - view.voters_done)

  async function next() {
    setBusy(true)
    await supabase.rpc('g1_next', { p_knox_id: participant.knox_id })
    setBusy(false)
    onAdvanced()
  }

  return (
    <div className="flex h-full flex-col bg-brand-deep">
      <header className="flex flex-none items-center justify-between bg-white/[0.07] px-[20px] py-[16px]">
        <span className="text-[14px] font-bold text-white">{participant.name}</span>
        <span className="num text-[12px] font-semibold text-white/60">{fmt(elapsed)}</span>
      </header>

      <div className="flex flex-1 flex-col gap-[16px] overflow-y-auto p-[20px]">
        <div className="flex flex-col gap-[6px]">
          <h1 className="text-[34px] font-bold tracking-[-0.02em] text-brand-lime">내 차례!</h1>
          <p className="text-[15px] leading-[1.6] text-white/80">
            아래 4문장을 말로 설명하세요.<br />팀원들이 어느 것이 거짓인지 고릅니다.
          </p>
        </div>

        <ul className="flex flex-col gap-[10px]">
          {(view.statements ?? []).map((s, i) => (
            <li
              key={s.ord}
              className="flex items-center gap-[12px] rounded-[20px] bg-white/10 p-[16px]"
            >
              <span className="num flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[10px] bg-white/15 text-[13px] font-bold text-white">
                {LABELS[i]}
              </span>
              <span className="flex-1 text-[15px] leading-[1.45] text-white">{s.content}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between rounded-[20px] bg-white/10 p-[16px_18px]">
          <span className="text-[14px] font-semibold text-white/80">아직 투표 안 한 사람</span>
          <span className="num text-[22px] font-bold text-brand-lime">{remaining}명</span>
        </div>
      </div>

      <BottomBar>
        <p className="text-center text-[12px] text-white/60">
          전원 투표되면 자동으로 넘어갑니다
        </p>
        <Cta variant="lime" onClick={next} disabled={busy}>
          {busy ? '넘기는 중…' : '다음으로 넘기기'}
        </Cta>
      </BottomBar>
    </div>
  )
}

function fmt(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
