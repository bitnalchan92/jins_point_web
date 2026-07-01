# ADR-0001: 기술 스택 — Vite + React + Tailwind v4

- **Status**: Accepted (amended)
- **Date**: 2026-06-27
- **Amended**: 2026-06-29 — TypeScript strict와 Supabase 보안 아키텍처 도입으로 일부 결정 변경 ([ADR-0011](./0011-typescript-strict.md), [ADR-0012](./0012-supabase-backend.md), [ADR-0014](./0014-production-auth-and-authorization.md) 참고)

## Context

프로토타입 단계의 음식점 포인트 적립 웹 페이지를 만든다. 현 단계의 목표는 **UI 목업**으로, 손님/사장님 화면의 톤과 흐름을 빠르게 확인하는 것이다.

요구사항:

- 빠른 시작과 빠른 HMR (디자인 톤을 반복적으로 다듬어야 함)
- 가벼운 SPA 구조 (서버 사이드 렌더링 불필요)
- 나중에 동작하는 MVP로 확장할 여지

대안:

- **Next.js**: 풀스택으로 확장하기는 좋지만, 현 단계에서는 라우터/서버 컴포넌트 등 무게가 과함
- **순수 HTML/CSS**: 가장 가볍지만 상태 관리와 컴포넌트 재사용이 불편
- **Vite + React**: SPA에 최적, 셋업이 매우 짧고 HMR이 빠름

스타일링은 디자인 토큰을 한 곳에 모으고 빠르게 변경하기 위해 Tailwind를 선택. v4는 `@theme` 블록으로 토큰을 CSS 안에서 직접 선언할 수 있어 별도 설정 파일이 필요 없다.

## Decision

- **빌드/번들러**: Vite 8
- **프레임워크**: React 19
- **스타일**: Tailwind CSS v4 (`@tailwindcss/vite` 플러그인)
- **타입스크립트**: ~~도입하지 않음~~ → `strict: true` + `noUncheckedIndexedAccess` 도입 ([ADR-0011](./0011-typescript-strict.md))
- **상태 관리**: React Context와 route별 provider/hook 사용 (별도 전역 상태 라이브러리 도입 X)
- **백엔드·인증**: Stage 2부터 Supabase PostgreSQL/Auth/RLS/Edge Functions/Realtime 사용

## Consequences

좋은 점:

- 한 줄짜리 dev 명령으로 즉시 작업 가능
- 디자인 토큰이 `src/index.css`의 `@theme` 블록에 모여 있어, 카페 톤을 한 곳에서 조정
- 나중에 MVP로 확장할 때 React 생태계 그대로 사용 가능 (TanStack Router, React Query 등)

나쁜 점 / 따라오는 후속 결정:

- Supabase Auth/RLS/Realtime에 대한 플랫폼 의존성이 생긴다.
- TypeScript 타입과 별개로 전화번호·금액·외부 payload의 런타임 검증이 필요하다.
- SPA에서는 인증 토큰을 다루므로 CSP, dependency 관리, XSS 방어가 중요하다.
