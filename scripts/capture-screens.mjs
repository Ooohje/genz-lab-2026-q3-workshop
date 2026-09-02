/**
 * README 용 실화면 캡처.
 *
 *   npm run dev            (다른 터미널에서 먼저 띄운다)
 *   node scripts/capture-screens.mjs
 *
 * 창이 하나 뜨고 관리자 PIN 입력을 기다린다. 사람이 직접 입력해야 한다 —
 * PIN 평문은 이 저장소 어디에도 두지 않는다(CLAUDE.md 규칙).
 * 입력하면 나머지는 자동으로 진행되고, 끝나면 바꿔둔 상태를 되돌린다.
 *
 * 주의 1 — deviceScaleFactor 는 2 로 고정한다.
 *   docs/screens/ 의 기존 컷이 전부 2배 PNG 다(참여자 750×1624 · 스크린
 *   3840×2160 · 관리자 2880×1800). 여기를 바꾸면 새로 찍은 것만 배율이
 *   어긋나 README 에서 한 장씩 흐릿하게 보인다.
 *
 * 주의 2 — networkidle 을 기다리지 않는다.
 *   앱이 2~5초 간격으로 계속 폴링하므로 네트워크가 영원히 조용해지지 않는다.
 *   항상 "그 화면에만 있는 문구"를 셀렉터로 기다린다.
 *
 * 주의 3 — confirm()/prompt() 를 띄우는 버튼은 건드리지 않는다.
 *   관리자 화면의 조 삭제·초기화·개인정보 삭제가 그렇다. 모달이 뜨면
 *   그 뒤 조작이 전부 막힌다.
 */
import { chromium } from 'playwright'
import path from 'node:path'

const BASE = process.env.BASE_URL ?? 'http://localhost:5174/genz-lab-2026-q3-workshop/'
const OUT = path.resolve('docs/screens')

const PHONE = { width: 375, height: 812 }   // 참여자 기준 해상도
const ADMIN = { width: 1440, height: 900 }  // 관리자 기준 해상도
const SCALE = 2                             // 주의 1 참조

/** 캡처용으로 잠깐 조에서 빼낼 사람. 문장을 다 쓴 사람이어야 조 배정 대기 화면이 나온다. */
const UNASSIGN = { knox: 'demo06', team: '1' }
/** 게임 2 대기 화면을 찍을 사람. 조가 배정돼 있어야 한다. */
const PLAYER = 'demo01'

const shot = (page, name) =>
  page.screenshot({ path: path.join(OUT, name), animations: 'disabled' })
    .then(() => console.log(`  ✓ ${name}`))

const browser = await chromium.launch({ headless: false })

const admin = await browser.newContext({ viewport: ADMIN, deviceScaleFactor: SCALE })
const adminPage = await admin.newPage()

const tab = (name) => adminPage.getByRole('button', { name, exact: true })

try {
  await adminPage.goto(`${BASE}#/admin`)

  console.log('\n  브라우저 창에 관리자 PIN 4자리를 입력하세요. (최대 5분 대기)\n')
  await tab('대시보드').waitFor({ state: 'visible', timeout: 300_000 })
  console.log('  PIN 통과. 캡처를 시작합니다.\n')

  // --- 관리자 3탭 -----------------------------------------------------
  // 명단 탭에는 실명·실사번 형태의 테스트 계정이 한 행 있다(99조). 저장소가
  // public 이므로 fullPage 로 찍지 않는다 — 첫 화면에는 1~4조만 들어온다.
  await tab('대시보드').click()
  await adminPage.getByText('진행 컨트롤').waitFor()
  await shot(adminPage, 'C2-admin-dashboard.png')

  await tab('명단 · 조 편성').click()
  await adminPage.getByText('명단 CSV 업로드').waitFor()
  await shot(adminPage, 'C3-admin-roster.png')

  await tab('문항 관리').click()
  await adminPage.waitForTimeout(600)
  await shot(adminPage, 'C4-admin-questions.png')

  // --- 게임 2 대기 화면 -----------------------------------------------
  await tab('대시보드').click()
  await adminPage.getByRole('button', { name: '게임 2 시작' }).click()
  await adminPage.waitForTimeout(1200)

  const p1 = await browser.newContext({ viewport: PHONE, deviceScaleFactor: SCALE })
  const page1 = await p1.newPage()
  await page1.goto(BASE)
  await page1.fill('#knox', PLAYER)
  await page1.getByRole('button', { name: '입장하기' }).click()
  await page1.getByText('다음 문제를 기다리는 중').waitFor({ timeout: 30_000 })
  await shot(page1, '09-g2-wait.png')
  await p1.close()

  // --- 조 배정 대기 화면 ----------------------------------------------
  await tab('명단 · 조 편성').click()
  const member = adminPage.locator('li', { hasText: UNASSIGN.knox })
  await member.locator('select').selectOption('')
  await adminPage.waitForTimeout(1200)

  const p2 = await browser.newContext({ viewport: PHONE, deviceScaleFactor: SCALE })
  const page2 = await p2.newPage()
  await page2.goto(BASE)
  await page2.fill('#knox', UNASSIGN.knox)
  await page2.getByRole('button', { name: '입장하기' }).click()
  await page2.getByText('조 배정을 기다리는 중').waitFor({ timeout: 30_000 })
  await shot(page2, 'A3-team-wait.png')
  await p2.close()
} finally {
  // --- 원상복구 -------------------------------------------------------
  // 캡처가 중간에 깨져도 DB 를 건드린 채로 두지 않는다.
  console.log('\n  상태를 되돌립니다…')
  try {
    await tab('명단 · 조 편성').click()
    await adminPage.locator('li', { hasText: UNASSIGN.knox })
      .locator('select').selectOption(UNASSIGN.team)
    await adminPage.waitForTimeout(800)

    await tab('대시보드').click()
    await adminPage.getByRole('button', { name: '최종 시상' }).click()
    await adminPage.waitForTimeout(800)
    console.log('  ✓ 조 배정 복구 · phase=final')
  } catch (e) {
    console.error('  ✗ 복구 실패 — 관리자 화면에서 직접 확인하세요:', e.message)
  }
  await browser.close()
}
