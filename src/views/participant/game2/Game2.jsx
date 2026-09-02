import { useQuestion, useRemaining } from '../../../hooks/useQuestion'
import TopBar from '../../../components/TopBar'
import Question from './Question'
import Submitted from './Submitted'
import Result from './Result'

/** 게임 2 라우터. game_state 의 phase·revealed 와 내 제출 여부로 화면을 고른다. */
export default function Game2({ participant, teamName, gameState }) {
  const { question, refresh } = useQuestion(participant.knox_id, gameState)
  const remaining = useRemaining(question?.started_at, question?.time_limit_sec)

  if (!question || question.state !== 'ok') {
    return (
      <div className="flex h-full flex-col bg-ink">
        <TopBar participant={participant} teamName={teamName} dark />
        <div className="flex flex-1 flex-col items-center justify-center gap-[12px] px-[24px] text-center">
          <div className="h-[56px] w-[56px] animate-bob rounded-[20px] bg-white/10" />
          <p className="text-[17px] font-semibold text-white/70">다음 문제를 기다리는 중</p>
        </div>
      </div>
    )
  }

  if (question.revealed) {
    return <Result question={question} />
  }

  if (question.my_choice != null) {
    return <Submitted question={question} remaining={remaining} />
  }

  if (remaining <= 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-[10px] bg-ink px-[24px] text-center">
        <span className="text-[26px] font-bold text-white">시간 종료</span>
        <p className="text-[14px] text-white/50">정답 공개를 기다리는 중</p>
      </div>
    )
  }

  return (
    <Question
      participant={participant}
      question={question}
      remaining={remaining}
      onSubmitted={refresh}
    />
  )
}
