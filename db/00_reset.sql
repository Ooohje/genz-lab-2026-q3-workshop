-- =====================================================================
-- 00. 초기화 — 모든 테이블과 함수를 삭제한다.
--
-- ⚠️ 게임 데이터(명단·문항·투표·답안·점수)가 전부 사라진다.
--    지금처럼 비어 있는 DB 에 다시 깔 때, 그리고 리허설 후 당일 대기 상태로
--    되돌릴 때만 실행한다. 행사 당일 진행 중에는 절대 실행하지 말 것.
-- =====================================================================
drop table if exists
  answers, votes_3t1f, statements, team_g1_state,
  game_state, questions, participants, teams, app_config
cascade;

drop function if exists join_session(text, text);
drop function if exists admin_verify_pin(text);
