# Verification: CHECKS (verifiers, gates, unit tests, evals, seeds, production tooling)

Verifier domain: CHECKS, prefix CHK. Read only; nothing was run against a database. Sources are
`takeover/reading/code-NN.md` (section and item number) and the three digests.

Context that decides severity for the "unguarded writer" entries: the only sanctioned route to
production is `scripts/on-production.ts` (allow-list, sets `DATABASE_URL` to
`DATABASE_URL_PRODUCTION` for the child only, `:263-292`). Everything else runs against whatever
`.env.local` `DATABASE_URL` names, which is dev by convention only. `writesTo()`
(`scripts/_verify.ts:193-247`) refuses the production endpoint `ep-wild-lake-a6tgm2r6` by name
unless the script opts in and `I_MEAN_PRODUCTION` is set. `scripts/db.ts:15-22` `connect()` has no
guard of its own. So a script with neither `writesTo()` nor an inline endpoint check writes to
production the day `.env.local` points there (the manoeuvre `on-production.ts:139-147` records
people being pushed into before `db:migrate` was allow-listed).

## Part A: scripts that write to real data

### CHK-1 · verify:sprint1 and verify:sprint2 rewrite the live price row with no production guard and restore outside `finally`
- Verdict: CONFIRMED
- Sources: code-14 Broken 1, code-14 Stale 1, PLAN-digest (verify:sprint1 "asserts live rows")
- Promise: T3 (the fee a clinician is charged), A2-adjacent
- Who is hurt and how: run against production from a mis-pointed `.env.local`, a crash between the write and the restore leaves the product charging every pay-as-you-go clinician a $7.77 AI rate (sprint 1) or every tier $9.99 more (sprint 2) until somebody notices.
- Evidence: `scripts/verify-sprint1.ts:41` `connect()` with no `writesTo()`/endpoint check (grep: zero references); write at `:233-243`, restore at `:298-301` inside the `try`, `finally` at `:380` only ends the pool. `scripts/verify-sprint2.ts:29` same; write `:93-103`, restore `:124-127`, `finally` `:244` only ends the pool. `scripts/db.ts:15-22` has no guard. Patch looked for: `on-production.ts` does not list either (so the sanctioned door refuses them), but nothing stops the ordinary `npm run verify:sprint1` from a production `.env.local` (`package.json:95, 20`).
- Severity: S2 (conditional on a mis-pointed env, but the consequence is wrong money on every bill)
- Fix sketch: `writesTo()` at the top of both, restore moved into `finally` keyed on "did I write". Check: `verify:sprint57`'s door count should also assert that every file calling `connect()` and issuing a write calls `writesTo()`.
- Decision it came from: sprints 1 and 2 predate C147 (`writesTo`, sprint 57); never retrofitted.

### CHK-2 · verify:sprint2's headline property is never tested, and two of its checks cannot fail
- Verdict: CONFIRMED
- Sources: code-14 Broken 15, code-14 Stale 12
- Promise: E3 (a price shown is a price owed)
- Who is hurt and how: nobody directly; the gate reports "history is frozen, not derived" green without asking the code that could derive it, so a regression that re-prices past sessions from today's settings would pass.
- Evidence: `scripts/verify-sprint2.ts:55-59` `check(..., true, ...)`; `:116-120` asserts `typeof inv.amountCents === "number"`; `:105-114` re-reads `sessions.price_cents`, a stored column no settings write can move, so the check measures Postgres, not the product. `radarSessionHistory` is called only after the restore (code-14 Broken 15).
- Severity: S3
- Fix sketch: call the history/earnings reader while the odd rate is in place and assert its figures equal the pre-change ones; delete the two constant checks.
- Decision it came from: sprint 2.5 (/on-call price frozen).

### CHK-3 · verify:sprint4 writes an FX quote with no production guard
- Verdict: PARTLY
- Sources: code-14 Stale 1, code-14 Suspect 2, code-14 Stale 16
- Promise: none directly (Egyptian pricing)
- Who is hurt and how: the unguarded write is real, but the feared harm (an hour of refused Egyptian payments) does not follow; the stored static quote is skipped by production, which fetches its own.
- Evidence: `scripts/verify-sprint4.ts:25` `connect()`, no guard; `quoteFor` inserts at `lib/billing/fx.ts:212-222`. Patch: `lib/billing/fx.ts:183` reuses a stored quote only `if (live && quoteMaySettle(live))`, and `quoteMaySettle` (`:141-143`) refuses `static` in production, so a planted static row is ignored, not reused. Stale 16 holds: `:164-168` asserts `source === "static"`, red the day a live feed exists.
- Severity: S4
- Fix sketch: `writesTo()`; assert "source is recorded and is one of the known providers" rather than "static".
- Decision it came from: sprint 4 / C37.

### CHK-4 · verify:sprint5 plants people and charts with no production guard at all
- Verdict: CONFIRMED
- Sources: code-15 Broken 4, code-14 Stale 1 (HAZARDS.md:152 claim)
- Promise: P4 (never auto-merge people)
- Who is hurt and how: against production it inserts two fake people and charts under a real clinician's organisation; cleanup is in a `finally` (`:215-222`), so only a killed run leaves them, and they would then sit in a real clinician's caseload.
- Evidence: `scripts/verify-sprint5.ts:25` `connect()`; no `writesTo`, no endpoint string (grep zero). Inserts `:184-199` using `anyChart.org/therapist` found in the data. Siblings 6 to 9 carry inline refusals (code-15 Handled 4, confirmed for 7 at `verify-sprint7.ts:37-40`, 10 at `verify-sprint10.ts:42-43`).
- Severity: S3
- Fix sketch: `writesTo()`; plant its own organisation and clinician instead of borrowing one.
- Decision it came from: sprint 5, before C147.

### CHK-5 · Guarded verifiers still damage the branch they run on (sprints 7, 10, 14, 16, 41, 50, 53)
- Verdict: CONFIRMED
- Sources: code-14 Broken 2, 3, 4, 5; code-15 Broken 1, 2, 3; code-14 Suspect 3
- Promise: none (dev and simulation branches); A5-adjacent for the ledger delete
- Who is hurt and how: each refuses production, so the harm is to dev or the simulation branch: real clinicians left at $90 and online on the radar, an organisation's free trial spent, a real session's recorder source deleted, every user's "New chat" threads deleted, a pending or rejected clinician permanently approved, the invoice legal details deleted, the capture cast's patient accounts deleted. The walk and the films sign in on those branches, so testers meet states the product never produced.
- Evidence: all seven call `writesTo()` or an inline endpoint refusal (grep). Defects: `verify-sprint14.ts:71-73` borrows `SELECT ... FROM users LIMIT 3`, then `:122-125, 141-150, 268` set rate 6000/2000/9000, radar `online`, `suspended_until` null, `charges_enabled` true; `finally` `:323-332` deletes only `verify14%` rows. `verify-sprint16.ts:78-84` borrows the first organisation, `:535-541` sets `trial_session_used=true`, never restored; `:647-650` deletes every orphaned `invoice` ledger leg database-wide (no append-only trigger on `ledger_entries` in `drizzle/`, grep). `verify-sprint41.ts:98-105, 200` deletes the first real session's `session_sources`. `verify-sprint10.ts:341` `OR title = 'New chat'` for all users. `verify-sprint50.ts:66-75, 110-113` forces an existing verification to `approved`; `restore` (`:115-129`) only deletes when it created the row, and deletes the EG taxonomy entry unconditionally. `verify-sprint53.ts:53, 1023, 1962-1969` `restoreInvoice` is null until `:1023`, so a throw earlier makes the `finally` DELETE the real `invoice` settings row. `verify-sprint7.ts:394, 430` sweeps `+2013000%`, which covers `seed-capture.ts:90-104` (`+201300052001..3`).
- Severity: S3
- Fix sketch: plant, never borrow; record the prior value before any write and restore it in `finally` unconditionally; narrow sweeps to the verifier's own tag. The check: a "branch unchanged" census (row hash of the touched tables before and after) in `verifiers.ts`.
- Decision it came from: C93 and 22.1 ("a gate that needs somebody else's data fails the week before launch") replaced borrowing in some verifiers (16 at 78.5 for users) but not all.

### CHK-6 · `ship:content` runs `verify:sprintNN` against production, so the unguarded writers reach production through the sanctioned door
- Verdict: CONFIRMED (new finding while checking CHK-1)
- Sources: none directly; extends code-14 Broken 1 and code-13 Handled 5
- Promise: T3, A2-adjacent
- Who is hurt and how: `npm run on:production -- ship:content -- 1` (or 2, 4, 5) reseeds content and then runs that verifier on production with production's URL; sprints 1 and 2 rewrite the live price row and restore outside `finally`, sprint 4 writes an FX row, sprint 5 plants people. Guarded verifiers refuse, so the ship reports "FAILED" for them, which invites the operator to try the next number.
- Evidence: `scripts/on-production.ts:80-89` allow-lists `ship:content` as a writer and sets `DATABASE_URL` + `I_MEAN_PRODUCTION` for the child (`:287-292`); `scripts/ship-content.ts:35, 57-67` runs `npm run verify:sprint${n}` for any numbers given, inheriting that env (`execFileSync` default env, `:88-90`). Node's `--env-file-if-exists` does not override an already-set `DATABASE_URL`. Unguarded verifiers: CHK-1, CHK-3, CHK-4.
- Severity: S2
- Fix sketch: `ship-content.ts` refuses any sprint whose verifier does not call `writesTo()` (or runs only an allow-list of read-only content verifiers); CHK-1's fix removes the worst case.
- Decision it came from: C148 (reseed must be proved by re-running the verifiers on the same host).

### CHK-7 · `seed.ts --refresh-content` is not "content only": it re-passwords and reactivates the seed admin on production
- Verdict: CONFIRMED
- Sources: code-12 Broken 3, code-12 Stale 16
- Promise: A5 (a role is a list; every read is written down)
- Who is hurt and how: every `ship:content` on production also upserts the organisation, its subscription and, when `SEED_ADMIN_EMAIL/PASSWORD` sit in `.env.local`, resets that admin's password, forces `super_admin` and sets `status: active`, undoing a suspension, with no audit row. The operator was told it "touches nothing else".
- Evidence: `scripts/seed.ts:133-139` skips `writesTo()` only; `:143-162` org + subscription insert; `:165-196` admin upsert with `set: { passwordHash, role: "super_admin", status: "active" }`; content loop `:222-257`; the `--demo` branch returns early at `:260` only if `--demo` is absent. `ship-content.ts:57` passes only `--refresh-content`, so `--demo` is not reached through ship; a direct `db:seed -- --refresh-content --demo` on production would seed documented-password demo people (the refusal at `on-production.ts:191-193` covers only the door). Comment claims at `seed.ts:128-131` and `ship-content.ts:52-56`.
- Severity: S2
- Fix sketch: in `REFRESH_CONTENT` mode return right after the content loop and skip everything above it (move the content loop first). Check: `verify:sprint57` asserting `--refresh-content` issues writes only to `content_pages` (grep of the mode's code path, or a statement log on a branch).
- Decision it came from: C289b (the guard exception for `ship:content`), C148.

### CHK-8 · demo-full.mts and demo-video.mts create, approve and book real rows on whatever DEMO_BASE is
- Verdict: CONFIRMED
- Sources: code-15 Broken 8, 9; code-15 Stale 6, 7; code-15 Unclaimed (b)
- Promise: C1/P1-adjacent (who is on the public radar)
- Who is hurt and how: pointed at the live site, demo-full signs in as the seed admin and, if its own applicant row is not found, presses the first "Approve" in the real verification queue, putting an unreviewed clinician on the public radar; demo-video books whichever real clinician shows "Available", a real booking on a real person's time. demo-video also deletes the whole `demo-output/`, including paid TTS audio from demo-speech.
- Evidence: `scripts/demo-full.mts:42` `BASE = DEMO_BASE ?? localhost`; `:270-272` admin sign-in from `SEED_ADMIN_*`; `:278-290` click the row if present, then `getByRole("button", { name: /^Approve$/ }).first()` regardless. `:35` promises a `--dry-run` that does not exist (grep: no other occurrence). `scripts/demo-video.mts:150-151` first "Available" button; `:97` `rmSync(OUT, recursive)` with `OUT` = `demo-output` (`:30`), the same folder demo-speech writes (`demo-speech.mts:25`). No host check in either.
- Severity: S2 (an unverified clinician made bookable is a safety property, conditional on pointing at production)
- Fix sketch: refuse any `DEMO_BASE` that is not localhost or a named preview; in demo-full, click Approve only inside the located row and fail if absent; demo-video writes to its own subfolder.
- Decision it came from: the demo films (sprint 41 era); not traceable further.

### CHK-9 · copilot-exam is an allow-listed production command that reads each record without grant scoping
- Verdict: CONFIRMED (the T5 product risk behind it is HANDLED)
- Sources: code-12 Suspect 5, code-12 Unclaimed (b), code-14 Suspect 1, code-14 Unclaimed (b)
- Promise: T5
- Who is hurt and how: on production the exam impersonates each patient's most recent clinician, asks the copilot with no `capabilities` (so documents, journals and the standing profile are read even if the patient revoked that clinician), sends the answers to a second model to grade, and can write them to a JSON file in the working tree. Today every record is synthetic; after launch it is a sanctioned read of real records nobody consented to, with no audit.
- Evidence: `scripts/on-production.ts:100` `"copilot:exam": { writes: true }`; `scripts/copilot-exam.ts:470-479` thread for the last session's clinician, no grant check; `:490-509` `askPatientCopilot` without `capabilities`; `:607-608` `writeFileSync(opts.json)`. Fail-open default: `lib/ai/case-copilot.ts:373-375` ("Absent capabilities means an internal caller that did its own scoping"), `:505-512`. Patch for the product: the only product caller, `app/(app)/copilot/actions.ts:119-142`, passes `capabilities: access.capabilities` (grep of app, lib, components for `askPatientCopilot(`: one hit).
- Severity: S2 (S1 the day production holds a real patient)
- Fix sketch: make `capabilities` required in `askPatientCopilot` (the type then forces the exam to derive them from `accessFor`); remove `copilot:exam` from the production list or restrict it to cast patients by id.
- Decision it came from: the six-month simulation's copilot claim (SIMULATION digest, "the exam uses askPatientCopilot").

### CHK-10 · grant-admin, q.ts and backfill-diarise write to whatever database is configured, outside the one door
- Verdict: CONFIRMED
- Sources: code-12 Unclaimed (b) grant-admin and q.ts; code-16 Suspect 7 and Unclaimed (b) `.walkthrough2/q.ts`
- Promise: A5 (every read is written down)
- Who is hurt and how: `grant:admin` promotes any existing user to super admin and replaces their password on production with no audit row and without passing `on:production`; `scripts/q.ts` and `.walkthrough2/q.ts` run arbitrary SQL and do not even print which database; `backfill-diarise.ts` rewrites speaker attribution on every old transcript (and sends each to a model) with no host printed.
- Evidence: `scripts/grant-admin.ts:30-38, 57` `hostOf()` only, by design; `:88-106` update/insert with `role: "super_admin", status: "active"`; no `audit` call (grep). `scripts/q.ts:1-7` `connect()` + `pool.query(argv[2])`. `.walkthrough2/q.ts` `dbFor(DEFAULT_REGION)` + `sql.raw(argv)`. `scripts/backfill-diarise.ts:30, 38` `connect()`, guard only on the H10 retention acknowledgement (`:87-105`), none on host.
- Severity: S3 (anybody holding the production URL already has full power; the defect is no record and no host line)
- Fix sketch: grant-admin writes an `audit_log` row and goes on the production list; q.ts prints the host and refuses production writes unless through the door; backfill prints the host.
- Decision it came from: 76.24 (grant-admin "allowed to touch production, on purpose").

### CHK-11 · `db:reset` has no production refusal, only a typed host
- Verdict: PARTLY
- Sources: code-12 Suspect 8, code-12 Stale 20
- Promise: A5, P4 (the record)
- Who is hurt and how: the reader's feared sequence (truncate, then `settings seed` refuses production and leaves it empty) is wrong: `settings seed` does not refuse production. What holds: from a production `.env.local`, `db:reset -- --i-mean-it` plus typing the host truncates every table on production, audit log included, and reseeds settings and content only.
- Evidence: `scripts/reset.ts:81-127` dry run by default, typed host confirmation, then `TRUNCATE ... CASCADE` of every public table (`KEEP` is empty, `:56-63`); no `writesTo()`. `scripts/settings.ts:717-718` `seed` only prints the host. `on-production.ts:224` refuses `db:reset`, but that door is optional. Stale 20 (`reset.ts:7-10` "every row is test data") holds as an undated claim.
- Severity: S2
- Fix sketch: `writesTo()` (no production door) before the count.
- Decision it came from: sprint 22 launch purge.

### CHK-12 · Tests and walkthrough helpers delete every `rate_limits` row on whatever database they reach
- Verdict: CONFIRMED
- Sources: code-16 Suspect 7
- Promise: none directly (sign-in throttling)
- Who is hurt and how: pointed at production, `test:e2e` or the walkthrough lifts every per-address sign-in throttle and every other limiter at once (the per-account lockout on `users` is unaffected). With a published console password (MAP Confirmed 1) the throttle is one of the few things between a stranger and the console.
- Evidence: `tests/e2e.test.ts:190-196` `DELETE FROM rate_limits`; `.walkthrough/lib2.mjs:3-4` same via `neon(DATABASE_URL)`; `tests/run-e2e.sh:14` requires only that `DATABASE_URL` is set. Throttle vs lockout: `lib/auth/actions.ts:179-246`. Other writers under `tests/` (`radar.test.ts`, `ledger.test.ts`) carry only a comment about regions (`:39`, `:28`), no endpoint check.
- Severity: S3
- Fix sketch: a shared `refuseProduction()` in `tests/` called by every DB-touching test; delete only the test's own keys.
- Decision it came from: e2e harness design (limiter proved elsewhere, "clearing the rows is legitimate setup").

## Part B: seed-demo, the walk's own starting position (runs on production)

### CHK-13 · seed-demo's wipe is not transactional, so any throw leaves production wiped and half seeded
- Verdict: CONFIRMED
- Sources: code-12 Suspect 3, MAP Suspect 7 (part)
- Promise: every walk position (VALUE-STATEMENTS "The five positions")
- Who is hurt and how: `seed:demo` is the production command the whole walk starts from. It deletes table by table, then inserts the cast statement by statement, with no transaction; a failure anywhere after the first DELETE (a new CHECK, a renamed column, a network drop) leaves the live site with no accounts, or a partial cast, until somebody restores the snapshot. Nothing checks a snapshot exists first.
- Evidence: `scripts/seed-demo.ts:88` `writesTo({ productionIsAllowed: true })`; `:199-222` DELETE passes, each its own statement; `:236-246` the census throws after the damage; no `.transaction(` or `BEGIN` in the file (grep). The snapshot is a comment-level condition only (`on-production.ts:113-116`).
- Severity: S2 (nothing real on production today; before launch it is S1)
- Fix sketch: run the wipe and the seed inside one `db.transaction` (a Neon websocket pool supports it), so a throw rolls everything back; or refuse to start unless a snapshot id created in the last hour is passed and checked through the Neon API.
- Decision it came from: 78.1 (wipe and seed production so the redesign has something to look at).

### CHK-14 · The KEEP census compares counts, and that is enough for this wipe; what it cannot do is undo
- Verdict: PARTLY
- Sources: MAP Suspect 7, code-12 Suspect 2
- Promise: none directly (payroll and configuration tables)
- Who is hurt and how: MAP's worry was a table whose rows were replaced at the same count (the H49 `ship:content` shape). This wipe only DELETEs, and a DELETE cannot replace a row, so a count that may not fall is a sufficient test of what the wipe itself can do. The part that holds: it is checked after the non-transactional deletes (CHK-13), so it reports the loss rather than preventing it, and it would not see a row changed by any other statement. The FK-nulling worry (code-12 Suspect 2) is handled: every FK from a KEEP table to users, people or organisations is `ON DELETE SET NULL` (e.g. `employees.created_by`, `country_settings.crisis_line_verified_by`, `lib/db/schema.ts:2870, 3524`; `drizzle/0088_a_crisis_line_per_country.sql:40`), so nulling them first is exactly what deleting the users would have done; `employee_salaries` points at `employees`, not at a person.
- Evidence: `scripts/seed-demo.ts:132-140` census by `count(*)`; `:241-247` compares `after < before` only; `:143-160` nulling of audit columns.
- Severity: S4
- Fix sketch: none needed for the count once CHK-13 wraps the wipe in a transaction; the census then rolls back instead of reporting.
- Decision it came from: 78.1 census (§6 control planted with `DELETE FROM fx_quotes`).

### CHK-15 · seed-demo writes paid sessions with no payment behind them, and a $255 payout request with nothing held
- Verdict: CONFIRMED
- Sources: code-12 Suspect 1, code-12 Stale 15, MAP Suspect 6
- Promise: T3, A2, A4 (the `money` position)
- Who is hurt and how: on the production cast a tester walking "what you owe comes out of what you earn" or approving a payout is looking at sessions marked paid where no patient paid and no ledger leg says so, and at a payout request that was typed into the table rather than earned. A tester who presses "sent" posts a real payout leg on the founders' ledger against money that never arrived; the walk then certifies a screen over rows the product could not have produced.
- Evidence: `scripts/seed-demo.ts:981, 986, 991, 1023, 1029` `paymentStatus: "paid"` inserted directly; `:1097-1112` `chargeForSession` bills the clinician for every completed session without a `session_payments` row; `:1193-1197` raw `INSERT INTO payout_requests ... 25_500 ... 'requested'`. The header claim "every cent is posted" is `:31-37`. Only the pot and cart paths go through product functions (header list, `:33`).
- Severity: S2 (the walk's money findings would be about fixtures, and the approval posts real ledger legs)
- Fix sketch: pay the "paid" sessions through `openCart`/`submitProof`/`confirmPayment` as the pot sessions already are, and raise the payout with the product's `requestPayout` against earnings that exist. Check: `verify:demo` asserts every `paid` session has a payment row and the payout request is at most held earnings.
- Decision it came from: 78.1 ("this writes history directly, and says so").

### CHK-16 · Demo clinicians on the production directory with realistic licence numbers and fourteen days of bookable hours
- Verdict: PARTLY
- Sources: code-12 Suspect 4, code-12 Stale 11, MAP Suspect 2
- Promise: C1, P1 (who a stranger is shown and can book)
- Who is hurt and how: the reader feared seeded clinicians "online indefinitely"; that half is fixed: since 80.3 `reachable()` measures the heartbeat for everyone, so a demo row is on the live board only while somebody is signed in as it. What remains: seed-demo approves three fabricated clinicians with licence numbers shaped like real ones (`EPA-204418` etc.), lists them in the public directory (`discover.ts` keeps demo rows on purpose), and opens 14 days of afternoon slots, so a real stranger can book a future hour with Dr Sara or Dr Kareem, whose inboxes are at `example.com` and reach nobody. The booking page carries no demo label (grep of `app/(public)/t/` for `demo`: none).
- Evidence: `scripts/seed-demo.ts:422-436` approved verifications with `EPA-` numbers; `:481-485` radar rows `demo=true`, `online`; `:499-510` `availability_slots` for 14 days. Patch for the live board: `lib/data/radar.ts:183-199` (80.3, heartbeat for everyone). Still open: `lib/data/discover.ts:88-91, 130` (demo shown in the directory); `app/(public)/t/[id]/book/actions.ts:25-70` books any open slot. The comment at `seed-demo.ts:458-461` still says `reachable()` exempts demo rows (stale). Side note, not this domain: `lib/console/reads.ts:80-86` still lists demo rows as present regardless of heartbeat (code-13 Unclaimed b).
- Severity: S2 (a person looking for care books a clinician who does not exist and nobody is told)
- Fix sketch: `bookSlot` refuses a slot whose owner's radar row is `demo`, or seed-demo writes no slots on production; licence numbers carry a `DEMO-` prefix as `demo.ts` does. Check: `verify:demo` asserts no open slot belongs to a demo clinician.
- Decision it came from: 80.3 (founder: "demo clinicians show on the radar ... logged out they show as offline as demo") and 78.1 ("hours to book, because there were none anywhere").

### CHK-17 · seed-demo deletes the audit log on production every reseed
- Verdict: CONFIRMED
- Sources: code-12 Unclaimed (b), code-15 Unclaimed (b)
- Promise: A5 ("every read is written down")
- Who is hurt and how: `audit_log` hangs off `users` and `organizations`, is not on the KEEP list, and is emptied by every `seed:demo`; no trigger stops it. Today production is synthetic; the day it is not, a sanctioned command erases the record A5 promises.
- Evidence: `scripts/seed-demo.ts:68-83` KEEP (no `audit_log`); `:113-121` reachable tables computed from FKs; `lib/db/schema.ts:2636-2700` `audit_log` FKs to organizations and users. No DELETE trigger on `audit_log` in `drizzle/` (grep).
- Severity: S3 today, S1 once any real person is on production
- Fix sketch: add `audit_log` to KEEP (null its actor columns like the others), and a `BEFORE DELETE` trigger on `audit_log` outside the retention job's role.
- Decision it came from: 78.1.

### CHK-18 · Seeded copilot answers are written as `assistant`, a role the product never reads
- Verdict: CONFIRMED
- Sources: code-12 Broken 1
- Promise: T5 (the `continuity` position)
- Who is hurt and how: a tester on the demo cast opens a copilot thread and sees the clinician's question with no answer, and may record T5 as broken for a seed reason.
- Evidence: `scripts/seed-demo.ts:1146-1150` `role 'assistant'`; reader filters `inArray(role, ["therapist","copilot","correction"])` at `lib/data/copilot.ts:496`; type at `:139`.
- Severity: S3
- Fix sketch: write `'copilot'`; a CHECK on `copilot_messages.role` would have refused it.
- Decision it came from: 78.1.

### CHK-19 · seed-demo never checks the append-only trigger came back on
- Verdict: HANDLED (for seed-demo); PARTLY for the sibling in verify-sprint26
- Sources: code-12 Stale 14, code-12 Handled 4, code-14 Suspect 9
- Promise: P4 (every version stays)
- Who is hurt and how: nobody on the walk path: the check the seed's comment promises lives in `verify:demo`, which the walk runs straight after `seed:demo` on the same database. The comment is stale only in where the check lives. What remains: `verify-sprint26.ts:238-240` toggles the same trigger on branches, and a killed run there is noticed only if somebody later runs `verify:demo` on that branch.
- Evidence: `scripts/seed-demo.ts:196-199` claim, `:201-222` DISABLE with ENABLE in `finally`. Patch: `scripts/verify-demo.ts:587-590` `pg_trigger ... tgenabled <> 'D'` must be 1; `on-production.ts:174-177` puts `verify:demo` on the read list for exactly this. Grep of `scripts/` for `tgenabled`: that one hit only.
- Severity: S4
- Fix sketch: move the trigger assertion into `verify:migrations` (run after every deploy and every ageing), so any database that lost it goes red, not only the demo one.
- Decision it came from: 78.1.

## Part C: checks that cannot fail, or measure something next to the property

### CHK-20 · The two recording-consent tests write the consent row themselves and read back what they wrote
- Verdict: CONFIRMED
- Sources: code-16 Broken 2; carries MAP Confirmed 4 (recording consent is wider than task 123)
- Promise: T2, and the legal consent to record (README safety invariants)
- Who is hurt and how: "a patient who declines is not recorded" is green whatever `submitJoin`, the room or the transcribe route do, because the test is the only writer. MAP Confirmed 4 shows the real path is broken (the transcribe route checks neither consent nor pause; in person has no consent step), and this suite, which calls itself "the test that matters", could never have gone red for it. A patient who said no is recorded and the suite says they were not.
- Evidence: `tests/radar.test.ts:746-783` `db.update(sessions).set({ recordingConsent: "declined", ... recordingPausedAt })` then `select` and assert the same values; `:816-837` same for `granted`. `:785-814` does call `checkJoinState` (real code) and is fine. MAP Confirmed 4: `app/api/sessions/[id]/transcribe/route.ts`, `components/session/session-room.tsx:103`.
- Severity: S1 (a check that cannot fail on a legal safety property)
- Fix sketch: call `submitJoin` with a decline, then POST a chunk to the transcribe route for that session and assert it is refused and nothing is stored; the same for a pause set mid-session and for an in-person session with no consent.
- Decision it came from: the consent sprint (0017, 48.10 patient stop); tests written against the row rather than the path.

### CHK-21 · The pot race and the anti-differencing tests test functions defined inside the test
- Verdict: CONFIRMED; carries MAP Confirmed 5 (E1 broken by live totals)
- Sources: code-16 Broken 3
- Promise: E1 (never who, never when), A2 (money moves once)
- Who is hurt and how: "two bookings racing cannot both spend the same pot money" and "a sponsor cannot difference two balances down to one session" declare `funds`, `debit` and `publishable` in the test body and assert on them. `payFromPot` and the balance publication can regress completely and both stay green. MAP Confirmed 5 is the proof: `/sponsor` shows live spend totals beside the floored balance, so an employer can difference to one person's session today, and this test says they cannot.
- Evidence: `tests/safety.test.ts:709-741` (local `funds`, `debit`, `balance`), `:832-856` (local `publishable`; only `SETTINGS_DEFAULTS.sponsor.activityFloor` is product). `:1090` `assert.notEqual(r.presentedTotalCents, wrongOrder + 1, ...)` is meaningless (any value but one passes). MAP Confirmed 5: `app/(sponsor)/sponsor/page.tsx:195-207`, `lib/billing/pot.ts:997`.
- Severity: S1 (privacy wall between employer and employee; a check that cannot fail)
- Fix sketch: the race test calls the real `payFromPot` twice concurrently on a branch pot sized for one session and asserts one refusal and one ledger leg; the differencing test reads what `/sponsor` renders (every figure on the page, not just `potBalance`) before and after one session and asserts nothing moved.
- Decision it came from: C239 (pot overdraft), sponsor activity floor (E1).

### CHK-22 · transfer-rail's CONTROL never calls product code
- Verdict: CONFIRMED (the property has a real check elsewhere)
- Sources: code-16 Broken 4
- Promise: A1-adjacent (a company's top-up credited in the right currency)
- Who is hurt and how: the "planted offender" is two literals divided by each other; it passes with `grantPotTopUp` regressed to crediting pounds as dollars. The damage is limited because `verify:cycle` runs the real grant against a database and checks the credit (`scripts/verify-money-cycle.ts:192-203`).
- Evidence: `tests/transfer-rail.test.ts:178-193`; the other tests in the file call `payableCents` etc. and are real. Real coverage: `verify-money-cycle.ts:193` "the pot is credited the CREDIT, never the gross and never the pounds".
- Severity: S3
- Fix sketch: delete the control or make it call the conversion `grantPotTopUp` uses with the old argument order and assert the wrong answer.
- Decision it came from: sprint 75 pot top-up defect.

### CHK-23 · attribution.test asserts arithmetic and names it chose
- Verdict: CONFIRMED
- Sources: code-16 Broken 5
- Promise: none (speaker attribution quality)
- Who is hurt and how: nobody directly; two assertions pass on any code.
- Evidence: `tests/attribution.test.ts:47` `assert.ok(450 - 160 > 0)`; `:266-278` checks the names of three functions listed in the test against a regex, not what they return.
- Severity: S4
- Fix sketch: delete `:47`; for `:266-278`, scan the module's actual exports (`Object.keys(await import(...))`).
- Decision it came from: H11 diarisation cap fix.

### CHK-24 · verify:rail, cited as the enforcer of A1, never touches a database
- Verdict: PARTLY
- Sources: task brief; VALUE-STATEMENTS A1 ("Where we say it: verify:rail")
- Promise: A1 (nothing granted before a person confirms)
- Who is hurt and how: `verify:rail` is 1,889 lines of reading source and one migration file; it proves the words are in the code, not that confirming is what grants. The runtime half is held elsewhere: `verify:cycle` asserts "confirming a session transfer is what makes it paid, and nothing earlier does" against a database, and `verify:edges` asserts "confirming the employee's half is what lets them into the room". So A1 is gated, just not by the gate the promise names. It also reads `drizzle/0102_manual_rail.sql` raw, so a constraint name that survives only in a SQL comment passes (T1 for SQL).
- Evidence: `scripts/verify-rail.ts:17-26` imports only `readFileSync`, `readSource`, `reporter`; no `connect`/`db` anywhere (grep). `:23` `readFileSync("drizzle/0102_manual_rail.sql")`, `:46` `sql.includes(name)`. Runtime: `scripts/verify-money-cycle.ts:256`, `scripts/verify-money-edges.ts:279, 355`.
- Severity: S3
- Fix sketch: re-point A1's "where" at `verify:cycle` and `verify:edges`; in `verify:rail`, check constraints through `pg_constraint` on a branch or strip `--` comments before matching.
- Decision it came from: sprint 73 (the Egyptian rail), VALUE-STATEMENTS generation (`scripts/_value-statements.ts`).

### CHK-25 · The grounding eval measures the fact filter, not the model; the model leaks 3 of the 4 foreign facts that reach it
- Verdict: CONFIRMED (proved by execution)
- Sources: code-16 Suspect 1, code-16 Stale 1
- Promise: P3/T1 (the note is written from what was said), README "note carries provenance"
- Who is hurt and how: the eval reports `grounding.leak` 0.111 ("another patient's facts, repeated") and it reads as "the model rarely repeats a stranger's facts". In fact 23 of the 27 poisoned facts are dropped by `factsForPrompt` before the model sees them, so they cannot leak; of the 4 that reach the model, 3 were repeated in the note. Likewise 5 of the 12 contradiction cases are free passes. A patient's note repeating another person's medication or history is the case the suite was written to catch, and the number hides it.
- Evidence: `evals/suites/grounding.ts:1, 66-69` builds context through `factsPrompt` (`lib/clinical/context.ts:150-151` calls `factsForPrompt`, which drops unverified AI facts, diagnoses and presentation/function/risk facts). Ran `factsForPrompt` over `evals/cases` fixtures with node (scratchpad `g/probe.ts`): 16 sessions, 27 poison facts, 4 reach the model (`exams-arabic medication/ssri`, `couple-conflict history/separation`, `drinking-again history/treatment`, `cairo-long-session medication/current`); 12 contradictions, 7 reach the model, filtered: sleep-and-work, grief-and-return-to-work, exams-arabic, panic-on-the-metro, chronic-pain. Baseline `evals/baseline.json:40-45` leak 0.111 = 3/27. Stale comments: `grounding.ts:26-27, 185-187, 204`.
- Severity: S2 (the product filter is real and protective; the measured leak rate of what passes it is 75%, and nobody knows)
- Fix sketch: report the leak over reachable facts (denominator = facts `factsForPrompt` keeps) and add poison facts of the kinds that pass the filter (verified medication, history); a unit test pinning how many fixtures reach the model so the denominator cannot silently shrink.
- Decision it came from: C167, C168, C170 (the note-generator filters) landed after the eval was written.

### CHK-26 · The eval fixtures contradict themselves, so correct notes score as fabrications
- Verdict: CONFIRMED (proved by execution)
- Sources: code-16 Broken 1, code-16 Suspect 2
- Promise: T1 (the note is written from what was said)
- Who is hurt and how: nobody directly; the note-quality numbers are wrong in the direction of punishing faithful notes, so prompt tuning against them pushes the model to leave out true things (a father taken to hospital, why she moved in).
- Evidence: ran `claimScore` over each case's own transcript and prior facts (scratchpad `g/m.ts`): `cairo-long-session` neverSaid `المستشفى` is in its transcript (`evals/cases/long-session.ts:137` vs `:425`); its mustNotSay `المعادي`, `لوحدها` are in its transcript (`:208` vs `:232, :400`). `bereavement-arabic` priorFact "الابن الأكبر في العائلة" contains neverSaid `الأب` after normalisation (`evals/metrics.ts:230-231` substring match; `evals/cases.ts:585, 590`). `burnout-quiet-session` priorFact "saying no at work" contains neverSaid `work`. No test checks a trap term against its own transcript (`tests/evals.test.ts`).
- Severity: S3
- Fix sketch: word-boundary matching for `neverSaid`; a unit test in `tests/evals.test.ts` that every `neverSaid`/`mustNotSay` term is absent from its own transcript and prior facts (the probe above, as a test).
- Decision it came from: 76.45 (the long Arabic case added).

### CHK-27 · `npm run evals` without a key runs one of six suites and exits green
- Verdict: PARTLY
- Sources: code-16 Suspect 3
- Promise: T1, P5 (risk)
- Who is hurt and how: a keyless run prints "not run: ... (no OPENAI_API_KEY)" and exits 0 over `risk` alone. The line is honest, but any gate that reads only the exit code reads green over the note, grounding, attribution and speech suites.
- Evidence: `evals/run.ts:100-103` drops `needsModel` suites when there is no key; `:118-123` prints them; only `--only` a model suite refuses (`:106-109`). Exit 0 path `:236`.
- Severity: S3
- Fix sketch: exit non-zero (or a distinct code) when any suite was skipped, unless `--offline` was asked for.
- Decision it came from: evals runner design ("a suite that could not run is not a suite that passed", applied only to suites that started).

### CHK-28 · The e2e de-identification check reads the first model request, which may not be the note
- Verdict: UNTESTABLE HERE
- Sources: code-16 Suspect 4
- Promise: README "context is de-identified" (P3-adjacent)
- Who is hurt and how: if the first chat request is the diariser's, the test proves the diariser's prompt carries no patient name and never looks at the note prompt, which is the one that carries context.
- Evidence: `tests/e2e.test.ts:360-365` `mock.state.chatRequests[0]`; `lib/ai/notes.ts:386-391` runs `diariseSession` before `generateNoteContent`; `lib/ai/diarise.ts:284` makes a chat call, but diarise is a no-op when two-track capture already labelled speakers, so which request is first depends on the e2e transcript. Mock state is never reset between tests (grep).
- Severity: S2 if the note prompt is unchecked
- Fix sketch: select the request by the note system prompt; assert on every chat request, not one. The walk: run `test:e2e` on a branch and print each request's first line.
- Decision it came from: H11 (diariser before note), added after the e2e test.

### CHK-29 · verify:principals, the privacy gate, never looks at server actions
- Verdict: CONFIRMED (new finding)
- Sources: related to code-13 Broken (verify-principals raw source); explains MAP Confirmed 3 and 8
- Promise: A5, P4, and README "nothing about a record before a handle is proven"
- Who is hurt and how: the gate asks whether every page and route handler that reaches a clinical data module is guarded. Server action files (`"use server"`) are not entry points to it, yet they are directly callable from a browser. The two unauthenticated holes the coordinator confirmed are both actions: `recovery-actions.ts` (anyone with a session id can cancel, refund or reassign a future session) and `patient/claim/actions.ts` (claim a record by uuid). The gate even declares `recovery` clinical and patient-or-admin only, and still passes.
- Evidence: `scripts/verify-principals.ts:369-371` `entryPoints` = `page|layout|route` only; `:138` `recovery: { who: ["patient", "admin"], clinical: true }`; `app/(patient)/sessions/[id]/recovery-actions.ts:1, 9-15` (`"use server"`, imports `@/lib/data/recovery`, no guard). MAP Confirmed 3 and 8.
- Severity: S1 (the gate that certifies the privacy wall is blind to the class of file where the wall is broken)
- Fix sketch: treat every file whose first statement is `"use server"` as an entry point; an action that reaches a clinical module with no guard and no named capability fails. The planted control: a `"use server"` file importing `lib/data/sessions` with no guard.
- Decision it came from: 58.6 / C365 (verify:principals built over pages and routes).

### CHK-30 · verify:principals reads guards and capabilities from raw source, and any capability name exempts a page from every clinical check; its import CONTROL cannot fail
- Verdict: CONFIRMED
- Sources: code-13 Broken (verify-principals 351-358, 526-546; 590-594), code-13 Stale (verify-principals 690-697)
- Promise: A5, E2, C2 (who reaches clinical data)
- Who is hurt and how: a page with `requireStaff(` in a comment counts as guarded (T1); a page that merely mentions `listRadar` or `publicProfile` (both public, not authentication) is treated as authenticated and skips every clinical-module check, so a public radar page that also reached `lib/data/sessions` would pass. The "forward graph really resolves imports" control asserts `size >= 0`.
- Evidence: `scripts/verify-principals.ts:475` `src = s.body.get(entry)` (raw; `s.code` is the stripped map, `scripts/_surfaces.ts:165-169`); `:351-358` guard and capability regexes over it; `:323-329` `CAPABILITY_AUTH` includes `listRadar`, `publicProfile`; `:537-540` `if (!hasCapabilityAuth(src)) unguarded.push` with no check of which module the capability covers; `:590-594` `modulesFrom(patientAccount).size >= 0`.
- Severity: S1 (a check that cannot fail on the privacy wall)
- Fix sketch: use `s.code`; make each capability name the modules it may reach (a join token reaches the session it names, the radar reaches `radar` only); control asserts a known page reaches a known module (`size > 0` and contains it).
- Decision it came from: 58.6, C365, C366; C205 applied only to the audit scan.

### CHK-31 · Controls that assert constants: verify:machines, verify:palette (two), verify:rail monolingual, verify:sprint55, 57, 65, 28, 29, 47
- Verdict: CONFIRMED
- Sources: code-13 Broken (verify-machines 113-120; verify-palette 187-191, 255-260; verify-rail 261-268); code-15 Broken 10, Stale 11; code-14 Stale 11, 13, 14
- Promise: A1 (machines: every stuck person has a way out), palette contrast, rail bilingual pay screen
- Who is hurt and how: each prints "CONTROL ... ok" whatever the product does. The machines control would pass with the drift loop deleted; the palette controls test `"950" in BRAND` and a regex on a literal; the rail control tests a local object; 55 compares a count with itself; 57 is `check(..., true)`; 65 is a set-size tautology.
- Evidence: `scripts/verify-machines.ts:112-120` (`new Set(["a","b"])`); `scripts/verify-palette.ts:187-191, 255-260`; `scripts/verify-rail.ts:261-268` (`pretend`); `scripts/verify-sprint55.ts:216-221`; `scripts/verify-sprint57.ts:281-287`; `scripts/verify-sprint65.ts:682-686`; `verify-sprint28.ts:320-324`, `verify-sprint29.ts:300-304`, `verify-sprint47.ts:126-130` (code-14; not re-opened beyond the reader's lines).
- Severity: S2 for machines (it certifies "nobody is stuck", which task 124 says is false), S3 for palette and rail, S4 for the rest
- Fix sketch: each control calls the scan function it controls with a planted input; `verify-traps` should fail a CONTROL whose expression references no function defined or imported in the file.
- Decision it came from: TRAPS T2 (every check gets a control), met by spelling.

### CHK-32 · verify:machines never examines the manual transfer lifecycle, and admits no dead end
- Verdict: CONFIRMED
- Sources: code-06 Broken 11, code-13 Unclaimed (c) (`KNOWN_DEAD_ENDS` empty), MAP Suspect 4, MAP Confirmed 7
- Promise: A3, A1
- Who is hurt and how: the gate that says "every stopped person has a way out" is green while a guest whose transfer was rejected is never told and has no screen (MAP Confirmed 7), because `manual_payments` states are not declared as a machine at all.
- Evidence: `scripts/verify-machines.ts:53` `KNOWN_DEAD_ENDS` empty; `lib/lifecycle/machines.ts` has no `manual_payments` machine (grep for `manual`: none; the only transfer arrow is a session's `pending -> paid` at `:279`, with no `rejected` state). MAP Confirmed 7 for the rejected guest.
- Severity: S2
- Fix sketch: declare the transfer machine (awaiting_proof, submitted, confirmed, rejected) with the exits each role has; the gate then goes red on `rejected` for a `session` payer until A3 is fixed.
- Decision it came from: sprint 73 rail built after the machines register (#163 not built).

### CHK-33 · verify:sprint25 claims to test C121 and never asks the gated reader
- Verdict: CONFIRMED
- Sources: code-14 Broken 9, Stale 7; related code-06 Broken 2
- Promise: README invariant "nothing about a record before a handle is proven"; P4
- Who is hurt and how: the check proves the matcher can find the record and that the account is unproven, then stops. It never calls what `/patient/claim` renders. code-06 Broken 2 shows the handle can be "proven" by an email code marking the phone verified, so a stranger's number reads as proven; this gate could not see either failure.
- Evidence: `scripts/verify-sprint25.ts:8-10` header claim; `:161-178` only `suggestionsFor` (raw) and a `phoneVerifiedAt` select.
- Severity: S1 (disclosure that a clinician keeps notes on a stranger's number; a check that cannot fail)
- Fix sketch: call the claim page's reader (or `openChallenges`/the page's data function) for the unproven account and assert it returns nothing, then prove the handle and assert it returns the record.
- Decision it came from: 25.14 / C121.

### CHK-34 · `indexOf(a) < indexOf(b)` ordering checks pass when `a` is missing, including the crisis alert ordering
- Verdict: CONFIRMED
- Sources: code-14 Broken 10
- Promise: P5-adjacent (crisis alerts), A5 (staff enumeration)
- Who is hurt and how: `verify:sprint35` asserts a crisis alert is written `pending` before anybody is notified by comparing positions of two strings; delete the pending write and `indexOf` returns -1, which is less than anything, and the check passes. The same shape guards "the staff refusal comes after the password check" in 21R.
- Evidence: `scripts/verify-sprint35.ts:248-253`; `scripts/verify-sprint21r.ts:927-932`.
- Severity: S1 for 35.3 (passes on exactly the regression it exists for, on a crisis path), S2 for 21R.1
- Fix sketch: assert both indices are `>= 0` before comparing; better, drive `raiseCrisisAlert` with a failing notifier on a branch and assert the row is `pending`.
- Decision it came from: sprint 3 crisis alerts, re-asserted in 35.

### CHK-35 · `refused()` accepts any error and prints the constraint's name as a literal
- Verdict: CONFIRMED
- Sources: code-14 Broken 13
- Promise: P3/T1 (every clinical fact traces to its sentence), P4
- Who is hurt and how: about twenty checks in 33, 36 and 37 say "the database REFUSES a fact with no evidence" when the write failed for any reason (a foreign key, a typo, a missing column). A dropped constraint plus an unrelated error reads as the rule working.
- Evidence: `scripts/verify-sprint33.ts:58-65` returns any message; `:157-161` prints `"quote_not_blank"` as a literal, not the message. Same helper `scripts/verify-sprint36.ts:36-43`, `verify-sprint37.ts:45-52`.
- Severity: S2
- Fix sketch: `refused(write, "quote_not_blank")` passes only when the error message names that constraint.
- Decision it came from: sprint 33 facts provenance.

### CHK-36 · verify:sprint11 checks its own copy of the radar predicate
- Verdict: CONFIRMED
- Sources: code-14 Broken 14
- Promise: P1 (somebody free now), crisis radar
- Who is hurt and how: "the radar's own reachability predicate excludes a booked clinician" runs SQL written in the verifier; the real `reachable()` could drop the clause and this stays green.
- Evidence: `scripts/verify-sprint11.ts:340-358`; real predicate `lib/data/radar.ts:215-222`.
- Severity: S2
- Fix sketch: call `listRadar()` (or `queryBoard`) at that instant and assert the clinician is absent.
- Decision it came from: 11.5 / C62a.

### CHK-37 · verify:sprint17's netting-off control greps a sentence that no longer exists
- Verdict: CONFIRMED
- Sources: code-14 Broken 8, Stale 4
- Promise: T3
- Who is hurt and how: "switch netting off and the sentence is gone" is green whatever the page says, because it looks for "holding your earnings" and the sentence now reads "While we hold your earnings". A page could keep promising netting while netting is off.
- Evidence: `scripts/verify-sprint17.ts:508-517`; `lib/i18n/messages.ts:193` `pricing.netting`.
- Severity: S3
- Fix sketch: look for `t("pricing.netting")`'s rendered value, not a phrase.
- Decision it came from: C69.

### CHK-38 · verify:palette checks ground and ink on the same line only; a white-on-teal button ships
- Verdict: CONFIRMED
- Sources: code-11 Suspect (verify-palette 232-235), code-11 Broken (earnings.tsx:187), MAP Suspect 12
- Promise: none (accessibility)
- Who is hurt and how: the clinician's "Payout dashboard" button is white text on the teal card (about 2.2:1), unreadable for many; the gate that bans it cannot see a ground set on a parent element.
- Evidence: `scripts/verify-palette.ts:228-237` per-line match; `components/billing/earnings.tsx:115` `bg-brand-500` card, `:187` `bg-navy-600/10 ... text-white` child.
- Severity: S3
- Fix sketch: render and measure (the contrast crawler) rather than grep; interim, flag `text-white` in any file that also has a `bg-brand-500` ancestor block.
- Decision it came from: palette ruling (white on teal banned).

## Part D: gates that read the wrong thing (T1 comments, T3 hand-typed routes, T4 truncation, counts of the wrong property)

### CHK-39 · C205, the one enforcer of T1, cannot see `readFileSync(variable)`; verify:traps' own T1 detector passes any file that mentions `readSource`, and its T1 control cannot fire
- Verdict: CONFIRMED
- Sources: code-14 Stale 2, code-15 Broken 5, code-15 Stale 10, code-15 Stale 13
- Promise: indirect: every gate that scans source
- Who is hurt and how: the rule "strip comments before scanning source" is enforced by a regex that only matches a literal `.ts"` path inside `readFileSync(`. Walks that read each file raw into a variable slip past it, and `verify:traps` exempts any file that so much as imports `readSource`. At least seven raw reads of TypeScript pass both gates; the one that can pass falsely is `verify-sprint37r.ts:138`, where a comment naming `PatientBack` makes a page with no back control read as having one. The T2 ratchet measures the spelling "CONTROL", not a control.
- Evidence: `scripts/verify-sprint37l2.ts:270-276` (only `^verify-.*\.ts$`, only a literal path); `scripts/verify-traps.ts:88-90` (`if (/stripCommentsKeepingLines|readSource/.test(body)) return false`); `:319-324` the T1 "CONTROL" checks that verify-traps itself is not raw and that `_surfaces.ts` mentions `readFileSync`, never running the detector on a raw scanner; `:162, 327` `NO_CONTROL_BASELINE = 19` over `/CONTROL/i.test(file)`. Raw reads by variable: `verify-sprint37r.ts:138`, `verify-sprint41.ts:246, 412`, `verify-sprint12.ts:300`, `verify-sprint51.ts:165`, `verify-sprint53.ts:79` (feeds `:540`).
- Severity: S3 (the misses found today fail loud rather than green, except 37r:138)
- Fix sketch: route every read of `.ts`/`.tsx` through one helper and have C205 flag any `readFileSync` whose argument is not a string ending in a non-source extension; the T1 control runs the detector on a planted string.
- Decision it came from: TRAPS T1 ("enforced by verify:sprint37l2 (C205), not by verify:traps").

### CHK-40 · `_surfaces.unwiredActions` matches callers in comments (T1)
- Verdict: CONFIRMED
- Sources: code-12 Broken 5
- Promise: none directly (reachability: an action nothing can call)
- Who is hurt and how: an action named only in a comment reads as wired, the false PASS the file's own header calls the dangerous half. Its three siblings were fixed to use `s.code`.
- Evidence: `scripts/_surfaces.ts:204-215` `pattern.test(s.body.get(f)!)`; `s.code` exists (`:165-169`).
- Severity: S3
- Fix sketch: `s.code.get(f)`.
- Decision it came from: C369 fixed the other three.

### CHK-41 · `_reachability` skips `public` at every depth, reads raw source, and counts any component as a surface
- Verdict: CONFIRMED (read the walk; the component rule taken from the reader)
- Sources: code-12 Broken 8
- Promise: none directly
- Who is hurt and how: `components/public/` is invisible to the reachability register (H31, the bug `_surfaces.ts:48-62` fixed for itself), so a public component that is the only surface for a capability is reported as missing. Same skip list in `verify-sprint41.ts:39`, `verify-sprint43`, `verify-sprint44` (code-14 Broken 12): no bot dispatcher or credential opener is in `components/public` today (grep), so those miss nothing yet.
- Evidence: `scripts/_reachability.ts:38` `["node_modules", ".next", ".git", "drizzle", "public"].includes(entry)` at every depth; `verify-sprint41.ts:39` identical.
- Severity: S4
- Fix sketch: skip `public` only at the repository root (compare the full path), as `_surfaces.ts` does.
- Decision it came from: H31.

### CHK-42 · `inventory.routes()`, the list T3 says every gate must derive from, omits the join, pay, room, sign-in and record pages
- Verdict: CONFIRMED
- Sources: code-12 Broken 6, MAP Suspect 14, code-16 Stale 21 (`.walkthrough2/routes.mjs`)
- Promise: T4 (the invite link), P1 (into the room), A1 (the pay sheet), P2
- Who is hurt and how: the contrast crawler, the machines gate and every T3-compliant consumer never load `/join/[token]`, `/pay/[token]`, the room, `/login`, `/signup`, `/staff/sign-in`, `/records/[token]`, `/feedback/[token]`, `/support` or `/j`. These are exactly the pages the `live` walk position says were broken on production last week. T3's rule, followed faithfully, hides them.
- Evidence: `scripts/inventory.ts:50-58` `PORTALS` lists seven route groups; `ls app` shows `(auth)`, `(room)`, `feedback`, `j`, `join`, `pay`, `records`, `session-expired`, `support` outside them. Consumers per reader: `verify-machines.ts:36`, `verify-contrast.ts:51`. `.walkthrough2/routes.mjs` is a separate hand list with no sponsor, clinic, partner, join or records routes.
- Severity: S2 (the pages with the most recent production failures are the ones no gate opens)
- Fix sketch: derive from the filesystem (`app/**/page.tsx`, every group) and classify by guard; a control asserting `/join/[token]` and `/pay/[token]` are in the list.
- Decision it came from: TRAPS T3; INVENTORY generator scoped to portals.

### CHK-43 · The public smoke gate's page list is hand-typed and misses `/for-therapists`; check-live drops pages that error and passes on zero
- Verdict: PARTLY
- Sources: code-12 Broken 7, code-14 Stale 17
- Promise: none directly (the marketing site renders)
- Who is hurt and how: the reader said a page that errors is silently dropped from the smoke gate; that is true of `check-live` only. `smoke-public` fetches the same list itself and fails on any non-200 or a near-empty page (handled). What holds: `LIVE_PAGES` is typed by hand (T3) and omits `/for-therapists`, the page clinicians are sent to and whose copy MAP flags; and `check-live`'s own run exits 0 on "the live site did not answer" and drops any page that errors.
- Evidence: `scripts/check-live.ts:95-131` 14 paths, no `/for-therapists`, `/verify`, `/t/[id]`; `ls app/(public)` has `for-therapists`. `:59` `if (!response.ok) return null`; `:146-149` zero pages exits 0. Patch for the smoke: `scripts/smoke-public.ts:247-274` records non-200 and short pages as failures. `check-live.ts:219` guard uses `includes`, weaker than the `endsWith` form T6 bans, and `verify-traps.ts` looks only for `endsWith` (`:398-402`).
- Severity: S3
- Fix sketch: derive public pages from `app/(public)` (and `[slug]` from `content_pages`); `check-live` counts an error as a failure and exits 1 on zero pages; `ranDirectly("check-live.ts")`.
- Decision it came from: C354 (the list drifted before).

### CHK-44 · gates.ts keeps the last FILTERED line, not the last line
- Verdict: CONFIRMED
- Sources: code-12 Broken 12, code-15 Broken 11
- Promise: none (internal)
- Who is hurt and how: a failing gate whose output has no FAIL/Error words (for example "live: 3 pages wrong") shows no reason at all; the T4 fix keeps the last matching line, so a total written in lower case is dropped. `verify:traps` checks T4 in two files only; `verify-sprint77.ts:142, 386` and `verify-synthetic.ts:100, 125` truncate offenders with no count.
- Evidence: `scripts/gates.ts:134-145` `.filter(/FAIL|Error|error|✗|rose|UP from/)` then `lines.at(-1)` of the filtered set; `scripts/verify-traps.ts:388` T4 over `gates.ts` and `verifiers.ts` only.
- Severity: S4
- Fix sketch: always print the raw last line of output after the filtered ones.
- Decision it came from: TRAPS T4.

### CHK-45 · "Exactly six scripts may be let through to production" counts a flag, not the property
- Verdict: CONFIRMED (the count is right over its own definition; the sentence it prints is false)
- Sources: task brief; code-15 Stale 1, code-12 Stale 10, code-13 Stale (sync-blocks "fifth door")
- Promise: none directly; it is the guard behind every S2 in Part A
- Who is hurt and how: the founder reads "exactly SIX scripts anywhere under scripts/ may be let through to production" and believes the rest are shut out. Every script that never calls `writesTo()` at all is let through by default: verify:sprint1, 2, 4, 5, `seed.ts --refresh-content`, grant-admin, q.ts, backfill-diarise, reset, copilot-exam, unlabel-straddles, `verify:migrations --repair`, the demo films, and everything under `tests/`. Three documents give three different numbers for the six (HAZARDS "four", `_verify.ts:206` "five", this gate "six").
- Evidence: `scripts/verify-sprint57.ts:430-473` counts files matching `productionIsAllowed:\s*true`; the refusal it implies lives only in `writesTo()` (`scripts/_verify.ts:193-247`), which the listed scripts never call (CHK-1, 3, 4, 7, 8, 9, 10, 11, 12, 46). `on-production.ts:66-177` allow-lists `copilot:exam` and `ship:content`, which are not among the six.
- Severity: S2
- Fix sketch: count the other way: every script that opens a database connection (`connect(`, `dbFor(`, `neon(`) must call `writesTo()` or `hostOf()`-plus-read-only, and the gate prints both lists.
- Decision it came from: 76.52, 76.62, 78.1.

### CHK-46 · verify:migrations passes on a count, and `--repair` rewrites the production ledger through a door labelled read-only
- Verdict: CONFIRMED
- Sources: code-13 Broken (verify-migrations 114-118, 81-105), code-13 Unclaimed (b)
- Promise: P4 and every rule held by a trigger or CHECK (append-only summaries, trigger 0060, 0083)
- Who is hurt and how: the "journal and ledger agree" check compares row counts, so a stale ledger hash plus a missing migration reads as agreement (the missing list is computed by hash but only acted on under `--repair`). `--repair` records a migration as applied when its tables and columns exist, even if its triggers, CHECKs or data never ran, so the next `db:migrate` skips it forever; `verify:migrations` is on the production list as `writes: false`, and `on-production.ts` passes extra arguments through, so `on:production -- verify:migrations -- --repair` writes production.
- Evidence: `scripts/verify-migrations.ts:79` missing by hash; `:81-104` repair inserts into `drizzle.__drizzle_migrations` with no `writesTo()`; `:392-420` `objectsPresent` checks only `CREATE TABLE` and `ADD COLUMN`; `:114-118` pass on count equality. `scripts/on-production.ts:165` read entry; `:240, 292` args forwarded.
- Severity: S2 (a safety trigger can be marked applied without existing, silently and permanently)
- Fix sketch: fail when `missing.length > 0` or any ledger hash is not in the journal; `--repair` refuses unless `writesTo({ productionIsAllowed: true })` and also checks every trigger, function and constraint the migration names.
- Decision it came from: 11R.18 / C66 (H17).

### CHK-47 · verify:runbook accepts "forty eight" whatever the file lists
- Verdict: CONFIRMED
- Sources: code-13 Broken (verify-runbook 187)
- Promise: none directly (the edge register behind A2, A3, A4, C4)
- Who is hurt and how: the check's own header example (a document saying forty eight while the file lists thirty) passes, because "forty eight" is hard-coded as always acceptable beside the real count. The edges document is where A3 and A4 claim their authority.
- Evidence: `scripts/verify-runbook.ts:173` example; `:187` `new Set([String(edgeIds.size), "forty eight"])`.
- Severity: S4
- Fix sketch: accept only the measured count, spelled in digits or words from one number-to-words function.
- Decision it came from: SIMULATION digest ("verify:runbook blocks count drift").

### CHK-48 · verify:notices allows eighteen email-only senders, and counts a file wired if any one call in it is
- Verdict: CONFIRMED
- Sources: code-13 Suspect (verify-notices 82-85), code-13 Unclaimed (c), MAP P2 row
- Promise: P2 ("nothing the product tells you is only in an email"), whose cited enforcer is this gate
- Who is hurt and how: the gate is green while eighteen senders write nothing in the app, by baseline. Per-file counting hides more: `lib/billing/payment-notices.ts` counts as wired because the "confirmed" message carries a notice, while "We have your transfer" (`payment.submitted`) reaches the payer only by email or WhatsApp; and no rejection message exists at all (MAP Confirmed 7). A patient who loses the email has no door back.
- Evidence: `scripts/verify-notices.ts:46` `UNWIRED_BASELINE = 18`; `:80-83` `unwired(file)` is one regex per file. `lib/billing/payment-notices.ts:191-202` notify with no `notice`, `:229-237` with one. Grep of `lib` and `app`: 22 files call `notify(` with no `notice:` anywhere in them (includes the two named exemptions and comment mentions).
- Severity: S2
- Fix sketch: count per call (parse each `notify(` argument object); lower the baseline to the number that are deliberately outbound only and name each one.
- Decision it came from: P2 gate "written after a patient was invited on production and their app said nothing"; the ratchet chosen so the gate could land on day one.

### CHK-49 · verify:prove checks the citations against `defaults.ts`, not the published rows
- Verdict: PARTLY
- Sources: MAP Suspect 8, code-13 Suspect (verify-prove readSource on markdown)
- Promise: all nine page-and-phrase citations (P1, P3, P4, T5, C1, C3, C5, E1, E2)
- Who is hurt and how: the gate says so itself: a CMS row that drifted from the shipped default passes. Today it holds: MAP's live-site check (2026-09-22) found all nine phrases on the live pages. The reader's second worry is wrong: `readSource` strips only `//` at the start of a line and `/* */` blocks (`scripts/_dashes.ts:63-68`), and `docs/PROVE-IT.md` contains no `/*` or `*/` (grep), so no URL or command is eaten.
- Evidence: `scripts/verify-prove.ts:272-276` (its own admission), `:283-286` `findDefaultPage`. MAP "Live-site checks, 2026-09-22".
- Severity: S3
- Fix sketch: `verify:sprint28` already scans published rows; point the citation check at the same reader, or add the nine phrases to `smoke-public`'s live fetch.
- Decision it came from: task 156 (live drift), accepted in the gate's comment.

