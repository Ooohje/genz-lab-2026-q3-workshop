import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const EMPTY = {
  id: null, ord: 1, type: 'ox', body: '',
  options: ['', '', '', ''], answer: 'O', time_limit_sec: 15,
  image_url: '', explanation: '',
}

const OPTION_DOT = ['bg-option-1', 'bg-option-2', 'bg-option-3', 'bg-option-4']

/** C4 — 문항 관리. 정답은 관리자만 볼 수 있다(참여자는 RLS 로 차단). */
export default function Questions({ pin }) {
  const [list, setList] = useState([])
  const [draft, setDraft] = useState(EMPTY)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const pull = useCallback(async () => {
    const { data } = await supabase.rpc('admin_list_questions', { p_pin: pin })
    if (data) setList(data)
  }, [pin])

  useEffect(() => { pull() }, [pull])

  async function save() {
    setBusy(true)
    setMsg(null)
    const { error } = await supabase.rpc('admin_upsert_question', {
      p_pin: pin,
      p_id: draft.id,
      p_ord: Number(draft.ord),
      p_type: draft.type,
      p_body: draft.body,
      p_options: draft.type === 'mc' ? draft.options : [],
      p_answer: String(draft.answer),
      p_time_limit_sec: Number(draft.time_limit_sec),
      p_image_url: draft.image_url || null,
      p_explanation: draft.explanation || null,
    })
    setBusy(false)
    if (error) return setMsg(error.message)
    setMsg('저장했습니다')
    setDraft(EMPTY)
    await pull()
  }

  async function remove(id) {
    if (!confirm('이 문항을 삭제할까요?')) return
    await supabase.rpc('admin_delete_question', { p_pin: pin, p_id: id })
    if (draft.id === id) setDraft(EMPTY)
    await pull()
  }

  const isMc = draft.type === 'mc'

  return (
    <div className="flex gap-[20px] p-[24px]">
      <aside className="flex w-[420px] flex-none flex-col gap-[10px]">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-ink">문항 {list.length}개</h2>
          <button
            onClick={() => setDraft({ ...EMPTY, ord: list.length + 1 })}
            className="rounded-[10px] bg-brand px-[12px] py-[7px] text-[12px] font-bold text-white"
          >
            새 문항
          </button>
        </div>

        <ul className="flex flex-col gap-[8px]">
          {list.map((q) => (
            <li key={q.id}>
              <button
                onClick={() => setDraft({
                  ...q,
                  options: q.type === 'mc'
                    ? [0, 1, 2, 3].map((i) => q.options?.[i] ?? '')
                    : ['', '', '', ''],
                  image_url: q.image_url ?? '',
                  explanation: q.explanation ?? '',
                })}
                className={`flex w-full items-center gap-[10px] rounded-[14px] bg-white p-[12px] text-left ${
                  draft.id === q.id ? 'shadow-[0_0_0_2px_#6A2FF0]' : ''
                }`}
              >
                <span className="num w-[20px] shrink-0 text-[12px] font-bold text-muted">{q.ord}</span>
                <span
                  className={`shrink-0 rounded-full px-[8px] py-[3px] text-[10px] font-bold ${
                    q.type === 'ox' ? 'bg-truth-tint text-truth-on' : 'bg-brand-tint text-brand-on'
                  }`}
                >
                  {q.type === 'ox' ? 'O/X' : '4지선다'}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{q.body}</span>
                <span className="num shrink-0 text-[11px] text-muted">{q.time_limit_sec}s</span>
              </button>
            </li>
          ))}
          {list.length === 0 && (
            <li className="rounded-[14px] bg-white p-[16px] text-[12px] text-muted">
              아직 문항이 없습니다. 권장 구성은 O/X 4문항 + 4지선다 4문항입니다.
            </li>
          )}
        </ul>
      </aside>

      <section className="flex flex-1 flex-col gap-[14px] rounded-[20px] bg-white p-[20px]">
        <div className="flex items-center gap-[8px]">
          {['ox', 'mc'].map((t) => (
            <button
              key={t}
              onClick={() => setDraft((d) => ({
                ...d, type: t, answer: t === 'ox' ? 'O' : '1',
              }))}
              className={`rounded-full px-[14px] py-[8px] text-[13px] font-bold ${
                draft.type === t ? 'bg-brand-tint text-brand-on' : 'bg-surface text-muted'
              }`}
            >
              {t === 'ox' ? 'O/X' : '4지선다'}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-[8px]">
            <label className="text-[12px] font-semibold text-muted">순서</label>
            <input
              type="number"
              value={draft.ord}
              onChange={(e) => setDraft((d) => ({ ...d, ord: e.target.value }))}
              className="num w-[60px] rounded-[10px] border border-line px-[8px] py-[6px] text-[13px]"
            />
            <label className="text-[12px] font-semibold text-muted">제한시간</label>
            <select
              value={draft.time_limit_sec}
              onChange={(e) => setDraft((d) => ({ ...d, time_limit_sec: e.target.value }))}
              className="num rounded-[10px] border border-line px-[8px] py-[6px] text-[13px]"
            >
              {[5, 7, 10, 15, 20, 30].map((s) => <option key={s} value={s}>{s}초</option>)}
            </select>
          </span>
        </div>

        <Field label="문제">
          <textarea
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            rows={2}
            className="w-full rounded-[12px] border border-line p-[10px] text-[14px] outline-none focus:border-brand"
          />
        </Field>

        <Field label="이미지 지문 (Supabase Storage URL, 선택)">
          <input
            value={draft.image_url}
            onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
            placeholder="https://…/storage/v1/object/public/…"
            className="w-full rounded-[12px] border border-line p-[10px] text-[13px] outline-none focus:border-brand"
          />
        </Field>

        {isMc ? (
          <Field label="보기 · 정답 선택">
            {draft.options.map((o, i) => (
              <div
                key={i}
                className={`flex items-center gap-[10px] rounded-[12px] p-[8px] ${
                  String(draft.answer) === String(i + 1) ? 'bg-success-tint' : ''
                }`}
              >
                <span className={`h-[16px] w-[16px] shrink-0 rounded-[5px] ${OPTION_DOT[i]}`} />
                <input
                  value={o}
                  onChange={(e) => setDraft((d) => ({
                    ...d, options: d.options.map((v, j) => (j === i ? e.target.value : v)),
                  }))}
                  className="flex-1 rounded-[10px] border border-line px-[10px] py-[7px] text-[13px] outline-none focus:border-brand"
                />
                <label className="flex shrink-0 items-center gap-[4px] text-[12px] font-bold text-muted">
                  <input
                    type="radio"
                    checked={String(draft.answer) === String(i + 1)}
                    onChange={() => setDraft((d) => ({ ...d, answer: String(i + 1) }))}
                  />
                  정답
                </label>
              </div>
            ))}
          </Field>
        ) : (
          <Field label="정답">
            <div className="flex gap-[10px]">
              {['O', 'X'].map((v) => (
                <button
                  key={v}
                  onClick={() => setDraft((d) => ({ ...d, answer: v }))}
                  className={`num h-[52px] w-[80px] rounded-[16px] text-[22px] font-bold ${
                    draft.answer === v
                      ? v === 'O' ? 'bg-truth text-white' : 'bg-fake text-white'
                      : 'bg-surface text-muted'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="해설 (정답 공개 시 한 줄, 선택)">
          <input
            value={draft.explanation}
            onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
            className="w-full rounded-[12px] border border-line p-[10px] text-[13px] outline-none focus:border-brand"
          />
        </Field>

        <div className="mt-auto flex items-center gap-[10px]">
          <button
            onClick={save}
            disabled={busy || !draft.body.trim()}
            className="rounded-[12px] bg-brand px-[18px] py-[11px] text-[14px] font-bold text-white disabled:bg-line disabled:text-[#A09EAB]"
          >
            {draft.id ? '수정 저장' : '문항 추가'}
          </button>
          {draft.id && (
            <button
              onClick={() => remove(draft.id)}
              className="rounded-[12px] border-2 border-fake px-[18px] py-[10px] text-[14px] font-bold text-fake"
            >
              삭제
            </button>
          )}
          <button onClick={() => setDraft(EMPTY)} className="text-[13px] font-bold text-muted">
            취소
          </button>
          {msg && <span className="text-[12px] font-semibold text-brand">{msg}</span>}
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-[6px]">
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      {children}
    </div>
  )
}
