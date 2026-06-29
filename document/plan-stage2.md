# Web-Only Stage 2 Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 React 고객·사장님 웹을 유지하면서 Supabase 영속화, owner MFA, RLS, 원자적 포인트 거래, Turnstile 기반 최소 잔액 조회를 갖춘 실서비스로 전환한다.

**Architecture:** 고객 브라우저는 테이블을 직접 조회하지 않고 `lookup-balance` Edge Function으로 최소 잔액 DTO만 받는다. 사장님은 Supabase Auth 이메일·비밀번호와 TOTP로 `aal2` 세션을 만든 뒤 owner 전용 Edge Function/RPC/RLS를 사용한다. PostgreSQL의 `reward_log`와 원자적 함수가 유일한 포인트 원장이며 owner 화면만 private Realtime event를 invalidation 신호로 사용한다.

**Tech Stack:** React 19, TypeScript strict, Vite 8, Supabase Auth/PostgreSQL/RLS/Edge Functions/Realtime, Cloudflare Turnstile, Upstash Redis REST, Zod, Vitest, React Testing Library, pgTAP, Deno Test, Playwright, Vercel

**Approved design:** [Web-Only Stage 2 Production Design](../docs/superpowers/specs/2026-06-29-web-production-baseline-design.md)

---

## 작업 순서와 경계

```text
Task 1  테스트·로컬 환경
  ↓
Task 2  Core schema + RLS
  ↓
Task 3  원자적 포인트 transaction
  ↓
Task 4  공개 최소 잔액 Edge Function
  ↓
Task 5  고객 React 웹 연결
  ↓
Task 6  owner Auth + TOTP MFA
  ↓
Task 7  owner API + 운영 화면
  ↓
Task 8  owner private Realtime
  ↓
Task 9  E2E + Vercel + CI + 문서
```

Flutter, 주문, 결제, Phone OTP, 고객 상세 내역, 고객 Realtime, Web Push, FCM,
SMS, 알림톡은 이 계획에 추가하지 않는다.

## 파일 구조

```text
src/
├── auth/
│   ├── OwnerAuthProvider.tsx
│   ├── OwnerLoginForm.tsx
│   └── OwnerMfaForm.tsx
├── customer/
│   ├── TurnstileWidget.tsx
│   └── useBalanceLookup.ts
├── lib/
│   ├── api.ts
│   ├── contracts.ts
│   ├── env.ts
│   ├── phone.ts
│   └── supabase.ts
├── owner/
│   ├── OwnerStoreProvider.tsx
│   └── useOwnerRealtime.ts
└── test/setup.ts

supabase/
├── config.toml
├── deno.json
├── seed.sql
├── migrations/
│   ├── <timestamp>_core_schema_and_rls.sql
│   ├── <timestamp>_reward_transaction.sql
│   └── <timestamp>_owner_realtime.sql
├── tests/database/
│   ├── schema_rls.test.sql
│   ├── reward_transaction.test.sql
│   └── owner_realtime.test.sql
└── functions/
    ├── _shared/
    │   ├── auth.ts
    │   ├── cors.ts
    │   ├── database.types.ts
    │   ├── phone.ts
    │   ├── rate-limit.ts
    │   ├── response.ts
    │   └── turnstile.ts
    ├── lookup-balance/index.ts
    ├── owner-api/index.ts
    └── tests/
        ├── lookup-balance.test.ts
        └── owner-api.test.ts
```

---

### Task 1: 테스트 도구와 로컬 Supabase 기반

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Modify: `.gitignore`
- Create: `.env.example`
- Create: `.env.test`
- Create: `src/test/setup.ts`
- Create: `supabase/config.toml`
- Create: `supabase/deno.json`

- [ ] **Step 1: 현재 기준선 검증**

Run:

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: 세 명령 모두 exit code 0.

- [ ] **Step 2: 런타임 의존성 설치**

Run:

```bash
npm install @supabase/supabase-js zod
```

Expected: 두 패키지가 `dependencies`에 추가되고 `package-lock.json`이 갱신됨.
Upstash 패키지는 Edge Function의 `supabase/deno.json` import map으로만 고정한다.

- [ ] **Step 3: 테스트 의존성 설치**

Run:

```bash
npm install --save-dev vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test otpauth
```

Expected: 테스트 패키지가 `devDependencies`에 추가됨.

- [ ] **Step 4: 실패하는 테스트 스크립트 계약 추가**

`package.json`의 `scripts`에 추가:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:db": "npx supabase test db",
  "test:edge": "deno task --config supabase/deno.json test",
  "test:e2e": "playwright test"
}
```

Run:

```bash
npm run test
```

Expected: test file이 없다는 실패. Task 1의 red 상태다.

- [ ] **Step 5: Vitest 설정과 smoke test 작성**

`vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
  },
})
```

`src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

`tsconfig.app.json`의 `include`는 유지하고 `compilerOptions.types`를 다음으로 변경:

```json
"types": ["vite/client", "vitest/globals"]
```

`src/lib/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatPhone, onlyDigits } from './format'

describe('phone formatting', () => {
  it('formats a Korean mobile number without changing its digits', () => {
    expect(formatPhone('01023457788')).toBe('010-2345-7788')
    expect(onlyDigits('010-2345-7788')).toBe('01023457788')
  })
})
```

Run:

```bash
npm run test
```

Expected: `src/lib/format.test.ts` PASS.

- [ ] **Step 6: Supabase 로컬 프로젝트 초기화**

Run:

```bash
npx supabase init
```

Expected: `supabase/config.toml` 생성. 기존 파일 덮어쓰기 질문이 나오면 중단하고 차이를 먼저 검토한다.

`supabase/config.toml`에 함수별 JWT 정책 추가:

```toml
[functions.lookup-balance]
verify_jwt = false

[functions.owner-api]
verify_jwt = true
```

`supabase/deno.json`:

```json
{
  "imports": {
    "@std/assert": "jsr:@std/assert@1",
    "@std/testing": "jsr:@std/testing@1",
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "@upstash/redis": "npm:@upstash/redis@1",
    "@upstash/ratelimit": "npm:@upstash/ratelimit@2",
    "zod": "npm:zod@4"
  },
  "tasks": {
    "test": "deno test supabase/functions/tests/ --allow-env"
  }
}
```

- [ ] **Step 7: 환경변수 계약 작성**

`.env.example`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_TURNSTILE_SITE_KEY=

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
TURNSTILE_SECRET_KEY=
TURNSTILE_EXPECTED_HOSTNAME=localhost
TURNSTILE_EXPECTED_ACTION=lookup_balance
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
PHONE_RATE_LIMIT_HMAC_SECRET=
ALLOWED_ORIGINS=http://localhost:5173
```

실제 값이 든 `.env`, `.env.local`, `supabase/.env`가 `.gitignore`에 포함되었는지 확인한다.

`.env.test`에는 secret이 아닌 Cloudflare 공식 test sitekey와 local URL만 둔다.

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=test-publishable-key
VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
```

`.gitignore`에 다음을 추가한다.

```gitignore
.env*
!.env.example
!.env.test
supabase/.env
```

- [ ] **Step 8: Task 1 검증 및 커밋**

Run:

```bash
npm run test
npm run lint
npm run typecheck
npm run build
git diff --check
```

Expected: 모두 PASS.

```bash
git add package.json package-lock.json vite.config.ts tsconfig.app.json .env.example .env.test .gitignore src/test/setup.ts src/lib/format.test.ts supabase/config.toml supabase/deno.json
git commit -m "test: add stage 2 verification toolchain"
```

---

### Task 2: Core schema와 deny-by-default RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_core_schema_and_rls.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/tests/database/schema_rls.test.sql`

- [ ] **Step 1: 실패하는 schema/RLS pgTAP test 작성**

`supabase/tests/database/schema_rls.test.sql`의 핵심 계약:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'customers');
select has_table('public', 'reward_log');
select has_table('public', 'store_config');
select has_table('public', 'app_user_roles');
select col_is_unique('public', 'customers', 'phone_e164');
select col_has_check('public', 'customers', 'points');
select policies_are('public', 'customers', array['owner_all_customers']);
select policies_are('public', 'reward_log', array['owner_all_reward_log']);
select policies_are('public', 'store_config', array['owner_all_store_config']);
select policies_are('public', 'app_user_roles', array['owner_read_roles']);
select table_privs_are('public', 'customers', 'anon', array[]::text[]);
select table_privs_are('public', 'reward_log', 'anon', array[]::text[]);

select * from finish();
rollback;
```

Run:

```bash
npx supabase start
npx supabase test db supabase/tests/database/schema_rls.test.sql
```

Expected: FAIL because tables do not exist.

- [ ] **Step 2: core schema와 RLS를 같은 migration에 작성**

`supabase/migrations/<timestamp>_core_schema_and_rls.sql`:

```sql
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.app_role as enum ('owner');
create type public.reward_type as enum ('earn', 'use');

create table public.app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null
);

create table public.store_config (
  id smallint primary key default 1 check (id = 1),
  store_name text not null check (length(trim(store_name)) > 0),
  tagline text not null default '',
  reward_rate numeric(5,4) not null check (reward_rate > 0 and reward_rate <= 1),
  reward_threshold integer not null check (reward_threshold > 0),
  redeem_unit integer not null check (redeem_unit > 0),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
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

create index customers_phone_suffix_idx on public.customers ((right(phone_e164, 4)));
create index reward_log_customer_created_idx on public.reward_log (customer_id, created_at desc);

create or replace function private.is_owner_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and (select auth.jwt()->>'aal') = 'aal2'
    and exists (
      select 1
      from public.app_user_roles r
      where r.user_id = (select auth.uid())
        and r.role = 'owner'
    );
$$;

revoke all on function private.is_owner_aal2() from public, anon;
grant execute on function private.is_owner_aal2() to authenticated;

alter table public.app_user_roles enable row level security;
alter table public.store_config enable row level security;
alter table public.customers enable row level security;
alter table public.reward_log enable row level security;

create policy owner_read_roles on public.app_user_roles
for select to authenticated using ((select private.is_owner_aal2()));

create policy owner_all_store_config on public.store_config
for all to authenticated
using ((select private.is_owner_aal2()))
with check ((select private.is_owner_aal2()));

create policy owner_all_customers on public.customers
for all to authenticated
using ((select private.is_owner_aal2()))
with check ((select private.is_owner_aal2()));

create policy owner_all_reward_log on public.reward_log
for all to authenticated
using ((select private.is_owner_aal2()))
with check ((select private.is_owner_aal2()));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.app_user_roles to authenticated;
grant select, update on public.store_config to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select on public.reward_log to authenticated;
grant all on public.app_user_roles, public.store_config, public.customers, public.reward_log to service_role;
```

같은 migration에서 RLS를 활성화하므로 public table이 무방비로 존재하는 배포
구간을 만들지 않는다.

- [ ] **Step 3: 재현 가능한 seed 작성**

`supabase/seed.sql`:

```sql
insert into public.store_config
  (id, store_name, tagline, reward_rate, reward_threshold, redeem_unit)
values
  (1, '달콤한 진스쿡', '김밥 · 샌드위치 전문점', 0.0500, 5000, 1000)
on conflict (id) do update set
  store_name = excluded.store_name,
  tagline = excluded.tagline,
  reward_rate = excluded.reward_rate,
  reward_threshold = excluded.reward_threshold,
  redeem_unit = excluded.redeem_unit;

insert into public.customers (name, phone_e164, points, visit_count)
values
  ('김서연', '+821023457788', 3420, 18),
  ('이준호', '+821098765432', 5180, 24)
on conflict (phone_e164) do nothing;
```

owner Auth user와 role은 seed에 고정 비밀번호로 넣지 않는다. 로컬 검증에서는
`supabase.auth.admin.createUser()`로 사용자를 만든 뒤 role row를 추가한다.

- [ ] **Step 4: reset, schema test, lint**

Run:

```bash
npx supabase db reset
npx supabase test db supabase/tests/database/schema_rls.test.sql
npx supabase db lint --level error
```

Expected: pgTAP PASS, database lint error 0.

- [ ] **Step 5: Task 2 커밋**

```bash
git add supabase/migrations supabase/seed.sql supabase/tests/database/schema_rls.test.sql
git commit -m "feat: add secure core database schema"
```

---

### Task 3: 원자적 포인트 거래와 idempotency

**Files:**
- Create: `supabase/migrations/<timestamp>_reward_transaction.sql`
- Create: `supabase/tests/database/reward_transaction.test.sql`

- [ ] **Step 1: 실패하는 거래 test 작성**

`reward_transaction.test.sql`은 transaction 안에서 Auth 사용자 두 명을 만들고
다음을 검증한다.

```sql
select throws_ok(
  $$ select * from public.apply_reward_transaction(
    '00000000-0000-0000-0000-000000000001', 'earn', 10000,
    '10000000-0000-0000-0000-000000000001'
  ) $$,
  'PT403',
  'owner aal2 required'
);

select results_eq(
  $$ select points_delta, balance_after
     from public.apply_reward_transaction(
       '00000000-0000-0000-0000-000000000001', 'earn', 10000,
       '10000000-0000-0000-0000-000000000002'
     ) $$,
  $$ values (500, 500) $$,
  '10,000 KRW at 5 percent earns 500 points'
);

select results_eq(
  $$ select count(*)::bigint from public.reward_log
     where idempotency_key = '10000000-0000-0000-0000-000000000002' $$,
  $$ values (1::bigint) $$,
  'same idempotency key creates one ledger row'
);
```

같은 파일에 다음 case를 실제 SQL assertion으로 추가한다.

- owner `aal1` 거부
- non-owner `aal2` 거부
- 잔액 부족 `PT422`
- 1,000P 단위가 아닌 사용 `PT422`
- 같은 key와 같은 요청은 같은 결과
- 같은 key와 다른 요청은 `PT409`

Run:

```bash
npx supabase test db supabase/tests/database/reward_transaction.test.sql
```

Expected: FAIL because function does not exist.

- [ ] **Step 2: 원자적 함수 작성**

`supabase/migrations/<timestamp>_reward_transaction.sql`:

```sql
create or replace function public.apply_reward_transaction(
  p_customer_id uuid,
  p_type public.reward_type,
  p_amount integer,
  p_idempotency_key uuid
)
returns table (
  reward_log_id uuid,
  points_delta integer,
  balance_after integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.reward_log%rowtype;
  v_customer public.customers%rowtype;
  v_config public.store_config%rowtype;
  v_delta integer;
begin
  if not (select private.is_owner_aal2()) then
    raise exception using errcode = 'PT403', message = 'owner aal2 required';
  end if;

  if p_amount <= 0 then
    raise exception using errcode = 'PT422', message = 'amount must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));

  select * into v_existing
  from public.reward_log
  where idempotency_key = p_idempotency_key;

  if found then
    if v_existing.actor_user_id <> (select auth.uid())
      or v_existing.customer_id <> p_customer_id
      or v_existing.type <> p_type
      or v_existing.amount <> p_amount then
      raise exception using errcode = 'PT409', message = 'idempotency conflict';
    end if;

    return query
      select v_existing.id, v_existing.points_delta, v_existing.balance_after;
    return;
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id
  for update;

  if not found then
    raise exception using errcode = 'PT404', message = 'customer not found';
  end if;

  select * into v_config
  from public.store_config
  where id = 1;

  if not found then
    raise exception using errcode = 'PT500', message = 'store config missing';
  end if;

  if p_type = 'earn' then
    v_delta := floor(p_amount * v_config.reward_rate)::integer;
    if v_delta <= 0 then
      raise exception using errcode = 'PT422', message = 'earned points must be positive';
    end if;
  else
    if p_amount % v_config.redeem_unit <> 0 then
      raise exception using errcode = 'PT422', message = 'invalid redeem unit';
    end if;
    if v_customer.points < p_amount then
      raise exception using errcode = 'PT422', message = 'insufficient balance';
    end if;
    v_delta := -p_amount;
  end if;

  update public.customers
  set points = points + v_delta,
      visit_count = visit_count + case when p_type = 'earn' then 1 else 0 end,
      last_visited_at = case when p_type = 'earn' then now() else last_visited_at end,
      updated_at = now()
  where id = p_customer_id
  returning * into v_customer;

  insert into public.reward_log (
    idempotency_key, customer_id, actor_user_id, type,
    amount, points_delta, balance_after
  )
  values (
    p_idempotency_key, p_customer_id, (select auth.uid()), p_type,
    p_amount, v_delta, v_customer.points
  )
  returning id, reward_log.points_delta, reward_log.balance_after
  into reward_log_id, points_delta, balance_after;

  return next;
end;
$$;

revoke all on function public.apply_reward_transaction(uuid, public.reward_type, integer, uuid)
from public, anon;
grant execute on function public.apply_reward_transaction(uuid, public.reward_type, integer, uuid)
to authenticated;
```

- [ ] **Step 3: DB 검증**

Run:

```bash
npx supabase db reset
npx supabase test db
npx supabase db lint --level error
```

Expected: schema/RLS와 거래 test 모두 PASS.

- [ ] **Step 4: Task 3 커밋**

```bash
git add supabase/migrations supabase/tests/database/reward_transaction.test.sql
git commit -m "feat: add atomic reward transaction"
```

---

### Task 4: Turnstile 기반 최소 잔액 Edge Function

**Files:**
- Create: `supabase/functions/_shared/phone.ts`
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/response.ts`
- Create: `supabase/functions/_shared/turnstile.ts`
- Create: `supabase/functions/_shared/rate-limit.ts`
- Create: `supabase/functions/lookup-balance/index.ts`
- Create: `supabase/functions/tests/lookup-balance.test.ts`

- [ ] **Step 1: pure helper의 실패 test 작성**

`supabase/functions/tests/lookup-balance.test.ts`:

```ts
import { assertEquals, assertRejects } from '@std/assert'
import { normalizeKoreanPhone } from '../_shared/phone.ts'

Deno.test('normalizes a Korean mobile number to E.164', () => {
  assertEquals(normalizeKoreanPhone('010-2345-7788'), '+821023457788')
})

Deno.test('rejects a non-mobile number', async () => {
  await assertRejects(
    async () => normalizeKoreanPhone('02-123-4567'),
    Error,
    'invalid_phone',
  )
})
```

Run:

```bash
npm run test:edge
```

Expected: FAIL because `phone.ts` does not exist.

- [ ] **Step 2: 전화번호와 공통 HTTP helper 구현**

`supabase/functions/_shared/phone.ts`:

```ts
export function normalizeKoreanPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!/^01[016789][0-9]{7,8}$/.test(digits)) {
    throw new Error('invalid_phone')
  }
  return `+82${digits.slice(1)}`
}

export async function hmacDigest(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
```

`supabase/functions/_shared/response.ts`:

```ts
export function json(body: unknown, status: number, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    },
  })
}
```

`supabase/functions/_shared/cors.ts`:

```ts
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? ''
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (!allowed.includes(origin)) return {}

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type, x-client-info',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    vary: 'Origin',
  }
}
```

- [ ] **Step 3: Turnstile 서버 검증 구현과 test 추가**

`supabase/functions/_shared/turnstile.ts`:

```ts
import { z } from 'zod'

const resultSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  'error-codes': z.array(z.string()).optional(),
})

export async function verifyTurnstile(token: string, ip: string): Promise<void> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  const hostname = Deno.env.get('TURNSTILE_EXPECTED_HOSTNAME')
  const action = Deno.env.get('TURNSTILE_EXPECTED_ACTION')
  if (!secret || !hostname || !action) throw new Error('turnstile_not_configured')

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret, response: token, remoteip: ip }),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error('turnstile_unavailable')

  const result = resultSchema.parse(await response.json())
  if (!result.success || result.hostname !== hostname || result.action !== action) {
    throw new Error('turnstile_rejected')
  }
}
```

test에서 `globalThis.fetch`를 stub해 다음을 검증한다.

- `success: true`, 정확한 hostname/action은 resolve
- `success: false` 거부
- 다른 hostname/action 거부
- timeout/network error는 허용하지 않음

- [ ] **Step 4: Upstash 다중 rate limit 구현**

`supabase/functions/_shared/rate-limit.ts`:

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function clients(): {
  global: Ratelimit
  ip: Ratelimit
  phone: Ratelimit
} {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL')
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')
  if (!url || !token) throw new Error('rate_limit_not_configured')

  const redis = new Redis({ url, token })
  return {
    global: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(300, '1 m'),
      prefix: 'lookup:global',
    }),
    ip: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '10 m'),
      prefix: 'lookup:ip',
    }),
    phone: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 m'),
      prefix: 'lookup:phone',
    }),
  }
}

export async function enforcePreVerificationLimits(ip: string): Promise<void> {
  const rate = clients()
  const results = await Promise.all([rate.global.limit('all'), rate.ip.limit(ip)])
  if (results.some((result) => !result.success)) throw new Error('rate_limited')
}

export async function enforcePhoneLimit(phoneDigest: string): Promise<void> {
  const result = await clients().phone.limit(phoneDigest)
  if (!result.success) throw new Error('rate_limited')
}
```

- [ ] **Step 5: `lookup-balance` handler 구현**

요청/응답 contract:

```ts
type LookupRequest = { phone: string; turnstileToken: string }
type BalanceResponse = {
  points: number
  rewardThreshold: number
  pointsToNextReward: number
  storeName: string
  asOf: string
}
```

`lookup-balance/index.ts` handler 순서는 고정한다.

1. POST와 허용 origin 검사
2. `enforcePreVerificationLimits(ip)`
3. JSON을 Zod로 검증
4. 전화번호 E.164 정규화 및 HMAC digest
5. Turnstile Siteverify
6. `enforcePhoneLimit(phoneDigest)`
7. secret-scoped client로 `customers.points`, `store_config`만 조회
8. 미등록과 0포인트를 같은 200 응답으로 반환

DB 응답 조립의 핵심:

```ts
const points = customer?.points ?? 0
const within = points % config.reward_threshold
const pointsToNextReward =
  points === 0 ? config.reward_threshold : within === 0 ? 0 : config.reward_threshold - within

return json({
  points,
  rewardThreshold: config.reward_threshold,
  pointsToNextReward,
  storeName: config.store_name,
  asOf: new Date().toISOString(),
}, 200, cors)
```

오류 매핑:

```ts
const status =
  error.message === 'rate_limited' ? 429
  : error.message === 'invalid_phone' || error.message === 'turnstile_rejected' ? 400
  : 503
const code = status === 429 ? 'RATE_LIMITED' : status === 400 ? 'INVALID_REQUEST' : 'UNAVAILABLE'
return json({ error: { code, message: '요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.' } }, status, cors)
```

전화번호, digest, 잔액, Turnstile token을 `console.log/error`에 넣지 않는다.

- [ ] **Step 6: Edge Function test**

mock fetch/Supabase 응답으로 다음 case를 검증한다.

- anon table endpoint를 호출하지 않고 secret-scoped client만 사용
- 등록 고객과 미등록 고객 모두 동일한 response shape
- 응답에 `name`, `phone`, `customerId`, `history`, `visitCount`가 없음
- Turnstile 거부 시 DB 호출 없음
- rate limit 시 `429`
- secret 누락과 외부 API 장애는 `503`
- 모든 응답에 `cache-control: no-store`

Run:

```bash
npm run test:edge
```

Expected: 모든 Deno test PASS.

- [ ] **Step 7: 로컬 통합 호출과 커밋**

Run:

```bash
npx supabase functions serve lookup-balance --env-file supabase/.env
```

별도 terminal에서 Cloudflare test sitekey/secret으로 정상·실패 token을 각각 호출한다.
Expected: 정상은 최소 DTO `200`, 재사용/실패 token은 `400`, 허용되지 않은 origin은
CORS header 없음.

```bash
git add supabase/functions supabase/config.toml
git commit -m "feat: add protected balance lookup"
```

---

### Task 5: 고객 React 웹을 최소 잔액 API에 연결

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/contracts.ts`
- Create: `src/lib/api.ts`
- Create: `src/lib/phone.ts`
- Create: `src/customer/TurnstileWidget.tsx`
- Create: `src/customer/useBalanceLookup.ts`
- Create: `src/customer/useBalanceLookup.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/screens/CustomerLandingScreen.tsx`
- Modify: `src/screens/CustomerPointScreen.tsx`
- Modify: `src/main.tsx`
- Modify: `src/store.tsx`

- [ ] **Step 1: 실패하는 customer hook test 작성**

`useBalanceLookup.test.tsx`는 `fetch`를 mock하고 다음을 검증한다.

```ts
it('sends phone and Turnstile token and exposes the minimal DTO', async () => {
  const { result } = renderHook(() => useBalanceLookup())
  await act(() => result.current.lookup('010-2345-7788', 'token'))
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/functions/v1/lookup-balance'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ phone: '010-2345-7788', turnstileToken: 'token' }),
    }),
  )
  expect(result.current.state.status).toBe('success')
})
```

추가 case: 중복 submit 방지, `429` 안내, `503` 재시도, 이전 결과 초기화.

Run:

```bash
npm run test -- src/customer/useBalanceLookup.test.tsx
```

Expected: FAIL because hook does not exist.

- [ ] **Step 2: 환경과 API contract 구현**

`src/lib/env.ts`:

```ts
const required = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

export const env = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabasePublishableKey: required(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
  turnstileSiteKey: required('VITE_TURNSTILE_SITE_KEY', import.meta.env.VITE_TURNSTILE_SITE_KEY),
}
```

`src/lib/contracts.ts`:

```ts
import { z } from 'zod'

export const balanceResponseSchema = z.object({
  points: z.number().int().nonnegative(),
  rewardThreshold: z.number().int().positive(),
  pointsToNextReward: z.number().int().nonnegative(),
  storeName: z.string().min(1),
  asOf: z.string().datetime(),
})

export type BalanceResponse = z.infer<typeof balanceResponseSchema>
```

`src/lib/phone.ts`:

```ts
export function displayKoreanPhone(phoneE164: string): string {
  if (!/^\+82[0-9]{9,10}$/.test(phoneE164)) return phoneE164
  const domestic = `0${phoneE164.slice(3)}`
  if (domestic.length === 10) {
    return domestic.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')
  }
  return domestic.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3')
}
```

`src/lib/api.ts`는 `fetch` 후 status를 안정된 `ApiErrorCode`로 변환하고 Zod parse한
응답만 반환한다.

- [ ] **Step 3: Turnstile widget 구현**

`TurnstileWidget.tsx`는 Cloudflare explicit rendering API를 사용한다.

```ts
declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: {
        sitekey: string
        action: string
        callback: (token: string) => void
        'expired-callback': () => void
        'error-callback': () => void
      }) => string
      remove: (widgetId: string) => void
      reset: (widgetId: string) => void
    }
  }
}
```

script URL은
`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` 하나만
동적으로 로드한다. mount 후 `action: 'lookup_balance'`로 render하고 token,
expired, error를 부모 callback으로 전달한다. unmount 때 `remove(widgetId)`를
호출한다.

- [ ] **Step 4: 조회 hook과 화면 state 구현**

state는 discriminated union으로 고정한다.

```ts
type BalanceLookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: BalanceResponse }
  | { status: 'error'; code: 'INVALID_REQUEST' | 'RATE_LIMITED' | 'UNAVAILABLE' }
```

`CustomerLandingScreen`은 유효한 전화번호와 Turnstile token이 모두 있을 때만
CTA를 활성화한다. submit 동안 input/CTA를 잠그고 inline progress를 표시한다.

`CustomerPointScreen` props를 다음으로 바꾼다.

```ts
interface CustomerPointScreenProps {
  balance: BalanceResponse
  onChangePhone: () => void
}
```

production 화면에서 제거:

- 고객 이름
- 마스킹/전체 전화번호
- 방문 횟수
- 상세 내역
- demo chip

표시:

- `balance.points`
- `balance.pointsToNextReward`
- `balance.rewardThreshold`
- `balance.storeName`
- `balance.asOf`

- [ ] **Step 5: provider 경계 조정**

`main.tsx`의 전역 `StoreProvider`를 제거한다. `StoreProvider`는 owner production
provider로 교체되기 전까지 `/admin` 내부에만 임시 배치한다. 고객 route가 demo
customer 배열과 `findCustomer()`에 접근하지 않는 것을 test로 확인한다.

- [ ] **Step 6: 고객 component test**

React Testing Library로 다음을 검증한다.

- Turnstile token 전에는 submit 불가
- loading 중 재제출 불가
- 성공 화면은 잔액/다음 혜택만 표시
- 이름/전화번호/방문수/상세 내역 문자열 없음
- `RATE_LIMITED`, `UNAVAILABLE`별 문구와 retry
- 다른 번호 조회가 state와 Turnstile token을 초기화

Run:

```bash
npm run test -- src/customer src/screens/CustomerLandingScreen.test.tsx src/screens/CustomerPointScreen.test.tsx
npm run typecheck
npm run build
```

Expected: 모두 PASS.

- [ ] **Step 7: Task 5 커밋**

```bash
git add src package.json package-lock.json
git commit -m "feat: connect customer balance lookup"
```

---

### Task 6: owner 이메일·비밀번호와 필수 TOTP MFA

**Files:**
- Create: `src/lib/supabase.ts`
- Create: `src/auth/OwnerAuthProvider.tsx`
- Create: `src/auth/OwnerAuthProvider.test.tsx`
- Create: `src/auth/OwnerLoginForm.tsx`
- Create: `src/auth/OwnerMfaForm.tsx`
- Modify: `src/App.tsx`
- Delete production use: `src/lib/data.ts`의 `OWNER_PIN`
- Replace: `src/screens/OwnerLoginScreen.tsx`

- [ ] **Step 1: auth state machine의 실패 test 작성**

검증 state:

```ts
type OwnerAuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'needs_enrollment'; email: string }
  | { status: 'needs_challenge'; email: string }
  | { status: 'ready'; email: string }
  | { status: 'error'; message: string }
```

mock Supabase Auth로 다음 transition을 test한다.

- session 없음 → `signed_out`
- password login 후 factor 없음 → `needs_enrollment`
- verified TOTP factor + `aal1` → `needs_challenge`
- `aal2` → `ready`
- sign out → `signed_out`
- auth event 발생 때 상태 재평가

Run:

```bash
npm run test -- src/auth/OwnerAuthProvider.test.tsx
```

Expected: FAIL because provider does not exist.

- [ ] **Step 2: Supabase browser client 생성**

`src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from '../../supabase/functions/_shared/database.types'

export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
```

Run:

```bash
npx supabase gen types typescript --local
```

생성 결과를 `supabase/functions/_shared/database.types.ts`에 저장하고 브라우저와
Edge Function이 같은 DB type을 사용한다.

- [ ] **Step 3: OwnerAuthProvider 구현**

provider가 노출할 contract:

```ts
interface OwnerAuthValue {
  state: OwnerAuthState
  signIn: (email: string, password: string) => Promise<void>
  enrollTotp: () => Promise<{ factorId: string; qrCode: string; secret: string }>
  verifyTotp: (factorId: string, code: string) => Promise<void>
  signOut: () => Promise<void>
}
```

`getAuthenticatorAssuranceLevel()`와 `mfa.listFactors()`를 함께 사용한다.
`ready`는 `currentLevel === 'aal2'`인 경우만 허용한다. UI가 `ready`여도 API와
RLS가 다시 역할/aal을 검사한다.

- [ ] **Step 4: 로그인·MFA UI 구현**

`OwnerLoginForm`:

- email/password controlled fields
- password manager와 붙여넣기 허용
- submit 중 disable
- generic login failure
- 공개 회원가입 링크 없음
- demo PIN과 자동 입력 버튼 제거

`OwnerMfaForm`:

- enrollment이면 Supabase가 반환한 QR SVG와 수동 secret 표시
- 6자리 TOTP 입력
- challenge/verify
- 잘못된 코드, 만료 session, network error 구분
- MFA 완료 후 auth state를 다시 읽고 `aal2` 확인

- [ ] **Step 5: `/admin` route guard 교체**

`App.tsx`의 `authed` local boolean을 제거한다.

```tsx
function AdminPage() {
  const { state } = useOwnerAuth()
  if (state.status === 'loading') return <AdminLoadingScreen />
  if (state.status === 'signed_out') return <OwnerLoginForm />
  if (state.status === 'needs_enrollment' || state.status === 'needs_challenge') {
    return <OwnerMfaForm mode={state.status} />
  }
  if (state.status !== 'ready') return <AdminAuthErrorScreen />
  return <OwnerApp />
}
```

- [ ] **Step 6: auth test와 수동 AAL 검증**

Run:

```bash
npm run test -- src/auth
npm run typecheck
npm run build
```

로컬 owner 생성:

```bash
npx supabase status
```

service-role을 브라우저에 넣지 않고 별도 관리 script 또는 Dashboard로 owner를
생성하고 `app_user_roles`에 role을 삽입한다. 로그인 후 access token의 `aal`이
MFA 전 `aal1`, 검증 후 `aal2`인지 확인한다.

- [ ] **Step 7: Task 6 커밋**

```bash
git add src/auth src/lib/supabase.ts src/App.tsx src/screens/OwnerLoginScreen.tsx src/lib/data.ts supabase/functions/_shared/database.types.ts
git commit -m "feat: require owner totp authentication"
```

---

### Task 7: owner API와 운영 화면 영속화

**Files:**
- Create: `supabase/functions/_shared/auth.ts`
- Create: `supabase/functions/owner-api/index.ts`
- Create: `supabase/functions/tests/owner-api.test.ts`
- Create: `src/owner/OwnerStoreProvider.tsx`
- Create: `src/owner/OwnerStoreProvider.test.tsx`
- Modify: `src/store.tsx`
- Modify: `src/screens/OwnerRewardScreen.tsx`
- Modify: `src/screens/OwnerCustomerManageScreen.tsx`
- Modify: `src/screens/OwnerDashboardScreen.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: owner auth helper와 실패 test 작성**

`auth.ts`가 bearer JWT로 `auth.getUser(token)`을 호출한 뒤 같은 JWT를 사용하는
user-scoped client로 `app_user_roles`를 SELECT한다. 이 SELECT는
`owner_read_roles` RLS 때문에 owner `aal2`에서만 행을 반환한다. private schema
함수를 Data API에 노출하지 않는다. test:

```ts
const { data: userData, error: userError } = await userClient.auth.getUser(token)
if (userError || !userData.user) throw new HttpError(401, 'UNAUTHORIZED')

const { data: role } = await userClient
  .from('app_user_roles')
  .select('role')
  .eq('user_id', userData.user.id)
  .eq('role', 'owner')
  .maybeSingle()
if (!role) throw new HttpError(403, 'OWNER_AAL2_REQUIRED')
```

- Authorization 없음 → `401`
- invalid JWT → `401`
- valid `aal1` → `403`
- non-owner `aal2` → `403`
- owner `aal2` → handler 진행

- [ ] **Step 2: owner API request schema 정의**

Zod discriminated contract:

```ts
const createCustomerSchema = z.object({
  action: z.literal('create_customer'),
  name: z.string().trim().min(1).max(80),
  phone: z.string().min(10).max(20),
})

const applyRewardSchema = z.object({
  action: z.literal('apply_reward'),
  customerId: z.string().uuid(),
  type: z.enum(['earn', 'use']),
  amount: z.number().int().positive().max(9_999_999),
  idempotencyKey: z.string().uuid(),
})

const updateStoreSchema = z.object({
  action: z.literal('update_store'),
  rewardRate: z.number().positive().max(1),
})
```

GET `/owner-api`는 bootstrap DTO를 반환한다.

```ts
interface OwnerBootstrap {
  customers: Array<{
    id: string
    name: string
    phoneE164: string
    points: number
    visits: number
    lastVisitedAt: string | null
  }>
  recentRewards: Array<{
    id: string
    customerId: string
    customerName: string
    type: 'earn' | 'use'
    amount: number
    pointsDelta: number
    balanceAfter: number
    createdAt: string
  }>
  store: {
    name: string
    tagline: string
    rewardRate: number
    rewardThreshold: number
    redeemUnit: number
  }
}
```

- [ ] **Step 3: owner-api 구현**

모든 request에서:

1. CORS allowlist
2. bearer token 검증
3. owner + `aal2` 검증
4. Zod validation
5. user-scoped Supabase client로 RLS query/RPC

`apply_reward`는 client 계산 포인트를 받지 않고 다음 RPC만 호출한다.

```ts
await client.rpc('apply_reward_transaction', {
  p_customer_id: input.customerId,
  p_type: input.type,
  p_amount: input.amount,
  p_idempotency_key: input.idempotencyKey,
})
```

Postgres `PT403`, `PT409`, `PT422`를 각각 HTTP `403`, `409`, `422`의 안정된 오류
코드로 변환한다. 내부 SQL message와 stack은 응답에 포함하지 않는다.

- [ ] **Step 4: owner Edge test**

mock auth/DB로 검증:

- bootstrap은 `aal2` owner에게만 반환
- create customer 전화번호 E.164 정규화와 duplicate `409`
- update store는 0 초과 1 이하 reward rate만 허용
- apply reward는 points/rate/final balance field를 입력으로 받지 않음
- 같은 idempotency key 재시도 결과 유지
- 예상하지 못한 DB 오류는 일반화된 `500`

Run:

```bash
npm run test:edge
```

Expected: lookup과 owner test 모두 PASS.

- [ ] **Step 5: OwnerStoreProvider의 실패 test 작성**

provider contract:

```ts
interface OwnerStoreValue {
  state: { status: 'loading' | 'ready' | 'error'; data?: OwnerBootstrap }
  refresh: () => Promise<void>
  addCustomer: (phone: string, name: string) => Promise<void>
  applyReward: (
    customerId: string,
    type: 'earn' | 'use',
    amount: number,
    idempotencyKey: string,
  ) => Promise<{ pointsDelta: number; balanceAfter: number }>
  updateRate: (rate: number) => Promise<void>
}
```

test: initial bootstrap, loading, retry, duplicate submit, API error, 성공 뒤 authoritative
refresh.

- [ ] **Step 6: owner 화면을 async provider로 전환**

`src/store.tsx`의 demo customers, overrides, local reward mutation을 제거하고
`OwnerStoreProvider`로 대체한다.

화면 변경:

- `OwnerRewardScreen`: `customer.id`와 `customer.phoneE164` 사용, 표시는
  `displayKoreanPhone()`, submit마다 `crypto.randomUUID()` 생성,
  응답 전 button 잠금, 성공 응답의 `pointsDelta/balanceAfter` 표시
- `OwnerCustomerManageScreen`: add API pending/error/duplicate 표시
- `OwnerDashboardScreen`: DB bootstrap KPI와 store config 사용
- 모든 화면: loading skeleton, retry, session expired 처리
- `App.tsx`: `state.status === 'ready'` 내부에만 `OwnerStoreProvider` mount

client가 계산한 `earn`은 미리보기 문구에만 사용하고 서버 응답을 확정값으로
표시한다.

- [ ] **Step 7: frontend owner test**

React Testing Library로 검증:

- bootstrap 전 고객 데이터 미표시
- 복수 뒷자리 검색
- 적립 submit 중 중복 클릭 차단
- `409` idempotency conflict와 `422` 잔액 부족 표시
- 성공 toast는 서버 확정 delta/balance 사용
- 신규 고객과 적립률 저장 후 refetch
- 로그아웃 시 owner provider data 제거

Run:

```bash
npm run test
npm run typecheck
npm run build
```

Expected: 모두 PASS.

- [ ] **Step 8: Task 7 커밋**

```bash
git add supabase/functions src/owner src/store.tsx src/screens src/App.tsx
git commit -m "feat: persist owner point operations"
```

---

### Task 8: owner 전용 private Realtime

**Files:**
- Create: `supabase/migrations/<timestamp>_owner_realtime.sql`
- Create: `supabase/tests/database/owner_realtime.test.sql`
- Create: `src/owner/useOwnerRealtime.ts`
- Create: `src/owner/useOwnerRealtime.test.ts`
- Modify: `src/owner/OwnerStoreProvider.tsx`

- [ ] **Step 1: 실패하는 Realtime authorization test 작성**

pgTAP으로 다음을 검증한다.

- anon은 `realtime.messages` owner topic SELECT/INSERT 거부
- non-owner `aal2` 거부
- owner `aal1` 거부
- owner `aal2`만 `store:1:owner` topic 허용

Run:

```bash
npx supabase test db supabase/tests/database/owner_realtime.test.sql
```

Expected: FAIL because policy/trigger does not exist.

- [ ] **Step 2: private Broadcast policy와 trigger 작성**

`owner_realtime.sql`:

```sql
alter table realtime.messages enable row level security;

create policy owner_receive_store_broadcast
on realtime.messages
for select
to authenticated
using (
  realtime.topic() = 'store:1:owner'
  and (select private.is_owner_aal2())
);

create or replace function private.broadcast_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'store:1:owner',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return coalesce(new, old);
end;
$$;

create trigger customers_owner_broadcast
after insert or update or delete on public.customers
for each row execute function private.broadcast_owner_change();

create trigger reward_log_owner_broadcast
after insert on public.reward_log
for each row execute function private.broadcast_owner_change();

create trigger store_config_owner_broadcast
after update on public.store_config
for each row execute function private.broadcast_owner_change();
```

payload는 UI 데이터 원본으로 사용하지 않는다.
production Supabase Realtime Settings에서 `Allow public access`를 끄고 private
authorization을 강제한다.

- [ ] **Step 3: React hook의 실패 test 작성**

fake channel로 다음을 검증한다.

- channel 생성 전 `supabase.realtime.setAuth()` 호출
- `private: true` channel 생성
- broadcast 수신을 150ms debounce해 `refresh()` 한 번 호출
- reconnect, `visibilitychange` visible, browser `online` 때 refresh
- unmount 때 channel remove
- signed out 상태에서는 subscribe하지 않음

- [ ] **Step 4: useOwnerRealtime 구현**

```ts
export function useOwnerRealtime(enabled: boolean, refresh: () => Promise<void>): void {
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let disposed = false
    let channel: ReturnType<typeof supabase.channel> | undefined
    const invalidate = () => {
      clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 150)
    }
    const start = async () => {
      await supabase.realtime.setAuth()
      if (disposed) return
      channel = supabase
        .channel('store:1:owner', { config: { private: true } })
        .on('broadcast', { event: '*' }, invalidate)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') void refresh()
        })
    }
    void start()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('online', invalidate)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      disposed = true
      clearTimeout(timer)
      window.removeEventListener('online', invalidate)
      document.removeEventListener('visibilitychange', onVisible)
      if (channel) void supabase.removeChannel(channel)
    }
  }, [enabled, refresh])
}
```

- [ ] **Step 5: Realtime 통합 검증과 커밋**

Run:

```bash
npx supabase db reset
npx supabase test db
npm run test -- src/owner
npm run typecheck
npm run build
```

두 브라우저에서 owner 로그인 후 한쪽 적립이 다른 쪽 화면의 authoritative refetch로
반영되는지 확인한다. 고객 `/`에는 Realtime websocket이 생기지 않아야 한다.

```bash
git add supabase/migrations supabase/tests/database/owner_realtime.test.sql src/owner
git commit -m "feat: add private owner realtime invalidation"
```

---

### Task 9: E2E, Vercel 보안 설정, CI, 문서

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/customer-balance.spec.ts`
- Create: `tests/e2e/owner-reward.spec.ts`
- Create: `vercel.json`
- Create: `.github/workflows/verify.yml`
- Modify: `README.md`
- Modify: `document/manual-test-guide.md`
- Modify: `document/progress.md`
- Modify: `docs/superpowers/specs/2026-06-29-web-production-baseline-design.md`

- [ ] **Step 1: Playwright 설정과 실패하는 E2E 작성**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

const externalBaseUrl = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: externalBaseUrl ?? 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --host 127.0.0.1',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
})
```

customer E2E:

- Cloudflare 공식 test key 사용
- 유효 번호 → 최소 잔액
- 미등록 번호 → 동일 empty state
- 이름/전화번호/내역 미노출
- rate-limit mock → retry 안내

owner E2E:

- CI 전용 owner 계정으로 password + TOTP
- `otpauth`의 `new OTPAuth.TOTP({ secret: process.env.E2E_OWNER_TOTP_SECRET })`
  로 실행 시점의 6자리 코드를 생성하며 secret은 test artifact에 기록하지 않음
- 고객 생성
- 적립 후 새로고침해 잔액 유지
- 같은 idempotency key 재전송해 한 건만 생성
- 같은 고객에게 10개의 서로 다른 idempotency key를 병렬 요청한 뒤
  `최종 잔액 = 시작 잔액 + reward_log delta 합계` 확인
- 사용 단위/잔액 부족 서버 오류
- 로그아웃 후 `/admin` 데이터 제거

- [ ] **Step 2: Vercel SPA와 보안 header 작성**

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com; img-src 'self' data:; style-src 'self'; font-src 'self' https://cdn.jsdelivr.net; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests" }
      ]
    }
  ]
}
```

production Supabase custom domain을 쓰면 `connect-src`를 그 exact origin으로 더
좁힌다. preview에서 `/admin` 직접 진입과 새로고침이 `index.html`로 rewrite되는지
검증한다.

- [ ] **Step 3: CI 작성**

`.github/workflows/verify.yml`:

```yaml
name: verify
on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - uses: supabase/setup-cli@v1
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - run: npm ci
      - run: npx supabase start
      - run: npx supabase db reset
      - run: npm run test:db
      - run: npm run test:edge
      - run: npm run test
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
```

E2E는 secret과 test owner가 준비된 protected staging job에서만 실행한다. PR fork에
production secret을 제공하지 않는다.

- [ ] **Step 4: staging 보안 검증**

Vercel preview + staging Supabase에서 확인:

```text
anon REST: customers/reward_log/store_config 직접 접근 거부
owner aal1: owner-api/RPC/RLS 거부
non-owner aal2: owner-api/RPC/RLS 거부
owner aal2: 허용
Turnstile 위조·만료·재사용: 거부
허용되지 않은 Origin: CORS header 없음
rate limit: IP/phone/global 각각 429
동시 적립·사용: 잔액과 원장 합계 일치
새로고침·다른 브라우저: 영속 상태 일치
로그: password, JWT, TOTP, 전체 전화번호, 잔액 없음
```

- [ ] **Step 5: 운영 문서 갱신**

`README.md`에 추가:

- 로컬 Supabase 시작/reset/test 명령
- 공개 env와 secret 위치 구분
- owner 최초 계정/TOTP 등록 절차
- 고객 최소 조회 제한
- Flutter/주문/알림 보류 상태

`manual-test-guide.md`에서 PIN/demo customer 상세 조회 절차를 production 절차와
구분하고, Stage 2 보안 검증 목록을 추가한다.

`progress.md`에서 완료한 phase와 실제 검증 결과만 체크한다.

설계 문서 status를 `Implemented`로 바꾸는 것은 production 검증까지 끝난 뒤에만
수행한다.

- [ ] **Step 6: 전체 검증**

Run:

```bash
npx supabase db reset
npm run test:db
npm run test:edge
npm run test
npm run lint
npm run typecheck
npm run build
E2E_BASE_URL=https://staging.example.com npm run test:e2e
git diff --check
```

Expected: 모든 명령 exit code 0. Playwright artifact에는 password, TOTP secret,
JWT, 전체 전화번호가 없어야 한다.

- [ ] **Step 7: 최종 보안 리뷰와 커밋**

검토 질문:

- 브라우저 bundle에 secret/service-role key가 없는가?
- anon table grant/policy가 없는가?
- owner 권한이 UI가 아니라 API/RLS/RPC에서 강제되는가?
- 포인트 확정값이 DB에서만 계산되는가?
- 고객 응답에 이름·내역·ID가 없는가?
- 로그와 analytics에 개인정보·인증정보가 없는가?
- 보류 기능의 코드·테이블·secret이 추가되지 않았는가?

```bash
git add playwright.config.ts tests/e2e vercel.json .github/workflows/verify.yml README.md document docs/superpowers/specs/2026-06-29-web-production-baseline-design.md
git commit -m "chore: verify stage 2 production readiness"
```

---

## 완료 조건

- [ ] 고객·사장님 React 웹 유지
- [ ] 고객은 Turnstile + 다중 rate limit 뒤 최소 잔액만 조회
- [ ] 고객 이름·전화번호·방문수·상세 내역·ID 미노출
- [ ] `anon`의 고객/원장 직접 DB 접근 거부
- [ ] owner 이메일·비밀번호 + 필수 TOTP `aal2`
- [ ] owner 역할과 `aal2`를 Edge/RLS/RPC 모두에서 검증
- [ ] 포인트 거래 원자성, 동시성, idempotency test 통과
- [ ] owner private Realtime은 invalidation에만 사용
- [ ] Vercel preview와 staging 보안 검증 통과
- [ ] DB, Edge, React, lint, typecheck, build, E2E 모두 PASS
- [ ] Flutter·주문·결제·고객 알림 관련 구현 없음
