# The working map

Working notes for the takeover (tasks 171 to 176). Not documentation: a reading log that
survives a compaction or a lost container. Re-read this file first after either.

Started 2026-09-22. Every line is a claim on the date it was written.

## Where the job is

| Step | State |
|---|---|
| 1 Read every `.md` | In progress. Read personally: TAKEOVER, VALUE-STATEMENTS, TRAPS, HAZARDS, LIFECYCLES, THE-PLAN, THE-REDESIGN, PROVE-IT, ORIENTATION, NEON-BRANCHES, DEMO-LOGINS, README. Delegated full reads, digests in `takeover/reading/`: PLAN.md, `docs/simulation/*` + SIMULATION-PROMPT, FINANCIAL-PLAN + INVENTORY + BRAND + LOGO-BRIEF + EMAIL-DNS + DAILY-HOSTS + content-backup |
| 2 Read every line of code | Not started |
| 3 Walk | Blocked: see Environment |
| 4 Assess | With 3 |
| 10b Report | After 2 and 3 |
| 5 Redesign `/design` | After the report |

## Environment, 2026-09-22

- This container has **no `.env.local`, no `node_modules`, no database URL** in the environment.
  Reading needs none of them. The walk needs a database, a running app and credentials.
- The walk in `docs/PROVE-IT.md` targets **production** (`on:production -- seed:demo`). Nothing
  has launched and every account is synthetic (README, ORIENTATION), so the founder has
  authorised it; still a question to put to them: a Neon branch forked from production plus a
  local app would give the same walk with zero risk to the deployed site. Decide before step 3.
- The inherited task list (38 tasks) did not travel: it lived in the previous session's tool
  state. It exists only as numbers inside documents. Rebuild it from THE-PLAN, TAKEOVER s11 and
  the PLAN digest into `takeover/TASKS.md`.

## The promises, and where each claims to be enforced

From `docs/VALUE-STATEMENTS.md`. "Enforced by" is the claim; "Code says" is filled in by step 2.

| Id | Promise | Claimed enforcer | Position | Code says |
|---|---|---|---|---|
| P1 | Three taps from opening to in a session | `/` radar card | live | |
| P2 | Nothing only in an email; orb on every screen while money owed or door open | `scripts/verify-notices.ts`; the chrome draws the orb | live | |
| P3 | Nothing machine-written reaches you unsigned; summary names clinician + credentials; "still writing" before sign | `/for-patients`; import-graph invariant (README safety 1) | live, continuity | |
| P4 | One record, every version kept under author's name; patient decides readers | DB trigger (append-only summaries, ORIENTATION); `lib/data/portability.ts` | continuity | |
| P5 | Crisis path never depends on money; SOS on top of payment orb | C235; `components/patient/session-orb.tsx` under SOS | crisis | |
| T1 | Draft note from transcript before you stand up, says draft until signed | `/` how-it-works | live | |
| T2 | Off the record: nothing in that minute kept, note silent about it | `/` room card | live | |
| T3 | Owed nets out of earned before payout | `lib/content/honesty.ts`; `/pricing` | money | |
| T4 | Invite link works for stranger (asks name) and signed-in patient ("Joining as") | task 109; `app/join/[token]/page.tsx` | live | |
| T5 | Copilot only for chosen clinician, cites source sentence, revoke stops next question | `/for-patients`; `lib/ai/case-copilot.ts` | continuity | |
| C1 | Seat added, on radar the same hour, verification state on row | `/` clinic card | growth | |
| C2 | No caseload count, no patient name anywhere in clinic portal | `/` clinic card; `verify:sprint54` clinical-word sweep | continuity | |
| C3 | One bill per practice, priced per seat, filled seats | `/` "One set of books" | growth | |
| C4 | Seat released mid-month: next bill lower by one seat, clinician to PAYG, nobody suspended | 09-THE-EDGES PL6 | growth | |
| C5 | Earnings per clinician visible, patients not | `/` | continuity | |
| E1 | Funded, spent, how many; never who or when; balance published not live (moves every 5 sessions) | `/` company card | money | |
| E2 | No company screen could show a note, session time, attendance | `/` "What you will never see" | money | |
| E3 | Price shown is price owed (coverage change does not reprice booked session) | 09 CV7 | money | |
| E4 | Coverage 0% is not removal | C345, 09 CV6 | growth | |
| E5 | Empty pot: pot takes nothing, ordinary pay link, "ask HR" | 09 CV9 | growth | |
| A1 | Nothing granted before a person confirms | `verify:rail` | live | |
| A2 | Confirm twice moves money once | 09 RA3, `verify:edges` | money | |
| A3 | Rejection sentence read verbatim by payer | 09 RA4 | money, crisis | |
| A4 | Unclaimed money is work, never silently kept (overpayment, unmatched line) | 09 RA6, RA8 | money | |
| A5 | Role is a list; refused screens redirect; refusal on the record | `/security` | crisis | |

Other invariants the docs call load-bearing (README "Safety invariants", DB rules table):
patient never converses with a model (import graph); journal cited never concluded
(`facts_journal_never_concludes`); note carries provenance; nothing about a record before a
handle is proven; "24/7" never a response-time promise; grant only for approved clinician
(trigger 0060); `users.verification_status` derived (trigger 0083); one invoice per session.

## Stale (document or comment describing something no longer true)

Every entry: where, what it says, what is true or suspected instead.

1. `docs/TAKEOVER.md` s13 and `README.md` Documentation table call `PLAN.md` "The specification".
   TAKEOVER s8 and PLAN.md's own header say it is a sprint log, not a specification.
2. `README.md` "Scheduled jobs" lists 3 crons. `vercel.json` has at least 5 (crisis, billing,
   retention, extract, reminders, ...); TAKEOVER says six. Count in step 2.
3. `README.md` "Who signs in": "Six kinds of person authenticate today. A seventh is being built"
   while describing clinic staff as sprint 63. Built or not: check `lib/auth` in step 2.
4. `docs/THE-REDESIGN.md` s4 has its own Phase 0 to 5 numbering (Phase 1 = never-stuck spine,
   Phase 2 = admin consolidation 32 to 6 pages) which contradicts `docs/THE-PLAN.md` phases
   (Phase 1 = instruments, Phase 2 = defects, Phase 3 = redesign, deleted). TAKEOVER s11 uses
   THE-PLAN's. THE-REDESIGN s4 is stale.
5. `docs/THE-PLAN.md` "Carried over": task 104 "remaining mockups" is listed; TAKEOVER s11's
   unscheduled set is 52, 105, 108, 156 (no 104). Either 104 was closed or dropped silently.
6. `docs/TRAPS.md` T2 ratchet says "19 of 101 verifiers"; TAKEOVER and ORIENTATION say "18 of
   106". One of them is stale. Re-measure.
7. `docs/DEMO-LOGINS.md` says the fourteen KEEP tables hold "every crisis line"; TAKEOVER's KEEP
   table names no crisis-line table. Where do crisis lines live? step 2.

## Contradictions between documents that the code must settle

1. **Clinic sees patient names or not.** `README.md` portal table: Clinic "Sees ... Patient names
   and appointment times only". Promise **C2**: "Nowhere in the clinic portal is there ... a
   patient name, on any screen". README clinic-staff rules also give staff "first name plus last
   initial". Direct conflict with a value statement. The code decides; if names are shown, C2 is
   broken or README is.
2. **How Egyptians pay.** TAKEOVER/ORIENTATION: no card processor in Egypt, every payment is a
   manual bank transfer (`manual_payments`). README money section: "Patient pays EGP, through the
   Egyptian gateway", "Egyptian rail is not live yet", `collectionProblem` refuses Egyptian card
   payments and "points at the free link". README never mentions the manual transfer rail.
   Probably README predates the rail. Check `lib/billing/manual.ts`, `collectionProblem`.
3. **Pricing semantics of the note fee.** README: "$3 more, and only where the patient consented
   to recording". TAKEOVER table: "The note, where consent was given". README elsewhere: AI fee
   "Only when the patient turned AI on". Consent to recording vs consent to AI: same flag?
4. **README says a subscribed clinician "pays neither per-session charge"** yet also "A
   subscribed session still raises both invoice lines, at zero". Consistent if lines are zero.
   Check `lib/billing`.

## Suspect (untested claims that would matter if false)

1. E1's "balance only updates once five sessions have passed" (published figure). Where is the
   5 enforced, and can an admin action or a top-up move the published figure between batches
   (a top-up moves it too, which is fine, but a refund or a reversal might leak a session)?
2. `therapist_radar.demo` is "a label and never a decision" (fixed 2026-09-22). Five
   expressions held the old exemption. Grep every read of `.demo` in step 2.
3. `notify()` swallows failures at warn (TAKEOVER s7). Who finds out now? Any other
   try/catch that hides a CHECK refusal?
4. Task 124: "a rejected transfer is a dead end", and `paymentsFor` returns nothing for a
   `session` payer (guests). So a guest who paid by transfer and was rejected is never told.
   A3 is at best partly kept.
5. Task 123: in-person sessions recorded without consent, note says not recorded. A legal
   defect. Check first in step 2 (`lib/transcript`, room, in-person path).
6. The walk's seed writes "no payment row" and "posts every cent through the product's own
   functions". Verify seed-demo uses the product functions, not raw inserts.
7. KEEP census in `scripts/seed-demo.ts`: a count that only compares "smaller" misses a table
   whose rows were replaced (same count, different content). `ship:content` did exactly that
   (H49). Check whether the census compares bytes or only counts.
8. `verify:prove` reads `lib/content/defaults.ts`, not published rows; task 156 is live drift.
   Fetch the live pages for every `where` citation in step 3.

## Unclaimed (the code can do it; no promise covers it; no walk exercises it)

Candidates from documents only, to be confirmed in code:
1. Recording external meetings (Zoom/Meet/Teams) with a dispatched bot, `lib/meetings/`, Recall.ai.
   No value statement. Consent path for a bot in somebody else's meeting?
2. EHR integration, `lib/ehr/`, SMART/OAuth; partner portal reading records under a grant,
   `lib/partner/`. No value statement (partner is "last" and has no audience in the 25).
3. Clinic staff principal (receptionist, custom roles), sprint 63. No value statement.
4. Stripe Connect payouts in USD for non-Egyptian clinicians; cross-border entity transfers.
5. Crisis scanning of journals with alerts to grant-holders (C123), crisis cron re-delivery.
   P5 covers the button only. Scanning a patient's journal and telling a clinician is a big
   capability nobody promised the patient on a page (check `/for-patients` wording).
6. Retention cron deletes audit records older than six years.
7. Instruments (assessment questionnaires with scoring), `instruments` table.
8. Company welcome credit $100.

## Directory map (step 2)

Empty until reading code begins. One section per directory, written before opening the next.
