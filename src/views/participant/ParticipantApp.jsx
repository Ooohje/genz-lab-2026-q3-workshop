import { useState } from 'react'
import { clearSession, loadSession, saveSession } from '../../lib/session'
import { useGameState } from '../../hooks/useGameState'
import { useParticipant } from '../../hooks/useParticipant'
import Login from './Login'
import NameEntry from './NameEntry'
import PhaseStub from './PhaseStub'

export default function ParticipantApp() {
  // 새로고침·앱 이탈 후 복귀 시 재입력 없이 복귀한다.
  const [booted] = useState(() => loadSession())
  const [pendingKnoxId, setPendingKnoxId] = useState(null)
  const { participant, setParticipant } = useParticipant(booted)
  const { gameState, status } = useGameState()

  function handleJoined(row) {
    saveSession(row)
    setParticipant(row)
    setPendingKnoxId(null)
  }

  function handleLogout() {
    clearSession()
    setParticipant(null)
    setPendingKnoxId(null)
    window.location.reload()
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

  // phase 별 실제 화면은 구현 3~5단계에서 하나씩 붙인다.
  return (
    <PhaseStub
      participant={participant}
      gameState={gameState}
      status={status}
      onLogout={handleLogout}
    />
  )
}
