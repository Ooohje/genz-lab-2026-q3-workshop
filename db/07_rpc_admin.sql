-- =====================================================================
-- 07. 스크린 집계 + 관리자 RPC — 구현 6·7단계
--
-- 관리자 권한은 클라이언트에서 판단하지 않는다. 모든 변경 함수가
-- admin_verify_pin 을 먼저 통과해야 한다. 참여자가 #/admin URL 을 알아도
-- PIN 없이는 아무것도 바꿀 수 없다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- B2 — 팀별 게임 1 진행 현황판
-- ---------------------------------------------------------------------
create or replace function get_screen_g1()
returns jsonb
language sql security definer set search_path = public
as $fn$
  select coalesce(jsonb_agg(x order by (x->>'team_no')::int), '[]'::jsonb) from (
    select jsonb_build_object(
      'team_no', t.team_no,
      'name',    t.name,
      'done',    coalesce(g.current_idx, 0),
      'total',   coalesce(jsonb_array_length(g.speaker_order), 0),
      'phase',   coalesce(g.phase, 'speaking'),
      'elapsed', coalesce(extract(epoch from (now() - g.turn_started_at))::int, 0)
    ) as x
      from teams t
      left join team_g1_state g on g.team_no = t.team_no
     where t.is_active
  ) s;
$fn$;

-- ---------------------------------------------------------------------
-- B3 / B4 — 스크린용 현재 문항. 개인 정보가 없는 버전.
-- ---------------------------------------------------------------------
create or replace function get_screen_question()
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare gs game_state; q questions;
begin
  select * into gs from game_state where id = 1;
  if gs.current_question_id is null then return jsonb_build_object('state', 'waiting'); end if;
  select * into q from questions where id = gs.current_question_id;

  return jsonb_build_object(
    'state', 'ok',
    -- 스크린도 자기 시계 대신 이 값으로 남은 시간을 계산한다(src/lib/clock.js).
    'server_now', now(),
    'id', q.id, 'ord', q.ord, 'type', q.type, 'body', q.body,
    'image_url', q.image_url, 'options', q.options,
    'time_limit_sec', q.time_limit_sec, 'started_at', gs.question_started_at,
    'total', (select count(*) from questions),
    'revealed', gs.revealed,
    'answered_count', (select count(*) from answers x
                        join participants p on p.knox_id = x.knox_id and p.is_active
                       where x.question_id = q.id),
    'active_count', (select count(*) from participants
                      where is_active and last_seen > now() - interval '45 seconds'),
    'answer', case when gs.revealed then q.answer else null end,
    'explanation', case when gs.revealed then q.explanation else null end,
    'distribution', case when gs.revealed then (
        select jsonb_object_agg(d.choice, d.n) from (
          select x.choice, count(*) as n from answers x
           where x.question_id = q.id group by x.choice) d
      ) else null end,
    'correct_rate', case when gs.revealed then (
        select round(100.0 * count(*) filter (where is_correct) / greatest(1, count(*)))
          from answers where question_id = q.id
      ) else null end,
    'fastest', case when gs.revealed then (
        select jsonb_build_object('name', p.name, 'sec',
                 round(extract(epoch from (x.answered_at - gs.question_started_at))::numeric, 1))
          from answers x join participants p on p.knox_id = x.knox_id
         where x.question_id = q.id and x.is_correct
         order by x.answered_at limit 1
      ) else null end
  );
end;
$fn$;

-- =====================================================================
-- 관리자
-- =====================================================================

-- C2 대시보드 — 지표 + 팀별 진행률 + 배정 대기자
create or replace function admin_dashboard(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;

  return jsonb_build_object(
    'phase',        (select phase from game_state where id = 1),
    'notice',       (select notice from game_state where id = 1),
    'joined',       (select count(*) from participants where is_active),
    -- 접속 중 = 45초 안에 heartbeat 를 보낸 사람. 클라이언트가 20초마다 보내므로
    -- 한 번 놓쳐도 살아 있고, 두 번 놓치면(폰 화면 꺼짐 등) 빠진다.
    'online',       (select count(*) from participants
                      where is_active and last_seen > now() - interval '45 seconds'),
    'written',      (select count(distinct s.knox_id) from statements s
                       join participants p on p.knox_id = s.knox_id and p.is_active),
    'unassigned',   (select count(*) from participants where is_active and team_no is null),
    'teams_done',   (select count(*) from team_g1_state where phase = 'done'),
    'teams',        get_screen_g1(),
    'waiting',      coalesce((select jsonb_agg(jsonb_build_object('knox_id', knox_id, 'name', name)
                                               order by joined_at)
                                from participants where is_active and team_no is null), '[]'::jsonb),
    'question_id',  (select current_question_id from game_state where id = 1),
    'revealed',     (select revealed from game_state where id = 1)
  );
end;
$fn$;

-- C3 명단·팀 편성 -------------------------------------------------------
create or replace function admin_roster(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  return jsonb_build_object(
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
                 'team_no', team_no, 'name', name, 'is_active', is_active, 'ord', ord)
                 order by ord, team_no) from teams), '[]'::jsonb),
    'participants', coalesce((select jsonb_agg(jsonb_build_object(
                 'knox_id', p.knox_id, 'name', p.name, 'team_no', p.team_no,
                 'is_active', p.is_active,
                 'has_statements', exists (select 1 from statements s where s.knox_id = p.knox_id))
                 order by p.team_no nulls first, p.name) from participants p), '[]'::jsonb)
  );
end;
$fn$;

create or replace function admin_upsert_team(p_pin text, p_team_no int, p_name text,
                                             p_is_active boolean default true, p_ord int default 0)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  insert into teams (team_no, name, is_active, ord)
  values (p_team_no, p_name, p_is_active, p_ord)
  on conflict (team_no) do update
    set name = excluded.name, is_active = excluded.is_active, ord = excluded.ord;
end;
$fn$;

create or replace function admin_delete_team(p_pin text, p_team_no int)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  -- 팀원은 지우지 않고 배정 대기로 되돌린다.
  update participants set team_no = null where team_no = p_team_no;
  delete from teams where team_no = p_team_no;
end;
$fn$;

create or replace function admin_assign(p_pin text, p_knox_id text, p_team_no int)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  -- 게임 1 도중 팀을 옮기면 기존 팀에서의 투표·피투표는 무효 처리한다(기획서 §3.3).
  delete from votes_3t1f
   where voter_knox = lower(trim(p_knox_id)) or target_knox = lower(trim(p_knox_id));
  update participants set team_no = p_team_no where knox_id = lower(trim(p_knox_id));
end;
$fn$;

create or replace function admin_set_active(p_pin text, p_knox_id text, p_is_active boolean)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  update participants set is_active = p_is_active where knox_id = lower(trim(p_knox_id));
end;
$fn$;

create or replace function admin_delete_participant(p_pin text, p_knox_id text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  delete from participants where knox_id = lower(trim(p_knox_id));
end;
$fn$;

-- 이름 정정 (당일 오타 대응). 지웠다가 재로그인시키지 않아도 되게 한다.
-- Knox ID 자체의 정정은 statements/answers/votes 의 FK 라 여기서 다루지 않는다 —
-- 그 경우는 삭제 후 본인 재로그인.
create or replace function admin_rename_participant(p_pin text, p_knox_id text, p_name text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v_name text := trim(coalesce(p_name, ''));
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  if v_name = '' then raise exception 'NAME_REQUIRED'; end if;
  update participants set name = v_name where knox_id = lower(trim(p_knox_id));
  if not found then raise exception 'NOT_A_PARTICIPANT'; end if;
end;
$fn$;

-- Knox ID 정정 (당일 오타 대응). knox_id 는 participants 의 PK 이고
-- statements/answers/votes_3t1f 가 FK 로 참조한다(on update cascade 없음).
-- 그래서 새 행을 만들고 → 자식을 옮기고 → 옛 행을 지운다. 각 단계에서 FK 가
-- 항상 만족되므로 작성·투표·답안이 보존된다.
-- team_g1_state.speaker_order 는 FK 가 아니라 knox_id 문자열 배열이라 따로 치환한다.
create or replace function admin_change_knox_id(p_pin text, p_old text, p_new text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare
  v_old text := lower(trim(coalesce(p_old, '')));
  v_new text := lower(trim(coalesce(p_new, '')));
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  if v_new = '' then raise exception 'KNOX_ID_REQUIRED'; end if;
  if v_old = v_new then return; end if;
  if not exists (select 1 from participants where knox_id = v_old) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;
  if exists (select 1 from participants where knox_id = v_new) then
    raise exception 'KNOX_ID_TAKEN';
  end if;

  insert into participants (knox_id, name, team_no, is_active, is_preregistered, joined_at, last_seen)
  select v_new, name, team_no, is_active, is_preregistered, joined_at, now()
    from participants where knox_id = v_old;

  update statements  set knox_id     = v_new where knox_id     = v_old;
  update answers     set knox_id     = v_new where knox_id     = v_old;
  update votes_3t1f  set voter_knox  = v_new where voter_knox  = v_old;
  update votes_3t1f  set target_knox = v_new where target_knox = v_old;

  update team_g1_state
     set speaker_order = replace(speaker_order::text,
                                 format('"%s"', v_old), format('"%s"', v_new))::jsonb
   where speaker_order ? v_old;

  delete from participants where knox_id = v_old;
end;
$fn$;

-- 개인 상태 초기화 (폰 문제 대응). 세션을 새로 시작하게 만든다.
create or replace function admin_reset_participant(p_pin text, p_knox_id text)
returns void
language plpgsql security definer set search_path = public
as $fn$
declare v text := lower(trim(p_knox_id));
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  delete from answers    where knox_id = v;
  delete from votes_3t1f where voter_knox = v or target_knox = v;
  delete from statements where knox_id = v;
end;
$fn$;

-- 명단 CSV 업로드. rows = [{knox_id, name, team_no}, ...]
-- Knox ID 는 여기서도 소문자로 정규화한다. 한쪽만 하면 로그인에서 튕긴다.
create or replace function admin_upload_roster(p_pin text, p_rows jsonb)
returns int
language plpgsql security definer set search_path = public
as $fn$
declare r jsonb; n int := 0;
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;

  -- CSV 에 등장하는 팀 번호를 먼저 만들어 둔다.
  insert into teams (team_no, name, ord)
  select distinct (x->>'team_no')::int, (x->>'team_no') || '팀', (x->>'team_no')::int
    from jsonb_array_elements(p_rows) x
   where coalesce(x->>'team_no', '') <> ''
  on conflict (team_no) do nothing;

  for r in select * from jsonb_array_elements(p_rows) loop
    insert into participants (knox_id, name, team_no, is_preregistered)
    values (lower(trim(r->>'knox_id')), trim(r->>'name'),
            nullif(r->>'team_no', '')::int, true)
    on conflict (knox_id) do update
      set name = excluded.name,
          team_no = coalesce(excluded.team_no, participants.team_no),
          is_preregistered = true;
    n := n + 1;
  end loop;
  return n;
end;
$fn$;

-- C4 문항 관리 ---------------------------------------------------------
create or replace function admin_list_questions(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'ord', ord, 'type', type, 'body', body, 'image_url', image_url,
      'options', options, 'answer', answer, 'time_limit_sec', time_limit_sec,
      'explanation', explanation) order by ord, id) from questions), '[]'::jsonb);
end;
$fn$;

create or replace function admin_upsert_question(
  p_pin text, p_id bigint, p_ord int, p_type text, p_body text,
  p_options jsonb, p_answer text, p_time_limit_sec int,
  p_image_url text default null, p_explanation text default null)
returns bigint
language plpgsql security definer set search_path = public
as $fn$
declare v_id bigint;
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  if p_id is null then
    insert into questions (ord, type, body, options, answer, time_limit_sec, image_url, explanation)
    values (p_ord, p_type, p_body, coalesce(p_options, '[]'::jsonb), p_answer,
            p_time_limit_sec, p_image_url, p_explanation)
    returning id into v_id;
  else
    update questions
       set ord = p_ord, type = p_type, body = p_body,
           options = coalesce(p_options, '[]'::jsonb), answer = p_answer,
           time_limit_sec = p_time_limit_sec, image_url = p_image_url,
           explanation = p_explanation
     where id = p_id
    returning id into v_id;
  end if;
  return v_id;
end;
$fn$;

create or replace function admin_delete_question(p_pin text, p_id bigint)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  delete from questions where id = p_id;
end;
$fn$;

-- 문항 순서 재정렬. 프론트가 재배치한 id 배열 전체를 보내면 ord 를 1..n 으로 다시 쓴다.
-- 배열에 없는 문항이 있으면 그 문항은 뒤로 밀린다(ord 를 큰 값으로).
create or replace function admin_reorder_questions(p_pin text, p_ids bigint[])
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  update questions q set ord = t.pos
    from unnest(p_ids) with ordinality as t(qid, pos)
   where q.id = t.qid;
  -- 배열에 빠진 문항은 맨 뒤로
  update questions set ord = 1000 + id where id <> all(p_ids);
end;
$fn$;

-- 진행 중 안전장치 -----------------------------------------------------

-- 팀 단위 / 일괄 강제공개. 15분 시점에 전 팀을 끝내는 최후 수단이다.
create or replace function admin_force_reveal(p_pin text, p_team_no int default null)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  update team_g1_state
     set phase = 'done', phase_started_at = now()
   where p_team_no is null or team_no = p_team_no;
end;
$fn$;

create or replace function admin_set_notice(p_pin text, p_notice text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  update game_state set notice = nullif(trim(coalesce(p_notice, '')), ''), updated_at = now()
   where id = 1;
end;
$fn$;

create or replace function admin_set_flags(p_pin text, p_speed_bonus boolean, p_hard_cut boolean)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  update game_state
     set speed_bonus_enabled = coalesce(p_speed_bonus, speed_bonus_enabled),
         hard_cut_enabled    = coalesce(p_hard_cut, hard_cut_enabled),
         updated_at = now()
   where id = 1;
end;
$fn$;

-- 리허설 초기화 — 게임 기록만 지운다. 명단과 문항은 남긴다.
-- where true 는 Supabase 의 safeupdate 가드(WHERE 없는 DELETE 차단) 회피용이다. 빼지 말 것.
create or replace function admin_reset_game(p_pin text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  delete from answers       where true;
  delete from votes_3t1f    where true;
  delete from statements     where true;
  delete from team_g1_state  where true;
  update game_state
     set phase = 'lobby', current_question_id = null, question_started_at = null,
         revealed = false, notice = null, updated_at = now()
   where id = 1;
end;
$fn$;

-- 행사 종료 후 개인정보 삭제. 운영 절차에 포함돼 있다.
create or replace function admin_purge_personal_data(p_pin text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  delete from answers       where true;
  delete from votes_3t1f    where true;
  delete from statements     where true;
  delete from team_g1_state  where true;
  delete from participants   where true;
  update game_state
     set phase = 'lobby', current_question_id = null, question_started_at = null,
         revealed = false, notice = null, updated_at = now()
   where id = 1;
end;
$fn$;

grant execute on function get_screen_g1()                              to anon, authenticated;
grant execute on function get_screen_question()                        to anon, authenticated;
grant execute on function admin_dashboard(text)                        to anon, authenticated;
grant execute on function admin_roster(text)                           to anon, authenticated;
grant execute on function admin_upsert_team(text, int, text, boolean, int) to anon, authenticated;
grant execute on function admin_delete_team(text, int)                 to anon, authenticated;
grant execute on function admin_assign(text, text, int)                to anon, authenticated;
grant execute on function admin_set_active(text, text, boolean)        to anon, authenticated;
grant execute on function admin_delete_participant(text, text)         to anon, authenticated;
grant execute on function admin_rename_participant(text, text, text)   to anon, authenticated;
grant execute on function admin_change_knox_id(text, text, text)       to anon, authenticated;
grant execute on function admin_reset_participant(text, text)          to anon, authenticated;
grant execute on function admin_upload_roster(text, jsonb)             to anon, authenticated;
grant execute on function admin_list_questions(text)                   to anon, authenticated;
grant execute on function admin_upsert_question(text, bigint, int, text, text, jsonb, text, int, text, text) to anon, authenticated;
grant execute on function admin_delete_question(text, bigint)          to anon, authenticated;
grant execute on function admin_reorder_questions(text, bigint[])      to anon, authenticated;
grant execute on function admin_force_reveal(text, int)                to anon, authenticated;
grant execute on function admin_set_notice(text, text)                 to anon, authenticated;
grant execute on function admin_set_flags(text, boolean, boolean)      to anon, authenticated;
grant execute on function admin_reset_game(text)                       to anon, authenticated;
grant execute on function admin_purge_personal_data(text)              to anon, authenticated;
