import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import Timer from '../../../components/Timer'

const OPTION_COLORS = ['bg-option-1', 'bg-option-2', 'bg-option-3', 'bg-option-4']
const OPTION_TEXT = ['text-white', 'text-[#3D2600]', 'text-white', 'text-white']

/**
 * A13 (O/X) · A14 (4지선다 + 이미지) · A14b (4지선다 텍스트 전용)
 *
 * 제출은 1회 확정이다. 게임 1 의 재선택 허용과 정반대라 문구로도 명시한다.
 * 4지선다에는 truth/fake 를 쓰지 않는다 — O/X 의미와 혼동되기 때문에
 * option-1…4 별도 4색을 쓴다.
 */
export default function Question({ participant, question, remaining, onSubmitted }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const isOx = question.type === 'ox'
  const hasImage = Boolean(question.image_url)

  async function submit(choice) {
    if (busy) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('submit_answer', {
      p_knox_id: participant.knox_id,
      p_choice: choice,
    })
    setBusy(false)
    if (error) {
      if (error.message.includes('ALREADY_ANSWERED')) return onSubmitted()
      setError(error.message.includes('TOO_LATE') ? '시간이 종료되었습니다.' : '제출에 실패했습니다.')
      return
    }
    onSubmitted()
  }

  return (
    <div className="flex h-full flex-col bg-ink">
      <div className="flex flex-none items-center justify-between px-[20px] pt-[20px]">
        <span className="num rounded-full bg-white/10 px-[11px] py-[5px] text-[11px] font-bold text-white/80">
          문제 {question.ord} / {question.total} · {isOx ? 'O/X' : '4지선다'}
        </span>
        <span className="num text-[12px] font-semibold text-white/50">
          {question.answered_count}/{question.active_count} 응답
        </span>
      </div>

      {/* 이미지가 있으면 세로 공간을 아끼려 타이머를 문제 좌측에 인라인으로 둔다 */}
      <div className={`flex flex-1 flex-col justify-center gap-[20px] p-[20px] ${hasImage ? '' : 'items-center'}`}>
        {hasImage ? (
          <>
            <img
              src={question.image_url}
              alt=""
              className="h-[140px] w-full rounded-[18px] object-cover"
            />
            <div className="flex items-center gap-[14px]">
              <Timer remaining={remaining} limit={question.time_limit_sec} size={52} />
              <h1 className="flex-1 text-[22px] font-bold leading-[1.35] tracking-[-0.02em] text-white">
                {question.body}
              </h1>
            </div>
          </>
        ) : (
          <>
            <Timer remaining={remaining} limit={question.time_limit_sec} size={82} />
            <h1 className="text-center text-[26px] font-bold leading-[1.35] tracking-[-0.02em] text-white">
              {question.body}
            </h1>
          </>
        )}

        {error && <p className="text-[13px] font-semibold text-fake">{error}</p>}
      </div>

      <div
        className="flex flex-none flex-col gap-[10px] px-[20px]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
      >
        {isOx ? (
          <div className="flex gap-[12px]">
            <BigChoice color="bg-truth" glyph="O" label="맞다" onClick={() => submit('O')} disabled={busy} />
            <BigChoice color="bg-fake" glyph="X" label="아니다" onClick={() => submit('X')} disabled={busy} />
          </div>
        ) : (
          (question.options ?? []).map((opt, i) => (
            <button
              key={i}
              disabled={busy}
              onClick={() => submit(String(i + 1))}
              className={`flex items-center gap-[12px] rounded-[20px] p-[16px] text-left ${OPTION_COLORS[i]} ${hasImage ? 'min-h-[64px]' : 'min-h-[88px]'}`}
            >
              <span className={`num flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[10px] bg-black/20 text-[13px] font-bold ${OPTION_TEXT[i]}`}>
                {i + 1}
              </span>
              <span className={`flex-1 text-[16px] font-semibold leading-[1.4] ${OPTION_TEXT[i]}`}>
                {opt}
              </span>
            </button>
          ))
        )}
        <p className="pt-[2px] text-center text-[12px] text-white/40">
          한 번 제출하면 변경할 수 없어요
        </p>
      </div>
    </div>
  )
}

function BigChoice({ color, glyph, label, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[150px] flex-1 flex-col items-center justify-center gap-[4px] rounded-[26px] ${color}`}
    >
      <span className="num text-[62px] font-bold leading-none text-white">{glyph}</span>
      <span className="text-[15px] font-bold text-white/80">{label}</span>
    </button>
  )
}
