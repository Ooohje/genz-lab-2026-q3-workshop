const KEY = 'genzlab.session'

/** 모바일 키보드가 첫 글자를 자동 대문자로 바꾼다. 반드시 정규화해서 보낸다. */
export function normalizeKnoxId(v) {
  return (v ?? '').trim().toLowerCase()
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null   // 사파리 프라이빗 모드 등에서 localStorage 접근이 던질 수 있다
  }
}

export function saveSession(participant) {
  try {
    localStorage.setItem(KEY, JSON.stringify(participant))
  } catch { /* 저장 실패해도 이번 세션은 메모리로 굴러간다 */ }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY)
  } catch { /* noop */ }
}
