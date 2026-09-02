import BottomBar from '../../../components/BottomBar'
import Cta from '../../../components/Cta'

const OPTION_COLORS = ['bg-option-1', 'bg-option-2', 'bg-option-3', 'bg-option-4']

/** A16 — 정답 공개 + 내 점수. */
export default function Result({ question }) {
  const isOx = question.type === 'ox'
  const correct = question.my_correct
  const answered = question.my_choice != null
  const dist = question.distribution ?? {}
  const keys = isOx ? ['O', 'X'] : ['1', '2', '3', '4']
  const maxN = Math.max(1, ...keys.map((k) => dist[k] ?? 0))

  const base = correct ? 100 : 0
  const bonus = Math.max(0, (question.my_score ?? 0) - base)

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto p-[20px]">
        <div
          className={`flex flex-col gap-[8px] rounded-card p-[22px] ${
            !answered ? 'bg-muted' : correct ? 'bg-truth' : 'bg-fake'
          }`}
        >
          <span className="text-[13px] font-bold text-white/70">
            정답 · {isOx ? question.answer : `${question.answer}번`}
          </span>
          <span className="text-[30px] font-bold tracking-[-0.02em] text-white">
            {!answered ? '미응답' : correct ? '맞혔습니다' : '아쉬워요'}
          </span>
          {question.explanation && (
            <p className="text-[14px] leading-[1.6] text-white/80">{question.explanation}</p>
          )}
        </div>

        <div className="flex flex-col gap-[10px] rounded-card bg-white p-[20px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-semibold text-muted">이번 문항 획득</span>
            <span className="num text-[34px] font-bold text-brand">+{question.my_score ?? 0}</span>
          </div>
          <Row label="기본" value={`+${base}`} />
          {bonus > 0 && <Row label="스피드 보너스" value={`+${bonus}`} tone="success" />}
          <div className="mt-[4px] flex items-baseline justify-between border-t border-line pt-[10px]">
            <span className="text-[13px] font-semibold text-muted">누적</span>
            <span className="num text-[18px] font-bold text-ink">{question.my_total ?? 0}</span>
          </div>
        </div>

        <div className="flex flex-col gap-[10px] rounded-card bg-white p-[20px]">
          <span className="text-[13px] font-semibold text-muted">응답 분포</span>
          {keys.map((k, i) => {
            const n = dist[k] ?? 0
            const isAnswer = String(question.answer) === k
            const color = isOx
              ? k === 'O' ? 'bg-truth' : 'bg-fake'
              : OPTION_COLORS[i]
            return (
              <div key={k} className="flex items-center gap-[10px]">
                <span className="num w-[16px] shrink-0 text-[12px] font-bold text-muted">{k}</span>
                <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full ${color} ${isAnswer ? '' : 'opacity-40'}`}
                    style={{ width: `${(n / maxN) * 100}%` }}
                  />
                </div>
                <span className="num w-[28px] shrink-0 text-right text-[12px] font-bold text-muted">{n}</span>
              </div>
            )
          })}
        </div>
      </div>

      <BottomBar>
        <Cta variant="ghost" disabled>다음 문제를 기다립니다</Cta>
      </BottomBar>
    </div>
  )
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[13px] text-muted">{label}</span>
      <span className={`num text-[15px] font-bold ${tone === 'success' ? 'text-success' : 'text-ink'}`}>
        {value}
      </span>
    </div>
  )
}
