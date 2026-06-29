begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_table('public', 'customers', 'customers table exists');
select has_table('public', 'reward_log', 'reward_log table exists');
select has_table('public', 'store_config', 'store_config table exists');
select has_table('public', 'app_user_roles', 'app_user_roles table exists');
select col_is_unique('public', 'customers', 'phone_e164', 'customers.phone_e164 is unique');
select col_has_check('public', 'customers', 'points', 'customers.points has check');
select policies_are('public', 'customers', array['owner_all_customers']);
select policies_are('public', 'reward_log', array['owner_all_reward_log']);
select policies_are('public', 'store_config', array['owner_all_store_config']);
select policies_are('public', 'app_user_roles', array['owner_read_roles']);
select table_privs_are('public', 'customers', 'anon', array[]::text[]);
select table_privs_are('public', 'reward_log', 'anon', array[]::text[]);

select * from finish();
rollback;
