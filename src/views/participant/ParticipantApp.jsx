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
import Game1 from './game1/Game1'
import Game2 from './game2/Game2'
import Final from './game2/Final'
import LookUp from './LookUp'
import NoticeBanner from '../../components/NoticeBanner'
import PhaseStub from './PhaseStub'

export default function ParticipantApp() {
  // 아래 body() 가 고른 화면 위에 공지 배너를 얹는다.
  const [booted] = useState(() => loadSession())
  const [pendingKnoxId, setPendingKnoxId] = useState(null)
  const [editingStatements, setEditingStatements] = useState(false)

  const { participant, setParticipant } = useParticipant(booted)
  const { gameState, status } = useGameState()
  const { statements, roster, teamName, refresh } = useMyGame(participant)

  const wrap = (node) => (
    <div className="flex h-full flex-col">
      <NoticeBanner notice={gameState?.notice} />
      <div className="min-h-0 flex-1">{node}</div>
    </div>
  )

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
      return wrap(
        <NameEntry
          knoxId={pendingKnoxId}
          onJoined={handleJoined}
          onBack={() => setPendingKnoxId(null)}
        />,
      )
    }
    return wrap(<Login onJoined={handleJoined} onNeedName={setPendingKnoxId} />)
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
    return wrap(
      <StatementForm
        participant={participant}
        teamName={teamName}
        existing={statements}
        onSaved={async () => {
          await refresh()
          setEditingStatements(false)
        }}
      />,
    )
  }

  // --- 조 배정 대기 ---------------------------------------------------
  if (participant.team_no == null) {
    return wrap(
      <TeamWait
        participant={participant}
        hasStatements={hasStatements}
        onWriteStatements={() => setEditingStatements(true)}
      />,
    )
  }

  // --- 로비 -----------------------------------------------------------
  if (phase === 'lobby') {
    return wrap(
      <Lobby
        participant={participant}
        teamName={teamName}
        roster={roster}
        onEditStatements={() => setEditingStatements(true)}
      />,
    )
  }

  // --- 게임 1 ---------------------------------------------------------
  if (phase === 'game1' || phase === 'game1_reveal') {
    return wrap(<Game1 participant={participant} teamName={teamName} />)
  }

  // --- 게임 2 ---------------------------------------------------------
  if (phase === 'game2_wait' || phase === 'game2_question' || phase === 'game2_answer') {
    return wrap(<Game2 participant={participant} teamName={teamName} gameState={gameState} />)
  }

  // 중간 리더보드는 스크린(빔프로젝터)에 띄운다. 폰은 시선을 앞으로 보낸다.
  if (phase === 'leaderboard') {
    return wrap(<LookUp participant={participant} teamName={teamName} />)
  }

  if (phase === 'final') {
    return wrap(<Final participant={participant} />)
  }

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
