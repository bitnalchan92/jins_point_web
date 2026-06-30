-- Owner-only private Realtime invalidation.
--
-- The owner UI never trusts a broadcast payload as data; a broadcast is purely a
-- signal that triggers an authoritative server refetch. Authorization is private:
-- only an authenticated owner at aal2, subscribed to the exact `store:1:owner`
-- topic, may SELECT from realtime.messages. AFTER triggers on the owner-owned
-- tables emit a broadcast on every write so any other owner session refetches.
--
-- realtime.messages already has RLS enabled and SELECT granted to authenticated
-- by the realtime extension; the policy below is what restricts visibility.
-- In production Supabase Realtime Settings, disable "Allow public access" so this
-- private authorization is enforced for socket subscriptions too.

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
