# Architecture Decision Records

프로젝트의 주요 의사결정을 기록합니다. 작은 결정은 코드/PR에서 다루고, 여기서는 **나중에 누군가가 "왜 이렇게 했지?"라고 물을 만한 것**만 기록합니다.

## 인덱스

| 번호 | 제목 | 상태 |
|------|------|------|
| [0001](./0001-tech-stack.md) | 기술 스택: Vite + React + Tailwind v4 | Accepted |
| [0002](./0002-phone-based-identification.md) | 손님 식별 방식: 전화번호 only | Superseded by 0014 |
| [0003](./0003-single-store-scope.md) | 매장 스코프: 단일 매장 | Accepted |
| [0004](./0004-percent-reward-policy.md) | 적립 정책: 결제금액의 % | Accepted |
| [0005](./0005-design-tone.md) | 디자인 톤: 따뜻한 카페 감성 | Superseded by 0008 |
| [0006](./0006-demo-mode-switcher.md) | 화면 전환: 데모용 모드 스위처 (라우터 미도입) | Superseded by 0010 |
| [0007](./0007-owner-authentication.md) | 사장님 인증: 4자리 PIN + 디바이스 신뢰 모델 | Superseded by 0014 |
| [0008](./0008-design-tone-jinscook.md) | 디자인 톤 재정의: 달콤한 진스쿡 (크림 + 옐로우) | Accepted |
| [0009](./0009-four-digit-customer-lookup.md) | 손님 조회: 휴대폰 뒷자리 4자리 (캐셔 UX) | Accepted |
| [0010](./0010-react-router.md) | 화면 전환: React Router 도입 (`/` 손님 / `/admin` 사장님) | Accepted |
| [0011](./0011-typescript-strict.md) | TypeScript strict 도입 (ADR-0001 일부 대체) | Accepted |
| [0012](./0012-supabase-backend.md) | 백엔드: Supabase 도입 (DB · Edge Functions · Realtime) | Accepted |
| [0013](./0013-web-push.md) | Web Push 알림 전략 (VAPID · Service Worker) | Deferred |
| [0014](./0014-production-auth-and-authorization.md) | 프로덕션 인증·인가: Supabase Auth + owner MFA | Accepted |
| [0015](./0015-flutter-customer-app.md) | 고객 클라이언트: Flutter iOS/Android 앱 | Deferred |
| [0016](./0016-web-only-stage2.md) | Stage 2 고객 클라이언트: React 웹 유지 | Accepted |

## 포맷

각 ADR은 아래 항목으로 구성됩니다.

- **Status** — Proposed / Accepted / Superseded / Deprecated
- **Context** — 이 결정을 내린 배경, 제약, 대안
- **Decision** — 무엇을 선택했는지
- **Consequences** — 이 결정이 가져오는 좋은 점, 나쁜 점, 따라오는 후속 결정

번호는 순차적으로 부여하고, 한 번 부여된 번호는 재사용하지 않습니다. 결정이 뒤집히면 새 ADR을 만들고 이전 ADR의 상태를 `Superseded by NNNN`으로 변경합니다.
