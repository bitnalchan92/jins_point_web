begin;
create extension if not exists pgtap with schema extensions;

-- ---------------------------------------------------------------------------
-- Fixtures (created as the privileged test role, before any auth context).
--   * owner user with an app_user_roles 'owner' row
--   * a second user that is NOT an owner
--   * customer ...0001 starts at 0 points so a 5% earn of 10,000 lands on 500
--   * customer ...0002 holds 3,000 points for the redeem (use) cases
-- store_config (id=1, reward_rate 0.05, reward_threshold 5000, redeem_unit 1000)
-- comes from supabase/seed.sql, applied by `supabase db reset`.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'nonowner@test.local');

insert into public.app_user_roles (user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner');

insert into public.customers (id, name, phone_e164, points, visit_count) values
  ('00000000-0000-0000-0000-000000000001', '테스트영', '+821000000001', 0, 0),
  ('00000000-0000-0000-0000-000000000002', '테스트삼천', '+821000000002', 3000, 0);

select plan(9);

-- ===========================================================================
-- Auth context is simulated purely through the `request.jwt.claims` GUC, which
-- is what auth.uid() (sub) and auth.jwt()->>'aal' read. Both the RPC and
-- private.is_owner_aal2() are SECURITY DEFINER, so the caller role is
-- irrelevant; only the claims (and the app_user_roles row) decide the outcome.
-- ===========================================================================

-- --- No auth context (auth.uid() is null) -> PT403 ------------------------- (E1)
select throws_ok(
  $$ select * from public.apply_reward_transaction(
       '00000000-0000-0000-0000-000000000001', 'earn', 10000,
       '10000000-0000-0000-0000-000000000001'
     ) $$,
  'PT403', 'owner aal2 required',
  'no auth context is rejected with PT403'
);

-- --- Owner identity but only aal1 -> PT403 -------------------------------- (L1)
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok(
  $$ select * from public.apply_reward_transaction(
       '00000000-0000-0000-0000-000000000001', 'earn', 10000,
       '10000000-0000-0000-0000-000000000003'
     ) $$,
  'PT403', 'owner aal2 required',
  'owner with only aal1 is rejected with PT403'
);

-- --- Non-owner with aal2 -> PT403 ---------------------------------------- (L2)
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}';
select throws_ok(
  $$ select * from public.apply_reward_transaction(
       '00000000-0000-0000-0000-000000000001', 'earn', 10000,
       '10000000-0000-0000-0000-000000000004'
     ) $$,
  'PT403', 'owner aal2 required',
  'non-owner with aal2 is rejected with PT403'
);

-- --- Owner + aal2 from here on ------------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}';

-- --- 10,000 KRW at 5% earns 500 points ----------------------------------- (E2)
select results_eq(
  $$ select points_delta, balance_after
       from public.apply_reward_transaction(
         '00000000-0000-0000-0000-000000000001', 'earn', 10000,
         '10000000-0000-0000-0000-000000000002'
       ) $$,
  $$ values (500, 500) $$,
  '10,000 KRW at 5 percent earns 500 points'
);

-- --- That earn wrote exactly one ledger row ------------------------------ (E3)
select results_eq(
  $$ select count(*)::bigint from public.reward_log
       where idempotency_key = '10000000-0000-0000-0000-000000000002' $$,
  $$ values (1::bigint) $$,
  'same idempotency key creates one ledger row'
);

-- --- Replay: same key + same request -> same result, no new row ---------- (L5)
select results_eq(
  $$ select points_delta, balance_after
       from public.apply_reward_transaction(
         '00000000-0000-0000-0000-000000000001', 'earn', 10000,
         '10000000-0000-0000-0000-000000000002'
       ) $$,
  $$ values (500, 500) $$,
  'replaying the same idempotency key returns the same result'
);

-- --- Same key + different request -> PT409 ------------------------------- (L6)
select throws_ok(
  $$ select * from public.apply_reward_transaction(
       '00000000-0000-0000-0000-000000000001', 'earn', 20000,
       '10000000-0000-0000-0000-000000000002'
     ) $$,
  'PT409', 'idempotency conflict',
  'reusing a key with a different request is rejected with PT409'
);

-- --- Insufficient balance (3,000 held, 4,000 redeemed) -> PT422 ---------- (L3)
select throws_ok(
  $$ select * from public.apply_reward_transaction(
       '00000000-0000-0000-0000-000000000002', 'use', 4000,
       '10000000-0000-0000-0000-000000000005'
     ) $$,
  'PT422', 'insufficient balance',
  'redeeming more than the balance is rejected with PT422'
);

-- --- Redeem not a multiple of redeem_unit (1,000) -> PT422 --------------- (L4)
select throws_ok(
  $$ select * from public.apply_reward_transaction(
       '00000000-0000-0000-0000-000000000002', 'use', 1500,
       '10000000-0000-0000-0000-000000000006'
     ) $$,
  'PT422', 'invalid redeem unit',
  'redeeming a non-1000P-unit amount is rejected with PT422'
);

select * from finish();
rollback;
