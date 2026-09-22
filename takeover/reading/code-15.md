# Slice 15: scripts (part 4 of 4)

Legend used below for verifier traps: T1 = reads source with comments in (readFileSync on a .ts
path instead of `readSource`); T2 = no control; T3 = hand typed route list; T4 = truncated
output; T6 = runs main() on import / argv suffix guard. "Syntax" = asserts a spelling rather than
a property. "One of N" = reads one file of several that implement the thing. "Wrong medium" =
looks for the answer where the product does not give it.

## Files

### scripts/verify-sprint48.ts (359 lines)
- For: sprint 48 gate, the in-room copilot is free, bounded to the record before `startedAt`, and the free window ends with the session clock.
- Decides / checks:
  - 48.2 (l.69-130): reads the FIRST `copilot_threads` row (LIMIT 1) and the first session in that org, raw-inserts two `copilot_messages` (one with `sessionId`, one null) and asserts `checkQuota().used` moves only for the null one. Real DB rows, real function. Control present (between-sessions question still counts). Good.
  - 48.6 (l.145-202): raw-inserts an `in_progress` session for the first patient of that org, asserts `liveSessionForPatient` returns it, ages `startedAt` past `runningMinutes + countdownMinutes + 60` and asserts null. Both halves present. Fragile: if that patient already has a real in-progress session, `fresh?.id === freshId` may pick the other one.
  - 48.4 (l.217-244): SOURCE regexes on `lib/ai/case-copilot.ts` (`liveSince\?: Date \| null`, `buildPatientContext\(opts\.patientId, before\)`) and `lib/data/journals.ts` (`lt\(journals\.createdAt, opts\.before\)`). Syntax, not property: a rename of the parameter fails it; a bound applied wrongly elsewhere passes. `!/recordingConsent/` on case-copilot.ts only is an absence check with no control and is one of N (context assembly also lives in journals.ts / transcript readers, not scanned).
  - 48.5 (l.257-283): `troom.ask.bound` key present in ask-panel.tsx, and the English string says "only know what came before" and not "not being recorded". Reads the dictionary (right medium). Prompt carries "TIME BOUND THAT OVERRIDES EVERYTHING BELOW" (syntax).
  - 48.10 (l.287-324): patient can stop recording: `stopRecording` in patient-room.tsx and exported from app/join/[token]/actions.ts; the body (sliced from that export to END OF FILE, not to the function end) sets `recordingPausedAt: new Date()` and has no `delete(transcriptSegments)`. Because the slice runs to EOF, a later function in the file that deletes segments would fail it (false red), and the positive regex could be satisfied by a later function (false green).
  - 48.9: chat.tsx polls (`setInterval`, `copilot/live?patient=`, no `WebSocket`).
  - 48.7 (l.346-354): `indexOf("accessFor(actor, patientId)") < indexOf("checkQuota(actor, found.thread.id)")` in app/(app)/copilot/actions.ts. Ordering by first textual occurrence, syntax-bound.
- Reads: DB rows (threads, sessions, patients, copilot_messages), source via `readSource` (T1 clean), `lib/i18n/messages` en.
- Traps: T1 clean. T2: DB halves have controls; source absence checks do not. T3/T4 n/a. T6: bare `void main()` at l.359, fine as long as nothing imports it.
- Assumes: `required()` fixtures exist (a thread, a session, a patient in the same org). Writes via `writesTo()` so refuses production.
- Promises: T5 (copilot only while allowed, the 48.7 ordering). Kept as far as a textual order check can say. Checked separately: `app/(app)/copilot/actions.ts:115,150` sets `sessionId` from the server-derived `live?.id`, not client input, so the free path cannot be claimed by a client.
- Notes: the in-room message is attributed to ANY session in the org (l.71-79), not a live session for that patient; the test proves "a message with a sessionId is not counted", not "a question asked in a live room is not counted". The link from live room to sessionId is `copilot/actions.ts:115`, which this gate does not exercise.

### scripts/verify-sprint49.ts (404 lines)
- For: sprint 49 gate, AI cost ledger (cost_microcents not cost_cents), patient attribution column, rates in settings, platform bucket, consent rate, revenue split, and the corporate wall (C244).
- Decides / checks:
  - C279 (l.63-103): walks `lib/data`, `lib/console`, `lib/billing`, `app` (derived, not hand-typed; `sources.length > 200` is a width control) for `aiRequestLogs.costCents` via `readSource` (T1 clean). Control: at least 3 files read `costMicrocents`. Both halves present. Excludes any file whose path ENDS WITH `client.ts` (l.78): suffix match, so e.g. `lib/partner/api-client.ts` or any `*client.ts` in those roots is silently exempt. Trap T6's suffix shape applied to an exemption.
  - l.128-150: plants an ai_request_logs row costing 40 units with cost_cents 0 and asserts the columns disagree. Planted, so it is no longer vacuous (C284). Deletes by `model = PLANT`, not in a `finally`.
  - 49.14a: information_schema says `ai_request_logs.patient_id` is nullable uuid. The detail text claims ON DELETE SET NULL, which is not checked.
  - 49.14b: settings rates equal `__costing.TOKEN_RATES/AUDIO_RATES` shipped constants (compares to code, not a retyped number). Frozen-at-write asserted by regex on client.ts (syntax).
  - 49.14c: plants a null-org call, asserts `costByAccount` and `costByPatient` return a `PLATFORM_BUCKET` row and that its cost is at least 75,000. Control present.
  - 49.4: consent buckets sum to total; percent null only when total 0. Runs over whatever is in the DB (no plant); if total is 0 the arithmetic check is trivially true.
  - 49.5: revenue fields are `number` typed. Type check only, not a value check.
  - 49.11: `!/platformFeeCents \+ aiFeeCents|totalRevenue\s*=/` on usage.ts. Absence of one spelling; no control.
  - 49.13 / C244 (l.339-399): the corporate wall. Reads ONLY `lib/data/usage.ts`, `lib/data/admin.ts`, `lib/data/vault.ts` (hand-typed list of 3). A file fails if it mentions any of `sponsors|sponsorPots|sponsorSeats|enrolments|sponsorDomains` AND any of `sessions|patients|people` anywhere in the file (co-occurrence, not a join). Controls exist but test the regexes against two literal strings, not against the files.
- Reads: source (readSource), DB rows (planted), settings.
- Promises: E1/E2 (the wall). See Suspect: the wall check does not read the sponsor portal files at all.
- Notes: `sponsorSeats` does not exist in `lib/db/schema.ts` (the exports are `sponsors`, `sponsorUsers`, `sponsorAuthSessions`, `sponsorCodes`, `sponsorIdentifierFields`, `sponsorDomains`, `enrolments`, `sponsorPots`, `enrolmentVerifications`, `enrolmentAttestations`); the regex misses `sponsorCodes`, `sponsorIdentifierFields`, `enrolmentVerifications`, `enrolmentAttestations` and any pot ledger table.

### scripts/verify-sprint5.ts (282 lines)
- For: sprint 5 gate (people/patients backfill): every chart has a person, no two charts at one practice share a person, each chart points at its own person, duplicate emails did not merge different names, `findMatches` suggests only, `assertClaimed` refuses an unclaimed person.
- Decides / checks: l.63-74 per-practice duplicate query (amended 78.5 for portability); l.82-92 prints (does not check) cross-practice people; l.102-115 name/email pairing via SQL join; l.139-162 per-email dupes; l.170-223 CONTROL plants two people + two charts under one address and asserts 2 people / 2 names; l.227-254 `findMatches` returns no email/phone and `redactName` hides the name; l.258-273 `assertClaimed` throws `UnclaimedError`.
- Reads: DB rows directly (patients, people). No source reads.
- Traps: T2: the 5.3 per-practice check has no control of its own (the control plants a DIFFERENT shape: two people at one address, which exercises the name rule, not the GROUP BY organization_id, person_id query at l.63). The l.82 "moved" query is printed, not checked. 5.4 and 5.5 are silently skipped when the DB has no email or no unclaimed person (no "deferred" line, unlike `skipUnless`), so the check count varies by database (the C284 defect other files fixed). T6: bare `main()` at l.282.
- 🔴 Production guard: it uses `connect()` from `scripts/db.ts` (24 lines, no guard, verified by grep) and never calls `writesTo()`, yet it WRITES (planted `people` and `patients` rows, l.184-199). This is a verifier that can write to production if `DATABASE_URL` points there, contradicting HAZARDS.md:152 "Every verifier that touches the database refuses the production endpoint by name". Cleanup is in a `finally`, but a killed process leaves two fabricated people and charts.
- Notes: `redactName` check `!r.includes(m.firstName.slice(1))` is vacuously failing for a one-letter first name (`"".includes` is true). Not its own reporter: prints its own summary.
- Promises: P4 (one person, charts at several practices). The amended check keeps the portability shape legal.

### scripts/verify-sprint50.ts (297 lines)
- For: sprint 50 gate: a country switched off on the radar hides its clinicians immediately (cache dropped), a clinician with no country is never hidden, the money switch (`getCountrySettings`) is separate.
- Decides / checks: fixture is the first `therapist_radar` row (l.67), forced online with a fresh heartbeat and an approved verification (l.99-115); control on-board while open (l.157), off when closed (l.168), back when reopened (l.193): both halves plus a re-open control. Null country survives a closed EG (l.216). `getCountrySettings("EG")` non-null while closed (l.230). Source: both payment consumers still call `getCountrySettings(` (l.251-258); radar.ts filters languages on output (regex syntax, l.274-279); route.ts has no `where(`.
- Reads: real product functions (`listRadar`, `setTaxonomyEnabled`, `closedCodes`, `getCountrySettings`) over real rows; source via readSource.
- Traps: T1 clean. Controls good on the radar half. The 50.1c "cache dropped" check (l.183) is the conjunction of the two booleans already checked, so it adds no independent evidence (it does prove the cache point only because the reads happen inside the TTL, which the comment says).
- 🔴 Restore defects (dev data, not product): l.112-114 when the clinician ALREADY had a verification row it is `UPDATE ... SET state = 'approved'` and `restore()` (l.117-133) never puts the old state back. A pending or rejected clinician on the dev branch is silently approved by every run, and trigger 0083 then reflects that onto `users.verification_status`. l.132 `restore()` DELETEs every `taxonomy_entries` row with code EG unconditionally, destroying any operator-authored EG entry that existed before the run.
- Promises: C1 (radar filter integrity, indirectly).

### scripts/verify-sprint51.ts (705 lines)
- For: sprint 51 gate, content and design: table reachability, em dash ban, retired "bundle" vocabulary, four capabilities sold in copy, 24/7 not a response time, rating floor, one price per clinician, SOS orb on patient pages outside the group, entry pages carry structure, literal scanner calibration.
- Decides / checks:
  - 51.6 `scanReachability()` from `_reachability.ts` (derived) with `NO_SCREEN_BY_DESIGN` allow-list; stale-exemption control (l.58) and known-orphan control `patient_auth_sessions` (l.78). Good both ways.
  - 37.2 voices panel regex (no model/likely/confidence words); C132 source panel has no `<input|<textarea` and says `onlyOurs`.
  - 51.8 em/en dash (l.150-192): reads `lib/i18n/messages.ts`, `lib/content/defaults.ts`, `defaults-ar.ts` with raw `readFileSync(file)` (l.165) on `.ts` paths held in a variable, so C205's literal-path detector cannot see it. Intentional (only double-quoted strings are scanned), but single-quoted, backtick and template strings and JSX text are invisible to `hasDash` (l.152-155). Control present (planted strings).
  - 51.7 radar SQL contains `NOT EXISTS`, `a.status = 'booked'`, `interval '15 minutes'` (syntax); unique index name in schema.ts (syntax, reads the schema FILE not the DB); cron route mentions `bookingsNeedingReminder`, `isQuietHour`, `notify(`; calendar has "day","week","month", `dayKey(`, no `toISOString().slice(0, 10)`; bookings actions pass `patientId: input.patientId`, call `getPatient(`, `accessFor(`, `notify(`, `if (!delivery.sent)`.
  - 51.4 orb (l.323-401): HAND-TYPED list of 7 patient pages outside `(patient)` (T3 by its own admission, "a judgement"). Checks each file MENTIONS `SosOrb|PatientChrome`, not that it renders it (a mention in an unused import passes). Control: `for-clinics` page does not match. Orb has `tel:` and no `fetch(`/`use server`/`action=`; orb calls `lineForNumber(`.
  - 51.1 / 51.9 / 51.10: retired words, four "sold" ideas, 24/7 regex, all read `lib/content/defaults.ts`, `defaults-ar.ts` and the dictionary. WRONG MEDIUM for published pages: H28 says a slug with a `content_pages` row is served from that row forever, so these checks prove the fallback file, not what a visitor reads. Controls on each regex are present.
  - C273 `RATINGS_VISIBLE_AFTER = [1-9]` (syntax). C274 one `session_rate_cents` column in schema.ts and no second geo column (syntax, file not DB).
  - 51.3 two hand-typed entry pages; predicate "has <Card or rounded-2xl/3xl, or fewer than 3 <p>"; control on a planted string.
  - 51.11 `literalsIn` both directions.
- Reads: source (readSource except the dash scan), reachability scanner, no DB, no network.
- Traps: T1 mostly clean (see dash scan). T3: two hand-typed page lists. No `writesTo`/DB. T6 bare `void main()`.
- Promises: P5 (orb on patient screens, orb reaches a dialler without network). Partly: the check proves presence of an identifier in source, and says nothing about the orb being ON TOP of the payment orb (P5's "on top").

### scripts/verify-sprint53.ts (1982 lines)
- For: sprint 53 gate, corporate (sponsors): the wall between payer and person, activity floors, pot as a payment method, DB constraints on identifiers/pots/enrolments, invoice, crisis not gated on money, therapist money surface rendered.
- Decides / checks (grouped):
  - C230/C264 (l.94-111): `ROLES` has no sponsor/clinic/partner; `lib/auth/guard.ts` never says "sponsor".
  - C259/C244 (l.120-200): information_schema: sponsors has no organization_id; organizations has no %sponsor% column; a HAND-TYPED list of 9 clinical/payment tables carries no uuid/text sponsor column or FK to sponsors. Control: the three frozen split columns exist on session_payments. Tables outside the 9 (e.g. ledger_entries, manual_payments, availability bookings, notifications other than patient_notifications) are not scanned.
  - C231: `patient_notifications` has no sponsor/employer/reason/body/text column.
  - 53.1 roster (l.232-282): reads `lib/data/sponsors.ts` and slices 1400 CHARACTERS after `export async function roster` (an arbitrary window: a leak on character 1401 passes). Forbidden needles list; control asserts `firstName: people.firstName` and `lastVerifiedAt: enrolments.lastVerifiedAt`; orderBy firstName. Only `sponsors.ts` is read; `sponsor-admin.ts`, `sponsor-integrations.ts`, `sponsor-domains.ts`, the `app/(sponsor)` pages are not (one of N).
  - C240: no export named hasBooked/sessionCountFor/attendanceFor/lastSeenAt/sessionsByPerson in sponsors.ts (name list).
  - C228/C229 floors: `date_trunc('week'` present and `'day'` absent in sponsors.ts; `applyActivityFloor` pure function with the planted one-session week suppressed, carried forward (total preserved), ordinary week published, 8 quiet weeks publish one figure. Good both ways.
  - C226: exactly one pot ledger account; FUNDING_SOURCES = card, pot; no corporate session type; no isCorporate-like flag (name list); funding_source NOT NULL default card (DB).
  - C243 payer name (l.512-526): every `components/` and `app/` file except `app/pay/` read via readSource for `payerName|payerEmail`. Good.
  - C244 self-join (l.537-549): uses `source.get(file)`, the RAW `readFileSync` map built at l.79: T1 (comments in). It also looks for the SQL spelling `ledger_entries ... txn_id ... ledger_entries` only in `app/` and `components/`, while queries live in `lib/` and use drizzle's `ledgerEntries`/`txnId`: wrong place and wrong spelling, so it cannot fail on the way the code is written.
  - Constraints by attempted write on a planted sponsor: C248 specimen hint refused / description accepted; C233 pot without terms refused / with terms accepted; C239 overdraft refused (no control that a within-bound negative is allowed here, but l.1597 later does it); C246 via the REAL `hashIdentifier`/`hashIdentifierGlobal` at two sponsors, refused on the global index (good, rewritten after a vacuous version); C249 two primaries refused / second non-primary allowed; removal reason free text refused (no control that a valid reason is accepted).
  - Pot money (l.852-980): real `journal()` legs, `ledgerPotBalance`, `potTotals`, `reconcilePots` both directions, shared txn sums to zero, `weeklySpend` finds spend not deposit. Good.
  - Invoice: `invoiceFor` refuses without legal details, renders with them (settings overridden), refuses another sponsor's txn.
  - 53.19 source regexes on pot.ts (`isNotNull(enrolments.lastVerifiedAt)` etc.), columns hold no plain identifier, global unique partial index read from pg_indexes, attempts <= 5 constraint both ways.
  - 53.5 routing: `routeDecision(SPONSOR_APPLY)` passes, /sponsor, /sponsor/people, /sponsor/pot redirect (three hand-typed paths as the control).
  - C236 default sponsor unlisted and held (DB default).
  - C240 NeverBar in chrome or desk; 53.9 QR generated server-side.
  - C229 floor clamp via `parseGroup` with 1 (discriminating) and 25; 53.11 top-up floor a positive setting, clamps 0 and -50; cycle 6 months; ladder floor < ceiling; welcome credit >= floor.
  - 53.10 crossing CHECK constraint read from pg_constraint; `holdsMoney`/`isCrossBorder` both directions.
  - C243 pot writer `payerName: null` and `fundingSource: "pot"` (syntax).
  - notices.ts has no `.delete(` and has `dismissNotice`.
  - 53.23 / C235 crisis (l.1580-1647): sets the pot balance to 0 and -5000 and compares `lineForNumber()`/`crisisLine()` output. Those are PURE lookups over a compiled table with no database input, so the pot state cannot affect them by construction: the check cannot fail for the reason it names (wrong medium). The real question (does any patient crisis surface read money) is only the source scan of `sos-orb.tsx` at l.1635-1647 (one file of the path; the chrome that places the orb is not scanned for pot reads).
  - 53.24 renders `PaymentHistory` with a named and a nameless row and asserts they differ, the translated label is present, no corporate word; `recentPayments` takes name from `patients` (slice from function to EOF, same shape as sprint 48).
  - 53.12 pot exports: anything named withdraw/cashOut/payout/transfer/refund must credit and never debit; exactly one debiter `payFromPot`. Body match `balanceCents}\s*-` is a syntax of a template SQL expression.
  - 53.2 enrolment strings: English dictionary only (`DICTIONARIES.en`), keys `benefit.*` and `sponsor.codePoster`; the Arabic strings are never swept. Control on a planted sentence.
- Reads: DB (information_schema, pg_constraint, pg_indexes, planted rows), product functions, rendered markup via `_render`, source (mostly readSource; the raw map at l.79 for the self-join scan).
- Traps: T1 at l.540. T2 mostly paired. T3 three sponsor paths, nine tables. T6 bare `void main()`.
- 🔴 Cleanup defect: `restoreInvoice` is initialised `null` at l.53 and only set at l.1023. The `finally` (l.1962-1969) DELETEs the `invoice` row from `platform_settings` whenever `restoreInvoice === null`. Any exception thrown in the try between l.563 and l.1020 (a failed insert, a thrown product function) therefore deletes the operator's real invoicing details on that branch: the exact 76.21 defect the comment says was fixed, surviving on the failure path. (A `required()` miss calls `process.exit` and skips the finally, so only throws trigger it.)
- Stale: l.1623 detail string says "null for the Egyptian one" while the null reader has been a UK number since C350 (l.1570-1581).
- Promises: E1, E2 (the wall): partly. Column-level wall on 9 tables and the roster window in one file; the sponsor portal pages and other sponsor data files are not read. C2 not touched. P5: the crisis check is vacuous as noted.

