# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 이 저장소의 현재 상태

**코드베이스가 아직 없다.** 이 디렉터리는 구현 착수 전의 **디자인 인계 번들**이다.

```
CLAUDE.md
db/                                Supabase 에 적용할 SQL (00 초기화 / 01 스키마 / 02 RLS / 03 검증)
GenZLab_워크샵_게임시스템_기획서.md   ← 아래 기획서.md와 바이트 단위로 동일한 사본
design_handoff_genzlab_workshop_game/
  README.md                      개발 인계 문서 (디자인 토큰·컴포넌트 규격·화면 27컷·구현 순서)
  기획서.md                       원본 기획서 (아키텍처 근거·DB 스키마·리스크·당일 운영 타임라인)
  Workshop Game System.dc.html   27컷 디자인 시안 (#A1…#C4 앵커)
  assets/genzlab-logo.png        로고 74×74
```

**이 문서들은 저장소에 없다.** 공개 저장소에 내부 운영 정보를 남기지 않으려고 `.gitignore` 로 제외했다(2026-09-01 결정). 로컬 작업 폴더에만 있으므로, 클론만 한 환경에서는 이 파일들이 보이지 않는다.

**기획서가 두 벌 있고 내용이 같다.** 한쪽만 고치면 조용히 갈라진다. 기획서를 수정할 일이 생기면 두 파일을 함께 고치거나, 먼저 사용자에게 어느 쪽을 정본으로 남길지 확인한다.

작업 시작 전 `design_handoff_genzlab_workshop_game/README.md`(하이파이 스펙)와 `기획서.md`(설계 근거)를 모두 읽는다. 둘이 충돌하면 README가 최신이다.

`Workshop Game System.dc.html`은 **참조용 시안이며 제품 코드로 복사하지 않는다.** 스트리밍 프리뷰용 커스텀 태그(`<x-dc>`, `<helmet>`)와 인라인 스타일 구조는 무시하고, 안쪽 마크업의 레이아웃·색·치수만 컴포넌트로 재구성한다. 브라우저로 열어 `#A1`…`#C4` 앵커로 각 화면을 확인할 수 있다.

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

### DB 는 이미 구축돼 있다 (2026-09-01 적용 완료)

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

**db/ 의 SQL 00~07 은 2026-09-02 에 전부 적용 완료했다.** RPC 22개가 실동작 검증까지 끝났다(문장 저장·셔플·입력검증·집계·PIN 가드). 미검증으로 남은 것은 **게임 1 턴 전환 흐름**(발표 순서 배정 → 투표 → 자동 리빌 → 다음 발표자)이다. 조가 하나도 없어서 아직 돌려보지 못했다.

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
| GitHub Pages 배포 URL | ⬜ 레포명은 `genz-lab-2026-q3-workshop` 확정, 계정명·배포 미완 |
| 명단 CSV (Knox ID, 이름, 조) | ⬜ |
| 테스트 데이터 | 2026-09-02 기준 `participants` 에 테스트 7행(`js60.oh` `skeka` `jj60.` `ㅇㅇ` `ii` `ㄷㄷ` `test.claude`). `teams` 는 비어 있고 전원 배정 대기 상태. 실제 명단 업로드 전에 관리자 화면에서 정리할 것 |
| 문항 8개 최종본 | ⬜ |
| 조 이름 10개 | ⬜ |

나머지는 만들어내지 말고 사용자에게 확인한다. 시안에 들어있는 문항·조 이름·QR·밈 이미지는 전부 **자리표시자**다.

**Knox ID 는 소문자로 정규화한다.** 모바일 키보드가 첫 글자를 자동 대문자로 바꾸기 때문에, 정규화를 빠뜨리면 명단에 있는 사람이 "명단에 없음"으로 튕긴다. DB(`join_session` RPC)와 CSV 업로드 양쪽에서 `lower(trim())`, 입력창에는 `autocapitalize="none" autocorrect="off"`.

## 개인정보

Knox ID와 이름만 수집한다. **행사 종료 후 테이블 삭제**가 운영 절차에 포함되어 있으므로, 초기화·삭제 기능을 관리자 뷰에 반드시 남긴다.
