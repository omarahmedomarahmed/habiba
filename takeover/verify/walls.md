# WALLS: who can see what

Verifier for the WALLS domain, 2026-09-22. Scope: the sponsor (company) portal and anything
linking a sponsor to a session; the clinic portal (names, counts, schedule, exports); the
partner API and EHR scopes; the staff console's reads and mail; a revoked or never granted
clinician reading history; the patient extract. Every entry below was opened in the code by
this verifier unless it says CONFIRMED by the MAP. Read only, nothing executed against a
database.

## Sponsor (company) wall

### WALL-1 · The company overview shows a live spend total and a live session count beside the floored balance
- Verdict: CONFIRMED (MAP Confirmed 5; carried in, and the extra half below read here)
- Sources: code-03 Broken (E1 published balance defeated), code-08 Broken 3, MAP Confirmed 5
- Promise: E1
- Who is hurt and how: an employee at a small company. Their employer opens `/sponsor` on Monday and Tuesday, sees "sessions in total" go from 11 to 12 and "spent" rise by one session's share, and knows somebody went that day. With a roster of five names and a known absence, that is a person.
- Evidence: `app/(sponsor)/sponsor/page.tsx:62-67` fetches `potTotals`, rendered raw at `:196-205`; `lib/billing/pot.ts:997-1016` is a live `SUM` and `COUNT(*)` of pot legs with no floor. Additional half verified here: `applyActivityFloor` (`lib/data/sponsors.ts:181-217`) hides the most recent sub-floor weeks as nulls whose spend is carried forward, so live total spend minus the sum of the visible weeks recovers exactly the hidden tail, the subtraction its own comment at `:203-211` says the design prevents. `usedPercent` (`page.tsx:104-105`) mixes the published balance with live spend, so the bar is also arithmetically wrong between publications. Patch looked for: `potBalance` (`sponsors.ts:241-326`) floors only the balance; nothing floors `potTotals`.
- Severity: S1
- Fix sketch: render totals from the same publication as the balance (store `published_spent_cents` beside `published_sessions` in `potBalance`, or drop both cards). Prove with a unit check: one extra pot leg must not change anything the page renders until `activityFloor` more exist.
- Decision it came from: 53.25 asked for the totals; C377 fixed the balance and left the two cards beside it.

### WALL-2 · The roster's "last checked" date is each person's own join or verification date
- Verdict: CONFIRMED
- Sources: code-02 Suspect 5, code-11 Suspect (roster `lastChecked` plus delivery log)
- Promise: E1 ("never when"), and PLAN §3e / C227 ("never when they joined")
- Who is hurt and how: an employee who enrols. The company's people page prints the day they joined (or the day they answered the work email code), per person, so the employer can see who signed up the week after a restructure or a bereavement, without even having to visit twice.
- Evidence: `lib/data/enrolment.ts:435` sets `lastVerifiedAt = now` at enrolment for an `id_number` gate; `lib/data/enrolment-verify.ts:200` sets it to now when a person answers their own email code; `:308` (`unpause`) sets it to now for one person. `pauseUnverified` (`:234-293`) only pauses and rolls the sponsor's window; it never writes a common date onto anyone. Rendered per person at `app/(sponsor)/sponsor/people/page.tsx:58-60`. The comments at `lib/data/sponsors.ts:47-50`, `people/page.tsx:50-57` and `enrolment-verify.ts:215-226` all claim C256 made this a shared sponsor date; the code does not.
- Severity: S1
- Fix sketch: render the sponsor's `verify_cycle_started_at` (one date for the whole organisation) or nothing, never the per row column. Check: two enrolments on different days must render the same date.
- Decision it came from: C256 (per sponsor cycle) was implemented as a pause schedule only; the display was never moved to the sponsor's date. Note for the founder: a live named roster itself reveals a join date to anyone who looks daily; §3e's "never when they joined" cannot hold fully while the roster is live.

### WALL-3 · The joining code page shows a live, unfloored count of attempts on the code
- Verdict: PARTLY
- Sources: code-08 Suspect 3
- Promise: E1
- Who is hurt and how: an employee trying to enrol. Refreshing the code page shows the counter tick, so the employer learns that somebody tried to join in the last few minutes. It does not say who, and a successful join already shows up as a new name on the roster (WALL-2).
- Evidence: `app/(sponsor)/sponsor/code/page.tsx:52` renders `attemptsOnCode`; `lib/data/sponsors.ts:356-366` reads the raw rate limit counter, incremented on every attempt against a live code, successful or not (`lib/data/enrolment.ts:314-318`). No floor. The part that does NOT hold: it is a count of enrolment attempts, never usage, and it names nobody.
- Severity: S3
- Fix sketch: show the spike only as a banded state ("normal" or "unusual, over N this week"), not a number that moves per attempt.
- Decision it came from: 53.19 ("a spike as a number, never names").

### WALL-4 · Sponsor HR connection delivery log dates an individual's enrolment
- Verdict: WRONG (as to today's code); latent in the schema
- Sources: code-03 Suspect (`deliveriesFor`), code-08 Suspect 4, code-11 Suspect (integrations log)
- Promise: E1
- Who is hurt and how: nobody today. The log the readers worried about is always empty.
- Evidence: `deliveriesFor` (`lib/data/sponsor-integrations.ts:267-293`) lists deliveries for webhooks with `sponsor_id` set and `partner_id` null. The only writer of `partner_webhooks` is `registerWebhook` (`lib/partner/webhooks.ts:56-88`), which always sets `partnerId`, and the only writer of deliveries is `queueWebhook` (`:101-124`), which fans out by `partnerId` only. No code creates a sponsor owned webhook. Employment verification (`lib/partner/employment.ts:87-213`) is an inbound call the company's own HR server makes, answering one identifier the person typed minutes ago with a boolean; the company learns an enrolment time only from its own server, which C265 accepts by design.
- Severity: S4
- Fix sketch: none needed now. If sponsor webhooks are ever built, restrict their events by a CHECK (no `session.*`, `note.*`).
- Decision it came from: 0098 added `partner_webhooks.sponsor_id`; sprint 66 never wired a sponsor registration.

### WALL-5 · A sponsor owned webhook could receive `session.completed` and `note.approved`
- Verdict: HANDLED (by absence of any writer; no DB rule)
- Sources: code-01 Suspect (0098 sponsor webhooks), code-01 Suspect (0075 sponsor scoped key and partner subjects)
- Promise: E1, E2
- Who is hurt and how: nobody today. No path creates a sponsor webhook and no fan-out addresses one.
- Evidence: as WALL-4: `lib/partner/webhooks.ts:56-88` (always a partner), `:101-124` (filters `partnerWebhooks.partnerId`). `queueWebhook` callers: `app/(patient)/patient/consent/actions.ts:167`, `notifyGrantRevoked` and `notifyRecordClaimed` (`webhooks.ts:152-226`), all keyed on a partner. A sponsor scoped key (`partner_api_keys.sponsor_id`) authorises only `employment:verify` (`lib/partner/employment.ts:101-110`).
- Severity: S4
- Fix sketch: a CHECK on `partner_webhooks` that a row with `sponsor_id` has an events array disjoint from clinical events, so the wall is in the schema rather than in the absence of a form.
- Decision it came from: 0098, sprint 66.

### WALL-6 · Every partner admin sees the names of all our active sponsor companies
- Verdict: CONFIRMED
- Sources: code-08 Broken 9
- Promise: none directly (E1's spirit; PLAN C319, C349 treat "which companies buy therapy for staff" as the company's own fact to publish or not)
- Who is hurt and how: every company paying for staff therapy. A third party developer who signs up as a partner and becomes its admin reads the full list of our paying companies, including ones that chose to stay unlisted.
- Evidence: `app/(partner)/partner/page.tsx:41` calls `sponsorChoices()` for any partner admin; `lib/data/partner-admin.ts:258-264` returns every `state = 'active'` sponsor by name, with no `listed` filter. The dropdown it fed is gone: `lib/partner/keys.ts:94-106` says `employment:verify` is no longer a partner scope, and code-11 Broken confirms the form has no sponsor picker.
- Severity: S2
- Fix sketch: delete the `sponsorChoices()` call and the `sponsors` prop. Check: the partner page's server props contain no sponsor name.
- Decision it came from: sprint 66 moved `employment:verify` to the sponsor portal and left the partner page's read behind.

### WALL-7 · Staff console lists each company's covered sessions with date and clinician, and attributes by any enrolment ever held
- Verdict: CONFIRMED
- Sources: code-06 Suspect 6, code-09 Suspect 3; task scope ("staff seeing sponsor session dates")
- Promise: E1 (its proof names `/admin/sponsors/<id>`); PLAN C244 ("no screen joins a sponsor to a session, booking, date or patient name", for our own admins)
- Who is hurt and how: an employee on a company pot. Any back office account, not only a founder, opening a company's page reads one row per sponsored session with its date and the clinician's name. With the clinician's caseload elsewhere in the console, that is one step from a name. Separately, somebody who changed employer is listed under both companies, so the reconciliation a founder relies on is wrong.
- Evidence: `app/(admin)/admin/sponsors/[id]/page.tsx:43` is `requireStaff()` (any back office role), `:94` loads `potTrace`, `:238-242` renders `row.at` date and `row.therapistName` per session. `lib/console/pot-trace.ts:96` joins `enrolments` on `personId` only, with no pot, period or `removed_at` condition, so a person enrolled at two sponsors, or removed and re-enrolled at one, yields a row per enrolment (duplicates and misattribution); `potSpendAgrees` then compares an inflated sum to the ledger. The patient is a reference, not a name (`:131`), so E1's literal proof ("without a single patient name") holds; C244's date and clinician part does not. No audit row is written on this page.
- Severity: S2
- Fix sketch: tie the row to the pot by the ledger `txn_id` shared with the pot leg (the true link), drop the per row date to a week or drop the clinician, and restrict the page to super_admin with an audit. Check: a person enrolled at two sponsors appears under exactly the one whose pot paid.
- Decision it came from: 76.29 (pot trace), which the file's own header argues makes the clinician safe because "we pay them".

### WALL-8 · The business board's server actions are reachable by a manager; the per company session count counts the wrong sessions
- Verdict: PARTLY
- Sources: code-09 Suspect 9, code-06 Suspect 6
- Promise: A5 (role is a list), E1
- Who is hurt and how: our own staff model. A manager is refused `/admin/tv` (the elevation check needs super_admin) but can call the nine refresh actions directly and get the whole board: company names with a count of sessions this month, clinician names and emails. Nothing clinical. The count itself is every session any actively enrolled person had, pot funded or not, and a person enrolled at two companies is counted under both.
- Evidence: `app/(admin)/admin/tv/board-actions.ts:40-88` guard `requireManager()` only; the page (`app/(admin)/admin/tv/page.tsx:33-37`) additionally requires `elevated()`, which calls `requireRole("super_admin")` (`lib/console/gate.ts:149-150`). `companiesBoard` (`lib/console/board.ts:149-158`) counts `sessions` joined to `enrolments` by `personId` with only `state = 'active'`. The part that is fine: the board content is aggregate and non clinical, and the actions are only callable by somebody who already holds a manager cookie.
- Severity: S3
- Fix sketch: `requireRole("super_admin")` on the board actions to match the page; count from `session_payments.funding_source = 'pot'` via the ledger txn.
- Decision it came from: 76.1 ("the same guard as the page", written when the page was `requireManager`).

## Staff console reads and mail

### WALL-9 · Total View reads notes, transcripts, risk flags and copilot conversations without writing an audit row
- Verdict: CONFIRMED
- Sources: code-06 Broken 3, code-09 Broken 5
- Promise: A5 ("every read is written down"); `/security` card "Every read is written down" (`lib/content/defaults.ts:1232`); `dfl.consentWhy3` tells the patient "Every read is written into an audit log you can ask for" (`lib/i18n/messages.ts:3333`)
- Who is hurt and how: every patient. A founder can open any session's note, transcript and risk flags, and any person's copilot conversation, and the patient's access log will never show it. The only record is that the console was unlocked.
- Evidence: `app/(admin)/admin/tv/page.tsx:41-65` calls `sessionDetail`, `conversationFor`, `sessionsFor`, `peopleByEmail`, `liveSessions`; none writes `audit()`; `lib/console/reads.ts` has no `audit` import (only the `auditLog` table for reading). Patch looked for: no audit in `app/(admin)/layout.tsx`, `middleware.ts` or the page; `lib/console/gate.ts:78,110,127` audits key set, refusal and unlock only. Compare `app/(admin)/admin/radar/investigate/[id]/page.tsx:43` and `app/(admin)/admin/therapists/[id]/page.tsx:40-55`, which audit before reading (see WALL-31).
- Severity: S1
- Fix sketch: `auditPhi` with the session id before `sessionDetail`, and with the person key before `conversationFor`/`sessionsFor`, in the page. Check: open one session in Total View and find one `console.read` row naming it.
- Decision it came from: 76.x Total View; the two key gate was treated as the audit.

### WALL-10 · "Send one person their own record" blind copies the founder with the live link, and tells the patient nobody read it
- Verdict: CONFIRMED
- Sources: code-02 Broken 9, code-05 Broken 13, code-09 Broken 4
- Promise: A5; P4 (the patient decides who reads the history)
- Who is hurt and how: a patient who asks for their record through support. The founder who presses the button receives the same working link to every session, note and transcript (all clinicians' charts, see WALL-12), while the patient's email says "nobody at 24Therapy read it in order to send it to you" and the clinician is told "Nobody here read it". Opening the link is recorded only as an open count, indistinguishable from the patient's own open.
- Evidence: `app/(admin)/admin/tv/actions.ts:48-55` passes `copyTo: actor.email`; `lib/mail.ts:440-471` sends it as `bcc` of the identical message; wording at `lib/mail.ts:457-458`; clinician notice `lib/data/export.ts:203`. `openExport` (`lib/data/export.ts:273-298`) increments `open_count` and writes no audit. The send itself is audited (`tv/actions.ts:58-65`). Contrast `app/(admin)/admin/actions.ts:575-613` (`emailPatientRecordToPatient`), the other admin path, which sends no copy.
- Severity: S1
- Fix sketch: drop `copyTo` (send the operator a separate confirmation with no link), and audit each `openExport` with a flag for whether the opener was signed in as staff. Check: the outgoing message for this action has no bcc.
- Decision it came from: Total View's "the requesting administrator receives a copy" (docblock at `tv/actions.ts:30-35`).

### WALL-11 · A clinician's full session history, with every patient's name, email and session times, can be mailed to any address
- Verdict: PARTLY
- Sources: code-02 Suspect 7
- Promise: A5; P4
- Who is hurt and how: every patient of the clinician concerned. After unlocking the console, a founder can send a CSV of every session (patient name, patient email, start and end times, consent, note status) to any typed address. Transcripts and note text are excluded. The clinician is told; the patients are not.
- Evidence: `app/(admin)/admin/tv/actions.ts:77-138`: `requireElevated()`, a reason of 20 or more characters, audit at `:111-118`, clinician notice at `:128-135`. `lib/console/history.ts:48-120` selects `patients.firstName/lastName/email`, `guestName/guestEmail` and the session times; no note content, no transcript; formula injection is neutralised (`csvCell`). Held: gated behind super_admin plus two keys, audited, no clinical text. Not held: one person, any destination, no second approver, no notice to the patients whose names travel.
- Severity: S2
- Fix sketch: require a second founder's approval for an external address, and write a patient access log entry per person included. Founder decision rather than a code defect.
- Decision it came from: Total View, "formal request" tool.

### WALL-12 · An export minted against one clinician's chart carries every clinician's notes and transcripts for that person, to the address on that one chart
- Verdict: CONFIRMED
- Sources: code-02 Suspect 8
- Promise: P4 (the patient decides who reads the history)
- Who is hurt and how: a patient seen by two practices. If practice A's chart has a mistyped (or deliberately changed) email, the support "send the record" button sends practice B's notes and full transcripts to that address. Clinician A can edit the email on their own chart.
- Evidence: `lib/data/export.ts:147` delivers to `patients.email` of the one chart; `:338-350` then builds the extract from every `patients` row sharing the `personId`. Clinicians set that email through `updatePatient` (`lib/data/patients.ts:256`). Callers are super_admin only (`app/(admin)/admin/actions.ts:579`, `app/(admin)/admin/tv/actions.ts:40`). No check that the address is a proven handle of the person (`people`/`patient_accounts`).
- Severity: S1
- Fix sketch: deliver a person level export only to a proven handle of the person (the claimed account's email), and fall back to the one chart's rows when the person is unclaimed. Check: an export for a person with an unclaimed second chart contains only the first chart's sessions, or goes to the account email.
- Decision it came from: 26.9 ("every session, not one clinic's sessions").

### WALL-13 · The patient's own record extract shows unsigned machine risk levels, and the JSON carries the instruction meant for the clinician
- Verdict: CONFIRMED
- Sources: code-02 Broken 8
- Promise: P3 (nothing machine written reaches you unsigned)
- Who is hurt and how: a patient reading their own record. Beside a session they read "risk noted: high", computed by keyword or model detection and never signed by anyone; the downloadable JSON also has `riskAction`, the text we show a clinician about what to do. A session with two risk rows appears twice.
- Evidence: `lib/data/export.ts:380-381,385` select `riskAssessments.level` and `recommendedAction` through a left join (one row per assessment); `:574-575` put them on every session; HTML `:678-680` prints the level; `app/records/[token]/data.json/route.ts:31` serialises the whole record. Risk rows are machine written (`lib/crisis/alerts.ts:383-396`). The same file already refuses unsigned note text (`:540-553`), so the rule is known and this field was missed.
- Severity: S2
- Fix sketch: drop `riskLevel` and `riskAction` from the extract (or include only a level a clinician confirmed), and aggregate risk per session so the join cannot duplicate. Check: the extract for a session with two risk rows lists it once and contains no `risk`.
- Decision it came from: sprint 26 extract; the note was gated in 47.x, the risk columns were not.

## Clinic wall

### WALL-14 · C2 as written ("no patient name on any screen") contradicts the product's own rulings: the clinic schedule and its export show patient names
- Verdict: CONFIRMED (the promise is false against the code; the code is deliberate)
- Sources: code-08 Broken 4, code-11 Broken (C2 contradiction), code-15 Broken 12, code-13 Suspect (verify-principals clinic-export), code-08 Suspect 5 (filing log as caseload proxy), MAP Contradiction 1 and Suspect 11, DOCS digest 14
- Promise: C2 (and C5's "each clinician's patients are not" visible)
- Who is hurt and how: nobody is misled on the product's own screens, because the patient is told; the founder is misled by the promise list. A practice manager or receptionist opens `/clinic` and reads each patient's first name and last initial, the clinician and the hour (cancelled ones marked), and can download 180 days of the same. Counting rows per clinician in that file gives a caseload, so "no caseload count" holds only in the sense that nobody printed the sum.
- Evidence: `lib/data/clinic.ts:279-294` (`shortenForClinic`, first name plus last initial, also for typed guest names), `:372-389` returns `patientName`, audited per read as `phi_access` at `:353-370`; rendered `app/(clinic)/clinic/page.tsx:201-210`; exported `app/(clinic)/clinic/export/route.ts` (90 days back, 90 forward) through `lib/data/clinic-export.ts` from the same query. Disclosed: `clinic.scheduleBody` "a name and a time, because you pay for the hour" (`lib/i18n/messages.ts:1739`), `clinic.join.sees.names` (`:2105`) on the clinician's join form, and to the patient on `/patient/record` (`clinicVisibilityFor`). Gates require it: `scripts/verify-sprint54.ts` and `verify-sprint63.ts` assert the shortened names. The filing log on `/clinic/records` also lists each signed note's clinician and time, up to 100 (`app/(clinic)/clinic/records/page.tsx:48-56`), a second caseload proxy. What does hold: no count per clinician is rendered (`components/clinic/people-list.tsx:33`), no clinical field reaches any clinic screen, and `/clinic/earnings` shows money per clinician with no patient (C5's first half kept).
- Severity: S2 (a promise that would fail the walk as written; not a leak against the product's own disclosure)
- Fix sketch: none in code until the founder decides. Note that the public `/` card only says "no caseload count on any of them" about the seat rows (`lib/content/defaults.ts:367`), which is true; it is the value statement's "Proved when" sentence that adds "or a patient name", stricter than both the page and PLAN (C260 then C327).
- Decision it came from: C260 and 54.9 (names), narrowed by C327 and 63.x to first name plus last initial, disclosed and audited.
- **What the founder must decide:** either (a) keep names: rewrite C2 to "The practice sees who is booked and when, as a first name and initial, and nothing clinical; the patient is told", and C5 to match; or (b) keep the promise: remove `patientName` from `clinicSchedule` and the export (show clinician and hour only), which also removes the one thing a receptionist uses the rota for. Either way the walk's `continuity` position cannot pass C2 as written today.

### WALL-15 · Clinic CSV export does not neutralise formulas, and the name column carries text any link holder typed
- Verdict: CONFIRMED
- Sources: code-02 Broken 10
- Promise: C2 (adjacent), none directly
- Who is hurt and how: the practice manager. Anybody holding a join link can type a guest name beginning with `=`; it lands in the schedule export and runs as a formula when the manager opens the file in a spreadsheet.
- Evidence: `lib/data/clinic-export.ts:34-37` `cell()` quotes commas and quotes only; guest names come from `sessions.guest_name` through `shortenForClinic(...splitGuestName(...))` (`lib/data/clinic.ts:386-388`); the first word survives shortening intact. The console's own CSV writer already does this correctly (`lib/console/history.ts`, `csvCell` with a leading apostrophe).
- Severity: S3
- Fix sketch: reuse the console's `csvCell` rule (prefix `'` to a cell starting `=`, `+`, `-`, `@`, tab or CR). Check with a unit test on `cell("=1+1")`.
- Decision it came from: 63.17 export.

### WALL-16 · A hospital's error text shown verbatim in the clinic portal could quote a patient
- Verdict: HANDLED
- Sources: code-11 Suspect (records-panel renders FHIR error), code-08 Suspect 5 (lastError raw)
- Promise: C2
- Who is hurt and how: nobody. The stored error is always our own sentence.
- Evidence: every error `lib/ehr/fhir.ts` returns is a fixed sentence with at most the HTTP status (`:50, :72, :78, :105, :111, :202, :219, :227`); the response body is never copied. `lib/ehr/file-note.ts:216-230` stores that sentence and parses only the status out of it, with the comment that a 403 body "can contain that patient's details". Connection errors go through `recordConnectionResult` (`lib/data/ehr.ts:382-392`) from the same file.
- Severity: S4
- Fix sketch: none.
- Decision it came from: 67.4 to 67.6.

### WALL-17 · A guest's bank transfer for a session appears in the payment bar of every clinician in that practice
- Verdict: CONFIRMED
- Sources: code-04 Broken 9
- Promise: none directly (between clinicians); T3 and A3 adjacent
- Who is hurt and how: clinicians in a multi clinician practice. When a guest patient of Dr A opens the pay sheet, Dr B's app shows "Session with Dr A, 1,140 EGP" in their own bar, which tells B when A has a paying patient and can hide B's own open bill. No patient name is shown.
- Evidence: guest payments carry the practice's `organization_id` (`lib/billing/manual.ts:110-117`, callers `app/pay/[token]/page.tsx:165`, `actions.ts:247,347`); `app/(app)/layout.tsx:73-77` asks `pendingPaymentFor({kind: "organization"})`, which matches `organization_id` alone and takes the newest row of any payer kind (`lib/billing/pending.ts:98-141`); `describe` names the treating clinician (`:196-209`).
- Severity: S3
- Fix sketch: add `eq(manualPayments.payerKind, "organization")` to the organisation branch. Check: a session payer row never reaches a clinician's layout.
- Decision it came from: 76.13 widened the bar's states; the payer filter was never there.

## Partner API and EHR scopes

### WALL-18 · A partner key can fetch approved notes after the patient cut the link, and notes by clinicians who have nothing to do with that partner
- Verdict: CONFIRMED
- Sources: code-05 Broken 3
- Promise: P4, T5; PLAN C277 (the patient can claim and leave), C389 (partner links revocable)
- Who is hurt and how: a patient who was once linked to a partner platform. After they revoke the link, the partner can still pull the full signed note (SOAP, impressions, summary) for any session of theirs whose id it holds, including sessions with a clinician at another practice who never dealt with that partner.
- Evidence: `lib/partner/api.ts:348-393` joins `partner_subjects` on `person_id` and filters only `partnerSubjects.partnerId = key.partnerId`: no `isNull(partnerSubjects.revokedAt)` (the same file has it at `:453`), no condition that the session's organisation is on this partner's account (`organizations.partner_id` with `billing_mode = 'partner_billed'`, which `launchClinician` and `notifyGrantRevoked` both use), and no history grant check (which `whoMayRead` has at `:139`). Route: `app/api/partner/v1/notes/[sessionId]/route.ts`, scope `note:deliver`. The limit on exploitation: the caller needs the session's uuid, which a partner learns for its own sessions and not, by any route found, for others. The delivery is audited (`:404-411`).
- Severity: S1
- Fix sketch: add `isNull(partnerSubjects.revokedAt)` and join `sessions.organization_id` to an organisation with `partner_id = key.partnerId` and `billing_mode = 'partner_billed'`. Check: a revoked subject gets 404; a session of a non partner clinician for a linked person gets 404.
- Decision it came from: 55.8; the "other therapist" fix applied to `whoMayRead` and `writeBackSession` missed this function.

### WALL-19 · A partner launch link is a bearer token handed to the partner's server, which becomes a full one hour clinician session
- Verdict: PARTLY
- Sources: code-05 Suspect 1, code-07 Looks handled 1
- Promise: P4, T5 (only a clinician the patient chose reads the history)
- Who is hurt and how: the patients of a clinician whose practice is billed through a partner. Whoever holds the launch URL for two minutes (the partner's server, or a log or proxy on the way) can open it themselves and browse that clinician's whole caseload, notes, transcripts and any history granted to that clinician, for an hour, without the clinician present.
- Evidence: `lib/partner/launch.ts:94-162` mints, `:173-266` redeems with nothing but the token, sets an ordinary clinician cookie (`:243-252`) for `LAUNCH_MS` one hour (`:85`); the target allow list (`:280-283`) is only the landing page, the cookie reaches every clinician route. Handled part (code-07's point, confirmed): the clinician must be on this partner's account, `organizations.partner_id = key.partnerId` and `billing_mode = 'partner_billed'`, checked at mint (`:125-135`) and again at redemption (`:208-221`), and every launch is audited with the key (`:254-261`).
- Severity: S2
- Fix sketch: bind redemption to the clinician (require an existing clinician session or a one time code sent to the clinician), or give launched sessions a narrower capability than a full login. Founder decision: whether a partner billed practice has accepted that its platform can act as its clinicians.
- Decision it came from: 42.7 (launch), and the partner plan's own "launch" design.

### WALL-20 · The partner copilot answers about any subject for any opted in clinician ref, and keeps reading after consent is withdrawn
- Verdict: PARTLY
- Sources: code-07 Suspect 7, code-05 Suspect 12
- Promise: T5
- Who is hurt and how: patients of a partner platform. Within that partner's own tenant, any clinician reference the partner's server turned on can ask about any subject reference; our side checks no relationship between them.
- Evidence: `app/api/partner/v1/copilot/route.ts` checks the key scope, `clinicianEnabled` (which the same partner key can switch on through `PUT`) and usage, then `askPartnerCopilot`; `sessionMaterial` (`lib/partner/copilot.ts:150-178`) reads only `partner_sessions` of this `partnerId`. Handled part: nothing outside the partner's own material is reachable (code-15 Looks handled 2 agrees; it reads none of our records). Not handled: no clinician to subject check, and no read of the consent log, so a patient who withdrew consent on the partner side still has their ended sessions' notes and transcripts put into a model on request.
- Severity: S3
- Fix sketch: filter `sessionMaterial` by the latest consent state for the subject; require the clinician ref to appear on at least one of the subject's `partner_sessions`.
- Decision it came from: sprint 68 partner platform.

### WALL-21 · The EHR scope guard admits reads of the whole chart and SMART v2 writes
- Verdict: CONFIRMED (proved by execution)
- Sources: code-05 Broken 10
- Promise: none (unclaimed EHR integration; the guard's own refusal sentence promises "reading records we have no business holding" is refused)
- Who is hurt and how: a hospital's patients. If a hospital's server grants more than we asked, we keep a token that can read conditions, medications, allergies and observations, or create conditions, while the code says we would refuse it.
- Evidence: `lib/ehr/vendors.ts:106-117`. A verbatim copy of `scopesAreMinimal` run under `node --import tsx` returned true (accepted) for `patient/Condition.read`, `patient/MedicationRequest.read`, `patient/Observation.read`, `system/Patient.read`, `patient/Condition.c`, `patient/Condition.cruds` and `patient/Condition.rs`; false only for `.cud`, `.u`, `.write`. The write regex `\.(write|c?ud?|\*)$` needs a `u` or `d` at the end, and nothing refuses `system/`. `lib/ehr/smart.ts:246` also skips the guard entirely when the token response has no `scope` string.
- Severity: S2
- Fix sketch: an allow list, not a deny list: every granted scope must be one of `REQUESTED_SCOPES` (`vendors.ts:81-88`) or a known narrower form; treat an empty grant as refused. Check with the same probe list.
- Decision it came from: 43.x EHR sprint.

### WALL-22 · The Teams scope can read a user's meetings, passing a word based guard
- Verdict: WRONG (as a leak)
- Sources: code-05 Suspect 15
- Promise: none
- Who is hurt and how: nobody identified. `OnlineMeetings.ReadWrite` is the narrowest Microsoft Graph delegated scope that can create an online meeting; reading a meeting through it needs that meeting's id, and transcripts and recordings need separate scopes we do not request. The reader is right that `scopesAreMeetingOnly` only tests words (`lib/meetings/providers.ts:83-87`), which is a weak guard, but the scope requested today is the minimum available.
- Evidence: `lib/meetings/providers.ts:63-66`, `:83`.
- Severity: S4
- Fix sketch: pin each provider's scopes to an exact allow list instead of a word regex.
- Decision it came from: sprint 41 meetings.

### WALL-23 · Developers are told a partner read "appears in the patient's own access log, naming your platform"; no such log exists and no audit row names a partner
- Verdict: CONFIRMED
- Sources: code-06 Suspect 9
- Promise: A5 (every read is written down); `devs.promise4Body`
- Who is hurt and how: a patient asking who read their record, and a partner relying on our copy. Partner note deliveries are audited with the key id in free text only; nothing fills `audit_log.partner_id`, and no patient screen shows an access log at all.
- Evidence: `lib/i18n/messages.ts` `devs.promise4Body`; `lib/audit.ts:72-112` has slots for user, sponsor user and clinic manager, none for a partner; `drizzle/0075_partner_plane.sql:382` added `audit_log.partner_id`, which no code writes (grep). `lib/partner/api.ts:404-411` audits `partner.note_delivered` with `actor: null` and no `patientId`. No reader of `audit_log` under `app/(patient)` or `components/patient`.
- Severity: S3
- Fix sketch: add `partnerId` and `patientId` to partner audits; either build the patient's access log or change the developer copy to "recorded in our audit log".
- Decision it came from: 42.7 and the `/developers` page copy.

## Clinicians: revoked, never granted, and other patients

### WALL-24 · A revoked clinician, or one who was never granted, still reads the person's cross practice profile, timeline, diagnoses, homework and the latest summary another clinician wrote
- Verdict: CONFIRMED
- Sources: code-03 Broken (revocation does not reach the standing profile), code-07 Broken 7; task scope (P4, T5)
- Promise: P4 ("the patient decides who may read the history"), T5 ("a revoked grant stops it on the next question")
- Who is hurt and how: a patient who moved from Dr A to Dr B and said no to Dr A, or never said yes. Dr A opens the patient's documents tab and reads a machine written profile built from Dr B's sessions, notes and transcripts, the observation timeline, every diagnosis (with titles of documents A can no longer open), all homework with the patient's own comments, and on any session page the newest summary Dr B signed. The patient's "take it back" switch changes none of this.
- Evidence: `app/(app)/patients/[id]/documents/page.tsx:72-100`: `accessFor` is computed, then only journals (`:86-87`) and files (`:139+`) are gated on `capabilities.patientFiles`; `profileFor`, `timelineFor`, `listDiagnoses`, `listHomework`, `homeworkTrend` run on `personId` with no capability check. The profile is built from every chart of the person (`lib/ai/profile.ts:105+`, `gather`, reads `patients WHERE person_id` then all their sessions, notes and transcript segments). `capabilitiesFor` says `liveProfile: false` for `revoked` and for both unclaimed states (`lib/access/state.ts:157-195`), and a claimed person with no live grant IS `revoked` (`accessStateFor`, `:87-97`), so a never granted clinician is in the same hole. Session page: `app/(app)/sessions/[id]/page.tsx:60-63` calls `latestSummary(personId)` with no grant check; `lib/data/summaries.ts:211` documents it as "What a clinician holding a grant may read". Patch looked for: the copilot honours the flag (WALL-25), this page does not. The avatar route (`app/api/patient/avatar/[personId]/route.ts:95-117`) also ignores revocation, a lesser point (a face, not a record).
- Severity: S1
- Fix sketch: gate profile, timeline, diagnoses list, homework and `latestSummary` on `access.capabilities.liveProfile` (homework on the clinician's own `patient_id` only). Check: the `continuity` walk, Dr Kareem after Tarek revokes, sees none of the other practice's material on either page.
- Decision it came from: 9.1 to 9.5 (person level profile) predates 7.7's capability table being applied per surface; only the copilot adopted it.

### WALL-25 · The copilot fails open when `capabilities` is absent, and a revoked clinician keeps `copilot: true`
- Verdict: HANDLED
- Sources: code-05 Suspect 10, code-06 Suspect 2, code-10 Suspect 15, code-12 Suspect 5, code-14 Suspect 1, code-16 Suspect 9, code-02 Looks handled 3
- Promise: T5
- Who is hurt and how: nobody through the product. The only product caller recomputes access on every question and passes it down; a revoked clinician's copilot reads only their own sessions.
- Evidence: the one product caller `app/(app)/copilot/actions.ts:55-61` runs `accessFor` per question before the quota and passes `capabilities: access.capabilities` at `:141`. In `lib/ai/case-copilot.ts`, `profileFor` (`:450-455`), `documentsFor` and `journalsFor` return nothing when the flag is false; session material is `sessions.patientId = patientId`, this clinician's own chart (`:260-275`). The in room suggestion path reads only the live session and is owner checked (`app/api/sessions/[id]/transcribe/route.ts:101-117`, code-05 Looks handled 1). Residual: absent capabilities still means "no restriction", and `scripts/copilot-exam.ts:490-509` relies on that; a future caller could repeat it.
- Severity: S4
- Fix sketch: make `capabilities` required in the type so omission does not compile.
- Decision it came from: 7.7, 11R.24.

### WALL-26 · A granted history survives the clinician losing their verification
- Verdict: PARTLY
- Sources: code-01 Suspect (0060 checked at write only), code-03 Suspect (no approval withdrawal path)
- Promise: P4, T5
- Who is hurt and how: a patient whose clinician is later rejected or struck off. The grant row stays `granted`. The clinician is kept out of the patient pages by the layout, but server actions that only call `requireUser` (the copilot) still answer if called directly.
- Evidence: trigger `drizzle/0060_portability.sql:23-38` fires only on grant INSERT or UPDATE; `accessFor` (`lib/data/grants.ts:107+`) and `isLiveGrant` (`lib/access/state.ts:64-68`) never read verification. A route to un-approve exists: `verifyUser(id, "rejected")` from the admin therapist panel (code-09 Broken 7). Handled part: `app/(app)/layout.tsx:108-119` redirects anybody not cleared to `/onboarding`. Not handled: `app/(app)/copilot/actions.ts:33` uses `requireUser`, not `requireVerified`.
- Severity: S2
- Fix sketch: add the clinician's verified flag to `accessFor` (one join, `verifiedFlag()`), so every surface that reads the grant stops at once.
- Decision it came from: 27.1 / C106 (write time check).

### WALL-27 · "Before this session" risk history shows the clinician's last five alerts with ANY patient as this patient's history
- Verdict: CONFIRMED
- Sources: code-03 Broken (`priorRiskFor`)
- Promise: none directly (safety; a cross patient disclosure within one caseload)
- Who is hurt and how: a patient in crisis. The clinician judging today's alert is shown "has this happened before" rows that belong to other patients (with their indicator phrases), or a clean history for a patient who has one.
- Evidence: `lib/data/session-risk.ts:245-270` filters `riskAssessments.therapistId = therapistId` only, then drops the current session; no patient or person condition. Rendered under "Before this session" by `components/clinical/risk-assessment.tsx:156-173` via `app/(app)/sessions/[id]/page.tsx:96`.
- Severity: S1
- Fix sketch: filter by the session's `patient_id` (or the person's charts the clinician holds). Check: a clinician with two patients sees only the right one's prior alerts.
- Decision it came from: sprint 34 follow up ("prior risk history at display time").

### WALL-28 · A staff (back office) cookie passes `requireUser`, so clinician pages could render for staff
- Verdict: HANDLED
- Sources: code-06 Suspect 10, code-06 Looks handled 1
- Promise: A5
- Who is hurt and how: nobody. A staff account is sent to onboarding by the layout, and every patient query is scoped to the actor's own caseload, which for a staff account is empty.
- Evidence: `app/(app)/layout.tsx:108-119` (not cleared, redirected); `lib/data/patients.ts:23-33` `scope()` adds `therapist_id = actor.userId` for every role but super_admin, and even super_admin is limited to its own organisation. Staff door refusals: `lib/auth/actions.ts:252-262`.
- Severity: S4
- Fix sketch: none for privacy. The A5 half (staff bounced to "Verify your practice") belongs to the ROLES domain (code-09 Broken 1).
- Decision it came from: 20.9.

## More console and staff reads

### WALL-29 · Operator board shows live sessions with the patient's typed name and no audit
- Verdict: WRONG (dead code)
- Sources: code-03 Suspect (`lib/data/timeline.ts:60-126`)
- Promise: A5
- Who is hurt and how: nobody. No page imports `lib/data/timeline.ts`; the live board in use is Total View (WALL-9), which has the same unaudited shape.
- Evidence: grep for `data/timeline` and `liveNow(` in `app`, `lib`, `components` finds no importer (the `liveNow` on `app/(patient)/patient/page.tsx:96` is a local count).
- Severity: S4
- Fix sketch: delete the file.
- Decision it came from: superseded by 76.x Total View.

### WALL-30 · `payrollByMonth` skips the founder check its own file requires
- Verdict: HANDLED
- Sources: code-03 Suspect (`lib/data/payroll.ts:137`)
- Promise: A5
- Who is hurt and how: nobody. Both paths reach it only from a super_admin page.
- Evidence: callers `app/(admin)/admin/actuals/page.tsx:69` and `lib/data/actuals.ts:277` (`monthlyActuals`, whose only caller is the same page, `:52`); the page is `requireRole("super_admin")` at `:49`.
- Severity: S4
- Fix sketch: pass the actor and call `mustBeFounder` anyway, as the file's comment asks.
- Decision it came from: payroll sprint.

### WALL-31 · Admin screens that hand a founder patient names and transcripts
- Verdict: HANDLED
- Sources: code-02 Looks handled 2 (`lib/data/admin.ts`), code-03 Looks handled (`radar-admin.ts investigate`), code-06 Looks handled 2 (clinic manager audit), code-09 Looks handled 6 and 7 (receipts, identity documents), code-08 Looks handled 7 (partner deliveries opaque)
- Promise: A5
- Who is hurt and how: nobody; these are the patterns WALL-9 should copy.
- Evidence: `app/(admin)/admin/therapists/[id]/page.tsx:40-55` is super_admin and writes a `break_glass` audit before the patient reads; `app/(admin)/admin/radar/investigate/[id]/page.tsx:43-48` audits `break_glass.investigate` before rendering the transcript; `lib/audit.ts:103-105` throws if a clinic manager's audit names a patient; partner deliveries show an opaque subject id (`app/(partner)/partner/deliveries/page.tsx:22-26`); receipts stream through an audited route (`app/(admin)/admin/transfers/receipt/[id]/route.ts`, per code-09).
- Severity: S4
- Fix sketch: none.
- Decision it came from: 20.9, C151.

## Strangers and the claim screen

### WALL-32 · A code that arrives by email marks the PHONE as proven, so a stranger's number can be "proven" and the claim screen then says whether a clinician holds notes for it
- Verdict: CONFIRMED
- Sources: code-06 Broken 2; related code-08 Looks handled 3 (suggestions only on a proven handle, which this defeats); MAP Confirmed 8 (claim needs no ownership check)
- Promise: P4; PLAN C121 (nothing about a record before the handle is proven)
- Who is hurt and how: anybody in therapy. Somebody signs up with a stranger's phone number and their own email; the verification code is sent to both channels, arrives in their inbox, and is recorded as proving the phone. `/patient/claim` then shows whether a practice keeps a record for that number, with the owner's initials, and MAP Confirmed 8 lets them claim it.
- Evidence: `lib/patient-auth/handle.ts:104` records `channel = "whatsapp"` whenever the account has a phone; `:115-122` calls `notify` with both email and phone; `lib/notify/index.ts:59-80` sends on every channel, email included (and WhatsApp is not configured, so email is the only one that arrives); `confirmHandleCode` (`handle.ts:180-190`) then sets `phoneVerifiedAt` because the row says whatsapp. The comment at `:176-179` states the rule the code breaks.
- Severity: S1
- Fix sketch: send the handle code only on the channel recorded (phone code by WhatsApp or SMS only), or record one token per channel. Check: an account with phone and email that confirms the emailed code gets `emailVerifiedAt`, never `phoneVerifiedAt`.
- Decision it came from: 13R.12 (send on every channel) collided with §3b (a code proves only its own channel).

## Clinic principal edges

### WALL-33 · A deleted custom role, or a staff assignment pointing outside the practice, could widen a clinic staff member's reach
- Verdict: HANDLED
- Sources: code-01 Suspect (0093 `role_id` SET NULL falls back to built in role), code-01 Suspect (assignments not tied to organisation)
- Promise: C2
- Who is hurt and how: nobody. A staff row is always created with the built in role `viewer`, a null or deleted custom role yields no capabilities, and every clinic read is scoped to the practice's own organisation before the assignment list is applied.
- Evidence: `lib/data/clinic-team.ts:256,294` (`role: "viewer"` always); `lib/clinic-auth/session.ts:203-208` (admin only when `role === 'admin'`, deleted role gives `[]`, `parseCapabilities(null)` gives `[]` at `lib/clinic-auth/capabilities.ts:115-116`); `lib/data/clinic.ts:333-336` filters `sessions.organization_id = actor.clinicOrganizationId` and then `inArray(therapistId, assigned)`.
- Severity: S4
- Fix sketch: none.
- Decision it came from: 63.3 to 63.5.

### WALL-34 · Signing in at both doors leaves one browser holding a live clinician cookie and a live clinic cookie
- Verdict: CONFIRMED
- Sources: code-06 Broken 12
- Promise: none (PLAN C352, "never one session carrying both capability sets")
- Who is hurt and how: a clinician who also runs the practice. Nothing leaks between the two portals (each reads its own session table), but the rule that only one of the two is active at a time holds only on the explicit switch.
- Evidence: `lib/auth/actions.ts:264` (`createSession`) and `app/(clinic)/clinic/sign-in/actions.ts:18-36` each set their own cookie and revoke nothing of the other's; only `lib/clinic-auth/switch.ts` revokes.
- Severity: S4
- Fix sketch: on either sign in, revoke the linked principal's sessions, as the switch does.
- Decision it came from: 63.2 / C352.

## Sponsor portal as a whole, and the gates that claim to guard the walls

### WALL-35 · E2: the company portal has no screen that could show a note, a session time or an attendance list
- Verdict: HANDLED (apart from WALL-1 and WALL-2)
- Sources: code-15 Suspect 1, code-13 Suspect (sponsor modules declared non clinical), code-01 Suspect (pot legs share txn_id with session legs; weeklySpend), code-04 Suspect 7 (pot leg timestamps), MAP Suspect 9 and 10, DOCS digest 12 and 13, code-11 Looks handled (heatmap)
- Promise: E2, E1
- Who is hurt and how: nobody through these screens. Every sponsor page was opened: overview, pot, pot invoice, people, code, settings, domains, integrations.
- Evidence: imports of every `app/(sponsor)` file (grep) reach only `lib/data/sponsors.ts` (`roster`, `potBalance`, `weeklySpend`, `attemptsOnCode`, `identifierFields`, `coverageFor`), `lib/data/sponsor-admin.ts` (`potTerms`), `lib/billing/invoice.ts` (`invoiceFor` and `topUpHistory`, both filtered to `txn_kind = 'pot_topup'`, `:90-97`, `:225-233`), `lib/billing/manual-entry.ts`, `lib/data/sponsor-domains.ts`, and `lib/billing/pot.ts` `potTotals` (WALL-1). No sponsor query selects a session, therapist or clinical column. The weekly heatmap is grouped by week in SQL and floored (`lib/data/sponsors.ts:490-555`, `:181-217`), and is not drawn at all below a roster of five (`app/(sponsor)/sponsor/page.tsx:76-77`); its one weakness is the live total beside it (WALL-1). The roster is names, enrolment id, a date (WALL-2) and paused, ordered by name (`sponsors.ts:92-128`). Removing a person touches only the enrolment and one notice (`:401-451`), audited by the caller (code-03 Looks handled).
- Severity: S4
- Fix sketch: none beyond WALL-1 and WALL-2.
- Decision it came from: 53.x, C227 to C229, C377.

### WALL-36 · The privacy gate `verify:principals` reads raw source and lets any "capability" word exempt a page from every clinical check
- Verdict: CONFIRMED
- Sources: code-13 Broken (verify-principals 351-358, 526-546; control at 590-594), code-13 Broken (survey-live omits every partner clinical route)
- Promise: E2, C2 (the gates that claim to prove them)
- Who is hurt and how: the founder, who reads a green gate as a wall. A comment naming a guard counts as the guard; a page that mentions `listRadar` or `publicProfile` anywhere is treated as authenticated and skips every clinical module check; the control meant to prove the import graph resolves asserts `size >= 0`, which cannot fail. The live survey that claims to probe "every API route" skips the partner transcript, note, summary, media and memory routes.
- Evidence: `scripts/verify-principals.ts:351-358` (`guardsIn`, `hasCapabilityAuth` regex over the file), `:526` (`s.body`, not the comment stripped `s.code`), `:323-343` (capability list includes `listRadar`, `publicProfile`), `:590-594` (the control). `scripts/survey-live.ts:64-90` per code-13 (not re-opened here).
- Severity: S3
- Fix sketch: read `s.code`; make a capability exemption name the module it permits; replace the control with a known page and a known clinical module that must be found.
- Decision it came from: 58.6.

### WALL-37 · The general assistant sends every roster patient's full name and session dates to the model provider
- Verdict: CONFIRMED
- Sources: code-05 Suspect 11
- Promise: none published; contradicts the de-identification rule in `lib/ai/notes.ts:84-92`
- Who is hurt and how: every patient of a clinician who uses the assistant. Their full name, last and next session date and count of unsigned notes leave for the model provider on each question, while the note path was rebuilt specifically so names never do.
- Evidence: `lib/ai/assistant.ts:169-184` (`rosterBlock`: "Names and dates only", one line per patient with `row.name`).
- Severity: S3
- Fix sketch: send initials or a per request alias and map back the `mentions` locally.
- Decision it came from: C57 (dates are not clinical) and the assistant sprint; the notes path's rule was never applied here.

### WALL-38 · Who paid (an employer's name, a cardholder) could appear on a clinician's money screen
- Verdict: HANDLED
- Sources: code-14 Suspect 6 (C243 proved over five hand typed files), code-11 Looks handled (ledger and payment sheet names)
- Promise: E1 (a clinician must not learn which employer covers which patient; PLAN C242, C243)
- Who is hurt and how: nobody. No surface reads the payer name.
- Evidence: grep of `app`, `components`, `lib` for `payerName`, `payer_name`, `payerEmail`: written only by the card checkout (`lib/billing/connect.ts:770-771`) and the guest pay action (`app/pay/[token]/actions.ts:147-148`), nulled for pot and transfer rows (`lib/billing/pot.ts:527-528`, `lib/billing/manual-grants.ts:306-307`); every former reader was renamed to the viewer's own name (`components/billing/ledger.tsx:56`, `payment-history.tsx:16`, `payment-popup.tsx:51`, `components/admin/vault-payment-row.tsx:46`). The gate's hand typed file list is still a T3 weakness, but there is nothing for it to miss today.
- Severity: S4
- Fix sketch: none; derive the gate's file list from the tree.
- Decision it came from: C243, 76.10.

### WALL-39 · A clinician's typo in a patient's phone or email offers that record to whoever owns the typed handle, who can then take it
- Verdict: CONFIRMED (the claim half is MAP Confirmed 8, carried in)
- Sources: code-10 Suspect 12; MAP Confirmed 8; code-02 Broken 1
- Promise: P4
- Who is hurt and how: a patient whose clinician mistyped one digit. The stranger who owns that number or address, once signed up and proven, is shown "a therapist keeps notes for someone with your phone number" with initials, and MAP Confirmed 8 shows a code to the stranger's own inbox is all it takes to claim the whole record.
- Evidence: `suggestionsFor` (`lib/data/claims.ts:111-123`) offers every unclaimed person whose chart handle matches the account's proven handle, with `redactName`; the clinician types the handle freely (`components/patient/patient-editor.tsx:89-107`, `lib/data/patients.ts:256`). Claiming: MAP Confirmed 8 (`startClaim` checks only exists and unclaimed; `challengePassed` has no caller).
- Severity: S1
- Fix sketch: MAP Confirmed 8's fix (wire the two question challenge before `verifyClaim`); a handle typed by a clinician should need the patient's own confirmation (the invite link) before it can surface a suggestion.
- Decision it came from: sprint 6 claim flow; §3b challenge built but not wired.

## Summary table

| Id | Verdict | Severity |
|---|---|---|
| WALL-1 | CONFIRMED (MAP 5) | S1 |
| WALL-2 | CONFIRMED | S1 |
| WALL-3 | PARTLY | S3 |
| WALL-4 | WRONG | S4 |
| WALL-5 | HANDLED | S4 |
| WALL-6 | CONFIRMED | S2 |
| WALL-7 | CONFIRMED | S2 |
| WALL-8 | PARTLY | S3 |
| WALL-9 | CONFIRMED | S1 |
| WALL-10 | CONFIRMED | S1 |
| WALL-11 | PARTLY | S2 |
| WALL-12 | CONFIRMED | S1 |
| WALL-13 | CONFIRMED | S2 |
| WALL-14 | CONFIRMED (promise vs product; founder decides) | S2 |
| WALL-15 | CONFIRMED | S3 |
| WALL-16 | HANDLED | S4 |
| WALL-17 | CONFIRMED | S3 |
| WALL-18 | CONFIRMED | S1 |
| WALL-19 | PARTLY | S2 |
| WALL-20 | PARTLY | S3 |
| WALL-21 | CONFIRMED (executed) | S2 |
| WALL-22 | WRONG | S4 |
| WALL-23 | CONFIRMED | S3 |
| WALL-24 | CONFIRMED | S1 |
| WALL-25 | HANDLED | S4 |
| WALL-26 | PARTLY | S2 |
| WALL-27 | CONFIRMED | S1 |
| WALL-28 | HANDLED | S4 |
| WALL-29 | WRONG | S4 |
| WALL-30 | HANDLED | S4 |
| WALL-31 | HANDLED | S4 |
| WALL-32 | CONFIRMED | S1 |
| WALL-33 | HANDLED | S4 |
| WALL-34 | CONFIRMED | S4 |
| WALL-35 | HANDLED | S4 |
| WALL-36 | CONFIRMED | S3 |
| WALL-37 | CONFIRMED | S3 |
| WALL-38 | HANDLED | S4 |
| WALL-39 | CONFIRMED (claim half MAP 8) | S1 |

Counts: 39 entries. CONFIRMED 21, PARTLY 6, HANDLED 9, WRONG 3, UNTESTABLE HERE 0.
Severity: S1 10, S2 8, S3 8, S4 13.

For the walk (`continuity` and `money` positions): WALL-1, WALL-2, WALL-14 and WALL-24 are each visible on a screen in one step and should be walked first; WALL-18 needs a partner key and a revoked subject, which no position seeds today.
