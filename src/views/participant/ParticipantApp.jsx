import { useState } from 'react'
import { clearSession, loadSession, saveSession } from '../../lib/session'
import { useGameState } from '../../hooks/useGameState'
import { useParticipant } from '../../hooks/useParticipant'
import { useMyGame } from '../../hooks/useMyGame'
import Login from './Login'
import NameEntry from './NameEntry'
import StatementForm from './StatementForm'
import TeamWait from './TeamWait'
import Lobby from './Lobby'
import PhaseStub from './PhaseStub'

export default function ParticipantApp() {
  const [booted] = useState(() => loadSession())
  const [pendingKnoxId, setPendingKnoxId] = useState(null)
  const [editingStatements, setEditingStatements] = useState(false)

  const { participant, setParticipant } = useParticipant(booted)
  const { gameState, status } = useGameState()
  const { statements, roster, teamName, refresh } = useMyGame(participant)

  function handleJoined(row) {
    saveSession(row)
    setParticipant(row)
    setPendingKnoxId(null)
  }

  function handleLogout() {
    clearSession()
    window.location.reload()
  }

  // --- 로그인 전 ------------------------------------------------------
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

  // statements 가 null 이면 아직 서버 응답 전이다. 깜빡임 방지.
  if (statements === null) {
    return <Splash />
  }

  const hasStatements = statements.length === 4
  const phase = gameState?.phase ?? 'lobby'

  // --- 3T1F 작성 ------------------------------------------------------
  // 도착 직후 바로 작성하게 한다(기획서 §4.1). 조 배정 전에도 쓸 수 있다.
  if (!hasStatements || editingStatements) {
    return (
      <StatementForm
        participant={participant}
        teamName={teamName}
        existing={statements}
        onSaved={async () => {
          await refresh()
          setEditingStatements(false)
        }}
      />
    )
  }

  // --- 조 배정 대기 ---------------------------------------------------
  if (participant.team_no == null) {
    return (
      <TeamWait
        participant={participant}
        hasStatements={hasStatements}
        onWriteStatements={() => setEditingStatements(true)}
      />
    )
  }

  // --- 로비 -----------------------------------------------------------
  if (phase === 'lobby') {
    return (
      <Lobby
        participant={participant}
        teamName={teamName}
        roster={roster}
        onEditStatements={() => setEditingStatements(true)}
      />
    )
  }

  // 게임 1·2 화면은 4·5단계에서 붙는다.
  return (
    <PhaseStub
      participant={participant}
      teamName={teamName}
      gameState={gameState}
      status={status}
      onLogout={handleLogout}
    />
  )
}

function Splash() {
  return (
    <div className="flex h-full items-center justify-center bg-brand">
      <img
        src="./genzlab-logo.png"
        alt="Gen Z Lab."
        className="h-[56px] w-[56px] animate-pulse2 rounded-full"
      />
    </div>
  )
}
