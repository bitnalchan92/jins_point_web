begin;
create extension if not exists pgtap with schema extensions;

-- ---------------------------------------------------------------------------
-- Owner-only private Realtime authorization.
--
-- This suite proves the private Broadcast contract on BOTH levels:
--
--   * Structural — RLS is enabled on realtime.messages, the SELECT policy
--     carries the exact `topic = 'store:1:owner' AND is_owner_aal2()` predicate
--     for the authenticated role, the broadcast trigger function exists, and the
--     three AFTER triggers are wired onto customers / reward_log / store_config.
--
--   * Behavioral — the predicate is driven through the real RLS engine. A
--     broadcast row is materialised on the owner topic, then SELECT visibility
--     is asserted as the `authenticated` role under four rejected identities
--     (anon, owner-aal1, non-owner-aal2, owner-aal2 on the WRONG topic) and the
--     one accepted identity (owner-aal2 on the owner topic). The trigger itself
--     is exercised end to end: an owner-side customer insert must land a real
--     broadcast row on store:1:owner.
--
-- realtime.topic() reads the `realtime.topic` GUC (the value the realtime server
-- sets per subscription); we set it with `set local realtime.topic = ...`, which
-- is exactly what the policy reads at evaluation time. auth.uid()/auth.jwt()
-- read request.jwt.claims. private.is_owner_aal2() is SECURITY DEFINER, so it is
-- callable by the authenticated role under these simulated claims.
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner@test.local'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'nonowner@test.local');

insert into public.app_user_roles (user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'owner');

-- `supabase db reset` seeds two demo customers, whose inserts already fired the
-- broadcast trigger and left rows in realtime.messages. Clear them inside this
-- rolled-back transaction so the behavioral assertions below count only the row
-- this test materialises.
delete from realtime.messages;

select plan(14);

-- === Structural ===========================================================

-- RLS must be enabled on realtime.messages so the policy is enforced.
select is(
  (select relrowsecurity from pg_class where oid = 'realtime.messages'::regclass),
  true,
  'row level security is enabled on realtime.messages'
);

-- The SELECT policy must carry the exact owner+topic predicate.
select is(
  (select qual from pg_policies
     where schemaname = 'realtime' and tablename = 'messages'
       and policyname = 'owner_receive_store_broadcast'),
  '((realtime.topic() = ''store:1:owner''::text) AND ( SELECT private.is_owner_aal2() AS is_owner_aal2))',
  'owner_receive_store_broadcast USING matches topic = store:1:owner AND is_owner_aal2()'
);

select is(
  (select cmd from pg_policies
     where schemaname = 'realtime' and tablename = 'messages'
       and policyname = 'owner_receive_store_broadcast'),
  'SELECT',
  'owner_receive_store_broadcast is a SELECT policy'
);

select is(
  (select roles::text from pg_policies
     where schemaname = 'realtime' and tablename = 'messages'
       and policyname = 'owner_receive_store_broadcast'),
  '{authenticated}',
  'owner_receive_store_broadcast applies to the authenticated role'
);

select has_function(
  'private', 'broadcast_owner_change',
  'private.broadcast_owner_change() broadcast trigger function exists'
);

select has_trigger(
  'public', 'customers', 'customers_owner_broadcast',
  'customers carries the owner broadcast trigger'
);

select has_trigger(
  'public', 'reward_log', 'reward_log_owner_broadcast',
  'reward_log carries the owner broadcast trigger'
);

select has_trigger(
  'public', 'store_config', 'store_config_owner_broadcast',
  'store_config carries the owner broadcast trigger'
);

-- === Behavioral: trigger materialises a broadcast row =====================

-- An owner-side write must produce exactly one broadcast row on the owner topic.
-- (Run as the privileged test role, which bypasses public RLS; the trigger fn is
-- SECURITY DEFINER so realtime.broadcast_changes succeeds.)
insert into public.customers (id, name, phone_e164, points, visit_count) values
  ('00000000-0000-0000-0000-000000000001', '테스트영', '+821000000001', 0, 0);

select is(
  (select count(*) from realtime.messages
     where topic = 'store:1:owner' and extension = 'broadcast' and event = 'INSERT'),
  1::bigint,
  'an owner-side customer insert broadcasts one row on store:1:owner'
);

-- === Behavioral: RLS visibility through the real engine ===================
-- From here the broadcast row above is the fixture whose visibility we probe as
-- the authenticated role under each identity.

set local role authenticated;

-- anon (no owner claims, anon role would see nothing) -----------------------
set local request.jwt.claims = '{"role":"anon"}';
set local realtime.topic = 'store:1:owner';
select is(
  (select count(*) from realtime.messages where topic = 'store:1:owner'),
  0::bigint,
  'a request without owner aal2 claims sees no owner broadcast'
);

-- owner identity but only aal1 ---------------------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}';
select is(
  (select count(*) from realtime.messages where topic = 'store:1:owner'),
  0::bigint,
  'owner with only aal1 sees no owner broadcast'
);

-- non-owner with aal2 -------------------------------------------------------
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}';
select is(
  (select count(*) from realtime.messages where topic = 'store:1:owner'),
  0::bigint,
  'non-owner with aal2 sees no owner broadcast'
);

-- owner + aal2 but reading the WRONG topic ----------------------------------
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}';
set local realtime.topic = 'store:1:not-owner';
select is(
  (select count(*) from realtime.messages where topic = 'store:1:owner'),
  0::bigint,
  'owner aal2 subscribed to a different topic sees no owner broadcast'
);

-- owner + aal2 on the owner topic -> the one accepted identity --------------
set local realtime.topic = 'store:1:owner';
select is(
  (select count(*) from realtime.messages where topic = 'store:1:owner'),
  1::bigint,
  'owner aal2 on store:1:owner receives the broadcast'
);

reset role;

select * from finish();
rollback;
