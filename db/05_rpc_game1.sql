-- =====================================================================
-- 05. 게임 1 (3 Truths 1 Fake) RPC — 구현 4단계
--
-- 핵심 설계
--   · 투표는 재선택 허용(upsert). 게임 2 의 1회 확정과 정반대다.
--   · is_lie 와 득표는 그 조가 리빌 단계에 들어간 뒤에만 내보낸다.
--   · 완료 판정 분모는 스냅샷이 아니라 호출 시점의 편성으로 매번 계산한다.
--   · 턴 전환은 get_g1_view 안에서 판정한다. 발표자 폰이 죽어도 다른 조원의
--     폴링이 대신 턴을 넘겨주므로 조가 멈추지 않는다.
-- =====================================================================

alter table team_g1_state
  add column if not exists phase_started_at timestamptz not null default now();

-- turn_started_at 은 턴 전체(설명+투표+리빌)의 소프트 타이머 기준이고,
-- phase_started_at 은 하위 단계(speaking / reveal_person)의 시작 시각이다.

-- ---------------------------------------------------------------------
-- 게임 1 시작 — 조마다 발표 순서를 랜덤 배정한다.
-- ---------------------------------------------------------------------
create or replace function admin_start_game1(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare t record;
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;

  for t in select team_no from teams where is_active loop
    insert into team_g1_state (team_no, speaker_order, current_idx, phase,
                               turn_started_at, phase_started_at)
    values (
      t.team_no,
      coalesce((
        select jsonb_agg(x.knox_id)
          from (select p.knox_id from participants p
                 where p.team_no = t.team_no and p.is_active
                   and exists (select 1 from statements s where s.knox_id = p.knox_id)
                 order by random()) x
      ), '[]'::jsonb),
      0, 'speaking', now(), now()
    )
    on conflict (team_no) do update
      set speaker_order    = excluded.speaker_order,
          current_idx      = 0,
          phase            = 'speaking',
          turn_started_at  = now(),
          phase_started_at = now();
  end loop;

  -- 게임 1 로 넘어가면 작성 시간 배너는 더 볼 일이 없다. 같이 끈다.
  update game_state
     set phase = 'game1', write_started_at = null, write_limit_sec = null, updated_at = now()
   where id = 1;
end;
$fn$;

-- ---------------------------------------------------------------------
-- 게임 1 화면에 필요한 모든 것을 한 번에 준다.
-- 폴링으로 자주 불리므로 왕복을 하나로 묶었다.
-- 부수효과로 턴 자동 전환 판정을 함께 수행한다.
-- ---------------------------------------------------------------------
create or replace function get_g1_view(p_knox_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_knox    text := lower(trim(coalesce(p_knox_id, '')));
  v_team    int;
  st        team_g1_state;
  v_new     jsonb;
  v_speaker text;
  v_voters  int;
  v_voted   int;
  v_reveal  boolean;
  v_guard   int := 0;
begin
  select team_no into v_team from participants where knox_id = v_knox;
  if v_team is null then
    return jsonb_build_object('state', 'no_team', 'server_now', now());
  end if;

  select * into st from team_g1_state where team_no = v_team for update;
  if not found then
    return jsonb_build_object('state', 'not_started', 'server_now', now());
  end if;

  -- 늦게 작성한 사람을 발표 순서 뒤에 합류시킨다 (기획서 §4.3).
  select jsonb_agg(x.knox_id) into v_new
    from (select p.knox_id from participants p
           where p.team_no = v_team and p.is_active
             and exists (select 1 from statements s where s.knox_id = p.knox_id)
             and not jsonb_exists(st.speaker_order, p.knox_id)
           order by random()) x;
  if v_new is not null then
    st.speaker_order := st.speaker_order || v_new;
    update team_g1_state set speaker_order = st.speaker_order where team_no = v_team;
  end if;

  -- 현재 발표자. 조를 떠났거나 비활성이면 건너뛴다.
  loop
    v_guard := v_guard + 1;
    exit when v_guard > 200;
    v_speaker := st.speaker_order ->> st.current_idx;
    exit when v_speaker is null;
    exit when exists (select 1 from participants p
                       where p.knox_id = v_speaker and p.team_no = v_team and p.is_active);
    st.current_idx := st.current_idx + 1;
    update team_g1_state set current_idx = st.current_idx where team_no = v_team;
  end loop;

  if v_speaker is null then
    update team_g1_state set phase = 'done' where team_no = v_team and phase <> 'done';
    return jsonb_build_object(
      'state', 'done',
      'server_now', now(),
      'team_no', v_team,
      'roster', (select jsonb_agg(jsonb_build_object('knox_id', p.knox_id, 'name', p.name)
                                  order by p.name)
                   from participants p where p.team_no = v_team and p.is_active)
    );
  end if;

  -- 조가 'done' 으로 끝난 뒤 지각자가 문장을 쓰고 합류하면 발표자가 새로 생긴다.
  -- 이때 phase 를 되살리지 않으면 두 가지가 동시에 깨진다.
  --   · cast_vote 가 NOT_VOTING_PHASE 로 막혀 아무도 투표할 수 없다.
  --   · v_reveal 이 참이 되어 지각자의 거짓이 투표 전에 공개된다.
  if st.phase = 'done' then
    st.phase           := 'speaking';
    st.turn_started_at := now();
    st.phase_started_at := now();
    update team_g1_state
       set phase = 'speaking', turn_started_at = now(), phase_started_at = now()
     where team_no = v_team;
  end if;

  -- 분모: 활성 + 문장 작성 완료 + 발표자 제외. 매번 현재 편성으로 계산한다.
  select count(*) into v_voters
    from participants p
   where p.team_no = v_team and p.is_active and p.knox_id <> v_speaker
     and exists (select 1 from statements s where s.knox_id = p.knox_id);

  select count(*) into v_voted
    from votes_3t1f v join participants p on p.knox_id = v.voter_knox
   where v.target_knox = v_speaker and p.team_no = v_team and p.is_active;

  -- 전원 투표 완료 → 즉시 리빌
  if st.phase = 'speaking' and v_voters > 0 and v_voted >= v_voters then
    st.phase := 'reveal_person';
    st.phase_started_at := now();
    update team_g1_state
       set phase = 'reveal_person', phase_started_at = now()
     where team_no = v_team;
  end if;

  -- 리빌 5초 뒤 다음 발표자 (발표자가 [다음]으로 단축 가능)
  if st.phase = 'reveal_person' and now() > st.phase_started_at + interval '5 seconds' then
    st.current_idx := st.current_idx + 1;
    st.phase := case when st.speaker_order ->> st.current_idx is null then 'done' else 'speaking' end;
    update team_g1_state
       set current_idx = st.current_idx, phase = st.phase,
           turn_started_at = now(), phase_started_at = now()
     where team_no = v_team;
    return jsonb_build_object('state', 'advancing', 'server_now', now());
  end if;

  v_reveal := st.phase in ('reveal_person', 'done');

  return jsonb_build_object(
    'state',            'ok',
    -- 단말이 자기 시계 대신 이 값으로 경과 시간을 계산한다(src/lib/clock.js).
    'server_now',       now(),
    'team_no',          v_team,
    'turn_phase',       st.phase,
    'current_idx',      st.current_idx,
    'total',            jsonb_array_length(st.speaker_order),
    'turn_started_at',  st.turn_started_at,
    'phase_started_at', st.phase_started_at,
    'speaker', (select jsonb_build_object('knox_id', p.knox_id, 'name', p.name)
                  from participants p where p.knox_id = v_speaker),
    'is_me',            v_speaker = v_knox,
    'voters_expected',  v_voters,
    'voters_done',      v_voted,
    'my_vote',          (select v.chosen_ord from votes_3t1f v
                          where v.voter_knox = v_knox and v.target_knox = v_speaker),
    'statements', (
      select jsonb_agg(jsonb_build_object(
               'ord', s.ord,
               'content', s.content,
               'is_lie', case when v_reveal then s.is_lie else null end,
               'votes',  case when v_reveal then
                           (select count(*) from votes_3t1f v where v.target_knox = v_speaker
                                                              and v.chosen_ord = s.ord)
                         else null end
             ) order by s.ord)
        from statements s where s.knox_id = v_speaker
    ),
    -- 리빌에서만: 거짓이 아닌 문장에 투표한 사람 = 속은 사람
    'fooled', case when v_reveal then (
      select jsonb_agg(p.name order by p.name)
        from votes_3t1f v
        join participants p on p.knox_id = v.voter_knox
       where v.target_knox = v_speaker
         and v.chosen_ord <> (select s.ord from statements s
                               where s.knox_id = v_speaker and s.is_lie)
    ) else null end,
    'roster', (
      select jsonb_agg(jsonb_build_object(
               'knox_id', p.knox_id, 'name', p.name,
               'has_statements', exists (select 1 from statements s where s.knox_id = p.knox_id),
               'voted', exists (select 1 from votes_3t1f v
                                 where v.voter_knox = p.knox_id and v.target_knox = v_speaker),
               'idx', (select o.i from jsonb_array_elements_text(st.speaker_order)
                              with ordinality o(k, i) where o.k = p.knox_id)
             ) order by p.name)
        from participants p where p.team_no = v_team and p.is_active
    )
  );
end;
$fn$;

-- ---------------------------------------------------------------------
-- 투표 — 재선택 허용(upsert). 게임 2 와 정반대 규칙이니 주의.
-- ---------------------------------------------------------------------
create or replace function cast_vote(p_voter text, p_target text, p_ord int)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_voter  text := lower(trim(coalesce(p_voter, '')));
  v_target text := lower(trim(coalesce(p_target, '')));
  v_team   int;
  st       team_g1_state;
begin
  if v_voter = v_target then raise exception 'CANNOT_VOTE_SELF'; end if;
  if p_ord not between 1 and 4 then raise exception 'BAD_ORD'; end if;

  select p.team_no into v_team from participants p
   where p.knox_id = v_voter and p.is_active;
  if v_team is null then raise exception 'NOT_IN_TEAM'; end if;

  if not exists (select 1 from participants p
                  where p.knox_id = v_target and p.team_no = v_team and p.is_active) then
    raise exception 'NOT_SAME_TEAM';
  end if;

  select * into st from team_g1_state where team_no = v_team;
  if not found or st.phase <> 'speaking' then raise exception 'NOT_VOTING_PHASE'; end if;
  if st.speaker_order ->> st.current_idx is distinct from v_target then
    raise exception 'NOT_CURRENT_SPEAKER';
  end if;

  insert into votes_3t1f (voter_knox, target_knox, chosen_ord)
  values (v_voter, v_target, p_ord)
  on conflict (voter_knox, target_knox)
  do update set chosen_ord = excluded.chosen_ord, voted_at = now();
end;
$fn$;

-- ---------------------------------------------------------------------
-- 발표자의 [다음으로 넘기기] — 미투표는 기권 처리된다.
-- 발표자 본인만 호출할 수 있다.
-- ---------------------------------------------------------------------
create or replace function g1_next(p_knox_id text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_knox text := lower(trim(coalesce(p_knox_id, '')));
  v_team int;
  st     team_g1_state;
begin
  select team_no into v_team from participants where knox_id = v_knox;
  if v_team is null then raise exception 'NOT_IN_TEAM'; end if;

  select * into st from team_g1_state where team_no = v_team for update;
  if not found then raise exception 'NOT_STARTED'; end if;
  if st.speaker_order ->> st.current_idx is distinct from v_knox then
    raise exception 'NOT_SPEAKER';
  end if;

  if st.phase = 'speaking' then
    update team_g1_state set phase = 'reveal_person', phase_started_at = now()
     where team_no = v_team;
  else
    update team_g1_state
       set current_idx = st.current_idx + 1,
           phase = case when st.speaker_order ->> (st.current_idx + 1) is null
                        then 'done' else 'speaking' end,
           turn_started_at = now(), phase_started_at = now()
     where team_no = v_team;
  end if;
end;
$fn$;

grant execute on function admin_start_game1(text)    to anon, authenticated;
grant execute on function get_g1_view(text)          to anon, authenticated;
grant execute on function cast_vote(text, text, int) to anon, authenticated;
grant execute on function g1_next(text)              to anon, authenticated;
