-- 02-add-expected-ok-time.sql
-- One small change: a new column so the Maintenance Engineer can say
-- when a machine is expected to be OK again.
-- Paste into the Supabase SQL Editor and press Run. Safe to run twice.
alter table public.dispatch_records
  add column if not exists expected_ok_at timestamptz;
