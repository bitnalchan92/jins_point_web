# Stage 2 Security-First Production Design

**Date:** 2026-06-29

**Status:** Superseded

> 현재 구현 기준은
> [Web-Only Stage 2 Production Design](./2026-06-29-web-production-baseline-design.md)이다.
> 이 문서의 모든 고객 조회 OTP와 Web Push 결정은 구현하지 않는다.

**Goal:** 메모리 기반 프로토타입을 인증·권한·데이터 무결성·실시간 알림이 보장되는 Supabase 기반 서비스로 전환한다.

## 우선순위

1. 보안과 개인정보 보호
2. Supabase·PostgreSQL·Vercel 공식 가이드 준수
3. 데이터 무결성과 장애 복구 가능성
4. 사용자 경험
5. 구현 단순성

구현이 단순하더라도 인증을 우회하거나 클라이언트를 신뢰하는 방식은 선택하지 않는다.

## 인증과 권한

### 사장님

- Supabase Auth 이메일·강한 비밀번호 인증을 사용한다.
- TOTP MFA 등록을 필수로 하고 관리자 화면과 모든 관리자 DB 작업은 JWT의 `aal = 'aal2'`일 때만 허용한다.
- 4자리 PIN, 공유 계정용 PIN, Edge Function이 자체 발급하는 JWT는 사용하지 않는다.
- 공개 회원가입은 제공하지 않는다. 최초 owner 계정은 운영자가 생성하고 `app_user_roles`에 `owner` 역할을 부여한다.
- 역할 확인은 `auth.uid()`와 DB의 역할 테이블을 사용한다. 사용자가 수정할 수 있는 `user_metadata`는 권한 판단에 사용하지 않는다.
- 프로덕션에서는 강한 비밀번호 정책, 유출 비밀번호 차단, 세션 최대 수명, 비활성 타임아웃, 단일 세션 정책을 적용한다.

### 손님

- 전화번호 입력만으로 데이터를 공개하지 않는다.
- Supabase Phone Auth의 SMS OTP로 전화번호 소유를 확인한다.
- `customers.auth_user_id`를 `auth.users.id`와 연결하고, 고객은 `auth.uid()`가 자신의 `auth_user_id`와 일치하는 행만 읽을 수 있다.
- 고객은 잔액·내역을 읽을 수 있지만 포인트, 방문수, 내역을 직접 수정할 수 없다.
- OTP 발송에는 Supabase Auth rate limit과 CAPTCHA를 적용한다.

## 데이터 접근

- RLS는 테이블 생성과 같은 migration에서 활성화한다. 배포 직전에 추가하지 않는다.
- `anon`에는 고객·적립내역·Push 구독의 SELECT/INSERT/UPDATE/DELETE 권한을 주지 않는다.
- owner 정책은 `owner` 역할과 `aal2`를 모두 요구한다.
- customer 정책은 `auth.uid()` 소유권을 요구한다.
- secret/service-role key는 Edge Function에서만 사용하며 브라우저 번들에 넣지 않는다.

## 포인트 트랜잭션

포인트 적립·사용은 하나의 PostgreSQL 함수에서 처리한다.

1. owner 역할과 `aal2`를 확인한다.
2. 고객 행을 `FOR UPDATE`로 잠근다.
3. DB의 `store_config.reward_rate`로 적립 포인트를 계산한다.
4. 양수 금액, 사용 단위, 잔액 부족을 서버에서 검증한다.
5. 고객 잔액·방문수·최근 방문일을 갱신한다.
6. `reward_log`를 삽입한다.
7. 최종 잔액을 반환한다.

`idempotency_key`의 unique constraint로 재시도에 의한 중복 적립을 막는다. 클라이언트가 계산한 적립 포인트나 최종 잔액은 신뢰하지 않는다.

## 프론트엔드 상태

- owner 데이터와 customer 데이터를 별도 provider/hook으로 분리한다.
- `OwnerStoreProvider`는 owner `aal2` 세션이 확인된 뒤에만 전체 고객·KPI를 가져온다.
- 고객 화면은 현재 로그인한 사용자의 고객 행과 내역만 가져온다.
- 기존 동기 Context 함수는 `Promise<Result>`로 바꾸고 loading, error, retry 상태를 명시한다.
- DB row 타입과 화면용 view model 변환을 분리한다.

## Realtime

- Supabase가 확장성과 보안 측면에서 권장하는 private Broadcast를 사용한다.
- DB trigger가 `realtime.broadcast_changes()`로 변경 이벤트를 발행한다.
- owner 채널은 owner 역할과 `aal2`만 구독할 수 있다.
- customer 채널은 현재 `auth.uid()`에 연결된 customer topic만 구독할 수 있다.
- payload에는 화면 갱신에 필요한 최소 식별자만 포함하고 전화번호 전체를 넣지 않는다.
- 이벤트 수신 후 서버 상태를 다시 조회한다. Realtime payload를 권위 있는 데이터로 간주하지 않는다.

## Web Push

- SMS OTP 인증이 완료되고 고객 레코드가 연결된 뒤에만 알림 권한을 요청한다.
- 구독은 `customer_id`에 연결하며 전화번호를 중복 저장하지 않는다.
- 실제 브라우저 구독 상태는 `pushManager.getSubscription()`으로 확인하고 endpoint를 upsert한다.
- 프론트엔드는 `send-push`를 직접 호출하지 않는다.
- `reward_log` INSERT 후 Database Webhook이 secret key로 `send-push` Edge Function을 호출한다.
- Edge Function은 webhook record를 기준으로 메시지를 구성하고 DB에서 최종 상태와 구독을 조회한다.
- 404/410 응답을 받은 만료 구독은 삭제한다. `push_deliveries`에 reward event와 subscription 조합을 기록해 동일 event 재처리의 중복 발송을 막는다.
- Service Worker는 `event.waitUntil()`, 안전한 payload parsing, `notificationclick`을 구현한다.
- iOS 설치를 위해 Web App Manifest와 192/512 아이콘을 제공한다.

## 스키마와 배포

- Supabase CLI의 versioned migration, `seed.sql`, generated database types를 사용한다.
- SQL Editor에서 수동으로 만든 상태를 운영 기준으로 삼지 않는다.
- 제약조건으로 음수 잔액, 잘못된 포인트 부호, 잘못된 전화번호, 중복 endpoint를 차단한다.
- 표현식 고유성은 table constraint가 아니라 unique expression index로 구현한다.
- secret은 Supabase Edge Function Secrets에 저장하고 `Deno.env.get()`으로 읽는다.
- 브라우저에는 Supabase publishable key와 VAPID public key만 제공한다.
- Vercel preview와 production 환경을 분리하고 production 배포 전에 DB/RLS/Edge/E2E 테스트를 통과시킨다.

## 검증

- pgTAP: 스키마, constraints, RLS, owner/customer 권한, 원자적 포인트 함수, idempotency.
- Edge Function test: 인증 누락, 잘못된 역할, webhook secret, CORS, 만료 구독 정리.
- React test: 인증 상태, MFA challenge, OTP, loading/error/retry, 중복 제출 방지.
- E2E: 고객 OTP 조회, owner MFA, 적립·사용 영속화, 다른 기기 Realtime, Push.
- 동시성 test: 같은 고객에 대한 병렬 적립/사용에서도 잔액과 로그 합계가 일치해야 한다.

## 공식 근거

- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security)
- [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa)
- [Supabase Phone Login](https://supabase.com/docs/guides/auth/phone-login)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac)
- [Supabase Realtime Database Changes](https://supabase.com/docs/guides/realtime/subscribing-to-database-changes)
- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development/overview)
- [Supabase Database Testing](https://supabase.com/docs/guides/local-development/testing/overview)
- [Vercel Vite Deployment](https://vercel.com/docs/frameworks/frontend/vite)
