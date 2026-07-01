# jins_point_web

> 동네 단골을 위한, 전화번호만으로 쌓이는 포인트 — **달콤한 진스쿡**

김밥·샌드위치 전문점 "달콤한 진스쿡"의 포인트 적립 웹입니다. 손님은 별도 회원가입 없이 전화번호만으로 잔액을 조회하고, 사장님은 카운터에서 한 손으로 빠르게 적립을 처리합니다.

**프로덕션**: `https://dalcomjins.com` (사장님: `/admin`)

## 현재 단계 — Stage 2 프로덕션 운영 중

Stage 1(UI 목업)에서 **Stage 2(실서비스 기반)**로 전환하여 운영 중입니다. 데이터는 Supabase PostgreSQL에 영속되고, 사장님은 TOTP MFA로 인증하며, 포인트 거래는 DB 원자 함수가 검증합니다.

**사장님 흐름** (`/admin`)

- ✅ **로그인** — Supabase Auth 이메일·비밀번호 + **필수 TOTP MFA**(`aal2`) ([ADR-0014](./document/adr/0014-production-auth-and-authorization.md))
- ✅ **적립/사용** — 뒷번호 4자리 조회 → 금액 → 적립/사용. 포인트·적립률·잔액·idempotency를 **DB 원자 함수가 검증**
- ✅ **손님 관리** — 검색·카드 그리드·신규 등록
- ✅ **대시보드** — DB KPI + 적립률 인라인 편집 + 로그아웃
- ✅ 한 기기에서 적립하면 다른 사장님 기기에 **private Realtime**으로 즉시 반영

**손님 흐름** (`/`)

- ✅ **랜딩** — 전화번호 입력 + Cloudflare Turnstile 봇 차단
- ✅ **잔액 조회** — 마스킹 이름 인사말, 사용 가능 포인트, 최근 적립 이력 10건, 소셜 링크(인스타그램·네이버 플레이스). `lookup-balance` Edge Function이 **최소 DTO만** 반환 — 이름·전화번호·고객 ID는 반환하지 않음. IP·전화번호·전체 트래픽 다중 rate limit

> 데이터는 Supabase에 영속됩니다 (새로고침해도 유지). 사장님/손님은 **URL로 구분** — `/` 손님, `/admin` 사장님 ([ADR-0010](./document/adr/0010-react-router.md)).
> Flutter·주문·결제·Web Push·알림톡은 보류합니다 ([ADR-0016](./document/adr/0016-web-only-stage2.md)).

## 기술 스택

- **프론트**: Vite 8 + React 19 + React Router 7 + Tailwind CSS v4, **TypeScript** (`strict: true`)
- **백엔드**: Supabase — PostgreSQL · Auth(+MFA) · RLS · Edge Functions(Deno) · private Realtime ([ADR-0012](./document/adr/0012-supabase-backend.md))
- **봇 방어**: Cloudflare Turnstile + Upstash Redis rate limit
- **테스트**: pgTAP(DB) · Deno test(Edge) · vitest + Testing Library(프론트) · Playwright E2E(chromium · mobile)
- **배포/CI**: Vercel + GitHub Actions — push/PR마다 전 계층 테스트 + E2E 13개 자동 실행 (mobile API 3개 skip)
- 외부 폰트: Pretendard (CDN)

자세한 결정 배경은 [ADR](./document/adr) 참고.

## 시작하기

```bash
npm install
npm run dev
```

기본 주소: http://localhost:5173/

> 로컬 dev 서버는 UI 개발 전용입니다. API 호출(포인트 조회·적립)은 Supabase 로컬 스택이 필요합니다: `npx supabase start` → `npx supabase db reset`.

### 주요 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | dev 서버 실행 (HMR) |
| `npm run build` | 프로덕션 빌드 |
| `npm run preview` | 빌드 결과 로컬 프리뷰 |
| `npm run lint` | oxlint |
| `npm run typecheck` | strict TypeScript 타입 검사 |
| `npm run test` | 프론트 단위 테스트 (vitest) |
| `npm run test:db` | DB·RLS 테스트 (pgTAP, 로컬 Supabase 필요) |
| `npm run test:edge` | Edge Function 테스트 (Deno) |
| `npm run test:e2e` | E2E (Playwright, `E2E_BASE_URL` 대상 — 로컬 실행 불가) |

## 디자인 톤

크림 베이스 + 옐로우 브랜드 + 잉크 텍스트의 **밝고 따뜻한 동네 가게 감성**. (디자인 레퍼런스: [`document/prototype.html`](./document/prototype.html))

| 역할 | 컬러 |
|------|------|
| 베이스 | `#fcf7ec` (cream) |
| 메인 텍스트 | `#241b12` (ink) |
| 보조 텍스트 | `#9a8975` (ink-soft) |
| 브랜드 / 강조 | `#ffc81f` · `#f0a91a` (brand / brand-dark) |
| 성공 / 신규 | `#5e9c53` (leaf) |

토큰은 [`src/index.css`](./src/index.css)의 `@theme` 블록에 모여 있습니다.

## 디렉토리 구조

```
.
├── document/
│   ├── adr/                    # Architecture Decision Records
│   ├── progress.md             # 진행 상황·인프라 현황·외부 서비스 설명
│   └── prototype.html          # 디자인 레퍼런스 (번들된 목업)
├── public/
├── src/
│   ├── App.tsx                 # 라우팅 루트 (/ 손님 / /admin 사장님)
│   ├── index.css               # 디자인 토큰 (@theme) + 모션
│   ├── main.tsx
│   ├── customer/               # 손님 전용 훅 (useBalanceLookup 등)
│   ├── owner/                  # 사장님 전용 훅 (useOwnerApi 등)
│   ├── lib/
│   │   ├── api.ts              # lookupBalance fetch 래퍼
│   │   ├── contracts.ts        # Zod 스키마 (BalanceResponse 등)
│   │   └── format.ts           # 전화번호/금액/숫자 포맷
│   ├── ui/
│   │   ├── Logo.tsx            # 🍙 브랜드 로고
│   │   ├── Keypad.tsx          # POS 숫자 키패드
│   │   └── Toast.tsx           # 적립 완료 토스트
│   └── screens/
│       ├── OwnerLoginScreen.tsx           # 사장님 — 로그인 (이메일 + TOTP MFA)
│       ├── OwnerRewardScreen.tsx          # 사장님 — 적립/사용 (POS)
│       ├── OwnerCustomerManageScreen.tsx  # 사장님 — 손님 관리
│       ├── OwnerCustomerSearchScreen.tsx  # 사장님 — 손님 조회 (뒷번호 4자리)
│       ├── OwnerDashboardScreen.tsx       # 사장님 — 대시보드
│       ├── CustomerLandingScreen.tsx      # 손님 — 랜딩 (전화번호 + Turnstile)
│       └── CustomerPointScreen.tsx        # 손님 — 포인트 조회 + 이력
├── supabase/
│   ├── functions/
│   │   ├── lookup-balance/     # 손님 잔액 조회 Edge Function
│   │   ├── owner-api/          # 사장님 API Edge Function
│   │   └── _shared/            # CORS, rate-limit, Turnstile, phone 유틸
│   └── migrations/             # DB 마이그레이션 (pgTAP 테스트 포함)
├── tests/                      # Playwright E2E 스펙
├── index.html
└── vite.config.ts
```

## 프로덕션 인프라

| 항목 | 값 |
|------|-----|
| **프론트엔드** | Vercel — `https://dalcomjins.com` |
| **DB / Auth** | Supabase 클라우드 |
| **Edge Functions** | `lookup-balance`, `owner-api` |
| **Rate limit** | Upstash Redis |
| **Captcha** | Cloudflare Turnstile |
| **CI** | GitHub Actions `verify.yml` — E2E 13개 통과 (mobile API 3개 skip), push마다 전부 통과 |

인프라 상세·외부 서비스 설명·시크릿 목록은 [진행 상황](./document/progress.md) 참고.

## 문서

- 📈 **[진행 상황](./document/progress.md)** — 완성도, 인프라 현황, Turnstile·Upstash 설명, 외부 서비스 시크릿 목록
- 🧪 **[수동 테스트 가이드](./document/manual-test-guide.md)** — 화면별 체크리스트
- 🗺️ **[Stage 2 구현 계획](./document/plan-stage2.md)**
- [ADR 인덱스](./document/adr/README.md)
- [ADR-0001 기술 스택](./document/adr/0001-tech-stack.md)
- [ADR-0002 손님 식별](./document/adr/0002-phone-based-identification.md)
- [ADR-0003 매장 스코프](./document/adr/0003-single-store-scope.md)
- [ADR-0004 적립 정책](./document/adr/0004-percent-reward-policy.md)
- [ADR-0008 디자인 톤 (달콤한 진스쿡)](./document/adr/0008-design-tone-jinscook.md)
- [ADR-0010 React Router 도입](./document/adr/0010-react-router.md)
- [ADR-0011 TypeScript strict 도입](./document/adr/0011-typescript-strict.md)
- [ADR-0012 Supabase 백엔드 도입](./document/adr/0012-supabase-backend.md)
- [ADR-0014 프로덕션 인증·인가](./document/adr/0014-production-auth-and-authorization.md)
- [ADR-0016 React 웹 유지 (Stage 2)](./document/adr/0016-web-only-stage2.md)
