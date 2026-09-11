/**
 * 스크린 뷰(#/screen) 전용 사운드 엔진. 빔프로젝터 노트북 한 대에서만 돈다.
 *
 * 왜 이렇게 생겼나:
 *  - 브라우저 자동재생 차단 때문에 페이지 로드 후 "사용자 클릭 1회" 전에는
 *    어떤 소리도 못 낸다. soundEnable() 을 그 클릭 콜백에서 부른다.
 *  - 효과음(틱·땡·차임)은 파일 없이 Web Audio 로 합성한다. 로딩 실패가 없다.
 *  - 배경 베드는 public/sound/<name>.mp3 가 있으면 그걸 루프한다.
 *    없으면(404·타임아웃) 그냥 조용히 넘어간다 — 예전엔 합성 패드로 대체했지만
 *    실제 음악 파일을 넣기로 해서 뺐다(2026-09-11).
 *
 * ScreenView 외의 화면에서는 부르지 않는다(참여자 폰 60대에서 소리가 나면 안 된다).
 */

const LS_KEY = 'genzlab.sound' // 'on' 이면 다음 로드에서도 소리를 원함(클릭은 여전히 필요)

// 베드 이름 → mp3 경로 + 목표 볼륨. 파일은 public/sound/ 에 둔다.
// bgm.mp3 = 원곡 0:05~4:05, game2.mp3 = 원곡 33:25~37:25(그 지점부터 다른
// 곡으로 바뀌어서 게임 2 전용으로 따로 잘랐다). 상세는 public/sound/README 참고.
const BEDS = {
  lobby: { src: './sound/bgm.mp3', vol: 0.3 },
  game1: { src: './sound/bgm.mp3', vol: 0.1 },
  game2: { src: './sound/game2.mp3', vol: 0.22 },
  leaderboard: { src: './sound/bgm.mp3', vol: 0.38 },
}

let ctx = null
let master = null // 전체 볼륨(음소거용)
let enabled = false
let muted = false
let bedName = null
let bed = null // { el, node, gain } | null(파일 없어서 무음)
let fadeSec = 0.6

function now() {
  return ctx ? ctx.currentTime : 0
}

/** 이전에 소리를 켠 적이 있는지(오버레이 표시 여부 판단용). */
export function soundWanted() {
  try {
    return localStorage.getItem(LS_KEY) === 'on'
  } catch {
    return false
  }
}

/** 지금 이 로드에서 오디오가 살아 있는지. */
export function soundIsEnabled() {
  return enabled
}

export function soundIsMuted() {
  return muted
}

/**
 * 사용자 제스처(클릭) 안에서 호출. AudioContext 를 만들고 resume 한다.
 * 여러 번 불러도 안전하다.
 */
export async function soundEnable() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return false
      ctx = new AC()
      master = ctx.createGain()
      master.gain.value = muted ? 0 : 1
      master.connect(ctx.destination)
    }
    if (ctx.state === 'suspended') await ctx.resume()
    enabled = true
    try {
      localStorage.setItem(LS_KEY, 'on')
    } catch {
      /* noop */
    }
    // enable 직전에 setBed 로 예약해 둔 이름이 있으면 지금 실제로 재생한다.
    if (bedName) {
      const want = bedName
      bedName = null
      soundSetBed(want)
    }
    return true
  } catch {
    return false
  }
}

/** 음소거 토글. 엔진은 계속 돌고 master 게인만 0 으로 램프한다. */
export function soundSetMuted(next) {
  muted = !!next
  try {
    localStorage.setItem(LS_KEY, muted ? 'off' : 'on')
  } catch {
    /* noop */
  }
  if (master && ctx) {
    const t = now()
    master.gain.cancelScheduledValues(t)
    master.gain.setValueAtTime(master.gain.value, t)
    master.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.25)
  }
}

/**
 * 베드 전환. 같은 이름이면 무시. enable 전이면 이름만 기억해 뒀다가
 * soundEnable() 이 재생을 시작한다. mp3 가 없으면 조용히 무음으로 남는다.
 */
export function soundSetBed(name) {
  if (!BEDS[name]) return
  if (bedName === name) return
  bedName = name
  if (!enabled || !ctx) return

  const spec = BEDS[name]
  const old = bed
  bed = null

  // 이전 베드 페이드아웃 후 정지
  if (old?.gain) {
    const t = now()
    old.gain.gain.cancelScheduledValues(t)
    old.gain.gain.setValueAtTime(old.gain.gain.value, t)
    old.gain.gain.linearRampToValueAtTime(0, t + fadeSec)
    setTimeout(() => stopBed(old), (fadeSec + 0.1) * 1000)
  }

  const el = new Audio()
  el.src = spec.src
  el.loop = true
  el.crossOrigin = 'anonymous'
  el.preload = 'auto'

  let settled = false
  const play = () => {
    if (settled) return
    settled = true
    try {
      const node = ctx.createMediaElementSource(el)
      const gain = ctx.createGain()
      gain.gain.value = 0
      node.connect(gain).connect(master)
      el.play().catch(() => {})
      const t = now()
      gain.gain.linearRampToValueAtTime(spec.vol, t + fadeSec)
      bed = { el, node, gain }
    } catch {
      giveUp()
    }
  }
  const giveUp = () => {
    if (settled) return
    settled = true
    try {
      el.src = ''
    } catch {
      /* noop */
    }
    // bed 는 null 로 남는다 — 파일이 준비될 때까지 그냥 무음.
  }

  el.addEventListener('canplaythrough', play, { once: true })
  el.addEventListener('error', giveUp, { once: true })
  // 파일이 아예 없거나 응답이 느리면 1.5초 뒤 포기(무음)
  setTimeout(() => {
    if (!settled) giveUp()
  }, 1500)
  el.load()
}

function stopBed(b) {
  if (!b) return
  try {
    b.el.pause()
    b.node.disconnect()
    b.gain.disconnect()
    b.el.src = ''
  } catch {
    /* noop */
  }
}

/* ------------------------------------------------------------------ 일회성 큐 */
function ping(freq, dur, { type = 'sine', vol = 0.2, glideTo = null } = {}) {
  if (!enabled || !ctx) return
  const t = now()
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vol, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + dur + 0.03)
}

/** 카운트다운 틱. ScreenView 가 남은 7초부터 매초 부른다. 짧고 건조하게. */
export function soundTick() {
  ping(1180, 0.07, { type: 'square', vol: 0.16 })
}

/** 시간 종료 "땡". 밝은 벨 한 방 + 배음. */
export function soundDing() {
  if (!enabled || !ctx) return
  const t = now()
  const partials = [
    [880, 0.5, 'sine', 1.5],
    [1320, 0.2, 'triangle', 1.1],
    [1760, 0.12, 'triangle', 0.8],
  ]
  for (const [f, peak, type, tail] of partials) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + tail)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + tail + 0.05)
  }
}

/** 정답 공개 때 짧게 올라가는 3음. 틱·땡에서 정적으로 넘어가는 이음새를 메운다. */
export function soundChime() {
  if (!enabled || !ctx) return
  ;[0, 0.09, 0.18].forEach((d, i) => {
    setTimeout(() => ping([523.25, 659.25, 783.99][i], 0.18, { type: 'sine', vol: 0.14 }), d * 1000)
  })
}
