-- =====================================================================
-- 03. 세팅 검증 — 01, 02 를 실행한 뒤 이걸 돌려 결과를 확인하세요.
-- 모든 행의 result 가 'OK' 여야 합니다.
-- =====================================================================
select '테이블 9개' as 항목,
       case when count(*) = 9 then 'OK' else '실패: ' || count(*) || '개만 있음' end as result
  from pg_tables
 where schemaname = 'public'
   and tablename in ('teams','participants','statements','votes_3t1f',
                     'team_g1_state','questions','answers','game_state','app_config')
union all
select 'RLS 전부 활성화',
       case when count(*) = 9 then 'OK' else '실패: ' || count(*) || '개만 켜짐' end
  from pg_tables
 where schemaname = 'public' and rowsecurity = true
   and tablename in ('teams','participants','statements','votes_3t1f',
                     'team_g1_state','questions','answers','game_state','app_config')
union all
select '읽기 정책 4개 (teams/participants/game_state/team_g1_state)',
       case when count(*) = 4 then 'OK' else '실패: ' || count(*) || '개' end
  from pg_policies
 where schemaname = 'public'
union all
select '비밀 테이블 5개는 정책 0개 (전면 차단)',
       case when count(*) = 0 then 'OK' else '실패: ' || count(*) || '개 정책이 붙어 있음' end
  from pg_policies
 where schemaname = 'public'
   and tablename in ('statements','votes_3t1f','questions','answers','app_config')
union all
select 'game_state 단일 행',
       case when count(*) = 1 then 'OK' else '실패: ' || count(*) || '행' end
  from game_state
union all
select 'RPC 2개 (join_session / admin_verify_pin)',
       case when count(*) = 2 then 'OK' else '실패: ' || count(*) || '개' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('join_session','admin_verify_pin')
union all
select 'Realtime 3개 테이블',
       case when count(*) = 3 then 'OK' else '실패: ' || count(*) || '개' end
  from pg_publication_tables
 where pubname = 'supabase_realtime'
   and tablename in ('game_state','participants','team_g1_state')
union all
select '관리자 PIN 이 기본값 0000 이 아닌지',
       case when exists (select 1 from app_config
                          where key = 'admin_pin_hash' and value = extensions.crypt('0000', value))
            then '경고: 아직 0000 입니다 — 바꾸세요'
            else 'OK' end;
