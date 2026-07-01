# ADR-0011: TypeScript strict 모드 도입 (ADR-0001 일부 대체)

- **Status**: Accepted
- **Date**: 2026-06-29
- **Amends**: [ADR-0001](./0001-tech-stack.md) — 타입스크립트 도입하지 않음 결정을 번복

## Context

[ADR-0001](./0001-tech-stack.md)에서 프로토타입 단계를 이유로 TypeScript 도입을 보류하고 JavaScript(`.jsx`)로 시작했다. 이후 다음 변화가 있었다:

- 화면과 공유 상태(`store.tsx`)의 인터페이스가 복잡해지면서 런타임 에러가 잡기 어려워졌다.
- `StoreContextValue`, `RewardLogEntry`, `AddCustomerResult` 등 타입을 문서화할 필요가 생겼다.
- MVP 전환 시점이 되어 "프로토타입이라 타입 생략" 근거가 약해졌다.

대안:

- **JSDoc 타입 주석**: 파일 확장자를 유지하면서 IDE 지원을 얻을 수 있지만, 엄격한 컴파일러 검사가 없다.
- **TypeScript (loose)**: `strict: false`로 점진적 도입. 마이그레이션 비용이 낮지만 장기적으로 `any` 남용 위험.
- **TypeScript (strict)**: 처음부터 `strict: true` + `noUncheckedIndexedAccess`로 최고 수준 검사. 코드베이스가 아직 작아 일괄 전환 비용이 낮다.

## Decision

- 전체 파일을 `.jsx` → `.tsx`, `.js` → `.ts`로 일괄 전환한다.
- `tsconfig.app.json`에 `strict: true`, `noUncheckedIndexedAccess: true` 적용.
- `npm run typecheck` (`tsc -b`) 를 태스크 완료 기준에 추가한다.
- 린터는 기존 oxlint를 유지한다 (TypeScript 지원 가능).

## 주요 변경 파일

| 이전 | 이후 |
|------|------|
| `src/App.jsx` | `src/App.tsx` |
| `src/main.jsx` | `src/main.tsx` |
| `src/store.jsx` | `src/store.tsx` |
| `src/lib/data.js` | `src/lib/data.ts` |
| `src/lib/format.js` | `src/lib/format.ts` |
| `src/screens/*.jsx` | `src/screens/*.tsx` |
| `src/ui/*.jsx` | `src/ui/*.tsx` |
| `vite.config.js` | `vite.config.ts` |

추가 파일: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`

## Consequences

좋은 점:

- 런타임 전에 타입 오류 발견 (특히 `store.tsx` 인터페이스 변경 시)
- IDE 자동완성·리팩토링 정확도 향상
- `noUncheckedIndexedAccess`로 배열 인덱스 접근 안전성 보장

나쁜 점 / 따라오는 후속 결정:

- `npm run typecheck`가 태스크 완료 기준에 추가되어 CI 시 한 단계 늘어남
- `noUncheckedIndexedAccess`는 배열 접근마다 `undefined` 체크를 강제하므로, 패턴에 익숙해질 때까지 약간의 추가 코드가 필요
