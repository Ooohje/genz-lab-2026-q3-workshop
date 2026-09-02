/**
 * README §5 — 원형 타이머.
 * 남은 시간은 서버가 준 started_at + time_limit_sec 로 계산해 "표시만" 한다.
 * 클라이언트에서 카운트다운을 시작하지 않는다.
 */
export default function Timer({ remaining, limit, size = 82, bg = '#17161C' }) {
  const ratio = limit > 0 ? Math.max(0, Math.min(1, remaining / limit)) : 0
  const urgent = remaining <= 5
  const color = urgent ? '#F0392B' : '#D8FF4F'
  const inner = Math.round(size * 0.76)

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${urgent ? 'animate-pulse2' : ''}`}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${color} 0turn ${ratio}turn, rgba(255,255,255,.12) ${ratio}turn 1turn)`,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: inner, height: inner, background: bg }}
      >
        <span
          className="num font-bold"
          style={{ color, fontSize: Math.round(size * 0.34) }}
        >
          {String(Math.ceil(remaining)).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}
