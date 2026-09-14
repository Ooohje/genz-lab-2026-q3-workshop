-- =====================================================================
-- 09. 범용 투표(poll) — 워크샵 게임과 별개의 부가 기능
--
-- 08_dinner.sql(석식 참석)과 같은 성격의 기능이 계속 늘어나서(팀 발표 투표,
-- 트렌더즈 현장 접수 …) 매번 테이블 하나씩 새로 만들지 않고 poll_id 로
-- 구분되는 범용 테이블 하나로 통합했다. 08_dinner.sql 의 dinner_rsvp 는
-- 이미 배포돼 실제 응답이 쌓여 있을 수 있어 그대로 둔다 — 이 파일과 무관.
--
-- 라우트 #/poll/<slug> (src/lib/polls.js 에서 slug → poll_id 매핑).
-- 로그인은 워크샵과 같은 Knox ID. 재선택 허용(upsert). 득표수는 관리자만
-- 본다 — 참여자·스크린에는 절대 숫자를 보내지 않는다(아래 get_poll_rank).
--
-- 지금 정의된 poll_id 둘:
--   best_team        — 팀 발표 투표. choice = 팀 번호(문자열). 본인 팀 선택 불가.
--   trenders_2026h2  — "2026 하반기 트렌더즈 현장 접수". choice = 'yes' | 'no'.
--
-- 새 투표를 추가할 때: submit_poll_vote / admin_poll_tally / get_poll_rank
-- 안의 if/case 분기에 poll_id 하나씩 늘리면 된다. 04~08 과 마찬가지로
-- 여러 번 실행해도 안전하다.
-- =====================================================================

create table if not exists poll_votes (
  poll_id    text not null,
  knox_id    text not null references participants(knox_id) on delete cascade,
  choice     text not null,
  updated_at timestamptz not null default now(),
  primary key (poll_id, knox_id)
);
create index if not exists poll_votes_poll_id_idx on poll_votes (poll_id);

-- RLS 켜고 정책 없음 = 직접 접근 전면 차단. 아래 RPC 로만.
alter table poll_votes enable row level security;

-- ---------------------------------------------------------------------
-- 스크린 공개 여부. 값은 켜짐/꺼짐뿐이라 비밀이 없어 공개 읽기를 허용한다 —
-- 스크린·참여자 폰이 이 값 자체를 폴링/구독해서 순위 화면을 켤지 말지 정한다.
-- 실제 득표수는 이 테이블에 없다(get_poll_rank 가 별도로 계산해서 숫자는 뺀다).
-- ---------------------------------------------------------------------
create table if not exists poll_reveal (
  poll_id    text primary key,
  visible    boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table poll_reveal enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'poll_reveal' and policyname = 'read poll_reveal'
  ) then
    create policy "read poll_reveal" on poll_reveal for select to anon, authenticated using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'poll_reveal'
  ) then
    alter publication supabase_realtime add table poll_reveal;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 참여자 — 내 현재 응답 조회 (없으면 choice = null)
-- ---------------------------------------------------------------------
create or replace function get_poll_vote(p_poll_id text, p_knox_id text)
returns jsonb
language sql security definer set search_path = public
as $fn$
  select jsonb_build_object(
    'choice', (select choice from poll_votes
                where poll_id = p_poll_id
                  and knox_id = lower(trim(coalesce(p_knox_id, '')))),
    'server_now', now()
  );
$fn$;

-- ---------------------------------------------------------------------
-- 참여자 — 응답 제출/변경(upsert). poll_id 별로 유효한 choice 를 서버가 검증한다.
-- 클라이언트 필터(예: 본인 팀 안 보이게)를 우회해도 여기서 다시 막는다.
-- ---------------------------------------------------------------------
create or replace function submit_poll_vote(p_poll_id text, p_knox_id text, p_choice text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_knox text := lower(trim(coalesce(p_knox_id, '')));
  v_own_team int;
begin
  if v_knox = '' then raise exception 'KNOX_ID_REQUIRED'; end if;
  if not exists (select 1 from participants where knox_id = v_knox) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  if p_poll_id = 'trenders_2026h2' then
    if p_choice not in ('yes', 'no') then raise exception 'BAD_CHOICE'; end if;

  elsif p_poll_id = 'best_team' then
    if p_choice !~ '^[0-9]+$' then raise exception 'BAD_CHOICE'; end if;
    if not exists (select 1 from teams where team_no = p_choice::int and is_active) then
      raise exception 'BAD_CHOICE';
    end if;
    select team_no into v_own_team from participants where knox_id = v_knox;
    if v_own_team is not null and v_own_team = p_choice::int then
      raise exception 'CANNOT_VOTE_OWN_TEAM';
    end if;

  else
    raise exception 'UNKNOWN_POLL';
  end if;

  insert into poll_votes (poll_id, knox_id, choice, updated_at)
  values (p_poll_id, v_knox, p_choice, now())
  on conflict (poll_id, knox_id) do update
    set choice = excluded.choice, updated_at = now();

  return jsonb_build_object('choice', p_choice);
end;
$fn$;

-- ---------------------------------------------------------------------
-- 관리자 — 집계(득표수 포함). 분모는 스냅샷이 아니라 호출 시점의 활성
-- 참여자로 매번 계산. best_team 은 0표 팀도 포함해 전 팀을 보여준다.
-- voters 는 이름까지 나오는 원본 목록 — 관리자가 CSV 로 내려받을 때 쓴다.
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
          select jsonb_agg(jsonb_build_object('choice', t.team_no::text, 'label', t.name, 'n', coalesce(x.n, 0))
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

-- ---------------------------------------------------------------------
-- 참여자·스크린 — 순위만. 득표수(n)는 절대 포함하지 않는다.
-- poll_reveal.visible 이 꺼져 있으면 관리자가 버튼을 누르기 전이므로
-- {visible:false} 만 돌려준다 — 네트워크 탭을 봐도 순위가 새어나가지 않는다.
-- ---------------------------------------------------------------------
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

  -- 스크린엔 1등·2등만 내보낸다(게임 2 최종 시상과 같은 포디움 스타일로 그린다).
  -- limit 을 여기(서버)에서 걸어서, 누가 네트워크 탭을 열어봐도 3등 이하는
  -- 아예 응답에 없다 — 프론트에서 slice 만 하는 것보다 안전하다.
  return jsonb_build_object(
    'visible', true,
    'ranking', case
      when p_poll_id = 'best_team' then
        coalesce((
          select jsonb_agg(jsonb_build_object('team_no', z.team_no, 'name', z.name) order by z.n desc, z.ord)
            from (
              select t.team_no, t.name, t.ord, coalesce(x.n, 0) as n
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

-- ---------------------------------------------------------------------
-- 관리자 — 스크린 공개 토글. 대시보드의 "스크린에 순위 공개" 버튼이 부른다.
-- ---------------------------------------------------------------------
create or replace function admin_set_poll_reveal(p_pin text, p_poll_id text, p_visible boolean)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  insert into poll_reveal (poll_id, visible, updated_at)
  values (p_poll_id, coalesce(p_visible, false), now())
  on conflict (poll_id) do update
    set visible = excluded.visible, updated_at = now();
end;
$fn$;

-- ---------------------------------------------------------------------
-- 관리자 — 특정 투표 응답만 초기화. 리허설 뒤 사용. 명단·다른 투표는 그대로.
-- ---------------------------------------------------------------------
create or replace function admin_reset_poll(p_pin text, p_poll_id text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  delete from poll_votes where poll_id = p_poll_id;
  update poll_reveal set visible = false, updated_at = now() where poll_id = p_poll_id;
end;
$fn$;

grant execute on function get_poll_vote(text, text)             to anon, authenticated;
grant execute on function submit_poll_vote(text, text, text)    to anon, authenticated;
grant execute on function admin_poll_tally(text, text)          to anon, authenticated;
grant execute on function get_poll_rank(text)                   to anon, authenticated;
grant execute on function admin_set_poll_reveal(text, text, boolean) to anon, authenticated;
grant execute on function admin_reset_poll(text, text)          to anon, authenticated;
