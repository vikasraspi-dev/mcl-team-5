# CLAUDE.md - read this first, in every session

## About us
- We are a team of 4-5 people from Mahanadi Coalfields Limited (MCL) at an
  IIM Sambalpur MDP. We are NOT programmers.
- Explain everything in plain English, in short sentences. If you must use a
  technical word, explain it in one line.
- We build ONE small web tool in phases. Only one Claude session works at a
  time. The Progress Log at the end of this file is our handover logbook.

## What we are building
- A tool with at most 3 pages: index.html (entry page, which is now the
  dashboard), work.html (My Work) and login.html (login).
- Every record has location, urgency (Low / Medium / High) and status
  (Open / In progress / Resolved), plus the columns in "Our tool" below.
- All data is MADE UP. Never add real names, phone numbers, employee IDs or
  real MCL figures.

## Technical rules
1. Plain HTML, CSS and JavaScript only. Pages stay in the top folder; SQL
   files go in the database folder. No frameworks, no npm, no package.json,
   no build step.
2. Vercel publishes the site from the main branch. Use relative links only,
   e.g. href="dashboard.html".
3. Load Supabase from the jsDelivr CDN, then our settings, in this order:
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="config.js"></script>
   Then create the client like this (do not call the variable "supabase"):
     const db = window.supabase.createClient(window.SUPABASE_URL,
                                              window.SUPABASE_PUBLISHABLE_KEY);
4. The Project URL and the publishable key live only in config.js. Never use
   or ask for a secret key, a service_role key or the database password.
5. For charts, load Chart.js from the jsDelivr CDN.
6. Login: the Mine Manager and the Maintenance Engineer log in with email and
   password (Supabase Auth, publishable key only, on login.html). The team asked
   for this. Operators pick their name and need no password. Anyone can look at
   the dashboard. There is no sign-up: the Data Keeper creates the two logins.
7. You may not be able to reach our database. Do NOT try to test the database
   connection. Write the code; we test it on the live website.
8. If anything fails, show a friendly message on the page that also includes
   the actual error text, so we can pass it on.
9. Every page must work well on a mobile phone: large buttons, readable text,
   no sideways scrolling. Use the same header and menu on every page.
10. Never delete config.js or CLAUDE.md.

## Database rules
- Our Data Keeper runs all SQL by pasting it into the Supabase SQL Editor.
  You cannot run SQL yourself.
- Give SQL as ONE block that runs in one go. Also save it in the database
  folder: 01-setup.sql, then 02-..., 03-... for later changes.
- One table. It must have: id uuid primary key default gen_random_uuid()
  and created_at timestamptz not null default now().
- Enable Row Level Security. Add policies that let the roles anon and
  authenticated SELECT, INSERT and UPDATE. No delete.
- Always include: grant select, insert, update on the table to anon,
  authenticated; (new Supabase projects need it, or the website gets
  "permission denied").
- Never drop a table or delete rows.
- Avoid changing the table after Phase 1. If a change is really needed, give
  one small block and explain it in one sentence.

## How to work with us
- Make one change at a time. Do not change parts that already work unless we
  ask.
- After each change, reply in 3 short bullets: what you changed and what we
  should test on the live website.
- Commit and push your work at every stopping point.

## Takeover and handover
- At the START of every session: read the Progress Log below and summarize it
  in 3 bullets (what exists, what works, what is next).
- At a "save point": add a new entry at the end of the Progress Log (phase,
  builder, what was built, what works, known problems, next step). Then
  commit and push.

## Our tool (filled in during Phase 1)
- Team: MCL Team 5 (IIM Sambalpur MDP)
- Tool name: HEMM Shift Allocator
- Problem: Matching HEMMs (heavy machines) with operators shift by shift is done by hand. The tool does it automatically from the engineer's and operators' inputs.
- Who records / who decides: Maintenance Engineer marks each HEMM OK / under repair / breakdown. Operators mark Present / Absent, or raise Overtime interest for another shift. Mine Manager manages the operators: marks an operator absent or present for any date and calls operators for overtime in advance. Operators show overtime interest, apply for leave on a calendar and see their duty.
- Roles: Mine Manager and Maintenance Engineer log in on login.html (the role of a login is stored in the account, set by database/06-set-login-roles.sql).
  Operators pick their name on login.html. work.html sends anyone who is not properly logged in back to login.html.
  Optional database/07-optional-lock-machines.sql makes the database itself refuse machine changes from anyone but the logged-in engineer,
  and absence / overtime-call changes from anyone but the logged-in manager.
- Table name and columns: dispatch_records (one table; rows are either HEMM or OPERATOR).
  Columns: id, created_at, updated_at, record_type (HEMM/OPERATOR), name, skill_group (Excavator/Dumper/Grader-Sprinkler),
  hemm_type, make_model, serial_no (HEMM only), home_shift, attendance (Not marked/Present/Absent/Overtime),
  duty_date, duty_shift (operator only), expected_ok_at (HEMM only, added by database/02-add-expected-ok-time.sql),
  maint_task, maint_start, maint_hours, maint_due (HEMM only, planned future maintenance; added by database/08-add-planned-maintenance.sql),
  breakdown_prob (HEMM only, % chance of breakdown per shift), weekly_off (operator only, 0=Sunday..6=Saturday), leave_dates (operator only, days marked in advance as not present; all three added by database/03-add-breakdown-and-leave.sql),
  efficiency (operator only, % of the standard trips per shift; added by database/04-add-efficiency-and-dummy-leave.sql),
  absent_dates (operator only, days the Mine Manager marked absent) and ot_calls (operator only, overtime calls as {"date": "shift"}; both added by database/05-add-manager-controls.sql), location, urgency (Low/Medium/High), status (Open/In progress/Resolved), remarks.
  Meaning of status for a HEMM: Resolved = OK (fit), In progress = under repair, Open = breakdown.
  For an operator: Open = not answered, Resolved = answered Present/Absent, In progress = overtime interest raised.
- Fleet (made up data): 2 Tata Hitachi 1200 excavators (sl. 1, 2); 6 BEML BH60M dumpers (60019, 60020, 60459, 60450, 60998, 60999);
  1 motor grader BG825 (21156); 2 BEML WS28-2 water sprinklers (28358, 28386).
  Operators per shift (A, B, C): 1 excavator, 4 dumper, 2 grader/sprinkler = 21 operators with made-up Indian names.
- Allocation rule (in app.js, function computeAllocation): only fit HEMMs and operators on duty. Everyone is on duty by default; not on duty = weekly off, applied leave, or marked absent by the Mine Manager.
  Operators only get machines of their own skill group.
  A machine under repair counts as OK for a shift if its expected_ok_at time is on or before the shift start.
  Overtime operators must be called in advance by the Mine Manager (ot_calls). Called operators (overtime costs money) get a machine ONLY when a machine is left empty because there are fewer regular operators of that type. Extra called operators are not allotted and are listed on the dashboard.
  An operator on weekly off or on a marked leave day is never allotted a machine.
  Best combination: the most efficient operators are used first and get the most reliable machines (lowest breakdown chance) of the highest-priority type.
  Operators left without a machine get advice on the dashboard (wait / ask engineer / free for other work).
  Priority: excavators, dumpers, then 1st water sprinkler, motor grader, 2nd water sprinkler.
- Production projection (dashboard, function projectProduction in app.js): next 30 days. One dumper trip = 10 minutes and 16 m3, a shift = 8 hours,
  so one dumper at 100% efficiency = 48 trips = 768 m3 per shift (an operator with 90% efficiency does 90% of that). Dumpers haul only if an excavator is running. Uses operator efficiency (the excavator operator's efficiency scales the loading), breakdown chance, weekly off, marked leave,
  about 2 extra leave days a month, and the expected OK time of machines under repair. Overtime is not counted. All numbers are at the top of app.js.
- Every save on My Work shows how the 30-day projection moved (increase / decrease / unchanged). The dashboard also shows a message if someone else changed it.
- Pages: index.html = entry page and dashboard (summary cards, 30-day projection with line/bar switch and what-if sliders,
  production calendar where a tapped day shows its allotment, charts, tiles); work.html = "My Work" (screen depends on role);
  login.html = login for manager and engineer, name picker for operators. Old dashboard.html was removed.
- Decision cards (dashboard, "Decisions needed"): one card for each machine in breakdown (status Open) and each operator on sudden leave or marked absent today or tomorrow.
  Each card shows the production at risk (7 days for a breakdown, that day for a leave), a "Best move", and the options with their gain in m3:
  (1) ask the Maintenance Engineer to rectify within 2/4/8/12/24/48 hours, (2) ask the crews to cut the trip time to 9.5/9/8.5 min (normal 10 min), (3) call an overtime operator (costs extra).
  If spare machines or operators cover the loss, the card says so. "Copy request" copies a ready message. "Try a scenario" pretends a breakdown or a sudden leave without saving anything.
  The number of machines is fixed; no option adds a machine.
- Planned maintenance (set by the Maintenance Engineer on My Work; one plan per machine: work, start, hours, optional "latest safe start"):
  a machine that is mostly (50% or more) in maintenance during a shift is not allotted; the 30-day projection loses that machine's share of the shift.
  A start after the latest safe start adds 1.5 % points (RISK_PER_OVERDUE_DAY) to the breakdown chance for each late day, until the work is done.
  Dashboard "Planned maintenance": a 30-day timeline and one advice card per plan (function maintenanceAdvice in app.js). It tries every day from 14 days earlier to 14 days later
  (and the three shift starts on the best day), works out the production lost at each start, and suggests keep / prepone / postpone (needs a saving of at least 300 m3 and 15% of the loss).
  Cards also show the crew on duty, clashes with another machine of the same type that is broken or in maintenance, and a "Copy request" message.
- Side bar on every page: navigation, and lists of all machines and operators (tap one for details; type to search). It is a drawer on phones.
- What-if sliders (dashboard): excavators, dumpers, excavator operators per shift, dumper operators per shift. They change only the screen.
  Shared files: style.css (Material Design look), app.js (database link, header and bottom menu, icons, allocation rule, projection).
  Look: Material style, colours "Stormy Morning" (slate #6B7A8F, orange #F7882F, yellow #F7C331, tan #DCC7AA), dark/light switch in the top bar (remembered on the phone),
  light glass top bar, dark slate side bar (drawer on phones), bottom menu on phones, small dense grid tiles, calendars, gauge rings on summary cards. Logo: put the official Mahanadi Coalfields logo in the top folder as logo.png; until then a plain MCL badge shows.

## Progress Log (newest entry at the bottom)
- Phase 0 (starter): placeholder index.html, config.js without settings and
  this CLAUDE.md. Next: Phase 1 - the table and the entry page.
- Phase 1 (Claude, session 1): built the whole first version. Files: database/01-setup.sql (table, security rules, 11 HEMMs, 21 operators), style.css, app.js, index.html, work.html, dashboard.html. The old Tailwind prototype index.html was replaced because it broke the technical rules. What works (checked only with a stand-in database, not the real one): role choice, engineer screen, operator screen, incharge screen, automatic allocation, dashboard with two charts. Known problems: not yet tested on the live site; one answer per operator at a time (a new answer replaces the old one); HEMM OK status is one setting for all shifts. Next step: Data Keeper runs database/01-setup.sql, then the team tests on the live site.
- Phase 2 (Claude, session 1): (a) Engineer can say "expected to be OK in" 1 to 72 hours for a machine under repair or broken down. (b) Allocation counts a machine as OK for a shift if that time is before the shift starts. (c) New dashboard card "Free manpower" tells each idle operator to wait, ask the engineer, or take other work. (d) Overtime operators are no longer given machines automatically; they are listed for the Shift Incharge. Files changed: app.js, work.html, dashboard.html, new database/02-add-expected-ok-time.sql. Checked only with a stand-in database. Known problems: the expected time is fixed when saved (not live countdown); overtime operators can only be allotted by flipping the switch in app.js. Next step: Data Keeper runs database/02-add-expected-ok-time.sql BEFORE the site is updated, then test on the live site.
- Phase 2b (Claude, session 1): overtime rule corrected after the team explained it. Overtime operators are now used only for machines that have no regular operator; any extra overtime operators are not allotted. The ALLOW_OVERTIME_ALLOTMENT switch was removed. Files changed: app.js, work.html, dashboard.html. Checked only with a stand-in database. Next step: test on the live site (see Phase 2 entry; database/02-add-expected-ok-time.sql must be run first).
- Phase 3 (Claude, session 1): (a) Each HEMM has a breakdown chance per shift (engineer can change it). (b) Each operator has one weekly off day and can mark leave days in advance on the My Work page; those days are never allotted. (c) Dashboard shows planned production for the selected shift and a 30-day projection (chart plus totals) based on 10 minutes per trip and 16 m3 per trip. Files changed: app.js, work.html, dashboard.html, new database/03-add-breakdown-and-leave.sql. Checked only with a stand-in database; the real Chart.js could not be loaded here, so the new chart is untested. Known problems: the projection treats one excavator as enough for all dumpers; the single excavator operator per shift is the main limit; weekly off days are made up and the operator cannot change them; the incharge cannot yet edit weekly off. Next step: Data Keeper runs database/03-add-breakdown-and-leave.sql BEFORE the site is updated, then test on the live site.
- Phase 4 (Claude, session 1): (a) Made-up efficiency for the 21 operators and made-up leave days (2 or 3 each, within the next 30 days) in database/04-add-efficiency-and-dummy-leave.sql. (b) Allocation now picks the best combination: most efficient operators first, paired with the most reliable machines; projection and shift plan use efficiency. (c) Operator leave is now chosen on a calendar (tap days, Save; any number of days can be applied for; weekly off days and past days are locked). (d) Grid views of machines and operators on the dashboard; grid of machine cards for the engineer and operator cards for the incharge. (e) Whole site restyled in Material Design (style.css, header and bottom menu in app.js, all three pages). Checked only with a stand-in database; the real Chart.js could not be loaded here, so charts were never seen drawn. Known problems: leave has no approval step (anyone can mark any number of days); the calendar starts on the current month; efficiency and weekly off cannot yet be edited on the site. Next step: Data Keeper runs database/04-add-efficiency-and-dummy-leave.sql BEFORE the site is updated, then test on the live site.
- Phase 5 (Claude, session 1): (a) New Mine Manager role (replaces the Shift Incharge screen): marks operators absent/present and calls them for overtime for any date; operators are on duty by default. (b) Operators only show overtime interest, apply for leave and see their duty; their Present/Absent buttons were removed. (c) Projection now uses the manager's absences and overtime calls; every save shows how much the projection went up or down. (d) Dashboard: 30-day projection first, then a production calendar (tap a day for its allotment); smaller, denser tiles. (e) Dark/light switch and Stormy Morning colours; logo slot (logo.png) top left. Files changed: app.js, style.css, index.html, work.html, dashboard.html, new database/05-add-manager-controls.sql. Checked only with a stand-in database; charts never seen drawn. Known problems: logo.png is not in the repo yet (badge shown); Stormy Morning hex codes were written from memory because Figma could not be opened; old attendance columns (attendance, duty_date, duty_shift) are now used only for overtime interest; no approval step for leave. Next step: Data Keeper runs database/05-add-manager-controls.sql BEFORE the site is updated; someone adds logo.png; test on the live site.
- Phase 6 (Claude, session 1): (a) index.html is now the dashboard, laid out like the reference picture: side bar, pastel summary cards, chart cards. dashboard.html was removed. (b) Side bar on every page lists all machines and operators (tap for details, search box); drawer on phones. (c) More charts: production by shift, breakdown chance by machine, top operators by efficiency. (d) Projection chart has a Line / Bar switch (remembered). (e) What-if sliders for machines and manpower change the projection at once and say how much it moved. (f) New login.html: real Supabase Auth logins for Mine Manager and Maintenance Engineer; work.html requires them. Files changed: app.js, style.css, index.html, work.html, new login.html, new database/06-set-login-roles.sql and database/07-optional-lock-machines.sql. Checked only with a stand-in database and a pretend login; charts never seen drawn; SQL 06 and 07 could not be tested. Known problems: until the Data Keeper creates the two users and runs 06, nobody can log in as manager or engineer, so they cannot edit; without 07 the login only hides the screens (the database still accepts changes from anyone who knows the public key); logo.png still missing. Next step: Data Keeper creates the two users in Supabase (Authentication > Users), runs 06 (with the real emails), then optionally 07; test login on the live site.
- Phase 7 (Claude, session 1): dashboard made more modern. (a) Big banner with the 30-day projected total, a small trend line drawn as a picture, and the day / shift controls inside it (the total follows the what-if sliders). (b) Three insight chips worked out from the numbers: biggest lever (which extra machine or operator adds most), weakest day, riskiest machine. (c) Summary cards with round gauge rings, and a fifth card for average efficiency. (d) Dark slate side bar with an orange active item, light glass top bar, soft page glow, softer cards, rounded charts with round legend dots and gradient line fill, friendlier sliders, rank badges, loading shimmer, gentle entrance animation. (e) The phone bottom menu now sits outside the top bar (the glass effect would have trapped it). (f) Chart drawing is fail-safe: if a chart cannot draw, the rest of the page still works. Files changed: style.css, app.js, index.html. Checked only with a stand-in database; the real Chart.js could not be loaded here, so the charts (including the new gradient and dots) were never seen drawn. Known problems: logo.png still missing; login accounts (database/06, 07) still to be set up by the Data Keeper. Next step: look at the live site and tell us what to adjust.
- Phase 7b (Claude, session 1): the first login attempt on the live site failed with "Email not confirmed" (the user was made in Supabase without "Auto Confirm User"). database/06-set-login-roles.sql now also confirms the two emails; the login page explains this error in plain words. Files changed: database/06-set-login-roles.sql, login.html. Next step: Data Keeper runs the updated 06 (with the real emails), then log in again on the live site.
- Phase 8 (Claude, session 1): decision cards on the dashboard for unexpected breakdowns and sudden leave (see "Decision cards" above). Each card works out the loss and the gain of each option with the same projection model (function withTripMinutes in app.js tries a shorter trip time for a moment). Includes a "Try a scenario" box and "Copy request" buttons. Files changed: app.js, style.css, index.html, CLAUDE.md; no database change. Checked only with a stand-in database. Known problems: the requests are not sent anywhere (they are copied and pasted by hand); the trip-time gain assumes the crews can really be faster; an overtime operator is assumed free even if working their own shift; the cards look only at today and tomorrow. Next step: look at the cards on the live site and tell us what to adjust.
- Phase 9 (Claude, session 1): future maintenance planning. (a) Maintenance Engineer can plan maintenance of each machine on My Work (work, start, hours, latest safe start) and sees the advice for it at once. (b) The allotment leaves out a machine that is mostly in maintenance during the shift; the 30-day projection counts the lost production. (c) Dashboard section "Planned maintenance": timeline plus advice cards that compare start times and recommend keep, prepone or postpone, with clash warnings and a copy-able request. (d) Late service adds breakdown risk. Files changed: app.js, style.css, index.html, work.html, new database/08-add-planned-maintenance.sql (also adds six made-up plans, including two excavators that clash). Checked only with a stand-in database. Known problems: one plan per machine; the risk from a late service (1.5 % points a day) is a made-up number; the advice does not know spare-part or workshop limits; the plans are not sent to anyone. Next step: Data Keeper runs database/08-add-planned-maintenance.sql BEFORE the site is updated, then test on the live site.
