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
