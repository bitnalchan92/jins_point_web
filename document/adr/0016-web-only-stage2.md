# ADR-0016: Stage 2 고객 클라이언트 — React 웹 유지

- **Status**: Accepted
- **Date**: 2026-06-29
- **Defers**: [ADR-0013](./0013-web-push.md), [ADR-0015](./0015-flutter-customer-app.md)
- **Related**: [ADR-0012](./0012-supabase-backend.md), [ADR-0014](./0014-production-auth-and-authorization.md)

## Context

포인트 조회와 적립 알림만으로는 고객이 네이티브 앱을 반복해서 열 이유가
충분하지 않다. 주문·픽업은 설치 가치를 만들 수 있지만 현재 매장 운영 범위나
출시 요구로 확정되지 않았다.

Flutter 앱을 먼저 출시하면 앱·스토어·Push 운영 비용이 발생하지만 고객이 얻는
반복 가치는 제한적이다. Web Push와 알림톡도 현재 필수 기능이 아니므로 발송
인프라를 먼저 만들 이유가 없다.

## Decision

- 고객과 사장님 클라이언트 모두 기존 React 웹을 유지한다.
- 고객은 `/`, 사장님은 `/admin`을 사용한다.
- Stage 2는 Supabase 영속화, RLS, owner MFA, 원자적 포인트 처리에 집중한다.
- 고객 웹은 전체 전화번호, Turnstile Siteverify, 다중 rate limit으로 최소 잔액만 조회한다.
- 고객 이름, 방문 횟수, 상세 거래 내역, customer ID는 반환하지 않는다.
- 고객 로그인, Phone OTP, customer Realtime은 현재 범위에서 제외한다.
- Flutter, 주문, 결제, Web Push, FCM, SMS, 알림톡을 보류한다.
- 보류 기능을 위한 테이블, SDK, secret, 추상화 계층을 미리 만들지 않는다.
- owner 웹은 이메일·비밀번호와 필수 TOTP MFA를 사용하고 모든 관리 작업에 owner 역할과 `aal2`를 요구한다.
- 포인트 적립·사용은 DB에서 권한·금액·적립률·잔액·idempotency를 검증하는 원자적 transaction으로 처리한다.

상세 설계는
[Web-Only Stage 2 Production Design](../../docs/superpowers/specs/2026-06-29-web-production-baseline-design.md)을 따른다.

## Security

- 고객·포인트 원장 테이블에 `anon` policy를 만들지 않는다.
- 최소 잔액 조회만 secret-scoped Edge Function이 수행한다.
- Turnstile token은 서버 Siteverify로 검증하고 hostname/action을 확인한다.
- IP, 전화번호 HMAC digest, 전체 트래픽을 각각 rate limit한다.
- 전체 전화번호와 잔액을 log·analytics에 기록하지 않는다.
- 전화번호를 아는 제3자가 0보다 큰 잔액 존재를 추론할 수 있는 위험은 명시적으로 수용한다.
- owner route guard만 신뢰하지 않고 Edge Function, RLS, PostgreSQL 함수가 권한을 재검증한다.

## Consequences

좋은 점:

- 기존 고객·사장님 React UI를 재사용한다.
- 앱 설치와 스토어 심사 없이 실제 포인트 운영을 검증할 수 있다.
- Push와 주문의 불확실한 운영 비용을 만들지 않는다.
- 영속화와 거래 무결성처럼 향후 어떤 클라이언트에서도 필요한 기반에 집중한다.

비용과 제약:

- 고객에게 적립·사용 알림을 보내지 않는다.
- 비인증 고객에게 상세 내역과 실시간 갱신을 제공하지 않는다.
- Turnstile과 rate limit이 abuse를 줄이지만 전화번호를 아는 사람의 단건 조회를 완전히 막지는 못한다.
- 주문이 확정되면 고객 경험과 클라이언트 플랫폼을 다시 설계해야 한다.

## 재검토 조건

- 픽업 주문이 실제 출시 범위로 승인됨
- 반복 사용 빈도와 설치 가치가 확인됨
- owner가 주문 접수·조리 상태를 운영하기로 결정함
- 고객 알림에 명확한 도달 요구가 생김

## 공식 근거

- [Supabase Securing your data](https://supabase.com/docs/guides/database/secure-data)
- [Supabase Multi-Factor Authentication](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
