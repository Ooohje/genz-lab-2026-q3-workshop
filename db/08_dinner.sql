-- =====================================================================
-- 08. 석식 참석 투표 (dinner RSVP) — 워크샵 게임과 별개의 부가 기능
--
-- 라우트 #/dinner. 워크샵과 같은 Knox ID 로 로그인해 참석/미참석을 누른다.
-- 재선택 허용(upsert). 집계는 관리자만 본다(대시보드).
--
-- 04~07 과 마찬가지로 여러 번 실행해도 안전하다(create ... if not exists /
-- create or replace). 01_schema.sql 이 먼저 적용돼 있어야 한다.
-- =====================================================================

create table if not exists dinner_rsvp (
  knox_id    text primary key references participants(knox_id) on delete cascade,
  choice     text not null check (choice in ('yes','no')),
  updated_at timestamptz not null default now()
);

-- RLS 켜고 정책 없음 = 직접 접근 전면 차단. 아래 RPC 로만.
-- (남의 응답을 폰에서 못 보게 한다. 집계는 관리자 PIN 뒤에서만.)
alter table dinner_rsvp enable row level security;

-- ---------------------------------------------------------------------
-- 참여자 — 내 현재 응답 조회 (없으면 choice = null)
-- ---------------------------------------------------------------------
create or replace function get_dinner_rsvp(p_knox_id text)
returns jsonb
language sql security definer set search_path = public
as $fn$
  select jsonb_build_object(
    'choice', (select choice from dinner_rsvp where knox_id = lower(trim(coalesce(p_knox_id, '')))),
    'server_now', now()
  );
$fn$;

-- ---------------------------------------------------------------------
-- 참여자 — 응답 제출/변경. 게임 2 답안과 달리 재선택 허용(upsert).
-- ---------------------------------------------------------------------
create or replace function submit_dinner_rsvp(p_knox_id text, p_choice text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare v text := lower(trim(coalesce(p_knox_id, '')));
begin
  if v = '' then raise exception 'KNOX_ID_REQUIRED'; end if;
  if p_choice not in ('yes','no') then raise exception 'BAD_CHOICE'; end if;
  if not exists (select 1 from participants where knox_id = v) then
    raise exception 'NOT_A_PARTICIPANT';
  end if;

  insert into dinner_rsvp (knox_id, choice, updated_at)
  values (v, p_choice, now())
  on conflict (knox_id) do update
    set choice = excluded.choice, updated_at = now();

  return jsonb_build_object('choice', p_choice);
end;
$fn$;

-- ---------------------------------------------------------------------
-- 관리자 — 집계. 분모는 스냅샷이 아니라 호출 시점의 활성 참여자로 매번 계산.
-- ---------------------------------------------------------------------
create or replace function admin_dinner_tally(p_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;

  return jsonb_build_object(
    'yes', (select count(*) from dinner_rsvp r
              join participants p on p.knox_id = r.knox_id and p.is_active
             where r.choice = 'yes'),
    'no',  (select count(*) from dinner_rsvp r
              join participants p on p.knox_id = r.knox_id and p.is_active
             where r.choice = 'no'),
    'total_active', (select count(*) from participants where is_active),
    'not_yet', (select count(*) from participants p
                 where p.is_active
                   and not exists (select 1 from dinner_rsvp r where r.knox_id = p.knox_id)),
    'yes_list', coalesce((select jsonb_agg(jsonb_build_object('knox_id', p.knox_id, 'name', p.name)
                                           order by p.name)
                            from dinner_rsvp r
                            join participants p on p.knox_id = r.knox_id and p.is_active
                           where r.choice = 'yes'), '[]'::jsonb),
    'no_list',  coalesce((select jsonb_agg(jsonb_build_object('knox_id', p.knox_id, 'name', p.name)
                                           order by p.name)
                            from dinner_rsvp r
                            join participants p on p.knox_id = r.knox_id and p.is_active
                           where r.choice = 'no'), '[]'::jsonb),
    'server_now', now()
  );
end;
$fn$;

-- ---------------------------------------------------------------------
-- 관리자 — 석식 응답만 초기화. 리허설 뒤 사용. 명단은 그대로.
-- where true 는 Supabase safeupdate 가드(WHERE 없는 DELETE 차단) 회피용.
-- ---------------------------------------------------------------------
create or replace function admin_reset_dinner(p_pin text)
returns void
language plpgsql security definer set search_path = public
as $fn$
begin
  if not admin_verify_pin(p_pin) then raise exception 'BAD_PIN'; end if;
  delete from dinner_rsvp where true;
end;
$fn$;

grant execute on function get_dinner_rsvp(text)          to anon, authenticated;
grant execute on function submit_dinner_rsvp(text, text) to anon, authenticated;
grant execute on function admin_dinner_tally(text)       to anon, authenticated;
grant execute on function admin_reset_dinner(text)       to anon, authenticated;
