-- =====================================================================
-- Gen Z Lab. 2026년 3분기 워크샵 게임 시스템
-- 02. RLS 정책 + 로그인 RPC
--
-- 반드시 01_schema.sql 을 먼저 실행한 뒤에 실행하세요.
--
-- 설계: anon key 는 공개 저장소 코드에 박혀 나간다. 따라서
--   - 비밀이 없는 테이블(teams / participants / game_state / team_g1_state)만 직접 SELECT 허용
--   - 비밀이 있는 테이블(questions / statements / votes_3t1f / answers / app_config)은
--     RLS 를 켜고 정책을 하나도 만들지 않는다 → 직접 조회·수정 전면 차단
--   - 그 테이블들은 SECURITY DEFINER 함수(RPC)를 통해서만, 게임 진행 단계에 맞춰 노출한다
-- =====================================================================

-- ---------------------------------------------------------------------
-- RLS 활성화 (프로젝트 설정에서 automatic RLS 를 켰다면 이미 켜져 있음 — 중복 실행 무해)
-- ---------------------------------------------------------------------
alter table teams         enable row level security;
alter table participants  enable row level security;
alter table game_state    enable row level security;
alter table team_g1_state enable row level security;
alter table statements    enable row level security;
alter table votes_3t1f    enable row level security;
alter table questions     enable row level security;
alter table answers       enable row level security;
alter table app_config    enable row level security;

-- ---------------------------------------------------------------------
-- 읽기 허용 — 비밀이 없고, Realtime 구독에 SELECT 권한이 필요한 테이블
-- (Realtime 은 RLS SELECT 를 통과해야 이벤트를 밀어준다)
-- ---------------------------------------------------------------------
create policy "read teams"         on teams         for select to anon, authenticated using (true);
create policy "read participants"  on participants  for select to anon, authenticated using (true);
create policy "read game_state"    on game_state    for select to anon, authenticated using (true);
create policy "read team_g1_state" on team_g1_state for select to anon, authenticated using (true);

-- participants 를 전원 공개하는 이유: 조원 리스트(A7)·발표 순서·조 이동 반영에 필요하다.
-- 노출되는 것은 사번(Knox ID)과 이름뿐이며, 행사 종료 후 테이블 삭제가 운영 절차에 포함되어 있다.

-- ---------------------------------------------------------------------
-- 정책 없음 = 전면 차단
--   statements  : is_lie 가 들어 있어 게임 1 이 무너진다
--   questions   : answer 가 들어 있어 게임 2 가 무너진다
--   votes_3t1f  : 남의 투표를 보면 눈치싸움이 깨진다
--   answers     : 남의 답·점수 노출
--   app_config  : PIN 해시
-- 위 다섯은 아래 RPC 로만 접근한다.
-- ---------------------------------------------------------------------

-- =====================================================================
-- 로그인 / 세션 합류
--
-- 프론트 흐름:
--   1) join_session(knoxId)           호출
--   2) NOT_PREREGISTERED 예외가 나면   → 이름 입력 화면(A2) 표시
--   3) join_session(knoxId, name)     재호출 → 조 배정 대기 상태로 입장
--
-- Knox ID 는 소문자로 정규화해 저장·조회한다.
-- 모바일 키보드가 첫 글자를 자동 대문자로 바꾸기 때문에, 이걸 안 하면
-- 명단에 있는 사람이 "명단에 없음"으로 튕긴다.
-- → 프론트 입력창에도 autocapitalize="none" autocorrect="off" 를 반드시 넣을 것.
-- → 명단 CSV 업로드 시에도 동일하게 소문자로 정규화할 것.
-- =====================================================================
create or replace function join_session(p_knox_id text, p_name text default null)
returns participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row participants;
begin
  p_knox_id := lower(trim(coalesce(p_knox_id, '')));

  if p_knox_id = '' then
    raise exception 'KNOX_ID_REQUIRED';
  end if;

  select * into v_row from participants where knox_id = p_knox_id;

  if found then
    update participants
       set last_seen = now()
     where knox_id = p_knox_id
    returning * into v_row;
    return v_row;
  end if;

  -- 명단에 없는 Knox ID
  if coalesce(trim(p_name), '') = '' then
    raise exception 'NOT_PREREGISTERED';
  end if;

  insert into participants (knox_id, name, team_no, is_preregistered)
  values (p_knox_id, trim(p_name), null, false)
  returning * into v_row;

  return v_row;
end;
$$;

-- =====================================================================
-- 생존 신호. 참여자 폰이 화면이 보이는 동안 20초마다 부른다.
-- 대시보드·스크린의 "접속 중" 은 last_seen 이 45초 안인 사람을 센다.
-- 로그인은 아니므로 명단에 없는 ID 면 조용히 아무것도 안 한다.
-- =====================================================================
create or replace function heartbeat(p_knox_id text)
returns void
language sql
security definer
set search_path = public
as $$
  update participants set last_seen = now() where knox_id = lower(trim(coalesce(p_knox_id, '')));
$$;

grant execute on function join_session(text, text)   to anon, authenticated;
grant execute on function admin_verify_pin(text)     to anon, authenticated;
grant execute on function heartbeat(text)            to anon, authenticated;
