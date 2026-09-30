-- 01-setup.sql : HEMM Shift Allocator (all data below is MADE UP)
-- Paste this whole block into the Supabase SQL Editor and press Run.
-- It is safe to run twice: it will not create duplicates.

-- 1. The one table. Each row is either a HEMM (machine) or an OPERATOR (person).
create table if not exists public.dispatch_records (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  record_type text not null check (record_type in ('HEMM', 'OPERATOR')),
  name        text not null,
  skill_group text not null check (skill_group in ('Excavator', 'Dumper', 'Grader/Sprinkler')),
  -- Machine details (only for HEMM rows)
  hemm_type   text check (hemm_type in ('Excavator', 'Dumper', 'Motor Grader', 'Water Sprinkler')),
  make_model  text,
  serial_no   text,
  -- Operator details (only for OPERATOR rows)
  home_shift  text check (home_shift in ('A', 'B', 'C')),
  attendance  text check (attendance in ('Not marked', 'Present', 'Absent', 'Overtime')),
  duty_date   date,
  duty_shift  text check (duty_shift in ('A', 'B', 'C')),
  -- Common columns
  location    text not null,
  urgency     text not null default 'Low'  check (urgency in ('Low', 'Medium', 'High')),
  status      text not null default 'Open' check (status in ('Open', 'In progress', 'Resolved')),
  remarks     text
);

-- One record per name and type, so running this file again adds nothing twice.
create unique index if not exists dispatch_records_type_name_key
  on public.dispatch_records (record_type, name);

-- 2. Security: everyone with the link can read, add and change. Nobody can delete.
alter table public.dispatch_records enable row level security;

grant select, insert, update on public.dispatch_records to anon, authenticated;

drop policy if exists "dispatch_select" on public.dispatch_records;
drop policy if exists "dispatch_insert" on public.dispatch_records;
drop policy if exists "dispatch_update" on public.dispatch_records;

create policy "dispatch_select" on public.dispatch_records
  for select to anon, authenticated using (true);
create policy "dispatch_insert" on public.dispatch_records
  for insert to anon, authenticated with check (true);
create policy "dispatch_update" on public.dispatch_records
  for update to anon, authenticated using (true) with check (true);

-- 3. The 11 machines. status: Resolved = OK (fit), In progress = under repair, Open = breakdown.
insert into public.dispatch_records
  (record_type, name, skill_group, hemm_type, make_model, serial_no, location, urgency, status)
values
  ('HEMM', 'Excavator 1',       'Excavator',        'Excavator',      'Tata Hitachi 1200', '1',        'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Excavator 2',       'Excavator',        'Excavator',      'Tata Hitachi 1200', '2',        'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Dumper 60019',      'Dumper',           'Dumper',         'BEML BH60M',        '60019',    'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Dumper 60020',      'Dumper',           'Dumper',         'BEML BH60M',        '60020',    'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Dumper 60459',      'Dumper',           'Dumper',         'BEML BH60M',        '60459',    'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Dumper 60450',      'Dumper',           'Dumper',         'BEML BH60M',        '60450',    'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Dumper 60998',      'Dumper',           'Dumper',         'BEML BH60M',        '60998',    'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Dumper 60999',      'Dumper',           'Dumper',         'BEML BH60M',        '60999',    'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Motor Grader 21156','Grader/Sprinkler', 'Motor Grader',   'BG825',             '21156',    'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Water Sprinkler 28358','Grader/Sprinkler','Water Sprinkler','BEML WS28-2',     '28358',    'Parking yard', 'Low', 'Resolved'),
  ('HEMM', 'Water Sprinkler 28386','Grader/Sprinkler','Water Sprinkler','BEML WS28-2',     '28386',    'Parking yard', 'Low', 'Resolved')
on conflict (record_type, name) do nothing;

-- 4. The 21 operators (made-up names). Per shift: 1 excavator, 4 dumper, 2 grader/sprinkler.
insert into public.dispatch_records
  (record_type, name, skill_group, home_shift, attendance, location, urgency, status)
values
  -- Shift A
  ('OPERATOR', 'Rajesh Kumar Sahu', 'Excavator',        'A', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Suresh Behera',     'Dumper',           'A', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Manoj Patra',       'Dumper',           'A', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Dinesh Meher',      'Dumper',           'A', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Anil Pradhan',      'Dumper',           'A', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Prakash Nayak',     'Grader/Sprinkler', 'A', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Bikash Mohanty',    'Grader/Sprinkler', 'A', 'Not marked', 'Mine site', 'Low', 'Open'),
  -- Shift B
  ('OPERATOR', 'Sanjay Mishra',     'Excavator',        'B', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Vijay Singh',       'Dumper',           'B', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Ashok Tirkey',      'Dumper',           'B', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Deepak Sethi',      'Dumper',           'B', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Ramakant Panda',    'Dumper',           'B', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Kishore Dash',      'Grader/Sprinkler', 'B', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Hari Oram',         'Grader/Sprinkler', 'B', 'Not marked', 'Mine site', 'Low', 'Open'),
  -- Shift C
  ('OPERATOR', 'Mahesh Yadav',      'Excavator',        'C', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Gopal Sahoo',       'Dumper',           'C', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Sunil Kerketta',    'Dumper',           'C', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Ravi Bag',          'Dumper',           'C', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Bhaskar Mahapatra', 'Dumper',           'C', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Pramod Jena',       'Grader/Sprinkler', 'C', 'Not marked', 'Mine site', 'Low', 'Open'),
  ('OPERATOR', 'Tapan Nag',         'Grader/Sprinkler', 'C', 'Not marked', 'Mine site', 'Low', 'Open')
on conflict (record_type, name) do nothing;
