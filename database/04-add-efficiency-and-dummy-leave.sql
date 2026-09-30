-- 04-add-efficiency-and-dummy-leave.sql (all values below are MADE UP)
-- One small change: a new column "efficiency" (percent of the standard 48 trips per shift that an
-- operator achieves), plus made-up efficiency and made-up leave days for the 21 operators.
-- The leave days are counted from today, so they fall in the next 30 days.
-- Paste into the Supabase SQL Editor and press Run. Safe to run twice.
alter table public.dispatch_records
  add column if not exists efficiency numeric(5,2) check (efficiency between 0 and 100);

-- Efficiency: only fills empty cells, so later edits are never overwritten.
update public.dispatch_records d
   set efficiency = v.e
  from (values
    ('Rajesh Kumar Sahu', 92, 2, 12, null),
    ('Suresh Behera', 88, 5, 17, 24),
    ('Manoj Patra', 95, 8, 13, null),
    ('Dinesh Meher', 79, 2, 18, null),
    ('Anil Pradhan', 84, 5, 14, null),
    ('Prakash Nayak', 90, 8, 19, 25),
    ('Bikash Mohanty', 76, 2, 15, null),
    ('Sanjay Mishra', 86, 5, 20, null),
    ('Vijay Singh', 94, 8, 16, null),
    ('Ashok Tirkey', 81, 2, 12, 26),
    ('Deepak Sethi', 89, 5, 17, null),
    ('Ramakant Panda', 73, 8, 13, null),
    ('Kishore Dash', 91, 2, 18, null),
    ('Hari Oram', 85, 5, 14, 27),
    ('Mahesh Yadav', 97, 8, 19, null),
    ('Gopal Sahoo', 83, 2, 15, null),
    ('Sunil Kerketta', 78, 5, 20, null),
    ('Ravi Bag', 93, 8, 16, 28),
    ('Bhaskar Mahapatra', 87, 2, 12, null),
    ('Pramod Jena', 80, 5, 17, null),
    ('Tapan Nag', 75, 8, 13, null)
  ) as v(name, e, a, b, c)
 where d.record_type = 'OPERATOR' and d.name = v.name and d.efficiency is null;

-- Dummy leave: only for operators who have no leave marked yet.
-- a, b, c = days from today (c is empty for most operators).
update public.dispatch_records d
   set leave_dates = array_remove(array[current_date + v.a, current_date + v.b, current_date + v.c], null)
  from (values
    ('Rajesh Kumar Sahu', 92, 2, 12, null),
    ('Suresh Behera', 88, 5, 17, 24),
    ('Manoj Patra', 95, 8, 13, null),
    ('Dinesh Meher', 79, 2, 18, null),
    ('Anil Pradhan', 84, 5, 14, null),
    ('Prakash Nayak', 90, 8, 19, 25),
    ('Bikash Mohanty', 76, 2, 15, null),
    ('Sanjay Mishra', 86, 5, 20, null),
    ('Vijay Singh', 94, 8, 16, null),
    ('Ashok Tirkey', 81, 2, 12, 26),
    ('Deepak Sethi', 89, 5, 17, null),
    ('Ramakant Panda', 73, 8, 13, null),
    ('Kishore Dash', 91, 2, 18, null),
    ('Hari Oram', 85, 5, 14, 27),
    ('Mahesh Yadav', 97, 8, 19, null),
    ('Gopal Sahoo', 83, 2, 15, null),
    ('Sunil Kerketta', 78, 5, 20, null),
    ('Ravi Bag', 93, 8, 16, 28),
    ('Bhaskar Mahapatra', 87, 2, 12, null),
    ('Pramod Jena', 80, 5, 17, null),
    ('Tapan Nag', 75, 8, 13, null)
  ) as v(name, e, a, b, c)
 where d.record_type = 'OPERATOR' and d.name = v.name and d.leave_dates = '{}';
