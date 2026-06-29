# Web-Only Stage 2 Production Design

**Date:** 2026-06-29

**Status:** Approved for implementation planning

## Goal

현재 React 고객 웹과 사장님 웹을 유지하면서 메모리 기반 프로토타입을 안전한
실서비스로 전환한다. 이번 단계는 데이터 영속화, 사장님 인증·인가, 포인트 거래
무결성, 최소 고객 잔액 조회에만 집중한다.

Flutter 앱, 주문, 결제, Web Push, FCM, 카카오 알림톡은 구현하지 않는다.

## 결정 요약

```text
고객
└── React 웹 /
    └── 전체 전화번호 + Turnstile → 최소 잔액 조회

사장님
└── React 웹 /admin
    └── 이메일·비밀번호 + 필수 TOTP MFA

공통 백엔드
└── Supabase
    ├── Auth
    ├── PostgreSQL + RLS
    ├── Edge Functions
    └── owner 전용 private Realtime
```

## 현재 범위

### 포함

- 기존 React 고객·사장님 UI 유지
- Supabase versioned migration과 로컬 개발 환경
- 고객, 매장 설정, 포인트 원장 영속화
- 사장님 이메일·비밀번호 로그인과 필수 TOTP MFA
- owner 역할과 JWT `aal2`를 함께 확인하는 RLS
- 원자적 포인트 적립·사용
- Turnstile과 다중 rate limit이 적용된 최소 잔액 조회
- owner 화면의 비동기 loading/error/retry와 private Realtime
- Vercel preview/production 배포와 보안 검증

### 제외

- Flutter, iOS, Android 앱
- 주문, 픽업, 결제, 메뉴·재고 관리
- Web Push, FCM, SMS, 카카오 알림톡
- 고객 Phone OTP와 고객 로그인
- 고객 상세 거래 내역
- 고객 private Realtime
- QR/일회용 고객 코드

제외 항목을 위한 테이블, secret, SDK, 추상화 계층도 미리 만들지 않는다.
`reward_log`가 향후 알림이나 주문 연계가 참조할 수 있는 확정 원장 역할을 한다.

## 고객 웹

### 조회 흐름

```text
전화번호 입력
→ 국내 번호를 E.164로 정규화
→ Turnstile token 발급
→ lookup-balance Edge Function
→ 서버에서 Turnstile Siteverify 검증
→ IP·전화번호 digest·전체 트래픽 rate limit
→ secret-scoped DB 조회
→ 최소 DTO 반환
```

Turnstile 검증은 반드시 서버에서 수행한다. client widget 성공 여부만 신뢰하지
않고, `hostname`과 `action`을 production 설정과 비교하며 검증 장애 시 조회를
허용하지 않는다.

### 허용 응답

- 현재 포인트
- 다음 실제 혜택 기준과 남은 포인트
- 매장 표시 이름
- 데이터 기준 시각

### 금지 응답

- 고객 이름
- 전체 또는 마스킹 전화번호
- 방문 횟수
- 상세 적립·사용 내역
- customer ID
- 내부 auth/role 정보

등록되지 않은 전화번호와 포인트가 0인 고객은 모두 `아직 확인할 포인트가
없어요` 상태로 표시한다. API의 상태 코드, 응답 크기, 오류 문구로 고객 등록
여부를 추가 노출하지 않는다.

### 보안 경계

- `customers`와 `reward_log`에는 `anon` SELECT policy를 만들지 않는다.
- `lookup-balance`만 서버 secret으로 최소 필드를 읽는다.
- rate limit key에는 전화번호 원문 대신 서버 secret 기반 HMAC digest를 사용한다.
- rate limit 저장소는 Supabase 공식 예제와 같은 Upstash Redis REST를 사용한다.
- application log, analytics, error report에 전체 전화번호와 잔액을 기록하지 않는다.
- CORS는 production/preview의 명시된 origin만 허용한다.
- 비정상 조회량, Turnstile 실패율, 전화번호별 반복 조회를 모니터링한다.
- 공격이 감지되면 전화번호·IP 제한을 강화하거나 공개 조회를 일시 중단할 수 있다.

이 흐름은 전화번호를 아는 제3자가 해당 번호에 0보다 큰 포인트가 있는지 알 수
있는 잔여 위험을 가진다. 조회 마찰을 낮추기 위해 이 위험을 명시적으로
수용한다. 이름·상세 내역·포인트 사용 권한은 노출하지 않는다.

## 사장님 웹

### 인증

- Supabase Auth 이메일·비밀번호
- 공개 owner 회원가입 비활성화
- 운영자가 owner 계정을 생성하고 `app_user_roles`에 역할 부여
- 최소 12자 강한 비밀번호와 유출 비밀번호 차단
- 필수 TOTP 등록, challenge, verify
- `/admin` 진입과 모든 owner API/RLS에 `role = owner`와 `aal = aal2` 요구
- 세션 최대 수명, 비활성 timeout, 단일 세션 정책 적용

프론트엔드 route guard는 편의 기능이며 보안 경계가 아니다. Edge Function과
PostgreSQL RLS/RPC가 같은 권한 조건을 다시 검증한다.

### 기능

- 고객 생성과 검색
- 전화번호 뒷자리 검색 후 중복 고객 선택
- 포인트 적립·사용
- 대시보드와 매장 설정 조회·수정
- 원장 조회

owner는 단일 매장의 모든 고객을 관리할 수 있으므로 선택한 `customer_id`를
요청에 포함할 수 있다. 서버는 client가 보낸 포인트 계산값, 적립률, 최종 잔액을
신뢰하지 않는다.

## 데이터와 거래 무결성

핵심 테이블:

- `app_user_roles`
- `store_config`
- `customers`
- `reward_log`

`apply_reward_transaction(customer_id, type, amount, idempotency_key)`는 하나의
PostgreSQL transaction에서 다음을 수행한다.

1. owner 역할과 `aal2` 확인
2. 같은 idempotency key의 기존 결과와 요청 지문 확인
3. 고객 행 `FOR UPDATE`
4. DB 적립률로 포인트 계산
5. 양수 금액, 사용 단위, 잔액 부족 검증
6. 잔액·방문수·최근 방문일 갱신
7. `reward_log` 삽입
8. 확정된 변동 포인트와 최종 잔액 반환

같은 idempotency key와 같은 요청의 재시도는 기존 결과를 반환한다. 같은 key에
다른 요청이 오면 conflict로 거부한다.

## Realtime

- owner 화면만 private Broadcast를 사용한다.
- owner 역할과 `aal2`를 만족한 세션만 owner topic을 구독한다.
- event는 변경 사실과 최소 식별자만 전달한다.
- event 수신 뒤 RLS가 적용된 authoritative query로 다시 읽는다.
- 연결 실패, tab resume, network reconnect 때 전체 상태를 refetch한다.
- 비인증 고객 조회에는 Realtime을 제공하지 않는다.

## 오류 처리

- 고객 조회: 검증 실패와 내부 오류를 사용자에게는 일반화하고 재시도 경로 제공
- Turnstile 장애: fail closed, 잠시 후 다시 시도하도록 안내
- rate limit: `429`와 과도한 세부정보 없는 대기 안내
- owner 인증: 비밀번호 오류, MFA 필요, 세션 만료 상태를 구분
- 거래 API: validation, insufficient balance, conflict, transient error를 안정된 오류 코드로 구분
- 재시도 가능한 쓰기 요청은 같은 idempotency key를 유지
- Realtime 장애는 거래 성공 여부에 영향을 주지 않음

## 배포와 secret

- React/Vite는 Vercel에 배포한다.
- Supabase dev/staging/production을 분리한다.
- 브라우저에는 Supabase URL, publishable key, Turnstile site key만 노출한다.
- Supabase secret key, Turnstile secret, Upstash Redis REST token은 Edge Function
  secret으로만 보관한다.
- preview와 production은 서로 다른 DB, Turnstile hostname, secret을 사용한다.
- CSP와 CORS는 Vercel, Supabase, Turnstile에 필요한 origin만 허용한다.

## 검증

### Database

- schema constraint
- 모든 노출 테이블 RLS 활성화
- anon table 직접 조회 거부
- owner `aal1` 거부, owner `aal2` 허용
- 비-owner `aal2` 거부
- 적립·사용·잔액 부족·사용 단위
- idempotency와 동시성

### Edge Functions

- Turnstile 누락·위조·만료·재사용 거부
- 허용되지 않은 hostname/action 거부
- IP·전화번호 digest·전체 rate limit
- 고객 존재 여부 응답 규칙
- CORS allowlist
- secret 누락 시 fail closed
- log에 전화번호·잔액 미포함

### React/E2E

- 고객 전화번호 입력, loading, 성공, 0포인트, 오류, 재시도
- 고객 응답에 상세 내역과 이름이 없음
- owner 로그인, MFA 등록·challenge·세션 만료
- 적립·사용 영속화와 중복 제출 방지
- Realtime 실패 뒤 refetch
- 새로고침·다른 브라우저에서 DB 상태 일치

## 보류 기능의 재검토 조건

다음 조건이 생기기 전에는 Flutter와 Push 결정을 다시 열지 않는다.

- 픽업 주문이 실제 출시 범위로 승인됨
- 반복 사용 빈도와 설치 가치가 확인됨
- owner 주문 접수·조리 운영 의사가 확인됨
- 결제·취소·환불 운영 범위가 정의됨

고객 알림이 다시 필요해지면 Web Push, 알림톡, 네이티브 Push를 당시 사용 빈도,
도달 요구, 비용, 플랫폼 제약으로 새 ADR에서 비교한다.

## 공식 근거

- [Supabase Securing your data](https://supabase.com/docs/guides/database/secure-data)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Multi-Factor Authentication](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase Edge Function Authentication](https://supabase.com/docs/guides/functions/auth)
- [Supabase Rate Limiting Edge Functions](https://supabase.com/docs/guides/functions/examples/rate-limiting)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development/overview)
- [Supabase Database Testing](https://supabase.com/docs/guides/local-development/testing/overview)
- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Vercel Vite deployment](https://vercel.com/docs/frameworks/frontend/vite)
