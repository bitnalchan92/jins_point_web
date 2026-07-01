# ADR-0012: 백엔드 — Supabase 도입

- **Status**: Accepted
- **Date**: 2026-06-29
- **Related**: [ADR-0014](./0014-production-auth-and-authorization.md), [ADR-0016](./0016-web-only-stage2.md), [ADR-0011](./0011-typescript-strict.md)

## Context

Stage 1은 모든 데이터를 React Context 메모리에만 저장한다. 새로고침 시 데이터가 사라지고, 다른 기기 간 동기화와 서버 측 권한 검증을 제공하지 않는다.

대안:

- **Firebase**: Auth와 실시간 기능은 강하지만 NoSQL 모델이 향후 PostgreSQL/Spring 전환 방향과 다르다.
- **Vercel DB/KV + 별도 인증·실시간 서버**: 구성 요소와 자체 보안 코드가 늘어난다.
- **Supabase**: PostgreSQL, Auth, RLS, Edge Functions, Realtime, CLI migration과 공식 보안 가이드를 한 플랫폼에서 제공한다.

## Decision

Supabase를 백엔드로 사용한다.

- DB: PostgreSQL
- 인증: Supabase Auth. 세부 정책은 [ADR-0014](./0014-production-auth-and-authorization.md)를 따른다.
- 인가: 모든 노출 테이블에 RLS 적용
- 서버 로직: Supabase Edge Functions와 PostgreSQL 함수
- 실시간: private Realtime Broadcast
- 스키마 관리: Supabase CLI versioned migrations
- 테스트: pgTAP DB/RLS test와 Edge Function test

### 보안 경계

- 브라우저에는 project URL과 publishable key만 제공한다.
- 고객·적립내역 테이블은 `anon` 직접 접근을 거부한다.
- owner는 `owner` 역할과 `aal2`를 모두 만족해야 한다.
- 관리자 쓰기는 user JWT를 검증하는 Edge Function을 통하거나, 동일 권한 검사를 수행하는 원자적 PostgreSQL 함수로 처리한다.
- secret key는 Edge Function에서만 사용하고 최소 잔액 조회처럼 RLS 우회가 필요한 서버 처리에 한정한다.

### 논리 스키마

실제 SQL은 `supabase/migrations/`에 작성한다.

```sql
create type public.app_role as enum ('owner');
create type public.reward_type as enum ('earn', 'use');

create table public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null
);

create table public.store_config (
  id smallint primary key default 1 check (id = 1),
  store_name text not null check (length(trim(store_name)) > 0),
  tagline text not null,
  reward_rate numeric(5,4) not null check (reward_rate > 0 and reward_rate <= 1),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  points integer not null default 0 check (points >= 0),
  visit_count integer not null default 0 check (visit_count >= 0),
  last_visited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reward_log (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  type public.reward_type not null,
  amount integer not null check (amount > 0),
  points_delta integer not null,
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  check (
    (type = 'earn' and points_delta > 0)
    or (type = 'use' and points_delta < 0)
  )
);

create index customers_phone_suffix_idx
  on public.customers ((right(phone_e164, 4)));
create index reward_log_customer_created_idx
  on public.reward_log (customer_id, created_at desc);
```

표현식을 table `UNIQUE` constraint 안에 넣지 않는다. PostgreSQL 표현식 고유성은 별도 unique index로 정의한다.

### 원자적 포인트 처리

`public.apply_reward_transaction(customer_id, type, amount, idempotency_key)` 함수가 다음을 하나의 DB transaction에서 처리한다.

1. 현재 사용자의 owner 역할과 `aal2` 확인
2. 기존 `idempotency_key`의 요청 지문과 결과 확인
3. 대상 고객 행 `FOR UPDATE`
4. DB 적립률 조회 및 포인트 계산
5. 잔액·사용 단위 검증
6. 고객 잔액·방문수·최근 방문일 갱신
7. `reward_log` 삽입
8. 확정된 `points_delta`, `balance_after` 반환

클라이언트가 보낸 적립 포인트, 적립률, 최종 잔액은 사용하지 않는다.

### 환경변수

| 변수 | 위치 | 공개 여부 |
|------|------|-----------|
| `VITE_SUPABASE_URL` | 로컬 클라이언트 + Vercel | 공개 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 로컬 클라이언트 + Vercel | 공개 |
| `VITE_TURNSTILE_SITE_KEY` | 로컬 클라이언트 + Vercel | 공개 |
| `TURNSTILE_SECRET_KEY` | Supabase Edge Function Secrets | 비공개 |
| `UPSTASH_REDIS_REST_URL` | Supabase Edge Function Secrets | 비공개 |
| `UPSTASH_REDIS_REST_TOKEN` | Supabase Edge Function Secrets | 비공개 |
| Supabase secret key | Supabase Edge Function | 비공개 |

Edge Function secret은 `Deno.env.get()`으로 읽는다. Vercel에는 server secret을 저장하지 않는다.

### Edge Functions

| 함수 | 인증 | 역할 |
|------|------|------|
| `owner-api` | Supabase user JWT + owner + `aal2` | 신규 고객 생성, 고객 검색, 포인트 RPC 호출, 설정 변경 |
| `lookup-balance` | Turnstile Siteverify + 다중 rate limit | 비인증 최소 잔액 DTO |

`lookup-balance`는 Turnstile의 hostname/action을 검증하고 IP, 전화번호 HMAC digest,
전체 요청량을 각각 제한한다. 전체 전화번호와 잔액은 log에 남기지 않는다.

## Spring 전환

PostgreSQL 스키마와 제약조건은 유지할 수 있다. Auth/RLS, Edge Functions, Realtime은 Spring Security/JWT, REST controller, WebSocket/SSE로 대체해야 하므로 해당 부분은 별도 마이그레이션 작업이다. “스키마 변경 없음”은 보장하지 않는다.

## Consequences

좋은 점:

- DB 제약과 RLS가 클라이언트 오류·변조에도 데이터와 개인정보를 보호한다.
- Auth, Realtime, Functions가 같은 JWT와 RLS 모델을 사용한다.
- migration과 test가 버전 관리되어 환경을 재현할 수 있다.

비용과 제약:

- Supabase CLI와 로컬 Docker 환경이 필요하다.
- 유출 비밀번호 차단과 세션 제어를 위해 유료 플랜이 필요할 수 있다.
- Turnstile과 rate-limit 저장소의 장애·운영 모니터링이 추가된다.
- Supabase Auth/RLS에 대한 의존도가 높아진다.

## 공식 근거

- [Securing your data](https://supabase.com/docs/guides/database/secure-data)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Local development with migrations](https://supabase.com/docs/guides/local-development/overview)
- [Database testing](https://supabase.com/docs/guides/local-development/testing/overview)
- [PostgreSQL Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL Indexes on Expressions](https://www.postgresql.org/docs/current/indexes-expressional.html)
- [Cloudflare Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Supabase Rate Limiting Edge Functions](https://supabase.com/docs/guides/functions/examples/rate-limiting)
