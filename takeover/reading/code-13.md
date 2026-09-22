# Slice 13: scripts (part 2 of 4)

Reader notes. Every file on `slices/13-scripts.txt` read in full, comments included. Line
numbers are the file as read on 2026-09-22. Common shorthand: "T1" = reads source with comments
in; "T2 control" = planted offender plus known-good case; "T3" = hand-typed route list; "T4" =
truncated output; "T6" = main() at module scope or an argv suffix guard.

## Files

### scripts/settings.ts (750 lines)
- For: `settings:seed|reprice|rails|show|check|compare`, seeding and auditing `platform_settings` and `country_settings`.
- Decides: `seed` (33) inserts every group and country with `onConflictDoNothing`, no production guard (718, only prints host), and it is `prebuild`. `reprice` (66) refuses if `settingsProblem(SETTINGS_DEFAULTS)` (67), then OVERWRITES `pricing`, `session`, `sponsor` wholesale with code defaults (93 to 102), then moves every subscription whose `plan` is not a live tier key to `payg` (117 to 124, C299 fix of a sweep that would have cancelled every paid plan). `rails` (165) fills empty country fields only, moves `entity` us to eg only when seed says eg (196). `check` (271) compares stored vs defaults by order-insensitive object keys (`stable`, 260), prints stale values (exit 0), exits 1 only on no `payouts.transferFields`, a missing seeded country, or an em dash in any stored string (395). `compare` (482) reads all three environment URLs, refuses a URL whose host is not the named endpoint (510), diffs per leaf, one ALLOWED difference: `copilot.messagesPerPatientPerSession` 4 on production vs 10 elsewhere, both values pinned (468 to 480, 610 to 616), prints unused allowances (656).
- Assumes: `lib/settings/defs` pure; `./_environments` lists production FIRST (603 comment "first is production"; allowance matching at 613 depends on it); `writesTo` needs `I_MEAN_PRODUCTION` for production.
- Promises: A1/A3/A4 indirectly (the transfer fields are the Egyptian rail; `check` is the only thing that says the rail has no bank account). None directly.
- Notes: `reprice` and `rails` are both `productionIsAllowed: true` (717). The comment at 709 to 710 says reprice "keeps the guard and the deliberate door" and rails "keeps it too", then 712 to 716 says both are let through: the door still needs `I_MEAN_PRODUCTION`, so both statements are half true. `reprice` overwrites whole `pricing`/`session`/`sponsor` groups, so any operator edit to any key in those groups (tier prices, session settings, sponsor floor) is erased; the safety claim at 89 to 91 ("every remaining field in the stored sponsor row already equals its default") is a dated fact, not a check. The dash sweep checks only U+2014 (326); an en dash (U+2013) in stored copy passes. Stale output truncated to 150 chars per side (300), compare diffs to 200 (582), without a note that it was cut (T4, mild). `check` has no control (no planted stale or dashed row; T2). main() unguarded at 750 (T6: nobody imports it; confirmed by grep).

### scripts/ship-content.ts (91 lines)
- For: `ship:content -- <sprints>`: runs `db:seed -- --refresh-content` then each named `verify:sprintNN`.
- Decides: refuses with no sprint numbers (44); prints the host before writing (52); never calls `writesTo()` by design (23 to 30), so it WILL write to production when `DATABASE_URL` is production, with no `I_MEAN_PRODUCTION` needed.
- Assumes: `db:seed --refresh-content` touches `content_pages` only (56 to 60). Child processes inherit the whole environment (85).
- Promises: none directly; every "where we say it" citation on a public page (P1, P3, P4, T1, T2, C1 to C5, E1, E2) is content these rows hold.
- Notes: HAZARDS H49 says this is a RESEED that replaced 6,810 bytes of authored production copy with `defaults.ts`. This file still does exactly that, with no before/after `sum(length(blocks::text))` measurement that H49's rule demands, and no confirmation prompt (the header says it "refuses `--yes` as a substitute for reading that", but there is no prompt at all: it prints and proceeds, 52 to 61). The comment "It refuses `--yes`" describes nothing in code. main() at module scope (88).

### scripts/shoot-room.ts (391 lines)
- For: screenshot rig: signs up a therapist in a real browser, approves them by DB write, opens a video room, measures transcript geometry at four widths, drives the radar orb through four states.
- Decides: acceptance (247 to 270): transcript top inside viewport, at least 200px visible, no sideways scroll, on wide screens video under 60% width. Orb aria-label regexes (351 to 356).
- Assumes: `writesTo()` (121) refuses production. `E2E_BASE_URL` server shares its database with `DATABASE_URL`.
- Promises: T1/T2 context only (room layout). None enforced.
- Notes: RAW WRITES that bypass product functions: inserts `therapist_verifications` state approved (164 to 176) and sets `users.verification_status = 'verified'` directly (178 to 181). MAP says `users.verification_status` is derived by trigger 0083, so the direct UPDATE either is overwritten or fights the trigger (suspect). Writes `therapist_radar` states directly (325 to 329), including `reservedBy: "someone"` (308), a string where the column type is unknown from here. Never deletes the user, org, verification or session it creates: every run leaves a verified `shot-*@example.com` therapist on the radar of the database it ran on (dev). Header says "five states are the whole ticket" (294) and the list has four (299 to 312). `ul li` count (287) counts any list item on `/on-call`, not history rows. main() at module scope (391).

### scripts/simulate-seed.ts (629 lines)
- For: `simulate:seed`, the one-shot seed of the six month run: operator, seven staff logins plus payroll, copilot quota 4, one clinic application, three sponsor applications.
- Decides: refuses if any clinic org or any sponsor exists (221 to 231). Finds org by slug `twentyfour-therapy` or `24therapy` else inserts (285 to 293). Operator find-or-create, password reset to `SIMULATION_PASSWORD` and role forced to `super_admin` on every run (324 to 338). Payroll (367 to 406). `jsonb_set` copilot quota 4 (489 to 492). Applications through `applyToClinic` and `applyToSponsor` (505 to 529). Checks are deltas against a `before` count (268 to 280, 533 to 550).
- Assumes: `db:seed` via `ship:content` ran first (8 to 12). `_cast.ts` PAYROLL emails all match `%.example@example.com` (447 to 454). A `copilot` row exists in `platform_settings` (else UPDATE hits nothing and the check fails honestly).
- Promises: A5 (staff roles are created here: founders `super_admin`, others `staff`, 457 to 466). E1/E4/E5 setup (sponsors held, entity us).
- Notes: RAW INSERTS bypassing product functions: `organizations` (292), `subscriptions` (306), `users` operator and staff with role (334, 401), `employees` and `employee_salaries` (372 to 379; reason given at 350 to 365: `addEmployee` requires an Actor), `platform_settings` copilot (489). Clinics and sponsors go through product functions. `productionIsAllowed: true` (195). The "exactly ONE platform organisation" check (295 to 304) counts `organizations WHERE kind = 'solo'`, and `kind` defaults to `'solo'` and is every solo clinician's own organisation (`lib/db/schema.ts:165`, `:8351`). On any database with a solo therapist (production has the founder therapist) this check fails, or on an empty branch it passes while measuring the wrong thing. The operator check at 340 to 344 is `check(..., true, ...)`: cannot fail. Line 58 says "three scripts and two documents import it from here": grep finds no importer of `simulate-seed`; stale. Since main() runs at import (629, T6), any future importer of `OPERATOR` or `CLINIC_APPLICATION` would run a production-allowed writer.

### scripts/smoke-public.ts (300 lines)
- For: `npm run smoke`: `next start` on port 3210 over the current build, GET every `LIVE_PAGES` path in each locale, demand 200 with more than 200 visible characters.
- Decides: skips out loud with no build (123); rebuilds when `middleware.js` is newer than `BUILD_ID` (165); fails if the port is bound (198); kills the process group (84 to 109).
- Assumes: `LIVE_PAGES` and `visibleText` from `scripts/check-live.ts`.
- Promises: none directly; it is what would have caught `/pricing` 500 (C353).
- Notes: `LIVE_PAGES` is a HAND-TYPED list in `check-live.ts:99` (T3): `/`, `/pricing`, `/for-patients`, `/features`, `/contact`, and a few more; not `inventory.routes()`. The header claims "every public page". Control is one-sided: `checked >= 10` proves something was fetched, no known-bad page is planted (T2 half). `check-live.ts:219` guards its own main with `process.argv[1]?.includes("check-live")`, a SUBSTRING guard, weaker than the suffix guard T6 forbids; importing it from here is safe only because the name does not collide. The "warning: still held after SIGKILL" (108) is a console line, not a failure. main() at module scope (300).

### scripts/spend.ts (156 lines)
- For: `npm run spend [--budget N --warn P --json]`: sums `ai_request_logs.cost_microcents`, exits 1 at or over budget.
- Decides: dollars = microcents / 100,000 (53, matches H13). Over 100% sets exit 1 (127).
- Assumes: every model call writes an `ai_request_logs` row with a correct `cost_microcents`.
- Promises: none.
- Notes: reads only, no `writesTo`, so safe on production. The "x8 per real fifty-minute session" line (103) assumes six minute simulated sessions; labelled as extrapolated. `--budget abc` yields NaN and falls through to "Inside the budget" (pct NaN compares false both ways, 127 to 135): a typo passes the guard green. main() at module scope.

### scripts/suites.ts (141 lines)
- For: `npm run suites`: runs every `test` / `test:*` npm script except `test:e2e`, then TAP-count checks each.
- Decides: fails on any `tests/*.test.ts(x)` file not named inside any script body (98 to 106), except `e2e.test.ts`. Suite ok = exit 0 and `# fail 0` and `# pass > 0` (74).
- Assumes: every suite prints TAP `# pass`/`# fail`.
- Promises: none.
- Notes: derives from `package.json` (good, not hand typed). Failure detail cut to 8 lines per suite (79) with no "N more" note (T4, mild; the total is on its own line so the count is not lost). Orphan match is a substring over joined script bodies (105): `tests/a.test.ts` would count as wired if some script names `tests/a.test.ts.bak`. Negligible. main() at module scope.
