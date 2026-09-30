-- 06-set-login-roles.sql
-- Tells the tool which login is the Mine Manager and which is the Maintenance Engineer.
-- Do this AFTER creating the two users in Supabase: Authentication > Users > Add user
-- (give each an email and a password, and tick "Auto Confirm User").
--
-- BEFORE YOU RUN: replace the two example emails below with the real emails of the two users.
-- Both users must log out and log in again after this.
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "manager"}'::jsonb
 where email = 'manager@example.com';

update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "engineer"}'::jsonb
 where email = 'engineer@example.com';

-- Check: this should show your two emails with the roles manager and engineer.
select email, raw_app_meta_data ->> 'role' as role from auth.users order by email;
