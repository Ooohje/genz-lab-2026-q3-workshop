-- =====================================================================
-- Gen Z Lab. 2026년 3분기 워크샵 게임 시스템
-- 01. 테이블 스키마 + 관리자 PIN 검증 RPC + Realtime 활성화
--
-- 실행 위치: Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣고 Run
-- 주의: 이 파일만 실행한 상태는 보안이 열려 있습니다. 반드시 02번도 이어서 실행하세요.
-- =====================================================================

-- Supabase 는 확장을 extensions 스키마에 설치한다. 아래 호출도 전부 extensions. 로 명시한다.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 조 (조 자체도 추가·삭제·이름변경 대상이므로 고정 10개가 아님)
-- ---------------------------------------------------------------------
create table teams (
  team_no   int primary key,
  name      text    not null,
  is_active boolean not null default true,
  ord       int     not null default 0
);

-- ---------------------------------------------------------------------
-- 참가자 (team_no NULL = 조 배정 대기)
-- ---------------------------------------------------------------------
create table participants (
  knox_id          text primary key,
  name             text    not null,
  team_no          int     references teams(team_no) on delete set null,
  is_active        boolean not null default true,
  is_preregistered boolean not null default false,
  joined_at        timestamptz not null default now(),
  last_seen        timestamptz not null default now()
);
create index participants_team_no_idx on participants (team_no);

-- ---------------------------------------------------------------------
-- 3T1F 문장 — 저장 시점에 순서를 셔플해 ord로 고정한다.
-- 렌더링할 때마다 섞으면 조원 간 표시 순서가 달라져 득표 집계가 깨진다.
-- ---------------------------------------------------------------------
create table statements (
  id      bigint generated always as identity primary key,
  knox_id text    not null references participants(knox_id) on delete cascade,
  ord     int     not null check (ord between 1 and 4),
  content text    not null,
  is_lie  boolean not null,
  unique (knox_id, ord)
);
create index statements_knox_id_idx on statements (knox_id);

-- ---------------------------------------------------------------------
-- 3T1F 투표 — 재선택 허용(upsert). PK가 곧 UNIQUE(voter, target).
-- 게임 2의 answers 와 규칙이 정반대이니 주의.
-- ---------------------------------------------------------------------
create table votes_3t1f (
  voter_knox  text not null references participants(knox_id) on delete cascade,
  target_knox text not null references participants(knox_id) on delete cascade,
  chosen_ord  int  not null check (chosen_ord between 1 and 4),
  voted_at    timestamptz not null default now(),
  primary key (voter_knox, target_knox),
  check (voter_knox <> target_knox)
);
create index votes_3t1f_target_idx on votes_3t1f (target_knox);

-- ---------------------------------------------------------------------
-- 조별 게임 1 턴 상태 (조마다 독립적으로 진행)
-- turn_started_at 은 소프트 타이머(2분 경과 배지)의 기준.
-- ---------------------------------------------------------------------
create table team_g1_state (
  team_no         int  primary key references teams(team_no) on delete cascade,
  speaker_order   jsonb not null default '[]'::jsonb,
  current_idx     int   not null default 0,
  phase           text  not null default 'speaking'
                  check (phase in ('speaking','reveal_person','done')),
  turn_started_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 퀴즈 문항
--   type='ox' → options 는 빈 배열, answer 는 'O' 또는 'X'
--   type='mc' → options 는 문자열 4개 배열, answer 는 '1'~'4'
-- ---------------------------------------------------------------------
create table questions (
  id             bigint generated always as identity primary key,
  ord            int  not null,
  type           text not null check (type in ('ox','mc')),
  body           text not null,
  image_url      text,
  options        jsonb not null default '[]'::jsonb,
  answer         text not null,
  time_limit_sec int  not null default 15,
  explanation    text
);
create index questions_ord_idx on questions (ord);

-- ---------------------------------------------------------------------
-- 답안 — 1회 확정, 변경 불가. score 는 서버(RPC)가 계산해 넣는다.
-- ---------------------------------------------------------------------
create table answers (
  question_id bigint  not null references questions(id) on delete cascade,
  knox_id     text    not null references participants(knox_id) on delete cascade,
  choice      text    not null,
  answered_at timestamptz not null default now(),
  is_correct  boolean not null,
  score       int     not null default 0,
  primary key (question_id, knox_id)
);
create index answers_knox_id_idx on answers (knox_id);

-- ---------------------------------------------------------------------
-- 전역 게임 상태 — id=1 단일 행. 전 단말이 이 행을 Realtime 구독한다.
-- 전체 동기화의 심장.
-- ---------------------------------------------------------------------
create table game_state (
  id                  int  primary key default 1 check (id = 1),
  phase               text not null default 'lobby'
                      check (phase in ('lobby','game1','game1_reveal','game2_wait',
                                       'game2_question','game2_answer','leaderboard','final')),
  current_question_id bigint references questions(id) on delete set null,
  question_started_at timestamptz,
  revealed            boolean not null default false,
  notice              text,
  speed_bonus_enabled boolean not null default true,
  hard_cut_enabled    boolean not null default false,
  updated_at          timestamptz not null default now()
);
insert into game_state (id) values (1);

-- ---------------------------------------------------------------------
-- 설정값 (관리자 PIN 해시 등)
-- ---------------------------------------------------------------------
create table app_config (
  key   text primary key,
  value text not null
);

-- =====================================================================
-- 관리자 PIN
-- 아래 '0000' 은 자리표시자다. 실제 PIN 은 이미 DB 에 bcrypt 해시로 들어가 있으므로
-- 이 파일에는 평문을 남기지 않는다(공개 저장소로 올라가는 파일이다).
-- PIN 변경은 SQL Editor 에서 직접:
--   update app_config set value = extensions.crypt('새PIN', extensions.gen_salt('bf'))
--    where key = 'admin_pin_hash';
-- 평문이 아니라 bcrypt 해시로 저장되므로 DB 를 열어봐도 PIN 은 보이지 않습니다.
-- =====================================================================
insert into app_config (key, value)
values ('admin_pin_hash', extensions.crypt('0000', extensions.gen_salt('bf')));

create or replace function admin_verify_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_config
    where key = 'admin_pin_hash'
      and value = extensions.crypt(p_pin, value)
  );
$$;

-- =====================================================================
-- Realtime 활성화 — 이 세 테이블의 변경이 전 단말에 푸시된다.
--   game_state    : phase 전환 (전원 구독)
--   participants  : 조 이동 즉시 반영
--   team_g1_state : 조별 턴 전환
-- =====================================================================
alter publication supabase_realtime add table game_state;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table team_g1_state;
