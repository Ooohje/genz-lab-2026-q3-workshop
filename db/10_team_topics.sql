-- =====================================================================
-- 10. 팀 발표 주제 — teams.topic
--
-- 지금까지는 "1팀 · 첫 스마트폰"처럼 발표 주제를 teams.name 에 그냥 같이
-- 적어 넣었다. 이 파일은 그걸 팀 이름과 분리된 필드로 뺀다 —
--   - teams.name 은 계속 "N팀" 같은 순수 팀 식별자로 쓴다
--   - teams.topic (선택, 비워둘 수 있다)에 발표 주제만 관리한다
--   - 팀 발표 투표(best_team, db/09_polls.sql)의 옵션·집계·스크린 순위에
--     topic 이 있으면 "N팀 - 주제" 형식으로, 없으면 기존처럼 팀 이름만 보여준다
--
-- 기존에 name 에 주제를 같이 적어둔 팀은 자동으로 안 나뉜다 — 관리자가
-- 명단 화면에서 "발표 주제" 를 새로 입력해야 "N팀 - 주제" 형식이 적용된다.
-- 04~09 와 마찬가지로 여러 번 실행해도 안전하다.
-- =====================================================================

alter table teams add column if not exists topic text;

-- ---------------------------------------------------------------------
-- 관리자 — 팀 발표 주제 입력/수정. 비우면(빈 문자열·공백) null 로 저장돼
-- "N팀 - " 처럼 빈 주제가 붙는 일이 없다.
-- ---------------------------------------------------------------------
create or replace function admin_set_team_topic(p_pin text, p_team_no int, p_topic text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  update teams set topic = nullif(trim(coalesce(p_topic, '')), '') where team_no = p_team_no;
end;
$fn$;

grant execute on function admin_set_team_topic(text, int, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- admin_roster 가 topic 도 같이 내려주게 갱신 (관리자 명단 화면에서 보임/편집).
-- ---------------------------------------------------------------------
create or replace function admin_roster(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  return jsonb_build_object(
    'teams', coalesce((select jsonb_agg(jsonb_build_object(
                 'team_no', team_no, 'name', name, 'topic', topic, 'is_active', is_active, 'ord', ord)
                 order by ord, team_no) from teams), '[]'::jsonb),
    'participants', coalesce((select jsonb_agg(jsonb_build_object(
                 'knox_id', p.knox_id, 'name', p.name, 'team_no', p.team_no,
                 'is_active', p.is_active,
                 'has_statements', exists (select 1 from statements s where s.knox_id = p.knox_id))
                 order by p.team_no nulls first, p.name) from participants p), '[]'::jsonb)
  );
end;
$fn$;

-- ---------------------------------------------------------------------
-- admin_poll_tally(best_team) / get_poll_rank(best_team) 라벨을
-- "N팀 - 주제"(topic 있음) 또는 팀 이름(없음) 으로 바꾼다.
-- ---------------------------------------------------------------------
create or replace function admin_poll_tally(p_pin text, p_poll_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;

  return jsonb_build_object(
    'poll_id', p_poll_id,
    'reveal_visible', coalesce((select visible from poll_reveal where poll_id = p_poll_id), false),
    'total_active', (select count(*) from participants where is_active),
    'voted', (select count(*) from poll_votes r
                join participants p on p.knox_id = r.knox_id and p.is_active
               where r.poll_id = p_poll_id),
    'not_yet', (select count(*) from participants p
                 where p.is_active
                   and not exists (select 1 from poll_votes r
                                     where r.poll_id = p_poll_id and r.knox_id = p.knox_id)),
    'counts', case
      when p_poll_id = 'best_team' then
        coalesce((
          select jsonb_agg(jsonb_build_object(
                   'choice', t.team_no::text,
                   'label', case when coalesce(t.topic, '') <> ''
                                 then t.team_no::text || '팀 - ' || t.topic
                                 else t.name end,
                   'n', coalesce(x.n, 0))
                   order by coalesce(x.n, 0) desc, t.ord)
            from teams t
            left join (
              select r.choice, count(*) as n
                from poll_votes r
                join participants p on p.knox_id = r.knox_id and p.is_active
               where r.poll_id = p_poll_id
               group by r.choice
            ) x on x.choice = t.team_no::text
           where t.is_active
        ), '[]'::jsonb)
      else
        coalesce((
          select jsonb_agg(jsonb_build_object(
                   'choice', x.choice,
                   'label', case x.choice when 'yes' then '참여' when 'no' then '미참여' else x.choice end,
                   'n', x.n)
                   order by x.n desc)
            from (
              select r.choice, count(*) as n
                from poll_votes r
                join participants p on p.knox_id = r.knox_id and p.is_active
               where r.poll_id = p_poll_id
               group by r.choice
            ) x
        ), '[]'::jsonb)
    end,
    'voters', coalesce((
      select jsonb_agg(jsonb_build_object('choice', r.choice, 'knox_id', p.knox_id, 'name', p.name)
                        order by p.name)
        from poll_votes r
        join participants p on p.knox_id = r.knox_id and p.is_active
       where r.poll_id = p_poll_id
    ), '[]'::jsonb),
    'server_now', now()
  );
end;
$fn$;

create or replace function get_poll_rank(p_poll_id text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare v_visible boolean;
begin
  select visible into v_visible from poll_reveal where poll_id = p_poll_id;
  if not coalesce(v_visible, false) then
    return jsonb_build_object('visible', false, 'server_now', now());
  end if;

  return jsonb_build_object(
    'visible', true,
    'ranking', case
      when p_poll_id = 'best_team' then
        coalesce((
          select jsonb_agg(jsonb_build_object('team_no', z.team_no, 'name', z.label) order by z.n desc, z.ord)
            from (
              select t.team_no, t.ord, coalesce(x.n, 0) as n,
                     case when coalesce(t.topic, '') <> ''
                          then t.team_no::text || '팀 - ' || t.topic
                          else t.name end as label
                from teams t
                left join (
                  select r.choice, count(*) as n
                    from poll_votes r
                    join participants p on p.knox_id = r.knox_id and p.is_active
                   where r.poll_id = p_poll_id
                   group by r.choice
                ) x on x.choice = t.team_no::text
               where t.is_active
               order by coalesce(x.n, 0) desc, t.ord
               limit 2
            ) z
        ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'server_now', now()
  );
end;
$fn$;

grant execute on function admin_roster(text)         to anon, authenticated;
grant execute on function admin_poll_tally(text, text) to anon, authenticated;
grant execute on function get_poll_rank(text)         to anon, authenticated;
