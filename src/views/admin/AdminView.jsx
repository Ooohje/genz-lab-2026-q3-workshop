import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PHASE_LABEL } from '../../lib/phases'
import { useGameState } from '../../hooks/useGameState'
import Dashboard from './Dashboard'
import Roster from './Roster'
import Questions from './Questions'

const PIN_KEY = 'genzlab.adminpin'

/**
 * 관리자 뷰 (#/admin). 기준 해상도 1440 × 900.
 *
 * PIN 은 여기서 "화면을 열지 말지"만 결정한다. 실제 권한은 서버가 쥔다 —
 * 모든 변경 RPC 가 PIN 을 다시 검증하므로, 이 화면을 우회해도 아무것도 못 바꾼다.
 */
export default function AdminView() {
  const [pin, setPin] = useState(() => sessionStorage.getItem(PIN_KEY) ?? null)
  const [tab, setTab] = useState('dashboard')
  const { gameState } = useGameState()

  if (!pin) return <PinGate onOk={(p) => { sessionStorage.setItem(PIN_KEY, p); setPin(p) }} />

  const TABS = [
    ['dashboard', '대시보드'],
    ['roster', '명단 · 팀 편성'],
    ['questions', '문항 관리'],
  ]

  return (
    <div className="flex h-full flex-col bg-surface">
      <header className="flex h-[64px] flex-none items-center gap-[20px] border-b border-line bg-white px-[24px]">
        <div className="flex items-center gap-[10px]">
          <img src="./genzlab-logo.png" alt="Gen Z Lab." className="h-[28px] w-[28px] rounded-full" />
          <span className="text-[15px] font-bold text-ink">Gen Z Lab. 관리자</span>
        </div>

        <nav className="flex gap-[6px]">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-full px-[16px] py-[8px] text-[13px] font-bold ${
                tab === id ? 'bg-brand-tint text-brand-on' : 'text-muted hover:bg-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <span className="num ml-auto rounded-full bg-success-tint px-[12px] py-[6px] text-[12px] font-bold text-success-on">
          phase: {gameState?.phase ?? '…'}
        </span>
        <span className="text-[12px] font-semibold text-muted">
          {PHASE_LABEL[gameState?.phase] ?? ''}
        </span>
        <button
          onClick={() => { sessionStorage.removeItem(PIN_KEY); setPin(null) }}
          className="text-[12px] font-bold text-muted hover:text-fake"
        >
          잠금
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {tab === 'dashboard' && <Dashboard pin={pin} gameState={gameState} />}
        {tab === 'roster' && <Roster pin={pin} />}
        {tab === 'questions' && <Questions pin={pin} />}
      </div>
    </div>
  )
}

/** C1 — PIN 로그인. */
function PinGate({ onOk }) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null)]
  const pin = digits.join('')

  useEffect(() => { refs[0].current?.focus() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(value) {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('admin_verify_pin', { p_pin: value })
    setBusy(false)
    if (error || !data) {
      setError('PIN이 올바르지 않습니다')
      setDigits(['', '', '', ''])
      refs[0].current?.focus()
      return
    }
    onOk(value)
  }

  function setAt(i, v) {
    const c = v.replace(/\D/g, '').slice(-1)
    const next = digits.map((d, j) => (j === i ? c : d))
    setDigits(next)
    if (c && i < 3) refs[i + 1].current?.focus()
    if (next.every(Boolean)) submit(next.join(''))
  }

  return (
    <div className="flex h-full items-center justify-center bg-surface">
      <div className="flex w-[520px] flex-col gap-[26px] rounded-[32px] bg-white p-[40px] shadow-[0_12px_40px_rgba(23,22,28,.1)]">
        <div className="flex items-center gap-[12px]">
          <img src="./genzlab-logo.png" alt="Gen Z Lab." className="h-[36px] w-[36px] rounded-full" />
          <span className="text-[17px] font-bold text-ink">Gen Z Lab. 관리자</span>
        </div>

        <div className="flex flex-col gap-[10px]">
          <span className="text-[13px] font-semibold text-muted">PIN 4자리</span>
          <div className="flex gap-[12px]">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={refs[i]}
                value={d}
                inputMode="numeric"
                type="password"
                onChange={(e) => setAt(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !d && i > 0) refs[i - 1].current?.focus()
                }}
                className="num h-[72px] w-[72px] rounded-[18px] border-2 border-line bg-surface text-center text-[28px] font-bold text-ink outline-none focus:border-brand"
              />
            ))}
          </div>
          {error && <p className="text-[13px] font-semibold text-fake">{error}</p>}
        </div>

        <button
          onClick={() => submit(pin)}
          disabled={pin.length < 4 || busy}
          className="h-[56px] rounded-cta bg-brand text-[17px] font-bold text-white disabled:bg-line disabled:text-[#A09EAB]"
        >
          {busy ? '확인 중…' : '들어가기'}
        </button>

        <p className="text-[12px] leading-[1.6] text-muted">
          PIN은 서버에서 검증합니다. 이 화면을 우회해도 진행 상태를 바꿀 수 없습니다.
        </p>
      </div>
    </div>
  )
}
