-- =====================================================================
-- 06. 게임 2 (조 대항 퀴즈) RPC — 구현 5단계
--
-- 핵심 설계
--   · 제출은 1회 확정, 변경 불가. 게임 1 의 재선택 허용과 정반대다.
--   · 채점은 전적으로 서버가 한다. 클라이언트가 보낸 점수·시각은 쓰지 않는다.
--   · 어떤 문항에 답하는지도 클라이언트가 아니라 game_state 가 정한다.
--     (지난 문항에 뒤늦게 답을 밀어넣는 것을 막는다)
--   · questions.answer 는 game_state.revealed 가 true 가 된 뒤에만 내보낸다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 진행 컨트롤
-- ---------------------------------------------------------------------
create or replace function admin_start_game2(p_pin text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  update game_state
     set phase = 'game2_wait', current_question_id = null,
         question_started_at = null, revealed = false, updated_at = now()
   where id = 1;
end;
$fn$;

create or replace function admin_open_question(p_pin text, p_question_id bigint)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  if not exists (select 1 from questions where id = p_question_id) then
    raise exception 'NO_SUCH_QUESTION';
  end if;
  -- question_started_at 은 서버 시각으로만 찍는다. 전 단말이 같은 마감을 공유한다.
  update game_state
     set phase = 'game2_question', current_question_id = p_question_id,
         question_started_at = now(), revealed = false, updated_at = now()
   where id = 1;
end;
$fn$;

create or replace function admin_reveal_answer(p_pin text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  update game_state
     set phase = 'game2_answer', revealed = true, updated_at = now()
   where id = 1;
end;
$fn$;

create or replace function admin_set_phase(p_pin text, p_phase text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  update game_state set phase = p_phase, updated_at = now() where id = 1;
end;
$fn$;

-- ---------------------------------------------------------------------
-- 현재 문항 — 정답은 revealed 이후에만 포함된다.
-- ---------------------------------------------------------------------
create or replace function get_current_question(p_knox_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_knox text := lower(trim(coalesce(p_knox_id, '')));
  gs game_state;
  q  questions;
  a  answers;
begin
  select * into gs from game_state where id = 1;
  if gs.current_question_id is null then return jsonb_build_object('state', 'waiting'); end if;

  select * into q from questions where id = gs.current_question_id;
  select * into a from answers where question_id = q.id and knox_id = v_knox;

  return jsonb_build_object(
    'state',          'ok',
    'id',             q.id,
    'ord',            q.ord,
    'total',          (select count(*) from questions),
    'type',           q.type,
    'body',           q.body,
    'image_url',      q.image_url,
    'options',        q.options,
    'time_limit_sec', q.time_limit_sec,
    'started_at',     gs.question_started_at,
    'revealed',       gs.revealed,
    'answered_count', (select count(*) from answers x
                        join participants p on p.knox_id = x.knox_id and p.is_active
                       where x.question_id = q.id),
    'active_count',   (select count(*) from participants where is_active),
    'my_choice',      a.choice,
    -- 정답 여부·점수도 공개 전에는 알려주지 않는다. 옆사람에게 새어나간다.
    'my_score',       case when gs.revealed then a.score else null end,
    'my_correct',     case when gs.revealed then a.is_correct else null end,
    'my_total',       (select coalesce(sum(x.score), 0) from answers x where x.knox_id = v_knox),
    'answer',         case when gs.revealed then q.answer else null end,
    'explanation',    case when gs.revealed then q.explanation else null end,
    'distribution',   case when gs.revealed then (
                        select jsonb_object_agg(d.choice, d.n) from (
                          select x.choice, count(*) as n from answers x
                           where x.question_id = q.id group by x.choice
                        ) d
                      ) else null end,
    'fastest',        case when gs.revealed then (
                        select jsonb_build_object('name', p.name, 'score', x.score)
                          from answers x join participants p on p.knox_id = x.knox_id
                         where x.question_id = q.id and x.is_correct
                         order by x.answered_at limit 1
                      ) else null end
  );
end;
$fn$;

-- ---------------------------------------------------------------------
-- 답안 제출 — 1회 확정. 채점은 서버가 한다.
-- ---------------------------------------------------------------------
create or replace function submit_answer(p_knox_id text, p_choice text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_knox      text := lower(trim(coalesce(p_knox_id, '')));
  gs          game_state;
  q           questions;
  v_correct   boolean;
  v_remaining numeric;
  v_score     int;
begin
  if not exists (select 1 from participants where knox_id = v_knox and is_active) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  select * into gs from game_state where id = 1;
  if gs.current_question_id is null then raise exception 'NO_QUESTION'; end if;
  select * into q from questions where id = gs.current_question_id;

  -- 유효성: 서버 도착 시각이 시작 + 제한시간 + 2초(네트워크 유예) 이내여야 한다.
  if now() > gs.question_started_at + ((q.time_limit_sec + 2) * interval '1 second') then
    raise exception 'TOO_LATE';
  end if;

  -- 1회 확정. 게임 1 과 달리 upsert 하지 않는다.
  if exists (select 1 from answers where question_id = q.id and knox_id = v_knox) then
    raise exception 'ALREADY_ANSWERED';
  end if;

  v_correct := (p_choice = q.answer);
  v_remaining := greatest(0, extract(epoch from
                   (gs.question_started_at + (q.time_limit_sec * interval '1 second') - now())));

  if not v_correct then
    v_score := 0;
  elsif gs.speed_bonus_enabled then
    v_score := 100 + floor((v_remaining / q.time_limit_sec) * 50);
  else
    v_score := 100;
  end if;

  insert into answers (question_id, knox_id, choice, is_correct, score)
  values (q.id, v_knox, p_choice, v_correct, v_score);

  -- 제출 직후에는 정답 여부를 돌려주지 않는다. 공개 전에 새어나간다.
  return jsonb_build_object('submitted', true, 'choice', p_choice);
end;
$fn$;

-- ---------------------------------------------------------------------
-- 리더보드
--
-- 조 점수 = 조원 개인 점수 합 ÷ 게임 2 에서 1문항 이상 응답한 조원 수.
-- 접속만 하고 잠수한 인원이 분모를 부풀리지 않게 한다.
-- 소속은 항상 "현재" 편성 기준이라 게임 중 조를 옮겨도 자동으로 따라간다.
-- ---------------------------------------------------------------------
create or replace function get_leaderboard()
returns jsonb
language sql security definer set search_path = public
as $fn$
  select coalesce(jsonb_agg(x order by x->>'avg' desc), '[]'::jsonb) from (
    select jsonb_build_object(
      'team_no',     t.team_no,
      'name',        t.name,
      'total',       coalesce(sum(a.score), 0),
      'responders',  count(distinct a.knox_id),
      'avg',         round(coalesce(sum(a.score), 0)::numeric
                           / greatest(1, count(distinct a.knox_id)), 1)
    ) as x
      from teams t
      left join participants p on p.team_no = t.team_no and p.is_active
      left join answers a on a.knox_id = p.knox_id
     where t.is_active
     group by t.team_no, t.name
  ) s;
$fn$;

-- ---------------------------------------------------------------------
-- 최종 화면(A17)용 개인 스탯
-- ---------------------------------------------------------------------
create or replace function get_my_stats(p_knox_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_knox text := lower(trim(coalesce(p_knox_id, '')));
  v_team int;
begin
  select team_no into v_team from participants where knox_id = v_knox;

  return jsonb_build_object(
    'total',        (select coalesce(sum(score), 0) from answers where knox_id = v_knox),
    'correct',      (select count(*) from answers where knox_id = v_knox and is_correct),
    'answered',     (select count(*) from answers where knox_id = v_knox),
    'questions',    (select count(*) from questions),
    -- 게임 1 에서 내가 남의 거짓을 맞힌 횟수
    'lies_caught',  (select count(*) from votes_3t1f v
                      join statements s on s.knox_id = v.target_knox and s.ord = v.chosen_ord
                     where v.voter_knox = v_knox and s.is_lie),
    -- 우리 조에서 남을 가장 많이 속인 사람
    'best_liar',    (select p.name
                       from participants p
                       join statements s on s.knox_id = p.knox_id and s.is_lie
                       join votes_3t1f v on v.target_knox = p.knox_id
                                        and v.chosen_ord <> s.ord
                      where p.team_no = v_team
                      group by p.name order by count(*) desc limit 1),
    'team',         (select jsonb_build_object('team_no', t.team_no, 'name', t.name)
                       from teams t where t.team_no = v_team)
  );
end;
$fn$;

grant execute on function admin_start_game2(text)            to anon, authenticated;
grant execute on function admin_open_question(text, bigint)  to anon, authenticated;
grant execute on function admin_reveal_answer(text)          to anon, authenticated;
grant execute on function admin_set_phase(text, text)        to anon, authenticated;
grant execute on function get_current_question(text)         to anon, authenticated;
grant execute on function submit_answer(text, text)          to anon, authenticated;
grant execute on function get_leaderboard()                  to anon, authenticated;
grant execute on function get_my_stats(text)                 to anon, authenticated;
