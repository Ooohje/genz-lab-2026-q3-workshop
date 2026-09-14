/**
 * 범용 투표(#/poll/<slug>) 설정. 라우트의 slug 는 URL 에 보이는 값이고,
 * id 는 DB(poll_votes.poll_id / RPC)에서 쓰는 값이다 — 나중에 URL 을
 * 바꾸고 싶어도 DB 쪽 id 는 안 건드리게 분리해 뒀다.
 *
 * kind: 'binary'  → options 를 그대로 보여준다 (참여/미참여 같은 고정 선택지)
 *       'team'    → PollVote 가 teams 테이블에서 활성 팀을 불러와 옵션을 만들고
 *                   투표자 본인 팀은 뺀다(서버도 submit_poll_vote 에서 다시 막는다)
 *
 * 새 투표를 추가할 때: 여기 항목을 하나 늘리고, db/09_polls.sql 의
 * submit_poll_vote / admin_poll_tally / get_poll_rank 에 poll_id 분기를 추가한다.
 */
export const POLLS = {
  'best-team': {
    id: 'best_team',
    title: '팀 발표 투표',
    subtitle: '어느 팀 발표가 가장 좋았나요? 우리 팀은 고를 수 없어요. 마음이 바뀌면 다시 눌러 변경할 수 있어요.',
    kind: 'team',
  },
  trenderZ: {
    id: 'trenders_2026h2',
    title: '2026 하반기 트렌더즈 현장 접수',
    subtitle: '현장 참여 여부를 알려주세요. 마음이 바뀌면 다시 눌러 변경할 수 있어요.',
    kind: 'binary',
    options: [
      { value: 'yes', label: '참여' },
      { value: 'no', label: '미참여' },
    ],
  },
}

export function getPoll(slug) {
  return POLLS[slug] ?? null
}
