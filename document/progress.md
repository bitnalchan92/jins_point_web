# 진행 상황

> **마지막 갱신**: 2026-06-30 (프로덕션 배포 완료 — Vercel(`dalcomjins.com`) + Supabase 클라우드, 손님 UI 개선, 커스텀 도메인 연결)
> **현재 단계**: Stage 2 **프로덕션 운영 중** (`dalcomjins.com`)

Stage 1(UI 목업)에서 Stage 2(실서비스 기반)로 전환했습니다. 데이터는 이제 Supabase PostgreSQL에 영속되며, owner는 TOTP MFA로 인증하고, 포인트 거래는 DB 원자 함수가 검증합니다.

**프로덕션 URL**: `https://dalcomjins.com` (사장님: `/admin`)

## 한 줄 컨셉

> 동네 단골을 위한, 전화번호만으로 쌓이는 포인트 — **달콤한 진스쿡**

## 화면 진행 상태

### 사장님 흐름 — **4 / 4 완성** 🟢

| 화면 | 상태 | 파일 | 핵심 |
|------|:----:|------|------|
| 로그인 | ✅ | `OwnerLoginScreen.tsx` | 4자리 PIN, 점 시각화, 온스크린 키패드, DEMO 자동 입력, shake 오류 애니메이션 |
| 포인트 (적립·사용) | ✅ | `OwnerRewardScreen.tsx` | 뒷번호 4자리 3단계 흐름(조회→선택→금액), POS 2단 레이아웃, 1,000P 단위 사용 제약, 토스트 |
| 손님 관리 | ✅ | `OwnerCustomerManageScreen.tsx` | 이름/번호 검색, 카드 그리드, 신규 손님 추가 (이름+전화번호), Toast 완료 알림 |
| 대시보드 | ✅ | `OwnerDashboardScreen.tsx` | KPI 3종(오늘 적립/손님 수/총 포인트) 실시간, 가게 정보, 단골 TOP 3, 적립률 인라인 수정, 로그아웃 |

로그인 후 **상단 탭바**로 포인트·손님 관리·대시보드 전환 (와이드 POS 레이아웃, max-w-1180px).

### 손님 흐름 — **2 / 2 완성** 🟢

| 화면 | 상태 | 파일 | 핵심 |
|------|:----:|------|------|
| 랜딩 | ✅ | `CustomerLandingScreen.tsx` | 🍙 브랜드 카드 + 전화번호 입력 + DEMO 빠른 입력 칩 (단골 2 / 신규 1) |
| 내 포인트 조회 | ✅ | `CustomerPointScreen.tsx` | 마스킹 이름 인사말, 잔액, 소셜 링크(인스타·네이버플레이스), 적립 이력 10건 |

조회 화면 ↻ 버튼으로 랜딩 복귀.

## 의사결정 — 16건

| # | 결정 | 상태 |
|---|------|------|
| [0001](./adr/0001-tech-stack.md) | Vite + React + Tailwind v4 | Accepted |
| [0002](./adr/0002-phone-based-identification.md) | 손님 식별 = 전화번호 only | Superseded by 0014 |
| [0003](./adr/0003-single-store-scope.md) | 단일 매장 스코프 | Accepted |
| [0004](./adr/0004-percent-reward-policy.md) | 결제금액 % 적립 (사장님이 설정) | Accepted |
| [0005](./adr/0005-design-tone.md) | 따뜻한 카페 톤 | Superseded by 0008 |
| [0006](./adr/0006-demo-mode-switcher.md) | 데모 토글로 화면 전환 | Superseded by 0010 |
| [0007](./adr/0007-owner-authentication.md) | 사장님 인증 = 4자리 PIN | Superseded by 0014 |
| [0008](./adr/0008-design-tone-jinscook.md) | 디자인 톤 재정의: 달콤한 진스쿡 (크림 + 옐로우) | Accepted |
| [0009](./adr/0009-four-digit-customer-lookup.md) | 손님 조회 = 휴대폰 뒷자리 4자리 (캐셔 UX) | Accepted |
| [0010](./adr/0010-react-router.md) | React Router 도입 (`/` 손님 / `/admin` 사장님) | Accepted |
| [0011](./adr/0011-typescript-strict.md) | TypeScript strict 도입 (ADR-0001 일부 대체) | Accepted |
| [0012](./adr/0012-supabase-backend.md) | 백엔드: Supabase 도입 (DB · Edge Functions · Realtime) | Accepted |
| [0013](./adr/0013-web-push.md) | Web Push 알림 전략 (VAPID · Service Worker) | Deferred |
| [0014](./adr/0014-production-auth-and-authorization.md) | 프로덕션 인증·인가 = Auth + owner MFA | Accepted |
| [0015](./adr/0015-flutter-customer-app.md) | 고객 클라이언트 = Flutter iOS/Android 앱 | Deferred |
| [0016](./adr/0016-web-only-stage2.md) | Stage 2 고객 클라이언트 = React 웹 유지 | Accepted |

## 화면 흐름

```
[URL 라우팅]
 │
 ├─ /admin — 사장님 (와이드 POS, max-w-1180px)
 │   └─ OwnerLoginScreen (PIN 키패드, DEMO 버튼)
 │       └─ ── 상단 탭바 ──────────────────────
 │           ├─ ☕ OwnerRewardScreen (POS 2단 분할)
 │           │    └─ STEP 1: 뒷번호 4자리 입력
 │           │    └─ STEP 2: 복수 매칭 선택 (0/1명이면 생략)
 │           │    └─ STEP 3: 금액 입력 → 적립 또는 사용
 │           ├─ 👥 OwnerCustomerManageScreen (카드 그리드 + 신규 추가)
 │           └─ 📊 OwnerDashboardScreen
 │                └─ 로그아웃 → 로그인 화면
 │
 └─ / — 손님 (phone frame, max-w-430px)
     └─ CustomerLandingScreen
         └─ 전화번호 입력 → CustomerPointScreen
             └─ ↻ → 다시 랜딩
```

공유 상태: `src/store.tsx` (React Context). 사장님이 적립/사용하면 손님 조회·대시보드에 실시간 반영됩니다.

## 데이터 시드

모든 화면이 `src/lib/data.ts`의 **단일 데이터셋**을 공유합니다.

### 상수

| 상수 | 값 |
|------|-----|
| `STORE_NAME` | `달콤한 진스쿡` |
| `STORE_TAGLINE` | `김밥 · 샌드위치 전문점` |
| `POINT_RATE` | `0.05` (기본값, 사장님이 대시보드에서 변경 가능) |
| `REWARD_THRESHOLD` | `5000` (5,000P → 무료 메뉴 1개, 손님 화면에는 미표시) |
| `OWNER_PIN` | `1234` (Stage 1 데모 전용, Stage 2에서 제거) |

### 손님 시드 (5명)

| 이름 | 전화번호 | 포인트 | 방문 | 최근 방문 |
|------|---------|--------|------|----------|
| 김서연 | `010-2345-7788` | 3,420P | 18회 | 6월 26일 |
| 이준호 | `010-9876-5432` | 5,180P | 24회 | 6월 27일 |
| 박지우 | `010-3456-1290` | 1,240P | 7회 | 6월 25일 |
| 최민재 | `010-7788-0011` | 760P | 4회 | 6월 24일 |
| 정하윤 | `010-2233-4455` | 2,890P | 13회 | 6월 26일 |

5명 모두 손님 관리·대시보드·포인트 조회에서 잔액이 실시간 표시됩니다.

### 대시보드 KPI (실시간 계산)

| 항목 | 소스 |
|------|------|
| 오늘 적립 | 이번 세션 rewardLog 중 earn 건수 |
| 손님 수 | customers.length (신규 추가 즉시 반영) |
| 총 사용가능 포인트 | 전체 손님 포인트 합산 |

## 다음 단계 후보

### Stage 2 — 고객·owner 웹 실서비스 전환 ✅ 구현 완료 (배포 대기)

실행 계획: **[plan-stage2.md](./plan-stage2.md)** — ADR-0016 기준. 9개 Task를 TDD로 구현, 각 단계 커밋.

| Task | 내용 | 상태 | 커밋 |
|------|------|:----:|------|
| 1 | 테스트 도구 + Supabase 로컬 환경 | ✅ | `902950c` |
| 2 | Core schema + deny-by-default RLS (pgTAP) | ✅ | `b380537` |
| 3 | 원자적 포인트 거래 + idempotency | ✅ | `d6d2348` |
| 4 | Turnstile 기반 최소 잔액 Edge Function | ✅ | `34b5798` |
| 5 | 고객 React 웹 → 최소 잔액 API 연결 | ✅ | `05aabbb` |
| 6 | owner 이메일·비밀번호 + 필수 TOTP MFA | ✅ | `431f31f` |
| 7 | owner-api Edge Function + 운영 화면 영속화 | ✅ | `2824fbc` · `c761473` |
| 8 | owner 전용 private Realtime | ✅ | `40e9f50` |
| 9 | E2E·Vercel·CI 설정 + 프로덕션 배포 | ✅ | `bdc04bb` · `dc4e25a` |

**로컬 검증**: DB pgTAP 35 · Edge(Deno) 42 · 프론트(vitest) 52 · lint·typecheck·build 모두 통과.
**프로덕션 운영 중**: `https://dalcomjins.com` (Vercel), Supabase 클라우드, GitHub Actions CI ✅

---

## 알려진 한계 / TODO

### 데이터

- [x] 영속화 — Supabase PostgreSQL (새로고침 후에도 포인트·내역 유지) ([ADR-0012](./adr/0012-supabase-backend.md))
- [x] owner 화면 다기기 실시간 동기화 — private Realtime invalidation (Task 8)

### 기능 누락

- [x] 포인트 사용 (차감) 흐름 — 포인트 탭 모드 토글로 구현
- [x] 가게 적립률 수정 — 대시보드 인라인 편집
- [x] 라우팅 분리 (`/` 손님 / `/admin` 사장님)
- [x] 손님 신규 등록 — 손님 관리 탭에서 이름+전화번호 추가
- [x] 캐셔 UX — 뒷번호 4자리로 손님 조회, 복수 매칭 선택 UI
- [x] 포인트 사용 1,000P 단위 제약
- [x] 프로덕션 owner Auth + 필수 TOTP MFA (aal2) ([ADR-0014](./adr/0014-production-auth-and-authorization.md), Task 6)
- [x] 원자적 포인트 처리 — DB 함수가 권한·금액·적립률·잔액·idempotency 검증 (Task 3)
- [x] 고객 최소 잔액 조회 — Turnstile + 다중 rate limit, PII 미반환 (Task 4·5)
- [ ] 가게 이름·PIN 변경 (미구현)
- [x] 고객 적립 이력 최근 10건 표시 (earn/use, 포인트 변동, 잔액, 날짜)
- [ ] 고객 상세 내역·알림 (보류 — ADR-0016 재검토 조건)
- [ ] 픽업 주문·결제 (보류 — 주문 확정 시 클라이언트 재설계)

### 디자인 / UX

- [ ] 다크 모드 (현재 라이트만)
- [ ] 손님 랜딩에 가게 소개 문구 (추후 추가 예정)

### 인프라

- [x] strict TypeScript 도입 ([ADR-0011](./adr/0011-typescript-strict.md))
- [x] 백엔드 결정: Supabase ([ADR-0012](./adr/0012-supabase-backend.md))
- [x] RLS·owner MFA·Turnstile 조회·원자적 포인트 처리 구현 (Stage 2, Task 2~8)
- [x] CI(GitHub Actions) + Vercel 설정 + E2E 스펙 작성 (Task 9)
- [x] 프로덕션 배포 — Vercel(`dalcomjins.com`) + Supabase 클라우드
- [x] 커스텀 도메인 연결 — 가비아 DNS → Vercel (`dalcomjins.com` primary, `www` redirect)

## 검증 상태

| 항목 | 상태 |
|------|:----:|
| `npm run build` | ✅ 통과 |
| `npm run lint` (oxlint) | ✅ 실제 이슈 0건 (pre-existing 경고만) |
| `npm run typecheck` | ✅ `strict: true` 통과 |
| DB 테스트 (`supabase test db`, pgTAP) | ✅ 35건 통과 |
| Edge 테스트 (`test:edge`, Deno) | ✅ 42건 통과 |
| 프론트 테스트 (`npm run test`, vitest) | ✅ 52건 통과 |
| E2E (Playwright) | 🟡 스펙 작성 완료 / staging 환경에서 실행 |
| CI (GitHub Actions `verify.yml`) | ✅ 통과 |
| 프로덕션 배포 | ✅ `dalcomjins.com` 운영 중 |
| 보안 검증 (anon 직접 접근·Turnstile 위조) | ✅ 통과 |

## 커밋 이력 (요약)

| 커밋 | 내용 |
|------|------|
| `e10fac4` | 진행 상황 문서 추가 (최초 버전) |
| `86a0727` | 사장님 흐름 완성 (로그인 + 손님 조회 + 대시보드 + 탭바) |
| `fb8284b` | 손님 랜딩 화면 + 수동 테스트 가이드 |
| `1153065` | 손님 포인트 조회 화면 + 화면 구조 분리 + ADR-0006 |
| `4b57213` | ADR 0001~0005 + 프로젝트 README |
| 전면 리팩토링 | prototype.html 기준 전면 재작성 — 디자인 톤(ADR-0008), 공유 상태, POS 레이아웃 |
| MVP 기능 | 포인트 사용(차감) + 적립률 인라인 설정 |
| 라우팅·손님 관리 | React Router 도입(`/`·`/admin`), 손님 신규 추가, 4자리 뒷번호 조회 흐름, 대시보드 개편, 손님 화면 UX 정리 |
| TypeScript strict 마이그레이션 | `.jsx`→`.tsx`, `.js`→`.ts` 전환, `tsconfig` 3개 추가, `strict: true` + `noUncheckedIndexedAccess` 적용, ADR-0009~0011 작성 |
| `902950c` | Stage 2 Task 1 — 테스트 도구(vitest/Deno/Playwright) + Supabase 로컬 환경 |
| `b380537` | Stage 2 Task 2 — Core schema + deny-by-default RLS (pgTAP) |
| `d6d2348` | Stage 2 Task 3 — 원자적 포인트 거래 + idempotency |
| `34b5798` | Stage 2 Task 4 — Turnstile 기반 최소 잔액 Edge Function |
| `05aabbb` | Stage 2 Task 5 — 고객 웹 → 최소 잔액 API 연결 (PII 제거) |
| `431f31f` | Stage 2 Task 6 — owner 이메일·비밀번호 + 필수 TOTP MFA (PIN 제거) |
| `2824fbc` · `c761473` | Stage 2 Task 7 — owner-api Edge Function + 운영 화면 영속화 |
| `40e9f50` | Stage 2 Task 8 — owner 전용 private Realtime invalidation |
| `bdc04bb` | Stage 2 Task 9 — E2E 스펙 + vercel.json + GitHub Actions CI |
| `dc4e25a` | fix: font CDN URL, CORS apikey 헤더, functions deno.json |
| `edc1d7e` | fix: 프로덕션 배포 이슈 해결 (SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS) |
| `5abe245` · `b38ffb9` · `116a8be` | ci: E2E job + secrets 환경변수 정비 |
| `6b2a2dd` | feat: 손님 화면 UI 개선 — 마스킹 이름 인사말, 소셜 링크, 적립 이력, 로그아웃 아이콘, Turnstile 카드, 모바일 overscroll |
| `e54fcc1` | fix: reward_log `balance_after` 컬럼명 수정 |
| `982c42b` | fix: 이력 표시 `points_delta` 사용 (구매금액 → 실제 적립포인트) |

전체 이력: `git log --oneline`

## 프로덕션 인프라 현황

| 항목 | 값 |
|------|-----|
| **프론트엔드** | Vercel — `https://dalcomjins.com` |
| **백업 URL** | `https://jins-point-web.vercel.app` |
| **DNS** | 가비아 → Vercel (A: `76.76.21.21`, CNAME: `cname.vercel-dns.com`) |
| **DB / Auth** | Supabase 클라우드 |
| **Edge Functions** | `lookup-balance`, `owner-api` (Supabase Deno) |
| **Rate limit** | Upstash Redis (IP 20회/10분, 전화번호 5회/10분) |
| **Captcha** | Cloudflare Turnstile |
| **CI** | GitHub Actions `verify.yml` (lint·typecheck·build·pgTAP·Deno·vitest) |

### Edge Function Secrets (Supabase)

| 키 | 용도 |
|----|------|
| `TURNSTILE_SECRET_KEY` | Cloudflare 서버 검증 |
| `TURNSTILE_EXPECTED_HOSTNAME` | `dalcomjins.com` ← 커스텀 도메인 연결 후 반드시 갱신 |
| `TURNSTILE_EXPECTED_ACTION` | `lookup` |
| `UPSTASH_REDIS_REST_URL` | Upstash rate limit |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash 인증 |
| `PHONE_RATE_LIMIT_HMAC_SECRET` | 전화번호 digest 키 |
| `ALLOWED_ORIGINS` | `https://dalcomjins.com,https://www.dalcomjins.com,https://jins-point-web.vercel.app` |

### Vercel 환경변수

| 키 | 용도 |
|----|------|
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon public key |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare 위젯 site key |

## 외부 서비스 설명

### Cloudflare Turnstile — 봇 차단 캡챠

**무엇인가**: Google reCAPTCHA와 비슷한 봇 차단 서비스. 손님이 포인트 조회 버튼을 누를 때 "내가 사람임을 증명"하는 토큰을 발급해준다.

**왜 필요한가**: 손님 포인트 조회 API(`lookup-balance`)는 인증 없이 전화번호만 있으면 호출할 수 있다. 봇이 무작위 전화번호로 대량 조회하면 DB 부하 + 개인정보 노출 위험이 생긴다. Turnstile이 이걸 막는다.

**어떻게 동작하나**:
1. 손님 브라우저에서 Cloudflare 스크립트가 **사용자 행동을 분석** (마우스 움직임, 타이핑 패턴 등)
2. 사람이라고 판단되면 **일회용 토큰** 발급 (유효시간 짧음)
3. 손님이 조회 버튼을 누르면 이 토큰을 서버에 함께 전송
4. Edge Function(`lookup-balance`)이 Cloudflare 서버에 토큰을 검증 요청
5. 유효하면 조회 진행, 아니면 400 거부

**관리 위치**: `https://dash.cloudflare.com` → Turnstile

**주의사항**:
- `TURNSTILE_EXPECTED_HOSTNAME`은 **실제 접속 도메인**과 일치해야 함
- 도메인이 바뀌면 이 값도 함께 업데이트 후 함수 재배포 필요
- Site Key(공개)는 Vercel 환경변수 `VITE_TURNSTILE_SITE_KEY`에, Secret Key(비공개)는 Supabase 시크릿 `TURNSTILE_SECRET_KEY`에 저장

---

### Upstash Redis — API 호출 횟수 제한 (Rate Limit)

**무엇인가**: 클라우드 Redis 서비스. Redis는 초고속 인메모리 저장소로, "이 IP에서 지난 10분간 몇 번 호출했는지" 같은 카운터를 관리하는 데 최적화되어 있다.

**왜 필요한가**: Turnstile이 봇을 막아줘도, 악의적인 사람이 캡챠를 직접 풀면서 반복 조회할 수 있다. Rate limit은 "같은 IP·전화번호로 일정 횟수 이상 조회하면 차단"하는 2차 방어선이다.

**어떻게 동작하나**:

| 제한 | 기준 | 한도 |
|------|------|------|
| IP 전체 조회 수 | 요청자 IP 주소 | 20회 / 10분 |
| 전화번호별 조회 수 | 전화번호 HMAC digest | 5회 / 10분 |

- 한도 초과 시 429 응답 → 손님 화면에 "조회 요청이 많아 잠시 제한되었어요" 표시
- 전화번호는 원문 그대로 저장하지 않고 **HMAC-SHA256 해시**로 변환해서 저장 (PII 보호)
- 슬라이딩 윈도우 방식: 마지막 요청 시점부터 10분이 지나면 카운터 자동 초기화

**관리 위치**: `https://console.upstash.com` → Redis 데이터베이스

**주의사항**:
- Upstash는 **요청 수 기반 과금**. 현재 트래픽 수준에서는 무료 티어(일 10,000회)로 충분
- `UPSTASH_REDIS_REST_URL`과 `UPSTASH_REDIS_REST_TOKEN`은 Upstash 콘솔 → 데이터베이스 → REST API 탭에서 확인 가능

## 갱신 가이드

이 문서는 화면 추가/수정이나 단계 전환이 있을 때 갱신합니다.

1. 상단 **마지막 갱신** 줄 (날짜 + 작업 내용)
2. **화면 진행 상태** 표
3. 새 ADR이 생겼다면 **의사결정** 표
4. **데이터 시드**가 바뀌었다면 표 갱신
5. 완료한 TODO 항목 체크
6. **검증 상태** 업데이트
7. **커밋 이력**에 새 항목 추가
