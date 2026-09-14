import { useState } from 'react'
import { clearSession, loadSession, saveSession } from '../../lib/session'
import { useParticipant } from '../../hooks/useParticipant'
import { getPoll } from '../../lib/polls'
import Login from '../participant/Login'
import NameEntry from '../participant/NameEntry'
import PollVote from './PollVote'

/**
 * #/poll/<slug> — 워크샵 게임과 별개의 부가 투표. DinnerView 와 같은 패턴이다.
 * 로그인은 참여자 앱과 똑같이 Knox ID 하나로 하고 세션(localStorage)도 공유한다.
 */
export default function PollView({ slug }) {
  const [booted] = useState(() => loadSession())
  const [pendingKnoxId, setPendingKnoxId] = useState(null)

  function handleLogout() {
    clearSession()
    window.location.reload()
  }

  const { participant, setParticipant } = useParticipant(booted, { onGone: handleLogout })

  function handleJoined(row) {
    saveSession(row)
    setParticipant(row)
    setPendingKnoxId(null)
  }

  const poll = getPoll(slug)
  if (!poll) {
    return (
      <div className="flex h-full items-center justify-center bg-surface px-[24px] text-center">
        <p className="text-[15px] font-semibold text-muted">존재하지 않는 투표입니다.</p>
      </div>
    )
  }

  if (!participant) {
    if (pendingKnoxId) {
      return (
        <NameEntry
          knoxId={pendingKnoxId}
          onJoined={handleJoined}
          onBack={() => setPendingKnoxId(null)}
        />
      )
    }
    return <Login onJoined={handleJoined} onNeedName={setPendingKnoxId} />
  }

  return <PollVote poll={poll} participant={participant} />
}
