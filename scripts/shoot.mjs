/**
 * README 스크린샷 촬영 — 그룹 단위로 여러 번 부른다.
 *
 *   node scripts/shoot.mjs <group>
 *
 * group:
 *   lobby  → B1 · 01-login · 02b · A3 · 02-lobby            (PIN 불필요)
 *   admin  → C1(전) · C2 · C3 · C4                          (PIN 필요 — 사람이 입력)
 *   g1     → B2 · 04-g1-speaker · 03-g1-vote · 05-g1-reveal (PIN 불필요)
 *   g2     → B3 · 06-g2-ox · 07-g2-mc · 08-g2-answer · B4   (PIN 불필요)
 *   board  → B5 · 10-final                                  (PIN 불필요)
 *
 * DB 상태(phase·문장·투표·답안)는 이 스크립트가 아니라 호출하는 쪽(SQL)이
 * 미리 맞춰 둔다. 이 스크립트는 순수 촬영만 한다 — navigate → sleep → screenshot.
 * deviceScaleFactor 2 고정.
 */
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// 안전장치: DB 에 demo 계정이 아닌 참가자가 하나라도 있으면 촬영을 중단한다.
// 이 스크립트는 seed 를 안 한다 — 화면에 보이는 명단은 그대로 저장소에 커밋된다.
// 실데이터가 남은 채로 돌리면 참가자 실명이 스크린샷에 박힌다(2026-09-03 사고).
{
  const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } })
  const { data } = await sb.from('participants').select('knox_id')
  const real = (data ?? []).filter((r) => !/^demo\d+$/.test(r.knox_id))
  if (real.length) {
    console.error(`\n중단: demo 아닌 참가자 ${real.length}명이 DB 에 있다. SQL Editor 로 데모를 심고 실명단을 치운 뒤 다시 실행하라.`)
    process.exit(1)
  }
}

const GROUP = process.argv[2]
const GROUPS = ['lobby', 'admin', 'g1', 'g1rev', 'g2', 'g2mc', 'g2ans', 'board', 'final']
if (!GROUPS.includes(GROUP)) { console.error('group: ' + GROUPS.join('|')); process.exit(1) }

const BASE = process.env.BASE_URL ?? 'http://localhost:5174/genz-lab-2026-q3-workshop/'
const OUT = path.resolve('docs/screens')
const PHONE = { width: 375, height: 812 }
const ADMIN = { width: 1440, height: 900 }
const SCREEN = { width: 1920, height: 1080 }
const SCALE = 2
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ headless: false })
const shot = async (page, f) => {
  try { await page.screenshot({ path: path.join(OUT, f), animations: 'disabled', timeout: 20000 }); console.log('  ✓ ' + f) }
  catch (e) { console.log('  ✗ ' + f + ' — ' + e.message.split('\n')[0]) }
}
async function phone(knox) {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: SCALE })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  if (knox) {
    await page.fill('#knox', knox)
    await page.getByRole('button', { name: '입장하기' }).click()
    await sleep(4000)
  } else { await sleep(1800) }
  return { ctx, page }
}
async function screenView(file, wait = 3000) {
  const ctx = await browser.newContext({ viewport: SCREEN, deviceScaleFactor: SCALE })
  const page = await ctx.newPage()
  await page.goto(`${BASE}#/screen`, { waitUntil: 'domcontentloaded' })
  await sleep(wait)
  await shot(page, file)
  await ctx.close()
}

try {
  if (GROUP === 'lobby') {
    await screenView('B1-screen-lobby.png')
    const l = await phone(null); await shot(l.page, '01-login.png'); await l.ctx.close()
    const s = await phone('demo60'); await shot(s.page, '02b-statement-form.png'); await s.ctx.close()
    const t = await phone('demo59'); await shot(t.page, 'A3-team-wait.png'); await t.ctx.close()
    const b = await phone('demo01'); await shot(b.page, '02-lobby.png'); await b.ctx.close()
  }

  if (GROUP === 'admin') {
    const ctx = await browser.newContext({ viewport: ADMIN, deviceScaleFactor: SCALE })
    const A = await ctx.newPage()
    await A.goto(`${BASE}#/admin`, { waitUntil: 'domcontentloaded' }); await sleep(2500)
    await shot(A, 'C1-admin-pin.png')
    console.log('\n  ▶ 창에 관리자 PIN 4자리 입력. 창 닫지 말 것. (최대 5분)\n')
    await A.getByRole('button', { name: '대시보드', exact: true }).waitFor({ state: 'visible', timeout: 300_000 })
    console.log('  PIN 통과.\n')
    await sleep(1500); await shot(A, 'C2-admin-dashboard.png')
    await A.getByRole('button', { name: '명단 · 조 편성', exact: true }).click(); await sleep(1800)
    await shot(A, 'C3-admin-roster.png')
    await A.getByRole('button', { name: '문항 관리', exact: true }).click(); await sleep(1500)
    await shot(A, 'C4-admin-questions.png')
    await ctx.close()
  }

  if (GROUP === 'g1') {
    await screenView('B2-screen-g1.png')
    const spk = await phone('demo01'); await shot(spk.page, '04-g1-speaker.png'); await spk.ctx.close()
    const v1 = await phone('demo11'); await shot(v1.page, '03-g1-vote.png'); await v1.ctx.close()
  }
  if (GROUP === 'g1rev') {
    const rv = await phone('demo21'); await shot(rv.page, '05-g1-reveal.png'); await rv.ctx.close()
  }

  if (GROUP === 'g2') {
    await screenView('B3-screen-question.png', 2500)
    const ox = await phone('demo03'); await shot(ox.page, '06-g2-ox.png'); await ox.ctx.close()
    // 07·08 은 호출부에서 phase 를 mc/answer 로 바꾼 뒤 다시 이 스크립트를 g2mc/g2ans 로 부른다
  }
  if (GROUP === 'g2mc') { const p = await phone('demo03'); await shot(p.page, '07-g2-mc.png'); await p.ctx.close() }
  if (GROUP === 'g2ans') {
    const p = await phone('demo03'); await shot(p.page, '08-g2-answer.png'); await p.ctx.close()
    await screenView('B4-screen-answer.png', 2500)
  }

  if (GROUP === 'board') {
    await screenView('B5-screen-leaderboard.png', 3500)
  }
  if (GROUP === 'final') {
    const f = await phone('demo03'); await sleep(2500); await shot(f.page, '10-final.png'); await f.ctx.close()
  }
} finally {
  await browser.close()
}
