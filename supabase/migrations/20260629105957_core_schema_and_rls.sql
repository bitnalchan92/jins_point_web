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
