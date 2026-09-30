-- 06-set-login-roles.sql
-- Tells the tool which login is the Mine Manager and which is the Maintenance Engineer.
-- Do this AFTER creating the two users in Supabase: Authentication > Users > Add user
-- (give each an email and a password, and tick "Auto Confirm User").
--
-- BEFORE YOU RUN: replace the two example emails below with the real emails of the two users.
-- Both users must log out and log in again after this.
--
-- Also confirms the two emails. If you forgot to tick "Auto Confirm User", the website says
-- "Email not confirmed" and the login is refused until this is done.
update auth.users
   set email_confirmed_at = coalesce(email_confirmed_at, now())
 where email in ('manager@example.com', 'engineer@example.com');

update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "manager"}'::jsonb
 where email = 'manager@example.com';

update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "engineer"}'::jsonb
 where email = 'engineer@example.com';

-- Check: this should show your two emails with the roles manager and engineer, and confirmed = true.
select email, raw_app_meta_data ->> 'role' as role, email_confirmed_at is not null as confirmed from auth.users order by email;
