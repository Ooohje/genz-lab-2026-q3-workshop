import { useG1, useElapsed } from '../../../hooks/useG1'
import TopBar from '../../../components/TopBar'
import BottomBar from '../../../components/BottomBar'
import Cta from '../../../components/Cta'
import SpeakerCard from './SpeakerCard'
import MyTurn from './MyTurn'
import Reveal from './Reveal'

/** 게임 1 라우터. get_g1_view 의 turn_phase 에 따라 화면을 고른다. */
export default function Game1({ participant, teamName }) {
  const { view, refresh } = useG1(participant.knox_id)
  const turnElapsed = useElapsed(view?.turn_started_at)
  const phaseElapsed = useElapsed(view?.phase_started_at)

  if (!view) return <Waiting participant={participant} teamName={teamName} label="불러오는 중…" />

  if (view.state === 'not_started') {
    return <Waiting participant={participant} teamName={teamName} label="진행자가 게임 1을 시작하면 넘어갑니다" />
  }
  if (view.state === 'no_team') {
    return <Waiting participant={participant} teamName={teamName} label="조 배정을 기다리는 중" />
  }
  if (view.state === 'done') {
    return <TeamDone participant={participant} teamName={teamName} />
  }

  if (view.turn_phase === 'reveal_person') {
    return (
      <Reveal
        participant={participant}
        teamName={teamName}
        view={view}
        phaseElapsed={phaseElapsed}
        onAdvanced={refresh}
      />
    )
  }

  if (view.is_me) {
    return (
      <MyTurn participant={participant} view={view} elapsed={turnElapsed} onAdvanced={refresh} />
    )
  }

  return (
    <SpeakerCard
      participant={participant}
      teamName={teamName}
      view={view}
      elapsed={turnElapsed}
      onVoted={refresh}
    />
  )
}

function Waiting({ participant, teamName, label }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <TopBar participant={participant} teamName={teamName} />
      <div className="flex flex-1 items-center justify-center px-[24px]">
        <p className="text-center text-[17px] font-semibold leading-[1.6] text-muted">{label}</p>
      </div>
    </div>
  )
}

/** 조가 마지막 발표자까지 끝낸 상태. 전체 phase 전환은 진행자가 한다. */
function TeamDone({ participant, teamName }) {
  return (
    <div className="flex h-full flex-col bg-surface">
      <TopBar participant={participant} teamName={teamName} />
      <div className="flex flex-1 flex-col items-center justify-center gap-[16px] px-[24px] text-center">
        <div className="flex h-[96px] w-[96px] animate-bob items-center justify-center rounded-[28px] bg-success-tint text-[40px]">
          🎉
        </div>
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-ink">우리 조 완료!</h1>
        <p className="max-w-[280px] text-[13px] leading-[1.6] text-muted">
          조원 전원의 리빌이 끝났습니다. 다른 조가 끝나면 게임 2로 넘어갑니다.
        </p>
      </div>
      <BottomBar>
        <Cta variant="ghost" disabled>다음 순서를 기다립니다</Cta>
      </BottomBar>
    </div>
  )
}
