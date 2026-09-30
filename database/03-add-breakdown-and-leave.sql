-- 03-add-breakdown-and-leave.sql (all values below are MADE UP)
-- One small change: three new columns.
--   breakdown_prob : chance (in %) that a machine breaks down in a shift (HEMM rows)
--   weekly_off     : weekly rest day of an operator, 0 = Sunday ... 6 = Saturday
--   leave_dates    : days an operator marked in advance as "I will not be present"
-- Paste into the Supabase SQL Editor and press Run. Safe to run twice.
alter table public.dispatch_records
  add column if not exists breakdown_prob numeric(5,2) check (breakdown_prob between 0 and 100),
  add column if not exists weekly_off smallint check (weekly_off between 0 and 6),
  add column if not exists leave_dates date[] not null default '{}';

-- Made-up starting values. Only fills empty cells, so it never overwrites later edits.
update public.dispatch_records d
   set breakdown_prob = v.p
  from (values
    ('Excavator 1', 4.0), ('Excavator 2', 5.0),
    ('Dumper 60019', 8.0), ('Dumper 60020', 10.0), ('Dumper 60459', 12.0),
    ('Dumper 60450', 9.0), ('Dumper 60998', 15.0), ('Dumper 60999', 7.0),
    ('Motor Grader 21156', 6.0),
    ('Water Sprinkler 28358', 5.0), ('Water Sprinkler 28386', 8.0)
  ) as v(name, p)
 where d.record_type = 'HEMM' and d.name = v.name and d.breakdown_prob is null;

update public.dispatch_records d
   set weekly_off = v.day
  from (values
    ('Rajesh Kumar Sahu', 0), ('Suresh Behera', 1), ('Manoj Patra', 2), ('Dinesh Meher', 3),
    ('Anil Pradhan', 4), ('Prakash Nayak', 5), ('Bikash Mohanty', 6),
    ('Sanjay Mishra', 1), ('Vijay Singh', 2), ('Ashok Tirkey', 3), ('Deepak Sethi', 4),
    ('Ramakant Panda', 5), ('Kishore Dash', 6), ('Hari Oram', 0),
    ('Mahesh Yadav', 2), ('Gopal Sahoo', 3), ('Sunil Kerketta', 4), ('Ravi Bag', 5),
    ('Bhaskar Mahapatra', 6), ('Pramod Jena', 0), ('Tapan Nag', 1)
  ) as v(name, day)
 where d.record_type = 'OPERATOR' and d.name = v.name and d.weekly_off is null;
