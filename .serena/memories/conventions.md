# Conventions

## 파일·컴포넌트 네이밍

- 화면 컴포넌트: `{Role}{Feature}Screen.tsx` (예: `OwnerRewardScreen.tsx`, `CustomerLandingScreen.tsx`)
- 공유 UI 컴포넌트: `src/ui/` 디렉토리 (예: `Keypad.tsx`, `Toast.tsx`)
- 유틸: `src/lib/` 디렉토리

## TypeScript

- `strict: true` + `noUncheckedIndexedAccess: true` 필수 준수
- 타입은 인터페이스(`Interface`) 선호 (예: `OwnerStoreValue`, `OwnerBootstrap`)
- 비동기/결과 상태는 discriminated union (예: `{ status: 'loading' | 'ready' | 'error' }`)
- 런타임 경계(API 응답)는 Zod 스키마로 검증 (`src/lib/contracts.ts`)

## 스타일 (Tailwind v4)

- 디자인 토큰 → `src/index.css` 내 `@theme` 블록에서 관리 (별도 `tailwind.config` 없음)
- 사장님 레이아웃: `max-w-[1180px]` POS 2단 분할
- 손님 레이아웃: `max-w-[430px]` phone frame

## 상태 패턴

- owner 상태: `useOwnerStore()` (`src/owner/OwnerStoreProvider.tsx`) — owner-api bootstrap 기반, 서버 권위
- owner 인증: `useOwnerAuth()` (`src/auth/OwnerAuthProvider.tsx`)
- 고객 잔액: `useBalanceLookup()` (`src/customer/`) — 무인증, 최소 DTO
- 화면 내 로컬 상태: `useState` 직접 사용
- 데모 전역 store(`store.tsx`)는 Stage 2에서 제거됨

## 상수

- 디자인/표시 상수만 `src/lib/data.ts` (예: `STORE_NAME`, `STORE_TAGLINE`)
- 운영 값(적립률·임계값·PIN)은 DB(`store_config`)·Auth로 이동. `OWNER_PIN` 제거됨

## 주석

- 주석 없음이 기본 — 자명하지 않은 제약/불변식에만 한 줄 추가
