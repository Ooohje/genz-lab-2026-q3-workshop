import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase'
import { useGameState } from '../../hooks/useGameState'
import { useRemaining } from '../../hooks/useQuestion'
import { noteServerTime } from '../../lib/clock'
import Timer from '../../components/Timer'
import WriteTimerBanner from '../../components/WriteTimerBanner'

/**
 * 빔프로젝터용 스크린 뷰 (#/screen). 기준 해상도 1920 × 1080.
 * 24px 미만 텍스트를 두지 않는다 (README §4.2). 실사용 범위 24–136px.
 */
export default function ScreenView() {
  const { gameState } = useGameState()

  // 리허설·사전점검용 미리보기: #/screen?phase=lobby 처럼 phase 를 강제한다.
  // DB 를 건드리지 않고 각 화면을 확인할 수 있다.
  const override = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('phase')
  const phase = override ?? gameState?.phase ?? 'lobby'

  if (phase === 'lobby') return <Entry />
  if (phase === 'game1' || phase === 'game1_reveal') return <G1Board />
  if (phase === 'game2_wait') return <Standby />
  if (phase === 'game2_question' || phase === 'game2_answer') {
    return <QuestionBoard gameState={gameState} />
  }
  return <Leaderboard final={phase === 'final'} />
}

/** 입장 QR. 로비(B1)와 게임 2 대기 화면이 같이 쓴다 — 늦게 온 사람이 어느 단계에서든 들어올 수 있게. */
function useEntryQr() {
  const [qr, setQr] = useState(null)
  const url = window.location.href.replace(/#.*$/, '')
  useEffect(() => {
    QRCode.toDataURL(url, { width: 784, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(null))
  }, [url])
  return { qr, url }
}

/* ---------------------------------------------------------------- B1 */
function Entry() {
  const { qr, url } = useEntryQr()
  const [counts, setCounts] = useState({ joined_count: 0, written_count: 0 })

  useEffect(() => {
    const pull = () => supabase.rpc('get_progress_counts')
      .then(({ data }) => data?.[0] && setCounts(data[0]))
    pull()
    const id = setInterval(pull, 3000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex h-full items-center gap-[80px] bg-brand p-[80px]">
      <div className="flex flex-1 flex-col gap-[40px]">
        <div className="flex items-center gap-[20px]">
          <img src="./genzlab-logo.png" alt="Gen Z Lab." className="h-[72px] w-[72px] rounded-full" />
          <span className="text-[36px] font-bold text-white">Gen Z Lab.</span>
          <span className="text-[28px] font-semibold text-[#CBB4FF]">2026년 3분기 워크샵</span>
        </div>

        <h1 className="text-[108px] font-bold leading-[1.08] tracking-[-0.03em] text-white">
          진실 셋,<br />거짓 하나.
        </h1>

        <div className="flex items-center gap-[24px]">
          <Counter label="접속 중" value={counts.joined_count} />
          <Counter label="3T1F 작성 완료" value={counts.written_count} />
          <WriteTimerBanner size="screen" />
        </div>
      </div>

      <div className="flex w-[480px] flex-none flex-col items-center gap-[24px] rounded-[40px] bg-white p-[44px]">
        {qr
          ? <img src={qr} alt="" className="h-[392px] w-[392px]" />
          : <div className="h-[392px] w-[392px] rounded-[20px] bg-surface" />}
        <span className="text-[36px] font-bold text-ink">QR을 스캔하고 입장</span>
        <span className="num text-[24px] font-semibold text-muted">{url.replace(/^https?:\/\//, '')}</span>
      </div>
    </div>
  )
}

function Counter({ label, value }) {
  return (
    <div className="flex flex-col gap-[6px] rounded-[28px] bg-white/10 px-[32px] py-[24px]">
      <span className="text-[24px] font-semibold text-[#CBB4FF]">{label}</span>
      <span className="num text-[80px] font-bold leading-none text-white">{value}</span>
    </div>
  )
}

/* ---------------------------------------------------------------- B2 */
function G1Board() {
  const [teams, setTeams] = useState([])

  useEffect(() => {
    const pull = () => supabase.rpc('get_screen_g1').then(({ data }) => setTeams(data ?? []))
    pull()
    const id = setInterval(pull, 2000)
    return () => clearInterval(id)
  }, [])

  const doneCount = teams.filter((t) => t.phase === 'done').length
  // 진행이 뒤처진 조를 반전 표시해 진행자가 콕 집어 독촉할 수 있게 한다.
  const lagging = teams.filter((t) => t.phase !== 'done' && t.elapsed > 150)

  return (
    <div className="flex h-full flex-col gap-[40px] bg-ink p-[64px_80px]">
      <div className="flex items-end justify-between">
        <h1 className="text-[72px] font-bold tracking-[-0.03em] text-white">게임 1 진행 중</h1>
        <div className="flex gap-[20px]">
          <Pill label="완료한 조" value={`${doneCount}/${teams.length}`} />
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-x-[40px] gap-y-[20px] content-start">
        {teams.map((t) => {
          const late = t.phase !== 'done' && t.elapsed > 150
          const pct = t.total > 0 ? (t.done / t.total) * 100 : 0
          return (
            <div
              key={t.team_no}
              className={`flex items-center gap-[24px] rounded-[24px] px-[28px] py-[20px] ${late ? 'bg-fake' : ''}`}
            >
              <span className={`w-[220px] shrink-0 truncate text-[30px] font-bold ${late ? 'text-white' : 'text-white'}`}>
                {t.name}
              </span>
              <div className="h-[34px] flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${
                    t.phase === 'done' ? 'bg-success' : late ? 'bg-white' : 'bg-brand'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="num w-[110px] shrink-0 text-right text-[28px] font-bold text-white">
                {t.done}/{t.total}
              </span>
            </div>
          )
        })}
      </div>

      {lagging.length > 0 && (
        <div className="rounded-[24px] bg-fake-tint px-[32px] py-[24px]">
          <span className="text-[30px] font-bold text-fake-on">
            {lagging.map((t) => t.name).join(' · ')} — 조금만 서둘러 주세요!
          </span>
        </div>
      )}
    </div>
  )
}

function Pill({ label, value }) {
  return (
    <div className="flex items-baseline gap-[14px] rounded-full bg-white/10 px-[28px] py-[16px]">
      <span className="text-[24px] font-semibold text-white/60">{label}</span>
      <span className="num text-[36px] font-bold text-white">{value}</span>
    </div>
  )
}

/**
 * 게임 2 대기. 게임 1 뒤 쉬는 시간에 늦게 오는 사람이 있어서 QR 을 함께 띄운다.
 * 이때 들어온 사람은 다음 문제부터 바로 풀 수 있고, 점수 분모는 응답자 기준이라
 * 늦게 들어와도 조 평균을 깎지 않는다.
 */
function Standby() {
  const { qr, url } = useEntryQr()
  return (
    <div className="flex h-full items-center gap-[80px] bg-ink p-[80px]">
      <div className="flex flex-1 flex-col gap-[24px]">
        <span className="text-[120px] font-bold leading-none tracking-[-0.03em] text-white">게임 2</span>
        <span className="text-[40px] font-semibold text-white/50">곧 첫 문제가 나옵니다</span>
      </div>
      <div className="flex w-[400px] flex-none flex-col items-center gap-[20px] rounded-[36px] bg-white p-[36px]">
        {qr
          ? <img src={qr} alt="" className="h-[328px] w-[328px]" />
          : <div className="h-[328px] w-[328px] rounded-[20px] bg-surface" />}
        <span className="text-[30px] font-bold text-ink">아직 못 들어왔다면 QR</span>
        <span className="num text-[24px] font-semibold text-muted">{url.replace(/^https?:\/\//, '')}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ B3 / B4 */
const OPTION_BG = ['bg-option-1', 'bg-option-2', 'bg-option-3', 'bg-option-4']
const OPTION_FG = ['text-white', 'text-[#3D2600]', 'text-white', 'text-white']

function QuestionBoard({ gameState }) {
  const [q, setQ] = useState(null)
  const remaining = useRemaining(q?.started_at, q?.time_limit_sec)

  useEffect(() => {
    const pull = () =>
      supabase.rpc('get_screen_question').then(({ data }) => {
        if (!data) return
        noteServerTime(data.server_now)
        setQ(data)
      })
    pull()
    const id = setInterval(pull, 1000)
    return () => clearInterval(id)
  }, [gameState?.current_question_id, gameState?.revealed])

  if (!q || q.state !== 'ok') return <Standby />
  if (q.revealed) return <AnswerBoard q={q} />

  const isOx = q.type === 'ox'
  const keys = isOx ? ['O', 'X'] : ['1', '2', '3', '4']

  return (
    <div className="flex h-full flex-col gap-[36px] bg-ink p-[56px_80px]">
      <div className="flex items-center justify-between">
        <span className="num rounded-full bg-white/10 px-[28px] py-[14px] text-[28px] font-bold text-white/80">
          문제 {q.ord} / {q.total} · {isOx ? 'O/X' : '4지선다'}
        </span>
        <div className="flex items-center gap-[32px]">
          <span className="num text-[52px] font-bold text-white">
            {q.answered_count}/{q.active_count}
          </span>
          <Timer remaining={remaining} limit={q.time_limit_sec} size={140} />
        </div>
      </div>

      <h1 className="text-[68px] font-bold leading-[1.25] tracking-[-0.02em] text-white">{q.body}</h1>

      {q.image_url && (
        <img src={q.image_url} alt="" className="h-[248px] w-[440px] rounded-[24px] object-cover" />
      )}

      <div className={`grid flex-1 gap-[24px] ${isOx ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`}>
        {keys.map((k, i) => (
          <div
            key={k}
            className={`flex items-center gap-[24px] rounded-[28px] px-[36px] py-[28px] ${
              isOx ? (k === 'O' ? 'bg-truth' : 'bg-fake') : OPTION_BG[i]
            }`}
          >
            <span className={`num flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-[20px] bg-black/20 text-[32px] font-bold ${isOx ? 'text-white' : OPTION_FG[i]}`}>
              {k}
            </span>
            <span className={`text-[44px] font-bold leading-[1.2] ${isOx ? 'text-white' : OPTION_FG[i]}`}>
              {isOx ? (k === 'O' ? '맞다' : '아니다') : q.options?.[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnswerBoard({ q }) {
  const isOx = q.type === 'ox'
  const keys = isOx ? ['O', 'X'] : ['1', '2', '3', '4']
  const dist = q.distribution ?? {}
  const maxN = Math.max(1, ...keys.map((k) => dist[k] ?? 0))

  return (
    <div className="flex h-full flex-col gap-[32px] bg-ink p-[56px_80px]">
      <div className="flex items-center gap-[28px]">
        <span className="rounded-full bg-success px-[32px] py-[14px] text-[28px] font-bold text-white">정답</span>
        <span className="text-[62px] font-bold tracking-[-0.02em] text-white">
          {isOx ? q.answer : `${q.answer}번 · ${q.options?.[Number(q.answer) - 1] ?? ''}`}
        </span>
      </div>

      {q.explanation && (
        <p className="text-[32px] leading-[1.5] text-white/70">{q.explanation}</p>
      )}

      <div className="flex flex-1 flex-col justify-center gap-[20px]">
        {keys.map((k, i) => {
          const n = dist[k] ?? 0
          const isAnswer = String(q.answer) === k
          return (
            <div key={k} className="flex items-center gap-[24px]">
              <span className="num w-[56px] shrink-0 text-[32px] font-bold text-white/70">{k}</span>
              <div className="h-[56px] flex-1 overflow-hidden rounded-[16px] bg-white/5">
                <div
                  className={`flex h-full items-center rounded-[16px] ${
                    isOx ? (k === 'O' ? 'bg-truth' : 'bg-fake') : OPTION_BG[i]
                  } ${isAnswer ? '' : 'opacity-40'}`}
                  style={{ width: `${Math.max(4, (n / maxN) * 100)}%` }}
                />
              </div>
              <span className="num w-[80px] shrink-0 text-right text-[32px] font-bold text-white">{n}</span>
              {isAnswer && <span className="w-[90px] text-[26px] font-bold text-success">정답</span>}
            </div>
          )
        })}
      </div>

      <div className="flex gap-[24px]">
        <Pill label="정답률" value={`${q.correct_rate ?? 0}%`} />
        {q.fastest && <Pill label="최속 정답" value={`${q.fastest.name} · ${q.fastest.sec}초`} />}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- B5 */
function Leaderboard({ final }) {
  const [board, setBoard] = useState([])
  const [shown, setShown] = useState(final ? 0 : 99)

  useEffect(() => {
    const pull = () => supabase.rpc('get_leaderboard').then(({ data }) => setBoard(data ?? []))
    pull()
    const id = setInterval(pull, 3000)
    return () => clearInterval(id)
  }, [])

  // 최종 시상은 3위 → 2위 → 1위 순차 공개.
  useEffect(() => {
    if (!final) return
    const id = setInterval(() => setShown((s) => Math.min(3, s + 1)), 1500)
    return () => clearInterval(id)
  }, [final])

  const top = board.slice(0, 3)
  const rest = board.slice(3)
  const podium = [top[2], top[1], top[0]]        // 3 · 2 · 1 순으로 세운다
  const heights = [300, 420, 540]
  const ranks = [3, 2, 1]

  return (
    <div className="flex h-full gap-[48px] bg-brand p-[56px_64px]">
      <div className="flex flex-1 flex-col gap-[32px]">
        <h1 className="text-[64px] font-bold tracking-[-0.03em] text-white">
          {final ? '최종 순위' : '중간 순위'}
        </h1>
        <div className="flex flex-1 items-end justify-center gap-[32px]">
          {podium.map((t, i) => {
            const visible = !final || shown >= i + 1
            const first = ranks[i] === 1
            return (
              <div key={ranks[i]} className="flex w-[240px] flex-col items-center gap-[16px]">
                <span className="text-[32px] font-bold text-white">{visible ? t?.name ?? '—' : ''}</span>
                <span className="num text-[28px] font-semibold text-[#CBB4FF]">
                  {visible ? t?.avg ?? '' : ''}
                </span>
                <div
                  className={`flex w-full items-start justify-center rounded-t-[24px] pt-[24px] transition-[height] duration-700 ${
                    first && visible ? 'animate-bob bg-brand-lime' : 'bg-white/15'
                  }`}
                  style={{ height: visible ? heights[i] : 0 }}
                >
                  <span className={`num text-[72px] font-bold ${first && visible ? 'text-brand-deep' : 'text-white'}`}>
                    {ranks[i]}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex w-[520px] flex-none flex-col gap-[16px] rounded-[32px] bg-white/10 p-[32px]">
        {rest.map((t, i) => (
          <div key={t.team_no} className="flex items-center justify-between">
            <span className="flex items-center gap-[20px]">
              <span className="num w-[44px] text-[28px] font-bold text-brand-lime">{i + 4}</span>
              <span className="text-[28px] font-semibold text-white">{t.name}</span>
            </span>
            <span className="num text-[28px] font-bold text-white/80">{t.avg}</span>
          </div>
        ))}
        <p className="mt-auto text-[24px] leading-[1.5] text-white/50">
          조 점수 = 조원 개인 점수 합 ÷ 실제 응답 조원 수
        </p>
      </div>
    </div>
  )
}
