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
- Notes: RAW WRITES that bypass product functions: inserts `therapist_verifications` state approved (164 to 176) and sets `users.verification_status = 'verified'` directly (178 to 181). The direct UPDATE is irrelevant rather than harmful: `verify-c285.ts:104 to 117` proves trigger 0083 forces the column back to the derived value, and the approved verification row inserted just above makes it `verified` anyway. Writes `therapist_radar` states directly (325 to 329), including `reservedBy: "someone"` (308), a string where the column type is unknown from here. Never deletes the user, org, verification or session it creates: every run leaves a verified `shot-*@example.com` therapist on the radar of the database it ran on (dev). Header says "five states are the whole ticket" (294) and the list has four (299 to 312). `ul li` count (287) counts any list item on `/on-call`, not history rows. main() at module scope (391).

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

### scripts/survey-live.ts (300 lines)
- For: `survey:live`: GETs the deployed site (default `https://24therapy.app`): every listed page in en and ar, robots, sitemap, a list of API routes anonymously, six portal roots.
- Decides: fails on a non-200 page (182), a canonical or hreflang on another host (183 to 186), a retired hostname in any body (156), empty or off-host sitemap (223), sitemap host disagreeing with the per-request canonical (237), any listed API route at 5xx (253) or 200 when not in `PUBLIC_API` (`/api/radar`, `/api/revalidate`, 105), any portal root rendering 200 without a redirect (275 to 287).
- Assumes: the live URL; network. Writes nothing.
- Promises: E2 / A5 adjacent (anonymous cannot reach a portal), not the principal-crossing question.
- Notes: T3 three times over. `CMS` (42), `CODE_PAGES` (55), `API` (69) and `PORTALS` (108) are hand typed. The comment at 64 says "Every API route under `app/api`"; the list has 20 paths and `app/api` has 32 `route.ts` files. Missing from the probe, among others: `/api/partner/v1/sessions/[ref]/transcript`, `/summary`, `/media`, `/note`, `/api/partner/v1/notes/[sessionId]`, `/api/partner/v1/subjects/[ref]/memory` and `/readers`, `/api/meetings/transcript/[sessionId]`, `/api/documents/[id]/speak`, `/api/patient/avatar/[personId]`, `/api/uploads/[id]`. Those are exactly the clinical-data routes, so "no API route hands an anonymous caller a 200" says nothing about them. The final "CONTROL" (291) re-asserts `leaked.length === 0`, the same condition as 208 plus the API bodies; it is not a control (T2: nothing planted). Failure details cut at 6 or 4 entries with no count of the rest (205, 211, 226, 294; T4). An anonymous GET to `/api/cron/billing` is sent on every run (73); it relies on the route refusing without the secret. `void main()` at module scope.

### scripts/sync-blocks.ts (325 lines)
- For: `content:sync -- <slug> <type...> [--drop=a,b] [--order] [--dry]`: replaces only named block types of a CMS page, in every locale that has defaults, from that locale's own defaults.
- Decides: refuses to write unless the blocks not being changed serialise identically before and after (284 to 290). Missing type in a locale is reported and skipped (178 to 180). Drops only named types (90, 183). `--order` re-sorts by default positions (254 to 276).
- Assumes: `lib/content/registry` `defaultsFor`, `localesWithDefaults`. `productionIsAllowed: true` (142), still needs `I_MEAN_PRODUCTION`.
- Promises: indirectly every "where we say it" page citation (content rows).
- Notes: this is the surgical fix H49 asked for, with a real control. `insertionIndex` (114 to 123): the comment at 111 to 112 says "If nothing matches, append", the code returns 0 (122) which puts the block at the TOP of the page, above the hero. Header 42 to 47 calls itself "the fifth door"; HAZARDS still says four (`settings`, `simulate-seed`, `age`, `migrate`); code in this slice alone shows `settings.ts:717` (two verbs), `simulate-seed.ts:195`, this file, plus `ship-content.ts` which needs no door at all. No cache revalidation after write (prints a 300 second note, 315). main() at module scope with `process.exit`.

### scripts/unlabel-straddles.ts (77 lines)
- For: one-off repair: resets `transcript_segments.speaker` to `unknown` where `speaker_inferred` and `straddlesTurnBoundary(text)` (C35).
- Decides: only touches inferred labels, guarded twice (33, 64). Batches of 500 via `inArray` (55).
- Assumes: `lib/ai/diarise.straddlesTurnBoundary`.
- Promises: T1 (note written from what was said: who said what) marginally.
- Notes: WRITES CLINICAL ROWS WITH NO `writesTo()` guard: pointed at production it rewrites transcript speaker labels there without `I_MEAN_PRODUCTION`. Not counted by any "doors" census because it never calls `writesTo` at all. Loads every inferred segment's text into memory (26 to 33). main() at module scope.

### scripts/verifiers.ts (179 lines)
- For: `npm run verifiers`: runs every `verify:*` npm script not in `GATES` and not `verify:synthetic|cast|demo`.
- Decides: discovery from `package.json` (113 to 119); skip list read from `_gates.ts` (69). T4 honoured: first 5 matching lines, the last one, and "N more" (153 to 157).
- Assumes: each verifier exits non-zero on failure; 180 s timeout per script (131).
- Promises: none.
- Notes: detail lines are filtered to `FAIL|FAILED|Error:` (150); a verifier that fails by timeout (status null) or with a different wording prints `FAIL name` and no reason, and nothing says it timed out. Header 45 to 47: "They are read-only with one exception the pass names" and "none of them writes to a database it was not pointed at": the pass names no exception, and most verifiers in this slice plant and delete fixtures via `writesTo()`; stale. Running this runs dozens of writers in sequence on the same dev database (the `verify:demo` exclusion comment at 101 to 105 records one fixture cleanup cancelling another script's session). main() at module scope.

### scripts/verify-actuals.ts (542 lines)
- For: `verify:actuals`: plants ledger legs, AI calls, employees, capital and a typed video cost, reads `monthlyActuals()` and `payrollByMonth()` and asserts deltas.
- Decides: revenue sign (243), subscription vs session revenue (249), spend (255), net includes salaries (281), VAT and clinician payable not revenue (291, 298), microcents (306), payroll month boundaries (325 to 351), capital reaches bank balance and not trading (355, 362), held-for-others subtracted from `ours` (378), runway divides ours (447), with a planted burn (426 to 434) and a longer-if-balance control (469).
- Assumes: `lib/data/actuals`, `lib/data/payroll`. `writesTo()` default (53).
- Promises: none of P1..A5 directly (founder P&L).
- Notes: good controls, all deltas. Defects in the fixture itself: (1) the comment at 115 to 116 says "Balancing pairs are used anyway, so nothing here would fail a trial balance"; the planted txn (123 to 129) sums to -8,940 cents (VAT -140, therapist_payable -800 and invoice revenue -8,000 have no counter leg), so it does not balance. (2) Video cost cleanup is broken when a row already existed: the upsert (224 to 227) only sets `amount_cents`, leaving `note` as it was, but the `finally` restores with `UPDATE ... WHERE note = 'verify'` (512 to 514), which matches nothing. So on a branch with a prior video bill every run leaves it 700 cents higher, and the next run reads the inflated value as `videoWas`. The start-of-run sweep (85) only deletes `note = 'verify'` rows and cannot repair it. (3) Check 339 ("a raise does not restate month 1") is the same expression as check 325; it cannot fail independently. `finally` deletes `employees WHERE title = 'verify'` (506), any real employee with that title too. main() at module scope.

### scripts/verify-age.ts (228 lines)
- For: `verify:age`: proves `scripts/age.ts` moves past timestamps and leaves future ones in the same row (`person_invites.created_at` vs `expires_at`), refuses a second ageing, `--dry` writes nothing, a 9000 day interval is refused.
- Decides: checks at 136, 142, 156, 162, 168 (control: one past, one future), 184, 191, 210.
- Assumes: `age.ts` CLI; child processes inherit the whole environment (43, 204), which H29 warns against, though `writesTo()` (48) has already refused production in the parent.
- Promises: none.
- Notes: the `--days 9000` check (199 to 214) runs against marker `${MARKER}x`, which was never `--start`ed, so `age.ts` would exit 1 for "No marker file" (age.ts:134) even if the 1 to 400 guard (age.ts:129) were deleted. It passes today for the right reason only because the days check happens to come first; it has no control distinguishing the two refusals. Ageing a real wave on a shared dev branch moves every row in every table created since this run's `--start`, including other scripts' concurrent fixtures. main() at module scope.

### scripts/verify-board.ts (269 lines)
- For: `verify:board`: `/admin/tv` founder board: nine sections run on a real DB, the board module has no writes, collected vs due money, every section has a door.
- Decides: runs each section (68 to 80); `WRITES` regex on `lib/console/board.ts` with a planted control (98 to 109); `requireManager` count in the actions file (111 to 115); due vs collected by exact SQL text (128 to 136); UI strings "Owed to us", "liability, not revenue" (144 to 169); `manageHref` doors exist as files (175 to 194); no `Intl` in the client component with control (218 to 230).
- Assumes: reads DB with no `writesTo()` (reads only). `readSource` used for all three files (34 to 36), so T1 clean.
- Promises: none of the 25 directly.
- Notes: several checks are SYNTAX, not property: 131 requires the literal `FILTER (WHERE ${invoices.issuedAt} >= ${week} AND ${invoices.status} = 'paid')`; a correct rewrite (e.g. `inArray(status, ["paid"])`) fails it. The "no writes" scan reads one file; a write reached through a helper imported into `board.ts` is invisible (reads one of N). The door-exists check (188) has a no-op `.replace("/admin", "/admin")` and handles only static paths. `requireManager` counted, not proved to be the first statement of each action. main() at module scope.

### scripts/verify-boundary.ts (433 lines)
- For: `verify:boundary` (C353): no server `.tsx` passes a function prop (direct or inside an object prop) to a client component; renderers preload stubs and do not use `--conditions=react-server`.
- Decides: `isClient` reads RAW first 2000 chars on purpose (86 to 90, directive position); everything else via `readSource` (T1 clean). Controls: the real pre-C353 pricing lines (227 to 254), three shapes, a known-good set (294 to 309), the type-annotation window proof (325 to 343), the client/server classification (345 to 350). Full T2 in both directions.
- Assumes: every client component is exported as `export function Name` or `export const Name` (99 to 100).
- Promises: none directly; guards the `/pricing` 500 (C353).
- Notes: header 41 to 42 says "a bare identifier known to be a function is refused"; no code does that (`seats={formatSeats}` passes). `exportedNames` does not match `export default function Name`, so a default-exported client component is not in `clientTags` and nothing handed to it is scanned. `isClient` tolerates at most one leading block comment; a `//` comment before the directive classifies a client file as server (false positives only). `.tsx` only. `verify:sprint45` exempted by name (403, 413), deliberately. main() at module scope.

### scripts/verify-c285.ts (285 lines)
- For: `verify:c285`: one source of truth for "verified": plants a clinician, writes `users.verification_status = 'verified'` by hand, asserts trigger 0083 forces it back and every surface refuses them, then approves for real (presence controls), then rejects (withdrawal).
- Decides: source checks on `lib/data/verification.ts` via `readSource` (53 to 65); derived column (98 to 117); radar list, `radarCount`, `publicProfile`, `verifiedFlag()` before and after approval and after rejection (180 to 273).
- Assumes: `lib/db` `controlDb`; `invalidateRadarBoard` (2 second in-process board cache, 125 to 139, recorded as product behaviour: a withdrawn approval reaches the public radar within two seconds).
- Promises: C1 (verification state on the radar row) partly: proves the radar filters on the real verification.
- Notes: exemplary controls. Header 23 to 24 promises "the clinic list and the clearance gate" too; neither is exercised (stale header). Comment 197 to 198 "Called with a synthetic key" describes nothing (the partner endpoint was cut, 141 to 156). Cleanup (277 to 280) is not in a `finally`: a throw between 175 and 251 leaves an approved, online fixture clinician on the dev radar. `void main()` at module scope.

### scripts/verify-caseload.ts (219 lines)
- For: `verify:caseload` (76.36): an in-person session with only a name creates a `walk_in` chart attached to the session and the caseload counts it.
- Decides: via `createSession` and `listPatients` (product functions); control that a `source='therapist'` chart with no phone is still refused by the DB (122 to 135); phone path gives `therapist` source, email path gives `join_link` (168 to 198).
- Assumes: `patients_phone_present` constraint; `writesTo()` (46).
- Promises: P4 (one record) at the edge: a walk-in gets a record.
- Notes: sound. Nothing here touches consent: an `in_person` session is created with no recording or AI consent fields (86 to 90), which is the task 123 surface; this verifier neither proves nor disproves it. main() at module scope.

### scripts/verify-cast.ts (295 lines)
- For: `verify:cast [--complete]`: every simulation cast member with a login opens with `SIMULATION_PASSWORD`, across `users`, `patient_accounts` (by phone digits and email) and `partner_users`.
- Decides: wrong password fails (203); missing fails only with `--complete` (211); control: every PAYROLL email present (229 to 240); control: Ziad (P6) never signed up (251 to 260); control: `docs/simulation/01-THE-CAST.md` `| **People** | **NN** |` equals `CAST.length` (274 to 287).
- Assumes: `_cast.ts`. Reads only, no `writesTo`, prints host (79). On the `on:production` read list.
- Promises: none directly.
- Notes: THE ZIAD CONTROL IS BLIND TO HOW A PATIENT SIGNS UP. It looks for any key starting `ziad.` (252). The file's own comment (136 to 148) says `/patient/signup` never asks for an email, so a self-signed-up patient is keyed here by phone digits only. An agent signing Ziad up through the real patient form would never be seen; only a `users`/`partner_users` row or an email-bearing account would trip it. The comment at 227 says "the three seeded people"; the check reads all of PAYROLL, seven (stale number). The non-`--complete` presence check is `check(..., true, ...)` (215), labelled as a report. main() at module scope.

### scripts/verify-claims.ts (645 lines)
- For: `verify:claims` (sprint 57, C275, C291, C323, C374, C375): refuses two shapes of copy (a response-time promise about a person; an absolute about accuracy), a copy denial of a subscription when a tier is monthly, a typed seat price the ladder does not produce; checks HAZARDS has a Status column.
- Decides: `promisesAPerson` (154 to 182) with clause-bounded negation; `claimsPerfection` (123 to 127) within 40 chars; `DENIES_SUBSCRIPTION` (448); `seatFigureProblem` (526) against every figure `seatMonthlyCents` produces for 1 to 500 seats (512 to 524); dictionary seat strings must use placeholders (617 to 624). Controls both ways for every rule (302 to 351, 364, 419 to 424, 462 to 466, 559 to 583, 626 to 629). Genuine T2 in both directions.
- Assumes: imports `DEFAULT_PAGES`, `DEFAULT_PAGES_AR`, `DICTIONARIES`, `SETTINGS_DEFAULTS`.
- Promises: P3 / T1 / T5 wording ("You never talk to the AI"), E1/E2 page wording, T3 (`honesty.ts` claims) not touched here.
- Notes: WRONG MEDIUM. It reads `lib/content/defaults*.ts` and `SETTINGS_DEFAULTS`, not the published `content_pages` rows or the stored `platform_settings.pricing`. H28 and H49 say the published rows are authored-wins and diverge from defaults (and `sync-blocks.ts` exists because they do). So a false sentence an operator typed into a live page, or a stored seat ladder that differs from the default, passes this gate. The header (6 to 17) says it asks whether "a sentence on a public page is TRUE"; it asks it of the source defaults. The "24/7" rule named in the header (27 to 29) has no pattern: `A_DURATION` has no `24/7`, so "a therapist 24/7" near "answers" is not caught. The meta-claim check (360 to 363) scans page defaults only, not the dictionary. The HAZARDS check (638 to 642) asserts a header cell exists, not that every row carries a status (syntax, not property). Runs at module scope, no `main()`, `process.exit` at 645.

### scripts/verify-contrast.ts (649 lines)
- For: `verify:contrast`: Playwright walks public and signed-in pages at en/ar and 1280/390, measures WCAG 1.4.3 for every text node against its first opaque ancestor background.
- Decides: `AUDIT` in-page (258 to 328), canvas colour conversion; `measured >= 10` guard (496); two-attempt navigation (437 to 453); sign-in per principal once (583 to 627) with a check that the URL left the sign-in page.
- Assumes: a running server at `VERIFY_URL` or localhost:3100; demo cast signs in with `DEMO_PASSWORD` (the founders' real addresses, 168, 184, 198, 212, 225).
- Promises: none of the 25 directly (accessibility).
- Notes: PUBLIC is derived (`routesByPortal()` plus CMS slugs from `DEFAULT_PAGES`, 145 to 155), so T3 was fixed for public. SIGNED_IN paths (164 to 238) are STILL HAND TYPED (T3): 9 therapist, 6 patient, 7 company, 6 clinic, 9 admin. The comment at 157 to 162 says "Every destination in each portal's own navigation belongs here", exactly the rule T3 says a hand list breaks. CMS slugs are read from defaults, not published rows (a published-only page is not walked). No check that a signed-in sweep actually landed on the path it asked for: a page that redirects (to the portal home, or back to sign-in when the session expires) is measured at its destination and reported green under the requested path (455 to 510). No planted low-contrast element: the control is only "at least 10 elements" (T2 half). Failures cut to 4 with no count (499, T4). `MEASURES_NOTHING` includes `"font"` and then the abort excludes font (537, 555): dead entry. `void main()` at module scope.

### scripts/verify-csp.ts (324 lines)
- For: `verify:csp` (T5 enforcement): the CSP shape (nonce + strict-dynamic, no unsafe in script-src, five absolutes), middleware forwards the policy on request headers, nonce from `crypto.randomUUID`, enforcing by default, Daily hosts covered per `docs/DAILY-HOSTS.md` at the installed version, `unsafe-eval` only on the room and only that token, one importer of daily-js and one page rendering the room, `isVideoRoom` matcher.
- Decides: controls for the directive reader (99 to 105), host coverage (225 to 229), matcher (310 to 319).
- Assumes: `lib/security/csp`; `audit-daily-hosts.ts` and `_i18n-coverage.ts` guard their `main()` with `ranDirectly(basename)` (checked: `audit-daily-hosts.ts:187`, `_i18n-coverage.ts:274`), so the imports do not run them.
- Promises: none of the 25 directly; room connectivity underlies P1.
- Notes: T1 clean (`readSource` on `.ts`, `readFileSync` only on the `.md`, 158). The middleware checks are SYNTAX: the literal `forwarded.set(header, policy)` and `forwarded.set("x-nonce"` (115 to 116); renaming the local variable fails the gate with the property intact. The single-importer check (284 to 293) walks `app` and `components` only; a hook in `lib/` importing daily-js is not seen (reads one of N places). `main()` at module scope.

### scripts/verify-demo.ts (622 lines)
- For: `verify:demo [--scenario=<name>]`: after `seed:demo`, every demo login works, each portal has rows, position-specific rows exist, the kept tables are not empty, the append-only trigger is back on, every non-owned address is at example.com.
- Decides: `scenarioFrom` shared with the seed (64); logins by `verifyPassword` (102 to 114); Laila unclaimed (123 to 134); caseload counts with "controls" (146 to 175); completed sessions and equal approved notes (177 to 191); verification agree (220 to 223); clinic seats and sessions (227 to 245); pot balance vs overdraft floor and vs `ledgerPotBalance` (268 to 303); pot spend at the position's share via `potTotals` (315 to 336); enrolment (341 to 367); per-patient sessions, summaries, homework, journal (373 to 395); Tarek two versions, two clinicians, two orgs (402 to 409); per-scenario rows (438 to 539); kept tables `content_pages`, `platform_settings`, `country_settings` non-empty (552 to 555); `clinical_summaries_no_rewrite` enabled (587 to 590); stray addresses (600 to 614).
- Assumes: `_demo-cast`, `_value-statements` (no `main()`, T6 lesson applied). Reads only (every statement a SELECT); on the `on:production` read list.
- Promises: sets up the walk for all 25; directly evidences P4 (Tarek two versions, 402 to 409), E3 (share per session, 331 to 336), E5 (growth pot short, 525 to 531), A3 (crisis rejection reason at least 15 words, 507 to 514), A4 (money: submitted undecided transfer, 481 to 484), P2 (live: `session_invited` notification, 468 to 472).
- Notes: the header (16 to 26) says each count is "asked the way the portal asks it" and each control is "the identical query for somebody who must see none". Neither is true: every count is the verifier's own SQL, not `listPatients`/`scope()` (the comment at 142 names `scope()` and re-implements it), so a scoping bug in the product cannot turn these red. The controls swap in somebody who has nothing: Sara's control is Yasmin the applicant (164), who has no patients in any world; Kareem's control counts `sessions` instead of `patients` (173); the clinic sessions control is the platform org `24therapy` (244). Only Omar's (153 to 156) is a real scoping control. The kept-table census is three `count >= 1` checks; the real census is in `seed:demo` (554 to 573), and `employees` is printed, not asserted (575). A3 check (507) reads one rejected row's words, not that the payer SEES it. C2 (clinic sees no patient names) is not checked anywhere here. `sql.raw` with interpolated constants (105, 139, 371, 553, 600): values are from `_demo-cast` constants, so no injection today, but it is H7's shape. `void main()` at module scope.

### scripts/verify-email-dns.ts (274 lines)
- For: `verify:email-dns`: DNS ratchet for SPF, DKIM, DMARC and "SPF covers the sender" on `24therapy.app`, plus a DMARC `p=none` clock ending 2026-10-06.
- Decides: `lost` fails (185 to 191); DMARC `p=none` fails after `MONITORING_UNTIL` (60, 237 to 249); relaxed alignment required unless SPF names the sender (260 to 266). Control: a real SPF read plus an invented name empty (210 to 215).
- Assumes: network DNS; skips out loud when NS does not resolve (117).
- Promises: P2 adjacent (email delivery).
- Notes: TIME BOMB by design: from 2026-10-06 (14 days after today) it fails until DMARC moves to `p=quarantine`. `spfCoversSender` (175) is true when `send.<domain>` has ANY `v=spf1` record; it does not check that it includes the actual sender (amazonses). The comment at 252 to 258 ("SPF names Zoho and the product sends through Resend, so SPF fails on every transactional message") contradicts the baseline comment at 84 to 99 (the `send.` subdomain aligns); stale. The "missing are named" check is `check(..., true, ...)` (193). `void main()` at module scope.

### scripts/verify-entitlement.ts (248 lines)
- For: `verify:entitlement` (sprint 74): subscribing by transfer raises one due invoice at the tier's settings price, a second press refuses, no tier until settled, settle grants, next month's due bill does not mask the paid month, unpaid lapses to payg, mid-month seat change prorates.
- Decides: via product functions `organizationNeedsTransfer`, `subscribeByTransfer`, `settleOldestObligationByTransfer`, `currentTier`, `applySeatChange`. Cleanup in `finally` (237 to 243).
- Assumes: `writesTo()` (69); `lib/settings.getSettings` (price read, not typed, 61 to 66).
- Promises: A1 (partly kept: "a bill is not an entitlement", 135 to 139, and granted only after settle, 150 to 154). A2 partly (the double press on subscribe, 116 to 121; not the double Confirm).
- Notes: the "operator confirms" step calls `settleOldestObligationByTransfer` directly (143), not the operator's confirm action on a `manual_payments` row; A1's "until an operator presses Confirm" is proved for the service function, not for the button or its authorisation. The lapse is simulated by direct UPDATEs (185 to 192), not by `lapseOverdue`, so the lapse job itself is untested here. The control (228 to 236) queries a zero UUID; it cannot fail for any scoping reason relevant to the checks above (T2 in name only). `main()` at module scope. Cleanup deletes invoices, obligations, subscriptions and the org, but not any `ledger_entries` that `settleOldestObligationByTransfer` or `applySeatChange` may post (whether they post is not visible from here); if they do, the org delete either fails on a foreign key or orphans ledger legs.

### scripts/verify-finance.ts (608 lines)
- For: `verify:finance` (sprint 71): the forecast in `lib/finance/` cannot charge anybody, `model.ts` is pure, the forecast and the operating plan (`plans.ts`) agree on price, fees, payroll, the books close monthly, cash is the running sum, subscribers pay neither per-session fee, deficit is the curve's low point, provenance on every input, the admin page is super_admin only and linked, the page's actions are exactly two and audited.
- Decides: import-line scan against `FORBIDDEN` (47 to 73) with a control (75 to 81); purity regexes (89 to 113) with a control; arithmetic checks via `forecast()` with controls for the widened tolerance (320 to 330) and the deficit field (452 to 460).
- Assumes: `lib/finance/{model,scenarios,plans,assumptions}`; `readSource` throughout (T1 clean).
- Promises: T3 adjacent (netting is modelled, "a subscriber pays neither per-session charge", 196 to 224), but this is the forecast engine, not the billing path.
- Notes: the "cannot reach billing" check (58 to 67) reads DIRECT imports of top-level `lib/finance/*.ts` only: not transitive (header 9 to 11 says "nothing under lib/finance may reach"), and not subdirectories (`readdirSync` without recursion, 25). The page and action checks are SYNTAX: `requireRole("super_admin")` within the first 600 characters of each exported function body and `await audit(` within 2500 (594), and the export count must be exactly 2 (591); an action split into a helper fails or passes on layout. `BASE.months === 36` (257) asserts a typed number, the pattern its own comment at 124 to 133 warns against. The C360 finding at 441 to 445 asserts the base case goes NEGATIVE; like the check it replaced it will go red when the forecast improves. `main()` at module scope.

### scripts/verify-limits.ts (240 lines)
- For: `verify:limits` (76.58, 78.6): the rate limiter at its exact limit with `SIMULATION_RUNNING` unset, widened when set, the `global:` ceiling never widened, the shipped sign-in limit times the multiplier clears 168, windows are dated by the database clock.
- Decides: `consume` called 6 times at limit 5 each way (61 to 111); `LOGINS_PER_WINDOW` parsed from `lib/auth/actions.ts` via `readSource` (200 to 215, T1 clean); window age < 0.5 s (162 to 177); `windowStart: sql\`now()\`` literal in `lib/rate-limit.ts` (179 to 184, syntax).
- Assumes: `freshLimiter` (223 to 228) re-imports `lib/rate-limit` with a query string and clears `require.cache` for it and `lib/env`; under ESM the query-string import gives a fresh `rate-limit` module but `lib/env` would come from the ESM cache, not `require.cache`, so if the flag is read in `lib/env` the second import does not see it (the check would then go red, not falsely green). `writesTo()` (43).
- Promises: A5 adjacent (sign-in defences).
- Notes: control at 73 to 77 is labelled "the fifth was allowed" but asserts only that six attempts were counted. `countOf` reads `LIKE %key%` with `LIMIT 1` (231 to 233), arbitrary row if two match. HAZARDS H50 (verifiers that sign in exhaust the limiter) is consistent with the 20 per 15 minutes figure this checks. `main()` at module scope.

### scripts/verify-machines.ts (393 lines)
- For: `verify:machines`: the lifecycle declarations in `lib/lifecycle/machines.ts` match their schema anchors, every state reachable, kind matches arrows, every dead-end or blocked state has an `exit`, blocked states we alone can leave carry a `promise`, every transition attributed, every screen path is a real route, working states only we can leave carry a promise.
- Decides: `mismatches` (56 to 69) with a two-sided planted control (169 to 188); `unreachable` (71 to 84) with a control (190 to 204); routes from `inventory.routes()` (323, derived, T3 clean) with a control (340 to 344).
- Assumes: `MACHINES[].anchor` is the schema's constant list (the claim "anchored to `lib/db/schema.ts`" lives in `machines.ts`, not visible here).
- Promises: the "nobody is stranded" priority (brief priority 4); A3/A4 only as far as the payment machine declares them.
- Notes: THE ANCHOR CONTROL IS FAKE (113 to 120): it builds two literal sets and asserts `!Set(["a","b"]).has("c")` and `!Set(["a"]).has("b")`, which are true regardless of the drift loop at 92 to 97; it would pass if that loop were deleted. `KNOWN_DEAD_ENDS` is empty (53) and the comment says so honestly: the gate proves no stopped state is DECLARED without an exit, not that none exists (the MAP's task 124 "rejected transfer is a dead end" is exactly a state that would only appear here if somebody declared it). The "exit is an action" check (265 to 278) is a verb regex over prose (`can|shown|send|...`); the header's "no screen offers it" (259 to 260) is not checked (wrong medium: the exit is judged by its wording, not by the screen). Screen paths are matched only as lowercase static segments (327), so a dynamic path (`/pay/[token]`) is never compared. Failure lists cut at 6 or 8 with no count (102, 157, 296, 336; T4). `main()` at module scope.

### scripts/verify-migrations.ts (426 lines)
- For: `verify-migrations.ts [--repair]` (C66, 11R.18 to 11R.20, 22.9, 80.2): journal vs ledger vs catalogue, one constraint per `DO $$` block in unapplied migrations, FK count, declared tables exist, no `NOT VALID` CHECK, `sessions.feedback_token` NOT NULL, three TypeScript unions equal their CHECK constraints.
- Decides: ledger agreement (114 to 118); block shape (128 to 166); FKs >= 90 (179 to 189); `H1` tables (192 to 212); `convalidated` (224 to 238); unions `PATIENT_NOTICE_KINDS`, `MANUAL_PAYMENT_STATES`, `MANUAL_PAYMENT_PURPOSES` vs `pg_get_constraintdef` as sets (291 to 351), with a parse control (362 to 374).
- Assumes: drizzle's hash is sha256 of the file text (58 to 76).
- Promises: P2 (the 80.2 notices union: the reason the P2 fix silently failed on production, 257 to 276), A1/A3/A4 (the manual payment state and purpose unions).
- Notes: `--repair` WRITES `drizzle.__drizzle_migrations` rows with NO `writesTo()` guard at all (94 to 97): pointed at production it records migrations as applied without `I_MEAN_PRODUCTION`. `objectsPresent` (392 to 424) checks only `CREATE TABLE IF NOT EXISTS` names and `ADD COLUMN IF NOT EXISTS` names; a migration whose tables exist but whose constraints, triggers, indexes or data statements never ran is recorded as applied, and then never runs (the header's "cannot be fooled" at 389 to 390 is only true for tables and columns). The ledger check (114 to 118) compares COUNTS, not the hash sets: a ledger holding one stale hash (an edited migration) and missing one real migration reports agreement; `missing` (79) is computed and only used by `--repair`. `fks >= 90` (187) is a typed number. `UNIONS` is a deliberately hand-typed short list (281 to 307). A union whose CHECK is absent prints and passes (318 to 327). `.sql` read with its own comment stripper (139 to 141), not a `.ts` read (T1 not applicable). `main()` at module scope.

### scripts/verify-money-cycle.ts (427 lines)
- For: `verify:cycle` (76.22): one full cycle on real rows: pot opened with welcome credit and topped up by transfer, a guest pays a session by transfer, a clinician pays two invoices by transfer, a fourth transfer is rejected; ledger balances; the board counts it.
- Decides: via product functions `openPot`, `openCart`, `submitProof`, `confirmPayment(..., onConfirmed: grantFor)`, `rejectPayment`, `sessionTransferMoney`, `billLines`, `unbalancedTransactions`. Asserts pot credited the credit not the gross (192 to 196), legs sum to zero (202 to 206), VAT on top 2000 to 2280 (222 to 226), session becomes paid only on confirm (255 to 259), invoices settled (303 to 307), rejection moves no money (341 to 345), no unbalanced txn with a planted-offender control (354 to 380).
- Assumes: `writesTo()` (68). The EGP rate and VAT (14%) of the database.
- Promises: A1 (partly kept: `payment_status` becomes `paid` after `confirmPayment`, 252 to 259; there is no assertion that it was still `pending` after `submitProof` and before confirm), A3 (partly: the rejection's `reason` is passed, 328, and never read back), A4 (not exercised), E1 (no), T3 (no).
- Notes: CLEANUP LEAKS A PERSON EVERY RUN. The `finally` deletes `patients` (416) and then `people WHERE id IN (SELECT person_id FROM patients WHERE ...)` (417 to 418), which by then matches nothing; `patients.person_id` is `ON DELETE SET NULL` (`lib/db/schema.ts:584`), so the order does not fail, it just leaves a `people` row "Nour Demo" behind on every run. `verify-money-edges.ts:747 to 749` has the right order. Ledger legs are deleted by memo and by `ref_id` in sponsors only (400 to 402); legs for the session payment and the invoice payment are removed only if their `organization_id` or memo matches, which this file does not delete by (edges does, 729). The "books balance" check (354) reads the WHOLE ledger: any unbalanced txn anywhere on the branch (for example `verify-actuals.ts`'s own planted unbalanced txn if that run died before its `finally`) turns this red. The board check (389 to 393) is `>= 3` and `>= 1` over the week, not a delta, so it passes on any branch with prior activity. The operator is a `users` row with role `admin` in the fixture practice (91 to 94); `confirmPayment` takes a `byUserId` and no Actor, so staff authorisation for Confirm is not exercised. `main()` at module scope.

### scripts/verify-money-edges.ts (758 lines)
- For: `verify:edges` (76.33): covered-employee money edges on real rows: half coverage at booking, patient asked for the other half, card quote equals transfer quote, split shown, VAT recorded on the share, one payment row with both halves, clinician paid on full price, Confirm twice moves nothing, 100% coverage, 0% coverage keeps enrolment, coverage lowered after booking, empty pot, free session, pot trace names nobody, cancel cart, cannot cancel a claim with proof, ledger balances, per-session cost not multiplied by joins.
- Decides: via `payFromPot`, `patientOwesFor`, `sessionLines`, `sessionTransferMoney`, `openCart`, `submitProof`, `confirmPayment`, `priceFor` (from `app/pay/[token]/actions`), `potTrace`, `potSpendAgrees`, `cancelCart`, `unbalancedTransactions`, `sessionCosts`. Controls: the naive `price_cents` read is double (189 to 196), planted unbalanced leg (611 to 622), the single-join query really triples (687 to 698), a claim with proof cannot be cancelled (570 to 596).
- Assumes: `writesTo()` (62). `PRICE = 2000` is 1,000 EGP "at the seeded rate" (58) and VAT 14% (1140, 215).
- Promises: A2 KEPT for a session transfer (348 to 358: legs and pot balance unchanged after a second `confirmPayment`). E3 KEPT (433 to 437). E4 KEPT at the data level (402 to 408: enrolled, owes full price; "no screen says they were removed" not checked). E5 partly (458 to 464: pot takes nothing, full price owed; "the screen says who to ask" not checked). E1 partly (503 to 507: pot trace rows carry no planted first name; checked by regex of six names, not by a property of the query). T3 not touched. A4 not touched.
- Notes: pot state is set by raw `UPDATE sponsor_pots SET balance_cents, coverage_bps` (104 to 106, 364, 385, 414, 421, 443, 470), bypassing the ledger; scenario 11's `potSpendAgrees` compares sessions to ledger, so this does not break it, but the pot balance and the ledger disagree for the whole run. Sessions, enrolments and the `session_payments` row in 16 are raw inserts (128 to 140, 661 to 664). The header says "sixteen scenarios" (606); there are 13 numbered sections plus "16". Confirm uses an `admin` fixture user id with no Actor (same as the cycle). `main()` at module scope.

### scripts/verify-money.ts (285 lines)
- For: `verify:money` (76.x, 76.46): no dollar figure is rendered as bare JSX text (must be `<Money>`), no `<Money>` inside a template literal, `components/ui/money.tsx` asks the server and converts on demand, only settling surfaces call `quoteFor`, the pricing page and settings actions use `egpRateMicro`.
- Decides: `TEXT_POSITION` regex per line over every `.tsx` in `app` and `components` except four named pay-in-pounds screens (46 to 51, 79 to 98), controls both ways (110 to 117, 147 to 151); `quoteFor` caller set vs `SETTLES` (224 to 263) with a control that the settling callers are found.
- Assumes: `readSource` everywhere (T1 clean).
- Promises: E3 / T3 adjacent (a price is shown consistently); not a money-movement check.
- Notes: the render scan is line-based: a line containing any backtick or `${` is skipped entirely (92), so a bare `{formatUsd(x)}` on a line that also builds a template string passes; a formatter split across lines (`{\n  formatUsd(x)\n}`) is not seen; only the first offender per file is reported (95). The "exempt deliberately" check (184 to 188) is `readSource(f).length > 0` for four files: it cannot fail except by throwing on a missing file. `money.tsx` checks are SYNTAX (`egpFor(cents)`, `setTimeout(reveal`, 162 to 177). `main()` at module scope.

### scripts/verify-notices.ts (161 lines)
- For: `verify:notices` (P2's cited enforcer): `notify()` writes the in-app `patient_notifications` row before sending, and the number of `notify(` sender files without a `notice: {` argument only falls (baseline 18).
- Decides: `senders()` walks `lib` and `app` (74 to 79); `unwired` is a file-level test for `notice:\s*\{` (82 to 85); two outbound-only exemptions with reasons (49 to 54) and a stale-exemption check (142 to 151).
- Assumes: comments stripped via `stripCommentsKeepingLines(readFileSync(...))` (71), equivalent to `readSource` (T1 clean).
- Promises: P2. BROKEN in most places, by this file's own ratchet: 18 sender files still send with no in-app home (46). Grep today: 27 files under `lib`/`app` mention `notify(`, and only 3 pass `notice: {` (`lib/sessions/started-notice.ts`, `lib/data/session-invite.ts`, `lib/billing/payment-notices.ts`). The three P2 names (an invitation, a payment confirmation, a session starting) are exactly those three, so the walk's P2 can pass while `app/(public)/t/[id]/book/actions.ts`, `app/(app)/bookings/actions.ts`, `app/(patient)/patient/claim/actions.ts`, `app/(patient)/sessions/[id]/recovery-actions.ts`, `lib/data/portability.ts`, `lib/data/phone-change.ts`, `lib/checkins/send.ts` and others remain email-only (some of those are to staff or clinicians, which the rule exempts; this gate cannot tell which).
- Notes: the wiring test is per FILE, not per call: one wired call makes every other `notify(` in that file count as wired. `components/` is not walked. The "written before the channels" check (105 to 112) compares the first `indexOf` of two identifiers in the file (syntax). The CONTROL (129 to 133) needs `missing.length > 0`: on the day the backlog reaches zero, the control fails. It also cannot see the defect `verify-migrations.ts:257 to 276` records (the DB CHECK refusing the new kinds while `notify()` swallows the error at warn), which is exactly how this gate passed while P2 was broken on production. `main()` at module scope.

### scripts/verify-nul.ts (185 lines)
- For: `verify:nul` (C245): no `.ts`/`.tsx` file under `lib`, `app`, `components`, `scripts`, `tests`, or `middleware.ts` contains a NUL byte.
- Decides: raw bytes on purpose (38 to 41, correct, not T1); count > 400 (129); planted control in tmp at a known line (148 to 168); `facts.ts` named (175 to 180).
- Assumes: `SKIP` names skipped at every depth (52 to 60), H31's shape, but none of those names is a real source directory here.
- Promises: none directly; it is what keeps every grep audit (including this reading) honest.
- Notes: sound, a model of T2. The `facts.ts` check requires the literal `JSON.stringify([fact.domain` (178), a syntax pin. `main()` at module scope.

### scripts/verify-palette.ts (359 lines)
- For: `verify:palette`: `teal-*` only in radar/live files, no brand/teal shade outside 50 to 900, no `text-white` on brand/teal 400/500/600, no `text-brand|teal-600` at small sizes, no `text-slate-500` on resting `bg-slate-100`.
- Decides: file allow-list `TEAL_FILES` + `components/radar/` (76 to 86); line-based regex sweeps (133 to 348); contrast arithmetic recomputed from `BRAND`/`TEAL` hex tables (99 to 123).
- Assumes: comments stripped via `stripCommentsKeepingLines(readFileSync(...))` (66 to 68; T1 clean, this file is one of T1's named historical offenders and is fixed).
- Promises: none of the 25 (accessibility).
- Notes: TWO FAKE CONTROLS. "a shade the block does not define would be caught" (187 to 191) asserts `!("950" in BRAND)`, a fact about a constant typed into this file; the `offRamp` loop is never run against a planted `teal-950`. "the same sweep still catches a white-on-teal button" (255 to 260) re-runs two regexes on a string instead of the `whiteInk` loop, and omits 600 and the slate/navy exemption. The allow-list control (153 to 158) is real. The hex ramps (99 to 108) are a checker's own copy of `app/globals.css` ("Kept here so the check can MEASURE"); nothing asserts they still equal the CSS, the H47 shape ("a checker holding its own copy of a number stops matching"). The white-ink exemption (235) skips any line that also contains `bg-slate-N text-white` or `bg-navy-N text-white`, so a conditional class string holding both passes. Line-based: a `cn(...)` split over lines is invisible. `walk` skips `node_modules`/`.next` by name at every depth (90; H31 shape, harmless here). Lists cut at 6 or 8 (143, 184, 245, 297, 346; T4). `main()` at module scope.

### scripts/verify-payout.ts (313 lines)
- For: `verify:payout` (76.57): money out: refuses more than held, a second request in flight, self-approval, sent with no receipt, rejection with no reason; ledger moves on send; receipts undeletable.
- Decides: via `requestPayout`, `approvePayout`, `markPayoutSent`, `rejectPayout`, `isUndeletable`, `deleteDocument`. Planted refusals with positive controls (125 to 208); ledger `therapist_payable` owed 4000 after a 6000 payout of 10000 (216 to 226); receipt vs licence path (256 to 285).
- Assumes: `writesTo()` (55); sweep before and after (75, 287).
- Promises: T3 partly (the ledger moves from `therapist_payable` on send, 216 to 226; netting of fees against earnings is not exercised). A1 analogue for money out (approve before send). Priority 2 (money twice): the second-request refusal (152 to 162) is kept.
- Notes: the approver is a `super_admin` fixture user, and the self-approval refusal is proved, but `approvePayout` (`lib/billing/payouts.ts:301 to 345`) has NO role check of its own: it refuses only the requesting clinician, the last editor of the payout details and, above a threshold, the owner. So "a DIFFERENT person can approve it" (190 to 196) would pass for any other user id; staff-only approval lives, if anywhere, in the server action (not visible from this slice). The empty-reason rejection (239 to 249) has no positive control (a rejection with a reason is never shown to succeed), and it runs after the request is already `sent`, so it would also be refused by state if the reason guard moved below the state check. `rejectPayout` notifies the clinician by email only, with no `notice` (payouts.ts:471 to 478). The sweep deletes `audit_log` rows for the fixture org (305). `main()` at module scope.

### scripts/verify-physics.ts (261 lines)
- For: `verify:physics` (76.60): the AI cost benchmark in `evals/physics.json` recomposes to its stored 50 minute figure, its transcription price equals the settings rate, it measured a session of at least 50 minutes, the `agreement` detector flags +40% and -45% and passes +8%, a zero benchmark disagrees, `fit()` refuses one duration cluster and accepts two.
- Decides: controls in both directions (126 to 131, 187 to 213, 246 to 253).
- Assumes: `lib/finance/physics`; `getSettings()` for AI rates; `readFileSync` on JSON is correct (84 to 88).
- Promises: none of the 25.
- Notes: sound. `connect()` opens a pool that nothing uses (92) (settings come through `lib/settings`). A model missing from `aiRates` becomes 0 per minute (97 to 101) and fails loudly on 143, which is right. `main()` at module scope.

### scripts/verify-plan.ts (643 lines)
- For: `verify:plan` (sprint 72): the operating plan in `lib/finance/plans.ts` and engine `lib/finance/beta.ts`: offer schedule, payroll, seller load, welcome credit only for companies and equal to 50 sponsored sessions, cohort ageing, cliff month, cash identities, credit as cash cost vs discount as revenue foregone, ramp, purity, no import of billing, provenance labels, CAC excludes marketer salary, two support staff, plan worth buying at typical caseload, clinic seat 10% under solo, runway, break-even before month 6 with a two-seller control.
- Decides: arithmetic via `runPlan`, purity by regex over `beta.ts` (344 to 362), import scan (368 to 375), page order (623 to 632).
- Assumes: `readSource` for `.ts` (T1 clean).
- Promises: none of P1..A5 (internal plan). Touches the honesty rule the value statements name ("any forecast of what a clinician will earn" is refused on public copy): this file computes exactly such a forecast internally (528 to 533), which is fine because it is not published.
- Notes: many assertions are the typed literals its own comments warn against: `PLANS.length === 3` (35), `BETA.months === 3`, `openingCashUsd === 20_000`, every salary `=== 500` (71 to 75), `sellers === 3` (98), the `[0, 0.5, 0.5]` schedule (103 to 108), two support staff (464 to 466), and the "fifty sessions" credit (146). The PAYG comparison (485 to 494) treats `$1 room + $3 note` as charged on every session, while the README says the note fee is charged only where the patient consented (MAP contradiction 3). The purity regex `\bdb\b` (347) would fail on the word `db` in any identifier-like position. `main()` at module scope.

### scripts/verify-principals.ts (754 lines)
- For: `verify:principals` (58.6, 58.7, C336, C378, C379): every `lib/data/*.ts` and `lib/console/*.ts` module is declared in `SCOPE` with the principals that may reach it; no page or route reaches a clinical module as a principal not declared for it; no unguarded page reaches a clinical module unless it authenticates by capability; every sponsor and clinic `actions.ts` calls `audit(`.
- Decides: `GUARDS` map principal to guard names (53 to 60); `SCOPE` (77 to 296); `CAPABILITY_AUTH` identifier list (323 to 348); forward import graph over static and dynamic `@/` imports, stopping at `"use server"` modules and skipping `import type` (390 to 475); layouts skipped (540); `AUDIT_BY_DESIGN` five exemptions with reasons (672 to 683).
- Assumes: `loadSurfaces()` from `_surfaces.ts` supplies `files`, `body` (RAW source) and `code` (comments stripped; `_surfaces.ts:165 to 169`). THIS FILE USES `body`, NOT `code`, for the guard scan (526 to 527 via `principalsOf`), the capability scan (544) and the import graph (413): T1 CONFIRMED. A page whose only mention of `requirePatient(` or `resolveJoinToken` is in a comment is treated as guarded or capability-authenticated. (Imports inside comments only add false edges, which fail loud; the guard and capability misses fail silent.) The audit scan does strip comments explicitly (701), which is why the file's own C205 comment at 690 to 697 reads as if the whole file complied.
- Promises: E2 and C2 (the privacy walls), A5 (acts are logged), priority 1 and 5 of the brief. Verdict below.
- Notes, the serious ones: (1) FAKE CONTROL at 590 to 594: "the forward graph really resolves imports" asserts `modulesFrom(patientAccount).size >= 0`, true for an empty set. (2) CAPABILITY AUTH IS A BLANKET PASS: `hasCapabilityAuth` (356 to 358) is true when the page's source mentions any of ten identifiers ANYWHERE (including `listRadar` and `publicProfile`, which are public radar reads), and an unguarded page that passes it is then allowed to reach EVERY clinical module (542 to 546, `continue` with no scope check). A public page that renders the radar and also reaches `sessions` through a helper is reported clean. (3) Only `lib/data/` and `lib/console/` are tracked (388); clinical reads elsewhere (for example `lib/partner/*` behind `app/api/partner/v1/sessions/[ref]/transcript|note|summary|media`, `lib/ai/*`, `lib/transcript`) are invisible unless they import a tracked module (reads one of N places). (4) The clinic principal: `clinic` is declared NOT clinical (225), and the comment on `clinic-export` (238 to 245) says its rows come from `clinicSchedule` and `clinicBills` "and their shortened patient names". So the clinic portal is designed to show a shortened patient name and a schedule, and this gate is built to allow it: direct evidence for MAP contradiction 1 and against promise C2 ("Nowhere in the clinic portal is ... a patient name"). (5) Sponsor side: `enrolment`, `enrolment-verify`, `sponsor-integrations`, `sponsor-domains` are all non-clinical, so no sponsor page can be flagged for any read at all; E2's wall rests on those modules' own select lists, which this gate does not read. (6) 58.7 covers only files literally named `actions.ts` under `(sponsor)` and `(clinic)`, only for writes; partner and admin actions and all READS are unchecked, so A5's "every read is written down" is not this gate's claim. Breach text always prints `lib/data/` even for `console/` modules (557, 578). Lists cut at 8 and 10 with no count (555, 576; T4). `main()` at module scope.

### scripts/verify-profile.ts (374 lines)
- For: `verify:profile` (76.39, 76.40, C115, C311): one-tap invite from a patient profile creates a paid video session at the clinician's own rate with a join link; refusals for no contact and no rate; the profile and copilot page share one copilot thread; another practice's clinician gets null; source checks for avatar route, loader use, server-side rate, revalidation, session-to-profile link.
- Decides: via `inviteToSession` and `copilotViewFor` (product functions with an Actor); controls: unreachable patient refused with no session created (146 to 166), zero rate refused (175 to 182), cross-practice null (218 to 242).
- Assumes: `writesTo()` (44); `readSource` for all source (T1 clean).
- Promises: T4 (partly: the link exists and points at the row's token, 132 to 136; the "Joining as" vs "asks a name" half is not here). T5 (partly: another practice's clinician is refused the copilot view, 238 to 242; revoke-stops-next-question is not here). P4 adjacent.
- Notes: the source checks are SYNTAX pins: the exact signature `export async function inviteToSession(actor: Actor, patientId: string)` and `inviteToPaidSession(patientId: string)` (322 to 327), the literal template `revalidatePath(\`/patients/${patientId}\`)` (339), and `href={\`/patients/${row.session.patientId}\`}` (352). The C115 check was rewritten once for exactly this trap (261 to 277) and the others were not. Cleanup does not remove any `audit_log`, notification or ledger rows the invite may have written. `main()` at module scope.

### scripts/verify-prove.ts (314 lines)
- For: `verify:prove` (80.1, 80.2): every value statement id appears as a whole word in `docs/PROVE-IT.md`, every scenario has a seed and a `verify:demo` command, no scenario claims an unknown id, every id is claimed, at least three per audience, no promise fails `honestyProblems`, positions differ in money shape, `docs/VALUE-STATEMENTS.md` equals `document()`, the walk says what it cannot prove, and the nine page-and-phrase citations are found on the named page.
- Decides: controls: `Z9` not found (82 to 86), honesty checker catches both rules (189 to 193), citation parser finds exactly 9 and P1's phrase is on home and not for-patients (303 to 309).
- Assumes: `_prove-doc.ts` and `_value-statements.ts` have no `main()` (the T6 fix, 216 to 228; confirmed by `_value-statements.ts:365` comment and `_demo-cast.ts:17`).
- Promises: all 25, as a documentation gate. MAP suspect 8 CONFIRMED from the code: the citation check reads `findDefaultPage` from `lib/content/defaults.ts`, not published `content_pages` rows (272 to 275 says so), so a promise whose phrase was edited out of the live page passes here.
- Notes: `readSource` is applied to a MARKDOWN file (53): the comment stripper treats `//` and `/* */` as comments, so any line in `PROVE-IT.md` with a URL (`https://...`) loses everything after the `//`. An id or `--scenario=` command written after a URL on the same line would be reported as missing (a false red, not a false green). "The walk says what it cannot prove" (249 to 253) is the literal strings `cannot prove`, `Cycle 5`, `Cycle 9`: syntax. `cited.length === 9` (307) is a typed count. `main()` at module scope, no side effects.

### scripts/verify-radar-place.ts (269 lines)
- For: `verify:radar-place`: every `therapist_radar.country` is a key of `lib/world-110m.json` and uppercase, nobody online with an undrawable country, no region equal to the country code; and (80.3) nothing in three named files decides presence or listing on `therapist_radar.demo`.
- Decides: reads all radar rows (47 to 55); planted-in-memory control for `'eg'` (128 to 133); `DECIDES` operator regex per line in `PRESENCE_FILES` = `lib/data/radar.ts`, `lib/data/discover.ts`, `lib/data/radar-admin.ts` (192 to 239) with a two-sided control (249 to 258) and a "saw at least 3 reads" control (260 to 264).
- Assumes: `writesTo()` (38) although it only reads (so it refuses production, where the question matters most). `readSource` (T1 clean).
- Promises: P1 (somebody free now can be seen and tapped), C1 (on the radar).
- Notes: MAP SUSPECT 2 ANSWERED, and the gate misses one: `PRESENCE_FILES` is a hand list of three, and grep finds a fourth decision on the flag outside it: `lib/console/reads.ts:86` `eq(therapistRadar.demo, true)` inside `radarNow()`, the admin Total View's "who is on the radar now" query, which includes every demo row regardless of heartbeat. Admin-only, not public, but it is exactly "the column decided upon", and it is in the file `verify-principals` calls the clinical console reader. Every other `.demo` hit under `lib`, `app`, `components` is a projection or a badge (`components/radar/therapist-card.tsx:125`, `components/patient/therapist-card.tsx:50`, `components/admin/total-view.tsx:359`, `components/admin/radar-command.tsx:303`), or the unrelated CMS `block.demo`. The `DECIDES` regex counts `!` and `?` anywhere on a line containing the word `demo`, so an optional-chaining read (`row?.demo`) would be a false red. `required(rows[0], ...)` exits 1 on an empty radar (57): on a fresh branch this is "refuse to run", not a pass. `void main()` at module scope.

### scripts/verify-rail.ts (1889 lines)
- For: `verify:rail` (sprints 73 to 79; the enforcer the value statements cite for A1): the Egyptian manual transfer rail, entirely by reading source and two migration files. Sections: CHECK constraints and the one-live-payment partial unique index in `drizzle/0102_manual_rail.sql` (40 to 69); the queue module imports no money table (82 to 101); every transition conditions on the prior state in the WHERE (109 to 115); a session grant flips `sessions.paymentStatus` from `pending` (123 to 128); pot top-up idempotent by `NOT EXISTS` (136 to 140); unknown purpose is a `never` (142 to 146); payer screen and stepper render dictionary keys that exist in en and ar (168 to 268); rejection renders `{live.reason}` verbatim (270 to 274); company vs patient heading (286 to 290); details lock (299 to 304); `/admin/transfers` is `requireStaff` and oldest first, nav count (310 to 328); exactly three operator actions `confirm`, `reject`, `confirmUnclaimed` (354 to 363) and the three properties of `confirmWithoutProof` (371 to 392); both decisions audited with reason (394 to 399); sponsor pot re-asks the rail (415 to 429); `savePayouts` reads before writing (441 to 447); lock refuses save (455 to 460); audit records labels not account numbers (466 to 471); coverage slider needs Edit (483 to 502); receipt upload kind (509 to 514); 0106 `settles_cents` (529 to 536); grants spend `settlesCents` not `amountCents` (543 to 554); pot top-up journals three legs and credits net, guard before legs (570 to 627); one EGP conversion (636 to 650); three payers each re-ask (659 to 676); settles never from the request (698 to 762); waiting page refreshes (771 to 775); oldest-first invoice settlement (784 to 789); subscribe only bills (806 to 852); only paid obligations grant (863 to 868); leaving a clinic lands on payg (877 to 884); clinic admin cannot suspend (892 to 902); seat proration billed and downgrade is credit (912 to 946); rail-deciding columns have writers and screens (969 to 1009) and refuse to move with money on them (1019 to 1024); session transfer posts `postSessionPayment` once, held not routed (1049 to 1081); Egyptian VAT quoted and derived from money arrived, on the payer's share (1101 to 1209); `PaymentPopup` only on payer surfaces, names its payer, patient orb under SOS (1228 to 1358); bill picker lines and totals (1369 to 1467); `decidedAt` by DB clock (1504 to 1519); no invite without a room, arrival heals, deferred paths mint a join token (1544 to 1731); no path cancels a paid or joined session (1765 to 1816); room expiry from session hour, heal checks expiry (1836 to 1856); video health in console (1879 to 1884).
- Assumes: `readSource` for every `.ts`/`.tsx` (T1 clean for source). `readFileSync` on two `.sql` files (24, 529) with comments IN (a constraint name mentioned only in a SQL comment would pass).
- Promises: A1 (the value statements cite this file as where A1 is said). A2 (1064 to 1069, second Confirm posts nothing: by source). A3 (270 to 274, the payer's screen renders `live.reason`: by source, one screen). A4 (354 to 392, `confirmUnclaimed` with reason). E3/E5 (the payer's share, 724 to 745). T3 (1077 to 1081, held not routed). P5 (1339 to 1345). Verdicts in Promise evidence.
- Notes: WRONG MEDIUM throughout. This file never touches a database. The CHECK constraints and the unique index (40 to 69, 529 to 536) are read from the MIGRATION FILES, not `pg_constraint`/`pg_indexes`: a later migration dropping or replacing one, or a hand fix on production (C66 records exactly that), leaves this green; `verify-migrations.ts` checks only three unions and `NOT VALID`, not these names. Almost every other check is a SYNTAX pin on an exact expression (`const unreachable: never = payment.purpose`, `z-[60]` vs `z-[70]`, `pb-20`, `/was not pending[\s\S]{0,220}?\n\s*return;/`, `select({ region: organizations.region })` exactly twice, `balance_cents = balance_cents + ${net}` and `10_000 + vatBps`, `Math.max(0, payment.settlesCents - \w+)`, etc.). The file's own comments record three of these going red on correct improvements (157 to 167, 686 to 697, 710 to 723, 1166 to 1186) and the file's own 1470 to 1477 note says source is "the weaker kind of evidence here". P5 is asserted as two Tailwind z-index class names in two files (1342 to 1343); a stacking context between them would put the payment orb over SOS with this check green. Several CONTROLS re-run a regex on a literal string instead of the pipeline (96 to 101, 550 to 554, 747 to 762, 833 to 837, 898 to 902, 927 to 933, 1127 to 1131); the "one language only" control (261 to 268) tests a local `pretend` object and never runs `monolingual` on anything (fake). The paid-session cancel guard (1783 to 1797) is FILE-level: a file that mentions `paymentStatus` and `patientJoinedAt` anywhere passes, and four files are exempt wholesale, including `lib/data/sessions.ts` and `lib/data/scheduling.ts`, so any future automatic cancel added to either is invisible. The rejection-reason check covers `components/billing/pay-by-transfer.tsx` only; whether a GUEST payer (payer kind `session`, MAP suspect 4 / task 124) ever reaches that component after a rejection is not asked. `main()` at module scope.

### scripts/verify-raw-sql.ts (186 lines)
- For: `verify:raw-sql`: every snake_case identifier inside a whole-statement `sql\`...\`` template in `app` and `lib` is a column of a table that statement names, checked against live `information_schema`.
- Decides: file list from `grep -rl` (72 to 77); comments stripped via `stripCommentsKeepingLines(readFileSync(...))` (105, T1 clean); fragments that do not start with SELECT/INSERT/UPDATE/DELETE/WITH are skipped (121); a word is flagged only if it is a column somewhere or ends in a column-ish suffix (154).
- Assumes: `controlDb` from `@/lib/db`; reads only, no `writesTo`, so it can run on production (the right database for "is it there").
- Promises: none directly; it is what would have caught the `/sponsor/integrations` 500 (E1/E2 surface).
- Notes: NO CONTROL (T2): if `grep` finds no files or the regex matches no templates, it prints "ok" and exits 0; nothing plants a bad column. The template regex `sql\`([\s\S]*?)\`` stops at the first backtick, so a statement containing a nested template in `${}` is cut short. Fragments are skipped entirely, so a wrong column in a `sql` WHERE fragment inside a query builder (the commonest raw SQL shape) is never checked. `scripts/` excluded by design (66 to 71). `void main()` at module scope.

### scripts/verify-reachable.ts (432 lines)
- For: `verify:reachable` (58.1 to 58.9, C335, C356, C369): every server action reachable from a rendered page, every API route has a caller or a reasoned allow-list entry, every page is linked, named safety exports are wired, the dead-export count only falls, no stale exemption.
- Decides: via `_surfaces.ts` helpers (which strip comments, per the C205 control at 385 to 427); `ROUTES_BY_DESIGN` three entries (54 to 75); `MUST_WIRE` six entries (194 to 256); `DEAD_EXPORT_BASELINE = 96` (101). Planted-action and planted-route controls in both directions (320 to 427). T2 honoured.
- Assumes: `_surfaces.ts` graph; reads source only.
- Promises: A4 indirectly (`unbalancedTransactions` must be wired), E1 (`potBalance`, C229 anti-differencing floor, 195 to 196), brief priority 4 (screens with no door).
- Notes: THE RATCHET HAS RISEN. The comment at 94 to 99 says "87 exported safety functions have no caller ... it must never rise"; the constant is 96. Somebody raised the floor by nine. The `MUST_WIRE` reasons are written in the present tense of the defect ("nothing calls it", 217; "no event has ever fired", 215; "nothing asks it", 232): if this gate passes, every one of those sentences is stale; if it fails, the gate is red. Either way the prose is wrong about one of the two. "Linked from somewhere" is an import-graph and string property, not "a principal can reach it after signing in". `main()` at module scope.

### scripts/verify-runbook.ts (463 lines)
- For: `verify:runbook` (76.62, H47): the simulation documents: no production-only command written without `on:production`, "N gates" claims equal `GATES.length`, edge-count claims equal the rows in `09-THE-EDGES.md`, cross-references and repository paths resolve, cron job names exist in the route, no document denies that the run is on production, no archaeology outside `00-LESSONS.md`.
- Decides: production-only set parsed from `scripts/on-production.ts` via `readSource` (104 to 107) with a control (128 to 132); gate claims (136 to 168); edges (175 to 198); references (202 to 217); pointers with `NOT_YET` exemption (253 to 326); cron jobs parsed from `app/api/cron/[job]/route.ts` (336 to 354); denial phrases with a control (370 to 421); archaeology phrases (430 to 458).
- Assumes: markdown read raw with `readFileSync` (correct for `.md`).
- Promises: none directly (the run's documents).
- Notes: the EDGE COUNT CHECK HAS A HOLE AT EXACTLY THE DEFECT ITS HEADER NAMES. `okEdge = new Set([String(edgeIds.size), "forty eight"])` (187): "forty eight" is always accepted, so a document saying forty eight while the file lists thirty (the header's own example, 22 to 23 and 172 to 173) passes. Gate-count words only cover 26 to 35 (154 to 158); past 35 a spelled-out count becomes invisible, the exact failure its comment at 145 to 153 describes. The production-only parse depends on the `name: { writes:` layout of `on-production.ts` (106). Lists cut at 5, 6 or 8 (216, 297, 412, 448; T4, some with "and N more", some without). `main()` at module scope.

### scripts/verify-served.ts (412 lines)
- For: `verify:served` (76.30, 76.61, H37, H39): boots `next dev` on 3199 into `.next/served`, warms every static route from `inventory.routes()` plus four named, runs `verify:sprint31` and `verify:contrast` (partial grid `en1280,ar390`) against it, fails on any non-zero exit or any "deferred to a running server", correlates browser "no response" with the server log, kills `next-server` processes by pid difference.
- Decides: `NEEDS_A_SERVER` (44); `PARTIAL` (58); warm list derived (215 to 224, T3 fixed); pid snapshot and difference kill (351 to 412).
- Assumes: `VERIFY_URL` if set is used instead of booting (75); child verifiers inherit the full environment (249 to 253).
- Promises: none directly.
- Notes: header 29 to 30 says "IT READS ONLY ... safe against any branch, production included". It spawns `verify:contrast`, which SIGNS IN as five real founder addresses with the demo password (verify-contrast.ts:164 to 238): against production that is five real authentications that bump `rate_limits` (H50) and write session rows; "reads only" is not true of what it runs. Warming GETs every static route including any non-dynamic API route `inventory.routes()` returns, with side effects only as safe as each route's GET. The kill-by-difference (404 to 411) would also kill a `next-server` somebody else started during the run. `main()` at module scope.

## Stale

- scripts/ship-content.ts:28 to 30, "it refuses `--yes` as a substitute for reading that": there is no prompt; it prints the host and proceeds.
- scripts/settings.ts:709 to 711 vs 712 to 717: "reprice keeps the guard", "rails keeps it too", then both are `productionIsAllowed: true`.
- scripts/settings.ts:89 to 91: "every remaining field in the stored sponsor row already equals its default", a dated fact presented as the safety argument for an overwrite.
- scripts/simulate-seed.ts:58, "three scripts and two documents import it from here": no importer of `simulate-seed` exists.
- scripts/shoot-room.ts:294, "the five states are the whole ticket": four are driven.
- scripts/verifiers.ts:45 to 47, "read-only with one exception the pass names ... none of them writes": no exception is named, and most run verifiers plant and delete fixtures.
- scripts/verify-actuals.ts:115 to 116, "Balancing pairs are used anyway, so nothing here would fail a trial balance": the planted txn (123 to 129) sums to -8,940.
- scripts/verify-c285.ts:23 to 24, surfaces "the clinic list and the clearance gate": never exercised. 197 to 198, "Called with a synthetic key": the partner endpoint is gone.
- scripts/verify-cast.ts:227, "the three seeded people": the check reads all seven of PAYROLL.
- scripts/verify-email-dns.ts:252 to 258, "SPF names Zoho ... so SPF fails on every transactional message": contradicted by 84 to 99 (the `send.` subdomain SPF aligns under `aspf=r`).
- scripts/verify-boundary.ts:41 to 42, "a bare identifier known to be a function is refused": no code does this.
- scripts/verify-money-edges.ts:606, "these sixteen scenarios": thirteen sections plus one numbered 16.
- scripts/verify-reachable.ts:94 to 99, "87 ... must never rise" vs `DEAD_EXPORT_BASELINE = 96` (101): the floor was raised.
- scripts/verify-reachable.ts:215, 217, 232: `MUST_WIRE` reasons say "no event has ever fired", "nothing calls it", "nothing asks it"; if the check passes these describe a past state.
- scripts/sync-blocks.ts:111 to 112, "If nothing matches, append": code returns 0 (top of page) at 122.
- scripts/sync-blocks.ts:45 "the fifth door" vs HAZARDS.md:231 "four do" (`settings`, `simulate-seed`, `age`, `migrate`); `sync-blocks` is at least a fifth, and `settings.ts` opens it for two verbs.
- scripts/verify-principals.ts:690 to 697: C205 comment reads as covering the file, but only the audit scan strips comments; the guard scan reads `s.body` raw.
- scripts/verify-palette.ts:98, ramps "kept here so the check can MEASURE": a copy of `app/globals.css` nothing compares to the CSS.
- scripts/verify-machines.ts:259 to 260, "'Contact support' is not an exit if no screen offers it": the check is a verb regex, it never looks at a screen.
- scripts/verify-served.ts:29 to 30, "IT READS ONLY ... production included": it runs `verify:contrast`, which signs in.
- HAZARDS.md:231 to 235 (outside slice) "exactly those four": see sync-blocks above.

## Suspect

- scripts/simulate-seed.ts:295 to 304: "exactly ONE platform organisation" counts `organizations WHERE kind = 'solo'`; `kind` defaults to `'solo'` and is every solo clinician's own org (`lib/db/schema.ts:165`, `:8351`). Fails on production as soon as any solo therapist exists; on an empty branch passes measuring the wrong thing. Matters because `simulate:seed` is the run's first production command. Answer: run it against a production-shaped branch.
- scripts/verify-limits.ts:223 to 228: `freshLimiter` clears `require.cache` but imports ESM with a query string; if `SIMULATION_RUNNING` is read in `lib/env`, the second import reuses the cached `lib/env` and the "widened" check measures the unwidened limiter (red, not false green). Answer: `lib/rate-limit.ts`, `lib/env.ts`.
- lib/billing/payouts.ts:301 to 345 via scripts/verify-payout.ts:190 to 196: `approvePayout` has no role check; any user id other than the requester (and last editor) approves. Whether only staff can call it depends on the server action. Answer: `app/(admin)/admin/payouts/actions.ts` (slice with `app/(admin)`).
- scripts/verify-principals.ts:240 to 243: `clinic-export` rows come from `clinicSchedule` and `clinicBills` "and their shortened patient names"; `clinic` declared non-clinical. Promise C2 says no patient name anywhere in the clinic portal. Answer: `lib/data/clinic.ts` select lists and the clinic pages.
- scripts/verify-principals.ts:77 to 296: sponsor modules (`enrolment`, `enrolment-verify`, `sponsor-integrations`, `sponsor-domains`) are all declared non-clinical, so E2 rests entirely on their select lists, which no gate reads. Answer: `lib/data/enrolment*.ts`, `lib/data/sponsors.ts`.
- scripts/verify-money-cycle.ts:400 to 420: ledger legs for the session and invoice payments are not deleted by organisation; if `ledger_entries.organization_id` has a FK the org delete fails and the fixture org leaks, otherwise orphan legs accumulate on dev. Answer: schema FK on `ledger_entries.organization_id`.
- scripts/verify-entitlement.ts:237 to 243: cleanup deletes invoices, obligations, subscriptions, org, but not ledger legs that `settleOldestObligationByTransfer` or `applySeatChange` may post. Same answer.
- scripts/verify-prove.ts:53: `readSource` on markdown strips everything after `//` on a line (URLs), a false red for any id or scenario command after a URL.
- scripts/check-live.ts:219 (outside slice, imported by smoke-public): `if (process.argv[1]?.includes("check-live")) void main();` is a SUBSTRING guard, weaker than the suffix guard T6 forbids and not caught by the `verify:traps` rule as described (which looks for "ends with").
- app/api/uploads/[...path]/route.ts and app/api/uploads/[id]/route.ts (outside slice, seen while counting routes): sibling dynamic segments with different names at one level; Next.js normally refuses to build with "different slug names for the same dynamic path". The `[id]` directory is dated 2026-09-22 22:13. If the build rejects it, production cannot deploy. Answer: `npm run build`, or whoever reads `app/api`.
- scripts/verify-rail.ts:1339 to 1345: P5 held by two class names (`z-[60]`, `z-[70]`) in two files; a stacking context would invert them while green. Answer: render the pay page with SOS in a browser.
- scripts/verify-notices.ts:82 to 85: wiring counted per file; a file with one wired and one unwired `notify(` counts as wired. Answer: per-call audit of the 27 files.

## Broken

- scripts/verify-money-cycle.ts:416 to 418: cleanup deletes `patients` first, then `people WHERE id IN (SELECT person_id FROM patients ...)`, which is now empty; `patients.person_id` is `ON DELETE SET NULL` (`lib/db/schema.ts:584`). Every run of `verify:cycle` (a gate) leaves a `people` row "Nour Demo" on the branch. `verify-money-edges.ts:747 to 749` has the right order.
- scripts/verify-actuals.ts:224 to 227 and 509 to 514: when a video cost already exists for that month, the upsert changes only `amount_cents` and leaves `note` alone; the `finally` restores with `WHERE note = 'verify'`, which matches nothing. Each run permanently adds 700 cents to that month's video cost on the branch, and the next run's `videoWas` reads the inflated figure.
- scripts/verify-machines.ts:113 to 120: the "anchor catches an invented state and a dropped one" CONTROL asserts facts about two literal sets and never runs the drift loop; it passes with the loop deleted.
- scripts/verify-principals.ts:590 to 594: the "forward graph really resolves imports" CONTROL asserts `size >= 0`; it cannot fail.
- scripts/verify-principals.ts:351 to 358 and 526 to 546: guard and capability detection read RAW source (`s.body`, not `s.code`, `_surfaces.ts:165 to 169`), so a guard or a capability name in a comment counts (T1); and any capability identifier (including `listRadar`, `publicProfile`) exempts an unguarded page from ALL clinical-module checks with no scope test. A public page that shows the radar and reaches `lib/data/sessions` passes the privacy gate.
- scripts/verify-palette.ts:187 to 191 and 255 to 260: two controls that do not run the scans they claim to control (a constant membership test, and a regex re-run on a literal that omits 600 and the exemption).
- scripts/verify-rail.ts:261 to 268: the "one language only" control tests a local `pretend` object; the `monolingual` check is never exercised against a missing key.
- scripts/verify-runbook.ts:187: `"forty eight"` is always an accepted edge count, so the header's own example defect (a document saying forty eight while the file lists thirty) passes.
- scripts/survey-live.ts:64 to 90: the comment says "Every API route under `app/api`"; 20 of 32 route files are probed, and the missing ones include every partner clinical-data route (`/api/partner/v1/sessions/[ref]/transcript|summary|media|note`, `/api/partner/v1/notes/[sessionId]`, `/api/partner/v1/subjects/[ref]/memory|readers`) and `/api/meetings/transcript/[sessionId]`. "No API route hands an anonymous caller a 200" is unproved for exactly the routes where it matters. The final "CONTROL" (291 to 295) repeats an earlier assertion.
- scripts/verify-cast.ts:252: the Ziad (P6) "never signed up" control looks for keys starting `ziad.`; the same file (136 to 148) says a self-signed-up patient has no email and is keyed by phone digits, so the real sign-up path is invisible to it.
- scripts/verify-migrations.ts:114 to 118: journal vs ledger compared by COUNT, not hash set; a stale ledger hash plus a missing migration reports agreement. `--repair` (81 to 105) writes the production ledger with no `writesTo()` guard and records any migration whose tables and columns exist as applied, even if its constraints, triggers, indexes or data never ran (H17's failure mode, produced by the repair tool).
- scripts/unlabel-straddles.ts:57 to 67: writes `transcript_segments` with no `writesTo()`; runs against production without `I_MEAN_PRODUCTION`.
- scripts/verify-raw-sql.ts:170 to 174: exits 0 with "ok" on zero files or zero templates; no control.
- scripts/spend.ts:47 and 127 to 135: `--budget abc` gives NaN, both comparisons are false, and the budget guard prints "Inside the budget" and exits 0.

## Looks broken, is handled

- scripts/shoot-room.ts:178 to 181 writes `users.verification_status = 'verified'` directly; trigger 0083 (`users_verification_status_derived`) forces the column to the derived value, proved by `scripts/verify-c285.ts:104 to 117`, and the approved `therapist_verifications` row inserted at 164 to 176 makes it verified anyway.
- scripts/verify-csp.ts:31 to 33 imports from `audit-daily-hosts.ts` and `_i18n-coverage.ts`, both scripts with `main()`: both guard by exact basename, `ranDirectly("audit-daily-hosts.ts")` (`audit-daily-hosts.ts:187`) and `_i18n-coverage.ts:274`, per `_verify.ts:319 to 322`.
- scripts/verify-demo.ts imports from `_demo-cast` and `_value-statements`, and verify-prove.ts from `_prove-doc`: the T6 incident files, now split into underscore files with no `main()` (TRAPS T6, `_demo-cast.ts:8 to 17`).
- scripts/settings.ts:13 to 15 says `lib/settings` throws outside a request, while `verify-entitlement.ts:62` and `verify-physics.ts:95` import `getSettings`: both npm scripts run with `--conditions=react-server` (package.json lines 65, 194), which silences `server-only`.
- scripts/ship-content.ts calls no guard and so writes production freely: deliberate and documented (23 to 30, HAZARDS H26, C148); the safer surgical path is `scripts/sync-blocks.ts` with a real untouched-bytes control (284 to 290).
- scripts/verify-money-edges.ts:104 to 106 sets `sponsor_pots.balance_cents` by raw UPDATE, bypassing the ledger: `potSpendAgrees` (486 to 493) compares sessions to ledger, not balance, so the check it feeds is unaffected.
- scripts/verify-boundary.ts:86 to 90 reads raw source with `readFileSync`: deliberate, the `"use client"` directive's position is the property (80 to 85).
- scripts/verify-nul.ts reads raw bytes: deliberate, a NUL in a comment blinds grep too (36 to 41).

## Unclaimed

- (a) scripts/verify-caseload.ts:86 to 113: an in-person session with only a first name creates a `walk_in` chart attached to the session, so a walk-in lands on the caseload. Worth saying to clinicians; no promise names it.
- (a) scripts/verify-payout.ts:119 to 285: money out has four enforced refusals (more than held, a second request in flight, self-approval, sent without a receipt) and receipts are undeletable by rule. A clinician-facing trust claim nobody makes.
- (a) scripts/verify-money-edges.ts:208 to 230: card quote and transfer quote agree on a covered session; `sessionLines` shows what covered the rest. Would strengthen E3.
- (a) scripts/verify-rail.ts:1733 to 1816: nothing cancels a session somebody has paid for or joined (after a production incident). Worth a patient-facing promise.
- (b) lib/console/reads.ts:66 to 93 (found via verify-radar-place): the admin Total View `radarNow()` lists every `demo` clinician as present regardless of heartbeat, the exemption 80.3 removed everywhere else.
- (b) scripts/simulate-seed.ts:329 to 338 and 396 to 400: re-running the seed silently resets the operator's and every staff member's password to the simulation password and forces their roles. The pre-check at 221 to 231 refuses a second cast, so this only bites on a database with no clinic or sponsor, but on such a database it is an account reset with no confirmation.
- (b) scripts/verify-migrations.ts:94 to 97: an unguarded command that rewrites the production migration ledger.
- (c) scripts/verify-machines.ts:53: `KNOWN_DEAD_ENDS` is empty; the lifecycle declarations admit no stuck state, while MAP task 124 records a rejected guest transfer as a dead end. The register that would hold it (#163) is not built.
- (c) scripts/verify-notices.ts:46: 18 senders with no in-app home; a patient who loses the email has no door back for those messages.

## Promise evidence

- P1: scripts/verify-radar-place.ts:59 to 102 keeps "online with a drawable country"; the tap count is not checked anywhere in this slice. Cannot tell.
- P2: scripts/verify-notices.ts:46 and grep (27 files call `notify(`, 3 pass `notice:`). The three things P2 names (invitation, payment confirmation, session starting) are exactly the three wired files; everything else is email only. verify-migrations.ts:257 to 351 now checks the notice-kind CHECK that silently defeated the first fix. PARTLY: kept for the three named events, broken as the general sentence "nothing ... is only in an email".
- P3: not touched in this slice. Cannot tell.
- P4: scripts/verify-demo.ts:402 to 409 (Tarek: two versions, two clinicians, two practices) and :587 to 590 (append-only trigger re-enabled after the seed). Kept on the seeded data; the patient deciding readers is not checked here.
- P5: scripts/verify-rail.ts:1339 to 1345 (two z-index class names). Partly: the ordering is asserted as syntax, not as rendered stacking; "dials without passing anything about money" not checked.
- T1, T2: not checked in this slice. Cannot tell.
- T3: scripts/verify-payout.ts:216 to 226 (payable ledger moves on send), verify-rail.ts:1077 to 1081 (held not routed). Partly: netting of what is owed against earnings is not exercised by any verifier here.
- T4: scripts/verify-profile.ts:95 to 136 (invite creates a video session and a link to its token). Partly: the stranger vs signed-in patient behaviour is not checked.
- T5: scripts/verify-profile.ts:218 to 242 (another practice's clinician gets null). Partly: revocation stopping the next question is not checked here.
- C1: scripts/verify-c285.ts:180 to 247 (radar filters on the real verification, two second cache). Kept for the verification half; "same hour after a seat is added" not checked.
- C2: scripts/verify-principals.ts:225 and 238 to 245: the clinic module is declared non-clinical and its export carries shortened patient names and a schedule. BROKEN on the evidence of the gate's own declarations (or the README is right and C2 is wrong); verify:demo does not check it.
- C3, C4, C5: C4's mechanism (leaving a clinic lands on payg, no suspend) is asserted as source only (verify-rail.ts:877 to 902); verify-entitlement.ts:202 to 221 proves a prorated seat bill. Cannot tell for the promises as worded.
- E1: scripts/verify-money-edges.ts:486 to 507 (pot trace names none of six planted first names; spend agrees with ledger); verify-reachable.ts:195 requires the C229 anti-differencing `potBalance` to be wired. Partly: names checked by regex of known names, not by the query shape; the five-session published balance is not checked here.
- E2: scripts/verify-principals.ts: every sponsor module is non-clinical and the capability-auth and raw-source holes apply. Cannot tell from here; the gate that claims it has two holes (Broken).
- E3: scripts/verify-money-edges.ts:414 to 437. Kept.
- E4: scripts/verify-money-edges.ts:385 to 408. Kept at the data level; "no screen says removed" not checked.
- E5: scripts/verify-money-edges.ts:443 to 464, verify-demo.ts:517 to 531. Partly: pot takes nothing and the full price is owed; "the screen says who to ask" not checked.
- A1: scripts/verify-money-cycle.ts:252 to 259 and verify-entitlement.ts:135 to 154 (paid or entitled only after confirm/settle, via service functions called with a fixture `admin` user id and no Actor); verify-rail.ts (the cited enforcer) is source-only. Partly: the property holds in the functions; nothing here proves only staff can press Confirm, or that a submitted payment is still `pending` before confirm.
- A2: scripts/verify-money-edges.ts:344 to 358 (second `confirmPayment` moves no legs, no balance). Kept for a session transfer; pot and invoice double-confirm by source only (verify-rail.ts:622 to 627, 1064 to 1069).
- A3: scripts/verify-rail.ts:270 to 274 (payer screen renders `live.reason`), verify-demo.ts:507 to 514 (crisis position has a 15-word reason), verify-payout.ts:239 to 249 (empty rejection refused). Partly: the reason reaching a GUEST payer is not checked (MAP suspect 4 stands).
- A4: scripts/verify-rail.ts:354 to 392 (`confirmUnclaimed` needs a 10-char reason kept on the payment), verify-demo.ts:475 to 489 (an unmatched transfer on the queue). Partly: "overpayment ... with the difference visible" is not checked anywhere in this slice.
- A5: scripts/verify-principals.ts:672 to 749 (sponsor and clinic action files call `audit`), simulate-seed.ts creates staff roles. Partly: reads are not checked, admin and partner actions are not checked, and "refused screens redirect" is not checked here.

## Coverage

| File | Lines | Status |
|---|---|---|
| scripts/settings.ts | 750 | read |
| scripts/ship-content.ts | 91 | read |
| scripts/shoot-room.ts | 391 | read |
| scripts/simulate-seed.ts | 629 | read |
| scripts/smoke-public.ts | 300 | read |
| scripts/spend.ts | 156 | read |
| scripts/suites.ts | 141 | read |
| scripts/survey-live.ts | 300 | read |
| scripts/sync-blocks.ts | 325 | read |
| scripts/unlabel-straddles.ts | 77 | read |
| scripts/verifiers.ts | 179 | read |
| scripts/verify-actuals.ts | 542 | read |
| scripts/verify-age.ts | 228 | read |
| scripts/verify-board.ts | 269 | read |
| scripts/verify-boundary.ts | 433 | read |
| scripts/verify-c285.ts | 285 | read |
| scripts/verify-caseload.ts | 219 | read |
| scripts/verify-cast.ts | 295 | read |
| scripts/verify-claims.ts | 645 | read |
| scripts/verify-contrast.ts | 649 | read |
| scripts/verify-csp.ts | 324 | read |
| scripts/verify-demo.ts | 622 | read |
| scripts/verify-email-dns.ts | 274 | read |
| scripts/verify-entitlement.ts | 248 | read |
| scripts/verify-finance.ts | 608 | read |
| scripts/verify-limits.ts | 240 | read |
| scripts/verify-machines.ts | 393 | read |
| scripts/verify-migrations.ts | 426 | read |
| scripts/verify-money-cycle.ts | 427 | read |
| scripts/verify-money-edges.ts | 758 | read |
| scripts/verify-money.ts | 285 | read |
| scripts/verify-notices.ts | 161 | read |
| scripts/verify-nul.ts | 185 | read |
| scripts/verify-palette.ts | 359 | read |
| scripts/verify-payout.ts | 313 | read |
| scripts/verify-physics.ts | 261 | read |
| scripts/verify-plan.ts | 643 | read |
| scripts/verify-principals.ts | 754 | read |
| scripts/verify-profile.ts | 374 | read |
| scripts/verify-prove.ts | 314 | read |
| scripts/verify-radar-place.ts | 269 | read |
| scripts/verify-rail.ts | 1889 | read |
| scripts/verify-raw-sql.ts | 186 | read |
| scripts/verify-reachable.ts | 432 | read |
| scripts/verify-runbook.ts | 463 | read |
| scripts/verify-served.ts | 412 | read |

46 files, 18,524 lines (wc). `on-production.ts`, `seed-demo.ts` and `_demo-cast.ts` are not in this slice; the KEEP census is described only through `verify-demo.ts:543 to 590` (which checks three kept tables for at least one row and defers the rest to the seed's own census).
