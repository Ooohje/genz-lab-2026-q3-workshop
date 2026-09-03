import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import TopBar from '../../components/TopBar'
import BottomBar from '../../components/BottomBar'
import Cta from '../../components/Cta'

const PLACEHOLDERS = [
  '예: 번지점프를 3번 해봤다',
  '예: 고등학교 때 밴드 보컬이었다',
  '예: 사내 마라톤 완주 경험이 있다',
]

/**
 * A4 / A5 — 3T1F 작성 폼.
 * 진실 3칸 + 거짓 1칸. 칸 자체가 거짓을 지정하므로 별도 선택이 없다.
 * 순서 셔플은 저장 시점에 서버(save_statements)가 한 번만 한다.
 */
export default function StatementForm({ participant, teamName, existing, onSaved }) {
  const [truths, setTruths] = useState(['', '', ''])
  const [lie, setLie] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  // 이미 쓴 게 있으면 채워서 보여준다(수정 가능). 표시 순서는 섞여 있지만
  // 어차피 저장할 때 다시 섞이므로 진실/거짓만 갈라 담으면 된다.
  useEffect(() => {
    if (!existing?.length) return
    setTruths(existing.filter((s) => !s.is_lie).map((s) => s.content).slice(0, 3))
    setLie(existing.find((s) => s.is_lie)?.content ?? '')
  }, [existing])

  const filled = truths.filter((t) => t.trim()).length + (lie.trim() ? 1 : 0)
  const canSubmit = filled === 4 && !busy

  async function submit() {
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('save_statements', {
      p_knox_id: participant.knox_id,
      p_truths: truths.map((t) => t.trim()),
      p_lie: lie.trim(),
    })
    setBusy(false)
    if (error) {
      setError(
        error.message.includes('ALREADY_VOTED')
          ? '이미 팀원들이 투표를 시작해서 문장을 바꿀 수 없습니다.'
          : '저장에 실패했습니다. 다시 시도해 주세요.',
      )
      return
    }
    onSaved()
  }

  return (
    <div className="flex h-full flex-col bg-surface">
      <TopBar participant={participant} teamName={teamName} />

      <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto p-[22px_20px]">
        <div className="flex flex-col gap-[4px]">
          <h1 className="text-[24px] font-bold tracking-[-0.02em] text-ink">내 문장 만들기</h1>
          <p className="text-[13px] text-muted">진실 3개 + 거짓 1개. 저장하면 순서가 섞입니다.</p>
        </div>

        {truths.map((value, i) => (
          <Field
            key={i}
            n={i + 1}
            label="진실"
            tone="truth"
            value={value}
            placeholder={PLACEHOLDERS[i]}
            onChange={(v) => setTruths((prev) => prev.map((t, j) => (j === i ? v : t)))}
          />
        ))}

        <Field
          n={4}
          label="거짓 — 이 칸만 거짓"
          tone="fake"
          value={lie}
          placeholder="예: 라면을 한 번도 먹은 적 없다"
          onChange={setLie}
        />

        {error && <p className="text-[13px] font-semibold text-fake">{error}</p>}
      </div>

      <BottomBar>
        <Cta onClick={submit} disabled={!canSubmit}>
          {busy ? '저장 중…' : `작성 완료 (${filled}/4)`}
        </Cta>
      </BottomBar>
    </div>
  )
}

function Field({ n, label, tone, value, placeholder, onChange }) {
  const isFake = tone === 'fake'
  const filled = value.trim().length > 0
  // 선택/강조는 border 가 아니라 inset box-shadow 로 준다. 레이아웃이 안 흔들린다.
  const ring = isFake
    ? 'shadow-[inset_0_0_0_2px_#F0392B]'
    : filled
      ? 'shadow-[inset_0_0_0_2px_#2F5CF0]'
      : 'shadow-[inset_0_0_0_2px_#DFE6FF]'

  return (
    <div className={`flex flex-col gap-[7px] rounded-[18px] p-[14px_16px] ${isFake ? 'bg-fake-tint' : 'bg-white'} ${ring}`}>
      <div className="flex items-center gap-[7px]">
        <span
          className={`num flex h-[20px] w-[20px] items-center justify-center rounded-[7px] text-[11px] font-bold text-white ${isFake ? 'bg-fake' : 'bg-truth'}`}
        >
          {n}
        </span>
        <span className={`text-[12px] font-bold ${isFake ? 'text-fake' : 'text-truth'}`}>{label}</span>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={80}
        className={`w-full bg-transparent text-[15px] text-ink outline-none ${isFake ? 'placeholder:text-[#D69B93]' : 'placeholder:text-[#B3B1BD]'}`}
      />
    </div>
  )
}
