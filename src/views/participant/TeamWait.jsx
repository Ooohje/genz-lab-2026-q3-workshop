import TopBar from '../../components/TopBar'
import BottomBar from '../../components/BottomBar'
import Cta from '../../components/Cta'
import WriteTimerBanner from '../../components/WriteTimerBanner'

/** A3 — 조 배정 대기. 관리자가 조를 배정하는 순간 Realtime 으로 화면이 넘어간다. */
export default function TeamWait({ participant, onWriteStatements, hasStatements }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <TopBar participant={participant} />
      <WriteTimerBanner />

      <div className="flex flex-1 flex-col items-center justify-center gap-[20px] px-[24px] text-center">
        <div className="flex h-[96px] w-[96px] animate-bob items-center justify-center gap-[6px] rounded-[28px] bg-warn-tint">
          {[0, 0.2, 0.4].map((d) => (
            <span
              key={d}
              className="h-[10px] w-[10px] animate-pulse2 rounded-full bg-warn"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        </div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">조 배정을 기다리는 중</h1>
        <p className="max-w-[280px] text-[13px] leading-[1.6] text-muted">
          진행자가 조를 배정하면 이 화면이 자동으로 넘어갑니다. 앱을 닫지 않아도 됩니다.
        </p>
      </div>

      <BottomBar>
        {!hasStatements && (
          <p className="text-center text-[13px] font-semibold text-brand">
            기다리는 동안 3T1F를 먼저 써두면 좋아요
          </p>
        )}
        <Cta variant={hasStatements ? 'ghost' : 'brand'} onClick={onWriteStatements}>
          {hasStatements ? '내 문장 다시 보기' : '3T1F 작성하기'}
        </Cta>
      </BottomBar>
    </div>
  )
}
