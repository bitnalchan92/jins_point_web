# ADR-0014: 프로덕션 인증·인가 — Supabase Auth + owner MFA

- **Status**: Accepted
- **Date**: 2026-06-29
- **Supersedes**: [ADR-0002](./0002-phone-based-identification.md)의 무인증 상세 조회, [ADR-0007](./0007-owner-authentication.md)의 4자리 PIN
- **Related**: [ADR-0012](./0012-supabase-backend.md)

> 현재 범위에는 고객 로그인·Phone OTP·상세 내역·알림이 포함되지 않는다.
> 고객 웹은 Turnstile과 rate limit을 통과한 최소 잔액 조회만 제공한다.

## Context

Stage 1의 4자리 PIN과 전화번호만으로 제공하는 상세 조회는 UI 검증용이었다. 실서비스에서는 다음 문제가 있다.

- 4자리 PIN은 가능한 조합이 10,000개뿐이고 계정별 권한·MFA·원격 세션 종료를 제공하지 않는다.
- 전화번호를 아는 제3자가 고객의 상세 내역을 조회해서는 안 된다.
- 클라이언트의 쿼리 필터는 권한 경계가 아니다. RLS가 호출자의 검증된 신원과 행 소유권을 비교할 수 있어야 한다.
- 자체 JWT 발급과 PIN 검증 서버는 공식 Auth 흐름보다 구현·키 관리·세션 폐기 위험이 크다.

보안과 공식 가이드 준수를 구현 편의보다 우선한다.

## Decision

### 사장님 인증

- Supabase Auth의 이메일·비밀번호 로그인을 사용한다.
- TOTP factor 등록을 필수로 하고 `aal2` 세션에서만 `/admin`과 관리자 작업을 허용한다.
- owner 계정은 운영자가 생성한다. 앱에는 공개 owner 회원가입 기능을 두지 않는다.
- Email provider의 공개 신규 sign-up은 비활성화한다.
- `app_user_roles(user_id, role)`에서 owner 역할을 관리한다.
- RLS는 `auth.uid()`, owner 역할, JWT의 `aal = 'aal2'`를 모두 확인한다.
- 비밀번호 최소 12자, 대·소문자·숫자·기호 요구, 유출 비밀번호 차단을 사용한다.
- 프로덕션에서는 최대 세션 수명, 비활성 타임아웃, 단일 세션 정책을 활성화한다.

### 손님 조회

- 고객 로그인은 제공하지 않는다.
- 최소 잔액 조회는 Turnstile Siteverify와 다중 rate limit이 적용된 Edge Function으로 제공한다.
- 고객 테이블과 포인트 원장에 `anon` policy를 만들지 않는다.
- 응답은 잔액, 다음 혜택 조건, 매장 표시 정보, 기준 시각만 포함한다.
- 이름, 방문 횟수, 상세 내역, customer ID는 반환하지 않는다.
- 향후 상세 내역이나 알림을 추가할 때는 전화번호 소유 확인과 본인 RLS를 새 ADR에서 설계한다.

### 권한 데이터

- 권한은 사용자가 수정할 수 있는 `user_metadata`에 저장하지 않는다.
- 브라우저에는 publishable key만 제공한다.
- secret/service-role key는 Supabase Edge Function 안에서만 사용한다.
- RLS는 최초 schema migration에서 활성화하고 pgTAP으로 deny/allow 동작을 검증한다.

## Consequences

좋은 점:

- Supabase가 관리하는 비밀번호 hashing, 세션, refresh token, MFA를 사용한다.
- owner 권한을 DB에서 강제할 수 있다.
- 고객 데이터 테이블을 브라우저에 직접 공개하지 않는다.
- owner 기기 분실 시 계정 세션 종료와 비밀번호 변경으로 접근을 회수할 수 있다.

비용과 제약:

- 사장님 로그인에 비밀번호와 TOTP 입력 단계가 추가된다.
- 비인증 잔액 조회에는 고객 등록 여부가 일부 추론될 수 있는 잔여 위험이 있다.
- 유출 비밀번호 차단과 일부 세션 제어 기능은 Supabase 유료 플랜이 필요할 수 있으므로 프로덕션 비용에 포함한다.
- 직원이 늘어나면 공유 계정을 사용하지 않고 각 직원 계정과 역할을 추가해야 한다.

## 공식 근거

- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Password Security](https://supabase.com/docs/guides/auth/password-security)
- [Multi-Factor Authentication](https://supabase.com/docs/guides/auth/auth-mfa)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [User Sessions](https://supabase.com/docs/guides/auth/sessions)
- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
