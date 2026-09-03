/**
 * README 스크린샷 재촬영. 데모를 심고 → 찍고 → 실명단을 복원한다.
 *
 *   npm run dev            (다른 터미널)
 *   node scripts/refresh-screens.mjs <backup.json>
 *
 * 관리자 진행은 대시보드 버튼을 눌러서 한다(PIN 은 sessionStorage 에 있고
 * 스크립트는 PIN 을 모른다). 투표처럼 PIN 이 필요 없는 건 참여자 페이지의
 * window.__sb 로 직접 부른다(dev 빌드가 노출).
 *
 * deviceScaleFactor 2 고정 — 기존 컷과 배율을 맞춘다.
 * 중간에 깨져도 finally 에서 반드시 복원한다.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const BACKUP = process.argv[2]
if (!BACKUP || !fs.existsSync(BACKUP)) { console.error('사용법: node scripts/refresh-screens.mjs <backup.json>'); process.exit(1) }
const backup = JSON.parse(fs.readFileSync(BACKUP, 'utf8'))

const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
  .filter((l) => l && !l.startsWith('#') && l.includes('='))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })

const BASE = process.env.BASE_URL ?? 'http://localhost:5174/genz-lab-2026-q3-workshop/'
const OUT = path.resolve('docs/screens')
const PHONE = { width: 375, height: 812 }
const ADMIN = { width: 1440, height: 900 }
const SCREEN = { width: 1920, height: 1080 }
const SCALE = 2

const TEAM_NAMES = ['반짝이는 팀', '무한도전', '오늘도 맑음', '커피 한 잔', '슬기로운 워크샵',
  '브레인스토밍', '라이징 스타', '텐션 업', '마지막 주자', '플랜비']
const FAM = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임']
const GIVEN = ['서준', '하윤', '도윤', '시우', '지우', '예준', '하은', '서아', '하준', '지호',
  '주원', '지안', '수아', '지민', '건우', '서현', '민준', '유진', '현우', '채원',
  '주하', '수빈', '예린', '준서', '가온', '도훈', '지원', '민재', '태윤', '시윤',
  '유나', '아린', '준혁', '하람', '다은', '재윤', '나윤', '시온', '연우', '은우',
  '서윤', '지훈', '채은', '민서', '준우', '하연', '도현', '지율', '수현', '예은',
  '시후', '가람', '준영', '하율', '서우', '지아', '민규', '유주', '연재', '태현']
const pname = (i) => FAM[i % 10] + GIVEN[i % GIVEN.length]

const QUESTIONS = [
  { ord: 1, type: 'ox', body: '커피 원두는 콩이 아니라 열매의 씨앗이다.', options: [], answer: 'O', time_limit_sec: 15, explanation: '커피체리 안의 씨앗을 볶은 것이다.' },
  { ord: 2, type: 'ox', body: '문어의 심장은 한 개다.', options: [], answer: 'X', time_limit_sec: 15, explanation: '문어의 심장은 세 개다.' },
  { ord: 3, type: 'ox', body: '번개는 같은 곳에 두 번 치지 않는다.', options: [], answer: 'X', time_limit_sec: 15, explanation: '높은 건물엔 여러 번 친다.' },
  { ord: 4, type: 'ox', body: '바나나는 식물학적으로 베리에 속한다.', options: [], answer: 'O', time_limit_sec: 15, explanation: '딸기는 베리가 아니고 바나나는 베리다.' },
  { ord: 5, type: 'mc', body: '다음 중 실제로 존재하지 않는 색 이름은?', options: ['비리디언', '마젠타', '세피아', '옥타린'], answer: '4', time_limit_sec: 20, explanation: '옥타린은 소설 속 가상의 색입니다.' },
  { ord: 6, type: 'mc', body: '세계에서 가장 널리 쓰이는 문자 체계는?', options: ['라틴 문자', '한자', '아랍 문자', '키릴 문자'], answer: '1', time_limit_sec: 20, explanation: '라틴 문자가 가장 많은 언어에서 쓰인다.' },
  { ord: 7, type: 'mc', body: '다음 중 포유류가 아닌 것은?', options: ['돌고래', '박쥐', '펭귄', '고래'], answer: '3', time_limit_sec: 20, explanation: '펭귄은 조류다.' },
  { ord: 8, type: 'mc', body: '워크샵에서 가장 중요한 것은?', options: ['점심 메뉴', '팀워크', '와이파이', '커피'], answer: '2', time_limit_sec: 20, explanation: '정답은 팀워크입니다. (예시 문항)' },
]

const shot = (p, f) => p.screenshot({ path: path.join(OUT, f), animations: 'disabled' }).then(() => console.log('  ✓ ' + f), (e) => console.log('  ✗ ' + f + ' — ' + e.message))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function wipe() {
  await sb.from('answers').delete().gte('question_id', -1)
  await sb.from('votes_3t1f').delete().neq('voter_knox', '')
  await sb.from('statements').delete().gte('id', -1)
  await sb.from('team_g1_state').delete().gte('team_no', -1)
  await sb.from('participants').delete().neq('knox_id', '')
  await sb.from('questions').delete().gte('id', -1)
  await sb.from('teams').delete().gte('team_no', -1)
}
async function seed() {
  console.log('데모 심는 중…')
  await sb.from('teams').insert(TEAM_NAMES.map((n, i) => ({ team_no: i + 1, name: n, is_active: true, ord: i + 1 })))
  const ppl = []
  for (let i = 1; i <= 60; i++) {
    ppl.push({
      knox_id: 'demo' + String(i).padStart(2, '0'),
      name: pname(i - 1),
      team_no: i === 59 ? null : (((i - 1) % 10) + 1),   // demo59 = 팀 없음
      is_active: true, is_preregistered: true,
    })
  }
  await sb.from('participants').insert(ppl)
  const rows = []
  for (let i = 1; i <= 59; i++) {                          // demo60 = 문장 없음
    const knox = 'demo' + String(i).padStart(2, '0')
    const order = [1, 2, 3, 4].sort(() => Math.random() - 0.5)
    const lie = Math.floor(Math.random() * 4)
    for (let k = 0; k < 4; k++) rows.push({ knox_id: knox, ord: order[k], content: k === lie ? `사실은 아니었던 이야기 ${i}` : `실제로 있었던 일 ${i}-${k + 1}`, is_lie: k === lie })
  }
  await sb.from('statements').insert(rows)
  await sb.from('questions').insert(QUESTIONS)
  await sb.from('game_state').update({ phase: 'lobby', current_question_id: null, question_started_at: null, revealed: false, notice: null, write_started_at: null, write_limit_sec: null }).eq('id', 1)
  console.log('  ✓ 10팀 · 60명 · 문장 59인분 · 문항 8개')
}
async function restore() {
  console.log('\n실명단 복원 중…')
  try {
    await wipe()
    await sb.from('teams').insert(backup.teams)
    await sb.from('participants').insert(backup.participants)
    if (backup.questions?.length) await sb.from('questions').insert(backup.questions)
    await sb.from('game_state').update({
      phase: backup.game_state.phase, notice: backup.game_state.notice, revealed: backup.game_state.revealed,
      write_started_at: null, write_limit_sec: null, current_question_id: null, question_started_at: null,
      speed_bonus_enabled: backup.game_state.speed_bonus_enabled, hard_cut_enabled: backup.game_state.hard_cut_enabled,
    }).eq('id', 1)
    const { count } = await sb.from('participants').select('*', { count: 'exact', head: true })
    console.log(`  ✓ 복원 완료 — participants ${count} (기대 ${backup.participants.length})`)
  } catch (e) {
    console.error('  ✗ 복원 실패 — 백업 JSON 으로 수동 복원 필요:', e.message)
  }
}

async function member(browser, knox, vp = PHONE) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: SCALE })
  const page = await ctx.newPage()
  await page.goto(BASE)
  await page.fill('#knox', knox)
  await page.getByRole('button', { name: '입장하기' }).click()
  return { ctx, page }
}

const browser = await chromium.launch({ headless: false })
const adminCtx = await browser.newContext({ viewport: ADMIN, deviceScaleFactor: SCALE })
const A = await adminCtx.newPage()
const screenCtx = await browser.newContext({ viewport: SCREEN, deviceScaleFactor: SCALE })
const S = await screenCtx.newPage()
const btn = (n) => A.getByRole('button', { name: n, exact: true })
const screenAt = async (hashPhase, file, wait = 1800) => { await S.goto(`${BASE}#/screen`); await sleep(wait); await shot(S, file) }

try {
  await wipe(); await seed()

  await A.goto(`${BASE}#/admin`)
  await shot(A, 'C1-admin-pin.png')
  console.log('\n  ▶ 창에 관리자 PIN 4자리 입력 (최대 5분)\n')
  await btn('대시보드').waitFor({ state: 'visible', timeout: 300_000 })
  console.log('  PIN 통과.\n')

  // ---- 로비 + 작성 배너 ----
  await A.getByText('3T1F 작성 시간').waitFor()
  await A.getByRole('button', { name: '시작', exact: true }).click()   // 작성 타이머 켜기(배너 노출용)
  await sleep(1200)
  await screenAt('lobby', 'B1-screen-lobby.png')

  const fresh = await browser.newContext({ viewport: PHONE, deviceScaleFactor: SCALE })
  const F = await fresh.newPage()
  await F.goto(BASE)
  await shot(F, '01-login.png')
  await F.fill('#knox', 'guest.demo')
  await F.getByRole('button', { name: '입장하기' }).click()
  await F.locator('input').first().waitFor({ timeout: 8000 })
  await F.locator('input').first().fill('게스트')
  await F.getByRole('button').filter({ hasText: /입장|시작|다음|확인|완료/ }).first().click().catch(() => {})
  await F.getByText('내 문장 만들기').waitFor({ timeout: 10_000 })
  await shot(F, '02b-statement-form.png')
  await fresh.close()

  const late = await member(browser, 'demo59')
  await late.page.getByText('팀 배정을 기다리는 중').waitFor({ timeout: 15_000 })
  await shot(late.page, 'A3-team-wait.png')
  await late.ctx.close()

  const p1 = await member(browser, 'demo01')
  await p1.page.getByText('곧 시작합니다').waitFor({ timeout: 15_000 })
  await shot(p1.page, '02-lobby.png')

  await A.getByRole('button', { name: '중지', exact: true }).click().catch(() => {})   // 타이머 끄기

  // ---- 관리자 탭 ----
  await btn('대시보드').click(); await A.getByText('진행 컨트롤').waitFor()
  await shot(A, 'C2-admin-dashboard.png')
  await btn('명단 · 팀 편성').click(); await A.getByText('명단 CSV 업로드').waitFor()
  await shot(A, 'C3-admin-roster.png')
  await btn('문항 관리').click(); await sleep(700)
  await shot(A, 'C4-admin-questions.png')

  // ---- 게임 1 ----
  await btn('대시보드').click()
  await btn('게임 1 시작').click()
  await sleep(2500)
  await screenAt('game1', 'B2-screen-g1.png', 2500)

  const team1 = ['demo01', 'demo11', 'demo21', 'demo31', 'demo41', 'demo51']
  const view = await p1.page.evaluate((k) => window.__sb.rpc('get_g1_view', { p_knox_id: k }).then((r) => r.data), 'demo01')
  const spk = view?.speaker?.knox_id && team1.includes(view.speaker.knox_id) ? view.speaker.knox_id : 'demo01'
  const voters = team1.filter((k) => k !== spk)

  const speakerP = spk === 'demo01' ? p1 : await member(browser, spk)
  await sleep(1500)
  await shot(speakerP.page, '04-g1-speaker.png')

  const vP = await member(browser, voters[0])
  await sleep(2500)
  await shot(vP.page, '03-g1-vote.png')

  for (const vk of voters) {
    await vP.page.evaluate(([voter, target]) => window.__sb.rpc('cast_vote', { p_voter: voter, p_target: target, p_ord: 4 }), [vk, spk]).catch(() => {})
  }
  await sleep(1500)
  await vP.page.reload(); await sleep(2000)
  await shot(vP.page, '05-g1-reveal.png')
  await vP.ctx.close()
  if (speakerP !== p1) await speakerP.ctx.close()

  // ---- 게임 2 ----
  await btn('게임 2 시작').click(); await sleep(1000)
  await screenAt('game2_wait', '09b-screen-game2wait.png', 1800)

  await A.getByRole('button', { name: /첫 문제 출제|다음 문제 출제/ }).first().click(); await sleep(1500)
  await screenAt('game2_question', 'B3-screen-question.png', 1800)

  const g2 = await member(browser, 'demo02')
  await sleep(2500)
  await shot(g2.page, '06-g2-ox.png')

  // mc 문항까지 넘긴다 (q1→q5 = 4번)
  for (let i = 0; i < 4; i++) { await A.getByRole('button', { name: /다음 문제 출제/ }).first().click(); await sleep(1200) }
  await g2.page.reload(); await sleep(2000)
  await shot(g2.page, '07-g2-mc.png')

  await g2.page.locator('button').filter({ hasText: /옥타린/ }).first().click().catch(() => {})
  await g2.page.getByRole('button').filter({ hasText: /제출|확정|답안/ }).first().click().catch(() => {})
  await sleep(800)
  await btn('정답 공개').click(); await sleep(1500)
  await g2.page.reload(); await sleep(2000)
  await shot(g2.page, '08-g2-answer.png')
  await screenAt('game2_answer', 'B4-screen-answer.png', 1800)
  await g2.ctx.close()

  // ---- 리더보드 / 최종 ----
  await btn('중간 리더보드').click(); await sleep(1200)
  await screenAt('leaderboard', 'B5-screen-leaderboard.png', 2500)

  await btn('최종 시상').click(); await sleep(1200)
  await p1.page.reload(); await sleep(2500)
  await shot(p1.page, '10-final.png')
  await p1.ctx.close()

  console.log('\n촬영 완료.')
} catch (e) {
  console.error('\n오류:', e.stack)
} finally {
  await restore()
  await browser.close()
}
