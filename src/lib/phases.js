/** game_state.phase 값과 화면 표시용 라벨. DB 의 CHECK 제약과 순서가 같다. */
export const PHASES = [
  'lobby', 'game1', 'game1_reveal', 'game2_wait',
  'game2_question', 'game2_answer', 'leaderboard', 'final',
]

export const PHASE_LABEL = {
  lobby:          '로비 — 곧 시작합니다',
  game1:          '게임 1 — 3 Truths 1 Fake',
  game1_reveal:   '게임 1 — 리빌',
  game2_wait:     '게임 2 — 문제 대기',
  game2_question: '게임 2 — 문제 풀이',
  game2_answer:   '게임 2 — 정답 공개',
  leaderboard:    '중간 리더보드',
  final:          '최종 시상',
}
