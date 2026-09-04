import { useState } from 'react'
import { supabase } from '../../lib/supabase'

/** A2 — 미등록자 이름 입력. 이름만 넣으면 팀 배정 대기 상태로 입장한다. */
export default function NameEntry({ knoxId, onJoined, onBack }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = name.trim().length > 0 && !busy

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.rpc('join_session', {
      p_knox_id: knoxId,
      p_name: name.trim(),
    })
    setBusy(false)
    if (error) {
      setError('입장에 실패했습니다. 다시 시도해 주세요.')
      return
    }
    onJoined(data)
  }

  return (
    <form onSubmit={submit} className="flex h-full flex-col bg-surface">
      <div
        className="flex flex-col gap-[6px] bg-white px-[24px] pb-[18px]"
        style={{ paddingTop: 'max(56px, calc(env(safe-area-inset-top, 0px) + 20px))' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="self-start text-[12px] font-bold text-fake"
        >
          명단에 없는 Knox ID
        </button>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">이름을 알려주세요</h1>
      </div>

      <div className="flex flex-1 flex-col gap-[16px] p-[24px]">
        <div className="flex flex-col gap-[10px] rounded-[22px] bg-white p-[20px]">
          <label htmlFor="name" className="text-[13px] font-semibold text-muted">이름</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="김젠지"
            autoComplete="off"
            enterKeyHint="go"
            autoFocus
            className="h-[58px] rounded-[16px] border-2 border-brand bg-white px-[18px] text-[19px] font-semibold text-ink outline-none placeholder:text-[#C4C2CE]"
          />
          <p className="text-[12px] text-[#9A98A6]">
            사번 <span className="num">{knoxId}</span> · 진행자가 팀을 배정합니다
          </p>
          {error && <p className="text-[13px] font-semibold text-fake">{error}</p>}
        </div>

        <p className="rounded-[18px] border border-[#FFD9D5] bg-fake-tint p-[16px] text-[13px] leading-[1.6] text-[#A8271B]">
          이름을 넣으면 바로 입장해 3T1F 작성을 시작할 수 있습니다. 팀 배정은 그 사이에 진행됩니다.
        </p>
      </div>

      <div
        className="px-[20px]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}
      >
        <button
          type="submit"
          disabled={!canSubmit}
          className="h-[60px] w-full rounded-cta bg-brand text-[19px] font-bold text-white disabled:bg-line disabled:text-[#A09EAB]"
        >
          {busy ? '입장 중…' : '확인하고 입장'}
        </button>
      </div>
    </form>
  )
}
