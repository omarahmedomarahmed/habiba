# SIMULATION digest

Scope: docs/simulation/ (17 files) + docs/SIMULATION-PROMPT.md, read in full, against docs/VALUE-STATEMENTS.md. No source opened. The run has NEVER happened; every sentence below is a claim.

**The central fact: this runbook describes a production database that no longer exists.** 12-THE-LOGINS.md:5-15 says `npm run on:production -- seed:demo` wiped production on 2026-09-20: the 9 operator accounts, the applications and the founder's session are gone, and `verify:cast` now reads red. The prompt's "production RIGHT NOW" table was measured 2026-09-19 (SIMULATION-PROMPT.md:463), as were the baseline deltas, "7 of 26 sign in" and "seed already ran, do not rerun". None of it can be true today. VALUE-STATEMENTS.md:206-268 describes the replacement: 5 `seed:demo` positions, password `Demo2026!Therapy`, and some addresses that are real gmail inboxes.

---

## 1. Per file

**00-LESSONS.md** (169 lines, Sep 22)
- Purpose: the only file that is allowed to discuss the past. It lists 5 rehearsal obstacles, the runbook-rot audit of 2026-09-19, the wasted preview builds, the seed bug and the `.next` clash.
- Product claims: per-network sign-in limit x25 under `SIMULATION_RUNNING=1` (`verify:limits`). Patients have no email field. `organizations.region` defaults to `us`, which sends people to Stripe. Enquiries create held `organizations` or `sponsors` rows (there is no applications table). The Ignored Build Step builds only `main`.
- Stale: :120-137 says "the seed already ran, and it refuses to run again", which was overtaken by the 09-20 wipe. :8 and :96 say `verify:runbook` blocks archaeology and count drift, yet counts still drift in other files (see section 5).

**00-START-HERE.md** (409, Sep 22)
- Purpose: the Chief of Staff brief. It covers production as the target, the 5 rules, the $10 budget, the 17-step order of work, reporting checkpoints and the final report shape.
- Claims: `on:production` allow-list plus `writesTo()` refusal. Measured cost terms (fixed $0.01317, $0.00407/min). `spend` sums `ai_request_logs.cost_microcents`. 35 gates. `verify:synthetic` must not touch production.
- Stale: :325 "7 of 26 sign in" and :326 "exits 1 with exactly five seed deltas" both predate the wipe. :211 says "the twelve documents" while :31-49 lists 17. :63 says "five things" but the table has 6 rows. :372 says "Three things" but the list has 4. It has 8 reporting points; the prompt says 7. :267 claims every address is at example.com, which the demo logins contradict. The budget at :120-131 leaves out $4-5 of TTS synthesis (13-THE-AUDIO) and the 50-minute session L1.

**01-THE-CAST.md** (350, Sep 22)
- Purpose: 27 people (20 cast plus a payroll of 7), 4 organisations, 6 waves, the T4 rejection cycle, the session cadence (62 sessions, 286 minutes, 46 journal entries) and the cut order.
- Claims: `verify-cast.ts` parses the "People" row. `topUpPot` refuses `eg`. `lapseOverdue` and `entitledTier` demote T3 automatically. `lib/crisis/line.ts` holds Egypt 105/1/1. The seed creates only the operator, settings and applications.
- Stale: :52 says "Run `on:production -- simulate:seed` anyway as your first act", which contradicts 14:189, DEPLOY:150 and PROMPT:669 ("do not run it"). :52 quotes the refusal as "operator already exists", but 00-LESSONS:132 quotes different text. :44 says the seed creates "the platform operator" (one), but :88 says all 7 are seeded. :215 (B4) requires an "Account on hold, ask HR" screen, which 03:239 and PROMPT:1020 say does not exist. :58-59 gives the password `Simulation2026!`, which is superseded.

**02-THE-SWARM.md** (431, Sep 22)
- Purpose: the orchestrator brief. It covers the 3 tiers, 28 agents with at most 6 awake, the dependency order, the 8 standing agents, the DEV-LOG and BLOCKED formats, and cost discipline.
- Claims: queue actions are signed in as named staff. `/admin/benefits`, `/admin/radar`, `/admin/actuals`, the board (tv) and errors are super_admin only. The limiter works as described.
- Stale: :36 and :427 still say "one dev server" although the run is on production. :141 says the board (`/admin/tv`) is super_admin only, but 05:92 says tv is `requireManager()`. Wave 4 (:319) wakes T5 and the bugs but not S1/S2 or C1-A.

**03-THE-MONEY.md** (352, Sep 22)
- Purpose: the money agent's brief. Covers prices, the offer schedule, income and expense, the rails, wave-by-wave money beats and the final reconciliation.
- Claims: 1,000 EGP sessions are charged 1,140 with VAT. The 15% fee is taken on the pre-tax price. Metered is $1 room plus $3 note. Solo is $80; clinic is $72/seat. `chargeForSession` claims `trialSessionUsed` and raises a `waived` invoice. `/admin/vault` shows income, spend and left-over. There is a $5,000 pot floor, and only the welcome credit can go below it.
- Stale or contradictory: :32 ("a free first session still bills $1 and $3") contradicts :173 (a waived invoice "with both lines zeroed"). :228-237 says E1's pot drains using the $100 credit only, which contradicts 04:151 (R2, E1 funds by transfer) and PROMPT:911 (E2's pot is the one that drains). :286 says "every confirmed Egyptian session transfer carries 280 cents" of VAT, but that is false for part-covered sessions (CV4). :116-117 says "income column must total the card, stop if not"; PROMPT:1023 says they are not required to be equal. :118 uses `/admin/usage` as the acceptance test; PROMPT:1022 says it is a 30-day window covering only wave 6.

**04-THE-RAIL.md** (188, Sep 18, older than most files)
- Purpose: the payments operator's brief for the manual Egyptian rail. Covers 3 payer kinds, the payer screen sequence, the operator queue, and cases R1-R9.
- Claims: "Nothing happens until a person confirms it". `manual_payments` is the only record. Confirmation flips `sessions.payment_status`. A therapist transfer settles every due invoice oldest first "and stops rather than part paying one". Company amounts are VAT-inclusive ($5,000 becomes $4,386 in the pot). `detailsLockedBy` refuses edits. "Reject and tell them" needs at least 10 characters. There is no edit or reopen button.
- Stale: :5-6 says there is no Egyptian entity yet, while everyone is moved to `eg`. :80 ("stops rather than part paying") conflicts with RA7 and RA9 (part payment against a chosen list of invoices). :146 heading says "eight things" but R1-R9 are listed. :38 says the details are typed in by the operator; DEPLOY:210 and PROMPT:513 say placeholders are already filled in and are only read back.

**05-CAPTURE.md** (276, Sep 22)
- Purpose: the capture agent's brief. Covers the folder layout, per-person checkpoints (m0/m1/m3/m6), 25 admin pages with guards, the weekly tv series, money moments, the Arabic subset and video cuts.
- Claims: C80 is overridden because everyone is synthetic, proved by `verify:synthetic`. There are 5 `requireStaff` pages, 1 `requireManager` page (tv) and 19 super_admin pages. Promotional billing is not automated.
- Stale: :119 says settings show "Egypt's crisis line filled in", but 01:341 says `country_settings` stays null "and that is correct". :161 asks for a photo of the "Account on hold, ask HR" screen, which does not exist (PROMPT:1020). `/admin/actuals` (used by DEPLOY and the prompt) is missing from the 25 pages. `verify:synthetic` runs on dev or the simulation branch, not on the production data being photographed.

**06-AGEING.md** (149, Sep 22)
- Purpose: moving wave rows back in time (180/150/90/60/30/0 days) under the rule "past moves, future stays", with columns discovered from `information_schema` and a marker file.
- Claims: `verify:age` runs 8 checks. The marker refuses a second ageing before any UPDATE. `age` refuses production unless called through `on:production`. `verify:migrations` after each shift catches broken CHECKs.
- Stale or unsound: :40-43 says six billing periods will exist after ageing, but PROMPT:1019 says "nothing renews by itself", so no period invoices get generated. :45-47 ("fund E1 for three months of sessions") contradicts both 03 ($100 only) and the prompt (E2). Ageing does not move `current_period_end`, so a subscription's period can end up spanning 180+ days. DEPLOY:166 uses `--days 30` for wave 1, contradicting the 180 here.

**07-THE-EXAM.md** (213, Sep 22)
- Purpose: the copilot tests. Part 1 is progression on P3 at 1, 4 and 10 sessions plus recall R1-R4 and absence checks N1-N2. Part 2 is `copilot:exam`: depth, blind grader, controls, handover.
- Claims: the exam uses `askPatientCopilot` without `liveSince`. The live-session bound is `verify:sprint48` (invariant 11). The sample output shows a 0.81 correlation and "claim holds". This is illustrative, but it reads like a result.
- Stale: :23-30 places the progression in wave 2, wave 2 and wave 3. PROMPT:805-807 says wave 1, wave 2 and wave 4, which is impossible because P3 arrives in wave 2. The exam runs on production and writes new copilot threads into patient records ("fresh thread").

**08-THE-NUMBERS.md** (218, Sep 22)
- Purpose: what the run hands the plan. Covers physics, plan versus forecast, the beta-cliff numbers, the 4 unmeasurables and Measure and freeze.
- Claims: plan month-6 revenue $9,474, 75% gross margin, break-even in month 5, cash $7,526 from $20k. `verify:plan` asserts plan-over-forecast ordering and the third-seller control. `verify:finance` asserts churn and fees are never "measured" and that a forecast cannot set a price. `physics` exits non-zero at more than 25% divergence. `finance_benchmarks` is insert-only.
- Stale: :121-129 shows an output with "this run 3.0 copilot turns" and "-1%" as though already measured. Churn-label enforcement is attributed to `verify:finance` here (:165) but to `verify:plan` in 03:331.

**09-THE-EDGES.md** (170, Sep 18)
- Purpose: 48 money edge cases (CV1-12, RA1-12, PL1-10, RR1-14). Each is attached to a cast member and must be reported held or broke.
- Claims: 12 are held by `npm run verify:edges` with planted controls. The other 36 are gated by nothing. It documents the 4 sprint-76 defects.
- Stale: CV6 :70 calls E2-HR "new to the cast" although she has been in 01 since wave 3. RR1 :125 and RA6 :92 use a 570 EGP figure, which equals no session price (sessions are 1,140 EGP). CV9 :73 "ask HR" copy is contradicted by the prompt. RR5 :129 (trial is the clinician's, once) versus 03:173 (once per organisation).

**10-THE-STORY.md** (352, Sep 18)
- Purpose: arcs and planted facts per patient, the relationship map, clinician timelines, the arrival table, the flow inventory and what is not simulated.
- Claims: every exam answer is planted. Seven "absence" connections are tested.
- Stale or contradictory: :3 says "other ten files". :182 says "Dr Amira moves to Nile Practice" in month 4, but :42 has her joining in month 1. :56 and :183 describe the "Account on hold" screen, which does not exist. :258 puts T5's upgrade in month 5, while 01:222 and 03:245 say wave 4. :100 says E3 covers Nadia from month 4, while 01:172 says wave 3. :266 says the seed creates "the operator", while 01:88 says all 7. :273 says wave 1 has only OP seeded, while 01:82 says 13 people including all 7 staff. :350 says sessions never exceed 8 minutes, but 11 L1 is 50 minutes. :352 says every address is at example.com, which the demo logins contradict.

**11-THE-RECORD.md** (221, Sep 18)
- Purpose: record-access walks R1-R9 (claim, unclaimed profile, grant, cross-clinician read, citations, a single thread, revocation, retained notes, invite-to-paid) and L1-L3 (the 50-minute session, `/admin/usage/sessions`, manual attribution).
- Claims: C107 notifies the patient on every grant. C115 serves the avatar through a route. On revocation the diagnosis write is refused and document URLs die. `verify:principals` covers 174 entry points. `verify:profile` plants a second-practice clinician.
- Stale: :3 says "Eleven walks" but there are 12, the exact drift 00-LESSONS:93 says was fixed. R1 :35 has Layla claim her record in wave 2, while 01 and 02 say wave 1. R9 :142 pairs T1 with P7, while 10:95 says P7 only sees T6. L1 contradicts the two-cluster design and the budget.

**12-THE-LOGINS.md** (148, Sep 22, "generated by `npm run logins`")
- Purpose: sign-in for all 27 people, 6 principal doors and the payroll roles.
- Claims: the header says production was wiped by `seed:demo` on 2026-09-20. The snapshot `br-nameless-dust-a6ae5e4r` holds the old state. `docs/DEMO-LOGINS.md` is what opens production today. `verify:cast` checks that passwords work and fails if P6 has an account.
- Contradiction: :143 says "26 accounts must open with the password", but :46 says patients use a one-time code, not the password.

**13-THE-AUDIO.md** (120, Sep 22)
- Purpose: where the audio comes from. Scripts from 10 are synthesised with `gpt-4o-mini-tts` (as in `evals/suites/speech.ts`) and fed through the session-scoped bearer-token door on `/api/sessions/[id]/transcribe`.
- Claims: the bearer door is audited through `recordIngestUse` and is rate limited. C209 means no AI fee on declined recording. Synthesis costs roughly $4-5 and is invisible to `spend`. C35 has the diariser decline to guess.
- Stale: :8 says "other twelve documents". :74 refers to a "step 2 checkpoint", which exists in the prompt's numbering but not 00-START's. :95 says `physics` "refuses to fit without" L1, which contradicts the two-cluster design (00-START, 08).

**14-THE-REHEARSAL.md** (192, Sep 22)
- Purpose: the dev-branch rehearsal report. F1-F9, 32/33 steps OK, 5 obstacles, verdict Go.
- Claims: F5 raised an EGP 4,000 bill with nothing granted. F6 and F7 created held rows. 35 gates pass. Production is at 112. The copilot is capped at 4 on production only, and `settings:compare` explains that difference.
- Stale: :152 says "All 35 gates pass" but :167-168 shows "all 28 pass". :100 says "Nine clinicians walk this in wave 1", but wave 1 has 4 and the whole cast has 7. :189-192 says "do not run simulate:seed" and "7 of 26 sign in", both overtaken by the wipe.

**DEPLOY.md** (308, Sep 22)
- Purpose: production order of operations (baseline, flag, Resend off, seed, run, capture, verify:cast, read, rotate), the domain and host rules, and the simulation branch.
- Claims: Neon branch `br-curly-dream-a6b0shlz` with endpoint `ep-wild-lake-a6tgm2r6`. Baseline of 118 tables and 195 rows (2026-09-17). Snapshot `snap-old-sea-a60wgj3s`. `notify()` logs to `delivery_attempts` (migration 0109). The apex must serve and not redirect, or cron loses its Authorization header. `writesTo()` is shut and "three ask". Nothing hardcodes the host (`verify:sprint31`).
- Stale: :47 and :108 mention "nine invented clinicians" and "sixty invented patients", while the cast has 7 and 7. :166 uses `age --days 30` for wave 1 where 180 is required. :132-154 says the seed already ran, which the wipe overtook. :267 says 12-THE-LOGINS "hands out passwords directly", but patients use codes. :19-22 says there are "exactly five deltas".

**SIMULATION-PROMPT.md** (1027)
- Purpose: the paste-in prompt. Covers key placeholders, the production state table, a step-by-step cold start, the built tooling inventory and the list of things the product does not do.
- Claims: 35 gates run on dev. `entitlement` and `actuals` gates write and refuse production. `verify:board` has 16 checks, `verify:entitlement` 13, `verify:plan` 36 and `verify:finance` 30. There is no auto-renewal cron. The offer is applied manually. There is no "account on hold" screen. Therapists set their own price between $5 and $500.
- Stale or contradictory: :3 says "THIS IS THE ONLY FILE", but :228 says to read "twelve files" and then lists 15. :36 and :527 say "seven fixed points" where 00-START has 8. :540 says "Three things" where 00-START has 4. :966 is headed "five rules" and lists 7. Rule 4 (:971) says every agent signs up with an email and password, contradicting :49 (patients have no email). :469 says 122 tables, while DEPLOY's 118 plus 2 would be 120. :18 says AUTH_SECRET is "64 hex", :92 "32 random". :558 says "add one line DATABASE_URL_PRODUCTION", which is already in the 12-line block. :805 has the wrong progression waves.

---

## 2. Every edge code in 09-THE-EDGES.md

"Enforcer" means what the docs claim holds it. "Gate" means it appears in the 09:162 `verify:edges` list. The VS column gives the value statement that cites the code, or else the demo position (VALUE-STATEMENTS.md:211-217) that lists it.

| Code | Edge | Claimed enforcer | Cited by |
|---|---|---|---|
| CV1 | Covered employee charged twice: the pot pays 10% and the patient must be asked for 90% plus VAT on the 90% | Gate `verify:edges`. Found sprint 76 | position `money` only |
| CV2 | Payment screen figure equals the checkout or transfer figure to the cent, in both currencies | Gate | position `money` only |
| CV3 | After confirmation the ledger holds a `vat_payable` leg on her share plus a cash leg | none (read off `/admin/vault`). The sprint-76 `session_payments` one-row conflict | none |
| CV4 | VAT on a part payment is 14% of her share, never of the full price, never zero | Gate | position `money` only |
| CV5 | A fully covered patient sees no payment screen at all | Gate | none |
| CV6 | Coverage at 0% is not removal: badge and roster kept, full price owed, notice period applies | Gate. C345 | **E4** |
| CV7 | Coverage lowered after booking: the booked session keeps the old share | Gate | **E3** |
| CV8 | Coverage raised after booking: needs no notice period | none | none |
| CV9 | Pot empties mid-week: the booked session keeps coverage, the next gets the ordinary link, the screen says "ask HR" | Gate (the gate proves the pot refuses; the "ask HR" screen is unverified, and PROMPT:1020 says it does not exist) | **E5** |
| CV10 | Two employers at once: exactly one pot pays, the rule is deterministic, neither learns of the other | none. Flagged the worst defect, stop-the-run | none |
| CV11 | `/admin/sponsors/<id>` lists pot spend per session with no patient name | Gate. Stop-the-run rule 3 | position `money` (substance overlaps E1) |
| CV12 | Clinician is paid on the full price of a half-covered session | Gate | position `money` only |
| RA1 | Paid and closed the tab: the `awaiting_proof` row persists, a red bar is shown, finish later | `awaiting_proof` row, portal red bar | position `live` only |
| RA2 | Payer presses "Cancel this payment": cart clears, bar goes, invoices stay due | none ("New in 76.34, nothing has exercised it") | position `crisis` only |
| RA3 | Confirmed twice: no second money movement, settlement or ledger leg | Gate | **A2** |
| RA4 | Rejection with the operator's own sentence, read verbatim by the payer | 04: "Reject and tell them" disabled under 10 characters | **A3** |
| RA5 | Rejected twice: the second rejection asks for fresh evidence | none | position `crisis` only |
| RA6 | Overpayment (1,000 against 570): the surplus is a line to decide, never silently kept | none | **A4** |
| RA7 | Underpayment: covered invoices settle oldest first, the rest stay due, the screen says which | 04:80 says transfers "stop rather than part paying" (conflicts) | position `money` only |
| RA8 | Unmatched bank line appears in `/admin/transfers` open carts as work | none | **A4** |
| RA9 | Part payment of a chosen 4 of 11 invoices, total summed from what was found | none | position `money` only |
| RA10 | Sheet opened twice: one open payment, one amount | none | position `live` only |
| RA11 | Uploaded receipt shown back an hour later, not an empty form | none | position `live` only |
| RA12 | Confirmed after the session ended: money still settles, the session is unchanged | none | none |
| PL1 | Tier card selects first; the panel explains figure, fee, cancellation and rail before any spend button | none ("New in 76.34") | none |
| PL2 | "Confirm and pay" raises the bill and opens the sheet in one act | none | none |
| PL3 | Metered until an operator confirms; the next session in the gap bills metered | `verify:entitlement` (PROMPT:959) | none |
| PL4 | Full-price invoice with no discount line | none (discounts applied by hand, PROMPT:1018) | none |
| PL5 | Lapse demotes nobody: `lapseOverdue` marks it lapsed and `entitledTier` returns metered | `lapseOverdue`, `entitledTier`, billing cron, `verify:entitlement` | none |
| PL6 | Seat leaves mid-month: next bill lower by exactly one seat, clinician lands on metered | none in 09 (`verify:entitlement` covers "mid month seat change" per PROMPT:959) | **C4** |
| PL7 | Seat added mid-month: the prorated quote shown first is exactly what is billed | `verify:entitlement` | position `growth` only |
| PL8 | Cancel keeps the paid month; the screen gives the date | none | none |
| PL9 | Declining the plan: panel shows the AI fee, "Not now" adds nothing to the cart | none | none |
| PL10 | Bill paid twice: the second transfer settles nothing and shows as unclaimed money | none | none |
| RR1 | Rate edited between quote and transfer: owed amount stays as quoted | rate stored on the payment (04:93) | none |
| RR2 | Free session: no payment screen, cart, bar or invoice; the room opens | Gate | position `continuity` only |
| RR3 | Cancelled after the pot paid: share returns on frozen figures | none | none |
| RR4 | Crisis with an unpaid session: SOS works, nothing about money in between (C235) | none. Stop-the-run | position `crisis` (substance = **P5**, which cites C235 not RR4) |
| RR5 | First completed session free to the clinician once; the patient pays either way | `chargeForSession` / `trialSessionUsed` (03:173) | none |
| RR6 | Patient paid, therapist no-show: where the money goes | none (open question) | none |
| RR7 | Employer pays for a leaver: funding stops for unbooked sessions only | none | none |
| RR8 | Pot expiry: what happens on the date and whether HR was warned | none | none |
| RR9 | Two bookings race a nearly empty pot: exactly one funded, never overdrawn | C382 "the guard is the debit" | position `growth` only |
| RR10 | Held earnings netted against the bill, both halves visible | none | (substance = **T3**, not cited) |
| RR11 | Payout method can be set before any money is held | none ("New in 76.34") | none |
| RR12 | Wrong country corrected: Stripe box disappears before save, owed amount unchanged | none ("New in 76.34") | none |
| RR13 | Refund after part payment apportioned on the split shown | none | none |
| RR14 | Books balance: every transaction sums to zero; trial balance read on screen | Gate | none |

Tally: 48 codes. 12 are gated. Statements cite 8 codes: PL6, CV7, CV6, CV9, RA3, RA4, RA6 and RA8. Of those, only CV6, CV7, CV9 and RA3 sit behind the gate. **C4 (PL6), A3 (RA4) and A4 (RA6, RA8) rest on edges no gate holds.** The other codes the brief lists (RR2, RR4, RA2, RA5, RR9, PL7, CV1, CV2, CV4, CV11, CV12, RA1, RA7, RA9, RA10, RA11) appear only in the positions table, not in any statement.

---

## 3. Every claim of enforcement

| Rule | Claimed enforcer | Doc |
|---|---|---|
| No document writes a production command without `on:production` | `npm run verify:runbook` | 00-START:345 |
| No archaeology outside 00-LESSONS | `verify:runbook` | 00-LESSONS:8 |
| Counts (gates, allow-list, cron jobs, edge count) derived from code | `verify:runbook` | 00-LESSONS:96 |
| No invented cron job names | `verify:runbook` reads the route's `JOBS` map | PROMPT:154 |
| Production reachable only by name | `writesTo()` refuses; `on:production` allow-list, one child process, prints endpoint and write flag | 00-START:78,280; DEPLOY:60-67; PROMPT:578 |
| Override only for writing entries | `on:production` sets `I_MEAN_PRODUCTION` per entry | PROMPT:579 |
| Only 3 callers may ask for production | `writesTo()` (61 callers before 76.52) | DEPLOY:61-65 |
| `verify:synthetic` refused on production | `on:production` refuses it by name | PROMPT:607 |
| Every person synthetic | `verify:synthetic` (information_schema surnames and emails, planted control) | 00-START:270; 05:76; DEPLOY:181 |
| Cast count equals `_cast.ts` | `scripts/verify-cast.ts` parses the "People" row | 01:29; 12:145 |
| Every account opens with its password; P6 never has one; patients looked up by phone | `verify:cast [--complete]` | 12:23,113; 14:74; DEPLOY:187 |
| Seed never runs twice | `simulate:seed` refuses (exit 1) | 00-LESSONS:130; DEPLOY:150; PROMPT:491 |
| Budget | `spend`: warns at 70%, exits non-zero past the budget, counts product spend only | 00-START:184 |
| Cost model needs two clusters | `lib/finance/physics.ts` refuses a single cluster | 00-START:176; 08:89; PROMPT:447 |
| Fit within 25% of the 50-minute benchmark | `physics` exits non-zero; `verify:physics` proves the instrument | 08:131; PROMPT:831 |
| Cost terms come from measurement | `lib/finance/scenarios.ts` reads `evals/physics.json` | 00-START:137 |
| Churn and payment fees never "measured"; forecast cannot set a price | `verify:finance` (30 checks, module graph) | 08:165,215; PROMPT:957 |
| Churn never measured; plan above forecast; third-seller control; break-even before month 6 | `verify:plan` (36 checks) | 03:331; 08:37,61; PROMPT:956 |
| Ageing moves past values and keeps future ones; marker refusal before any UPDATE | `age` script plus `verify:age` (8 checks) | 06:84-118 |
| `age` refuses production unless called through `on:production` | `age` script | 06:109 |
| CHECK constraints intact; journal and ledger at 112 | `verify:migrations` | 00-START:324; 06:123 |
| Per-network limit x25 under the flag, global ceiling unchanged | `verify:limits` | 00-LESSONS:31; 02:100; 14:59 |
| 12 money edges | `verify:edges` with planted controls | 09:39,159; VS A2 |
| Nothing granted before confirm; rail columns settable by screen | `verify:rail` | PROMPT:958; VS A1 |
| Transfer subscription grants nothing until confirm; lapse removes; seat change bills the quote | `verify:entitlement` (13) plus `entitlement` gate | PROMPT:650,959 |
| Board: 9 sections, none writes, due money not counted as collected | `on:production -- verify:board` (16) | PROMPT:960 |
| Wrong principal cannot reach a clinical module (174 entry points) | `verify:principals` | 11:215 |
| Second-practice clinician gets nothing | `verify:profile`, `copilotViewFor` | 11:220 |
| Copilot live-session bound | `verify:sprint48` (invariant 11) | 07:196 |
| URLs follow the serving host | `verify:sprint31`, `env.appUrl` | DEPLOY:278 |
| Gate leaves no `next-server` behind | `verify:served` (.next/served) | 00-LESSONS:148; PROMPT:640 |
| Settings equal across environments except the copilot cap | `settings:compare`, `environments` gate | 14:175; PROMPT:107 |
| Every public page renders | `renders` gate, `npm run smoke` | PROMPT:648,953 |
| Ledger and payroll arithmetic | `actuals` gate (writes, refuses production) | PROMPT:650 |
| Baseline row counts; `rate_limits` and `error_events` reported separately | `baseline -- check` | DEPLOY:225; PROMPT:619 |
| No card rail for Egypt | `topUpPot` refuses `entity='eg'`; `lib/billing/egypt.ts`; `collectionProblem` | 01:75; 03:146; 04:5; 10:347 |
| Egyptian payouts go to the manual queue | `payoutRailFor` | 03:147 |
| Rail on or off per customer | `sponsorNeedsTransfer`, `organizationNeedsTransfer` | 04:44; PROMPT:712 |
| Bank details locked while transfers are in flight | `detailsLockedBy` (counts `awaiting_proof` and `submitted`) | 04:51,159; PROMPT:1024 |
| Rejection needs a reason; no edit or reopen | Reject button disabled under 10 characters; no third button | 04:137-142 |
| Receipt reads audited | receipt route | 04:134; PROMPT:175 |
| Patient session unlocked by payment | `sessions.payment_status`, join gate | 04:62 |
| Therapist transfer settles invoices oldest first, no partial invoice | confirmation logic | 04:78 |
| Company VAT-inclusive, rest to `vat_payable` | pot credit logic | 04:118 |
| VAT on its own line, fee on the pre-tax price, 280 cents in `vat_payable` | `country_settings`, `session_payments.vat_cents` | 03:18,286; 04:95; 04 R8 |
| First session free to the therapist | `chargeForSession`, `trialSessionUsed`, `waived` invoice | 03:173 |
| Lapse returns the therapist to metered | `lapseOverdue` (one caller: GET `/api/cron/billing`), `entitledTier` | 01:200; 03:222; PROMPT:1021 |
| Cron auth | 401 on a bad secret, 404 `unknown_job` after auth, 405 on POST | PROMPT:150-157 |
| Crisis retry | `sweepUndeliveredAlerts` in the `crisis` cron | PROMPT:148 |
| Pot race | C382: the debit is the guard | 09:133 |
| Coverage reduction notice | C345 notice period, cannot be shortened | 09:70; 01:171 |
| Sponsor alert names nobody | C243 | 03:230 |
| Patient told on every grant, cannot opt out | C107 | 11:72 |
| Avatar not a public storage URL | C115, `/api/patient/avatar/<personId>` | 11:49 |
| Revoked clinician keeps own notes; journal, docs and others' notes hidden; diagnosis write refused; old document URL dies | §3 / record access (no file named) | 11:118-124 |
| Diariser declines to guess | C35, `lib/ai/diarise.ts` | 11:197; 13:103 |
| No AI fee when consent declined | C209 | 13:92 |
| Crisis never behind money | C235 | 09:128; VS P5 |
| Machine audio ingest | bearer token, `recordIngestUse` audit, rate limit; 8 s / 4 MB chunks | 13:33-43 |
| Messages never block; every attempt logged | `notify()` returns `{sent:false}`; `delivery_attempts` (0109) | DEPLOY:114-122 |
| Egypt crisis line | `lib/crisis/line.ts` (105, 1, 1) | 01:344 |
| Benchmark row never updated | `finance_benchmarks` insert-only | 08:176 |
| Indexing off during the run | `SIMULATION_RUNNING=1` gives robots `Disallow: /` and a violet strip | DEPLOY:99; 14:183 |
| Only `main` builds | Vercel Ignored Build Step | 00-LESSONS:114; DEPLOY:306; PROMPT:181 |
| Console page guards | `requireStaff()`, `requireManager()`, `requireRole("super_admin")` | 05:89-93 |
| Founder-only pages redirect staff | super_admin role | 02:141; 12:133 |
| Six principals | separate tables, cookies and guards | 12:50 |
| T4 second rejection deletes documents | "Reject and clear", `documents_cleared_at`, `rejection_count` | 01:129-131; 06:77 |
| Applying grants no console | held `organizations` / `sponsors` rows | 14:36; 00-LESSONS:65 |
| Seed copilot quota | set to 4 on production | 00-START:118; PROMPT:435 |

---

## 4. Commands, target database, flags

| Command | Target | Flag |
|---|---|---|
| `npm run on:production` | prints allow-list | none |
| `on:production -- verify:migrations` | prod, read | none |
| `on:production -- settings:show` | prod, read | none |
| `on:production -- spend -- --budget 10` | prod, read | expected "$0.0286" is stale after the wipe |
| `on:production -- baseline -- check` | prod, read | the "5 deltas" expectation is stale; seed:demo rewrote production |
| `on:production -- baseline -- record snap-old-sea-a60wgj3s` | prod, **write** | marked "Done" (DEPLOY:88). Rerunning would overwrite the before-mark: **dangerous** |
| `on:production -- verify:cast [-- --complete]` | prod, read | the "7 of 26" expectation is stale (reads red per 12:9) |
| `on:production -- simulate:seed` | prod, **write** | **Contradictory**: 01:52 says run it; 14:189, DEPLOY:150 and PROMPT:669 say never |
| `on:production -- seed:demo -- --scenario=<name>` | prod, **write, destructive** | VALUE-STATEMENTS:207. Per 12:7 it wiped production on 09-20: **dangerous** |
| `on:production -- verify:demo -- --scenario=<name>` | prod | none |
| `on:production -- age -- --marker waveN --start` / `--days N` / `--dry` | prod, **write** | Without the prefix it ages dev silently. DEPLOY:166 `--marker wave1 --days 30` is **wrong** (should be 180) |
| `on:production -- copilot:exam [-- --dry \| --json ...]` | prod, write (AI calls, copilot threads, ai_request_logs) | Spends money and writes threads into patient records |
| `on:production -- physics -- --at 50 [--json ...]` | prod, read | none |
| `on:production -- verify:physics` | prod | a verifier on production; docs say only that it is "free" |
| `on:production -- verify:board` | prod, claims no writes | a verifier on production |
| `on:production -- db:migrate` | prod, **write** | after a snapshot restore. H1: "prints success whatever happens" |
| Restore `snap-old-sea-a60wgj3s` | prod, **destructive** | also undoes migration 0111 (DEPLOY:24) |
| `curl -H "Authorization: Bearer $CRON_SECRET" https://24therapy.app/api/cron/reminders` | **live production job** | Sold as a "check" (PROMPT:593) but it actually runs the reminders cron on production: **dangerous-ish** |
| `curl ... /api/cron/billing` (GET) | live production job | intended in wave 4 (runs `lapseOverdue`) |
| `curl https://24therapy.app/robots.txt` | prod, read | none |
| `rm -rf .next && npm run build && npm run gates` | dev | the 35 gates write fixtures to dev (by design) |
| `npm run verify:age` | dev (plants a row) | none |
| `npm run verify:synthetic` | dev or "simulation branch" | Must not run on production, so it **never checks the production rows that the committed frames show**: a logic hole |
| `npm run evals -- --record` | OpenAI, about $2 | pushes total spend past $10 once synthesis is counted |
| `npm run plan`, `plan -- beta-cliff`, `forecast` | local | none |
| `npm run verify:plan`, `verify:finance`, `verify:rail`, `verify:entitlement`, `verify:runbook`, `smoke`, `settings:compare`, `probe`, `screens:prep`, `logins` | dev / local | none |
| Write `.env.local` with the prod Neon owner password (PROMPT:95-101) | credentials | User must paste the `neondb_owner` password for prod, dev and simulation into a chat (the same role everywhere): **risky** |
| `STRIPE_SECRET_KEY` | stop if `sk_live_` | none |

---

## 5. Stale or contradictory (file:line)

1. **Production state.** 12:5-15 (wiped 2026-09-20) contradicts PROMPT:461-521, 00-START:324-327, DEPLOY:132-154, 14:170-192 and 00-LESSONS:120-137 (seeded, 9 users, 5 deltas, 7 of 26).
2. **Which pot drains.** E1 in 01:215, 03:228-237, 05:160, 06:44-47, 09:73,133 and 10:56,98. E2 in PROMPT:911-923. E1 is also funded by transfer in 04:151 (R2) and PROMPT:920, which PROMPT:918 says makes it unable to empty.
3. **"Account on hold, ask HR" screen.** Required by 01:215, 05:161, 09:73 (CV9), 10:56,183 and VS E5. Declared nonexistent by 03:239 and PROMPT:925,1020.
4. **Auto billing.** The month-4 invoice and "six billing periods" (03:219, 06:40) versus "Nothing renews by itself; no monthly cron" and "offer applied by hand" (PROMPT:1018-1019, 05:168).
5. **Free first session.** 03:32 and PROMPT:416 ("still bills $1 and $3") versus 03:173 (waived, both lines zeroed). Scope is "once per organisation" (03:173) versus "the clinician's, once" (09:129).
6. **Vault totals.** 03:116 (must equal, stop) versus PROMPT:1023 (need not equal).
7. **/admin/usage as acceptance.** 03:118 and 05:108 versus PROMPT:1022 (30-day window, only wave 6).
8. **50-minute session L1.** 11:162 and PROMPT:348 versus 10:350 ("no sessions longer than eight minutes") and the budget tables. 13:95 says physics "refuses without" L1 versus 00-START:174 and 08:87 (two clusters of 3 and 8 minutes suffice).
9. **Progression waves.** 07:26-30 (w2, w2, w3) versus PROMPT:805-807 (w1, w2, w4, impossible).
10. **Seed.** 01:52 ("run it anyway") versus 14:189, DEPLOY:150 and PROMPT:669 ("do not"). Refusal text 01:53 versus 00-LESSONS:132. The seed creates one operator (01:44, 10:266) or all 7 (01:88, DEPLOY:136).
11. **Counts.** Document count: 00-START:211 "twelve", 10:3 "ten", 13:8 "twelve", PROMPT:228 "twelve" then "fifteen" (:248), and 17 on disk. Walks: 11:3 and PROMPT:338,343 say "eleven", but there are 12 (00-LESSONS:93 claims this was fixed). Gates: 14:152 "35" versus 14:167 "28". Report points: 00-START (8) versus PROMPT:36,221,527 (7). Immediate alerts: 00-START:372 "Three" lists 4. PROMPT "five rules" lists 7 (:964-990). 04:146 "eight things" lists R1-R9. Clinicians: DEPLOY:47 and PROMPT:304 "nine", 14:100 "nine in wave 1", versus 7. DEPLOY:108 and PROMPT:515 "sixty patients" versus 7. Tables: PROMPT:469 says 122, but 118 + 2 = 120.
12. **Patient credentials.** Patients use phone and code (01:61, 12:38, 14:61) versus PROMPT:971 rule 4 (email and one password for every agent) and 12:143 / DEPLOY:189 (26 accounts open "with the password").
13. **Synthetic rule.** 00-START:263, 10:352 and PROMPT:969 ("every address at example.com") versus VALUE-STATEMENTS:257-268 (24therapy.app and 3 gmail inboxes on production today).
14. **Ageing.** DEPLOY:166 `--days 30` versus 06:96 and PROMPT:781 `--days 180`.
15. **Timeline slips.** T1 joins Nile in month 1 (10:42) but in month 4 (10:182). T5 upgrade in wave 4 (01:222, 03:245) versus month 5 (10:258). E3 hires P5 in wave 3 (01:172) versus month 4 (10:100). Layla claims in wave 1 (01:110, 02:29) versus wave 2 (11:35). P7's clinician is T6 (10:95) versus T1 (11:142). E2-HR "new to the cast" in wave 5 (09:70) versus present since wave 3 (01:171).
16. **Board guard.** tv is super_admin (02:141, 12:133 "the board") versus `requireManager()` (05:92, PROMPT:870).
17. **Crisis line.** "Filled in" on settings (05:119) versus `country_settings` null by design (01:341).
18. **Bank details.** Typed by the operator on camera (02:194, 04:47, 10:330) versus placeholders already filled and only read back (DEPLOY:210, PROMPT:513, 01:94).
19. **Partial transfers.** 04:80 (stop rather than part-pay) versus RA7 and RA9.
20. **570 EGP.** 09:92,125 uses it as a bill or session quote, but the session is 1,140 EGP (03:18).
21. **One dev server.** 02:36,427 describe a single dev server, but the run is on production.
22. **Budget.** "$4.80 planned, $5.20 left" (00-START:130, PROMPT:433) with synthesis of $4-5 (13:60) plus evals at $2 exceeds $10. The prompt concedes this at :436 but keeps the "left over" line.
23. **AUTH_SECRET.** "64 hex" (PROMPT:18) versus "32+" (PROMPT:92,121).
24. **verify:runbook is not doing what it claims.** Archaeology outside 00-LESSONS (01:88 "until 76.55", 05:65 C80, 12:117, 14:154 "until 76.61", DEPLOY:106 "the earlier version said"), plus the count drift in item 11 and the bare `--days 30` value. Either the gate does not check these or it was never run on these files.
25. **Stale sample output presented as data.** 07:146-155 (correlation 0.81, "claim holds") and 08:121-129 ("this run 3.0 turns", "-1%").
26. **Verifier ownership.** Churn labelling is `verify:plan` in 03:331 but `verify:finance` in 08:165.

---

## 6. Capabilities described but covered by none of the 25 value statements

- **Clinician verification**: the T4 rejection cycle (reason read verbatim, "Reject and clear", document deletion, an invited-but-unlicensed clinician gated) and the `/admin/verifications` queue.
- **Partner/API principal** (D1 Helio Health): keys, scopes, rate limit, sessions opened by API, notes returned, cannot reach patients it did not bring, `/partner`.
- **Radar with no account**: finding a clinician at night with no account and claiming the record later (R1). P1 covers taps only.
- **Unclaimed profile usefulness** (R2), claim links, patient-owned avatar (C115).
- **History request** from a previous therapist; access request and approve flow with a mandatory notice (C107).
- **Revocation specifics** (R7/R8): diagnosis write refused, document URL dies, the revoked clinician keeps their own notes. T5 touches the copilot only.
- **Copilot single thread per patient** (R6); exam-grade refusal of unknowns (no invented medication or diagnosis); handover brief.
- **Recording consent and decline**, with no AI fee on decline (C209); consent withdrawn mid-session; minimise to orb.
- **Transcript attribution UI** (you / them / not sure) and the diariser declining (C35, L3).
- **Journals, documents, steps, rating a session, full record export**; asking for the record as a file.
- **Arabic**: an Arabic switch on every portal, RTL, the Egypt crisis line 105/1/1 in Arabic. P5 covers SOS reachability, not the number or language.
- **Metered pricing** ($1 room, $3 note), the offer schedule (free, 50%, full), post-beta offer, no grandfathering, subscription by transfer, lapse to metered, cancel keeps the month, plan details before paying (PL1-PL5, PL8-PL10).
- **VAT handling** (1,140 EGP, `vat_payable`, fee on pre-tax price, VAT-inclusive pot top-ups). CV3 and CV4 are uncited.
- **Exchange rate as an operator setting**, frozen on the payment (RR1).
- **Transfer detail lock** (`detailsLockedBy`), payer-specific headings, waiting screen that polls, reference or receipt required, cancel-a-payment (RA2), claim persistence (RA1, RA11), no duplicate claims (RA10).
- **Manual payouts** for Egyptian clinicians, and a payout method before any money is held (RR11). T3 covers netting only.
- **Clinic internals**: delegated staff powers (C1-S), a manager cannot reach a note (partly C2), no suspend control, seat-add proration quote (PL7), T1 joining with a live subscription (no double bill), patients follow the clinician while notes stay with the practice.
- **Employer**: enrolment by staff number (refused) or work-email code, coverage slider with a session estimate, Edit-first, unshortenable notice period (C345), re-check pausing funding, two-employer exclusivity (CV10), leaver funding (RR7), pot expiry (RR8), refund to pot on frozen figures (RR3), $100 welcome credit below the $5,000 floor, C382 race guard (RR9).
- **Refunds after part payment** (RR13); no-show paid session (RR6); first-session trial for the clinician (RR5); country correction (RR12).
- **Founder tooling**: `/admin/tv` (9 sections, "watching TV"), `/admin/vault`, `/admin/usage/sessions` spread, `/admin/financial-model` with Measure and freeze (`finance_benchmarks`), `/admin/actuals` with payroll and runway, back-office account creation on `/admin/settings`, content/strings/taxonomy/announce CMS, errors page, check-ins, ratings.
- **Invite from profile to paid session at the clinician's own rate**, refusal for a walk-in with no contact (R9). T4 covers join-link identity only.
- **Delivery audit** (`delivery_attempts`), `notify()` never blocking, links shown on screen when no channel exists. P2 is in-app notices only.
- **Platform ops**: per-network rate limiting, the `SIMULATION_RUNNING` banner and noindex, the crisis alert retry cron, the apex-host / cron-auth rule, EHR/SMART redirect, Stripe direct and held rails for non-Egyptian clinicians.
