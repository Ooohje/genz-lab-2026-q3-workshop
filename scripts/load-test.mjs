/**
 * 60명 동시접속 부하 테스트.
 *
 *   N=60 DURATION=60 node scripts/load-test.mjs
 *
 * 실제 앱이 하는 것과 같은 패턴으로 가상 참가자 N 명을 띄운다 —
 * 각자 별도 supabase 클라이언트(= 폰 1대 = WebSocket 1개)로:
 *   - join_session 으로 입장 (동시 폭주)
 *   - game_state Realtime 구독 1개
 *   - 폴링: game_state 5s · get_g1_view 2s · get_my_statements+get_team_roster 5s
 *           · participants 본인 행 15s  (useGameState/useG1/useMyGame/useParticipant 와 동일)
 *   - 시작 5초 뒤 전원이 동시에 save_statements (행사 초반의 실제 폭주)
 *
 * 끝나면 RPC 별 지연 p50/p95/p99/max, 오류, Realtime 구독 성공 수, 초당 요청수를 찍는다.
 *
 * 만드는 계정은 loadtest01~N 이고 스크립트가 지우지 않는다(anon 은 delete 권한이 없다).
 * 끝에 정리용 SQL 을 출력하니 SQL Editor 나 MCP 로 돌린다.
 *
 * .env 의 공개 키만 쓴다. 관리자 PIN 은 필요 없고 쓰지도 않는다.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }),
)
const URL = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY

const N = Number(process.env.N ?? 60)
const DURATION = Number(process.env.DURATION ?? 60) * 1000
const PREFIX = 'loadtest'

// ---- 계측 ------------------------------------------------------------
const lat = {}      // name -> [ms]
const errs = {}     // name -> {code: count}
let total = 0
function rec(name, ms, error) {
  total++
  ;(lat[name] ??= []).push(ms)
  if (error) {
    const k = error.code ?? error.message?.slice(0, 40) ?? 'unknown'
    ;(errs[name] ??= {})[k] = ((errs[name] ??= {})[k] ?? 0) + 1
  }
}
async function timed(name, fn) {
  const t = performance.now()
  const r = await fn()
  rec(name, performance.now() - t, r?.error)
  return r
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }

// ---- 가상 참가자 -------------------------------------------------------
function makeUser(i) {
  const knox = `${PREFIX}${String(i).padStart(2, '0')}`
  const sb = createClient(URL, KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 10 } } })
  return { i, knox, sb, subscribed: false, timers: [], channel: null }
}

async function join(u) {
  await timed('join_session', () => u.sb.rpc('join_session', { p_knox_id: u.knox, p_name: `부하${u.i}` }))
}

function subscribe(u) {
  return new Promise((resolve) => {
    const t = performance.now()
    u.channel = u.sb
      .channel(`game_state:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state', filter: 'id=eq.1' }, () => {})
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') { u.subscribed = true; rec('realtime_subscribe', performance.now() - t); resolve() }
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') { rec('realtime_subscribe', performance.now() - t, { code: s }); resolve() }
      })
    setTimeout(resolve, 15000) // 안전망
  })
}

function every(u, ms, fn) {
  const id = setInterval(fn, ms)
  u.timers.push(id)
}

function startPolling(u) {
  every(u, 5000, () => timed('game_state.select', () => u.sb.from('game_state').select('*').eq('id', 1).single()))
  every(u, 2000, () => timed('get_g1_view', () => u.sb.rpc('get_g1_view', { p_knox_id: u.knox })))
  every(u, 5000, () => timed('get_my_statements', () => u.sb.rpc('get_my_statements', { p_knox_id: u.knox })))
  every(u, 5000, () => timed('get_team_roster', () => u.sb.rpc('get_team_roster', { p_knox_id: u.knox })))
  every(u, 15000, () => timed('participants.select', () => u.sb.from('participants').select('*').eq('knox_id', u.knox).single()))
}

async function writeBurst(users) {
  await Promise.all(users.map((u) =>
    timed('save_statements', () => u.sb.rpc('save_statements', {
      p_knox_id: u.knox,
      p_truths: [`진실 A ${u.i}`, `진실 B ${u.i}`, `진실 C ${u.i}`],
      p_lie: `거짓 ${u.i}`,
    })),
  ))
}

function stop(u) {
  u.timers.forEach(clearInterval)
  if (u.channel) u.sb.removeChannel(u.channel)
}

// ---- 실행 --------------------------------------------------------------
console.log(`\n부하 테스트: ${N}명 · ${DURATION / 1000}초 · ${URL}\n`)
const users = Array.from({ length: N }, (_, i) => makeUser(i + 1))
const t0 = performance.now()

console.log('1) 입장 폭주 (join_session × ' + N + ' 동시)')
await Promise.all(users.map(join))

console.log('2) Realtime 구독 × ' + N)
await Promise.all(users.map(subscribe))
console.log(`   구독 성공 ${users.filter((u) => u.subscribed).length}/${N}`)

console.log('3) 폴링 시작 (' + DURATION / 1000 + '초)')
users.forEach(startPolling)

setTimeout(async () => {
  console.log('4) 5초 경과 — 전원 동시 save_statements')
  await writeBurst(users)
}, 5000)

await new Promise((r) => setTimeout(r, DURATION))
users.forEach(stop)
const elapsed = (performance.now() - t0) / 1000

// ---- 결과 --------------------------------------------------------------
console.log('\n' + '='.repeat(72))
console.log(`결과 — ${N}명 · ${elapsed.toFixed(0)}초 · 총 ${total} 요청 · ${(total / elapsed).toFixed(1)} req/s`)
console.log('='.repeat(72))
console.log('RPC'.padEnd(22) + 'n'.padStart(6) + 'p50'.padStart(8) + 'p95'.padStart(8) + 'p99'.padStart(8) + 'max'.padStart(8) + '  오류')
for (const [name, a] of Object.entries(lat).sort()) {
  const e = errs[name] ? Object.entries(errs[name]).map(([k, v]) => `${k}×${v}`).join(', ') : '-'
  console.log(
    name.padEnd(22) + String(a.length).padStart(6)
    + pct(a, 0.5).toFixed(0).padStart(8) + pct(a, 0.95).toFixed(0).padStart(8)
    + pct(a, 0.99).toFixed(0).padStart(8) + Math.max(...a).toFixed(0).padStart(8)
    + '  ' + e,
  )
}
const errTotal = Object.values(errs).reduce((s, o) => s + Object.values(o).reduce((a, b) => a + b, 0), 0)
console.log('-'.repeat(72))
console.log(`Realtime 구독 성공: ${users.filter((u) => u.subscribed).length}/${N}   오류 합계: ${errTotal} (${(errTotal / total * 100).toFixed(2)}%)`)
console.log(`\n정리 SQL:\n  delete from participants where knox_id like '${PREFIX}%';\n`)
process.exit(0)
