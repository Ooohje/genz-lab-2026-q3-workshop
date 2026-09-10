/**
 * 스크린 뷰(#/screen) 전용 사운드 엔진. 빔프로젝터 노트북 한 대에서만 돈다.
 *
 * 왜 이렇게 생겼나:
 *  - 브라우저 자동재생 차단 때문에 페이지 로드 후 "사용자 클릭 1회" 전에는
 *    어떤 소리도 못 낸다. soundEnable() 을 그 클릭 콜백에서 부른다.
 *  - 효과음(틱·땡·차임)은 파일 없이 Web Audio 로 합성한다. 로딩 실패가 없다.
 *  - 배경 베드는 public/sound/<name>.mp3 가 있으면 그걸 루프하고,
 *    없으면(404) 합성 패드로 자동 대체한다. 그래서 파일 0개로도 동작한다.
 *
 * ScreenView 외의 화면에서는 부르지 않는다(참여자 폰 60대에서 소리가 나면 안 된다).
 */

const LS_KEY = 'genzlab.sound' // 'on' 이면 다음 로드에서도 소리를 원함(클릭은 여전히 필요)

// 베드 이름 → mp3 경로 + 목표 볼륨 + 합성 대체 패드 종류
const BEDS = {
  lobby: { src: './sound/lobby.mp3', vol: 0.3, pad: 'calm' },
  game1: { src: './sound/game1.mp3', vol: 0.1, pad: 'calm' },
  game2: { src: './sound/game2.mp3', vol: 0.22, pad: 'tension' },
  leaderboard: { src: './sound/leaderboard.mp3', vol: 0.38, pad: 'bright' },
}

let ctx = null
let master = null // 전체 볼륨(음소거용)
let enabled = false
let muted = false
let bedName = null
let bed = null // { kind:'mp3', el, node, gain } | { kind:'pad', stop, gain }
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
 * soundEnable() 이 재생을 시작한다.
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

  // mp3 시도 → 실패하면 합성 패드
  const el = new Audio()
  el.src = spec.src
  el.loop = true
  el.crossOrigin = 'anonymous'
  el.preload = 'auto'

  let settled = false
  const useMp3 = () => {
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
      bed = { kind: 'mp3', el, node, gain }
    } catch {
      fallbackPad()
    }
  }
  const fallbackPad = () => {
    if (settled) return
    settled = true
    try {
      el.src = ''
    } catch {
      /* noop */
    }
    const pad = makePad(spec.pad)
    const t = now()
    pad.gain.gain.linearRampToValueAtTime(spec.vol, t + fadeSec)
    bed = { kind: 'pad', ...pad }
  }

  el.addEventListener('canplaythrough', useMp3, { once: true })
  el.addEventListener('error', fallbackPad, { once: true })
  // 파일이 아예 없거나 응답이 느리면 1.5초 뒤 패드로
  setTimeout(() => {
    if (!settled) fallbackPad()
  }, 1500)
  el.load()
}

function stopBed(b) {
  if (!b) return
  try {
    if (b.kind === 'mp3') {
      b.el.pause()
      b.node.disconnect()
      b.gain.disconnect()
      b.el.src = ''
    } else {
      b.stop()
      b.gain.disconnect()
    }
  } catch {
    /* noop */
  }
}

/* ------------------------------------------------------------------ 합성 패드 */
/** 저작권 걱정 없는 대체 배경음. 살짝 디튠한 톱니 + 저역 통과 + 아주 느린 LFO. */
function makePad(kind) {
  const chords = {
    calm: [196.0, 246.94, 293.66], // G3 B3 D4
    tension: [146.83, 220.0, 233.08], // D3 A3 A#3 — 약한 맥놀이로 긴장감
    bright: [261.63, 329.63, 392.0, 523.25], // C4 E4 G4 C5
  }
  const freqs = chords[kind] ?? chords.calm

  const gain = ctx.createGain()
  gain.gain.value = 0
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 820
  lp.Q.value = 0.6
  lp.connect(gain).connect(master)

  const oscs = []
  for (const f of freqs) {
    for (const mult of [1, 1.006]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f * mult
      const og = ctx.createGain()
      og.gain.value = 0.18 / freqs.length
      o.connect(og).connect(lp)
      o.start()
      oscs.push(o)
    }
  }
  // 필터 컷오프를 아주 천천히 흔들어 "숨쉬는" 느낌
  const lfo = ctx.createOscillator()
  lfo.type = 'sine'
  lfo.frequency.value = 0.06
  const lfoG = ctx.createGain()
  lfoG.gain.value = 220
  lfo.connect(lfoG).connect(lp.frequency)
  lfo.start()
  oscs.push(lfo)

  return {
    gain,
    stop() {
      for (const o of oscs) {
        try {
          o.stop()
        } catch {
          /* noop */
        }
      }
    },
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

/** 카운트다운 틱(마지막 3·2·1초). 짧고 건조하게. */
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
