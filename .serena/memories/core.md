# Core — jins_point_web

**진스쿡(달콤한 진스쿡)** 음식점 포인트 적립 SPA. **Stage 2 구현 완료** (Supabase 영속화·RLS·owner MFA·원자적 포인트·Turnstile 조회·owner Realtime). 로컬 검증 통과, 프로덕션 배포 대기.

## 소스 맵

```
src/
  App.tsx                         # 라우팅 루트 (/ CustomerPage, /admin AdminPage→OwnerAuth gate→OwnerApp)
  main.tsx                        # React 진입점 (전역 Provider 없음)
  lib/
    supabase.ts                   # 인증 브라우저 클라이언트
    env.ts                        # VITE_* 환경변수 검증
    contracts.ts                  # Zod 스키마 (BalanceResponse, OwnerBootstrap, RewardResult)
    api.ts / phone.ts / format.ts # fetch 래퍼 / 전화번호 표시 / 포맷
    data.ts                       # 디자인 상수 (STORE_NAME 등 — OWNER_PIN 제거됨)
  auth/                           # owner 인증 (Supabase Auth + 필수 TOTP MFA)
    OwnerAuthProvider.tsx         # signed_out→needs_enrollment→needs_challenge→ready(aal2)
    OwnerLoginForm.tsx / OwnerMfaForm.tsx
  customer/
    useBalanceLookup.ts           # 최소 잔액 조회 hook
    TurnstileWidget.tsx           # Cloudflare Turnstile
  owner/
    OwnerStoreProvider.tsx        # owner-api 기반 비동기 상태 (demo store.tsx 대체)
    ownerApi.ts                   # owner-api fetch + OwnerApiError
    useOwnerRealtime.ts           # private Realtime invalidation (owner 전용)
  screens/                        # Owner{Reward,CustomerManage,Dashboard}Screen + Customer{Landing,Point}Screen + ownerShared.tsx
  ui/                             # Keypad, Logo, Toast
supabase/
  migrations/                     # core schema+RLS, reward_transaction, owner_realtime
  functions/                      # lookup-balance, owner-api, _shared/* (Deno Edge Functions)
  tests/database/                 # pgTAP (schema_rls, reward_transaction, owner_realtime)
  seed.sql / config.toml / deno.json
tests/e2e/                        # Playwright (staging 대상)
.github/workflows/verify.yml      # CI
document/adr/                     # ADR 0001~0016
```

## 라우팅

- `/`      → `CustomerPage` (손님, max-w-430px). 세션/인증 없음. `lookup-balance`로 최소 잔액만 조회.
- `/admin` → `AdminPage` → `OwnerAuthProvider` 게이트 → `aal2` 후 `OwnerStoreProvider` + `OwnerApp` (POS, max-w-1180px).

## 상태/데이터

- 데모 `store.tsx` 삭제됨. owner 상태는 `OwnerStoreProvider`가 `owner-api` bootstrap에서 받아옴 (서버 권위).
- 포인트 거래는 DB 함수 `apply_reward_transaction`이 권한·금액·적립률·잔액·idempotency 검증.
- owner 화면은 private Realtime broadcast로 invalidation → 재조회.

## 검증 (로컬, 모두 통과)

pgTAP 35 · Deno edge 42 · vitest 52 · lint · typecheck · build. 명령은 `mem:suggested_commands`.

## 기술 스택 → `mem:tech_stack`
## 개발 명령어 → `mem:suggested_commands`
## 코드 컨벤션 → `mem:conventions`
## 태스크 완료 기준 → `mem:task_completion`
