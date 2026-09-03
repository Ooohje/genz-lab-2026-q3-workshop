import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/** C2 — 대시보드. 진행 컨트롤 + 지표 + 조별 진행률 + 배정 대기자. */
export default function Dashboard({ pin, gameState }) {
  const [d, setD] = useState(null)
  const [questions, setQuestions] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')

  const pull = useCallback(async () => {
    const [dash, qs] = await Promise.all([
      supabase.rpc('admin_dashboard', { p_pin: pin }),
      supabase.rpc('admin_list_questions', { p_pin: pin }),
    ])
    if (dash.data) setD(dash.data)
    if (qs.data) setQuestions(qs.data)
  }, [pin])

  useEffect(() => {
    pull()
    const id = setInterval(pull, 3000)
    return () => clearInterval(id)
  }, [pull])

  async function call(fn, args = {}) {
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc(fn, { p_pin: pin, ...args })
    setBusy(false)
    if (error) setError(`${fn}: ${error.message}`)
    await pull()
  }

  const phase = gameState?.phase
  const curIdx = questions.findIndex((q) => q.id === d?.question_id)
  const nextQ = questions[curIdx + 1] ?? questions[0]

  return (
    <div className="flex gap-[20px] p-[24px]">
      <div className="flex flex-1 flex-col gap-[20px]">
        <div className="grid grid-cols-4 gap-[14px]">
          <Metric label="접속" value={d?.joined ?? 0} />
          <Metric label="3T1F 작성" value={d?.written ?? 0} />
          <Metric label="완료 팀" value={d?.teams_done ?? 0} />
          <Metric label="배정 대기" value={d?.unassigned ?? 0} warn={(d?.unassigned ?? 0) > 0} />
        </div>

        <Panel title="진행 컨트롤">
          <div className="flex flex-wrap gap-[10px]">
            <Btn onClick={() => call('admin_start_game1')} disabled={busy}>게임 1 시작</Btn>
            <Btn onClick={() => call('admin_force_reveal', { p_team_no: null })} disabled={busy} tone="brand">
              전 팀 일괄 강제공개
            </Btn>
            <Btn onClick={() => call('admin_start_game2')} disabled={busy} tone="ink">게임 2 시작</Btn>
            <Btn
              onClick={() => nextQ && call('admin_open_question', { p_question_id: nextQ.id })}
              disabled={busy || !nextQ}
            >
              {curIdx >= 0 ? `다음 문제 출제 (${nextQ?.ord ?? '-'})` : '첫 문제 출제'}
            </Btn>
            <Btn onClick={() => call('admin_reveal_answer')} disabled={busy || !d?.question_id}>
              정답 공개
            </Btn>
            <Btn onClick={() => call('admin_set_phase', { p_phase: 'leaderboard' })} disabled={busy}>
              중간 리더보드
            </Btn>
            <Btn onClick={() => call('admin_set_phase', { p_phase: 'final' })} disabled={busy} tone="fake">
              최종 시상
            </Btn>
            <Btn onClick={() => call('admin_set_phase', { p_phase: 'lobby' })} disabled={busy} tone="ghost">
              로비로
            </Btn>
          </div>
          {phase === 'game2_question' && (
            <p className="text-[12px] text-muted">
              현재 출제 중: {questions[curIdx]?.ord}번 · {questions[curIdx]?.body?.slice(0, 40)}
            </p>
          )}
          {error && <p className="text-[12px] font-semibold text-fake">{error}</p>}
        </Panel>

        <Panel title="팀별 게임 1 진행률">
          <div className="grid grid-cols-2 gap-x-[20px] gap-y-[10px]">
            {(d?.teams ?? []).map((t) => {
              const late = t.phase !== 'done' && t.elapsed > 150
              return (
                <div key={t.team_no} className="flex items-center gap-[12px]">
                  <span className="w-[110px] shrink-0 truncate text-[13px] font-semibold text-ink">
                    {t.name}
                  </span>
                  <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full ${
                        t.phase === 'done' ? 'bg-success' : late ? 'bg-fake' : 'bg-brand'
                      }`}
                      style={{ width: `${t.total ? (t.done / t.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="num w-[48px] shrink-0 text-right text-[12px] font-bold text-muted">
                    {t.done}/{t.total}
                  </span>
                  <button
                    onClick={() => call('admin_force_reveal', { p_team_no: t.team_no })}
                    className="shrink-0 text-[11px] font-bold text-brand hover:underline"
                  >
                    강제공개
                  </button>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      <div className="flex w-[300px] flex-none flex-col gap-[20px]">
        <Panel title={`배정 대기 (${d?.waiting?.length ?? 0})`}>
          {(d?.waiting ?? []).length === 0 && (
            <p className="text-[12px] text-muted">대기 중인 사람이 없습니다.</p>
          )}
          {(d?.waiting ?? []).map((w) => (
            <div key={w.knox_id} className="flex items-center justify-between gap-[8px]">
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold text-ink">{w.name}</span>
                <span className="num truncate text-[11px] text-muted">{w.knox_id}</span>
              </div>
              <select
                defaultValue=""
                onChange={(e) =>
                  e.target.value && call('admin_assign', {
                    p_knox_id: w.knox_id, p_team_no: Number(e.target.value),
                  })}
                className="shrink-0 rounded-[10px] border border-line bg-white px-[8px] py-[6px] text-[12px]"
              >
                <option value="">팀 선택</option>
                {(d?.teams ?? []).map((t) => (
                  <option key={t.team_no} value={t.team_no}>{t.name}</option>
                ))}
              </select>
            </div>
          ))}
        </Panel>

        <Panel title="공지 배너">
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={2}
            placeholder="전 단말에 띄울 문구"
            className="w-full rounded-[12px] border border-line p-[10px] text-[13px] outline-none focus:border-brand"
          />
          <div className="flex gap-[8px]">
            <Btn onClick={() => call('admin_set_notice', { p_notice: notice })} disabled={busy}>
              송출
            </Btn>
            <Btn tone="ghost" onClick={() => { setNotice(''); call('admin_set_notice', { p_notice: '' }) }}>
              내리기
            </Btn>
          </div>
        </Panel>

        <Panel title="위험 구역">
          <Btn
            tone="fake"
            onClick={() => confirm('게임 기록(문장·투표·답안)을 모두 지웁니다. 명단과 문항은 남습니다.')
              && call('admin_reset_game')}
          >
            리허설 초기화
          </Btn>
          <Btn
            tone="fake"
            onClick={() => confirm('참여자 명단까지 전부 삭제합니다. 행사 종료 후에만 쓰세요.')
              && confirm('정말 삭제할까요? 되돌릴 수 없습니다.')
              && call('admin_purge_personal_data')}
          >
            개인정보 전체 삭제
          </Btn>
          <p className="text-[11px] leading-[1.5] text-muted">
            행사 종료 후 개인정보 삭제는 운영 절차에 포함돼 있습니다.
          </p>
        </Panel>
      </div>
    </div>
  )
}

function Metric({ label, value, warn }) {
  return (
    <div className={`flex flex-col gap-[6px] rounded-[18px] p-[16px] ${warn ? 'bg-warn-tint' : 'bg-white'}`}>
      <span className={`text-[12px] font-semibold ${warn ? 'text-warn-on' : 'text-muted'}`}>{label}</span>
      <span className="num text-[28px] font-bold text-ink">{value}</span>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <section className="flex flex-col gap-[12px] rounded-[20px] bg-white p-[18px]">
      <h2 className="text-[13px] font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Btn({ children, tone = 'default', ...props }) {
  const styles = {
    default: 'bg-surface text-ink hover:bg-line',
    brand: 'bg-brand text-white',
    ink: 'bg-ink text-white',
    fake: 'border-2 border-fake text-fake',
    ghost: 'border border-line text-muted',
  }
  return (
    <button
      className={`rounded-[12px] px-[14px] py-[10px] text-[13px] font-bold disabled:opacity-40 ${styles[tone]}`}
      {...props}
    >
      {children}
    </button>
  )
}
