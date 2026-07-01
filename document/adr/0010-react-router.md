# ADR-0010: 화면 전환 — React Router 도입 (ADR-0006 대체)

- **Status**: Accepted
- **Date**: 2026-06-29

> Stage 1과 프로덕션 고객·사장님 웹 모두 이 라우팅 결정을 유지한다.
- **Supersedes**: [ADR-0006](./0006-demo-mode-switcher.md)

## Context

[ADR-0006](./0006-demo-mode-switcher.md)에서 React Router 도입을 미루고 데모 모드 토글로 화면을 전환했다. 이후 화면이 6개(사장님 4 + 손님 2)로 늘었고, 다음 한계가 드러났다:

- 데모 토글 URL이 고정(`/`)이라 사장님/손님 화면을 직접 링크할 수 없다.
- 중첩 화면(로그인 → 탭 전환)을 `useState` 하나로 관리하면서 상태가 복잡해졌다.
- ADR-0007에서 정의한 사장님 PIN 인증 가드를 URL 기반으로 구현하기 어렵다.

대안:

- **HashRouter**: 서버 설정 없이 SPA에서 동작하지만, Vite dev/preview는 모두 히스토리 API를 지원하므로 굳이 선택할 이유가 없다.
- **TanStack Router**: 타입 안전한 라우팅을 제공하지만, 현 단계의 단순한 2경로에 비해 무겁다.
- **React Router v7**: SPA 모드로 경량 사용 가능하고, 향후 SSR/풀스택 전환 시에도 동일 라이브러리를 유지할 수 있다.

## Decision

- **React Router DOM v7**을 도입한다.
- URL 설계:
  - `/` → 손님 흐름 (`CustomerPage` — phone frame, max-w-430px)
  - `/admin` → 사장님 흐름 (`OwnerApp` — POS 레이아웃, max-w-1180px)
- 데모 모드 토글(`App.tsx`의 `useState`)은 제거한다.
- 사장님 로그인 상태는 `OwnerApp` 내부 `useState`로 관리한다 (URL 가드 방식은 추후 결정).
- `vite.config.ts`에서 별도 설정 없이 기본 히스토리 모드를 사용한다.

## Consequences

좋은 점:

- 손님/사장님 화면을 URL로 직접 진입 가능
- `App.tsx`의 모드 관리 복잡도가 사라짐
- 나중에 라우트 가드, 리디렉션 등 표준 패턴을 쉽게 추가 가능

나쁜 점 / 따라오는 후속 결정:

- 사장님 PIN 인증 가드를 URL 기반으로 강화하려면 별도 ADR 필요
- 프로덕션 배포 시 서버/CDN에서 SPA fallback 설정 필요 (현재 dev/preview만 사용)
