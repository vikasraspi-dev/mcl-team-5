# CLAUDE.md - read this first, in every session

## About us
- We are a team of 4-5 people from Mahanadi Coalfields Limited (MCL) at an
  IIM Sambalpur MDP. We are NOT programmers.
- Explain everything in plain English, in short sentences. If you must use a
  technical word, explain it in one line.
- We build ONE small web tool in phases. Only one Claude session works at a
  time. The Progress Log at the end of this file is our handover logbook.

## What we are building
- A tool with at most 3 pages: index.html (entry page), dashboard.html
  (dashboard) and at most one more page.
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
6. No login or sign-up. Anyone with the link can use the tool.
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
- Who records / who decides: Maintenance Engineer marks each HEMM OK / under repair / breakdown. Operators mark Present / Absent, or raise Overtime interest for another shift. Shift Incharge views the automatic allocation and can mark attendance for an operator who phones in.
- "Roles" (not real logins, because rule 6 says no login): the user picks a role on index.html and it is remembered on that phone. Operators also pick their name.
- Table name and columns: dispatch_records (one table; rows are either HEMM or OPERATOR).
  Columns: id, created_at, updated_at, record_type (HEMM/OPERATOR), name, skill_group (Excavator/Dumper/Grader-Sprinkler),
  hemm_type, make_model, serial_no (HEMM only), home_shift, attendance (Not marked/Present/Absent/Overtime),
  duty_date, duty_shift (operator only), location, urgency (Low/Medium/High), status (Open/In progress/Resolved), remarks.
  Meaning of status for a HEMM: Resolved = OK (fit), In progress = under repair, Open = breakdown.
  For an operator: Open = not answered, Resolved = answered Present/Absent, In progress = overtime interest raised.
- Fleet (made up data): 2 Tata Hitachi 1200 excavators (sl. 1, 2); 6 BEML BH60M dumpers (60019, 60020, 60459, 60450, 60998, 60999);
  1 motor grader BG825 (21156); 2 BEML WS28-2 water sprinklers (28358, 28386).
  Operators per shift (A, B, C): 1 excavator, 4 dumper, 2 grader/sprinkler = 21 operators with made-up Indian names.
- Allocation rule (in app.js, function computeAllocation): only fit HEMMs and available operators (own shift Present, or Overtime for that shift and date).
  Operators only get machines of their own skill group. Own-shift operators are used first, overtime operators fill what is left.
  Priority: excavators, dumpers, then 1st water sprinkler, motor grader, 2nd water sprinkler.
- Pages: index.html = entry page (choose role); work.html = "My Work" (screen depends on role); dashboard.html = dashboard.
  Shared files: style.css (look), app.js (database link, header, allocation rule).

## Progress Log (newest entry at the bottom)
- Phase 0 (starter): placeholder index.html, config.js without settings and
  this CLAUDE.md. Next: Phase 1 - the table and the entry page.
- Phase 1 (Claude, session 1): built the whole first version. Files: database/01-setup.sql (table, security rules, 11 HEMMs, 21 operators), style.css, app.js, index.html, work.html, dashboard.html. The old Tailwind prototype index.html was replaced because it broke the technical rules. What works (checked only with a stand-in database, not the real one): role choice, engineer screen, operator screen, incharge screen, automatic allocation, dashboard with two charts. Known problems: not yet tested on the live site; one answer per operator at a time (a new answer replaces the old one); HEMM OK status is one setting for all shifts. Next step: Data Keeper runs database/01-setup.sql, then the team tests on the live site.
