import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { normalizeKnoxId } from '../../lib/session'

/** A1 — Knox ID 로그인. 배경 brand 전면. */
export default function Login({ onJoined, onNeedName }) {
  const [knoxId, setKnoxId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const id = normalizeKnoxId(knoxId)
  const canSubmit = id.length > 0 && !busy

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('join_session', { p_knox_id: id })
    setBusy(false)

    if (error) {
      // 명단에 없는 Knox ID → 이름 입력 화면(A2)으로
      if (error.message.includes('NOT_PREREGISTERED')) return onNeedName(id)
      setError('입장에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.')
      return
    }
    onJoined(data)
  }

  return (
    <form
      onSubmit={submit}
      className="flex h-full flex-col justify-between bg-brand"
      style={{
        paddingTop: 'max(76px, calc(env(safe-area-inset-top, 0px) + 24px))',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
      }}
    >
      <div className="flex flex-col gap-[16px] px-[28px]">
        <div className="flex items-center gap-[10px]">
          <img
            src="./genzlab-logo.png"
            alt="Gen Z Lab."
            className="block h-[32px] w-[32px] flex-none rounded-[10px]"
          />
          <span className="text-[17px] font-bold text-white">Gen Z Lab.</span>
        </div>
        <div className="text-[15px] font-semibold text-[#CBB4FF]">2026년 3분기 워크샵</div>
        <h1 className="mt-[18px] text-[42px] font-bold leading-[1.15] tracking-[-0.03em] text-white">
          진실 셋,<br />거짓 하나.
        </h1>
        <p className="text-[15px] font-normal leading-[1.6] text-[#D5C6FF]">
          Knox ID만 입력하면 바로 입장합니다.
        </p>
      </div>

      <div className="flex flex-col gap-[12px] px-[20px]">
        <div className="flex flex-col gap-[10px] rounded-[24px] bg-white p-[20px]">
          <label htmlFor="knox" className="text-[13px] font-semibold text-muted">Knox ID</label>
          <input
            id="knox"
            value={knoxId}
            onChange={(e) => setKnoxId(e.target.value)}
            placeholder="genzlab.mx"
            /* 모바일 키보드의 자동 대문자·자동수정이 켜져 있으면
               명단에 있는 사람이 "명단에 없음"으로 튕긴다. */
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            className="num h-[58px] rounded-[16px] border-2 border-line bg-surface px-[18px] text-[18px] font-medium text-ink outline-none placeholder:text-[#B3B1BD] focus:border-brand"
          />
          {error && <p className="text-[13px] font-semibold text-fake">{error}</p>}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-[60px] rounded-cta bg-brand-lime text-[19px] font-bold text-brand-deep transition-opacity disabled:bg-line disabled:text-[#A09EAB]"
        >
          {busy ? '입장 중…' : '입장하기'}
        </button>

        <p className="text-center text-[12px] text-[#C0ABF5]">
          명단에 없으면 이름 입력 후 조 배정을 기다립니다
        </p>
      </div>
    </form>
  )
}
