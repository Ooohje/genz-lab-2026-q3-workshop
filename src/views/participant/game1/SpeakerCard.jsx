import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import TopBar from '../../../components/TopBar'
import BottomBar from '../../../components/BottomBar'
import Cta from '../../../components/Cta'

const LABELS = ['A', 'B', 'C', 'D']
const SOFT_LIMIT_SEC = 120   // 2분. 색만 바꾸고 강제 전환은 하지 않는다.

/**
 * A8 / A9 / A10 — 발표자의 4문장을 듣고 거짓 하나를 고른다.
 *
 * 게임 1 의 투표는 재선택 허용이다(upsert). 설명을 듣다 생각이 바뀌면
 * 언제든 바꿀 수 있고 마지막 선택이 유효하다. 게임 2 의 1회 확정과 정반대다.
 */
export default function SpeakerCard({ participant, teamName, view, elapsed, onVoted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const myVote = view.my_vote
  const overtime = elapsed >= SOFT_LIMIT_SEC

  async function vote(ord) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('cast_vote', {
      p_voter: participant.knox_id,
      p_target: view.speaker.knox_id,
      p_ord: ord,
    })
    setBusy(false)
    if (error) {
      setError(
        error.message.includes('NOT_VOTING_PHASE')
          ? '지금은 투표할 수 없어요. 잠시 후 화면이 넘어갑니다.'
          : '투표에 실패했습니다. 다시 시도해 주세요.',
      )
      return
    }
    onVoted()
  }

  return (
    <div className={`flex h-full flex-col ${overtime ? 'bg-fake-tint' : 'bg-surface'}`}>
      <TopBar
        participant={participant}
        teamName={teamName}
        right={
          <span className="flex items-center gap-[6px]">
            <span className={`h-[6px] w-[6px] rounded-full ${overtime ? 'animate-pulse2 bg-fake' : 'bg-success'}`} />
            <span className={overtime ? 'text-fake' : undefined}>{fmt(elapsed)}</span>
          </span>
        }
      />

      <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto p-[20px]">
        {overtime && (
          <div className="flex items-center justify-between rounded-[16px] bg-fake p-[12px_16px]">
            <span className="text-[14px] font-bold text-white">슬슬 다음 분으로!</span>
            <span className="num text-[12px] font-bold text-white/80">2분 경과</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-[10px]">
          <div className="flex flex-col gap-[2px]">
            <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">{view.speaker.name}</h1>
            <span className="text-[12px] font-semibold text-muted">
              {view.current_idx + 1}번째 발표
            </span>
          </div>
          <span
            className={`num shrink-0 rounded-full px-[11px] py-[5px] text-[11px] font-bold ${
              view.voters_done >= view.voters_expected
                ? 'bg-success-tint text-success-on'
                : 'bg-line text-muted'
            }`}
          >
            {view.voters_done}/{view.voters_expected}명 투표
          </span>
        </div>

        <p className="text-[14px] font-semibold text-fake">
          이 중 하나는 거짓입니다. 어느 것일까요?
        </p>

        <ul className="flex flex-col gap-[10px]">
          {(view.statements ?? []).map((s, i) => {
            const selected = myVote === s.ord
            return (
              <li key={s.ord}>
                <button
                  disabled={busy}
                  onClick={() => vote(s.ord)}
                  className={`flex w-full items-center gap-[12px] rounded-[20px] p-[18px_16px] text-left transition-colors ${
                    selected ? 'bg-fake-tint shadow-[0_0_0_3px_#F0392B]' : 'bg-white'
                  }`}
                >
                  <span
                    className={`num flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[10px] text-[13px] font-bold ${
                      selected ? 'bg-fake text-white' : 'bg-surface text-muted'
                    }`}
                  >
                    {LABELS[i]}
                  </span>
                  <span className="flex-1 text-[15px] leading-[1.45] text-ink">{s.content}</span>
                  {selected && (
                    <span className="shrink-0 text-[11px] font-bold text-fake">내 선택</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {error && <p className="text-[13px] font-semibold text-fake">{error}</p>}

        <p className="text-center text-[12px] text-muted">
          설명을 듣다 생각이 바뀌면 다시 고를 수 있어요. 마지막 선택이 반영됩니다.
        </p>
      </div>

      <BottomBar>
        <Cta variant={myVote ? 'success' : 'brand'} disabled={!myVote}>
          {myVote
            ? `투표 완료 · ${LABELS[(view.statements ?? []).findIndex((s) => s.ord === myVote)]} 선택됨`
            : '문장을 선택하세요'}
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
