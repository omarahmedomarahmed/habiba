# The inherited task list, rebuilt

Written 2026-09-22 during task 171. The previous session's task list lived in its tool state and did not travel. This file rebuilds it from the numbers the documents mention. Read only: no task was worked while writing it.

Sources searched for task numbers: `docs/TAKEOVER.md` (s11, and s3, s8, s12), `docs/THE-PLAN.md`, `docs/PROVE-IT.md`, `docs/THE-REDESIGN.md`, `docs/LIFECYCLES.md`, `docs/VALUE-STATEMENTS.md`, `docs/NEON-BRANCHES.md`, `docs/ORIENTATION.md`, `README.md`, `takeover/reading/PLAN-digest.md` s4 (PLAN.md has **no** task numbers, only sprint tickets like 22.8b), the sixteen code notes, and the code comments themselves (`grep -i "task N"` over app, lib, components, scripts).

Status words:

- **open**: nothing in the reading shows it fixed.
- **appears fixed**: the code the reading saw does what the task asks; still to be proven by a walk or a check.
- **wider than described**: the reading shows the defect is real and reaches further than the task's title.
- **not started / in progress / blocked** for the six job tasks and the phase work that is a build rather than a defect.

"MAP C4" means `takeover/MAP.md` "Confirmed by the coordinator" item 4, which is already verified.

## The count

| Group (TAKEOVER s11) | Numbers | Count |
|---|---|---|
| Phase 0 | 117, 122, 123, 124 | 4 |
| Phase 1 instruments | 127, 128, 129 | 3 |
| Phase 1 spine | 163, 164, 165, 166, 167 | 5 |
| Phase 2 | 114, 115, 116, 118, 119, 120, 121, 125, 126, 130, 131, 132 | 12 |
| Phase 4 | 142 to 150 | 9 |
| Phase 5 | 151 | 1 |
| Unscheduled | 52, 105, 108, 156 | 4 |
| **Inherited** | | **38** |
| The job | 171, 172, 173, 174, 175, 176 | 6 |
| **Total** | | **44** |

**The total is 38 plus the six, 44, and it matches TAKEOVER s11.** Every number in the seven groups appears once. No group number is missing from the documents.

## Phase 0: defects that hurt a real person

| # | Title | What the documents say | Evidence from the reading | Status |
|---|---|---|---|---|
| 123 | In-person sessions recorded without consent | THE-PLAN:20, TAKEOVER:933: recorded and transcribed with no consent, and the note says not recorded. The one legal defect. | MAP C4: in person there is no join form, consent stays null and the mic records (`components/session/session-room.tsx:103`); the patient's Stop and a late decline set `recording_paused_at`, which the room's 5 s poll never reads; `app/api/sessions/[id]/transcribe/route.ts` checks neither consent nor pause. code-03:341, code-05:565, code-07:558-559, code-10:615-617. The new-session form tells the clinician "The patient decides that, on their own screen" while in person is the default (`components/session/new-session-form.tsx:88, 184-186`). The seed plants this shape as demo data (code-12:442, 498). No verifier covers in-person consent (code-14:521). | **wider than described**: also the patient's Stop button, a decline after the room opened, and the clinician's "don't record" untick do not stop the 24T room |
| 122 | A modal over "Go in now" ends in a 3-day ban | THE-PLAN:21, TAKEOVER:934 | `components/radar/presence.tsx:620` full-screen `z-[200]` sound prompt forced while a booking rings, cannot be dismissed when sound is blocked (code-07:560); the language strip can cover "Go in" at 390 px (`components/patient/session-started.tsx:47-73`, code-10:622). The ban: 72 h on the THIRD automatic no-show, first is a warning (`lib/data/feedback.ts:856`, code-02:171). The no-show sweep matches ANY scheduled session whose patient opened the link 10+ minutes early, not only radar bookings, and `patient_joined_at` has no check against `scheduled_at` (`lib/data/feedback.ts:796-829`, `lib/data/sessions.ts:873`; code-02:212, code-07:543). | **wider than described**: a calendar patient opening an invite early can get their clinician warned and then suspended without any modal involved |
| 124 | A rejected transfer is a dead end | THE-PLAN:22, TAKEOVER:935, PROVE-IT:388,560-566 ("if she still cannot find it, the dead end is wider") | MAP C7: reason stored verbatim and shown only if an account payer reopens the sheet; nothing is sent (`lib/billing/manual.ts:670-694`); a guest (`session` payer) gets `[]` from `paymentsFor` (`manual.ts:431`) and sees the bank details again with no reason (code-04:78, code-07:561); the operator is told "they have been told why" (`app/(admin)/admin/transfers/actions.ts:72`). No REJECTED tab in the console (code-09:211); `verify:machines` has no manual-payment machine, so the dead end is invisible to it (code-06:328, code-13:407). | **wider than described**: the operator is also misinformed, and no gate can see the state |
| 117 | An anonymous session ends with no patient record | THE-PLAN:23, TAKEOVER:936 | A radar or link session whose guest never typed a name has `patient_id` NULL (`lib/data/sessions.ts:317-361, 843-877`); a summary is refused "no patient record" (`app/(app)/sessions/actions.ts:763-773`) (code-03:337). `generateAndStoreNote` accepts `patientId: null`, so a note is written with no chart to hold it (code-05:624). | **open**, confirmed as described |

## Phase 1 instruments

| # | Title | What the documents say | Evidence from the reading | Status |
|---|---|---|---|---|
| 127 | Structural crawler | THE-PLAN 1a: all 129 pages as 8 user types, invariants (one h1, nav resolves, no untranslated key, contrast, 390 px, RTL) | Not built. Nearest things are hand-typed route lists: `scripts/survey-live.ts` (20 of 32 API routes, code-13:64, 380), `scripts/check-live.ts:99-131`, `.walkthrough2/routes.mjs` (code-16 Stale 21). INVENTORY's generator misses `/login`, `/signup`, `/join`, `/pay`, `/[slug]` (MAP Suspect 14). | **open** (not started) |
| 128 | Journey suites | THE-PLAN 1b: deterministic two-browser cycles reusing `.render/drive.mjs`, `.render/pair.mjs` | The only journey harness found is `.walkthrough*/`, which clicks removed UI (`Video`, "Approve note") and sources `.env.local` (code-16 Stale 19, 20, 22). | **open** (not started) |
| 129 | Sibling-path gate | THE-PLAN 1c: diff the field set each creation path writes; `bookSlot` missing `joinToken`, `sessionType`, `priceCurrency` | Not built. `bookSlot` now mints `joinToken` and `feedbackToken` but still sets no `priceCurrency` (defaults `usd`) and no `sessionType` (code-03:164, 352). The gate would fail today, which is its control. | **open** (not started) |

## Phase 1 spine: never stuck

Titles from `docs/THE-REDESIGN.md:380-381`; PROVE-IT:516 calls 163 to 167 "that work" (a console that lists blocked people).

| # | Title | What the documents say | Evidence from the reading | Status |
|---|---|---|---|---|
| 163 | Stuck register | THE-REDESIGN:113 "a list to fill": twelve declared ways to be stopped | `scripts/verify-machines.ts:51,53`: `KNOWN_DEAD_ENDS` is empty, "the stuck register, task #163, is what fills it" (code-13:407). Undeclared: manual payments (rejected), enrolments, clinic state, record-access grants (code-06:328, 594). | **open** (not built), and wider: the lifecycle list it would read omits the rails where people are stuck today |
| 164 | Dead ends | THE-REDESIGN:380 | Readers found screens with no door: `/patient/messages`, `/patient/notices` (code-08 Stale 4, 5); `/records/[token]` expiry says "ask your therapist" though only admins can send (code-07 Stale 10); rejected transfer (124). | **open** |
| 165 | `/admin/stuck` | THE-REDESIGN:381 | No such route: `app/(admin)/admin/` has actuals, announce, audit, benefits, checkins, clinics, content, errors, financial-model, numbers, partners, patients, payouts, radar, ratings, settings, sponsors, strings, support, taxonomy, therapists, transfers, tv, usage, vault, verifications. Partial stuck screens exist: Paused benefits, Numbers, Support, Verifications, Transfers and open carts, Payouts (code-09:55, 412). | **open** (not built) |
| 166 | The clock (alert on the age of the oldest stuck row) | THE-REDESIGN:95-109, LIFECYCLES:241,255-256: grant `pending` and sponsor `held` have no span | `lib/lifecycle/machines.ts:109` cites it; `scripts/lifecycles.ts:124-133` lists promises with no clock (code-12:537). No alerting found. | **open** (not built) |
| 167 | Staff unblock | THE-REDESIGN:381 | Console unblock actions are founder only in several places (`payouts/actions.ts` all `requireRole("super_admin")`; tv founder only; code-09 Stale 9, 15). Support tickets cannot be opened from the queue (code-09 Stale 17). Open carts that lock bank details cannot be cleared by staff (code-09:448). | **open**, and wider: several "staff" screens are founder-only in code |

## Phase 2: defects by surface

Titles from `docs/THE-PLAN.md:76-90` and its task table (`:194-198`).

| # | Title | What the documents say | Evidence from the reading | Status |
|---|---|---|---|---|
| 114 | A signed-in patient cannot join their own live session | THE-PLAN:80 (session) | "Joining as" appears only when the signed-in person's `personId` owns the session's patient row (`app/join/[token]/page.tsx:114-125`, code-07:485, 613); a signed-in patient booking from `/patient/radar` books as a guest and is linked at the join page (code-08:819). A money-owed patient is still asked for a receipt email (code-10:187). | **appears fixed** for the owner case (79.2); open for a patient whose chart is not linked to their person. Walk it. |
| 115 | The join link does not survive a reload, invites silently fail | THE-PLAN:80-81 | Resume needs `guestName` set plus paid or booked or `patientJoinedAt` (`app/join/[token]/page.tsx:190-194`); for a session invited onto an existing chart `guestName` may be null (code-07:486-488, 554). An invite to a chart with no person is email or WhatsApp only (code-03:171); with no Resend domain and no WhatsApp key most send nothing (`components/scheduling/booking-calendar.tsx:25-26`, undated). | **appears fixed** for guests who typed a name; **open** for invites to existing charts |
| 116 | Price shown differs from price collected | THE-PLAN:76 (money) | Transfer rail kept: lines and total from one query, live row wins (code-04:11, 446). The calendar path books in USD whatever the clinician's currency (code-03:397), which is 126. | **appears fixed** on the transfer rail; the remaining case is 126 |
| 118 | Skew protection | THE-PLAN:90 (platform) | Nothing in `next.config.ts` (no `deploymentId`, no skew setting); no reader touched it. Vercel skew protection is a project setting, so it cannot be settled from the repository. | **open** (untestable here) |
| 119 | Two ways to become a patient | THE-PLAN:90 | No reader examined it by this name. Candidates in the notes: patient signup creates its own `people` row that the claim screen then matched back (`lib/data/claims.ts:100-110`), and the record claim has no ownership check (MAP C8). | **open** (not examined) |
| 120 | The unwinnable "Try again" | THE-PLAN:81 (session): "the unwinnable Try again, the alert that fires on form-open and never on arrival" | Nearest finding: the patient's in-room report posts the JOIN token to an action keyed on the FEEDBACK token and always fails "This link is no longer valid" (code-10:195). The "alert on form-open" matches the early `patient_joined_at` stamp (see 122). | **open**; possibly the report box, confirm by walking |
| 121 | The radar sweep's schedule | THE-PLAN:85, TAKEOVER:956 ("scheduled as if only cosmetic, and the 2026-09-22 directory fix leaned on it being late") | `vercel.json`: `crisis` (which runs `sweepRadar` and the abandoned-patient backstop) is `0 3 * * *`, once a day; the cron route's own comments still say hourly (code-07 Stale 1 to 3). `sweepRadar` cancels ANY scheduled unpaid priced session older than 10 minutes, not only radar checkouts, and nulls its join token (`lib/data/radar.ts:1223-1234`, code-03:351). | **wider than described**: the nightly sweep also cancels unpaid calendar and link sessions |
| 125 | Minimise kills the poll | THE-PLAN:76 (money) | Not examined by any reader. `components/join/patient-room.tsx:79-132` keeps one iframe across minimise and tells the server (`setSessionMinimised`); `join-flow.tsx:145-179` polls while waiting and while live. The money-side poll (payment waiting screen) was not traced. | **open** (not examined) |
| 126 | Wrong currency on future bookings | THE-PLAN:64, 76-77 | `bookSlot` (`lib/data/scheduling.ts:442-489`) sets `priceCents` from the clinician's rate and no `priceCurrency`, so it defaults to `usd` (`lib/db/schema.ts:722`), while `createSession` and `createRadarSession` copy `users.rate_currency` (code-03:164, 352, 397). | **open**, confirmed |
| 130 | Radar: unbounded hold, "taken by you", online while suspended, release leaves offline | THE-PLAN:84-85 (task number from the table at `:196`) | `listable` filters suspended clinicians (`lib/data/discover.ts:112`, code-02:119); presence needs status and a fresh heartbeat. No reader traced the hold length or release. | **open** (not examined in depth) |
| 131 | Scheduling: cancellation strands the hour and tells nobody, no reschedule, `/calendar` 404 | THE-PLAN:87-88 | No `calendar` page exists under `app/` (checked). Only `/on-call` can cancel a booked hour and the calendar says "cancelled with a message, elsewhere" without linking (code-07 Stale 15, code-07:116). Bookings visible only after opening a day (code-07:566); sessions made by the form or the radar may never show on `/bookings` (code-10:599). No reschedule action found. | **open**, confirmed |
| 132 | Money: payer-name fallthrough, the queue's unidentifiable rows, irreversible confirm | THE-PLAN:77-78 lists these three with no number; `:194` puts 132 in "2 money". Title inferred. | Payer name falls back only to the patient, not the sponsor, on the clinician's page (code-07:33, code-04:31: C243 kept); the transfers queue shows payer names and types (code-09:209). Confirm is irreversible: no re-run or undo path, and a confirmed row cannot be confirmed again (code-04 Stale 4). Related and worse: payout double-post on two simultaneous presses (MAP C6). | **open**; title to confirm with the founder |

## Phase 4: nine agent-driven cycles

From THE-PLAN:136-150, 200. None has run; the gate is "every cycle passes".

| # | Title | Evidence from the reading | Status |
|---|---|---|---|
| 142 | Cycle 1, booking re-run | Blocked on Phase 0 to 2; 122, 126, 131 would fail it today | not started |
| 143 | Cycle 2, money | MAP C5 (E1 live totals), C6 (payout double-post), C7 (A3) would fail it | not started |
| 144 | Cycle 3, clinical continuity over three sessions | copilot ignores the live-session bound on the profile (`lib/ai/case-copilot.ts:457`, code-05 Stale 1) | not started |
| 145 | Cycle 4, crisis | MAP C2: the crisis filter suppresses real first-person disclosures ("The thought of suicide..."); crisis re-delivery runs once a day, not every 5 minutes as README says | not started; expect it to fail |
| 146 | Cycle 5, onboarding | Verification is gated in code; the admin therapists page says the opposite (stale.md D16) | not started |
| 147 | Cycle 6, clinic | C2 vs clinic schedule and export (MAP contradiction 1, Suspect 11) | not started |
| 148 | Cycle 7, partner / EHR | unsigned meeting webhook (stale.md D12); `fileNote` has no caller | not started |
| 149 | Cycle 8, deliberate failure | THE-REDESIGN:126 and :396 put it first in its own phase 5; THE-PLAN puts it eighth. Order unresolved | not started |
| 150 | Cycle 9, Arabic, RTL, 390 px | many English literals and hard-coded Eastern digits (code-06 Stale 25, code-08, code-11) | not started |

## Phase 5

| # | Title | Evidence | Status |
|---|---|---|---|
| 151 | The six-month simulation | Never run (`docs/simulation/12-THE-LOGINS.md:5-15`); production was wiped by `seed:demo` on 2026-09-20 and holds the demo cast. Its runbook still aims `on:production` commands at a run that is not there (stale.md D3). | not started; the runbook itself needs rewriting before it can be |

## Unscheduled

| # | Title | What the documents say | Evidence from the reading | Status |
|---|---|---|---|---|
| 52 | Real bank details, the week before launch | TAKEOVER:168, THE-PLAN:203 | Bank details are locked while payments are in flight, and open carts never expire and only the payer can cancel them, so the details may be locked indefinitely (`components/admin/transfer-fields-editor.tsx:57`, `lib/billing/manual.ts:709-714`, `app/(admin)/admin/settings/actions.ts:401-407`; code-09:448, 489, 506). | **wider than described**: the swap itself may be blocked by a stale cart |
| 105 | Email from the console | THE-PLAN:203-204 "email from the console"; PROVE-IT:616 "every automated email is sent from a shell" | No console control sends a patient a claim link or a free email; patient-directed sends are only the record export and the support close link (code-03:240, 380; code-09:22, 41, 414). | **open**, confirmed |
| 108 | The email preview past the patient | THE-PLAN:204 (title only) | `lib/mail-previews.ts`: the check-in preview does not match the real body (`lib/checkins/send.ts:124`), and the "therapist message" row is labelled audience `patient` though it mails clinicians (code-05 Stale 13). Whether this is the task's meaning is a guess. | **open**; meaning to confirm |
| 156 | CMS rows drift from `lib/content/defaults.ts` | TAKEOVER:543; `scripts/verify-prove.ts:273` | `verify:prove` reads defaults, not published rows (MAP Suspect 8). Defaults themselves carry false public claims (hipaa page, stale.md D9). Staging locales have drifted and no gate compares them (DOCS-digest 5.5). | **open**, and wider: the defaults are wrong too, not only the drift |

## The job itself

| # | Title (TAKEOVER s11) | Status |
|---|---|---|
| 171 | Read every `.md`, then every line of code, build the map | **in progress**: sixteen code notes and three digests done; verification of Broken and Suspect under way in `takeover/verify/`; MAP "Directory map" still empty |
| 172 | Walk every flow as the demo cast and prove the 25 promises | **blocked**: no database, no app, no credentials here; production vs a Neon branch is a founder question (MAP Environment) |
| 173 | Assess every user-facing screen while walking | **blocked** with 172 |
| 176 | Report what holds, what only looks broken, and what we never promised | not started; after 171 to 173 |
| 174 | Rewrite `/design` as a complete new design | not started; must not start before 176 |
| 175 | Find the tasks nobody knew to ask for | **in progress**: MAP Confirmed 1 to 8 and `takeover/verify/stale.md` Part 1 are the first candidates |

## Numbers referenced that are in none of the groups

| # | Where | What it is | Reading |
|---|---|---|---|
| 104 | `docs/THE-PLAN.md:203` "remaining mockups" | Carried over in THE-PLAN; absent from TAKEOVER s11's unscheduled set | Closed or dropped silently. Ask the founder. Probably absorbed by 174, which replaces all mockups. |
| 133 to 141 | THE-PLAN:97, :199; TAKEOVER:896 | Phase 3 redesign: 133 design system, 134 patient app, 135 in-app radar, 136 session room, 137 homepage, 138 company, 139 clinic, 140 therapist calendar, 141 partner | **Deleted**, replaced by 174. Still cited in code: task 137 twenty times (`lib/content/defaults.ts:245,314,387`, `lib/db/schema.ts:3003-3118`, `components/public/*`), 134 (`app/(public)/design/patient/page.tsx:20`), 136 and 140 (`app/(public)/for-therapists/page.tsx:40,45`, "until task 140 lands"), 138, 139 (`app/(public)/design/company/page.tsx:7` and `design/clinic/page.tsx:7`). Per TAKEOVER s11 every one of these references is stale. |
| 155 | TAKEOVER:896; code: `app/(public)/for-therapists/page.tsx:18`, `lib/i18n/messages.ts:398`, `lib/i18n/paths.ts:113`, `components/public/pricing-tiers.tsx:81,317`, `components/public/audience-page.tsx:10` | Deleted with Phase 3 | The code says the work was done (the for-therapists audience page exists); the number is dead. Stale references. |
| 152, 153, 154 | Code only: `components/public/site-chrome.tsx:16` "Tasks 152, 153, 154"; 153 in `app/(public)/layout.tsx:28`, `lib/auth/doors.ts:5`, `components/public/mobile-nav.tsx:11`, `sign-in-menu.tsx:12`; 154 twelve times in `app/(auth)/*`, the portal layouts, `components/auth/auth-shell.tsx:10`, `lib/i18n/messages.ts:466` | Site chrome, the four sign-in doors, auth shell | In no document and no group. Apparently completed work from the previous session (the doors exist). Not inherited. |
| 109 | `docs/VALUE-STATEMENTS.md:89`, `scripts/_value-statements.ts:142`, MAP T4 row | The join page stopped asking a signed-in patient their own name ("Joining as") | Cited as where T4 is said; appears done (see 114). Not inherited. |
| 20, 21 | `docs/THE-REDESIGN.md:262-265` | #20 therapist leaving a clinic drops to pay as you go; #21 proration when a solo therapist becomes a clinic mid month | Not in the 38. Either closed long ago or lost. #21's rule (prorate) is contradicted by the spec in the same section ("do not prorate"); seat proration is applied as a discount in code (`lib/billing/seats.ts:161-168`). Ask the founder whether #20 and #21 are live. |
| 66 | `docs/NEON-BRANCHES.md:16` | "three environments, identical settings, one connection" | Not in the 38. Probably closed (the doc describes the branches). |
| 174 | README:35, ORIENTATION:203 | The redesign | In the job group; listed for completeness. |

## What this adds up to

- 38 inherited plus 6 job tasks is 44, as TAKEOVER s11 says. No group number is missing from the documents.
- Of the 38: **wider than described** 8 (123, 122, 124, 121, 52, 156, and 163, 167 wider in scope); **appears fixed in part** 3 (114, 115, 116, each with a remaining case); **open** 27 (including 9 cycles and 151 not started). None is shown fully closed.
- The reading has already produced tasks that are not in the list at all. They are the "Confirmed by the coordinator" items in MAP.md (published console password, crisis filter silencing disclosures, session recovery open for future sessions, E1 live totals, payout double-post, record claim without ownership check) and the Part 1 entries in `takeover/verify/stale.md` (unguarded verifiers that write or delete, the crisis re-delivery cadence, the simulation runbook aimed at production). Per TAKEOVER s11 they go to the founder separately from this list.
