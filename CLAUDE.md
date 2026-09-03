# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 다음 세션 시작점 (2026-09-02 기준)

**8단계 구현 + 서버 로직·브라우저 실화면 전 구간 검증 완료. 남은 것은 내용물(문항·명단·조 이름)과 실기기 리허설이다.**

| | 상태 |
|---|---|
| 코드 | 8단계 전부 구현, `main` 에 푸시 완료 |
| 배포 | ✅ https://ooohje.github.io/genz-lab-2026-q3-workshop/ — 2026-09-03 첫 성공. 이전까지 `Roster.jsx` 가 `.gitignore` `roster*` 에 걸려 빠지면서 CI 빌드가 6번 연속 깨져 있었다(로컬은 통과) |
| DB | `db/00~07` 전부 적용. RPC 40개. **데이터는 비어 있음** (2026-09-03 전부 삭제 — 사용자가 직접 채운다) |
| 부하 | ✅ 60명 동시접속 통과 (2026-09-03, `npm run load`) — 4,080요청 · 오류 0 · Realtime 60/60 · p99 ≤ 1s |
| 문서 | `README.md` + `docs/screens/` 실화면 21컷 커밋·푸시 완료 (2026-09-03). 재촬영 스크립트 `npm run screens` (`scripts/capture-screens.mjs`, Playwright) |
| 검증 완료 | 로그인·정규화 · Realtime(실기기 2대) · **게임 1 턴 전환 4턴 전 구간** · **게임 2 출제~채점~리더보드** · 스크린 RPC 3종 · 관리자 23개 PIN 가드 전수 · RLS 잠금 · **브라우저 실화면 전 구간**(참여자 10컷 · 스크린 5컷 · 관리자 4컷) · **GitHub Pages 배포** |
| **미검증** | 실기기 리허설 |
| **미완** | git 히스토리에 유출된 Knox ID 1건 (커밋 4개 · 아래 참조). 재작성 필요 |

### 2026-09-02 검증에서 잡은 버그 3건 (전부 수정·적용 완료)

1. **지각자가 종료된 조를 되살리지 못했다** — `get_g1_view` 가 발표자는 새로 잡으면서 `phase='done'` 을 그대로 둬, 아무도 투표할 수 없는데 지각자의 거짓만 공개됐다.
2. **타이머가 폰 시계를 썼다** — 기준점은 서버 시각인데 `Date.now()` 로 빼고 있었다. 시계가 어긋난 폰은 남은 시간이 통째로 틀렸다. 조회 RPC 3종이 `server_now` 를 싣고 `src/lib/clock.js` 가 보정한다.
3. **참여자 삭제 시 폰이 깨졌다** — Realtime DELETE 의 빈 객체(`{}`)가 `if (!row)` 를 통과해 세션을 오염시켰다.

### 다음에 할 일 (우선순위 순)

1. **사용자가 직접 내용물 입력** (2026-09-03 결정) — 관리자 화면에서 조 추가(`조 추가`, 번호만) → 조원 추가(`+ 조원` 또는 CSV) → 문항 8개. DB 는 비어 있다.
2. 리허설(D-3~D-1) — 폰 2대 이상으로 전 구간. 리허설 뒤에는 대시보드 `리허설 초기화` 로 게임 기록만 지우면 명단·문항은 남는다.
3. 행사 종료 후 — 대시보드 `개인정보 전체 삭제`.
4. (미완) git 히스토리의 Knox ID 1건 — 사용자가 `purge-pii-from-history.sh` 를 직접 돌려야 한다.

용어는 **"조"** 로 간다(2026-09-03). "팀"으로 바꿨다가 사용자가 되돌렸다 — UI·README 전부 "조". DB 컬럼명은 `team_no`·`teams` 그대로(식별자라 안 건드림). `docs/screens/` 스크린샷은 아직 재촬영 안 됨.

### 현재 DB 상태 — 사용자가 리허설 셋업 중

2026-09-03 한 번 전부 비운 뒤, 사용자가 관리자 화면에서 직접 채우고 있다.
마지막 확인 시점(2026-09-03 오후): `teams` 3 · `participants` 6(실명) · `questions` 0 · `phase` lobby.
**이 6명은 실명·실사번이다** — 스크린샷·공개 문서에 넣지 말 것. 데이터는 계속 바뀌므로 실제 상태는 `db/03_verify.sql` 로 확인.

명단·조·문항은 **사용자가 직접 입력**한다. 에이전트가 데모 데이터를 심지 않는다(스크린샷 재촬영 때만 예외 — 심고 바로 복원).

그 전에 걷어낸 것: 테스트 계정 7행(그중 하나가 실명·실사번 형태) · 테스트 조 98·99 · README 촬영용 demo 60명/10조/문항 8개 · 부하 테스트 계정 `loadtest01~60`.

**⚠ 아직 남은 것: git 히스토리.** 그 Knox ID 가 커밋 4개(`1ef4251`·`f7b5db4`·`b37d4ed`·`98fda85`)의 `CLAUDE.md` 에 평문으로 있고 전부 원격에 푸시됐다. 히스토리 재작성(`git filter-branch`/`filter-repo` + `push --force`)이 필요한데, 이 세션에서는 도구 실행이 권한 분류기에 막혀 못 했다. 사용자가 직접 돌려야 한다.

리허설 뒤 게임 기록만 지우려면 대시보드 `리허설 초기화`(`admin_reset_game`). 명단까지 지우려면 `개인정보 전체 삭제`. 스키마부터 다시 만들려면 `db/00_reset.sql`. **셋 다 파괴적이므로 실행 전 확인받는다.**

### 부하 테스트 (2026-09-03) — 60명 동시접속 통과

`npm run load` (`scripts/load-test.mjs`). 가상 참가자 60명이 각자 별도 클라이언트(WebSocket 1개씩)로 실제 앱과 같은 폴링(`game_state` 5s · `get_g1_view` 2s · `get_my_statements`+`get_team_roster` 5s · 본인 행 15s)을 60초 돌리고, 5초 시점에 전원 동시 `save_statements`.

| | 결과 |
|---|---|
| 총 요청 | 4,080건 · **66.8 req/s** |
| 오류 | **0건 (0.00%)** |
| Realtime 구독 | **60/60** |
| `get_g1_view` (가장 잦음, 30/s) | p50 103ms · p95 458ms · p99 507ms |
| `join_session` 60명 동시 | p50 516ms · max 580ms |
| `save_statements` 60명 동시 | p50 828ms · max 874ms |
| 나머지 조회 | p50 ~300ms · p99 ~1s |

**판정: 무료 티어로 충분하다.** 최악 지연(~1s)이 폴링 주기(2~5s)와 문항 제한시간(15s)보다 한참 짧아 요청이 쌓이지 않는다.

주의 — 이 테스트는 `phase=lobby` 에서 돌았다. `get_g1_view` 가 턴 판정 없이 일찍 돌아오는 경로이므로 게임 1 진행 중보다 가볍다. `submit_answer` 폭주(게임 2)도 안 쳤다. 그래도 60 클라이언트 × 2초 폴링 + Realtime 60개라는 **지속 부하**가 핵심이고 그건 검증됐다. 실기기 리허설에서 게임 1·2 구간을 눈으로 한 번 더 본다.

### 파괴적 작업은 먼저 물어본다

MCP 로 DB 를 직접 바꿀 수 있다. 스키마 변경, 데이터 삭제(`admin_reset_game`, `admin_purge_personal_data`, `db/00_reset.sql`)는 **실행 전에 사용자에게 확인**한다.

---

## 이 저장소의 현재 상태

코드베이스는 `src/` 에 있고, Supabase 스키마는 `db/` 에 있다. 아래 문서들은 **설계 근거**이며 저장소에는 없다(로컬 전용).

```
CLAUDE.md
.mcp.json                          Supabase MCP 서버 (2026-09-02 연결)
db/                                00 초기화 / 01 스키마 / 02 RLS / 03 검증
                                   04 3T1F / 05 게임1 / 06 게임2 / 07 스크린+관리자
src/                               앱 (구조는 아래 "구현 현황" 참조)
GenZLab_워크샵_게임시스템_기획서.md   ← 아래 기획서.md와 바이트 단위로 동일한 사본
design_handoff_genzlab_workshop_game/
  README.md                      개발 인계 문서 (디자인 토큰·컴포넌트 규격·화면 27컷)
  기획서.md                       원본 기획서 (아키텍처 근거·DB 스키마·리스크·운영 타임라인)
  Workshop Game System.dc.html   27컷 디자인 시안 (#A1…#C4 앵커)
  assets/genzlab-logo.png        로고 74×74
```

**설계 문서 4종은 저장소에 없다.** 공개 저장소에 내부 운영 정보를 남기지 않으려고 `.gitignore` 로 제외했다(2026-09-01 결정). 클론만 한 환경에서는 보이지 않는다.

**기획서가 두 벌 있고 내용이 같다.** 한쪽만 고치면 조용히 갈라진다. 수정할 일이 생기면 두 파일을 함께 고치거나, 먼저 어느 쪽을 정본으로 남길지 확인한다.

새 화면을 만들 때는 `design_handoff_genzlab_workshop_game/README.md`(하이파이 스펙)를 먼저 본다. `기획서.md` 와 충돌하면 README가 최신이다.

`Workshop Game System.dc.html`은 **참조용 시안이며 제품 코드로 복사하지 않는다.** 커스텀 태그(`<x-dc>`, `<helmet>`)와 인라인 스타일 구조는 무시하고, 레이아웃·색·치수만 참고한다. 브라우저로 열어 `#A1`…`#C4` 앵커로 각 화면을 볼 수 있다.

## 만들 것

사내 워크샵(60명 / 10조) 레크레이션 실시간 웹앱. Kahoot 대체.
게임 1 = 3 Truths 1 Fake(조 내부 자율 진행), 게임 2 = 전체 조 대항 퀴즈(O/X 4 + 4지선다 4).

권장 스택 (기획서 §8 STEP 2 확정안):

```
React + Vite + Tailwind + supabase-js
해시 라우터 (GitHub Pages 새로고침 404 회피)
프론트: GitHub Pages (GitHub Actions 자동 배포)
백엔드: Supabase 무료 티어 (Postgres + Realtime + Storage) — 별도 서버 없음
```

## 명령어

```bash
npm run dev      # 개발 서버 (http://localhost:5173/genz-lab-2026-q3-workshop/)
npm run build    # 프로덕션 빌드 → dist/
npm run preview  # 빌드 결과 확인
npm run lint     # oxlint
```

테스트 러너는 아직 없다. 검증은 브라우저에서 직접 하고, DB 는 `db/03_verify.sql` 로 확인한다.

`npm run dev` 의 URL 에 **base 경로가 붙는다**(`/genz-lab-2026-q3-workshop/`). 루트로 들어가면 화면이 안 뜬다.

배포 URL이 `https://{계정}.github.io/genz-lab-2026-q3-workshop/` 형태의 하위 경로이므로 Vite `base`를 그 경로로 맞춰야 한다. 기본값 `/`로 두면 GitHub Pages에서 에셋 404가 난다.

**하나의 SPA에 세 개의 뷰**가 들어간다. 각 뷰는 기준 해상도가 달라 반응형이 아니라 별도 레이아웃이다.

| 뷰 | 라우트 | 기준 해상도 |
|---|---|---|
| 참여자 | `#/` | 모바일 375 × 812 |
| 스크린(빔프로젝터) | `#/screen` | 1920 × 1080 |
| 관리자 | `#/admin` | 데스크톱 1440 × 900 |

## 절대 어기면 안 되는 규칙

### 1. 브랜드 표기 — `Gen Z Lab.`

대문자 G·Z·L, 단어 사이 띄어쓰기 1칸, **끝에 마침표 필수**. UI 텍스트·로고 alt·코드 내 문자열·문서·커밋 메시지 어디에서도 예외 없다.
금지 변형: `GenZ Lab` / `Gen Z Lab`(마침표 누락) / `GENZ LAB` / `Gen z lab.` / `GenZLab.`
행사명은 `2026년 3분기 워크샵` 고정.

구현 후 전수 검수:

```bash
grep -rn "Gen Z Lab" src/
```

### 2. 색의 의미는 고정 — 재해석 금지

- 진실 = `truth` `#2F5CF0` 파랑, 거짓 = `fake` `#F0392B` 빨강 (게임 1 리빌)
- O = `truth` 파랑, X = `fake` 빨강 (게임 2)
- **4지선다에는 `truth`/`fake`를 쓰지 않는다.** O/X 의미와 혼동되므로 `option-1…4` 별도 4색을 쓴다.

전체 토큰과 `tailwind.config.js` 스니펫은 README §4에 확정값으로 있다. 색·사이즈·radius를 임의로 정하지 말고 그대로 옮긴다.

### 3. 게임 1과 게임 2의 제출 규칙이 정반대다

| | 게임 1 (3T1F 투표) | 게임 2 (퀴즈 답안) |
|---|---|---|
| 제출 | **재선택 허용 (upsert)** — 설명을 듣다 생각이 바뀌면 바꿀 수 있다 | **1회 확정, 변경 불가** |
| 제약 | `votes_3t1f UNIQUE(voter, target)` + upsert | `answers UNIQUE(question_id, knox_id)` |
| UI | "재선택 가능"을 문구로 명시 | "변경할 수 없어요"를 명시 |

이 둘을 같은 패턴으로 구현하면 안 된다.

### 4. 분모는 스냅샷이 아니라 매번 현재 편성 기준으로 계산

완료 판정("활성 조원 전원 투표")과 조 점수 분모는 그 시점의 `teams`/`participants`를 매번 조회해 계산한다. 게임 도중 관리자가 조를 옮겨도 집계가 자동으로 따라가야 한다. 게임 시작 시점 인원수를 저장해두고 쓰면 조 이동에서 깨진다.

조 점수 = 조원 개인 점수 합 ÷ **게임 2에서 1문항 이상 응답한** 조원 수 (접속만 하고 잠수한 인원이 분모를 부풀리지 않게).

### 5. 타이머는 서버 기준

`game_state.question_started_at`(서버 타임스탬프) + `time_limit_sec`를 저장하고, 각 단말은 **남은 시간을 계산해 표시만** 한다. 클라이언트에서 카운트다운을 시작하지 않는다.
채점 유효성: 서버 도착 시각이 `시작시각 + 제한시간 + 2초` 이내인 답안만 인정.

### 6. 3T1F 문장 순서는 저장 시 1회 셔플해 `ord`로 고정

렌더링할 때마다 랜덤으로 섞으면 조원 간 표시 순서가 달라져 득표 집계가 깨진다. 저장 시점에 섞어 DB에 박는다.

### 7. 시안과 의도적으로 다른 부분

되돌리지 말 것. 시안과 대조하다 "빠졌다"고 판단해 복원하면 사용자 결정을 뒤집는 것이 된다.

- **A1 로그인의 "개인 LTE로 접속해 주세요." 문구 삭제** (2026-09-01 사용자 요청). 시안과 기획서 §7 리스크 #1 에는 있지만 참여자 화면에서는 뺀다. 스크린 뷰 B1 에도 같은 문구가 있는데, 6단계에서 붙일 때 남길지 사용자에게 확인할 것.

### 8. 라이트 전용 — 브라우저 강제 다크 모드를 차단해 둔다

`index.html` 의 `<meta name="color-scheme" content="light">` 와 `src/index.css` 의 `:root { color-scheme: light }` 는 짝이다. **둘 다 지우지 말 것.**

Chrome·삼성 인터넷의 "다크 모드 강제 적용"이 켜진 폰에서는 브라우저가 페이지 색을 임의로 반전시킨다. 보라 배경이 탁해지고 흰 카드가 회색이 되며, **게임 2 화면(`bg-ink`)은 의도적으로 어두운 디자인인데 오히려 흰색으로 뒤집혀 완전히 망가진다.** 60명 중 몇 명은 반드시 이 설정이 켜져 있다.

다크 테마를 새로 만들지 않는다. 이 앱은 화면마다 배경색이 의미를 갖는다(brand 보라 = 입장·로비, ink 검정 = 게임 2, brand-deep = 발표자 본인).

### 9. 레이아웃·에셋 세부 (README §4.3, §10)

- 형제 간격은 전부 flex/grid `gap`으로 만든다. **margin으로 형제 간격을 만들지 않는다.** 스케일은 `4 · 8 · 10 · 14 · 20 · 26`.
- 선택 상태는 border가 아니라 `box-shadow: 0 0 0 3px <색>`. border를 쓰면 선택할 때마다 레이아웃이 흔들린다.
- 하단 CTA는 항상 화면 최하단 고정(한 손 조작). 최소 탭 영역 48 × 48.
- `assets/genzlab-logo.png`는 **투명 배경이 아니다.** 검정 배경 위 흰 워드마크이므로 `border-radius:50%` 원형 클리핑으로 쓴다. `alt`는 반드시 `Gen Z Lab.`.
- 스크린 뷰(1920px)에는 **24px 미만 텍스트를 두지 않는다.** 실사용 범위 24–136px.

### 10. 소프트 타이머 — 시스템이 대화를 끊지 않는다

게임 1의 2분 경과는 **색 변경 + "슬슬 다음 분으로!" 배지만** 표시한다. 강제 전환 없음. 하드 컷은 설정 플래그로 두되 기본 off.

## 아키텍처의 심장 — `game_state` 단일 행

```
lobby → game1 → game1_reveal → game2_wait → game2_question
      → game2_answer → leaderboard → final
```

`game_state`는 `id=1` 단일 행이다. 전 단말(참여자 60 + 스크린 + 관리자)이 이 행을 Supabase Realtime으로 구독하고, 관리자가 이 행을 바꾸면 모두의 화면이 2초 내 전환된다. **이것을 가장 먼저 구현한다** — 여기까지 되면 절반 완성이다.

구독 대상:
- `game_state` — 전원 (phase 전환)
- `participants` 본인 행 — 조 이동 즉시 반영
- `votes_3t1f` / `answers` — 집계용, 3~5초 폴링 허용

복구 경로 (행사장에서 실제로 가장 자주 터지는 부분):
- `visibilitychange`에서 `game_state` 재조회 + 채널 **재구독** (폰 화면 꺼짐)
- localStorage 세션 + 서버 phase 기준 화면 복원 (새로고침·앱 이탈)
- 지각자는 언제 들어와도 현재 phase로 합류

관리자 권한은 클라이언트에서 판단하지 않는다. Supabase RPC에서 PIN을 검증한 뒤에만 `game_state` 변경을 허용한다(참여자가 `#/admin` URL을 알아도 조작 불가).

### DB 구축 (2026-09-01 스키마 · 2026-09-02 RPC 전체)

`db/` 의 SQL 을 Supabase 프로젝트 `xzfecrlzejtjwpvjunkc` 에 실행해둔 상태다. 테이블 9개, RLS 정책 4개, RPC 2개(`join_session`, `admin_verify_pin`), Realtime 3개 테이블. `db/03_verify.sql` 을 돌리면 현재 상태를 8줄로 검증할 수 있다.

스키마를 바꿀 일이 생기면 `db/` 의 파일을 고치고 SQL Editor 에 다시 붙여넣는다. `db/00_reset.sql` 은 **모든 데이터를 지운다** — 명단·문항이 들어간 뒤에는 리허설 초기화 용도로만 쓴다.

**`pgcrypto` 는 `public` 이 아니라 `extensions` 스키마에 있다.** `SECURITY DEFINER` 함수에 `set search_path = public` 을 걸면 함수 안에서 `crypt()` 를 못 찾아 생성 단계에서 실패한다. `extensions.crypt(...)`, `extensions.gen_salt(...)` 처럼 스키마를 명시할 것. 다른 Supabase 확장(uuid-ossp 등)을 쓸 때도 동일하다.

### 잠근 테이블에 접근하는 RPC 는 단계별로 추가한다

현재 RPC 는 로그인(`join_session`)과 PIN 검증뿐이다. 3T1F 저장·조회, 투표, 리빌, 답안 제출·채점, 리더보드 집계는 **해당 구현 단계에 도달했을 때** 작성한다. 한꺼번에 만들면 검증할 방법이 없다.

## 구현 순서

README §12의 8단계를 순서대로 따른다. 각 단계가 독립적으로 테스트 가능하도록 잘라둔 것이므로 **건너뛰지 않는다.**

세팅 → 로그인+동기화 뼈대 → 3T1F 작성 → 게임 1 → 게임 2 → 스크린 뷰 → 관리자 → 예외 처리+배포

**단계마다 폰 2대로 실제 동기화를 눈으로 확인한다.** Realtime은 로컬 단일 브라우저에서는 잘 되는 것처럼 보인다.

### 구현 현황 (2026-09-02)

**8단계 전부 구현 완료.** 남은 것은 내용물(문항·명단·조 이름)과 실기기 검증이다.

```
db/                 00 초기화 · 01 스키마 · 02 RLS/로그인 · 03 검증
                    04 3T1F · 05 게임1 · 06 게임2 · 07 스크린+관리자
src/
  App.jsx                      해시 라우터 (#/ · #/screen · #/admin)
  lib/                         supabase · session · phases
  hooks/                       useGameState · useParticipant · useMyGame · useG1 · useQuestion
  components/                  TopBar · Cta · BottomBar · Timer · NoticeBanner · ErrorBoundary
  views/participant/           Login(A1) NameEntry(A2) TeamWait(A3) StatementForm(A4/A5)
                               Lobby(A6) LookUp game1/ game2/
  views/screen/ScreenView.jsx  B1~B5 한 파일
  views/admin/                 AdminView(C1) Dashboard(C2) Roster(C3) Questions(C4)
```

**db/ 의 SQL 00~07 은 2026-09-02 에 전부 적용 완료했다.** RPC 40개가 실동작 검증까지 끝났다 — 문장 저장·셔플·입력검증, 게임 1 턴 전환 4턴 전 구간(자동 리빌 · 5초 후 전환 · 재선택 upsert · 발표자 단축 · 지각자 합류 · 발표자 이탈 건너뛰기 · 가드 6종), 게임 2 출제~채점~리더보드(스피드 보너스 차등 · 1회 확정 · `TOO_LATE` · 조 이동 시 분모 자동 추종), 관리자 24개 PIN 가드 전수. 2026-09-03 에 `admin_rename_participant`(이름 정정) · `admin_change_knox_id`(Knox ID 정정 — 새 행 생성 → 자식 FK 이동 → 옛 행 삭제로 작성·투표·답안 보존, demo60 왕복 검증) 추가.

**브라우저 실화면도 전 구간 확인했다**(2026-09-03, `docs/screens/` 21컷). 남은 미검증은 실기기 리허설뿐이다.

Supabase MCP 서버가 `.mcp.json` 에 연결돼 있다(2026-09-02). 세션 시작 시 도구가 로드되므로, 연결 직후 세션에서는 안 보이고 새 세션부터 쓸 수 있다.

`db/` 의 SQL 은 **번호 순서대로** 실행한다. 04~07 은 RPC 뿐이라 여러 번 돌려도 안전하다(`create or replace`). 01·02 는 테이블을 만드므로 재실행하려면 `00_reset.sql` 이 먼저다.

스크린 뷰는 `#/screen?phase=lobby` 처럼 phase 를 강제해 DB 를 건드리지 않고 각 화면을 미리 볼 수 있다. 리허설 전 빔프로젝터 점검에 쓴다.

### 게임 1 턴 전환은 `get_g1_view` 안에서 판정한다

발표자 폰이 죽어도 다른 조원의 폴링이 대신 턴을 넘겨주게 하려는 것이다. 조회 함수에 부수효과가 있는 게 어색해 보여도 걷어내지 말 것 — 걷어내면 한 명 때문에 조 전체가 멈춘다. 행사장에서 가장 흔한 사고다.

### Realtime 만 믿지 않는다 — 폴링 안전망이 필수

`useGameState` 는 5초, `useParticipant` 는 15초 간격으로 폴링한다(화면이 보일 때만). **이걸 "실시간인데 폴링이 왜 필요하냐"고 지우면 안 된다.**

폰을 켜둔 채로 WebSocket 만 조용히 죽는 경우가 있다(LTE 캐리어 NAT 타임아웃, 순간 끊김). 이때는 `visibilitychange`·`focus`·`online` 중 무엇도 발생하지 않아 재구독 로직이 전혀 돌지 않고, 참여자는 멈춘 화면을 보며 계속 기다린다. 2026-09-01 실기기 테스트에서 실제로 재현됐다 — DB 의 phase 는 바뀌었는데 폰 2대가 따라오지 않았고, 같은 시각 별도 클라이언트로 붙어보니 이벤트는 정상 전달되고 있었다. 즉 서버·코드가 아니라 죽은 소켓이 원인이었다.

`channel.state === 'joined'` 도 믿을 수 없다. 클라이언트가 끊김을 아직 눈치채지 못한 상태일 수 있어, 재동기화 시에는 상태와 무관하게 무조건 다시 붙는다.

Realtime 은 빠른 경로(1초 이내)로 그대로 두고 폴링은 보험이다. `game_state` 는 단일 행이라 60명이 5초마다 조회해도 초당 12건으로 무료 티어에서 문제없다.

### Realtime 채널 이름은 매번 유니크해야 한다

고정 이름(`.channel('game_state_sync')`)을 쓰면 **StrictMode 의 이펙트 2회 실행에서 같은 토픽으로 채널이 겹쳐 두 번째 구독이 `SUBSCRIBED` 에 도달하지 못한다.** 화면은 멀쩡히 뜨는데 전환만 안 되는, 찾기 어려운 증상이 된다. `crypto.randomUUID()` 를 붙여 매번 다른 이름을 쓴다. 새 구독을 만들 때도 같은 규칙을 지킬 것.

증상이 의심되면 콘솔에 `WebSocket is closed before the connection is established` 가 찍히는지 본다.

### dev 서버가 "does not provide an export named ..." 를 뱉으면

파일은 멀쩡한데 Vite HMR 캐시가 꼬인 것이다. `npm run build` 로 진짜 오류인지 먼저 가른 뒤, `rm -rf node_modules/.vite` 하고 서버를 재시작한다.

## 아직 정해지지 않은 값

README §13의 미정값 6개 중 현재 상태 (2026-09-01 기준):

| 값 | 상태 |
|---|---|
| Supabase Project URL | ✅ `https://xzfecrlzejtjwpvjunkc.supabase.co` |
| Supabase publishable key | ✅ `sb_publishable_gH8Bq6zz0IzYqlKXdwOeRw_4l4D8rx1` (구 anon key. 프론트에 박혀도 되는 공개 키) |
| 관리자 PIN | ✅ 설정 완료. **평문은 어디에도 없다** — DB 에 bcrypt 해시로만 존재하고 `db/01_schema.sql` 에는 자리표시자 `'0000'` 이 들어 있다. 값을 물어보거나 파일에 적지 말 것 |
| GitHub Pages 배포 URL | ✅ https://ooohje.github.io/genz-lab-2026-q3-workshop/ (2026-09-03 배포 성공) |
| 명단 (Knox ID, 이름, 조) | ⬜ 사용자가 관리자 화면에서 직접 입력한다 (2026-09-03 결정). CSV 업로드 또는 조 카드의 `+ 조원` |
| 문항 8개 최종본 | ⬜ 사용자가 관리자 문항 탭에서 직접 입력 |
| 조 이름 | ✖ 쓰지 않기로 함 (2026-09-03). `N조` 자동 |
| 데모 데이터 | 2026-09-03 전부 삭제. DB 는 스키마·RPC·PIN 만 남은 빈 상태. 상세는 맨 위 "현재 DB 상태" |

나머지는 만들어내지 말고 사용자에게 확인한다. 시안에 들어있는 문항·조 이름·QR·밈 이미지는 전부 **자리표시자**다.

**Knox ID 는 소문자로 정규화한다.** 모바일 키보드가 첫 글자를 자동 대문자로 바꾸기 때문에, 정규화를 빠뜨리면 명단에 있는 사람이 "명단에 없음"으로 튕긴다. DB(`join_session` RPC)와 CSV 업로드 양쪽에서 `lower(trim())`, 입력창에는 `autocapitalize="none" autocorrect="off"`.

## 개인정보

Knox ID와 이름만 수집한다. **행사 종료 후 테이블 삭제**가 운영 절차에 포함되어 있으므로, 초기화·삭제 기능을 관리자 뷰에 반드시 남긴다.
