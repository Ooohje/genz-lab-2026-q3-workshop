/**
 * 서버 시각 보정.
 *
 * 타이머의 기준점(question_started_at, turn_started_at)은 전부 서버 타임스탬프인데,
 * 남은 시간을 Date.now() 로 빼면 그 폰의 시계가 어긋난 만큼 그대로 틀어진다.
 * 시계가 30초 빠른 폰은 아직 시간이 남았는데 00 을 보고 못 풀고, 30초 느린 폰은
 * 다 풀었는데 서버에서 TOO_LATE 를 맞는다. 60명 중 한 명은 반드시 나온다.
 *
 * 그래서 조회 RPC 가 응답에 server_now 를 함께 실어 보내고, 여기서 오프셋을
 * 계산해 둔다. 이후 화면은 Date.now() 대신 serverNow() 를 쓴다.
 *
 * 응답이 도착한 시점에 server_now 는 이미 왕복 시간만큼 과거다. 그래서 보정된
 * 시계는 실제 서버보다 아주 조금 뒤처지고, 남은 시간은 조금 짧게 보인다.
 * 참여자가 마감보다 일찍 내게 되는 쪽이라 안전한 방향이고, 서버가 주는 2초
 * 유예 안에 충분히 들어온다. 이걸 왕복시간으로 되돌려 보정하지는 않는다.
 */

let offset = 0 // serverNow - clientNow (ms)

/** 조회 RPC 응답의 server_now 를 받아 오프셋을 갱신한다. 폴링마다 불린다. */
export function noteServerTime(iso) {
  if (!iso) return
  const t = new Date(iso).getTime()
  if (Number.isFinite(t)) offset = t - Date.now()
}

/** 서버 기준 현재 시각(ms). 타이머 계산은 전부 이걸 쓴다. */
export function serverNow() {
  return Date.now() + offset
}

/** 진단용 — 관리자 화면에서 시계 어긋남을 눈으로 확인할 때. */
export function clockOffsetMs() {
  return offset
}
