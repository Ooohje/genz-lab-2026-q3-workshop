import { useState } from 'react'
import { clearSession, loadSession, saveSession } from '../../lib/session'
import { useParticipant } from '../../hooks/useParticipant'
import Login from '../participant/Login'
import NameEntry from '../participant/NameEntry'
import DinnerRsvp from './DinnerRsvp'

/**
 * #/dinner — 석식 참석 투표. 워크샵 게임과는 별개다.
 * 로그인은 참여자 앱과 똑같이 Knox ID 하나로 하고 세션(localStorage)도 공유한다.
 * 워크샵 앱에 이미 로그인한 사람은 바로 투표 화면으로 온다.
 */
export default function DinnerView() {
  const [booted] = useState(() => loadSession())
  const [pendingKnoxId, setPendingKnoxId] = useState(null)

  function handleLogout() {
    clearSession()
    window.location.reload()
  }

  // 관리자가 오타 난 Knox ID 행을 지웠다면 세션을 버리고 로그인부터 다시.
  const { participant, setParticipant } = useParticipant(booted, { onGone: handleLogout })

  function handleJoined(row) {
    saveSession(row)
    setParticipant(row)
    setPendingKnoxId(null)
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

  return <DinnerRsvp participant={participant} />
}
