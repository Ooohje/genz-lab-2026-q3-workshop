-- =====================================================================
-- 04. 3T1F (statements) RPC — 구현 3단계
--
-- statements 는 RLS 로 전면 차단돼 있다(is_lie 가 노출되면 게임 1 이 무너진다).
-- 접근은 전부 아래 SECURITY DEFINER 함수를 통해서만 한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 저장 — 진실 3개 + 거짓 1개.
--
-- 순서는 저장 시점에 딱 한 번 셔플해 ord 로 박는다.
-- 렌더링할 때마다 섞으면 조원 간 표시 순서가 달라져 득표 집계가 깨진다.
-- 재작성(덮어쓰기)을 허용하되, 이미 투표가 들어온 뒤에는 막는다.
-- ---------------------------------------------------------------------
create or replace function save_statements(p_knox_id text, p_truths text[], p_lie text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lie text := trim(coalesce(p_lie, ''));
  v_clean text[];
begin
  p_knox_id := lower(trim(coalesce(p_knox_id, '')));

  if not exists (select 1 from participants where knox_id = p_knox_id) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  select array_agg(t) into v_clean
    from unnest(coalesce(p_truths, '{}')) as t
   where coalesce(trim(t), '') <> '';

  if coalesce(array_length(v_clean, 1), 0) <> 3 then
    raise exception 'NEED_3_TRUTHS';
  end if;
  if v_lie = '' then
    raise exception 'NEED_LIE';
  end if;

  -- 이미 누군가 나에게 투표했다면 문장을 바꿀 수 없다. 득표가 어긋난다.
  if exists (select 1 from votes_3t1f where target_knox = p_knox_id) then
    raise exception 'ALREADY_VOTED';
  end if;

  delete from statements where knox_id = p_knox_id;

  insert into statements (knox_id, ord, content, is_lie)
  select p_knox_id,
         row_number() over (order by random()),   -- ← 셔플은 여기 한 번뿐
         s.content,
         s.is_lie
    from (
      select trim(t) as content, false as is_lie from unnest(v_clean) as t
      union all
      select v_lie, true
    ) s;
end;
$$;

-- ---------------------------------------------------------------------
-- 내 문장 조회 — 본인 것이므로 is_lie 를 포함해도 된다(자기 거짓말은 안다).
-- ---------------------------------------------------------------------
create or replace function get_my_statements(p_knox_id text)
returns table (ord int, content text, is_lie boolean)
language sql
security definer
set search_path = public
as $$
  select s.ord, s.content, s.is_lie
    from statements s
   where s.knox_id = lower(trim(p_knox_id))
   order by s.ord;
$$;

-- ---------------------------------------------------------------------
-- 우리 조 명단 + 작성 현황.
-- 로비(A6)와 게임 1 조원 리스트(A7)가 쓴다.
-- 분모는 스냅샷이 아니라 호출 시점의 편성으로 매번 계산된다.
-- ---------------------------------------------------------------------
create or replace function get_team_roster(p_knox_id text)
returns table (
  knox_id text,
  name text,
  team_no int,
  is_active boolean,
  has_statements boolean
)
language sql
security definer
set search_path = public
as $$
  select p.knox_id, p.name, p.team_no, p.is_active,
         exists (select 1 from statements s where s.knox_id = p.knox_id) as has_statements
    from participants p
   where p.team_no is not distinct from (
           select p2.team_no from participants p2
            where p2.knox_id = lower(trim(p_knox_id))
         )
     and p.team_no is not null
   order by p.name;
$$;

-- ---------------------------------------------------------------------
-- 전체 작성 현황 (스크린 B1 카운터 · 관리자 대시보드용)
-- joined_count 는 "접속 중" — 45초 안에 heartbeat 를 보낸 사람. 명단 크기가 아니다.
-- (admin_dashboard 의 online 과 같은 정의. 바꾸면 둘 다 바꾼다.)
-- ---------------------------------------------------------------------
create or replace function get_progress_counts()
returns table (joined_count bigint, written_count bigint, unassigned_count bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from participants
      where is_active and last_seen > now() - interval '45 seconds'),
    (select count(distinct s.knox_id) from statements s
       join participants p on p.knox_id = s.knox_id and p.is_active),
    (select count(*) from participants where is_active and team_no is null);
$$;

grant execute on function save_statements(text, text[], text) to anon, authenticated;
grant execute on function get_my_statements(text)             to anon, authenticated;
grant execute on function get_team_roster(text)               to anon, authenticated;
grant execute on function get_progress_counts()               to anon, authenticated;
