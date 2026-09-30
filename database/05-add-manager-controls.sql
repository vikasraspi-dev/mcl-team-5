-- 05-add-manager-controls.sql
-- One small change: two new columns so the Mine Manager can plan ahead, day by day.
--   absent_dates : days the Mine Manager marked an operator as absent
--   ot_calls     : overtime calls made in advance, for example {"2026-10-05": "B"}
--                  means "called for overtime in Shift B on 5 Oct 2026"
-- Paste into the Supabase SQL Editor and press Run. Safe to run twice.
alter table public.dispatch_records
  add column if not exists absent_dates date[] not null default '{}',
  add column if not exists ot_calls jsonb not null default '{}'::jsonb;
