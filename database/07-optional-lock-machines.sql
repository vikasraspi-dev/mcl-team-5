-- 07-optional-lock-machines.sql   (OPTIONAL)
-- Without this file, the login only hides the manager and engineer screens.
-- With this file, the database itself refuses:
--   * any change to a machine (HEMM) unless the Maintenance Engineer is logged in, and
--   * any change to absences or overtime calls unless the Mine Manager is logged in.
-- Operators can still apply for leave and show overtime interest without logging in.
-- Run 06-set-login-roles.sql FIRST. Changes made in the SQL Editor are not blocked.
--
-- To switch this off again, run this one line:
--   drop trigger if exists guard_dispatch_update on public.dispatch_records;
create or replace function public.guard_dispatch_update()
returns trigger
language plpgsql
as $$
declare
  who text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
begin
  -- Only requests from the website (roles anon / authenticated) are checked.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if old.record_type = 'HEMM' and who <> 'engineer' then
    raise exception 'Only the logged-in Maintenance Engineer can change machines.';
  end if;

  if old.record_type = 'OPERATOR' and who <> 'manager'
     and (new.absent_dates is distinct from old.absent_dates
          or new.ot_calls is distinct from old.ot_calls) then
    raise exception 'Only the logged-in Mine Manager can change absences and overtime calls.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_dispatch_update on public.dispatch_records;
create trigger guard_dispatch_update
  before update on public.dispatch_records
  for each row execute function public.guard_dispatch_update();
