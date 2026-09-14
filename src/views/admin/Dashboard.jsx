import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * 이름·Knox ID가 들어간 CSV를 내려받는다. 엑셀에서 한글이 깨지지 않도록
 * UTF-8 BOM을 붙인다. 개인정보라 관리자 PIN 뒤(이 파일)에서만 만든다.
 */
function downloadCsv(filename, header, rows) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 현재 origin + 해시 라우트로 투표 페이지 링크를 만든다. QR이 안 읽힐 때 대신 쓴다. */
function pollUrl(hashPath) {
  return `${window.location.href.replace(/#.*$/, '')}#${hashPath}`
}

function OpenLinkBtn({ hashPath }) {
  return (
    <a
      href={pollUrl(hashPath)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-[12px] bg-surface px-[14px] py-[10px] text-[13px] font-bold text-ink hover:bg-line"
    >
      투표 사이트 열기 ↗
    </a>
  )
}

/** C2 — 대시보드. 진행 컨트롤 + 지표 + 팀별 진행률 + 배정 대기자. */
export default function Dashboard({ pin, gameState }) {
  const [d, setD] = useState(null)
  const [questions, setQuestions] = useState([])
  const [dinner, setDinner] = useState(null)
  const [bestTeam, setBestTeam] = useState(null)
  const [trenders, setTrenders] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const [writeMin, setWriteMin] = useState(3)
  const writeOn = gameState?.write_started_at != null

  const pull = useCallback(async () => {
    const [dash, qs, din, bt, tr] = await Promise.all([
      supabase.rpc('admin_dashboard', { p_pin: pin }),
      supabase.rpc('admin_list_questions', { p_pin: pin }),
      supabase.rpc('admin_dinner_tally', { p_pin: pin }),
      supabase.rpc('admin_poll_tally', { p_pin: pin, p_poll_id: 'best_team' }),
      supabase.rpc('admin_poll_tally', { p_pin: pin, p_poll_id: 'trenders_2026h2' }),
    ])
    if (dash.data) setD(dash.data)
    if (qs.data) setQuestions(qs.data)
    if (din.data) setDinner(din.data)
    if (bt.data) setBestTeam(bt.data)
    if (tr.data) setTrenders(tr.data)
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
          <Metric label="접속 중 / 전체" value={`${d?.online ?? 0} / ${d?.joined ?? 0}`} />
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

          <div className="flex items-center gap-[8px] border-t border-line pt-[12px]">
            <span className="text-[12px] font-bold text-ink">3T1F 작성 시간</span>
            <input
              type="number"
              min={1}
              max={30}
              value={writeMin}
              onChange={(e) => setWriteMin(e.target.value)}
              disabled={busy}
              className="num w-[52px] rounded-[10px] border border-line px-[8px] py-[6px] text-[13px]"
            />
            <span className="text-[12px] text-muted">분</span>
            <Btn
              onClick={() => call('admin_set_write_timer', { p_sec: Math.max(1, Number(writeMin)) * 60 })}
              disabled={busy}
              tone="brand"
            >
              {writeOn ? '다시 시작' : '시작'}
            </Btn>
            <Btn onClick={() => call('admin_set_write_timer', { p_sec: 0 })} disabled={busy || !writeOn} tone="ghost">
              중지
            </Btn>
            {writeOn && (
              <span className="text-[12px] font-semibold text-brand">
                진행 중 · {Math.round((gameState.write_limit_sec ?? 0) / 60)}분 설정
              </span>
            )}
          </div>
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

        <Panel title="석식 참석 집계">
          <OpenLinkBtn hashPath="/dinner" />
          {dinner ? (
            <>
              <div className="grid grid-cols-3 gap-[8px]">
                <MiniStat label="참석" value={dinner.yes ?? 0} />
                <MiniStat label="미참석" value={dinner.no ?? 0} />
                <MiniStat label="미응답" value={dinner.not_yet ?? 0} warn={(dinner.not_yet ?? 0) > 0} />
              </div>
              <p className="text-[11px] text-muted">활성 참여자 {dinner.total_active ?? 0}명 기준</p>
              <details>
                <summary className="cursor-pointer text-[11px] font-bold text-brand">참석자 명단</summary>
                <p className="mt-[4px] text-[11px] leading-[1.6] text-ink">
                  {(dinner.yes_list ?? []).map((x) => x.name).join(', ') || '—'}
                </p>
              </details>
              <details>
                <summary className="cursor-pointer text-[11px] font-bold text-brand">미참석자 명단</summary>
                <p className="mt-[4px] text-[11px] leading-[1.6] text-ink">
                  {(dinner.no_list ?? []).map((x) => x.name).join(', ') || '—'}
                </p>
              </details>
            </>
          ) : (
            <p className="text-[12px] text-muted">불러오는 중…</p>
          )}
        </Panel>

        <Panel title="팀 발표 투표">
          <OpenLinkBtn hashPath="/poll/best-team" />
          {bestTeam ? (
            <>
              <p className="text-[11px] text-muted">
                활성 참여자 {bestTeam.total_active ?? 0}명 중 {bestTeam.voted ?? 0}명 투표 ·
                미투표 {bestTeam.not_yet ?? 0}명
              </p>
              <div className="flex flex-col gap-[4px]">
                {(bestTeam.counts ?? []).map((c, i) => (
                  <div key={c.choice} className="flex items-center gap-[8px] text-[12px]">
                    <span className="num w-[18px] shrink-0 text-muted">{i + 1}</span>
                    <span className="flex-1 truncate font-semibold text-ink">{c.label}</span>
                    <span className="num font-bold text-ink">{c.n}표</span>
                  </div>
                ))}
              </div>
              <Btn
                tone={bestTeam.reveal_visible ? 'fake' : 'brand'}
                onClick={() =>
                  call('admin_set_poll_reveal', {
                    p_poll_id: 'best_team',
                    p_visible: !bestTeam.reveal_visible,
                  })
                }
                disabled={busy}
              >
                {bestTeam.reveal_visible ? '스크린에서 순위 내리기' : '스크린에 순위 공개'}
              </Btn>
              <p className="text-[11px] leading-[1.5] text-muted">
                스크린에는 득표수 없이 순위만 나간다. 득표수는 여기서만 본다.
              </p>
            </>
          ) : (
            <p className="text-[12px] text-muted">불러오는 중…</p>
          )}
        </Panel>

        <Panel title="트렌더즈 현장 접수">
          <OpenLinkBtn hashPath="/poll/trenderZ" />
          {trenders ? (
            <>
              <div className="grid grid-cols-3 gap-[8px]">
                <MiniStat label="참여" value={trenders.counts?.find((c) => c.choice === 'yes')?.n ?? 0} />
                <MiniStat label="미참여" value={trenders.counts?.find((c) => c.choice === 'no')?.n ?? 0} />
                <MiniStat label="미응답" value={trenders.not_yet ?? 0} warn={(trenders.not_yet ?? 0) > 0} />
              </div>
              <p className="text-[11px] text-muted">활성 참여자 {trenders.total_active ?? 0}명 기준</p>
              <Btn
                tone="brand"
                onClick={() => {
                  const yes = (trenders.voters ?? []).filter((v) => v.choice === 'yes')
                  downloadCsv(
                    '트렌더즈_참여자명단.csv',
                    ['이름', 'Knox ID'],
                    yes.map((v) => [v.name, v.knox_id]),
                  )
                }}
                disabled={!trenders.voters?.some((v) => v.choice === 'yes')}
              >
                참여자 명단 CSV 다운로드
              </Btn>
            </>
          ) : (
            <p className="text-[12px] text-muted">불러오는 중…</p>
          )}
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
            tone="ghost"
            onClick={() => confirm('석식 참석 응답을 모두 지웁니다. 명단은 남습니다.')
              && call('admin_reset_dinner')}
          >
            석식 응답 초기화
          </Btn>
          <Btn
            tone="ghost"
            onClick={() => confirm('팀 발표 투표를 모두 지우고 스크린 공개도 내립니다.')
              && call('admin_reset_poll', { p_poll_id: 'best_team' })}
          >
            발표 투표 초기화
          </Btn>
          <Btn
            tone="ghost"
            onClick={() => confirm('트렌더즈 현장 접수 응답을 모두 지웁니다. 명단은 남습니다.')
              && call('admin_reset_poll', { p_poll_id: 'trenders_2026h2' })}
          >
            트렌더즈 접수 초기화
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

function MiniStat({ label, value, warn }) {
  return (
    <div className={`flex flex-col gap-[2px] rounded-[12px] p-[10px] ${warn ? 'bg-warn-tint' : 'bg-surface'}`}>
      <span className={`text-[10px] font-semibold ${warn ? 'text-warn-on' : 'text-muted'}`}>{label}</span>
      <span className="num text-[18px] font-bold text-ink">{value}</span>
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
