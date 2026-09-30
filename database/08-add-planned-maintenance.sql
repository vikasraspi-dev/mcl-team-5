-- 08-add-planned-maintenance.sql (all values below are MADE UP)
-- One small change: four new columns so the Maintenance Engineer can plan future maintenance of a machine.
--   maint_task  : what work (for example "500-hour service")
--   maint_start : when the machine goes out of service
--   maint_hours : how many hours it stays out
--   maint_due   : the latest safe start (a later start adds breakdown risk). Optional.
-- Also fills a few made-up plans (only for machines that have no plan yet), so the dashboard has something to show.
-- Paste into the Supabase SQL Editor and press Run. Safe to run twice.
alter table public.dispatch_records
  add column if not exists maint_task text,
  add column if not exists maint_start timestamptz,
  add column if not exists maint_hours numeric(5,1) check (maint_hours > 0),
  add column if not exists maint_due timestamptz;

update public.dispatch_records d
   set maint_task  = v.task,
       maint_start = date_trunc('day', now()) + (v.d * interval '1 day') + (v.h * interval '1 hour'),
       maint_hours = v.hrs,
       maint_due   = date_trunc('day', now()) + (v.due * interval '1 day') + (v.h * interval '1 hour')
  from (values
    ('Dumper 60450',          '500-hour service',       4, 6, 12.0,  9),
    ('Dumper 60998',          'Tyres and brakes',       2, 22, 8.0,  6),
    ('Excavator 2',           'Routine service (250 h)', 7, 14, 16.0, 12),
    ('Excavator 1',           '500-hour service',       7, 22, 14.0, 11),
    ('Motor Grader 21156',    'Routine service (250 h)', 10, 6, 8.0,  14),
    ('Water Sprinkler 28358', 'Routine service (250 h)', 15, 6, 6.0,  20)
  ) as v(name, task, d, h, hrs, due)
 where d.record_type = 'HEMM' and d.name = v.name and d.maint_start is null;
