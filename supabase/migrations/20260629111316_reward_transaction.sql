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
