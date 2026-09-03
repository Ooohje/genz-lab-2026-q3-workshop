import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/**
 * C3 — 명단 · 조 편성.
 * 조도 조원도 전부 유동적이다. 조 수와 조당 인원은 기본값일 뿐 고정이 아니다.
 */
export default function Roster({ pin }) {
  const [data, setData] = useState({ teams: [], participants: [] })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const pull = useCallback(async () => {
    const { data } = await supabase.rpc('admin_roster', { p_pin: pin })
    if (data) setData(data)
  }, [pin])

  useEffect(() => {
    pull()
    const id = setInterval(pull, 5000)
    return () => clearInterval(id)
  }, [pull])

  async function call(fn, args) {
    setBusy(true)
    const { error } = await supabase.rpc(fn, { p_pin: pin, ...args })
    setBusy(false)
    if (error) setMsg(error.message)
    await pull()
  }

  async function uploadCsv(file) {
    const text = await file.text()
    // knox_id,name,team_no — 헤더 행이 있으면 건너뛴다.
    const rows = text.split(/\r?\n/)
      .map((l) => l.trim()).filter(Boolean)
      .map((l) => l.split(',').map((c) => c.trim()))
      .filter((c) => c[0] && !/knox/i.test(c[0]))
      .map(([knox_id, name, team_no]) => ({ knox_id, name, team_no: team_no || null }))

    if (!rows.length) return setMsg('읽을 행이 없습니다. knox_id,name,team_no 형식인지 확인하세요.')
    setBusy(true)
    const { data, error } = await supabase.rpc('admin_upload_roster', { p_pin: pin, p_rows: rows })
    setBusy(false)
    setMsg(error ? error.message : `${data}명 업로드 완료`)
    await pull()
  }

  const unassigned = data.participants.filter((p) => p.team_no == null)

  return (
    <div className="flex flex-col gap-[16px] p-[24px]">
      <div className="flex flex-wrap items-center gap-[10px]">
        <label className="cursor-pointer rounded-[12px] bg-brand px-[14px] py-[10px] text-[13px] font-bold text-white">
          명단 CSV 업로드
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadCsv(e.target.files[0])}
          />
        </label>
        <button
          onClick={() => {
            // 조 이름은 쓰지 않는다 — 번호만 받고 이름은 'N조'로 자동 채운다.
            const nextNo = data.teams.reduce((m, t) => Math.max(m, t.team_no), 0) + 1
            const no = Number(prompt('조 번호', String(nextNo)))
            if (!no) return
            call('admin_upsert_team', {
              p_team_no: no, p_name: `${no}조`, p_is_active: true, p_ord: no,
            })
          }}
          className="rounded-[12px] bg-surface px-[14px] py-[10px] text-[13px] font-bold text-ink"
        >
          조 추가
        </button>

        <span className="num rounded-full bg-white px-[12px] py-[6px] text-[12px] font-bold text-muted">
          {data.participants.length}명 / {data.teams.length}조
        </span>
        {unassigned.length > 0 && (
          <span className="num rounded-full bg-warn-tint px-[12px] py-[6px] text-[12px] font-bold text-warn-on">
            배정 대기 {unassigned.length}
          </span>
        )}
        {msg && <span className="text-[12px] font-semibold text-brand">{msg}</span>}
      </div>

      <p className="text-[12px] text-muted">
        CSV 형식: <span className="num">knox_id,name,team_no</span> · Knox ID는 자동으로 소문자로 저장됩니다.
        게임 1 도중 조를 옮기면 그 사람의 기존 투표는 무효 처리됩니다.
      </p>

      <div className="grid grid-cols-4 gap-[14px]">
        {unassigned.length > 0 && (
          <TeamCard
            title="배정 대기"
            warn
            members={unassigned}
            teams={data.teams}
            onAssign={(k, t) => call('admin_assign', { p_knox_id: k, p_team_no: t })}
            onToggle={(k, v) => call('admin_set_active', { p_knox_id: k, p_is_active: v })}
            onRenameMember={(k, n) => call('admin_rename_participant', { p_knox_id: k, p_name: n })}
            onChangeKnox={(k, nk) => call('admin_change_knox_id', { p_old: k, p_new: nk })}
            onReset={(k) => call('admin_reset_participant', { p_knox_id: k })}
            onDelete={(k) => call('admin_delete_participant', { p_knox_id: k })}
            busy={busy}
          />
        )}

        {data.teams.map((t) => (
          <TeamCard
            key={t.team_no}
            title={t.name}
            subtitle={`${t.team_no}조`}
            members={data.participants.filter((p) => p.team_no === t.team_no)}
            teams={data.teams}
            onRename={() => {
              const n = prompt('조 이름', t.name)
              if (n) call('admin_upsert_team', {
                p_team_no: t.team_no, p_name: n, p_is_active: t.is_active, p_ord: t.ord,
              })
            }}
            onDeleteTeam={() => confirm(`${t.name} 조를 삭제할까요? 조원은 배정 대기로 돌아갑니다.`)
              && call('admin_delete_team', { p_team_no: t.team_no })}
            onAssign={(k, tn) => call('admin_assign', { p_knox_id: k, p_team_no: tn })}
            onToggle={(k, v) => call('admin_set_active', { p_knox_id: k, p_is_active: v })}
            onRenameMember={(k, n) => call('admin_rename_participant', { p_knox_id: k, p_name: n })}
            onChangeKnox={(k, nk) => call('admin_change_knox_id', { p_old: k, p_new: nk })}
            onReset={(k) => call('admin_reset_participant', { p_knox_id: k })}
            onDelete={(k) => call('admin_delete_participant', { p_knox_id: k })}
            busy={busy}
          />
        ))}
      </div>
    </div>
  )
}

function TeamCard({
  title, subtitle, warn, members, teams,
  onRename, onDeleteTeam, onAssign, onToggle, onRenameMember, onChangeKnox, onReset, onDelete, busy,
}) {
  return (
    <section className={`flex flex-col gap-[10px] rounded-[18px] p-[14px] ${warn ? 'bg-warn-tint' : 'bg-white'}`}>
      <div className="flex items-baseline justify-between gap-[6px]">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13px] font-bold text-ink">{title}</span>
          {subtitle && <span className="num text-[11px] text-muted">{subtitle}</span>}
        </div>
        <span className="num shrink-0 text-[11px] font-bold text-muted">{members.length}명</span>
      </div>

      <ul className="flex flex-col gap-[6px]">
        {members.map((m) => (
          <li
            key={m.knox_id}
            className={`flex flex-col gap-[4px] rounded-[12px] bg-surface p-[8px] ${m.is_active ? '' : 'opacity-50'}`}
          >
            <div className="flex items-center justify-between gap-[4px]">
              <button
                title="이름 정정"
                disabled={busy}
                onClick={() => {
                  const n = prompt('이름', m.name)
                  if (n && n.trim() && n.trim() !== m.name) onRenameMember(m.knox_id, n.trim())
                }}
                className="flex min-w-0 items-center gap-[3px] text-[12px] font-semibold text-ink"
              >
                <span className="truncate">{m.name}</span>
                <span className="shrink-0 text-[10px] text-muted">✎</span>
              </button>
              <span
                className={`shrink-0 rounded-full px-[6px] py-[2px] text-[10px] font-bold ${
                  m.has_statements ? 'bg-success-tint text-success-on' : 'bg-warn-tint text-warn-on'
                }`}
              >
                {m.has_statements ? '완료' : '미작성'}
              </span>
            </div>
            <button
              title="Knox ID 정정 — 작성·투표·답안은 새 ID 로 옮겨진다"
              disabled={busy}
              onClick={() => {
                const nk = prompt('Knox ID', m.knox_id)
                if (nk && nk.trim().toLowerCase() !== m.knox_id) {
                  onChangeKnox(m.knox_id, nk.trim().toLowerCase())
                }
              }}
              className="num flex min-w-0 items-center gap-[3px] text-left text-[10px] text-muted"
            >
              <span className="truncate">{m.knox_id}</span>
              <span className="shrink-0">✎</span>
            </button>
            <div className="flex items-center gap-[4px]">
              <select
                value={m.team_no ?? ''}
                disabled={busy}
                onChange={(e) => onAssign(m.knox_id, e.target.value ? Number(e.target.value) : null)}
                className="min-w-0 flex-1 rounded-[8px] border border-line bg-white px-[4px] py-[3px] text-[11px]"
              >
                <option value="">미배정</option>
                {teams.map((t) => (
                  <option key={t.team_no} value={t.team_no}>{t.name}</option>
                ))}
              </select>
              <button
                title={m.is_active ? '비활성화' : '활성화'}
                onClick={() => onToggle(m.knox_id, !m.is_active)}
                className="shrink-0 rounded-[8px] bg-white px-[6px] py-[3px] text-[10px] font-bold text-muted"
              >
                {m.is_active ? '비활성' : '활성'}
              </button>
              <button
                title="이 사람의 문장·투표·답안 초기화"
                onClick={() => confirm(`${m.name}님의 작성·투표·답안을 초기화할까요?`) && onReset(m.knox_id)}
                className="shrink-0 rounded-[8px] bg-white px-[6px] py-[3px] text-[10px] font-bold text-muted"
              >
                초기화
              </button>
              <button
                onClick={() => confirm(`${m.name}님을 명단에서 삭제할까요?`) && onDelete(m.knox_id)}
                className="shrink-0 rounded-[8px] bg-white px-[6px] py-[3px] text-[10px] font-bold text-fake"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
        {members.length === 0 && <li className="text-[11px] text-muted">비어 있음</li>}
      </ul>

      {onRename && (
        <div className="mt-auto flex gap-[6px] pt-[4px]">
          <button onClick={onRename} className="text-[11px] font-bold text-brand hover:underline">
            이름 변경
          </button>
          <button onClick={onDeleteTeam} className="text-[11px] font-bold text-fake hover:underline">
            조 삭제
          </button>
        </div>
      )}
    </section>
  )
}
