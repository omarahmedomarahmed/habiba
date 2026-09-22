# Slice 14: scripts (part 3 of 4)

Context read first: BRIEF, VALUE-STATEMENTS, MAP, TRAPS, HAZARDS, and `scripts/_verify.ts`
(reporter, sawRows, writesTo, required, readSource, ranDirectly). `writesTo()` refuses the
production endpoint `ep-wild-lake-a6tgm2r6` unless `productionIsAllowed` AND
`I_MEAN_PRODUCTION` names the endpoint. `readSource` = readFileSync + stripCommentsKeepingLines.

Legend per verifier: Claims / Reads / Control (planted offender + known good) / T1 (comments
stripped?) / T3 (hand-typed routes?) / T4 (truncation?) / T6 (main on import / argv guard).

## Files

### scripts/verify-session-orb.ts (203 lines)
- For: `npm run verify:orb`, source-level gate for the minimisable patient session (76.35) and the orb stacking order (C235).
- Decides: exactly one `<iframe` in `components/join/patient-room.tsx` (l.53-61) with a planted second-iframe control (l.71-80); iframe held in one `const call = videoUrl ? (` rendered as `{call}` at least twice (l.84); no `display:none`/`hidden` near iframe (l.94); z-index order session orb < SOS orb and > payment popup, parsed from the first `fixed ... z-[N]` in each file (l.105-127); `setSessionMinimised` wired and clears on return, scoped to `in_progress` (l.133-150); away duration computed server-side in `app/api/sessions/[id]/state/route.ts` (l.163-167); notice text "They can still hear you" and no directive wording (l.183-198).
- Reads: source only, via `readSource` (T1 clean). No DB, no browser (says so honestly, l.29-35).
- Control: planted offender for the iframe count only. The z-index check has no control, and `zOf` takes the FIRST `fixed...z-[N]` match in each file: if patient-room.tsx gains a second fixed element earlier in the file, the check measures the wrong element. `hidden` regex (l.94) is narrow (`hidden` then a quote then `iframe` on the same class run); no control.
- T3 n/a. T4 n/a. T6: calls `main()` at module scope (l.203), no exports, harmless.
- Promises: P5 (orb below SOS, `orbZ < sosZ`), P2 (orb present). Kept as far as a first-regex-match can tell; P5 "reachable, on top" is only asserted as a z-index number, not that the SOS is outside any stacking context that would defeat it.
- Notes: syntax assertions (`/data\.patientAwaySeconds \?\? null/`, `/const call = videoUrl \? \(/`) would go red on an equivalent rewrite (T "syntax not property").

### scripts/verify-sprint1.ts (388 lines)
- For: sprint 1 acceptance: rates live in `platform_settings`, a rate change bills with no deploy, no card money captured to platform.
- Decides: four setting groups present (l.54-58); Egypt 14% VAT EGP (l.62); payg AI rate 300c at unlock 0 (l.81-87); exactly two paid tiers monthly, seat = 90% of solo, clinic = 2 seats (l.110-128); solo = exactly 20 metered sessions (l.137-145); exactly one free tier sorted first (l.156-163); payg all-in = 400c (l.174-183); platform fee > 0, 15% cut, $500 cap, clock 50+10, copilot 10 (l.185-194); no subscription on a retired plan key (l.210-219); temporarily writes payg `aiRateCents=777` and reads it back (l.232-254), restores (l.297-334); every `session_payments.capture='platform'` row is `funding_source='pot'` (l.358-370).
- Reads: DB rows through `scripts/db.ts` `connect()` (no server-only libs).
- Control: none. The "acceptance: next session would bill at the new rate" (l.279-295) is tautological: `wouldBill` is computed by the verifier from the value it just wrote, it never calls the billing code (comment l.256-263 admits `chargeForSession` is not imported).
- 🔴 No production guard at all: never calls `writesTo()` or checks the host, and `scripts/db.ts:15` has no guard. It UPDATEs the live `pricing` row to a $7.77 AI rate (l.233-243) and the restore (l.298) is NOT in a `finally`: a crash, kill or a throw from `parseGroup` between l.243 and l.298 leaves the price changed. HAZARDS.md l.152 "Every verifier that touches the database refuses the production endpoint by name" is false for this file.
- T1/T3/T4 n/a. T6: `main()` at module scope, no exports.
- Promises: T3/C3 pricing shape only indirectly. A1/A2 not touched.
- Notes: l.225 "needs at least one organisation" returns before the finally prints a summary; fine. Hard-coded numbers (400c, 1500bps, 50_000, 10 copilot) are H47 "checker holding its own copy of a number".

### scripts/verify-sprint10.ts (351 lines)
- For: sprint 10 general assistant (clinician copilot over a roster): roster carries no clinical content, threads scoped per user, quota counts only questions.
- Decides: `assistant_threads`/`assistant_messages` have exactly 7 columns (l.57-68); partial quota index (l.70-73); the import from `@/lib/db/schema` in `lib/ai/assistant.ts` names none of 7 clinical tables (l.83-113); no `sessionNotes.content`/`n.content` (l.120-124); a roster row's keys are exactly draftNotes,lastSessionAt,name,nextSessionAt,patientId (l.147-153); next appointment agrees with `sessions` (l.182-203); thread create/title-once/list/scoping by foreign id/allowance 50/reply free/question costs 1/soft delete keeps count/double delete refused (l.221-332).
- Reads: `readSource("lib/ai/assistant.ts")` (T1 clean) plus live DB via real `lib/ai/assistant` functions.
- Control: none for the import scan. It reads only the single `import {...} from "@/lib/db/schema"` statement: clinical text reached through ANY other module (a `lib/data/*` helper, a second schema import, raw `sql`) is invisible. "One of N" trap. Forbidden table list is hand typed (7 names).
- Inline production refusal (l.43-46), not `writesTo()`.
- 🔴 Cleanup l.341 deletes every `assistant_threads` row whose title is `'New chat'`, belonging to ANY user in the database, not only this run's. On a shared dev/simulation branch that deletes real users' untitled threads (and will fail or cascade if they have messages).
- "therapist" is `SELECT ... FROM users LIMIT 1` (l.128-132): first user of any role.
- T6: `main()` at module scope.
- Promises: T5 (copilot scope) adjacent; "patient never talks to a model" not touched. Partly.

### scripts/verify-sprint11.ts (406 lines)
- For: sprint 11 scheduling: whole-hour CHECK, hold/book race, radar hides a booked clinician, no invented backfill.
- Decides: availability_slots has 13 columns (l.60); CHECK `availability_slots_whole_hour` exists (l.76) and a 19:15 insert is refused (l.214-224); no pre-migration session carries `scheduled_at` with PLANTED old session and planted offender (l.126-195, both halves of a control); publish 3 hours, overlap adds 1, inverted refused (l.231-268); hold race single winner (l.278-286); booking is scheduled not started (l.302-307); booked hour cannot be rebooked, disappears, cannot be withdrawn (l.310-323); `inBookedWindow` during/10 min before/1 h before (l.327-333); "radar's own predicate" (l.340-358); `reachable()` (l.366-370).
- Reads: live DB and real `lib/data/scheduling`.
- 🔴 l.340-358 claims "the radar's own reachability predicate excludes them too" but the SQL is written INSIDE the verifier (`NOT EXISTS (... a.status='booked' ... interval '15 minutes')`). It never reads the radar's query; it tests its own copy. Wrong medium: if the radar's real predicate were deleted, this stays green.
- 11.2 migration window derived as `MIN(id)+39` in the drizzle ledger (l.104-105): assumes ids are dense, which H17/H18 say is not guaranteed.
- Inline production refusal. Cleanup deletes all slots in March 2031 regardless of owner (l.385-387).
- T6: `main()` at module scope.

### scripts/verify-sprint11r.ts (289 lines)
- For: sprint 11R repair: timezone columns, Cairo DST storage, phone E.164, gate superseded by 12.1, feedback token constraint, document re-queue.
- Decides: 3 tz/reminded columns exist (l.60-71); 18:00 Cairo stored 15:00Z July / 16:00Z January (l.97-135); unknown zone refused (l.137-147); no `[reminded]` marker in notes (l.152-159); every stored phone E.164 across patients, people, patient_accounts (l.163-180); `isGated` truth table (l.209-215); no `gateActiveFrom` (l.219-223); constraint `sessions_feedback_token_present` exists by name (l.237-243); no PDF/docx left `unsupported` (l.254-268).
- Reads: live DB via `dbFor(DEFAULT_REGION)` and `lib/settings` (server-only libs imported in a script).
- Control: none. The feedback-token check asserts the constraint NAME, while verify-sprint12.ts l.117-124 says 22.9 moved the refusal to a NOT NULL column: if the CHECK were dropped as redundant this goes red on an improvement (syntax not property). Sprint 12 proves the same property correctly by attempting the write.
- `writesTo()` called (l.53). T6: `main()` at module scope.
- Notes: l.75-78 publishes hours for `users LIMIT 1` (any role). Cleanup only deletes slots from 2031-01-01 for that user (l.270-277) collecting ids of ALL that user's post-2031 slots, including any other verifier's live fixture.

### scripts/verify-sprint12.ts (395 lines)
- For: sprint 12 "the reset/sweep": gate for everybody, DB refuses token-less sessions and bad phones, client files do not read runtime zone/locale, reset script shape.
- Decides: `isGated`/`capabilitiesFor` truth table (l.65-88); token-less session refused (message contains `feedback_token`) with a known-good insert (l.105-144: both halves); phone null refused `patients_phone_present`, national number refused `patients_phone_e164`, join_link email-only accepted, E.164 accepted (l.155-223: both halves); Cairo vs New York date differ (l.231-235); null zone = UTC (l.237-241); `relativeDay` (l.248-254); client-file walk banning `Intl.DateTimeFormat(`, `Intl.NumberFormat(`, `toLocale*String(` in any `"use client"` file under components, app, lib, exempting only `lib/scheduling/use-reader-zone.ts` (l.277-329); `reset.tableNames` excludes drizzle ledger and equals every public base table (l.349-366); reset source contains `--i-mean-it` and "Type the host to confirm" (l.369-373).
- Reads: live DB, real libs, source walk with its own regex comment stripper (l.305), not `readSource`. The regex stripper will also eat `/* ... */` inside string literals; acceptable. T1 handled by hand.
- Control: none for the client-file walk (no planted offender, no count of files scanned). The `relativeDay` check (l.248-254) compares `Date.now()` with itself in Kiritimati and accepts "Today" OR "Tomorrow": the server-calendar defect it claims to pin cannot make an instant differ from itself, so it cannot fail (T2).
- T6: `await import("./reset")` (l.349). reset.ts `main()` drops tables, but it is guarded by `ranDirectly("reset.ts")` (scripts/reset.ts:78), exact basename. Handled.
- `writesTo()` (l.58). Cleanup deletes `patients.first_name LIKE 'verify12%'` globally (fine, tagged).
- Promises: none directly.

