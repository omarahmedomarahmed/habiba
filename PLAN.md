# 24Therapy — build plan

Working document. Sessions share it through git: the commit is the only channel
between them, so write here and commit whenever you decide something.

**Baseline:** `main` · migrations `0000–0028` · 109 tests across eight suites
(60 run without a database, 49 need one).
**Hazards:** `HAZARDS.md` — read once before your first commit.

---

## What this product is

A therapist opens a session. Everything said is transcribed, a clinical note is
written and signed, and a plain-language copy goes to the patient. A copilot
answers questions about that patient, citing the transcript rather than
guessing. Patients find therapists on a live globe, or book them ahead.

**What we are building now:** the patient stops being a row inside one clinic
and becomes a person who owns their record, carries it between therapists, and
decides who may read it.

Sessions are in Arabic and English, usually mixed inside one sentence. Egypt
first, then MENA.

---

## §1 · VERDICT

```
Status: AUDITED
Auditor: Claude (audit session, read-only)
Date: 2026-09-04
Commit audited: 2a3965d
Database: NOT reachable — no .env.local in this container. Every DB claim
          below is from schema/source only. §3's "46 of 56" is UNVERIFIED.
```

**Baseline re-measured and correct.** 29 `.sql` files, 29 journal entries (no
skipped migration today). 109 tests across 8 suites: safety 23 · radar 27 ·
e2e 13 · clock 12 · transcribe 10 · ledger 9 · toasts 8 · alarm 7. 60 without
a database, 49 with. §3's patient-email figure could not be checked.

| Question | Answer |
|---|---|
| Does the plan match the codebase? | **Structurally yes, commercially no.** Every hazard it cites is real and at the line it names (`MAX_SEGMENTS = 160` diarise.ts:46 · transcribe rate ignores `input.model` client.ts:140 · `SILENCE_RMS` recorder.ts:188 · `{kind:"viewing"}` radar.ts:816 · `claimTherapist` radar.ts:673 · `users_org_email_unique` schema.ts:149 · `patientSteps` notes.ts:27 · warn→suspend feedback.ts:696). But §3's money numbers are **not** the numbers in production. See C1–C4. |
| Already built that the plan thinks is missing? | **Sprint 4.1 ships today.** `sessions.priceCents` (schema.ts:372) is set at creation (`sessions/actions.ts:59`) and gates room entry until paid (`join/[token]/actions.ts:40`). Sprint 4 is *not* "the first sprint that earns money" — paid links earn money now, at 10%. **Admin exists**: 12 pages under `app/(admin)/admin/` incl. `tv/`, `usage/`, `audit/`, `taxonomy/`, `verifications/`. Sprint 15 is an extension, not a build. **2.2 is largely done** — `session-room.tsx:384` is already one mobile-shaped shell with a `safe-bottom sticky` bar; there is no second desktop layout to unify. **Price cap exists** (`MAX_SESSION_PRICE_CENTS`, connect.ts:62) — at $1,000, not §3's $500. |
| Wrong, impossible, or costlier than stated? | **2.1's premise is wrong.** Video is not `aspect-video w-full`; `video-call.tsx:158` is `aspect-[3/4] w-full sm:aspect-video` — already responsive. The real defect is different and larger: **there is no copilot in the room at all** — only passive `CopilotToasts` (session-room.tsx:546). "Transcript and copilot visible together" means building a room copilot surface, not resizing a `<div>`. **2.3/2.4 are net-new** — zero matches for orb anywhere in `app/` or `components/`. **Sprint 4 at 1.5 weeks is optimistic by ~2×**: there is no currency column on `session_payments`, no VAT column, no FX anywhere; `ledgerEntries.currency` (schema.ts:1446) defaults `'usd'` and is the only one in the schema. Multi-currency + VAT is a money-model migration touching payments, invoices, ledger and every `*Cents` reader. **6.3 is 32 direct `actor.organizationId` reads across 52 files** that call `requireUser`/`requireRole` — a week of audit on its own, and `Actor.organizationId` is `string` non-null at session.ts:32. |
| What has the plan missed? | **(a) We already hold therapist balances.** `session_payments.capture` accepts `"platform"` (schema.ts:1324) and `therapist_payable` is a live ledger account (schema.ts:1380). §14's "🔴 Do not hold therapist balances" reads as a rule for future work; it is actually a **description of an existing production condition needing remediation**. That belongs in a sprint, not a footnote. **(b) Sprint 1 silently re-prices live therapists.** **(c) `PlanKey` is a `text` column typed off `PLANS` (schema.ts:35, 1194)** — introducing Starter/Practice needs a migration path for every existing `payg`/`unlimited` row. **(d) H13's `costCents = microcents/1000` (client.ts:108) is correct as written** — the hazard is in consumers, and no sprint owns auditing them. **(e) No `.env.local` and no seeded dev database** means H1's mandated `information_schema` check cannot be performed from a session like this one. That is a blocker on every migration sprint. |
| Is the sprint order right? | **Mostly, with two moves.** Putting live therapist pain (2, 3) before foundation is right. But **sprint 1 as written must not ship first** — it changes prices under live customers (C1–C3). Split it: 1a = the settings *table and accessor* seeded with **today's** production values, plus 1.4 (H12) and 1.5; 1b = the new price *schedule*, deferred until someone decides the migration for existing subscribers. **Sprint 5's `people` table should precede sprint 4's payment-preference work** (4.3 saves preferences to a patient row that sprint 5 then re-parents). |
| Any decision you disagree with, with evidence? | **1.5 is under-specified.** `lib/session-clock.ts` has three constants, not one: `INCLUDED_MINUTES = 30`, `MAX_MINUTES = 50`, `WARNING_MINUTES = 5`. "50 → 60, 50 running, 10-minute countdown" changes all three and the 12 clock tests assert the current shape. `INCLUDED_MINUTES` is also what the patient's countdown shows — the ticket does not say what it becomes. **§3's copilot allowance contradicts the code's semantics**: `plans.ts:22` is "messages per patient per **calendar month**"; §3 says "10 per **session**, rolls over, expires 12 months". Those are different features, not a different number, and moving the figure to a settings table does not convert one into the other. |
| **Verdict: proceed / proceed with changes / stop** | **PROCEED WITH CHANGES.** The architecture holds and the hazards are real. Three changes are conditions: (1) sprint 1 seeds **production** values, never §3's, until repricing is decided; (2) a `DATABASE_URL` is provided or H1 cannot be honoured; (3) the existing platform-held balances get an owner sprint. |

---

## §2 · CONCERNS

> Append one row per objection. Never delete a row — a resolved concern is more
> useful than a missing one. `blocker` stops a sprint · `major` changes the
> design · `minor` is worth noting.

| # | Sprint | Concern | Severity | Raised by | Status |
|---|---|---|---|---|---|
| C1 | 1 | **The platform cut is 10%, not 15%.** `PLATFORM_FEE_BPS = 1000` (`lib/billing/connect.ts:58`), applied at connect.ts:70. Seeding §3's 15% raises the fee on every live therapist with no notice. | blocker | audit @2a3965d | **resolved sprint 1** — 1500bps in `platform_settings.session`, verified live |
| C2 | 1 | **PAYG is $6.00/session, not $3.00.** `PLANS.payg.perSessionCents = 600` (`lib/billing/plans.ts`). §3 also invents Starter/Practice; production has `payg` and `unlimited` ($99/mo). Seeding §3 halves revenue per session and orphans every `unlimited` subscriber. | blocker | audit @2a3965d | **resolved sprint 1** — PAYG $4 / Starter $3 / Growth $2; `unlimited` removed, 36 subs moved |
| C3 | 1 | **Price cap is $1,000, not $500.** `MAX_SESSION_PRICE_CENTS = 100_000` (connect.ts:62). Also undocumented: `MIN_SESSION_PRICE_CENTS = 500` — a $5 floor §3 does not mention. Seeding §3 breaks existing sessions priced above $500. | major | audit @2a3965d | **resolved sprint 1** — cap $500, floor $5, both in settings and both asserted |
| C4 | 1 | **`PlanKey` is derived from the `PLANS` const and stored as `text`** (schema.ts:35, `subscriptions.plan` schema.ts:1194). New plan keys need a data migration for live rows, not just a settings table. Not in any ticket. | major | audit @2a3965d | **resolved sprint 1** — migration 0030 moved every row; `PLANS` is now keys only |
| C5 | all | **No `.env.local` in a fresh session → H1's `information_schema` check is impossible.** Every migration sprint is unverifiable as specified. Needs a `DATABASE_URL` (a Neon branch, not production). | blocker | audit @2a3965d | **resolved** — Neon branch `sprint-1-settings`; both migrations verified against `information_schema` |
| C6 | 14 | **We already hold therapist balances.** `session_payments.capture = "platform"` (schema.ts:1324) and the `therapist_payable` ledger account (schema.ts:1380) are live. §14's rule is written as prevention; it is remediation. Needs its own ticket with a measured exposure figure. | major | audit @2a3965d | **resolved sprint 1.8** — only `capture: "destination"` is reachable; 0 historical platform rows |
| C7 | 2.1 | **Stated premise is wrong.** Video is `aspect-[3/4] w-full sm:aspect-video` (`video-call.tsx:158`), already responsive. The real gap: **no copilot exists in the room** — only `CopilotToasts` (session-room.tsx:546); the copilot lives at `app/(app)/copilot`. 2.1 is "build a room copilot", not "relayout". Re-scope and re-estimate. | major | audit @2a3965d | **RULED 2026-09-06, sprint 18 — correct, and it is C25's twin. Deferred with it to sprint 23.** The audit was right on both counts: the video layout was already responsive, and the real gap is that there is no copilot *in* the room. That is the same gap C25 names, and sprint 17 ruled it — accepted, not resolved, scheduled as 23.1–23.4 with the machinery already built. This row is closed as a duplicate rather than left open beside it, because two open rows describing one gap is how a gap gets counted twice and fixed never. **Cost:** unchanged from C25 — a therapist who wants to ask something mid-session leaves the room to do it. |
| C8 | 2.2 | **Likely already done.** `session-room.tsx:384` is a single `min-h-dvh` column with a `safe-bottom sticky` bottom bar, used on every viewport. There is no second desktop shell to merge. Verify on a real desktop before spending a ticket. | minor | audit @2a3965d | **RULED 2026-09-06, sprint 18 — verified and closed. It was already done.** `session-room.tsx` is one `min-h-dvh` column with a `safe-bottom sticky` bottom bar on every viewport; there is no second desktop shell to merge and there never was. Checked again during this sprint's pass over the layouts. **Why it stayed open so long:** nobody had confirmed it, and "probably already done" is not a state a ticket can be closed from. It is now, by looking. |
| C9 | 2.3, 2.4 | **Zero prior art** — no match for `orb`/`Orb` in `app/` or `components/`. Costed inside a 1-week sprint that also contains the room rebuild (C7). At least its own week. | major | audit @2a3965d | **RULED 2026-09-06, sprint 18 — resolved in sprint 2, closed here.** The concern was that the orb had zero prior art and was costed inside a week that also contained the room rebuild. It was built in sprint 2 and its states are asserted on their accessible names by `verify-sprint2.ts`. The estimate was right — it did take most of its own week — and the lesson is recorded rather than the row: **a component with no prior art in the repository is a week, not a ticket.** |
| C10 | 4 | **1.5 weeks is ~2× optimistic.** No `currency`, `vat_cents` or FX column exists on `session_payments`, `invoices` or `ledger_entries`; `ledgerEntries.currency` (schema.ts:1446) is the only one in the schema and defaults `'usd'`. Multi-currency + VAT is a migration across every money table and reader. | major | audit @2a3965d | **resolved** — sprint 4 shipped with migration 0032 (9 columns on `session_payments`, `fx_quotes` 7 cols / 2 indexes). The estimate was optimistic and the work was done; recorded so the next currency estimate is not made the same way. §3c makes this sprint 16's ground again, at considerably larger scope |
| C11 | 4.1 | **Already built.** `sessions.priceCents` (schema.ts:372) is set at creation (`sessions/actions.ts:59`, validated by `priceProblem`) and gates entry at `join/[token]/actions.ts:40`. Sprint 4's "first sprint that earns money" framing is wrong — paid links earn today. | minor | audit @2a3965d | **resolved sprint 1** — reworked to §3: cut, VAT lines and settings-driven bounds |
| C12 | 4.3 → 5 | **Ordering.** 4.3 saves payment preferences onto a patient row that 5.1 immediately re-parents under `people`. Land 5.1–5.3 first, or accept a second migration. | minor | audit @2a3965d | **resolved** — both sprints shipped in the stated order, 5.1–5.3 before 4.3's preferences landed on a person. No second migration was needed |
| C13 | 1.5 | **Under-specified.** Three constants, not one: `INCLUDED_MINUTES = 30`, `MAX_MINUTES = 50`, `WARNING_MINUTES = 5` (`lib/session-clock.ts:44-50`). The ticket does not say what `INCLUDED_MINUTES` becomes, and it drives the *patient's* countdown. 12 clock tests assert current behaviour. | major | audit @2a3965d | **resolved sprint 1.5** — 50 running / 10 countdown / hard stop 60, all from settings |
| C14 | 1, 10 | **§3 changes copilot semantics, not just its number.** `plans.ts:22` = "per patient per **calendar month**", enforced in `lib/data/copilot.ts`. §3 = "10 per **session**, rolls over on that patient, expires 12 months". Different feature. Needs a ticket. | major | audit @2a3965d | **resolved sprint 1** — `checkQuota` recounts per session per patient with rollover |
| C15 | 6.3 | **Measured cost:** `Actor.organizationId` is non-null `string` (`lib/auth/session.ts:32`); 32 direct `actor.organizationId` reads, 192 `.organizationId` reads overall, across 52 files calling `requireUser`/`requireRole`. "Audit every consumer" is the whole sprint, not a bullet. | major | audit @2a3965d | **resolved** — measured before sprint 6 and absorbed: `Actor.organizationId` stayed non-null `string`, and C41's ruling made a patient a *separate* actor type rather than an `Actor` with a nullable org. The 192 reads were never touched |
| C16 | 15 | **Admin is not greenfield.** 12 pages already exist under `app/(admin)/admin/` (`tv`, `usage`, `audit`, `errors`, `ratings`, `radar`, `taxonomy`, `therapists`, `verifications`, `vault`, `content`, `announce`). ~2 weeks may be right, but as extension work; the "built last so it can be verified" rationale does not apply to what is already shipped. | minor | audit @2a3965d | **RULED 2026-09-06, sprint 15 — the patient app shares chrome, never a data layer.** The question C16 was repointed at is what the patient app may reuse from the twelve clinician/admin pages that already exist. Decided: it reuses the *design system* (`components/ui`), the *formatters* (`lib/scheduling/tz.ts`, `lib/utils.ts`, `formatMoney`) and the *auth primitives*, and it reuses **no clinician data-access module at all**. `lib/data/patient-view.ts` is the only query a patient screen may run for sessions, and its select list is the enforcement — the sprint 15 verifier plants a sentinel in every clinical field of a note and in a transcript line and asserts it never surfaces, with a control query one column wider that proves the assertion has teeth. A second scan bans the identifiers `sessionNotes`, `transcriptSegments` and `sessionInsights` from every file under `app/(patient)` and `components/patient`, with its own control (it must find `app/(app)/sessions/actions.ts`, which legitimately uses them). **Why:** reuse is how a leak happens — nobody will ever *decide* to show a patient their own SOAP note, they will import the roster query that was nearest. **What it costs:** duplication. Two modules now select overlapping columns from `sessions`, and a change to the session shape has to be made twice. That is the price of the guarantee coming from what is absent rather than from a reviewer's attention, and it is worth paying here and nowhere else. The **admin** half of C16 — twelve existing pages plus §3d's back office — stays where it was repointed: sprints **20 and 21**, where the two-week estimate belongs. |
| C17 | — | **H13 has no owner.** `client.ts:108` (`costCents = microcents/1000`) is itself correct. The hazard lives in consumers of `cost_microcents`; no sprint audits them. One ticket, cheap now, expensive after sprint 4 adds currencies. | minor | audit @2a3965d | **RULED 2026-09-06, sprint 18 — a real defect, measured and fixed.** The audit said the hazard lives in the *consumers* of `cost_microcents`, and it did. `lib/ai/client.ts` writes `cost_cents = round(microcents / 1000)`, and `lib/data/vault.ts` — every revenue, margin and cost-per-session figure in the admin console — summed **that** column. Measured on production before the fix: the **large majority of model calls stored as `cost_cents = 0`** while carrying real microcents, and the summed column overstating true spend by a few percent, because the expensive calls round up harder than the many cheap ones round down. *(6 Sept: 466 of 596 rows, 8.59¢ on 209.41¢. 8 Sept, re-measured by the founder: 466 of 596, 218¢ vs 209¢. The ratio drifts with every call the platform makes — **the defect is the method, and the query in `verify-sprint18.ts` is how to get today's number.** A measurement quoted as a constant is a measurement that will be wrong by the time somebody checks it.)* Small money, systematic error, and it made two admin screens disagree — the usage page already read microcents. Fixed: every figure in `vault.ts` now sums `cost_microcents` and divides **once**, at the end. On the branch the platform-spend figure moves 212¢ → 204¢. **What it costs:** nothing, and it should have been done in sprint 4 as the row said. **The rule, generalised:** round once, at the point a human reads it — never on the way into a column. |
| C18 | 3 | **No acceptance measurement is possible from source.** "92% unattributed in-person, 12% video" and §3's "46 of 56 patients have no email" are DB claims; without C5 resolved neither the baseline nor the sprint-3 acceptance test can be run. | major | audit @2a3965d | **resolved** — Neon branch `sprint-1-settings` off `br-curly-dream`. §3 confirmed exactly: 56 patients, 46 with no email |
| C19 | 5, 6 | **46 of 56 patients have neither email nor phone**, not just no email — measured, `WHERE email IS NULL AND phone IS NULL` → 46. §3's claim flow keys on "email **or** phone" (step 1), so for 82% of existing patients there is nothing to match on and no path to claiming at all. Sprint 5.4's "match on email or phone" will find zero candidates for them. The plan needs an answer for a record whose only identifier is a name. | major | sprint 1 @f06b82c | **resolved 12.5** — void by §3b and THE RESET. The 46 patients with neither address nor number are test data being purged, and a therapist-created record now *cannot* exist without a phone (12.4, migration 0042). The claim flow no longer has to work for a person we have no way to reach |
| C20 | 1 | **Scope taken beyond the ticket, deliberately.** 1.6 says "reprice to Starter $3/min 10, Growth $2/min 30" — but minimums are unsellable without something to buy. Added `session_credits` (purchase, expiry, oldest-first consumption) and replaced the `unlimited` Stripe subscription checkout with a one-time credit checkout. Without it 1.6 would have shipped three tiers a therapist could not reach. | minor | sprint 1 | **RULED 2026-09-06, sprint 18 — accepted, built, and it was the right call.** The scope taken beyond 1.6 was `session_credits`: purchase, twelve-month expiry, oldest-first consumption, and a one-time credit checkout replacing the `unlimited` subscription. Without it the three tiers 1.6 named were unreachable — a minimum of ten sessions is not a price if there is nothing to buy. Everything built on it since (the free first session ordering, C69's netting, 17.4's slider) assumes it exists. Recorded as a deliberate widening rather than left as an unexplained diff, because **a decision that later reads as an oversight is worse than the oversight.** |
| C21 | 15 | **`invoices.kind` still has the value `subscription`** for what is now a credit purchase. Renaming means migrating every historical row and every reader for a label. Left as-is; `recordCreditPurchaseInvoice` says so at the call site. | minor | sprint 1 | **resolved 12.5** — void by THE RESET. Every `invoices.kind = 'subscription'` row is test data being purged, so there is no historical row a rename would have had to migrate. The label stays as it is because nothing now carries the old meaning |
| C22 | 5, 6 | **§3's "unclaimed patient gets 5 credits, unlocked by a diagnosis and a history" cannot be enforced yet** — it needs the claimed/unclaimed state from sprint 5. `checkQuota` currently applies `unclaimedPatientCredits` as a floor for *every* patient, which is the more generous reading and cannot lock a therapist out of a patient they just added. Tighten when `people` lands. | minor | sprint 1 | **resolved 12.1** — the state exists (sprint 7) and the gate now bites for everybody, with no date and no grandfather. §3's unlock is a diagnosis **and** a typed-or-dictated history, both answerable since sprint 8 |
| C25 | — | 🆕 **There is no copilot in the room, and that is the real gap behind old 2.1.** `session-room.tsx` renders only `CopilotToasts` — passive one-line suggestions written from the transcript. A therapist who wants to *ask* something mid-session must leave the room for `/copilot`. Scoped as its own ticket per ruling, deliberately **not** absorbed into sprint 2. Needs: a room surface, the four access states from §3, and the per-session credit accounting from C14. Estimate ≥1 week on its own. | major | sprint 2 | **RULED 2026-09-06, sprint 17 — accepted, not resolved. Deferred to sprint 23, the first sprint after launch.** The gap is real and the description is accurate: the question a therapist wants to ask happens *in the room*, and today they leave it. It is not being built now, and the reason is arithmetic rather than judgement — it is a ≥1 week feature, and the four sprints between here and the launch gate (18 public site, 19 both languages, 20–21 the back office, 22 the purge) are what make the product shippable at all. Adding a week of in-room surface would push the gate by a week to improve an experience nobody is having yet, because nobody is on the product yet. **What makes deferring safe:** everything C25 actually needs already exists — the four access states (sprint 8/9), the per-session credit accounting (C14, sprint 1), the citation-resolving answers (sprint 8), and `/copilot` itself, which works on the same phone that is in the room. The deferred work is the *surface*, not the machinery. **What it costs, stated plainly:** mid-session friction. A therapist who wants a second opinion has to leave the session screen, and some of them will simply not ask — which means the copilot's value is understated in exactly the moment it is highest. That is a known price of shipping, not an oversight, and sprint 23 is where it is paid. |
| C32 | 3 | **Sprint 3's acceptance cannot be fully met on existing data.** "No transcript line ends mid-word across a 10-session sample" is a claim about *recordings*, and every segment in this database was cut by the old 8-second metronome. The new rule only applies to audio recorded after it ships. Measured baseline via `scripts/measure-cuts.ts`: 311 interior cuts across 21 sessions, **24.4% end without terminal punctuation**, 5.5% are followed by a line reading as a continuation. Re-run after real sessions to close this. | major | sprint 3 | **resolved 12.5** — void by THE RESET. "No transcript line ends mid-word" is a claim about recordings, and every segment in this database was cut by the old 8-second slicer and is being purged. The acceptance test is answerable on the first recordings made after launch, and only on those |
| C33 | 3 | **The backfill's labels came from the mock, not a model.** No `OPENAI_API_KEY` was available, so the first backfill ran against `tests/mock-openai.ts` with alternating speakers — machinery verified, labels meaningless. | major | sprint 3 | **resolved** — a real key was provided. All 160 mock labels were reset to `unknown` first (so the model started from truth, not from fiction), then re-run against `gpt-4o-mini`: 13 sessions, 151 segments, 31s. Coverage **in-person 91.9% → 12.2%**, **video 20.5% → 2.7%**. Quality hand-checked, see C35 |
| C35 | 3 | 🔴 **Diarisation quality is capped by chunk alignment, not by the model.** Hand-read two real sessions after the live backfill. Arabic (session `452f8851`, 18 lines read): ~15 clearly correct, including the code-switched *"كملي. What feelings come up for you?"* — labelled therapist, right. English (`1798409d`, all 27 lines): materially worse, and **almost every error is the same error** — the line contains *both* speakers, because the old 8-second cutter sliced across turn boundaries. Line 13 reads *"What made you decide to come here today? Um, well, as I told you, I wanna kill myself."* and is labelled `patient`: half right, and the half it gets wrong is a therapist question attached to a crisis disclosure. **Measured lower bound: 14.6% of labelled segments (22 of 151) contain an interior `?` or `؟`** — a turn boundary mid-line, where no single label can be correct. The true rate is higher, since a straddle needs no question mark. This is the strongest argument for 3.2: pause-aligned cutting should collapse this class directly, and until real sessions are recorded that way, backfilled labels on straddling lines are structurally at best half right. | major | sprint 3 | **resolved** — a straddling line is now left `unknown`, never labelled. Enforced twice: the prompt says so *above* the JSON schema (H2), and `straddlesTurnBoundary` refuses at the write whatever the model returns. Reclassified **18 of 151 (11.9%)** already-written labels. C32 still governs whether the underlying cause goes away |
| C34 | 3 | **H11's cap never actually bit on this data.** Measured before backfilling: 0 of 22 sessions exceed 160 segments — the longest is 95. So the fix matters for the 60-minute sessions sprint 1.5 just made possible, not for anything already recorded. Worth stating so nobody reads the backfill's improvement as evidence the cap was the cause; the cause here was the two-track guard and in-person sessions having no second track at all. | minor | sprint 3 | **RULED 2026-09-06, sprint 18 — noted, and the note is the point. Closed.** H11's 160-segment cap never bit on the data that existed: the longest session was 95 segments. So the attribution improvement measured in sprint 3 came from the two-track guard and from in-person sessions having no second track — **not** from the cap. It is recorded here so that nobody reads the backfill's numbers as evidence the cap was the cause, which is the specific way a measurement gets cited into meaning its opposite. The cap still matters for the 60-minute sessions sprint 1.5 made possible; it has simply not been exercised yet. |
| C39 | 5 | 🔴 **The auto-merge hazard is real in this data, measured — and confirmed on PRODUCTION, where it is worse.** Three duplicate addresses on production, one of them across **three** patients in **three** organisations. On the branch: three addresses sit on more than one patient, and one of them — `omarabdelgawad001@gmail.com` — is on patients named **"Omar"** and **"Sam"**, in two different organisations. A shared family address, a typo, or somebody booking for a relative; there is no way to tell from the address. §3's "never auto-merge" is not a precaution against a hypothetical. The backfill kept all three as separate people and the verifier asserts they stayed separate. | major | sprint 5 | **RULED 2026-09-06, sprint 18 — the rule holds and is now permanent. Closed.** Measured on production: three duplicate addresses, one across **three** patients in **three** organisations; on the branch, `omarabdelgawad001@gmail.com` sits on patients named *Omar* and *Sam*. A shared family address, a typo, or somebody booking for a relative — and there is no way to tell which from the address. §3's "never auto-merge" is therefore a measured rule rather than a precaution, the sprint 5 backfill kept all three separate, and `verify-sprint5.ts` asserts they stayed separate. §3b has since made this narrower still: identity is a phone **and** an email, and a claim is gated on two questions a stranger cannot answer. **What it costs:** genuine duplicates stay duplicated until a human merges them, and somebody seen by two clinicians under two spellings has two records. That is the correct side to be wrong on — an unmerged duplicate is an inconvenience, a wrong merge is one person reading another person's therapy. |
| C40 | 5 | **`ensurePersonForPatient` runs outside the join-link transaction, deliberately.** It opens its own connection, so calling it inside would deadlock against the row that transaction still holds. A patient briefly without a person is a row the next read repairs; a deadlock is a patient who cannot get into the room. The trade is recorded here because it is invisible in the code. | minor | sprint 5 | **resolved — deliberate.** `ensurePersonForPatient` runs outside the join-link transaction because calling it inside deadlocks against the row that transaction holds. A patient briefly without a person is a row the next read repairs; a deadlocked join link is a patient who cannot get into the room |
| C36 | 4.3 | **Payment preferences deferred, as C12 predicted.** The payment now records the country, currency, rate and VAT it was made under, which is history and belongs on the payment. A *preference* — "this is where I pay from" — is an attribute of a person, and `people` arrives in sprint 5. Storing it on `patients` now means migrating it in two sprints' time. Build it in 5, on the row that will own it. | minor | sprint 4 | **resolved sprint 5** — `people.preferred_country` / `preferred_currency`, with `savePaymentPreference`. The *payment* still records the country it was actually made under; that is history and never moves |
| C37 | 4.4, 14 | 🔴 **The exchange rates are indicative, not a feed.** `lib/billing/fx.ts` has a `STATIC_RATES` table (~48 EGP/USD) and stamps every quote `source: "static"`, so a payment made against one is distinguishable in the row from a payment made against a real provider — and the pay page says so to the patient. `fetchRate` is the single function to replace. **A static rate must not settle real money in production.** An unpriceable pair is refused rather than guessed, so the failure is a country that cannot be paid in yet rather than a patient charged wrongly. Sprint 14 owns the real feed, next to the payment providers it must agree with. | major | sprint 4 | **RULED 2026-09-06, sprint 16 — the refusal is now code, and the feed is still not wired.** Two halves, decided separately. (1) **Enforced:** `quoteFor` refuses a `static` quote when `NODE_ENV` is production — on the fetch *and* on a stored row read back an hour later, because a quote written before a provider existed is the same mistake one step later. `PROVIDERS` is an ordered list of real feeds and is **empty**; the moment one is configured the refusal stops firing on its own. The sprint 16 verifier proves this in a **child process booted at `NODE_ENV=production`**, not by editing `process.env` in-process (which `lib/env` reads once at load and would have proved nothing) and not by reading the source. (2) **Accepted, not resolved:** there is still no rate provider account, so **the EGP rail cannot take real money in production today**. That is deliberate and visible: a refusal is a country that cannot be paid in yet, which somebody reports; a guessed rate is a receipt that is wrong and nobody finds out. **What it costs:** sprint 16 ships a rail that is complete in code and inert in production until a feed is bought — the launch gate in 22 must not be read as passed while `PROVIDERS` is empty. |
| C38 | 4.4 | **Found by the verifier: the FX quote window was built from two clocks.** `quoted_at` defaulted to Postgres `now()` while `expires_at` was computed from this process's `Date.now()`, so the stored window was an hour ± the skew between two machines. The hour is a promise to the patient; a window derived from two clocks cannot be reproduced when somebody asks why a quote expired early. Both timestamps now come from the same instant. | minor | sprint 4 | **resolved** |
| C41 | 6.3 | 🔴 **6.3 was deliberately NOT done, and doing it would be a security regression.** Making `Actor.organizationId` nullable was scoped when patients were expected to flow through the *same* actor. 6.2 chose a separate identity table instead, so no patient ever holds an `Actor` — and with nobody to be null for, the nullable buys nothing while putting `string | null` into **192 `.organizationId` reads across 52 files, every one of them a tenancy filter**. A filter that silently accepts null is a filter that returns another practice's rows. `PatientActor` (accountId, personId, email, name) has no `organizationId` field at all, which is the honest encoding: a patient is not in an organisation. Closes C15 by dissolving it rather than paying it. | major | sprint 6 | **resolved — deliberately not built.** `verify-sprint6` asserts `users.organization_id` is still `NOT NULL` |
| C42 | 6.1 | **`"patient"` was deliberately NOT added to `ROLES`.** Same reasoning one layer up: `ROLES` is what `requireRole` checks, and every role in it is a role inside an organisation. A `"patient"` member would be a role that must never satisfy any `requireRole` call — a value whose only correct behaviour is to be rejected everywhere, which is a trap for the next person to add a role check. Patients authenticate through `requirePatient()` against their own table and their own cookie. `ROLES` carries a comment saying why the value is absent, so it is not re-added as an oversight. | minor | sprint 6 | **resolved — deliberately not built** |
| C43 | 6.9 | **6.9's WhatsApp half is not built, and the UI does not pretend otherwise.** The channel is in the data model and in `sendClaimCode`, but there is no WhatsApp Business sender configured, so a `whatsapp` request logs a warning and delivers by email. The claim screen therefore offers **only** email — no WhatsApp button exists to press — because a screen that says "check WhatsApp" for a message nobody sent leaves a person waiting instead of claiming their record. Needs a provider decision (Meta Cloud API vs an aggregator). Measured constraint on its usefulness: **0 of 66 patients have a phone number on file**, so even with a provider there is nothing to send to until sprint 8 collects one. | minor | sprint 6 | **resolved 11R as C68** — the claim code routes through `notify()` and the `claim.code` template exists. What remains is not code: WhatsApp is off until the three Meta variables exist, which C64a records |
| C44 | 6.8 | **Found by the verifier: `startClaim`'s upsert could never have run.** `person_claims_open_unique` is a *partial* index (unique on person+account only `WHERE status = 'pending'`), and the ON CONFLICT clause named the columns but not the predicate. Postgres does not degrade gracefully there — it refuses the statement outright with `42P10`. Every second press of "send me a code" would have been a 500, and no test would have caught it because the first press works. Fixed with `targetWhere`. The lesson repeats sprint 4's: an upsert against a partial index is not verifiable by reading. | minor | sprint 6 | **resolved** |
| C45 | 6.6 | **Middleware prefix matching was substring, not segment.** `/patients` (the clinician's list) and `/patient` (the patient's own area) differ by one character, and `startsWith` put anything beginning with those letters under both. The routing decision moved to `lib/routing.ts` as a pure function matching on segment boundaries, with the structural claim — *no combination of cookies sends a `/patient/*` path to a clinician screen* — asserted exhaustively over all 4 cookie states × 2 expiry states rather than argued in a comment. | minor | sprint 6 | **resolved** |
| C46 | 7.7 | **§3's five-credit unlock cannot be evaluated, and locking on half of it would take the copilot from 65 of 66 patients.** The unlock is "adding the patient **and** a diagnosis **and** written or dictated history". Measured on the branch database: **1 of 66 patients has a diagnosis, 0 have a history — and `clinical` has no `history` field at all**, only `diagnoses` and `goals`, so the second half of the test has nowhere to read from. `accessStateFor` therefore reports `unclaimed_bare` vs `unclaimed_documented` truthfully and the banner says what is missing, but the state does **not** reduce anybody's allowance. Sprint 8 gives history a home — a `typed`/`dictated` document on the person — so the second half of the test is now answerable. The gate still does not *bite*: turning it on would lock 65 of 66 existing patients out of a copilot they use today, and that is a product decision rather than a bug. `accessStateFor` takes `documented` as a parameter, so switching it on is one call site. | major | sprint 7 | **resolved 11R** — turned on, grandfathered on `copilot.gateActiveFrom` in `platform_settings` (a date, default `""` = never). Both halves of §3's unlock are now answerable: a diagnosis **and** a `typed`/`dictated` history document — an upload does not count. A gated record keeps its notes, its transcripts and the ability to add the diagnosis that releases it. Measured on the branch database: setting the gate live *today* locks out **0 of 66** existing patients |
| C47 | 7.7 | **CLOSED IN SPRINT 8 — measured.** `documentsFor` in `lib/ai/patient-copilot.ts` returns **0 characters** to a revoked clinician and 216 to a granted one, on the same person, asserted by `verify-sprint8.ts`. The material never enters the prompt, so a model that ignores an instruction cannot leak it. Original finding: **The degraded state removed nothing, because there was nothing yet to remove.** §3 takes the live profile, the patient's files and diagnosis changes off a revoked clinician. Two of those three do not exist before sprint 8, and the copilot's context is assembled from one `patients` row — one clinic's own sessions and notes — which is precisely what §3 *leaves* them. So what sprint 7 actually enforces is the third: `updatePatient` refuses a diagnosis write in the revoked state, in the data layer rather than the form. The other two are enforced at the seam (`capabilities.liveProfile`) that sprint 8's assembly must consult, plus a prompt rule above the schema (H2) telling the model not to speculate about what it was not given. Recorded so sprint 8 does not assume this was already done. | major | sprint 7 | **resolved sprint 8**, re-read in 11R — nothing to add |
| C48 | 7.1 | **Sprint 6's step 7 was a stored opinion until now.** The claim recorded `therapist_keeps_access` and nothing read it, so "the therapist keeps access" changed nothing either way. `applyClaimDecision` now runs on both claim routes: yes creates an open-ended grant for every clinician holding a record for that person, no creates nothing — and *nothing* is the revoked state, which is what makes §3's "default OFF" real rather than a checkbox. Called outside the claim transaction on purpose (C40's deadlock); a missing grant is the safe failure, because absence denies. | minor | sprint 7 | **resolved** |
| C49 | 7.6 | **A patient is an actor in the audit log and could not be recorded as one.** `audit_log.actor_user_id` is a foreign key to `users`, and a patient has no row there (C41). Rather than widen that column to a bare uuid — which would make "who revoked this grant?" answerable only by guessing which table the id belongs to — `actor_account_id` was added beside it, and `audit()` **throws** if both are set. One action, one actor, enforced in code and asserted by the verifier. | minor | sprint 7 | **resolved** |
| C50 | 8.3 | 🔴 **PDF and Word text extraction is deferred, deliberately, and the screen says so.** Both are accepted, stored and shown (8.2) but land in `STORED_ONLY_TYPES`, so they are labelled *"stored, but not searchable"* rather than parsed. This project has no PDF or DOCX parser, and every candidate (`unpdf`, `pdf-parse`, `mammoth`) carries an unmade decision about failure modes — the common one being a two-column discharge summary read as interleaved nonsense. That would put **wrong words behind a `[D7:3]` citation**, which is C35's lesson exactly: a wrong label manufactures certainty a clinician acts on, and unknown is honest. The seam is real and the queue works — `extractText` is one function and one dependency away from done. | major | sprint 8 | **resolved 11R** — `unpdf` and `mammoth`, with the column-count heuristic in `lib/documents/layout.ts`: a page carrying a wide gap through its middle is a page whose reading order cannot be vouched for, so the document extracts as nothing and is labelled *Stored, but not searchable*. One such page condemns the document. A wide two-column table is refused with the genuine columns — the deliberate direction. Measured: 10 tests, two of them built from real PDF bytes through the real parser |
| C51 | 8.4 | **No OCR, as §3 asks — and the label is doing the safety work.** An image is stored, shown, zoomable and marked *"image — not searchable"*. That sentence is the feature: a clinician who believes the copilot has read a discharge summary will not go and read it themselves, so every document states plainly whether the copilot can see inside it. `unsupported` and `failed` are separate states because they are different facts and different screens — one will never work, the other might on a retry. | minor | sprint 8 | **resolved as specified** |
| C52 | 8.10 | **The read-only viewer is honest about what it cannot do.** Bytes come only from `/api/documents/[id]`, which re-checks consent and audits every read — H14: the blob URL never reaches the browser, so a URL kept from before a revocation stops working. Read-aloud posts a **document id**, not text, so the words are spoken without ever being in the page. The watermark carries the reader's name onto any screenshot. What none of it stops is a photograph of the screen, and the copy does not pretend otherwise. | minor | sprint 8 | **resolved** |
| C53 | 9.5 | **The ⚠️ warning is enforced by two asymmetric queries, not by a component rendering fewer fields.** `nextStepFor` returns one step and a capped `othersWaiting`; `openStepsFor` returns open rows only. Neither can return a count, a rate, a streak or a closed item, so the patient's screen has no completion rate for the same reason it has no weather forecast — it was never fetched. `homeworkTrend` is the clinician's, and it is the only place a rate exists. A single `listHomework(role)` would have been shorter and would have put the decision in whichever caller got it wrong. `verify-sprint9.ts` asserts the **key set** of what the patient's query returns, so adding a count to it fails the build rather than reaching a person. | major | sprint 9 | **resolved** |
| C54 | 9.5 | **`skipped` is a first-class outcome, and an answered step cannot be withdrawn.** A status set of done/not-done turns every unfinished week into an accusation, so "I could not do this one" sits beside "I did this" at the same size, in the same weight, with no warning colour and an optional note that is optional in the real sense. And once a person has answered, `withdrawStep` refuses — a clinician cannot tidy an inconvenient skip out of the record. | minor | sprint 9 | **resolved** |
| C55 | 9.1 | **The rolling profile has no update path that takes prose from a human, and that is the mechanism.** One row per person, enforced by a unique index, replaced wholesale by `regenerateProfile`. `lib/data/memory.ts` can only read. A clinician who disagrees with a line changes the *sources* — they flag it (8.8) or record a session that says otherwise. "Never hand-edited into permanence" is therefore a property of the schema rather than a habit somebody maintains. | minor | sprint 9 | **resolved** |
| C56 | 9.5 | **97 notes' worth of drafted steps were deliberately NOT promoted to homework.** `NoteContent.patientSteps` has been drafting steps into notes since before this sprint. Backfilling them would hand every patient with an account a list of tasks their therapist never set, dated to sessions that ended months ago — the first thing they would see on their own screen is a backlog they had already failed. A clinician promotes a drafted step deliberately, one at a time, and it is recorded as `drafted` rather than `therapist` so a patient asking "did you actually mean this?" gets a true answer. | minor | sprint 9 | **resolved as specified** |
| C57 | 10.2 | **CLOSED IN SPRINT 11** — `sessions.scheduled_at` exists (migration 0039) and `availability_slots` carries the calendar. The roster still returns null pending a follow-up to read it, which is a one-line change now that the column is there. Original finding: **"Next appointment" could not be answered, so the roster returned null rather than guessing.** There is no `scheduled_for` column — `sessions` records what happened, not what is planned, and scheduling is sprint 11. Caught before it shipped: the first version of `buildRoster` selected `MIN(s.scheduled_for)`, which typechecks (it is inside a `sql` template) and would have thrown on every load. The roster block now omits the phrase entirely and the system prompt says there is no schedule — a copilot answering "nothing booked" for a practice with no booking system states a fact about our schema as though it were a fact about their week. | minor | sprint 10 | **RULED 2026-09-06 (sprint 14) — a scheduled time is NOT clinical, and the roster now carries it.** *Decision:* `buildRoster` selects `MIN(scheduled_at)` for future `scheduled` sessions, and 10.2's guarantee stands unchanged. *Why:* the guarantee is that the general copilot cannot read a clinical **record** — the verifier enforces it on the import block, over the seven tables carrying clinical text. An appointment time is a fact about a diary of exactly the same kind as `lastSessionAt`, which this roster has carried since sprint 10: it says *when*, and nothing about why, what was discussed, how somebody is, or even that they are unwell. A person can have an appointment with a physiotherapist. *What it costs:* `sessions` is now imported by `lib/ai/assistant.ts`, which looks like the wall coming down, so the import carries its reason inline and the sprint 14 verifier asserts on the roster block that **only** `scheduled_at` is selected — no status, no price, no modality, no note. The risk is a future edit widening that select without noticing what it is inside; the check is what catches it. *Not a free call:* the honest alternative was leaving it null forever, and that would have made the roster wrong about the one thing a clinician asks it every morning |
| C58 | 10.2 | **The general copilot is a separate table for the same reason patients got a separate identity (C41).** A nullable `patient_id` on `copilot_threads` would have put the general assistant inside the module that assembles transcripts, notes and documents — one `if` away from a leak, and that `if` would be the only thing between a general question and twelve sessions of somebody's therapy. `lib/ai/assistant.ts` instead imports **no table carrying clinical text at all**; the one clinical table it touches is `session_notes`, only ever inside a `COUNT(*)`. `verify-sprint10.ts` asserts that by reading the module's own import block, so a future edit adding one fails the verifier rather than reaching a prompt. | major | sprint 10 | **resolved** |
| C59 | 10.3 | **Links are matched from names to ids, never the other way round.** The obvious design — ask the model for `[[patient:uuid]]` and resolve it — fails in the way that matters: an invented uuid gives a broken link, and a *plausible* invented uuid gives a link to the wrong patient. Scanning the answer for names already known cannot produce a link to somebody off the roster, because the only ids in play came from the roster. The resolved mentions are stored on the message, and the component renders from **those**, so a name outside them stays inert on every future re-render. Unicode-aware boundaries, because `\b` is ASCII-only and this roster is largely Arabic. | minor | sprint 10 | **resolved** |
| C61a | 11.1 | **Whole hours are a CHECK constraint, not a form validation.** `date_part('minute', starts_at) = 0` on `availability_slots`, plus a form whose wire format has no minute field at all. A form validates what a form submits; the constraint holds for a script, a backfill, an admin tool and whatever the next sprint writes. The reason is not tidiness — a calendar carrying 19:00 *and* 19:15 is one where two patients book overlapping hours and the clinician finds out when the second joins the room. Verified by attempting the insert: refused. | minor | sprint 11 | **resolved sprint 11** — kept as the record of why the constraint is in the database rather than the form. Renumbered from C61 |
| C62a | 11.5 | **Auto-offline is inside the radar's own `reachable()` predicate, not a flag.** A boolean column would need something to flip it, and whatever flipped it would be late exactly when it mattered — which here means a stranger in crisis handed a clinician twelve minutes from somebody else's appointment. It is a `NOT EXISTS` in the one shared predicate every radar query already uses, and it covers the **whole booked hour**, not only the run-up. The verifier asserts it twice: through `inBookedWindow`, and against the raw predicate, because a helper can be right while the query is wrong. | major | sprint 11 | **resolved sprint 11** — renumbered from C62 |
| C63a | 11.7 | 🔴 **Nothing can actually be delivered yet, and every screen says so rather than assuming.** The Resend domain is unverified and there is no WhatsApp key, so `notify()` returns `sent: false` and the booking screen prints *"we could not send you a confirmation — write this time down"*. That is the honest failure: "check your email" for a message that was never sent is how somebody misses their appointment. Measured on the branch: `email configured: false, whatsapp configured: false`. **Unblocked by you, not by code** — verify the Resend domain, and see C64 for WhatsApp. | major | sprint 11 | **resolved sprint 11** — renumbered from C63; superseded in substance by C68, which 11R closed |
| C64a | 11.7 / C43 | **WhatsApp is written against the Meta Cloud API, untested, and off until three env vars exist.** `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, optionally `WHATSAPP_TEMPLATE_LANGUAGE` (default `ar`). Meta rather than Twilio/MessageBird: one fewer processor in the path of clinical-adjacent messages, and roughly half the per-conversation cost — paid for with slower onboarding and templates that need approval and can be refused. **Four templates must be created and approved before anything sends**; `scripts/whatsapp-check.ts` sends one real message so "it works" is something somebody has seen. 🔴 No clinical content goes through this channel — a WhatsApp message sits in a cloud backup and on a lock screen. | major | sprint 11 | **resolved sprint 11** — renumbered from C64. Still true: WhatsApp is written, untested, and off until the three variables exist |
| C65a | C60 | **`pricing` has no Arabic row, so `/ar/pricing` serves the English one.** `content_pages` holds `ar` rows for `home`, `features` and `contact` but not `pricing`, and `lib/content/defaults-ar.ts` has no pricing page either — so `getPage` falls back to `locale = 'en'`. Nothing is *stale* (the English row was corrected on 2026-09-05 and I re-checked all 11 published rows against `$6 / Unlimited / $99 / 10% of` — zero matches), but an Arabic-speaking visitor reads English prices. Not fixed here: writing Arabic marketing copy is not a thing to do silently in a scheduling sprint. | minor | sprint 11 | **resolved 12.5** — restated as C72; the branch database's stale copy was republished in 11R and the missing `ar` row is sprint 18's. Renumbered from C65: two different concerns carried that number |
| C66a | 11.3 | **`bookSlot` writes the session before it claims the hour, so a lost race leaves a cancelled session behind.** Deliberate: a cancelled `scheduled` session with no slot is recoverable, and a half-booked hour is not. Found by the verifier's own cleanup leaving a row in the branch database — the losing booking used a patient name the cleanup filter did not match. Both the filter and this note now exist so the trade is visible rather than surprising. | minor | sprint 11 | **resolved 12.5** — still deliberate, and now the *only* reason a session row can outlive its slot. 12.2 made the same path mint a `feedback_token`, so the row a lost race leaves behind is a complete, cancelled, ratable session rather than a half-formed one |
| C30 | 2 | **The "someone is looking" toast was removed, not just relocated.** The orb says the same sentence permanently in the same corner, so the two overlapped and told the clinician the same thing twice. The *booking* card stays — that one is an interruption, not a status, and the orb steps aside for it (`liftedForBooking`). | minor | sprint 2 | **resolved** |
| C31 | 2.5 | **`savePractice` cannot be used for a single toggle.** It takes the whole practice payload, so driving it from a floating control would rebuild name, address and coordinates from nothing and silently erase them. Added `setAcceptsWalkIns`, a conditional UPDATE that refuses to publish an address which has not been confirmed — and never guards turning it *off*, because somebody withdrawing consent to be visited must not be told they cannot. | minor | sprint 2 | **resolved** |
| C27 | 2.5 | **"Access state" in 2.5 could not be built.** The four copilot states in §3 are defined by claimed/unclaimed and by `historyGrants`, which arrive in sprints 5–7. `/on-call` shows everything else the ticket asks for; the access column is deliberately absent rather than faked with a placeholder that would always read the same. Revisit after sprint 7. | minor | sprint 2 | **resolved 11R** — `/on-call`'s session history carries the access state per row. Sprint 2 left it out rather than faking it because `history_grants` did not exist; it is read in the same query as four correlated values and the pure decision applied in the map |
| C28 | 2.5 | **Copilot questions had no session attribution.** `copilot_messages.session_id` was written only on `session_note` rows — measured: 97/97 notes, **0/23 therapist questions**. So "credits used per session" had no answer. Now stamped when the question is asked during a live session with that patient. **Historical rows are not backfilled** and must not be: nothing recorded which session those 23 belong to, and inferring it from timestamps would invent an attribution nobody can check. | minor | sprint 2 | **resolved going forward** |
| C29 | 1 | **Stale copy left behind by sprint 1.** The copilot quota error still said "…for this patient this month. Unlimited removes the cap." The allowance is no longer monthly and there is no Unlimited plan — telling a clinician to wait for a reset that never comes, or to buy something that does not exist, is worse than the cap. Found while building 2.5; fixed there. A reminder to sweep user-facing strings when semantics change, not just the code. | minor | sprint 2 | **resolved** |
| C26 | 12 | **20 of 59 sessions have no `feedback_token` at all** — rows predating the column. Those sessions can never be rated and their patients can never receive a brief. Harmless today (all completed long ago) but sprint 12's reliability score is computed from feedback, so it will read those therapists as unrated rather than unratable. One backfill, or an explicit exclusion. | minor | sprint 2 | **resolved 11R** — **excluded, never backfilled.** Minting a token now would assert that a rating was possible, which is false: no link was ever sent and no patient ever saw one. `RATEABLE` and `rateabilityCounts()` in `lib/data/feedback.ts` are the named denominator sprint 12 must use. Measured today: 12 of 23 completed sessions are unratable, 20 sessions in total have no token |
| C23 | 2 | **`sessions.extendedAt` is now written by nothing but still read** by the session detail page and admin Total View, which show "· Extended" for historical rows. That is correct — those sessions really were extended — but the column will look like dead schema to the next reader. Documented at the top of `lib/session-clock.ts`. | minor | sprint 1 | **resolved 12.5** — the three screens that read `sessions.extendedAt` are gone. They existed only to print "· Extended" on sessions run under the old clock, and those rows are being purged. The column stays (dropping it is not additive, H16) and `lib/session-clock.ts` now labels it dead rather than readable |
| C24 | all | **One test fails on `main` and still fails here** — `radar.test.ts:19`, "a finished session still resolves for feedback". Verified pre-existing by stashing this branch and re-running at `7f883e2`: identical failure. Not caused by sprint 1, and not fixed by it. Needs an owner. | major | sprint 1 | **resolved in sprint 2** — the test was stale, not the code. It asserted the *join* token reaches the feedback page; the two-token design deliberately makes that false. Measured: 0 of 59 sessions have `join_token = feedback_token`. Rewritten to assert the real invariant, plus that the dead join token is *not* a second key |
| C60 | merge | 🔴 **The public pricing page still advertised the old business.** The price cards read live from `platform_settings` and showed $4 / $3 / $2, but the hero and the FAQ around them are CMS copy, and both the shipped defaults and the **published `content_pages` row on production** still said "$6 buys the session", "$99 a month", "10% of the session price" and "Can I cancel Unlimited?". Sprint 1 removed `unlimited` from `PLANS`, from Stripe checkout and from the cards; it could not remove it from a database row written before that sprint existed. Fixed in both places — `lib/content/defaults.ts` and the live row — so a visitor is no longer quoted two different prices on one screen. **The general rule this exposes: any figure that lives in CMS copy is a second, unversioned source of truth for pricing.** Every later sprint that changes a number must grep `lib/content/` and check `content_pages` as well. | major | merge | **resolved at the merge** |
| C61 | 11 | 🔴 **The confirmation quotes a different time than the booking screen.** `BookingCalendar` renders every slot with `toLocaleTimeString`, so a Cairo patient picks "22:00". The confirmation body and the reminder body are built from `startsAt.toISOString()` and say **"19:00 UTC"**. Same appointment, two numbers, and the one they keep is the wrong one. Same failure shape as C60 — one fact, two renderings, no shared source. | major | review of sprint 11 | **resolved 11R** — `lib/scheduling/tz.ts` is the one formatter; every function requires a zone and there is no overload that omits one. The booking confirmation string is rendered once, on the server, in the reader's zone and returned to the screen, so the two cannot disagree. Measured: 37 tests, one instant read by four readers |
| C62 | 11 | **Clinicians publish availability in UTC hours.** `AvailabilityEditor`'s From/Until are integers passed straight to `hoursOn`, which documents them as UTC. A Cairo therapist choosing 18:00–21:00 publishes 20:00–23:00 their own time. There is a line of grey text admitting it, which makes it an honest trap rather than a hidden one. `byDay` compounds it: slots are bucketed on the **UTC** date and the header is printed with `toLocaleDateString`, so a 23:00Z slot sits under Monday and reads "Tuesday" in Cairo. | major | review of sprint 11 | **resolved 11R** — `publishHours` takes `YYYY-MM-DD` days, wall-clock hours and a required IANA zone. `hoursOn` and `byDay` are **deleted**, not deprecated: a second way to turn an hour into an instant is the defect. Measured on the branch database — the same 18:00 Cairo stored as 15:00Z in July and 16:00Z in January. `users.timezone` is editable in Settings and adopted from the browser on first publish, with the screen saying so |
| C63 | 11 | 🔴 **The reminder marker is written into the patient's own words.** `bookSlot` stores the patient's free-text "anything they should know?" answer in `availability_slots.note`; `markReminded` then appends `' [reminded]'` to that same column and `bookingsNeedingReminder` filters on `note NOT LIKE '%[reminded]%'`. So the clinician's calendar shows the patient's sentence with a machine token glued to the end, and a patient who happens to type `[reminded]` is never reminded. Patient-authored text must not be edited by the system. Needs its own column. | major | review of sprint 11 | **resolved 11R** — `availability_slots.reminded_at` (0040). `markReminded` writes only that column; the migration strips any existing marker and back-stamps the timestamp so the cleanup does not re-send. Measured: 0 rows carry `[reminded]` |
| C64 | 11 | **Egyptian phone numbers will fail on the first real WhatsApp send.** `sendWhatsapp` does `phone.replace(/[^\d]/g, "")`, and `normalisePhone` deliberately refuses to expand a local number to E.164 ("guessing the country is how 01001234567 in Cairo becomes a number elsewhere") — correct in isolation, but nothing else expands it either, and the booking form asks for a "WhatsApp number" with no country field. `0100 123 4567` reaches Meta as `01001234567` instead of `201001234567` and is rejected. The booking path does not even call `normalisePhone`. | major | review of sprint 11 | **resolved 11R** — `lib/phone/e164.ts` with an explicit country, a `PhoneField` selector on the booking form, patient signup and the clinician's patient editor, and a server that refuses rather than guesses. `sendWhatsapp` and `whatsapp:check` both refuse a non-E.164 number. Measured: 0 stored numbers across patients, people and patient_accounts are non-E.164 |
| C65 | 11 | **A same-day booking is never reminded, and the reminder lands at dawn.** The `reminders` job runs once, at 03:20 UTC, looking 24 hours ahead. Anything booked after 03:20 for later the same day has already missed the only run that would have caught it. 03:20 UTC is also 05:20 in Cairo (06:20 in summer) — that is when the phone buzzes. | minor | review of sprint 11 | **resolved 11R** — hourly, a 20–24h band plus a same-day catch-up, both gated on `reminded_at IS NULL` so one message wins whichever pass finds it. Nothing sends between 22:00 and 07:00 **in the recipient's zone**; a held reminder goes on the next run. Cost measured in 11R.17: ~0.003 CU-hours a day |
| C66 | 11 | **Production has 0039's objects but no record that it ran.** Verified on production: `availability_slots` 12 columns, all 4 foreign keys, all 4 indexes, the whole-hour CHECK, `sessions.scheduled_at` and its partial index — every claim true. But `drizzle.__drizzle_migrations` still holds **39** rows while the branch journal holds **40**. The DDL was applied without the ledger entry. Harmless in itself (the file is idempotent, so the next `db:migrate` records it), but the database and its bookkeeping disagree, which is H1 pointing the other way. **Latent trap in the same file:** all four foreign keys share one `DO $$ … EXCEPTION WHEN duplicate_object` block, so if ever one exists and three do not, the block aborts at the first and silently skips the rest. One block per constraint. | minor | review of sprint 11 | **resolved 11R** — 0039 and 0040 recorded on production, ledger and journal both 42 today. Applied migrations are **not** edited (a changed byte changes drizzle's hash and forces a replay); 0040 re-asserts every constraint one per `DO $$` block and `verify-migrations.ts` enforces the shape on unapplied files only. Measured: 108 foreign keys, 52 tables |
| C67 | 11 | **An unauthenticated stranger can fill a clinician's calendar.** `book()` needs a first name and nothing else — email and phone are optional — and each accepted booking creates a `patients` row and a `sessions` row. Throttled at 6/hour per caller key, so roughly 144 fabricated appointments a day from one address, each one a patient record a clinician then has to look at. Not urgent pre-launch; it is an open door on a public endpoint that creates clinical rows. | minor | review of sprint 11 | **resolved 11R** — a booking now requires one contact method, and two ceilings sit above the per-caller one: 12 attempts an hour on any slot, 40 an hour against any clinician, keyed on the thing being harmed rather than on the caller. Unconfirmed paid bookings go back to `open` after 24 hours and the patient is told |
| C68 | 11 | 🔴 **C43 is not closed — the claim code still never reaches WhatsApp.** Sprint 11 built a real `notify()` seam and a real Meta Cloud API client, and neither is on the claim path: `app/(patient)/patient/claim/actions.ts` still calls `mailClaimCode` directly and writes `log.warn("whatsapp verification requested but no provider is configured")` when the patient picks WhatsApp — a line in a server log, not a thing the patient is told. `notify` is imported by exactly one file in the repository (the booking action), and `claim.code` is a declared `Message["kind"]` with **no entry in `TEMPLATES`**, so it would fall back to email even if it were wired. The moment a key exists, confirmations and reminders go by WhatsApp and claim codes still go by email. | major | review of sprint 11 | **resolved 11R** — the claim action routes through `notify()`, `claim.code` has a `TEMPLATES` entry (Meta's *authentication* category, a stricter and separately-billed approval track), and the patient is told on screen which channel it went to and when it fell back |
| C70 | 11R | **Billing, audit and admin timestamps are still rendered without a zone.** `formatDate`/`formatDateTime` in `lib/utils.ts` call `toLocaleDateString(undefined)`, which is the *browser's* zone in a client component and the *server's* (UTC on Vercel) in a server component — and roughly forty call sites mix the two. 11R.1 was scoped to times a patient reads about their own appointment, and every one of those now goes through `lib/scheduling/tz.ts`. These do not: an invoice date, an audit line, "last seen", a CMS page's updated-at. Nobody misses an appointment because an audit line is an hour out, which is why this is minor and not major — but it is the same defect, unfixed, in about forty places. Fix: give `formatDate`/`formatDateTime` a required zone and let the type error find the call sites. | minor | 11R | **resolved 12.3, corrected same sprint** — `formatDate`, `formatDateTime` and `relativeDay` take a **required** zone, which is what found the call sites: 56 of them in 28 files. 🔴 **The first version was wrong in a way the type system could not see.** Six client components filled that argument from `readerZone()` at module scope, on the premise — written into this repository as a comment — that it returns null during server rendering. It does not: `Intl` is defined in Node and answers `"UTC"`. Next.js server-renders client components, so every date shipped as UTC in the HTML and re-rendered as local time on hydration: a React hydration mismatch on every timestamp and a visible flash of the wrong day for anybody east of UTC. Fixed by passing the zone as a **prop from the server** (five clinician screens, from `actor.timezone`) and by `useReaderZone()`, an effect-based hook, on the two patient screens where no zone is stored yet. Asserted by `tests/hydration.test.tsx`, which renders the real component in two child processes at `TZ=UTC` and `TZ=Africa/Cairo` and requires byte-identical output — with a control that must differ, so a passing test is not vacuous |
| C71 | 11R | **The two-column heuristic refuses wide tables along with genuine columns.** `columnCount` marks a page multi-column when 40% of its lines carry a wide gap through the middle, and a medication table or a results panel looks exactly like that. Those documents are stored and honestly labelled *"Stored, but not searchable"*, so nothing is claimed falsely — but a clinician who uploads a results table gets no copilot help with it. Deliberate, and the right direction (C35: a wrong number behind a `[D7:3]` is worse than no citation), recorded so nobody later reads the false positives as a bug in the maths. Fix, if it matters: a table is a gap in the *same place on every line*; a two-column layout's gutter wanders. | minor | 11R | **RULED 2026-09-08, sprint 20 — accepted, not resolved, and re-examined rather than rubber-stamped.** The heuristic marks a page multi-column when 40% of its lines carry a wide gap through the middle, and a medication table or a results panel looks exactly like that, so those documents are stored and labelled *"Stored, but not searchable"* — nothing is claimed falsely, and the copilot simply gets no help from them. **Re-examined here because sprint 20 is the sprint that adds *another* upload door** (support attachments, 20.19), and it would have been easy to let a second extractor drift in with different behaviour. It does not: attachments are stored and access-controlled and are **never** extracted, chunked or searched at all, because C82 says they never enter a prompt. So the fix that would matter for C71 — distinguishing a table (a gap in the *same place* on every line) from a two-column layout (a gutter that wanders) — is still worth doing and is still not urgent, and it now has exactly one caller rather than two. **What it costs:** a clinician who uploads a results table gets no copilot help with it and is told so. That is the right direction (C35: a wrong number behind a `[D7:3]` is worse than no citation), and it stays accepted with a date on it rather than quietly reclassified as done. |
| C72 | 11R | **`/ar/pricing` still falls back to English, and a sprint branch can carry copy production has already had corrected.** Re-checked on **production** during 11R: all 11 published `content_pages` rows are free of the old `$6 / Unlimited / 10%` copy — C60 stayed closed. But the *branch* database still held the pre-C60 pricing row, because it was forked before the merge fix and CMS content is data rather than schema, so no migration carried the correction across. Republished on the branch; production untouched. The residue: `pricing` has **no `ar` row** on either, so an Arabic visitor reads the English page. Sprint 18 is the bilingual sprint and this is squarely its work. **The general lesson, beside C60:** a Neon branch is a snapshot of data too, and a content fix made on production does not travel to a branch cut before it. | minor | 11R | **RULED 2026-09-06, sprint 18 — closed on the branch; the production half is 22.8b.** Both halves are done here: `pricing` now has an `ar` row (sprint 17) and `for-patients` was created in **both** locales, so an Arabic reader no longer reads an English pricing page. The general lesson stands and is now a standing rule: **a Neon branch is a snapshot of data as well as schema, and a content fix made on production does not travel to a branch cut before it** — which is why every sprint since republishes from `defaults.ts` rather than trusting the row it inherited. **Deliberately not done here:** production content is *not* republished, because a `pricing` or `crisis` block in the database before the code that renders it deploys would serve a pricing page with no prices. That is 22.8b, after the deploy, and it is on the launch checklist rather than in a comment. |
| C78 | 21 | 🔴 **"No language goes live until it is 100% translated" is right at launch and wrong forever after.** The rule as stated means one new string added anywhere silently takes a live language offline — add a button to the homepage and Spanish drops, with nobody able to explain why. **Ruling: completeness gates the *launch* of a language, not its *life*.** Once live, a new untranslated string falls back to the default, the language stays up, and it is raised loudly as an alarm with a deadline. | major | review | **ruled — sprint 21.12** |
| C79 | 21 | 🔴 **A machine translation published without a human is a clinical instruction nobody read.** Bulk AI translation is worth having and is in the plan; publishing straight from it is not. **Ruling: AI drafts, a human publishes.** A machine translation lands as a draft and counts as *missing* on the completeness checklist until somebody approves it — and crisis copy, consent wording and the recording notice can never be published from a draft at all, whatever a bulk action offers. | major | review | **ruled — sprint 21.17–21.19** |
| C80 | 18 | **A screenshot in a repository is permanent in a way a database row is not.** The purge in sprint 22 will not reach `docs/screens/`. So the sweep runs only against a seeded demo organisation of invented people and refuses otherwise — and **admin screens are swept but gitignored**, because an admin console shows many patients at once and the repository should be treated as if it will be public one day. Live components remain the default; a screenshot is a promise that expires silently. | major | review | **ruled — sprint 18.10–18.12** |
| C81 | 20 | **A 90-day lock on a mistyped phone number traps somebody for three months.** The lock is right — the number is the identity and changing it is how an account gets stolen. But a typo caught in the first hour is a correction, not a change. **Ruling: the lock starts 24 hours after the number is first confirmed.** | minor | review | **ruled — sprint 20.14** |
| C82 | 20 | **Support attachments are clinical material arriving through a non-clinical door.** A patient uploading a photo of a prescription to a support ticket has just sent us a medical record. Same storage, same audit, same access control as sprint 8's documents — and 🔴 **they never enter any prompt.** Likewise the closing email is patient data leaving the building under §6: audited, and carrying the correspondence rather than the attachments. | major | review | **ruled — sprint 20.19, 20.22** |
| C83 | 20 | **An overdue clock that runs while waiting on the patient measures the wrong person.** Staff would be marked down for a patient who replies in three days. The clock pauses when the ball is in the patient's court. Also: a ticket moved to WhatsApp leaves our record entirely — it is recorded as moved, with a written summary brought back, or the audit trail has a hole in exactly the conversations that mattered most. | minor | review | **ruled — sprint 20.20–20.21** |
| C84 | 12 | 🔴 **12.3's guard checks a symbol, not a behaviour, and reports zero while six client components still do the thing.** `verify-sprint12.ts` scans `"use client"` files for `readerZone(`. Six others never used the helper — they inline the identical construct, `Intl.DateTimeFormat().resolvedOptions().timeZone`, read during render — or format dates and money straight off the runtime: `booking-calendar.tsx:60` (**the public booking page**, and C61 was exactly this), `rating-form.tsx:84` (the public feedback page), `availability-editor.tsx:65` (where a therapist publishes hours), `timezone-settings.tsx:28`, `radar-command.tsx:374,559` (`toLocaleDateString()` / `toLocaleTimeString()` bare), `presence.tsx:703` (`toLocaleString()` bare), and `pay-flow.tsx:79`, which formats currency with the runtime's *locale* — the same mismatch in the same place, on the payment screen sprint 16 rebuilds. **Ruling: the check is behavioural or it is theatre.** Ban the construct, not the helper: no `Intl.DateTimeFormat()`, `toLocaleDateString`, `toLocaleTimeString` or `toLocaleString` may be called during render in a `"use client"` file, zone and locale both, with `useReaderZone()` the single sanctioned exception. This is the fourth checker in this repository to pass by matching the wrong thing — the first three matched their own prose, this one matched its own helper. | major | review | **resolved 12.3, second correction** — the guard now bans the **construct**: `Intl.DateTimeFormat(`, `Intl.NumberFormat(`, `toLocaleDateString`, `toLocaleTimeString`, `toLocaleString` in any `"use client"` file, with `useReaderZone()` the single sanctioned reader. Proved to fire against **all six** offending shapes, one at a time, before being kept — the previous version was proved only against a `readerZone()` call it already caught. Seven files fixed: `booking-calendar` and `rating-form` (the public funnel) take the therapist's zone as the server-side fallback and the reader's after mount; `availability-editor`, `radar-command` and `presence` take a prop; `timezone-settings` uses the hook, since offering the browser's zone is that screen's whole job; `pay-flow`'s money is pinned to a named locale via a new `formatMoney`. The inline `Intl.DateTimeFormat` in the availability editor moved into `tz.ts` as `formatWeekday` — §6's one-formatter rule, which the wholesale ban now enforces rather than merely stating ⬛ **One blind spot left, same sprint:** the walk covers `components/` and `app/` only, and six `"use client"` files sit outside them — including `lib/i18n/client.tsx`, which sprints 19 and 21 will grow. Clean today; the gap is not. Walk `lib/` too. |
| C86 | 13R | **A patient account still requires an email, and §3b says the address often does not exist.** Today `email` and `password_hash` are both `NOT NULL`, so somebody with no address cannot create an account at all — a real exclusion in the exact market this is for — and "identity is a phone number" was built on an account that demands an address anyway. | major | sprint 13 | **resolved 13R.6–13R.13** — §3b rewritten by the founder and built: the phone is required on every account, the email is optional on every account, a password is set either way, and sign-in accepts either handle. `patient_accounts.email` is nullable with its unique index rebuilt **`NULLS DISTINCT`** — the default, and the opposite of what 0043 correctly used one table away, because here that keyword would collapse every address-less account into one. Proved by attempting the write: **two** address-less accounts coexist, a second on the same address is refused, a second on the same number is refused, none at all is refused |
| C87 | 13 | 🔴 **The three-strike lock is per *claim*, not per *record*, so a new code request buys three more guesses — and 13.8 says a mis-claim must be impossible, not unlikely.** 0043's own comment states the intent: *"an attacker with a fresh IP must not get a fresh budget against it."* The implementation does not hold it. On the third wrong name `answerName` sets `status = 'expired'`; `person_claims_open_unique` is partial on `WHERE status = 'pending'`, so the locked row leaves the index, `startClaim`'s `onConflictDoUpdate` no longer finds a conflict, and the next "send me a code" **inserts a fresh row with `name_attempts` at its `DEFAULT 0`**. Anyone holding the number — the recycled-number case in C75, or a household member — gets three guesses per code request, unbounded, against a first name. **Ruling: count the attempts on the (account, patient record) pair across every claim, not on the row**, and give the lock its own `status = 'locked'` rather than reusing `expired`, which today makes a lockout indistinguishable from a code that timed out. | major | review | **resolved 13R.1–13R.2** — the budget moved off `person_claims` and onto `claim_attempts`, keyed unique on (account, record). The hole was a sequence, not a step: the third wrong name set `status = 'expired'`, the row left the partial `WHERE status = 'pending'` index, `startClaim`'s upsert found nothing to conflict with, and a fresh claim arrived carrying `name_attempts DEFAULT 0`. Proved by replaying exactly that sequence — three wrong names, a fresh code, then the **correct** name — and requiring it to be refused. The lock also has its own status now (`locked`, not `expired`) so support can tell a lockout from a code that timed out |
| C88 | 13 | **Fixing C87 removes the only escape hatch there is.** The invite route is what C75 leans on today, and it works *because* a new claim resets the budget — close that and a patient who gave their therapist "Yasmine" and types "Yasmin" three times is locked out of their own record until sprint 20 builds the admin release. That is a support catastrophe traded for a security hole. **Ruling: the tightening and the release ship together.** The release lives with the therapist who owns the record — they created it, they know the person, and they are reachable today — as one audited action on the patient record. Admin gets the fuller tool in sprint 20; it must not be the *only* one. | major | review | **resolved 13R.3–13R.5** — the release ships in the same sprint as the tightening, as one audited action on the therapist's own patient record: named actor, written reason, timestamp, scoped by `getPatient`'s tenancy check. It restores one budget on one record and reveals nothing — both questions still have to be answered. ⚠️ **A correction found while building it:** the release first set the locked claim back to `pending`, which collides with the claim a fresh code already created; it now retires the locked claim instead, which is also the truer record — that attempt ended in a lockout and the next one is a new attempt |
| C89 | 17, 18 | 🔴 **Sprints 17 and 18 are code-complete and invisible.** Production's `content_pages` still holds the pre-sprint pages — an English `pricing` from 5 Sept that writes `$4 $3 $2. 15%` into the page itself, no Arabic pricing at all, and no `for-patients` row in either locale. So the live site today has the old pricing page, C72's Arabic fallback still broken, and no patients section. **The refusal to republish was correct** (a `pricing` block in the database before the code deploys serves a page with no prices, C60), but the consequence was not recorded: two sprints' user-visible outcome now depends entirely on 22.8b/22.8c, and nothing before then proves it works. **Ruling: publish to a staging locale or a draft row and prove the render there**, so the seed script that 22 runs is a thing that has been *executed*, not a thing that has been *written*. | major | review | **RULED 2026-09-08, sprint 19.0a — proved by rendering, against production.** `republish.ts --staging` writes each page into a **staging locale** (`en-x-staging`, `ar-x-staging`) — a locale no reader path asks for, so nothing served changes — and `scripts/render-check.ts` renders those rows through the **real `BlockRenderer`** and asserts on the HTML that comes out: the rates from `platform_settings` present on the pricing page *and* the homepage, the slider at the bundle minimum, the crisis panel pointing at `/radar`, the contact form with both companies, and 1,859 Arabic characters on the Arabic patients page. Run against **production**: 14 staged rows, 13 checks, PASS. So what 22.8b runs is now a script that has been executed against the real database, not one that has been written. **A defect this found, in itself:** `readNav` reads **every** locale and collapses by slug, so a staged page would have appeared in the live navigation of the *running* deployment the moment it was written — caught minutes after the first staging write, fixed with two locks (staging rows carry no `nav_label`; the query excludes staging locales outright), and the live nav re-checked against the deployed code's own query. **A second one:** `getLocale()` threw outside a request, so any page with a price could not be rendered by a script at all — now the request accessors fall back to the default language, in a `try` rather than a `.catch()`, because `cookies()` throws *synchronously* and the first fix chained onto a promise that never existed. |
| C90 | 17, 18 | 🔴 **Two verifiers are permanently red and every later sprint will run them.** `verify:sprint17` fails 5 of 14 against production and `verify:sprint18` fails 5 of 15, all for one reason — they read published content that C89 says will not exist until sprint 22. The reported 14/14 and 15/15 were true against a seeded database and are not true against production. A gate that is red for a known reason is a gate everybody learns to ignore, and the next real failure hides inside it. **Ruling: a check that depends on content published in a later sprint is SKIPPED with its reason printed, not FAILED** — `-- 17.9 deferred to 22.8b: pricing content not yet published` — and sprint 22 flips them back on. "All verifiers pass" has to keep meaning something. | major | review | **RULED 2026-09-08, sprint 19.0 — a skip, with its reason printed, and a precondition rather than a flag.** `scripts/_verify.ts` is now the shared reporter for every acceptance script: `skipUnless(ready, deferredTo, reason, fn)` runs the checks when the content is there and otherwise prints `--  deferred to 22.8b: …` and counts it. The summary can never read as clean — `sprint 17: PASS (9 checks, 2 deferred)`. **Proved against the database that was red:** production now reports 9 checks / 2 deferred for sprint 17 and 9 / 3 for sprint 18, and the seeded branch reports 14 and 15 with **zero** deferred, from the same file with nothing edited. Three rules keep it honest: a skip must name what it waits for; skips are counted in the summary; and **the controls never skip** — the proof that a scan can see an offender runs whether or not the content exists, because a deferred check that was never tested would pass the day 22 publishes and nobody would know. |
| C91 | 18 | **The public site still has no way to contact anybody, and two companies now need to be reachable.** §3c gives the platform a US entity and an Egyptian one; the `contact` page is a static CMS row from August with no form, and nothing on it is per-entity. **Founder requirement, 2026-09-08:** a real contact form on the public site, plus contact details for **both** companies — each editable by admin, each translatable, and the form's messages landing somewhere a named person works from rather than an inbox nobody owns. | major | founder | **RULED 2026-09-08, sprint 18R — built as a support ticket, not as an email.** `support_tickets` and `support_ticket_events` (migration 0048, applied to production first): a topic from a list, a 24-hour clock that **pauses while we are waiting on them** (20.20 / C83), a named owner, and every move recorded. The queue query deliberately **cannot carry a message body** — triage is topic, age and owner, and a list view that renders a hundred people's health information on one screen is the failure this table exists to prevent. **What made this the sprint's real decision:** 18R.4 says what a stranger types is clinical material the moment it lands, so it is audited under **`phi_access`** rather than under a new "support" category — a separate category would make "who read patient material this month" answerable and wrong. C82's *never in a prompt* is enforced as an **import-graph ban** proved with an offender file planted in `lib/ai` and then deleted, not as a regex tested against a string in the verifier. **Both companies are content, every field:** name, address, phone, email, hours, and what to write to each about, per locale, with the international entity sorted first and both always rendered; the renderer contains no company name or address at all, which the verifier asserts. Spam resistance is a honeypot plus the platform's own two-tier rate limit, and **no third-party widget** — a tracker on the page somebody uses to ask for help contradicts the product on the page where it matters most. **What it costs:** a ticket cannot be answered from an email client; somebody has to open the queue sprint 20 builds. Until then the messages are stored, safe and unanswered, and that is the honest state — the alternative was an inbox nobody owns. |
| C92 | 17, 22 | 🔴 **The live pricing page has no tiers, no slider, no currency toggle — and it states something the founder reversed.** Verified on `24t.vercel.app/pricing` today: the page is a paragraph with `$4 / $3 / $2` written into it, then the FAQ. Sprint 17 built the cards; production content overrides them (C89, C60). Worse than missing: the page still says *"we never hold it — the money is a direct charge into your own Stripe account"*, which §3c **deliberately reversed** on 2026-09-06. A live page is making a factual claim about where money sits that the product no longer honours. **Ruling: this is not a content-refresh nicety, it is a correctness bug on a public page.** The seed content must be published — into staging first, then live at the purge — and 22 cannot close while any published page contradicts §3c. | major | founder | **ruled — 21R and 22** |
| C93 | 18R, 19 | **C90's ruling was applied to the two red verifiers and not to the rule.** `verify:sprint18r` now fails 4 of 20 and `verify:sprint19` fails 1 of 17, all for C89's single cause — content that will not be published until 22. The skip-with-reason mechanism exists; the new checks did not use it. **Ruling: skip-with-reason is the pattern for every check that reads published content, not a patch applied to two files.** Any sprint that adds such a check adds it as deferrable from the start. | minor | review | **ruled — 21R** |
| C94 | 21R | 🔴 **Sign-in is one door for three kinds of person.** `/login` serves therapists and admins together; `/patient/login` and `/patient/signup` exist and link to each other, but there is **no patient password reset at all** and the patient pages do not offer one. Three audiences with different risks share one surface: an admin console, a clinician's caseload, and a patient's own record. **Founder requirement, 2026-09-07:** separate admin sign-in, separate patient sign-in and sign-up, each cross-linked, each with its own reset — and the patient's reset must work for an account with no email (§3b, 13R.10). | major | founder | **ruled — 21R** |
| C95 | 21R | **The hero puts its icon on its own line.** Reported by the founder on the live site: the icon should sit inline with the hero text, not break to a new row. Small, and the sort of thing that only a person looking at the page finds — which is the argument for the walkthrough in 22R. | minor | founder | **ruled — 21R** |
| C96 | 22R | 🔴 **Nobody has ever used this product as a person.** Every verifier asserts against the database or the import graph; no sprint has clicked from a signed-out browser to a finished session. The founder found C92, C94 and C95 in minutes by looking. That is not a gap in any one sprint, it is a missing kind of test. **Ruling: a full human walkthrough on a freshly purged database is its own sprint (22R), before beta** — every user type, every route, screenshotted, with the reviewer writing down what was hard to find as well as what was broken. | major | founder | **ruled — sprint 22R** |
| C97 | 22R | **Six-hourly check-ins to every patient.** Founder requirement, 2026-09-07: a personalised, very short, differently-worded message asking how somebody is, carrying their name. ⚠️ **The cadence is the part to prove rather than assume** — four unprompted messages a day is a great deal for somebody in distress, and a patient who mutes the channel is worse off than one who was messaged less. **Ruling: build it, ship it with an admin-controlled rate, an opt-out and an overnight quiet window, and measure the mute rate.** And 🔴 a check-in is not a clinical assessment: it asks, it never interprets, and a worrying reply goes to the crisis path rather than to a copilot. | major | founder | **ruled — 22R.11–22R.12** |
| C98 | 21R | 🔴 **The product prints a United States crisis number to everybody.** Found while reading the rendered Arabic pages for 21R.8: `988` was hardcoded into the risk banner, the patient's in-session support notice, `patientFacingCrisisMessage()` (with a **test pinning it there**), the public radar, the booking sheet and the emailed patient report. 988 is the US lifeline; dialled from Cairo it reaches nothing. The interface dictionary already says this in as many words about `urgent.footer` — *"988 means nothing in Abu Dhabi; printing it to a Gulf reader is worse than printing nothing, because it looks like help and is not"* — and then six surfaces printed it anyway, to a first market that is Egypt. **Ruling: a number is printed only where it is verified, and nowhere else.** `lib/crisis/line.ts` holds one entry, `US → 988`, because one is what we actually know; everywhere else the copy says "call your local emergency number", which is true from any phone. I deliberately did **not** add Egypt's 122/123 from memory — a wrong crisis number fails in exactly the way this ruling exists to prevent. ⚠️ **Incomplete until each country's line is entered and checked by a person**, which belongs in `country_settings` beside the payment rail. | major | 21R.8 content pass | **ruled — 21R, fixed on six surfaces; the lines themselves are ⚠️ incomplete** |
| C99 | 22R | 🔴 **A patient who claims their record cannot see it.** Found by walking the product as the patient on the purged database: `patient_accounts.person_id` is what every patient screen reads, signing up creates a `people` row of your own, and claiming attaches a *different* one — the therapist's. Nothing moved the account. `people.claimed_at`, the `person_claims` row, the grant decision and the audit entry were all correct, and the patient's own home said *"Your record — not claimed yet. No therapist files are attached to your account"* with their session, note and approved summary sitting in the record they had just taken ownership of. **Ruling: the account follows the record it claims**, on both claim routes, and only where the account's own person carries no clinical record — where it does, two people would have to be merged, and sprint 5 ruled we never merge silently. That case now leaves the account where it is rather than guessing. | major | 22R walkthrough | **ruled and fixed — 22R** |
| C100 | 22R | 🔴 **The invite link did not work for the person it is for.** Three defects on one path, all found by opening the link a therapist hands over: the middleware bounced an anonymous visitor to `/patient/login` (a sign-in form for an account they do not have); `patientSignUp` never read the `inviteToken` the form carries, so they were dropped into the *matching* route, which asks for a code by email or WhatsApp — and most patients here have no email while WhatsApp waits on Meta, so the screen said *"we could not send your code — check the email address on your account"* to somebody with no email holding the invite it suggests they ask for; and the claim screen offered them **their own** record back, because the matcher matched the person row their signup had just created. **Ruling: the invite route is the primary way into this product for the people it is built for, and it is walked as a person before every release.** Fixed: `PATIENT_OPEN_ROUTES`, signup redirecting to the invite page (which asks §3 step 7 rather than answering it), and `suggestionsFor` excluding the account's own person. | blocker | 22R walkthrough | **ruled and fixed — 22R** |
| C101 | 22R | **Two patients, one phone number, no warning.** Adding a patient whose number is already on your caseload creates a second record and a second person silently. Sprint 5 ruled that matching is *suggest-only, never merge*; the suggestion never appears at the point where the duplicate is made. **Ruling: not fixed in 22R, and deliberately not.** What the suggestion should say, and what it offers to do about a record that may already have sessions on it, is a clinical decision rather than a coding one — and a wrong merge is worse than a duplicate. ⚠️ Open, with a split history as the risk. | major | 22R walkthrough | **ruled — open, needs a decision on the wording before it is built** |
| C85 | 13 | **Nothing stores a patient's time zone, so `useReaderZone` is permanent rather than temporary.** The hook is the right answer for a screen the server knows nothing about, but every patient screen now flashes UTC before correcting — including the consent list, where the date is the legally meaningful part of the record. Nobody has ruled on this. **Recommended ruling: sprint 13 captures the zone at signup** — detected in the browser, shown, editable, stored on `patient_accounts` beside the phone. Patient screens then take it as a prop exactly like the clinician ones, and `useReaderZone()` is left only for genuinely anonymous pages. The identity sprint is where a person tells us who and where they are; adding a column later means a second migration and a second sweep. | minor | review | **resolved 13.11–13.13** — `patient_accounts.timezone` (0043), detected in the browser by `useReaderZone`, **shown and editable** on signup, stored. Precedence is `resolveZone`'s existing shape: the account's, then `patients.timezone`, then the therapist's, then UTC. 🔴 Claiming never copies the account's zone onto the patient row — asserted in `verify-sprint13.ts`, because that row records what the browser said the day the booking was made and one account may hold records from two therapists |
| C73 | 16 | 🔴 **Holding money makes this a money transmitter, and that is now the plan.** §3c changes 1.8 deliberately, and the two cross-border crossings — USD collected for an Egyptian therapist, EGP collected for an international one — are the exposed ones. In the US that is licensing in roughly 48 states with bonds from $50k; in Egypt and the UAE it is central-bank licensing. The domestic Egyptian leg (EGP in, EGP out, one entity, one country) is a materially smaller question than the cross-border legs and should be separated when counsel is asked. | blocker | founder decision | **accepted, not resolved — 2026-09-06.** Founder's ruling: build it and ship it. The cross-border crossings may prove rare, and finding out is itself worth doing; counsel comes when there is traction to protect. **This row stays open permanently as a known, accepted risk** — it is not a blocker and it is not something anybody gets to be surprised by later. The code obligation is unconditional either way: a real ledger, one entity stamped per transaction, daily reconciliation to zero |
| C74 | 16 | **Manual payouts are three people, and people sleep.** A payout request that nobody picks up is money a therapist is owed and cannot see moving. The queue needs an age, an alert, and an owner per request — and a therapist-visible status, because "requested" with no date is how trust is lost. Also: a manual process is where the fraud is. Two-person approval above a threshold, and never the same person who edited the payout details. | major | review | **RULED 2026-09-06, sprint 16 — built, and the two rules that matter live in the database.** Every requirement is implemented: `payout_requests` carries an age, a named owner, five states each with its own timestamp and person, a transfer receipt the clinician can see, and `payout_request_events` recording every transition. The ageing alert goes out through `notify()`, which sends on **every** channel (13R.12) — a phone and an email, never only the queue screen. **The fraud rules are CHECK constraints, not code paths:** `payout_requests_approver_not_payee`, `payout_requests_approver_not_editor` and `payout_requests_sent_was_approved`. Why there: a rule enforced only by the function that usually runs is one admin script away from not existing, and the verifier proves the point by writing the forbidden approval **straight to the table**, past every code path, and watching Postgres refuse it. **The threshold is a setting** (`payouts.twoPersonThresholdCents`, $500 by default) because a $20 wallet transfer does not need two signatures and a rule people work around is worse than none; setting it to 0 makes every payout need two, and there is deliberately no way to switch the rule off. **What it costs:** the second person is a real cost on a team of three at 3am, and above the threshold a payout can stall waiting for somebody to wake up. That is the intended trade — a stalled payout is visible and alerts; a fraudulent one is not. |
| C75 | 13 | **One phone, one account excludes real people.** A mother and daughter sharing a handset, a shared clinic phone, a recycled number that used to belong to somebody else. The invariant is right for safety and it will lock somebody out. There must be an admin path to release a number from a dead account — audited, never self-service, and never a way to take over a live one. | major | review | **RULED 2026-09-06 — accepted, not resolved, and 13R.4 is enough until sprint 20.** *Decision:* the one-number-one-account invariant stays exactly as it is, and the interim escape hatch is the therapist's own release (13R.4) plus the invite route, which binds a link to one record and never consults the number at all. *Why:* the people C75 describes — a recycled number, a shared household handset — are locked out at the moment they try to claim, which is the moment their therapist is reachable and knows who they are. That therapist can release the lock the same day, with their name and reason on the record; they can also send an invite that bypasses number-matching entirely. An admin-only path would have made a Friday lockout last until Monday. *What it costs:* a person whose therapist is unreachable, or who has no therapist on the platform yet, has no way in until sprint 20's staff queue — and there is no self-service option by design, because self-service release of a number lock *is* the takeover it exists to prevent. That gap is real and it is accepted. *Not resolved* because the general case — somebody the platform cannot identify at all — genuinely needs a person, and that person is hired in sprint 20 |
| C76 | 16 | **Nobody has decided who absorbs the FX spread.** A price shown in EGP at a live rate and settled hours later at a different one leaves a difference. Freezing the rate on the transaction (16.6) fixes what the *reader* sees; it does not say whose margin moves when the real settlement differs. Decide it explicitly — platform absorbs, or the therapist does — and show it on the receipt. | major | review | **RULED 2026-09-06, sprint 16 — the therapist absorbs it, and the number is on the screen with the button.** §3c decided the direction; this decides the mechanism. The USD figure is the price; EGP is a convenience at the rate of the day, and `egpSettlement()` returns the amount, the rate used, the market rate before any spread, and the timestamp **as one object**, so a screen cannot render the amount without the rate that produced it. The spread itself is a setting, `payouts.egpSpreadBps`, and it is **zero by default** — we take no margin on the conversion; the field exists so a real settlement cost can be recovered *visibly* rather than hidden inside a quoted rate, and it is capped at 1,000bps for the same reason. On the patient's side the frozen rate is what the receipt reproduces, never today's. **What it costs:** when the market moves against us between quote and settlement, the platform eats the difference on the *patient* leg (the quote is a promise we keep for an hour, 4.4) and the therapist eats it on their own leg only when they chose EGP. **Accepted, not resolved:** with no live feed (C37) the size of that exposure is unmeasured, and the first month of real EGP volume is what will tell us whether 0bps is sustainable. |
| C77 | 20 | **A language that is authored but hidden is a half-state nothing else models.** Turning a live language off mid-visit, a page translated into Spanish while its buttons are not, a `content_pages` row in a language the site no longer offers — each needs a defined behaviour. Sprint 19 must not hardcode "two languages" anywhere or sprint 20 rewrites it. | major | review | **RULED 2026-09-08, sprint 19 (the half sprint 19 owns) — the pair is gone from the code, and each half-state has a defined answer.** The shipped content is now `CONTENT_DEFAULTS`, a **map keyed by locale**, and `republish.ts` takes `--locale=xx` instead of an `--ar` boolean — a two-state flag cannot express a third language, and every call site changes the day it has to. The three half-states §C77 names are answered rather than avoided: **(1) a page in a language nothing else is translated into** falls back per *page*, not per site — `getPublicPage` asks for the reader's locale then `en`, so a Spanish page renders in Spanish inside an English frame rather than disappearing; **(2) a row in a language the site no longer offers** is unreachable but not deleted, because the row is somebody's work and a language can come back; **(3) a language authored but not offered** is exactly the staging mechanism 19.0a needed — a locale nothing routes to, which is why `en-x-staging` works at all. **What sprint 20 still owns:** turning a locale on and off *from admin*, which needs a table rather than the `LOCALES` constant, and the mid-visit behaviour when it is turned off under a reader. **What it costs:** `LOCALES` is still a compile-time list, so adding a language today is a deploy, not an admin action. That is deliberate for now — the type-level guarantee that a missing Arabic string fails `tsc` (19.2/19.6) is worth more than admin-managed languages until somebody actually wants a third. Sprint 20 trades one for the other knowingly. |
| C69 | 16 | **"The session pays for itself out of your earnings" describes a mechanic that does not exist.** The platform never holds money (1.8, C6): Stripe Connect destination charges send the patient's payment to the clinician and the 15% to us, and the **session credit is a separate purchase**. Nothing nets one against the other. The requested framing is fair as economics — a $4 session fee against a $30 session you were paid for — but it must be written as arithmetic the reader can check, not as an automatic deduction, unless netting is actually built. | major | review of sprint 11 | **RULED 2026-09-06, sprint 16 — netting is BUILT, so 17 may publish the sentence, conditionally.** §3c changed the premise: the platform now holds money on three of the four crossings, which is what made this possible at all. `chargeForSession` takes the fee out of the held balance in one ledger transaction (`fee_netted`) when there is enough to take it from — we owe them less, they owe us nothing new, no cash moves. It is **all or nothing**: netting a partial fee would leave a bill for the remainder, which is two charges for one session. Behind `payouts.netFeeFromHeldEarnings`, **on by default**, because whether to net is a business decision; with it off the bill is raised exactly as before and **17.1 must not publish the sentence**. The verifier proves both directions — a clinician whose money we hold is netted, and a **control** clinician we hold nothing for is still billed, because a check that only proved netting would pass just as well against code that netted unconditionally and invented money. **What it costs:** a clinician on the pure Connect rail (the common international case) is never netted, because we never hold their money — so 17's copy has to be true of *some* readers and not others. The honest wording is conditional ("when we're holding your earnings"), and that is a constraint on the pricing page, not a licence to overstate. |

| C201 | 37L.2 | 🔴 **Every date in the product was English, and the ratchet built to catch exactly this could not see it.** 37L translated nineteen patient screens; `verify:sprint37l` counts English *text nodes*, and `{formatWhen(session.at, zone)}` is not one. So a patient reading her own session list in Arabic met `Friday 11 September` under an Arabic heading, and the gate that exists to make C182 impossible a fourth time passed. **Ruling: the required parameter is the audit.** `formatDate`, `formatDateTime`, `formatLongDate`, `relativeDay`, `formatDay`, `formatWeekday`, `formatWhen`, `formatWhenWithCaveat`, `formatCalendarDate` and `byDayIn` all take a language, none of them with a default, and `tsc` found every call site — the same move `lib/scheduling/tz.ts` already used for zones. `verify:sprint37l2` asserts the *absence of a default* by `Function.length` rather than by reading the file, because a parameter with a default is invisible to the typechecker and therefore invisible to the audit. **What it costs:** every new call site must name a language, including the ones that mean English on purpose — an admin screen passing `"en"` is a decision showing at the call site, not an oversight. 2026-09-11. | major | 37L.9 | **ruled and fixed — 37L.2** |
| C202 | 37L.2 | **Routing dates through `localeTag` to get Arabic flipped every English date in the product from `12 September` to `September 12`.** Silently, on the same commit, because `localeTag("en")` is `en-US` — correct for money (`$20.00`, not `US$20.00`) and wrong for a date read by anybody outside the United States, which is everybody this product is built for. The timezone test caught it inside the hour. **Ruling: two tags, each named for what it is for.** `dateTag` is `en-GB`/`ar-AE-u-nu-latn`; `localeTag` stays `en-US`/`ar-AE-u-nu-latn` for money and numbers. One tag cannot be right for both, and a single "locale" that silently means two different things is how the wrong one gets used. A check in `verify:sprint37l2` holds them apart. **What it costs:** one more thing to choose between, and a call site that picks the wrong one gets a date in the wrong order rather than an error. 2026-09-11. | minor | 37L.9 | **ruled and fixed — 37L.2** |
| C203 | 37L.2 | 🔴 **A translation nearly changed what a form submits.** The language and specialty chips on the onboarding form and the radar console used ONE string as the checkbox value, the row written to the database, the allowlist entry and the words on screen. Translating the words in place would have saved `القلق` as a specialty the allowlist does not contain — the clinician would have appeared to set it, and the radar would have stopped matching them to anybody looking for anxiety. Nothing would have thrown. **Ruling: a translated label never doubles as an identifier.** The chip groups take `{ code, label }`; the code is the English allowlist value and is what submits, the label is what a person reads, and the admin taxonomy override still wins over both. Proved on the running app rather than argued: the same checkbox submits `value="Self-harm"` under an Arabic locale and shows `إيذاء النفس`. **What it costs:** two fields where there was one, on every list whose values are matched rather than displayed. 2026-09-11. | major | 37L.2 | **ruled and fixed — 37L.2** |
| C204 | 37L.2 | **A dozen clinician-facing strings lived in module-level `const` maps and arrays, where no hook can reach them and no translator is looking.** The bottom navigation's labels and hints, the radar orb's six states, the withdrawal queue's five statuses with their explanations, the copilot's four voices, the evidence panel's four provenance labels, the support form's topics, two assistant voice maps. Each compiled, each rendered, and each was invisible to every gate. Three more built interface copy out of a database enum: `session.status.replace("_", " ")` on the patient chart, `reason === "not_mine" ? … : \`This is ${reason}\`` on a document, `row.topic.replace(/_/g, " ")` on a ticket list. **Ruling: a constant that holds words holds `MessageKey`s, typed with `satisfies` so a key that stops existing is a build error rather than a blank label, and resolved where it is rendered.** An enum is never rendered directly. **What it costs:** a map that used to be readable at a glance now needs the dictionary open beside it. 2026-09-11. | minor | 37L.2 | **ruled and fixed — 37L.2** |
| C205 | 37L.2 | 🔴 **`components/memory/standing-profile.tsx` got `useT()` and it is a server component.** Identical to C199: it compiles, it type-checks, it builds, and it 500s at request time. The guard written after C199 caught it on the commit that introduced it — which is the entire argument for having written it — and then flagged the same file a second time for the sentence in its own comment explaining what had just been fixed. That is the **seventh** occurrence of the §6 family: a checker matching the prose that describes the defect it hunts. **Ruling: `stripComments` before any scan, without exception, including a scan you are writing today for a defect you fixed five minutes ago.** The rule is old; what is new is that the seventh occurrence happened to somebody who had fixed the sixth. It is not a thing to remember. Every scan in `scripts/` that reads source now strips first. **What it costs:** nothing, except that a checker can no longer be written as a one-line `readFileSync().test()`. 2026-09-11. | minor | 37L.2 | **ruled and fixed — 37L.2** |
| C206 | 37L.2 | **Two components carried `locale?: string = "en-US"`, and the default was the whole defect.** `PatientSessionList` ("because the public demo renders this with invented rows and no reader") and `NoShowRecovery` — the screen a patient sees when their therapist has not turned up and money is being quoted at them. Both are inside the locale provider like everything else, so the default bought nothing and cost the usual thing. **Ruling: a component asks for its own language rather than being handed one.** There is then no call site to forget. `verify:sprint19`'s money check knew two correct shapes — a `locale` prop and an explicit tag — and failed on the third; the rule it enforces is *never let the runtime answer*, and asking satisfies it more completely than passing does, so the check learned the shape rather than the code reverting. **What it costs:** a component that asks cannot be rendered outside a provider, which is a real constraint on the marketing demo and the right one. 2026-09-11. | minor | 37L.2 | **ruled and fixed — 37L.2** |
| C207 | 37L.2 | ⚠️ **Three bodies of clinician-facing copy are still English, named rather than absorbed.** (1) The verification form's document slots — their labels and hints — come from `lib/regulators.ts` and from per-country admin configuration, so translating them means the dictionary reaching into a lib module and into editable config. (2) The copilot's six prompt templates live in `lib/ai/case-copilot.ts` because the same strings are the prompts sent to the model; translating the label without the prompt splits one constant into two. (3) About two hundred country names in `lib/geo.ts`, which a patient reads on the public radar and a clinician reads on the verification form. The IANA time-zone identifiers in the settings picker are deliberately *not* on this list: they are technical strings and should stay as they are. **This row exists so the number 79 on the shared surface is not read as "nearly nothing left".** 2026-09-11. | minor | 37L.2 | **⚠️ open — named, not fixed** |
| C208 | 37L.2 | ⚠️ **`verify:sprint7` cannot be run twice.** Found while running every verifier in the repository to prove C205's sweep broke nothing: it crashes on `patient_accounts_phone_unique` for `+201300070001`, a fixture it inserts and never removes, and the run before the crash reported a 24-hour grant window as `0h` from state a previous run left behind. It is **not** caused by this sprint — `scripts/verify-sprint7.ts` has not been touched since sprint 24 — and it is named here rather than fixed because cleaning fixtures out of the shared verification database at the end of an unrelated sprint is the wrong moment to be guessing which rows are somebody's. **What it costs:** one of forty gates is unrunnable, and the person who next needs it will find out the hard way unless they read this row. 2026-09-11. | minor | 37L.2 | **⚠️ open — named, not fixed, and not caused by this sprint** |

| C209 | 46 | 🔴 **`chargeForSession` bills the same amount whether or not any AI ran.** Verified at `lib/billing/service.ts:62`: no consent check, no transcript check, one line item, called once from `lib/session-finish.ts`. Two things follow that are both bad. A therapist who wants the fee to go away has a reason to lean on a patient about consent, which is a coercion channel pointed at the most vulnerable person in the room. And a therapist who never seeks consent gets unlimited hosted HIPAA-grade video for nothing. **Ruling: split the fee.** A **platform fee of $1** on every session, always, including free ones, in person ones and declined ones; and an **AI fee of $1 to $3** charged only when the patient consented. Two line items on one invoice, both visible. The platform fee buys the record, the booking, the reminders, the radar placement, the note storage and the in-room copilot, which is why it survives a session with no video at all. **What it costs:** the pricing page stops being one number, and every screen quoting a session cost has to quote two. 2026-09-12. **AMENDED 2026-09-12:** the coercion channel described here does not exist *today*, because the fee does not currently vanish on refusal; today's defect is the giveaway half alone. Stated loosely, a reader could conclude the split *creates* the pressure. The protection comes entirely from the platform fee being unavoidable. So one enforcement is added: **no consent surface anywhere renders a currency symbol**, proved by a verifier, and `chargeForSession` has **two** call sites (`lib/session-finish.ts:78` and `lib/billing/service.ts:538`), not one. | blocker | founder | **ruled — sprint 46** |
| C210 | 48 | 🔴 **Ticket 23.3 says the in-room copilot is "spent by the same counter as `/copilot`. One allowance, two doors." The founder has overturned it.** The reason is the declined session. If in-room questions came out of the AI allowance, a therapist whose patient declined recording would be locked out of the one thing that still helps them, on the session where they need it most, having already paid the platform fee. **Ruling: the in-room copilot and the Prepare me button are free and uncounted, carried by the $1 platform fee, never by the AI fee.** They are the only AI in the product a patient's refusal does not switch off, because they read the record that already existed rather than the session happening now. 23.3 is struck and replaced. **What it costs:** real model spend on a session that earns $1, and no meter on it. C224 draws the boundary that keeps that bounded. 2026-09-12. | major | founder | **ruled — sprint 48, strikes 23.3** |
| C211 | 48 | 🔴 **"It has no transcript to read" is not the same rule as "it must not read this session".** A session where consent was granted and the clinician then went off record halfway has partial segments, so a copilot with no explicit time bound would answer from half a session and give no sign it was half. **Ruling: inside the room, the copilot reads the record as of the session's `startedAt` and nothing after it.** One bound, one test, and it holds identically whether consent was granted, declined or withdrawn mid-session, which is what makes it a rule rather than a branch. The panel says so in words: "This session is not being recorded. I only know what came before it." A therapist who asks what the patient just said must get that sentence, not an answer about last month. **What it costs:** a therapist cannot use the copilot to catch up on the last ten minutes, which is a feature somebody will ask for and which we are declining on purpose. 2026-09-12. **AMENDED 2026-09-12:** the data bound is right and stays absolute, but 48.5's single sentence is not. "This session is not being recorded" is **false** when consent was granted and the clinician has simply gone off record, which is C213's case, and a clinician who reads it in a session that *is* recording stops trusting the panel. **One data bound, three sentences**, chosen from the consent state, with the granted case saying only "I know what came before this session" and making no claim about recording. 48.4 and 48.5 are separate tickets because 48.5 is the one that can be wrong. | major | review | **ruled — sprint 48** |
| C212 | 47 | 🔴 **Nothing records whether a note was drafted from a transcript or written from memory, so the record cannot be read honestly.** `sessions.recording_consent` knows the answer; `session_notes` has no column for it and no screen shows it. A future therapist reading a patient's history sees eight notes and has no way to tell that three of them rest on a colleague's recollection of a session nobody recorded. That is the difference between evidence and hearsay, presented identically. **Ruling: a note carries its own provenance, stamped at save from the session's consent state, and it is shown everywhere a note is shown** including the clinician's view, the next clinician's view, the patient's own record, the export and the evidence screen. Three states: drafted from a full transcript, drafted from a partial one, written by the clinician with no recording. **What it costs:** an additive migration and four display surfaces, and some clinicians will not enjoy the third badge. It is still the truth. 2026-09-12. **AMENDED 2026-09-12:** provenance is on the **record**, never on the verification surface. `lib/data/export.ts:923` answers anyone holding a code, unauthenticated, so adding the mix there would let an insurer or an opposing party in a custody case read "8 sessions, 3 from memory" forever about somebody who disclosed one document for one purpose. And the badge is worded as **source, not quality** ("from the session recording" / "from the clinician's notes"), or it contradicts 47.5, which keeps a clinician note at source priority 1. | major | founder | **ruled — sprint 47** |
| C213 | 47 | **The part-recorded session has no name.** Consent granted, clinician presses off record for ten minutes, note drafted from what was captured. `offRecordGaps()` in `lib/data/feedback.ts:474` already computes exactly this and is read only by the radar investigation screen. **Ruling: the same function feeds the note's stamp.** A note from a session with gaps says so and says how long, because "partially recorded" without a duration is a badge nobody can act on. **What it costs:** one more read on the note save path. 2026-09-12. | minor | review | **ruled — sprint 47** |
| C214 | 47 | 🔴 **REWRITTEN 2026-09-12. The original premise was false and the ruling contradicted a shipped safety rule.** The first version said `lib/data/facts.ts` does not reference journals, so the bound could be placed before the door opened. It does: `journals` is imported at `:12`, `{ kind: "journal"; journalId }` is a first-class evidence kind at `:60`, a `journalId` column is written on every fact at `:75` and `:82`, and journal citations resolve at `:336-348`. The measurement failed because **the file contains two NUL bytes** (C245), so `grep -rn` answers `binary file matches` and prints nothing. Worse, the original ruling banned journals from producing "a risk level", while `journals.riskLevel` and `riskIndicators` already exist at `schema.ts:4441` **shipped under C123**, which ruled the opposite: a journal is scanned like a transcript and a high-risk one alerts the clinician holding a grant. Following the first version literally would have removed the alert that reaches somebody writing "I want to die" at 3am. **Ruling, corrected: alerting and inference are different paths and both rules stand.** C123 governs **safety** and is unchanged: scan, compute a risk level, alert the grant holder. C214 governs **inference**: no journal-derived fact may enter `facts.ts` with a domain of diagnosis or risk, and no copilot answer may cite a journal in support of a conclusion about the person. The bound is on the fact's domain **at write time in `lib/data/facts.ts`**, not in a prompt, so it cannot be lifted by a prompt change. **And this is a repair, not a greenfield guard: journal-derived facts already exist and the sprint must say what happens to them.** **What it costs:** a backfill decision on live rows, and a bound that is easy to state and fiddly to enforce because the same journal can legitimately support a quote and illegitimately support a conclusion. | major | **corrected by the build session, 2026-09-12** | **ruled — sprint 47** |
| C215 | 41 | 🔴 **Whoever creates the meeting holds the link, and a therapist holding it will eventually send it straight to the patient.** Not maliciously. Because it is one fewer step on a busy afternoon, and the consent screen then never happens. This is why sprint 36 built `session_sources` with no column that can hold a pasted link and why an external source requires `provisioned_at` and `provisioned_by_user_id`: a therapist pasting their own Zoom link is structurally excluded, and that was a decision rather than an omission. **Ruling: 24Therapy creates the meeting inside the therapist's connected account, or there is no external meeting.** A therapist who cannot connect Zoom uses the 24Therapy room, which already works. The therapist sees their own join link for their calendar and a line saying the patient gets a different one. **What it costs:** every external session needs an OAuth connection first, and clinics that block third-party Zoom apps cannot use this at all, which the Integrations page must say before they try rather than after. 2026-09-12. **AMENDED 2026-09-12:** "structurally excluded" was overstated. `external_meeting_id` is unconstrained `text` and a URL fits in it, so the exclusion is naming plus a convention. Make it true: a CHECK that the column contains no `://`, and `provisioned_at IS NOT NULL` whenever the kind is external. | major | founder | **ruled — sprint 41** |
| C216 | 41 | 🔴 **There is no bot button, and that is the design.** A button a therapist can forget is a session that silently went untranscribed; a button they can press is a bot that can be sent somewhere it should not go. **Ruling: the bot is dispatched by the patient's consent and by nothing else.** It joins at the moment consent is given, which is before the patient reaches the meeting, so the bot is already in the room when they arrive and nobody watches it appear mid-conversation. A decline dispatches no bot at all, not a bot that joins and stays quiet. This also settles the cost question the "knock like Google Meet" design loses on: Recall.ai bills per bot-hour, so joining at meeting creation means paying for bots on sessions that were declined. **The order for a paid session is: pay, then the AI question, then in, and declining still admits them.** Consent first would let them consent and then not pay; a consent wall after payment would be pressure applied to somebody who has already spent money. **What it costs:** the therapist has no manual override, so a session where consent arrives verbally and never through our page is a session with no transcript. 2026-09-12. **AMENDED 2026-09-12:** consent **authorises** the bot; the scheduler **dispatches** it, at a fixed lead time before the start or immediately if the session is already running. Dispatching at the moment of consent reintroduces the exact cost this ruling exists to avoid: a patient who consents at 09:02 for a 10:00 session bills 58 idle bot-minutes. A decline authorises nothing, so nothing is ever scheduled. | major | founder | **ruled — sprint 41** |
| C217 | 45 | **REWRITTEN 2026-09-12. Substantially overstated, and sprint 45 shrinks because of it.** The original said `ui_strings` reaches only four marketing files and that the two dictionaries never meet. Both wrong. `lib/i18n/server.ts:125` calls `stringsFor(locale)`, so **every server component already resolves admin overrides**, and `lib/i18n/strings.ts:139` already layers `overrides[key] ?? dictionary[key] ?? en[key]`. Two more claims were wrong: the dictionary holds **1,536** keys, not 1,116, and **Arabic is already complete at 1,536 of 1,536** with `ar: Record<MessageKey, string>` already making a gap a compile error, so 45.1 is satisfied before the sprint starts. `lib/i18n/authoring.ts:326` already lists every shipped key, so 45.4 is too. **The real defect is one thing:** `I18nProvider` at `lib/i18n/client.tsx:37` reads `DICTIONARIES[locale]` with no override path, so **the roughly 72 client components are override-blind** while the 53 server ones are not. An admin edits a string and sees it change on some screens and not others, which is more confusing than nothing changing. **Ruling: overrides reach client components through the provider, and only the keys that were actually overridden are serialised**, with the static dictionary underneath as the floor. That keeps the tree-shaking trade `client.tsx:9-17` made deliberately, makes the payload proportional to what an admin changed rather than to the size of the product, and leaves a failed read invisible. **What it costs:** far less than the first version claimed. Sprint 45 is days, not two weeks. | major | **corrected by the build session, 2026-09-12** | **ruled — sprint 45** |
| C218 | 50 | 🔴 **REWRITTEN 2026-09-12. The switch is not dead, and building the original ruling would have caused an incident.** The first version said `country_settings.enabled` is written and read by nobody, and ordered it removed. It has two consumers, both on the money path: `getCountrySettings` at `lib/settings/index.ts:102` returns `found && found.enabled ? found : null`, and `lib/billing/connect.ts:449` and `app/pay/[token]/actions.ts:50` both then refuse the payment with a sentence written for the patient. **Concretely: an operator closes Egypt to stop new signups, and today Mona's pay page refuses her card. Remove the column and the same act leaves the payment rail open in a country we have just decided we cannot operate in, while removing it from the radar.** The measurement failed for a reason worth more than the fix: the search was for the **column**, and the code reads it through an **accessor** that returns null. `lib/settings/index.ts` appeared in the search output and was not opened. **Ruling: a control is proved dead by its accessor and every caller of that accessor, never by the name of its column.** This is the §6 family in an operator-settings costume, and it is now a standing rule. **What it costs:** one more step before any switch is ever deleted, and it is the step that would have caught this. | blocker | **corrected by the build session, 2026-09-12** | **ruled — sprint 50** |
| C219 | 50 | 🔴 **REWRITTEN 2026-09-12. One switch was the wrong answer; two switches that answer two different questions is the right one.** The original saw `country_settings.enabled` governing nothing, the taxonomy entry governing onboarding, and the radar governing nothing, called it three surfaces with two switches and zero agreement, and ordered the collapse into one. But the two switches are not duplicates. **"Can we take money here" and "do we show this country" are different questions with different answers**, and there is a real state where we list a country for clinicians before the payment rail exists. Collapsing them destroys that state and, per C218, deletes a live guard. **Ruling: two switches, each named for the question it answers, and one admin action that sets both with each one's effect spelled out on the screen.** `country_settings` is the **money** switch and keeps its two payment consumers. The taxonomy entry is the **visibility** switch and gains the consumers it should always have had: the globe, the radar list, the radar filters and onboarding. A closed country is not rendered and not clickable, and `queryBoard` at `lib/data/radar.ts:245` is where that filter belongs, not in the route, which has no `where` at all. **A clinician already live in a country that closes is taken off the radar and told why; their patients, sessions and money are untouched.** The same visibility rule governs languages. **What it costs:** two controls to keep honest instead of one, and a naming discipline that is the only thing stopping somebody collapsing them again in six months. | blocker | **corrected by the build session, 2026-09-12** | **ruled — sprint 50** |
| C220 | 49 | 🔴 **`/admin/tv` predates eighteen sprints and answers none of the questions the business actually asks.** It cannot say how many sessions ran today, what share of patients consent to AI, what any of this costs us, or which therapist drives the most revenue. **Ruling: Total View is rebuilt as the operating picture of the company**, live counts, lifetime counts, today and custom ranges, revenue by source, cost by account, consent rate, and every one of them filterable by country and by date. The globe is the frame: clicking a country scopes the entire screen to it, and clearing returns to platform wide. **Every figure is a real query against the ledger and the usage tables, never a number computed in a component.** **What it costs:** several of these figures do not exist to be queried yet. C221 and C222 are the two that need new recording before the screen can be honest. 2026-09-12. | major | founder | **ruled — sprint 49** |
| C221 | 49 | 🔴 **We cannot say what a session costs us, because token usage is not recorded per model.** Total View is asked for cost by account and to spot a high-usage therapist, and there is nothing to spot it with. **Ruling: every model call records the exact model, input tokens, output tokens, the priced cost at the rate in force, and what it was for**, attributed to an organization, a therapist, a patient and where applicable a session. Prices live in settings so a rate change does not rewrite history, and a historical row keeps the cost it was priced at. **A call that cannot be attributed is still recorded, attributed to the platform, because an unattributable cost that silently disappears is how a margin goes wrong quietly.** **What it costs:** a write on every model call, and the free in-room copilot from C210 becomes a visible cost centre with no revenue line against it, which is the point. 2026-09-12. | major | founder | **ruled — sprint 49** |
| C222 | 49 | **"Revenue this patient influenced" is a real number and an easy one to state dishonestly.** A patient pays their therapist, not us; we earn the platform fee and, when they consent, the AI fee. So a patient does influence our revenue, and reporting it as *their* revenue would misdescribe who paid whom. **Ruling: three separate figures, never summed into one.** What the patient paid their therapist; what we earned in platform fees on their sessions; what we earned in AI fees they unlocked by consenting. The third is the one that makes the consent rate a commercial number rather than only an ethical one. **What it costs:** three columns where a dashboard would prefer one, and a briefing that has to explain the difference. 2026-09-12. | minor | founder | **ruled — sprint 49** |
| C223 | 46 | **Tiers are stored as session bundles and the founder is selling rate locks.** `SETTINGS_DEFAULTS.pricing.tiers` holds `{ rateCents, minimumSessions }`, which encodes "ten sessions at $3". The offer is now "$30 buys $30 of credit and unlocks the $2 AI rate". Those are different objects and the second cannot be expressed in the first. **Ruling: a tier is a price threshold and an AI rate, never a session count.** $30 unlocks $2 per AI session; $60 unlocks $1. The money bought is credit, spendable on any line item, platform fee or AI fee alike. The rate is what the money bought and it does not expire with the credit. **What it costs:** a migration on an existing settings blob, and the word "sessions" leaves the pricing page entirely. 2026-09-12. | major | founder | **ruled — sprint 46** |
| C224 | 48 | **Free means a therapist can open a room and never close it.** The in-room copilot costs real money and now has no meter on it, so the boundary has to be something other than a count. **Ruling: the free window is the session.** It opens when the room opens and closes when the session ends, Prepare me is one click per session, and outside a live session the ordinary earned allowance applies unchanged. A room left open past the session clock closes with it. **What it costs:** a therapist who wants to think about a case at midnight spends a credit, which is the existing behaviour and the correct one. 2026-09-12. **AMENDED 2026-09-12:** the window is not a bound. A session runs 50 minutes and a therapist can ask continuously for all of them, and the first person to find that will be the account with the most sponsored volume. **Free is uncapped in count but rate-limited to one request in flight plus a short cooldown, and one Prepare me.** Nobody in a real session notices; a loop does immediately. | minor | review | **ruled — sprint 48** |
| C225 | 52 | 🔴 **The promo films are the first artifact of this product that leaves the building, and they are made of screenshots of a clinical system.** A single real name, a real phone number or a real face in one frame of a marketing video is a disclosure that cannot be recalled, and the admin screens sweep is already a standing rule for exactly this reason. **Ruling: synthetic people only, generated by the seed, with names that cannot be mistaken for real ones, and the entire capture runs against a freshly purged database.** Every frame of all four films is reviewed against the same rule that governs the walkthrough screenshots, and the raw captures of admin surfaces are gitignored. **What it costs:** the films cannot be shot against any environment a real patient has ever touched, which means the last walkthrough and the capture run share one seeded database and one run. 2026-09-12. | major | review | **ruled — sprint 52** |
| C226 | 53 | 🔴 **The pot must be a payment method, not a second billing system.** The obvious build is a parallel path: corporate sessions, corporate invoices, corporate ledger accounts, a `sessionType` of `corporate`. That doubles every money code path in the product and guarantees the two drift. **Ruling: the pot stands in for the patient's card and nothing else changes.** The therapist is paid their own price, our commission comes out of it as always, VAT as always, and the therapist's own platform fee and AI fee stay theirs exactly as on any other session. One new ledger account for the pot, one new funding source at the point of payment, and no new session type. **What it costs:** a corporate session is indistinguishable from any other in every report that is not the corporate report, which is deliberate and which C242 requires anyway. 2026-09-12. **AMENDED 2026-09-12:** this ruling asserts that nothing changes downstream, it does not enforce it, and the one place money becomes visible to a clinician was not checked. See C243. Also state explicitly: **a sponsored session earns the platform fee from the therapist exactly as any other**, so the pot never subsidises our model spend and the free in-room copilot carries the same exposure it does everywhere else. | blocker | founder | **ruled — sprint 53** |
| C227 | 53 | 🔴 **REWRITTEN 2026-09-12, twice. The founder's third design is the one that ships.** Version one had the payer accept or reject each applicant, and the review broke it on the path nobody was looking at: **rejections are surfaced individually, and who fails an identifier match is disproportionately contractors, recent name changes and people on leave.** HR gets a short sharp list of exactly the people least able to absorb being on it, and no mass enrolment drive dilutes it. Version two was a bulk roster uploaded by the sponsor, which fixed the leak and created a worse one: a complete staff list for every client sitting in our database. **Version three, the founder's, removes the list entirely.** The sponsor is issued a **joining code**, also rendered as a **QR**, which they circulate internally and print. The sponsor separately defines **what identifier they require** (a work or university email on their domain, an employee or student ID, or both) and **the shape of a valid one**. A person signs up as an ordinary patient, taps join, enters the code or scans the QR while signed in, confirms the name and phone we already hold, and supplies the identifier. **Matching is automatic, against a shape and a domain, never against a list of people.** **Ruling: the sponsor never sees an enrolment event, never sees a rejection, never sees a join date, and performs no act about any individual.** Their only individual-level power is removal (C234), from the list of people already enrolled. We hold no roster, so there is nothing to breach and nothing to retain. **What it costs:** two real things, ruled separately. A shape is not an identity, so the gate is weaker than a list (C246), and without a roster we cannot detect that somebody has left (C247). | blocker | founder | **ruled — sprint 53** |
| C228 | 53 | 🔴 **The founder asked for a heatmap by week and by day. A day is an event; a week is a pattern.** Daily spend in a forty-person company, set beside a known incident, a layoff or a bereavement, identifies a person without a name being involved. **Ruling: weekly is the finest granularity that will ever exist, for any client, at any size.** Everything the payer actually wants from it, when demand spikes, whether exam season needs a bigger pot, whether the budget will last, is fully answered weekly. The heatmap plots **spend**, never session counts and never people. **What it costs:** we say no to a paying client asking for a chart, and we have to say why in a way that makes them trust us more rather than less. 2026-09-12. | major | founder | **ruled — sprint 53** |
| C229 | 53 | 🔴 **REWRITTEN 2026-09-12. The floor belongs on the denominator, not on the headcount.** The original suppressed reporting below a roster size, which the review broke with differencing: a sixty-person company is above any plausible headcount floor, but in week 14 the balance drops by exactly one session's cost, there was one session that week, and the payer knows one person went and which week. Set that beside somebody being signed off sick and it is a name. **Weekly granularity does not help when the count is small, and the count is small at the start of every contract and at the end of every budget.** **Ruling: suppress every figure, the balance included, for any period in which fewer than N sessions occurred, and roll the period forward until it clears N.** The sponsor reads "not enough activity to report yet", which is also an honest signal about their own enrolment drive. N is a setting, default five, and it governs the heatmap cell, the total and the balance delta alike. This replaces the headcount floor rather than joining it, because headcount was measuring the wrong population. **What it costs:** a new client sees almost nothing for their first weeks, which is exactly when they most want a chart. 2026-09-12. | major | **corrected by the build session, 2026-09-12** | **ruled — sprint 53** |
| C230 | 53 | 🔴 **A company is not an `organizations` row.** `organizations` is the therapist's practice, and every clinical query in the product is scoped by `actor.organizationId`. Putting a corporate client in that table would put a paying employer inside the tenancy boundary that separates clinical caseloads, which is the single worst place in this schema to put them. **Ruling: `sponsors` is a new table with its own auth, its own roles and no relationship to clinical scoping whatsoever.** A sponsor user is never an `Actor`. **What it costs:** a second small auth surface rather than a reused one. 2026-09-12. | blocker | review | **ruled — sprint 53** |
| C231 | 53 | **The patient notification log the founder asked for does not exist and cannot be borrowed.** `notifications` is keyed to `users.id`, which is the clinician and staff table; patients live in `patients` and `people` and authenticate through `patient_auth_sessions`. **Ruling: a patient notification log is net new, append only, and nothing in it is ever deleted.** A rejected enrolment leaves the main view when dismissed and stays in the history, which is what the founder described and is also the right answer for an audit. **What it costs:** a new table and a new patient screen, neither of which existed in any sprint before this one. 2026-09-12. **AMENDED 2026-09-12:** one log was wrong. A permanently undeletable entry saying an employer enrolled you and later removed you is a fact about the **employment relationship**, retained forever in a record C234 promises the payer cannot touch, and it travels if the record is ever exported. **Two logs: the patient's history keeps what happened to them, and a removal reads "your benefit has ended" with no employer named and no reason.** The payer's acts live in `audit`, where they already belong, and never enter a patient export. | minor | review | **ruled — sprint 53** |
| C232 | 53 | 🔴 **Holding $5,000 pots is money transmission at a scale §3c did not contemplate.** §3c already accepted holding therapist balances as a known risk with C73 open against it. A pot is different in kind: it is a prepayment from a corporate counterparty, held for months, spent by third parties. Ten clients is $50,000 of other people's money sitting on our balance sheet. **Ruling: build it, and put it in front of counsel before the second deal rather than the twentieth.** Every pot cent traces to one payment in and one session out in a real ledger, the daily reconciliation covers pots, and the refund and expiry terms (C233) are agreed before any money is taken. C73 is extended to name this explicitly so nobody is surprised later. **What it costs:** the exposure that was theoretical in §3c becomes concrete and dated. 2026-09-12. **AMENDED 2026-09-12:** the sequencing was backwards. C233 makes refund and expiry a precondition of the **first** deal, and refund terms are precisely what counsel will change, so building the pot and taking $5,000 first means a migration against real money. **Counsel answers one question, whether unspent pot balance is a liability we may hold, before ticket 53.10.** Everything else in sprint 53 proceeds in parallel. | blocker | founder | **ruled — sprint 53** |
| C233 | 53 | 🔴 **What happens to $3,000 left over when a client leaves.** Keeping it is a liability on our books and a story that ends a reference call. Refunding it all is a business that can be used as a float. **Ruling: decided and written on the page before a single deal is signed, never afterwards.** The default is refundable less what was spent, with a stated expiry, both shown on the top-up screen with the button. **What it costs:** a commercial decision that cannot be deferred, which is the point of the row. 2026-09-12. | major | founder | **ruled — sprint 53** |
| C234 | 53 | 🔴 **The employee who leaves the company.** Their badge, their funding and their record are three different things and a build that treats them as one will take the record. **Ruling: the payer can remove somebody from the roster, which ends the funding immediately and removes the badge. It does not touch the record, the grants, the journals, the summaries or the history, which were never the payer's.** The person is told their benefit ended, in neutral words, and everything else in the app is exactly as it was. **This is the strongest thing we can say to an employee and it should be said before they enrol, not after.** **What it costs:** nothing, and it is worth naming because the cheap implementation gets it wrong. 2026-09-12. | major | founder | **ruled — sprint 53** |
| C235 | 53 | 🔴 **Crisis is never gated on money.** An empty pot, a removed badge, a rejected enrolment or a suspended sponsor must not stand between a person and the crisis path. **Ruling: the SOS surface, the crisis numbers and the crisis routing are unconditional for every patient in the product, funded or not, enrolled or not, always.** Proved by a test that empties a pot and asserts the crisis surface is unchanged. **What it costs:** nothing. It is here because the money code will be written by somebody who is thinking about money. 2026-09-12. | blocker | review | **ruled — sprint 53** |
| C236 | 53 | **The picker showing every client's logo is a public list of our corporate customers.** Some will sign precisely on the condition that nobody knows. **Ruling: each sponsor chooses whether it is listed publicly or reachable only by its own code or QR.** Unlisted is the default, because the safe default is the private one and sales can ask for the other. **What it costs:** a slightly worse enrolment experience for clients who choose privacy, which is their trade to make. 2026-09-12. | minor | review | **ruled — sprint 53** |
| C237 | 53 | **The printed QR on an office wall is public, exactly as C120's clinic poster was.** Anybody can photograph it. **Ruling: identical to C120.** The code carries the sponsor's identity only, never a person and never an entitlement. Scanning opens enrolment and says which organisation; the identifier the sponsor requires is still demanded, and approval is still theirs. The code is short, revocable, and a dead one is answered with a sentence rather than a 404, because somebody is standing in a corridor reading it. **What it costs:** nothing new. The pattern exists. 2026-09-12. | minor | review | **ruled — sprint 53** |
| C238 | 53 | 🔴 **The sponsor defines the identifier fields, so the sponsor can ask for anything.** Left open, a client will ask for a national ID number, a manager's name, or a department, and we will have built a form that collects sensitive data on their behalf into our database. **Ruling: identifier fields exist to match a person to a roster and nothing else.** A capped number of fields, plain text or a choice from a list the sponsor supplies, never a national identifier, never health information, never free text a person could confess into. **We never return an identifier to the sponsor that they did not already hold.** **What it costs:** a client who wants a richer form is told no. 2026-09-12. | major | review | **ruled — sprint 53** |
| C239 | 53 | **A pot that empties between booking and joining.** **Ruling: a session that has started always completes and is always paid.** The pot may go one session negative per patient and the sponsor is invoiced for the shortfall. A patient is never stopped at the door of a session they were told was funded, and a therapist is never unpaid for work they did. **What it costs:** a small, bounded, deliberate credit exposure per sponsor. 2026-09-12. **AMENDED 2026-09-12:** "per patient" is the wrong unit and is unbounded in the direction that matters: a sponsor with 400 enrolled people and an empty pot can go 400 sessions negative at once, each individually permitted. **The overdraft is per sponsor**, a small number, a setting. A session already started still always completes; new bookings stop once the sponsor overdraft is spent. | minor | review | **ruled — sprint 53** |
| C240 | 53 | **An employer will eventually try to mandate attendance.** "Go to the sessions or it goes on your file." **Ruling: unenforceable through us, on purpose.** We never confirm attendance to a sponsor for any individual, so a mandate cannot be checked, and that is the correct outcome rather than a gap. It is stated in the contract and on the sponsor's own screen so nobody buys this expecting otherwise. **What it costs:** we lose the client who wanted that, which is a client worth losing. 2026-09-12. | minor | review | **ruled — sprint 53** |
| C241 | 53 | **A corporate client needs a real invoice, and Egypt's is not optional.** A $5,000 payment from a company finance department needs a receipt, a VAT invoice and proof of payment that survives an audit, and the Egyptian Tax Authority's electronic invoicing mandate covers exactly this kind of B2B transaction. **Ruling: the sponsor's documents are a first-class deliverable of this sprint, not a later polish.** Correct entity, correct VAT treatment, a document that looks like it came from a company rather than from a script, and the Egyptian e-invoicing requirement confirmed with counsel before the Egyptian entity takes a corporate payment. **What it costs:** the sprint carries a compliance dependency it cannot resolve alone. 2026-09-12. | major | review | **ruled — sprint 53** |
| C242 | 53 | 🔴 **A therapist must not be able to tell that a sponsor is paying.** A clinician who knows an employer funds the session may treat the person differently, may price differently, or may say something to the patient about it. **Ruling: nothing on any therapist surface distinguishes a sponsored session, and the therapist is paid their own price by the platform exactly as always.** This falls out of C226 rather than needing enforcement, which is the argument for C226. A verifier asserts no therapist-facing query or view can reach a sponsor row. **What it costs:** we cannot tell a therapist "you have corporate demand", which is a sales line we will want and must not use at the individual level. 2026-09-12. | major | review | **ruled — sprint 53** |
| C243 | 46 | 🔴 **`payerName` on the therapist's own ledger defeats the entire corporate wall, and the verifier written to catch it would have passed.** `sessionPayments.payerName` and `payerEmail` (`schema.ts:1616`) are read by `lib/data/vault.ts:141`, passed through `app/(app)/billing/page.tsx:156`, and rendered to the clinician at `components/billing/ledger.tsx:273` as `entry.payment.payerName ?? t("tled.patient")`. **A pot payment has no cardholder.** So either the sponsor's name lands in that column, which is a total leak, or it is null and the therapist's ledger shows a real name against every private patient and the word "Patient" against every sponsored one. Dr Hany sorts one column and knows which nine of his caseload the university across the road pays for. That is not an inference, it is a sorted list on a screen he opens monthly. **And 53.24's proposed check, "no therapist-facing query reaches a sponsor row", passes against it, because the leak is an absence.** Eighth occurrence of the §6 family. **Ruling: a therapist-facing money surface shows the patient and never the payer.** `payerName` and `payerEmail` leave the therapist's ledger **in sprint 46, before corporate exists**, replaced by the patient's own name from the chart, which is what the clinician actually needs and already has the right to see. C226 then delivers C242 by construction rather than by assertion, and **every corporate wall verifier asserts on rendered output, never on queries.** If a third party paid, that is a fact for the chart through the clinician's note, not a billing column. **What it costs:** a therapist loses a field some of them use to reconcile a family member's payment, and gains one that is correct. 2026-09-12. | blocker | **found by the build session, 2026-09-12** | **ruled — sprint 46** |
| C244 | 49 | 🔴 **The corporate wall is a property of the data, not of the audience, and sprint 49 builds the hole.** §3e states the wall around the sponsor's own screens. It says nothing about ours. Ticket 49.8 gives per-patient revenue figures, 49.10 makes everything filterable by country and date, and 49.6 adds by-therapist. An admin filters to one sponsor's country and one week and reads a per-patient revenue list. "The payer never learns" and "no 24Therapy employee can produce the list" are different promises, and the second is the one that breaks first, through a support agent with a screenshot. **Ruling: no screen in this product, the admin console included, may join a sponsor to a session, a booking, a date or a patient name.** Total View may show sponsor-level totals and it may show platform-level per-patient figures; it may never show both inside one filtered view. **Sprint 49 ships before sprint 53, so this binds the earlier sprint and must be written into it now rather than retrofitted.** **What it costs:** our own operators lose a query they would find useful, which is the price of the promise being true rather than advertised. 2026-09-12. | blocker | **found by the build session, 2026-09-12** | **ruled — sprints 49 and 53** |
| C245 | 45 | 🔴 **`lib/data/facts.ts` contains two NUL bytes, so `grep` calls it a binary file and silently prints nothing.** Lines 209 and 220, a NUL used as a separator between `fact.domain` and `fact.field`. It is the **only** such file in the repository and it is the clinical evidence layer, the single most safety-critical module in the product. Every grep-based audit run by any person or any session has been silently skipping it, which is how C214 came to be written backwards under a prompt that warned about exactly this failure family. **Ruling: replace the separator with a printable one, U+001F or a JSON-array key, and add a verifier that fails on any NUL byte in any `.ts` or `.tsx` file.** This is the first thing sprint 45 does, before anything else in this plan greps this repository again. **What it costs:** nothing. It is a separator character. 2026-09-12. | major | **found by the build session, 2026-09-12** | **ruled — sprint 45** |
| C246 | 53 | 🔴 **A shape is not an identity, and the joining code is printed on a wall.** The founder's enrolment design matches a person against a **format**, a domain or an ID pattern, rather than against a list, which is what removes the roster and everything wrong with it. The cost is that a format is guessable: a six-digit student number is six digits, and the QR that names the organisation is public by construction, exactly as C120's clinic poster was. Anyone who walks past a printed code and invents a plausible ID gets therapy funded from somebody else's pot. **Ruling: prefer an identifier we can prove over one we can only pattern-match, and say which is which to the sponsor at setup.** An **email on the sponsor's domain, verified by a one-time code sent to it**, is real proof of control, costs nothing, needs no roster, and is the recommended default. **An ID number matched only by shape is a weak gate, permitted, and the sponsor is told in plain words that it is guessable and that they carry that risk.** Underneath both: **one identifier may be used once, ever**; attempts per joining code are rate-limited; the code is short, revocable and rotatable; and an unusual spike alerts admin and the sponsor as a **number**, never as names. The damage is bounded by the pot and visible in the spend, which is the backstop rather than the control. **The joining code is a router, never an entitlement** (C120, C237): it says which organisation you are joining and grants nothing on its own. **What it costs:** we recommend against the identifier most companies will reach for first, and we have to explain why without implying their staff are dishonest. 2026-09-12. | blocker | founder | **ruled — sprint 53** |
| C247 | 53 | 🔴 **Without a roster we cannot tell that somebody has left.** This is the real price of the founder's design and it has to be named rather than discovered. An ex-employee's ID still matches the format, and their work email may keep working for months. Nothing in the product knows. **Ruling: verification is periodic, not one-time, and this is the strongest argument for preferring an email identifier.** Where the identifier is a verifiable address, re-verify on a schedule, a setting defaulting to six months, by sending a code. No reply, funding pauses and the person is told how to fix it. It requires no act by the sponsor and no roster. Where the identifier is an ID number there is nothing to re-verify, so the only correction is the sponsor's own removal from the enrolled list (C234), which is a further reason C246 prefers email. **What it costs:** a person on extended leave who cannot reach their work inbox has their benefit pause, which is a real and unfair outcome, so the pause must be reversible by us in one step and must never touch their record. 2026-09-12. | major | review | **ruled — sprint 53** |
| C248 | 53 | **The identifier example we show makes guessing easier.** The sponsor supplies the shape of a valid identifier so a person knows what to type, and the obvious implementation prints it: "for example, 20215544". That is a working template handed to anybody who scans a poster. **Ruling: the example is a description of the shape, never a specimen value.** "Eight digits beginning with your year of entry" rather than a number that would itself pass. The same rule covers the domain hint, which may name the domain, because a domain is public, and may never show a sample local part. **What it costs:** a slightly worse enrolment screen for people who read poorly, against a materially harder gate. 2026-09-12. | minor | review | **ruled — sprint 53** |
| C249 | 53 | **One person, two sponsors.** A postgraduate student who also works part-time can hold two valid identifiers, and the obvious build funds a session twice or picks arbitrarily. **Ruling: a patient may be enrolled with more than one sponsor and exactly one is primary, chosen by the patient and changeable by them. The primary pot pays.** Neither sponsor ever learns the other exists, which follows from C227 because neither sees anything about an individual beyond the enrolled list they already hold. **What it costs:** one more setting on a patient screen, and a support case the first time somebody's primary pot is empty while the other has money. 2026-09-12. | minor | review | **ruled — sprint 53** |
| C250 | 53 | **Enrolment is never retroactive.** A person already in paid therapy who then enrols would, on the obvious build, either see past sessions refunded, or see their therapist's paid history change, or both. **Ruling: the pot funds sessions from the moment of enrolment forward and touches nothing before it.** No refund, no re-billing, and no change visible to the therapist, which C242 requires anyway. The person is told plainly on the enrolment screen that it starts now. **What it costs:** somebody who enrols the day after paying for a session is out of pocket for that one, and will ask. 2026-09-12. | minor | review | **ruled — sprint 53** |
| C251 | 46 | 🔴 **Two line items cannot be an additive migration, because one invoice per session is enforced in the database, and the reconciler goes blind either way.** `uniqueIndex("invoices_session_unique").on(t.sessionId)` at `schema.ts:1569` permits exactly one invoice row per session, and it is there because it fixed a real double-charge race. So 46.1's "two line items on one invoice" is either a new `invoice_lines` child table, which is not the additive change the ticket implies, or dropping the index, which deletes that idempotency. **And separately**: `reconcileMissingCharges` at `lib/billing/service.ts:520` finds orphans with `leftJoin(invoices) ... isNull(invoices.id)`, meaning "this session has no invoice". With two lines, a session whose platform fee posted and whose AI fee failed **has** an invoice and is never reconciled, silently, forever. **Ruling: a child `invoice_lines` table, the unique index kept exactly as it is, and the reconciler rewritten to check per line kind rather than per invoice.** The idempotency that stopped a real double charge is not traded for a billing shape. **What it costs:** more work than 46.1 assumed, and every reader of an invoice total changes. 2026-09-12. | blocker | **found by the build session, 2026-09-12** | **ruled — sprint 46** |
| C252 | 46 | **`users.sessionRateCents` and `pricing.tiers[].rateCents` are unrelated fields sharing a name, across more than forty call sites.** One is the therapist's own price to their patient; the other is our fee to the therapist. C223 renames the second, and it will be done with a search and replace that hits the first. A therapist's price silently becoming our fee is a money defect that typechecks. **Ruling: rename both, not one, in the same commit, to names that cannot be confused**, and land the rename before any other ticket in sprint 46 touches billing. **What it costs:** a large mechanical diff at the start of the sprint rather than a small one in the middle of it, which is the cheaper order. 2026-09-12. | major | **found by the build session, 2026-09-12** | **ruled — sprint 46** |
| C253 | 46 | **Nothing proves the crisis path is independent of billing state, and the split fee is about to touch every billing path.** 53.23 asks for a test that empties a pot and asserts the crisis surface is unchanged, which is right and is scheduled in the wrong sprint: sprint 46 rewrites the charge path months earlier and could break the independence before the test that guards it exists. **Ruling: the test is written in sprint 46, not 53**, and it asserts the crisis surface against every billing state we can construct: no credit, unpaid invoice, suspended account, and later an empty pot. **What it costs:** nothing, and it is the cheapest ticket in the sprint. 2026-09-12. | major | **found by the build session, 2026-09-12** | **ruled — sprint 46** |
| C254 | 50 | **The radar board is cached in process, so the country filter will appear not to work.** `lib/data/radar.ts:201-234` is a TTL cache invalidated only by `invalidateRadarBoard()`, per instance. An operator closes a country, reloads the public radar, and sees it still there, which is **exactly the symptom that produced C218 in the first place** and would be diagnosed as the same bug a second time. **Ruling: the admin write path calls `invalidateRadarBoard()`, and 50.5's verifier invalidates explicitly before asserting**, or it will pass and fail for cache reasons rather than query reasons and prove nothing either way. **What it costs:** nothing, and forgetting it costs a day of somebody re-finding C218. 2026-09-12. | minor | **found by the build session, 2026-09-12** | **ruled — sprint 50** |
| C255 | 53 | 🔴 **An HR integration is the obvious way to re-introduce the roster we just spent three designs removing.** Every HR platform worth integrating (Workday, SuccessFactors, BambooHR, Oracle HCM, Personio, Zoho People) and every aggregator over them (Merge, Finch) is built around **provisioning**: pull the directory, sync it, keep it. SCIM, the actual standard here, is a directory push. Build any of that and we hold a complete staff list for every client, which is exactly what C227's third design exists to avoid. **Ruling: the integration answers a question about one person we already hold, and never enumerates.** "Is this identifier, which somebody has already given us, currently an active employee?" Yes or no, plus a timestamp. **No directory read, no sync, no store, no list endpoint, ever.** Where an HR API only offers a full listing, we do not integrate with it in v1 rather than accepting the dump. **What it costs:** we decline integrations that would be easy, and we can never answer "how many of your staff are enrolled" as a share of headcount, because we do not know the headcount. 2026-09-12. | blocker | founder | **ruled — sprints 53 and 55** |
| C256 | 53 | 🔴 **"Last verified" leaks the join date, which §3e forbids.** The founder wants the sponsor to see each enrolled person's name and when they were last verified, which is right and necessary for a roster to be trustworthy. But if re-verification is anchored to each person's own enrolment date, then the last-verified date **is** the enrolment date shifted by a whole number of cycles, and a sponsor can read off who joined the week after a restructure was announced. **Ruling: the cycle is per sponsor on a fixed calendar, not per person from their enrolment.** Everybody in one organisation is checked in the same window, so the date is the same for everybody and carries no signal about anybody. **What it costs:** somebody who enrols the day before a cycle is verified almost immediately and again three months later, which is harmless and looks odd once. 2026-09-12. | major | review | **ruled — sprint 53** |
| C257 | 53 | **A three-month re-verification is a recurring interruption to a mental health benefit, which is a harder thing than it sounds.** Reached on WhatsApp and email, it lands on somebody who may be in the middle of treatment, and a missed message pauses their funding. **Ruling: the message says what it is for in one sentence and never implies anything about use** ("confirming your work address keeps your benefit"), it is sent more than once before anything pauses, a pause is **reversible by us in one step**, and 🔴 **a pause never touches the record, the grants, the journals, the summaries or the history**. A person on extended leave who cannot reach a work inbox is the case this must not punish, so a paused person can always reach support and can always keep paying for themselves. **What it costs:** an operational load every quarter, and a real risk of pausing exactly the people least able to chase an email. 2026-09-12. | major | review | **ruled — sprint 53** |
| C258 | 53 | **"Left" and "graduated" are employment and enrolment facts written by an employer about a person, into a health product's database.** Left open, the field becomes free text and somebody writes a reason nobody should ever write. **Ruling: a fixed list, never free text**, holding only what the founder named: left the organisation, graduated, no longer eligible. It ends funding and the badge, it is visible to the person as "your benefit has ended", and 🔴 **the reason is never shown to the person and never enters their record or any export**, because it is a fact about their employer, not about them. 2026-09-12. | minor | review | **ruled — sprint 53** |
| C259 | 54 | 🔴 **A clinic is an `organizations` row and a sponsor is not, and building either one the other way is a disaster.** They look like the same problem, an outside body with users and money, and they have opposite answers. A clinic **employs clinicians and its therapists' patients sit inside its tenancy**, which is precisely what `actor.organizationId` already scopes across 63 queries in 33 files, so a clinic is the organization and a **clinic manager is a new kind of user inside it holding zero clinical access**. A sponsor **pays for care it must never see**, so putting it in `organizations` would place a paying employer inside the boundary that separates caseloads (C230). **Ruling: clinic inside, sponsor outside, written at the top of both sprints**, because a build session reading the two sprints back to back will otherwise reuse one table for both and take four weeks to discover why. **What it costs:** two mechanisms that look similar and are deliberately not shared. 2026-09-12. | blocker | founder | **ruled — sprints 53 and 54** |
| C260 | 54 | 🔴 **A patient's name plus their clinician plus the time IS clinical information, and the clinic sees all three.** It says this person is in therapy, with this clinician, at this hour. Every clinic on earth works this way and a receptionist has always known who is coming, so it is defensible, but only if the line is drawn somewhere a patient can be told. Employment is the wrong line: a patient who booked a stranger from the radar never agreed to be visible to that stranger's practice manager. **Ruling: the line is money. A clinic sees the patients of sessions the clinic is paying for**, which is every session on a clinic-attached therapist's account (C261), and the clinician's practice is already named on the public profile before anybody books. **And the list is a name and an appointment time. Nothing else, in any form**: no note, transcript, journal, summary, risk, diagnosis, evidence panel or copilot, asserted by a verifier against a clinic manager principal rather than argued. **What it costs:** a patient loses the ability to see a clinic-employed clinician without that clinic knowing, which is true of every clinic in the world and must still be said before booking. 2026-09-12. | blocker | founder | **ruled — sprint 54** |
| C261 | 54 | 🔴 **A therapist under a clinic with some private patients is an unanswerable question asked hundreds of times a day.** Per session, who pays, who sees the name, who sees the schedule, what happens when it changes. Any per-session toggle is a control somebody will set wrongly on the session that mattered. **Ruling: a therapist under a clinic has no private patients on that account.** Every session belongs to the clinic, the clinic pays the platform fee and the AI fee, and the clinic sees the name and the time. A clinician who wants private work keeps a **separate solo account**, which is honest and costs them nothing. 🔴 **It is stated in the invitation, before they accept, not discovered afterwards.** **What it costs:** a clinician with a mixed practice manages two sign-ins, and some will not join because of it. 2026-09-12. | major | founder | **ruled — sprint 54** |
| C262 | 54 | **A three-therapist clinic is C229 again, wearing a different coat.** The denominator floor was written for sponsors and the same arithmetic applies here: usage broken down by therapist, in a practice with three of them, in a week with four sessions, is a statement about individuals. And the individuals are now the clinic's own employees, which is a different harm from a sponsor's but not a smaller one. **Ruling: the same denominator floor governs clinic reporting.** Below N sessions in a period, the clinic sees the bill and nothing else. It is the same setting and the same code path as C229, not a second implementation. 2026-09-12. | major | review | **ruled — sprint 54** |
| C263 | 54 | 🔴 **The clinic pays the AI fee, the AI fee exists only on patient consent, so a clinic bill discloses who consented.** Dr Salma has four patients this week and the clinic's invoice shows three AI fees. In a caseload that small, set beside the schedule the clinic can already see (C260), that is a named patient's consent decision reaching their clinician's employer. **Consent is the most protected choice in this product and the billing line gives it away.** **Ruling: a clinic's invoice is aggregated and never itemised to a session.** A total platform fee, a total AI fee, a session count, and the C262 floor underneath all three. The itemised breakdown stays with the therapist, whose own patients they are. **What it costs:** a practice manager reconciling an invoice cannot tie a line to a session, which is a genuine accounting inconvenience and the correct trade. 2026-09-12. | blocker | review | **ruled — sprint 54** |
| C264 | 55 | 🔴 **`routeDecision` is a pure function of two booleans with its own test suite, and there are about to be six principals.** `middleware.ts:69` and `lib/routing.ts:80` decide where somebody goes from `{ clinician, patient, expired }`. Sponsor, clinic manager and partner developer are three more, each with their own portal, their own sign-in and their own idea of what `/` means. Bolted on one at a time, this becomes the function nobody can reason about and every new portal breaks a redirect for an existing one. **Ruling: the router is rewritten once, for all six, before the second new portal is built**, with the existing suite extended to a case per principal rather than a boolean per principal. And 🔴 **no `require*` in `lib/auth/guard.ts` may ever return a sponsor or a partner as an `Actor`**, asserted by a verifier, because that is the seam C230 and C259 both rest on. **What it costs:** sprint 53 pays for work sprints 54 and 55 benefit from, which is the cheap order. 2026-09-12. | blocker | review | **ruled — sprints 53, 54, 55** |
| C265 | 55 | 🔴 **An API key that can ask "does this person work here" is an identity oracle, and it is pointed at our own patients.** The employment-verification endpoint takes an identifier and returns a boolean. Give that key to a partner, or leak it, and somebody can test addresses and IDs against a company's directory at machine speed, using our infrastructure. **Ruling: the endpoint is scoped to one sponsor, rate-limited hard, and only ever answers about an identifier a person has themselves submitted through enrolment in the last few minutes.** It is not a lookup API; it is a step inside one flow, and it can never be called with an identifier nobody offered. Every call is audited with the sponsor, the key and the outcome, and an abnormal rate suspends the key rather than alerting somebody to read a chart later. **What it costs:** the integration cannot be used for the bulk checks a client will eventually want, which is C255 restated and is the same answer. 2026-09-12. | blocker | review | **ruled — sprint 55** |
| C266 | 43 | **Whose EHR connection is it, and what happens when the therapist leaves.** The founder wants a clinic to connect the hospital's EHR once for all its clinicians, and a solo therapist to connect their own. `ehr_connections` (43.1) has no owner concept for either. And a clinician who leaves a clinic leaves behind a connection that was never theirs, holding tokens that reach a hospital's patient records. **Ruling: a connection is owned by the organization, and a solo therapist is an organization of one**, which is already how tenancy works and needs no second mechanism. A therapist leaving a clinic loses the connection with the clinic, immediately and without a question, because the credential was the hospital's. Their own record of their own patients is untouched, which is C234's rule in a different setting. **What it costs:** a solo clinician who later joins a clinic reconnects once. 2026-09-12. | major | founder | **ruled — sprints 43 and 54** |
| C267 | 54 | 🔴 **A clinic cannot vouch for a licence.** The obvious build lets a hospital add its therapists and mark them verified, because the hospital employs them and already checked. Accept that once and the entire "only certified therapists" claim becomes "certified, or somebody said so", and the database invariant from C106 is bypassed by the most credible-looking route available. **Ruling: an invited clinician verifies themselves exactly as a solo one does, and the clinic's word is not evidence.** The clinic sees that verification is pending and can chase; it can never complete it. **What it costs:** friction in the exact moment a hospital is onboarding twenty people and wants it to be quick, which is the moment the rule is most needed. 2026-09-12. | blocker | founder | **ruled — sprint 54** |
| C268 | 52 | **Six portals is six design surfaces, and 37R.8 has still not answered whether even one of them looks finished.** The films in sprint 52 were scoped for three user types when there were three. **Ruling: the final walkthrough covers all six and the split-screen film covers every cross-portal flow**, of which there are now several that did not exist: a sponsor funding a session a patient never pays for, a clinic seeing an appointment its therapist just booked, a partner's call landing in a chart. **What it costs:** sprint 52 grows, and it was already the longest thing at the end of the plan. 2026-09-12. | major | review | **ruled — sprint 52** |
| C269 | 48 | **The second-opinion clinician can read but cannot ask.** Copilot credit is earned by completed sessions, so a clinician a patient invites purely to review a history has our best feature switched off on the one visit where it matters. Today a floor applies to everyone by accident rather than by decision. **Ruling: a grant with no session carries a small, fixed, free, read-only allowance, deliberately, capped and non-rolling.** It is enough to form a view and not enough to run a practice on. **What it costs:** model spend on a clinician who may never book, which is the cost of the portability pitch being real. 2026-09-12. | major | founder | **ruled — sprint 48** |
| C270 | 47 | 🔴 **Couples and family: one transcript, two people, two charts, and nobody decided whose.** Diarisation shipped in 37, so the recording works and the question is now live. Splitting the transcript across both charts puts each partner's disclosures in the other's record, permanently, discoverable by any future clinician either of them ever grants. **Ruling: a couples session belongs to one chart, the person who booked.** The other participant is a **named voice, never a second patient record**. Two charts requires two patients, two grants and two consents, which is a later product and not a default. **And the booking screen says which chart it lands in, before the session.** **What it costs:** the partner who did not book has no record of a session they were in, which is the correct trade and will be asked about. 2026-09-12. | major | founder | **ruled — sprint 47** |
| C271 | 54 | **Supervision is a real Egyptian market and there is no supervisor.** Training institutes carry many supervised practitioners, and selling one institute sells its whole cohort. **Ruling: a supervisor is a clinician holding a grant, like anybody else. No role ever grants clinical access.** What the institute gets is the C260 clinic view: schedules, usage, bills, names and times. The clinical read happens because a patient granted it to a named, verified clinician, and for no other reason. **What it costs:** an institute cannot review a trainee's notes without the patient's involvement, which is a constraint some of them will not accept. 2026-09-12. | major | founder | **ruled — sprint 54** |
| C272 | 51 | **A therapist who dies, emigrates or simply stops has a caseload nobody maintains**, and those patients' records sit behind an account that will never answer. **Ruling: a caseload with no active clinician for a set period raises an admin alert, and those patients are told they can claim their record.** They are never told why. A clinician can also hand a caseload over deliberately, which is the same mechanism used on purpose. **What it costs:** a dormancy threshold somebody has to choose, and it will be wrong for the clinician on parental leave. 2026-09-12. | minor | founder | **ruled — sprint 51** |
| C273 | 51 | **One five-star rating outranks forty at 4.8.** A marketplace ranked on an average with no volume floor rewards the newest account, which is the opposite of what a patient in distress needs. **Ruling: no public rating below a volume threshold, and rank is never rating alone.** We already never reveal who wrote one. **What it costs:** a genuinely excellent new clinician looks unrated for a while. 2026-09-12. | minor | review | **ruled — sprint 51** |
| C274 | 51 | **Diaspora pricing arbitrage.** The same Egyptian clinician could charge $20 to a patient in Dubai and $8 in Cairo, and the obvious feature request is for us to do it for them. **Ruling: a clinician sets one price, shown before booking. We never geo-price on their behalf, and we never hide that a clinician is abroad.** **What it costs:** we decline a revenue optimisation that would work, because the version of this product where the price depends on where you are standing is not one a patient can trust. 2026-09-12. | minor | founder | **ruled — sprint 51** |
| C275 | 51 | 🔴 **"24/7" is in the company name and we cannot staff it.** A patient reading it at 3am is entitled to think somebody is there. **Ruling: 24/7 describes the radar being open, never that anybody will answer, and no response-time promise appears anywhere in this product, ever.** The crisis line is the thing that is always on, and it is not us. **What it costs:** the strongest-sounding version of our own name is the one we may not use. 2026-09-12. | major | founder | **ruled — sprint 51** |
| C276 | 47 | **A patient holding two grants is either getting a second opinion or shopping for a different answer, and we cannot tell which.** **Ruling: not our call, and not hidden either. Each clinician sees that co-treatment exists; who the other clinician is stays private.** Concealing it is how somebody ends up double-prescribed, and every paper chart in the world records concurrent care. **What it costs:** a patient loses the ability to see somebody in complete secrecy from their existing clinician, which is a real thing some people want and a worse thing to build. 2026-09-12. | major | founder | **ruled — sprint 47** |
| C277 | 55 | **The partner plane collides with the patient's ownership claim.** If a platform embeds us, whose patient is it? **Ruling: the record is the patient's. A partner's clinician holds a grant exactly like any other clinician: scoped, revocable, and the patient can claim the record and leave.** Otherwise our one promise is false for every partner-sourced patient, which is most of them if the partner plane works. **What it costs:** a partner cannot be sold "your patients stay yours", and the honest pitch is the opposite one. 2026-09-12. | major | founder | **ruled — sprint 55** |
| C278 | 56 | 🔴 **Assessments are licensed instruments and a score is not a diagnosis.** PHQ-9 and GAD-7 are free to use; Beck's inventories are licensed and cost money, and shipping one without a licence is a legal problem with a rights-holder attached. Separately, a number shown to a patient beside the word "depression" is a conclusion reaching them without a clinician, which C113 forbids. **Ruling: only free-to-use instruments in v1, each naming its source on the screen; and a patient sees their answers and their trend, never a verdict.** The word "depression" never appears next to a number on a patient screen. **What it costs:** the instrument a clinician asks for first may be one we cannot ship. 2026-09-12. | major | founder | **ruled — sprint 56** |

---

## §3 · THE MODEL

Read this before any sprint. Every sprint below assumes it.

### Patient records have two states

| | **Unclaimed** | **Claimed** |
|---|---|---|
| What it is | The therapist's own file, like paper in a drawer | A person's portable profile |
| Who reads it | Only the therapist who made it | The patient, plus whoever they grant |
| Shareable | 🔴 **Never** | Only with consent |
| Mergeable | 🔴 **Never** | Yes, the patient confirms |

**46 of 56 existing patients have no email.** Unclaimed is the normal state, not
the edge case. Nothing unclaimed may be shared, because there is nobody to ask.

### How a record gets claimed

| Step | |
|---|---|
| 1 | Therapist adds a patient with **email or phone** |
| 2 | That person later signs up with the same email or phone |
| 3 | We ask: *"Have you ever seen Dr X?"* — yes / no |
| 4 | If yes, they confirm the **first and last name on file**, shown redacted — `H••••• A•••••` |
| 5 | Correct → **Claim account** → verification sent by email or WhatsApp |
| 6 | Verified → the uploaded history merges into their profile |
| 7 | 🔴 **We ask whether the therapist keeps access. Default is OFF.** The patient chooses |
| 8 | If they say no, that therapist keeps only what they uploaded themselves — no new sessions, no live profile |

A first-time signup may match **several** unclaimed profiles. Same flow, one at
a time.

### The third route: an invite the therapist hands over

**46 of 56 existing patients have neither an email nor a phone number**
(measured, not estimated). Matching on contact details finds nothing for 82% of
the existing book, so contact details cannot be the only way in.

| Step | |
|---|---|
| 1 | Therapist opens an unclaimed record and generates an **invite link** |
| 2 | The link is bound to **that specific record**, not to an address |
| 3 | They hand it over — in the room, by WhatsApp, on paper. We do not send it |
| 4 | Whoever opens it and signs up claims **that** record. No name confirmation step: the therapist already did the identifying |
| 5 | Single use, expires, revocable. From step 7 of the flow above onwards it is identical — including the therapist's access defaulting to **OFF** |

🔴 **A record nobody ever claims stays a private file. That is a valid ending,
not a failure.** Most of these 46 will never be claimed, and the product must
not treat that as a queue to be drained.

### The copilot has four states per patient

| State | What the therapist gets |
|---|---|
| **Unclaimed, documented** | Full copilot over what they uploaded. **5 message credits**, unlocked only after adding the patient **and** a diagnosis **and** written or dictated history |
| **Claimed, access granted** | Full copilot — live profile, files, diagnosis, sessions |
| **Claimed, access revoked** | 🔴 **Degraded.** Their own transcripts, their own notes, docs they uploaded, and the old chat — readable but no longer connected. **No** live profile, **no** files, **no** diagnosis changes. Banner explains it. "Request access" with a note, rate-limited |
| **No relationship** | This session's transcript only |

**Revoking stops new reading. It cannot un-read what was already seen** — the
old chat stays. Say that plainly to the therapist; do not alarm the patient with
it.

### Consent lives in the room, and moves

Two controls, side by side, both visible, both changeable mid-session:

| Control | |
|---|---|
| **Record this session** | Off → on at any moment |
| **Share my profile** | Off → on at any moment |

| Rule | |
|---|---|
| Answered yes before joining | No prompt. Nothing shown |
| Answered no | Prompt stays, with what they gain: their own profile, notes that travel, revoke anyone |
| Turns it on at minute 10 | 🔴 **Minutes 0–10 were never recorded and do not exist.** The note is stamped *"recording began at 10:32; earlier conversation not captured"* |
| Wants to turn it off | Cannot. End the session; answer no next time |

### Money

| Line | Rule |
|---|---|
| **Session bill** | Therapist pays for the AI used, at whichever rate their bundle bought |
| **Platform cut** | **15% of any session the patient paid for.** Free links take no cut |
| **VAT** | By country. Egypt **14%**. **The patient pays it, on top of everything** |
| Worked example | $30 session → patient pays **$34.20** · $4.20 VAT · $4.50 our cut · $25.50 to the therapist · plus the therapist's own session bill |
| Refunds | Our cut is refunded. **VAT is not** |
| Price cap | **$500** per session. Currently **$1,000** in code — lower it |
| Free links | Allowed. No cut, but the session bill still applies |
| In-person | Always free. Paid at the clinic, we take nothing |

### Pricing — one rate, bought in a minimum quantity

Not subscriptions. A therapist buys sessions at a rate, and the rate is set by
how many they buy at once.

| Tier | Rate | Minimum | Costs them |
|---|---|---|---|
| **PAYG** | **$4.00**/session | 0 | pay as they go |
| **Starter** | **$3.00**/session | 10 sessions | $30 |
| **Growth** | **$2.00**/session | 30 sessions | $60 |

Above a minimum they buy as many as they like at the same rate — a slider, not
a fixed pack.

| Rule | |
|---|---|
| Credits expire | **12 months** |
| Downgrade | Keep every unused credit. They are consumed first, then the new rate applies |
| Buying more at a better rate | Allowed any time. It does not touch the existing balance |
| Copilot per patient | **10 messages per session**, rolls over on that patient, expires 12 months |
| Unclaimed patient | **5 credits**, unlocked by documenting them |
| General chat | **50 messages per calendar month**, across any number of threads |

**Margin at each rate**, against a measured cost of ~$0.97 for a 60-minute
session — transcription, note, in-session copilot and video:

| Tier | Charge | Cost | Margin |
|---|---|---|---|
| PAYG | $4.00 | $0.97 | **$3.03 · 76%** |
| Starter | $3.00 | $0.97 | **$2.03 · 68%** |
| Growth | $2.00 | $0.97 | **$1.03 · 52%** |

The 15% cut on paid sessions is on top of all three.

### Production today — none of the above is live

| | Now | Target |
|---|---|---|
| PAYG rate | **$6.00** (`plans.ts`) | $4.00 |
| Plans | `payg` + `unlimited $99/mo` | PAYG · Starter · Growth |
| Platform cut | **10%** (`PLATFORM_FEE_BPS = 1000`) | 15% |
| Price cap | **$1,000** | $500 |

**Move every therapist to PAYG, including unlimited subscribers.** They are demo
accounts under test by real clinicians — no real revenue, nobody to notify. The
ledger holds 2 rows and no payment has ever been taken, so nothing real breaks.

🔴 **Every figure above lives in an admin-editable table, not in code.** Rates,
tiers, included sessions, copilot limits, VAT per country, the cap.

---

## §3b · IDENTITY IS A PHONE NUMBER, AND AN EMAIL WHEN THERE IS ONE

Sprints 5–7 built the person layer around email, with the phone optional.
That was wrong for this market. In Egypt and the Gulf the number is the
identity and WhatsApp is the channel; the email often does not exist.

🔴 **Founder decision, 2026-09-06 — the number is required, the address is
not, and neither one is the *only* way in.** Sprint 13 read "identity is a
phone number" as "identity is a phone number and nothing else", and built an
account that still demanded an email and a password anyway. Both halves were
wrong. The rule is simpler than either:

| Somebody signs up with… | Then… |
|---|---|
| **an email** | 🔴 **the phone number is required too.** No account exists without one |
| **a phone number** | the email is **optional**. Adding it completes the profile and turns on email notification |
| **both** | the ordinary case, and the one to design the form around |

So: **the phone is mandatory on every account. The email is optional on every
account.** A password is set either way, as normal. Sign-in accepts *either*
handle plus that password — an address is a real way in, not a decoration —
and every notification goes to WhatsApp, plus email when there is an address.
Identity is not locked to the phone; the phone is only the one part that is
never missing.

**The invariants — one for each handle:**

> **One phone number, one patient account.** A second account can never claim
> a number that is already claimed. **Two therapists may hold the same
> number** — two clinicians really do see the same person — and when that
> person signs up they see *both* claim requests and answer each separately.

> **One email address, one patient account — when there is an address.** Many
> accounts legitimately have none, so the uniqueness holds only over the rows
> that have one. NULLs do not collide and must not be made to.

**How a record becomes somebody's, end to end:**

| | |
|---|---|
| 1 | The therapist adds a patient. **The phone number is mandatory**, and the form says why: *"so you can invite them to join by WhatsApp"* |
| 2 | The therapist presses **invite**, on that record. A WhatsApp message goes to that number with a link |
| 3 | The link opens signup with the number filled in and locked |
| 4 | A verification code arrives on WhatsApp. Entering it **proves the number** |
| 5 | 🔴 It does **not** prove which record is theirs. So, per record: *"Have you seen this therapist before?"* — yes or no |
| 6 | Only on **yes**: *"What name did you give them?"* — checked against the record, never shown first |
| 7 | Passing both claims that record. **No** ends it for that record and is remembered, so nobody is asked twice |
| 8 | Two therapists, one number → **two** requests, answered one at a time. Claiming one never claims the other |
| — | **Email is a complete fallback for all of it** — same invite, same code, same two questions |

🔴 **The failure to design against is not a stranger attacking. It is a
mis-match.** A recycled number, a shared household phone, a mistyped digit.
Proving the phone is necessary and not sufficient, which is the entire reason
for steps 5 and 6, and why the name is asked *after* the yes and is never
displayed as a prompt.

**What two handles costs, and where it is paid:**

| | |
|---|---|
| **Password reset** | Must work for an account with **no email**, so the reset code goes over WhatsApp. ⚠️ That path is only proven once the Meta templates are approved — until then, an account with no address can be created but cannot recover a forgotten password. Say so on the form |
| **Two ways in, two ways to lose it** | Sign-in by phone *or* email means a takeover of either handle is a takeover of the account. Changing **either** notifies **both**, always |
| **Changing an email** | Not the phone's 90-day discipline (§3d 20.14). The phone is the identity that cannot be missing; the email is a contact detail. It notifies the old address and the phone, and it is refused if the new address is on another live account |
| **Notification** | WhatsApp is the channel that always exists. Email is sent **as well**, never *instead*, whenever there is an address |

## §3c · MONEY — two entities, two rails, and one deliberate exception

**1.8 said: never hold a therapist's money.** That rule was right and the
reason has not changed — holding funds and paying them out later is money
transmission, which in the US means licences in roughly 48 states with bonds
from $50k, and in Egypt and the UAE means central-bank licensing.

**The founder is changing that rule knowingly**, because the product cannot
work in Egypt without it: an Egyptian therapist cannot hold a Stripe Connect
account, and an Egyptian patient cannot pay one. So:

| | International | Egypt |
|---|---|---|
| Patients pay | **USD via Stripe.** UAE and the rest of MENA included | **EGP** via a local collection provider |
| Therapists are paid | **Stripe Connect**, destination charges — we never touch it | **Manually**, from the Egyptian entity, on request |
| Payout methods | Whatever Connect supports | **InstaPay** or an **EGP mobile wallet**, plus the full name exactly as it appears on that account |
| Fulfilled by | Stripe | A 24/7 team of three, from a queue |

**Currency is a display choice.** Every screen with a price or a balance —
session prices, the radar, billing, earnings, invoices — shows **USD by
default with a small EGP toggle beside it**. Same number, two currencies. A
therapist prices in either; a patient pays in either. The rate used is
**frozen onto the transaction** so a receipt never changes value.

**Therapists pay us in either currency too, and every therapist chooses.** Not
only Egyptian ones. Buying a bundle, buying single sessions, settling an
outstanding pay-as-you-go bill — all of it can be paid by an Egyptian method
in EGP or by card in USD, whichever the therapist picks at checkout.

🔴 **Who absorbs the exchange difference: the therapist, when they choose to
pay in EGP.** The USD figure is the price; EGP is a convenience at the rate of
the day. **It must be shown before they pay, never discovered after** — the
EGP screen states the rate used and the USD equivalent it settles, on the same
screen as the button.

**The four crossings:**

| Patient pays | Therapist holds | What happens |
|---|---|---|
| USD, Stripe | Connect | Destination charge. Nothing is held |
| EGP, local | No Stripe | Egyptian entity collects and pays out manually |
| **USD, Stripe** | **No Stripe** | **We hold it.** Paid out in EGP on request |
| **EGP, local** | **Connect** | **We hold it.** Appears on their balance at once; drawn in USD via Connect |

🔴 **The two in bold are the exposure.** They are cross-border and they are
the ones a regulator would look at first. The domestic Egyptian leg — EGP in
from an Egyptian patient, EGP out to an Egyptian therapist, one entity, one
country — is a different and much smaller question than the cross-border legs.
**Take that distinction to counsel before sprint 16 ships, not after.**

**What the code must guarantee whatever counsel says:** money held is money
owed. Every held cent traces to one payment in and at most one payout out, in
a real ledger rather than a number computed at read time; every transaction
records which entity holds it; and a daily reconciliation balances to zero.

**Founder's ruling on the licensing question (2026-09-06):** build it and ship
it. The cross-border crossings may turn out to be rare, and whether they are
is itself worth learning. Counsel comes when there is traction to protect.
C73 stays open as a *known, accepted* risk with a date on it — not as a
blocker, and not as something anybody gets to be surprised by later.

---

### 🔴 What a session costs, and who a fee belongs to

*C209, C223, ruled by the founder 2026-09-12. Until sprint 46 ships,
`chargeForSession` bills the same amount whether or not any AI ran.*

**One session raises two line items, and only one of them is conditional.**

| | Charged to | When |
|---|---|---|
| **Platform fee, $1** | The therapist | **Every session.** Free ones, in person ones, and ones where the patient refused AI |
| **AI fee, $1 to $3** | The therapist | **Only when the patient turned AI on** |

The platform fee is not a fee for the video. It buys the record, the booking,
the reminders, the radar placement, the note storage and the free in-room
copilot, which is why it survives a session with no video in it at all. Zero
would mean a therapist who never seeks consent gets unlimited hosted
HIPAA-grade video for nothing, and a fee that vanishes on refusal would give a
therapist a reason to lean on the most vulnerable person in the room.

**The patient never pays us.** They pay their therapist. We take the platform
fee and the tax.

**Plans are rate locks, not session bundles.** The money buys credit; what the
threshold buys is a cheaper AI rate, and that rate does not expire when the
credit does.

| | Unlocks | Then a session costs |
|---|---|---|
| Pay as you go | | $1 + $3 with AI, $1 without |
| **$30 of credit** | **$2 per AI session** | $1 + $2 with AI, $1 without |
| **$60 of credit** | **$1 per AI session** | $1 + $1 with AI, $1 without |

Credit is money and spends against any line item, platform fee or AI fee
alike. The word "sessions" does not appear in the offer, because $30 does not
buy ten of anything.

**A bill is settled from one of three places, and the therapist picks the
order**: their session credit, their held earnings, or a card. Netting from
held earnings is the mechanic C69 already ruled on and 16.6a already built;
what is new is that the therapist chooses which balance goes first.

🔴 **The in-room copilot and the Prepare me button are carried by the platform
fee, never by the AI fee** (C210). They are the only AI in the product a
patient's refusal does not switch off, because they read the record that
already existed rather than the session happening now. A therapist whose
patient declined has still paid $1 and still gets help.

---

## §3e · CORPORATE — a company or a university pays, and never learns who went

*Founder's decision, 2026-09-12. This is its own product, not a billing
variant. It is the only flow in this plan with a large cheque attached and the
only one where a single mistake ends the company.*

**The commercial argument, which is the reason it outranks everything else.**
Acquiring therapists one at a time is slow and acquiring patients one at a time
is expensive. One corporate deal delivers hundreds of patients who are already
paid for, which is the only credible thing to say to a therapist who is being
asked to join a new platform: **there is demand waiting and it is funded.**
Supply follows funded demand. Nothing else here does that.

### The two sides

| | The payer | The person |
|---|---|---|
| Who | HR, or a university counselling office | An employee or a student |
| Signs up through | A separate corporate door | The ordinary patient signup |
| Gets | A pot of money, a roster, and reporting with no names in it | A badge, and sessions that cost them nothing |
| Sees | How much is left and how much was spent | Everything about their own care, as any patient does |
| Never sees | Who booked, when, with whom, or about what | Anything different from an ordinary patient |

### 🔴 The wall, which is the entire product

**The payer sees the roster. The payer never sees usage attributable to a
person.** Those two sentences are the whole design and everything else is
plumbing.

| The payer may see | The payer may never see |
|---|---|
| Who is **enrolled** | Who **booked** |
| Total spend, total sessions | A name beside a session |
| Weekly spend across the year | A day, an hour, or a date tied to a person |
| Balance remaining | The therapist, the specialty, the session type |
| A receipt and a VAT invoice | Any breakdown small enough to identify one person |

### 🔴 How somebody joins, and why there is no approval queue

*Three designs were tried. The first two failed and the reasons are worth
keeping, because both are the obvious build.*

**An approval queue fails on the rejection path.** If HR accepts or rejects
each applicant, rejections are surfaced individually, and the people who fail
an identifier match are disproportionately contractors, recent name changes and
people on leave. HR gets a short, sharp list of exactly the people least able
to absorb being on it, and no amount of mass enrolment dilutes it.

**A bulk roster fixes that and creates a worse problem**: a complete staff list
for every client, sitting in our database, with a retention question and a
breach surface attached.

**So there is no queue and no roster.** The sponsor is issued a **joining
code**, also rendered as a **QR**, which they circulate internally and print.
Separately they define **which identifier they require** and **the shape of a
valid one**: a university email on their domain, a student number, an employee
ID, a work email, or a combination.

| Step | What happens |
|---|---|
| 1 | The person signs up as an ordinary patient. Nothing here is corporate |
| 2 | They tap join, and enter the code, or scan the QR while signed in |
| 3 | We show the name and phone we already hold, for them to confirm |
| 4 | They supply the identifier their organisation requires |
| 5 | Matching is automatic, **against a shape and a domain, never a list** |

🔴 **The sponsor never sees an enrolment, never sees a rejection, never sees a
join date, and performs no act about any individual.** Their only
individual-level power is removal, from the list of people already enrolled.

🔴 **The identifier is a gate and nothing else.** A work email used to cross it
is **never** used for communication unless the person signed up with it. It is
stored to match and to de-duplicate, never returned to the sponsor, and the
only thing we ever send to it is the one verification code.

**What this design costs, ruled separately because both are real:** a shape is
guessable in a way a list is not (C246), and without a roster nothing can
notice that somebody has left (C247). The answer to both is the same:
**prefer an identifier we can prove over one we can only pattern-match**, and
re-verify it on a schedule.

### The three tiers of proof, strongest first

| Tier | How | Detects a leaver | Recommended |
|---|---|---|---|
| **1. HR system** | Their own HR platform answers "is this identifier an active employee" | **Immediately** | 🔴 Yes, and it is the reason the partner API exists for this audience |
| **2. Verified email** | A one-time code to an address on their domain | At the next check | Yes, the default |
| **3. ID shape** | Matched against a pattern | **Never** | Permitted, and the sponsor is told what it does not do |

🔴 **Tier 1 answers a question. It never enumerates.** The integration asks
"is this one identifier, which a person has already given us, currently
active?" and stores the answer and the timestamp. **We never pull a directory,
never sync one, never hold one.** That is the whole difference between a
verification integration and a provisioning one, and it is what keeps the
joining-code design's central virtue intact: there is no roster to breach.

### Re-verification, every three months

Everybody enrolled re-verifies on a **three-month cycle**, reached on
**WhatsApp and by email**, saying plainly that confirming the work address
keeps the benefit.

🔴 **The cycle is per sponsor, on a fixed calendar, not anchored to each
person's enrolment date.** Anchoring it would make "last verified" a proxy for
"when they joined", which §3e forbids the sponsor from seeing. Everybody in one
organisation is checked in the same window, so the date carries no signal.

A person who does not confirm has their **funding paused**, is told how to fix
it, and is restored by us in one step. 🔴 **A pause never touches the record,
the grants, the journals or the history.**

### What the sponsor sees about a person, exactly

| May see | Never sees |
|---|---|
| Their **name** | Whether they have ever booked |
| **When they were last verified** | When they joined |
| Nothing else | Any clinical fact, in any form |

The sponsor may **flag somebody as left** (a company) or **graduated** (a
university), from a fixed list of reasons and never free text. That ends the
funding and the badge and **touches nothing else they own** (C234).

### The money

🔴 **The pot is a payment method, not a billing system.** It stands in for the
patient's card and changes nothing downstream. The therapist is paid their own
price, our commission comes out of it as it always does, VAT is handled as it
always is, and the therapist's own platform fee and AI fee remain the
therapist's own, exactly as on any other session. **No new billing path, no
new ledger accounts beyond the pot itself, no special session type.**

| | |
|---|---|
| Minimum top-up | **$5,000**, and it is a setting rather than a constant, because the first pilot will ask |
| Currency and entity | The pot belongs to one entity. An Egyptian university funds the Egyptian entity in EGP; a US company funds the US entity in USD. §3c's rails are unchanged |
| Spendable on | **Therapy sessions on this platform, and nothing else.** There is no cash out, no transfer, and no other product to buy |
| When it runs out | A session already started always completes and is always paid. The pot may go one session negative and the payer is invoiced |
| Unused balance | Refundable less what was spent, or it expires on a stated date. **Decided before a single deal is signed**, never afterwards |

### Company and university are one type with two faces

Same table, same controls, same wall. What differs:

| | Company | University |
|---|---|---|
| The person is | An employee | A student |
| Demand shape | Flat, with spikes around events | **Seasonal**, around exams and term boundaries |
| Reporting they ask for | Spend against budget | Spend plus **demand planning**, because they are sizing next year's pot |
| The risk that is worse | A manager identifying a report | **Small cohorts.** A postgraduate programme of nine is nine identifiable people |

### What the therapist sees

🔴 **Nothing.** A therapist is paid their price by the platform as always. They
do not know, and must not be able to work out, that a session was funded by a
pot. A clinician who knows an employer is paying is a clinician who might treat
the person differently, and a clinician who can tell is a leak with extra steps.

---

## §3d · THE BACK OFFICE

Three things in this product are deliberately done by a person, not by code,
because getting them wrong is worse than being slow. Each needs a queue, a
clock, and somebody's name on it.

### A patient changes their phone number

The number is the identity (§3b), so changing it is the most dangerous thing a
patient can ask for — it is also how an attacker would take over an account.
So it is slow on purpose.

| | |
|---|---|
| **Locked** | 90 days from the day the number is set, and 90 days between changes |
| **The request** | New number · **a reason the patient writes** · a tick-box authorising us to call or message that number to check |
| **Refused outright** | A number already on another account. The patient is told *that* is the reason — not whose |
| **Then a person** | Staff call or WhatsApp the new number and satisfy themselves it is them |
| **On approval** | A verification link goes to the **new** number. A code from it, entered in the app, completes the change |
| **The window** | 24 hours to use it. Then the request lapses and they start again |
| **Recorded** | Old number, new number, reason, who approved, when, and the verification |

🔴 **Ruling — a first-week correction is not a change.** A typo caught in the
first 24 hours after signup is a correction, and trapping somebody behind a
90-day lock for a mistyped digit is a support ticket we will get anyway. The
lock starts 24 hours after the number is first confirmed.

### A patient asks for help

| | |
|---|---|
| **Topics** | Chosen from a list, not free-text-only, so the queue can be sorted |
| **Attachments** | Images and PDFs |
| **Clock** | 24 hours. One extension of 24 more, with a reason. Past that it is **overdue** and shows as overdue |
| **The clock pauses** | While waiting on the patient. Staff are measured on their own delay, not the patient's |
| **May move to WhatsApp** | Recorded as having moved, with a written summary brought back into the ticket. A conversation we cannot see is not a record |
| **On close** | The correspondence is emailed to the patient |

🔴 **Attachments a patient sends are clinical material.** Same storage, same
audit, same access rules as sprint 8's documents. **They never enter any
prompt.** A support ticket is not a copilot input.

🔴 **The closing email is patient data leaving the building.** §6 already says
only admin sends patient data anywhere, audited. That applies here: the email
is audited, and it carries the correspondence, **not the attachments**.

### Staff roles

All staff are not the same person. Two levels now, on top of the existing
admin:

| Role | Sees |
|---|---|
| **Staff** | Only their work: the payout queue, therapist ID verification, phone-change requests, patient support. The things a person has to do |
| **Manager** | All of that, plus the performance overview — ticket ages, overdue counts, throughput, who owns what |

**No admin impersonation. That rule does not bend for a support ticket.** A
staff member helping a patient sees the ticket, not the patient's account.

### The payout queue

**Two views, and they are not the same job.**

| View | What it is |
|---|---|
| **Automated** | Stripe Connect payouts, shown as completed. A record, not a task |
| **Manual** | EGP payouts somebody has to send. This is the work |

- A manual payout carries the method, the account identifier, the full name as
  registered, and a status the therapist watches
- Staff **upload a screenshot of the transfer** as confirmation, and the
  therapist sees it
- Age, alert, and a named owner on every request
- 🔴 **Two-person approval above a threshold, and never the same person who
  edited the payout details.** A manual payment queue is where fraud lives

---

## §3f · THE SIX PORTALS — who signs in, and what each one can never see

*Founder's decision, 2026-09-12. Six kinds of person authenticate into this
product. Three of them did not exist a week ago, and every one of them needs a
portal that was designed rather than assembled.*

| Portal | Who | Sees | 🔴 Never sees |
|---|---|---|---|
| **Patient** | A person | Everything about their own care | Another person's anything. A transcript. A clinical note |
| **Therapist** | A clinician | Their own caseload, in full | Another clinician's caseload. Who pays for a session (C242, C243) |
| **Clinic** | A practice or hospital manager | Their therapists' schedules, usage and bills. **Patient names and appointment times only** | **Any clinical content at all.** No note, transcript, journal, summary, risk, diagnosis, evidence or copilot |
| **Sponsor** | A company or university | The pot, the enrolled list, aggregate spend | **Who booked, when, with whom, about what** (§3e) |
| **Partner** | A developer at another company | Keys, docs, webhooks, their own subjects | Content. A webhook carries an event and an id (42.4) |
| **Admin** | Us | The operating picture | A join between a sponsor and a session, booking, date or name (C244) |

### 🔴 The architectural line that will be got wrong

**A clinic IS an `organizations` row. A sponsor is NOT.** They are opposite
answers and both are correct.

A clinic employs clinicians and its therapists' patients are inside its
tenancy, which is exactly what `actor.organizationId` already scopes across 63
queries. So a clinic is the organization, and a **clinic manager is a new kind
of user inside it with zero clinical access**.

A sponsor pays for care it must never see. Putting it in `organizations` would
place a paying employer inside the boundary that separates clinical caseloads,
which is the worst available place for it (C230). `sponsors` stays a separate
table with separate auth, and a sponsor user is never an `Actor`.

### How a clinician comes to be under a clinic

1. A clinic signs up, is held, and is activated by admin like any sponsor
2. The clinic adds therapists **one at a time, by email and phone**
3. Each one is invited and **verifies themselves exactly as a solo therapist
   does**. 🔴 **A clinic cannot vouch for a licence.** The whole "only
   certified therapists" claim rests on a verification nobody can delegate
4. 🔴 **A therapist under a clinic has no private patients on that account.**
   Every session is the clinic's, the clinic pays the platform fee and the AI
   fee, and the clinic sees the name and the appointment. A clinician who wants
   private work keeps a separate solo account. One rule, no per-session toggle,
   and it is said plainly in the invitation before they accept

### What a clinic pays and what it therefore sees

The clinic is billed the platform fee on every session and the AI fee on every
consented one, exactly as a solo therapist is. **That is what entitles it to
see a patient's name and appointment time: it is paying for that session.**
The line is drawn on money, not on employment, and it is the only line that
stays defensible when a patient asks why a practice manager knows their name.

---

## §4 · SPRINTS

**Ordered by who is waiting.** Sprints 1–11R are built, merged and live.
Sprints 12 onward were re-ordered and re-grouped after the founder's decisions
in §3b, §3c and THE RESET below.

| Group | Sprints | Why here |
|---|---|---|
| **Fix what the decisions changed** | 12 sweep · 13 claim by phone | Nothing later should carry an "except for" clause, and identity blocks the patient app |
| **Finish the session** | 14 no-show · 15 patient app | The loop a real patient walks through |
| **Money** | 16 two rails, two currencies | The biggest sprint in the plan, and the one with legal exposure |
| **The storefront** | 17 pricing story · 18 revamp and show the product · 19 both languages | Needs 16 first, so a price can be shown in either currency |
| **Control** | 20 admin back office · 21 admin content, strings and languages | Last, so it can be verified against everything that exists |
| **Launch** | 22 purge, rotate, verify | Not code. The gate before a real patient is invited |
| **🔴 The 2026-09-12 rulings** | **45 every string admin editable · 46 the split fee · 47 the honest record · 48 the copilot in the room · 49 Total View · 50 the switches that do nothing · 51 content and design · 52 the films** | Added after the founder ruled on the flows in §3c. **45 blocks 46 to 52**, because every one of them adds copy and today none of it is editable (C217). **52 runs last, on a purged database, and shares one run with the final walkthrough** (C225) |
| **🔴 The cheque** | **53 corporate: companies and universities** | Added 2026-09-12. One deal delivers hundreds of funded patients, which is the only credible thing to tell a therapist being asked to join a new platform. **Needs 45 and 46 first**, because it adds copy and it settles money. The wall in §3e is the sprint; everything else in it is plumbing |
| **🔴 The other doors** | **54 clinics and hospitals · 55 the partner portal and the API use cases** | Added 2026-09-12. §3f names six portals and three of them did not exist a week ago. 55 ships beside 53 because the corporate flow is the API's first customer (C255), and 55.1 rewrites the router **once for all six** rather than bolting a principal on per sprint (C264) |
| **🔴 The gap sweep** | **56 assessments** | Added 2026-09-12 after a completeness sweep found it had **no ticket anywhere**, despite being dictated by the founder as a core flow. It is also the only thing in the product that gives the copilot structured data a transcript cannot produce |

**Marked incomplete until their sprint lands:** anything WhatsApp until the
Meta setup is done · every price in EGP and every therapist paying us in EGP
until 16 · every public page's copy until 17–19 · the manual back office —
payout queue, number changes, support tickets, staff roles — until 20 · every
editable string, every extra language and every AI translation until 21 · the
whole system until 22's purge and key rotation.

Admin is **last**, on purpose: it exists to verify and correct everything else,
and it cannot verify what does not yet exist.

### Sprint 1 — Settings foundation · ~4 days

Everything downstream reads these. Anything hardcoded here is rewritten in 15.

- [x] **1.1** `platform_settings` — rates, tiers, included sessions, copilot
      limits, price cap. Seeded with §3's numbers
- [x] **1.2** `country_settings` — VAT rate, currency, allowed payment methods
- [x] **1.3** Typed accessor with a safe fallback. **No pricing constant may
      remain in code**
- [x] **1.4** Fix `lib/ai/client.ts` — the transcribe rate ignores `input.model`
      (H12)
- [x] **1.5** Session length 50 → **60 min**: 50 running, then a **10-minute
      countdown shown on both screens**, hard stop at 60. To continue, the
      therapist creates a new session — free or paid — and sends that patient
      the link
- [x] **1.6** Reprice to §3: PAYG $4, Starter $3/min 10, Growth $2/min 30.
      Platform cut 10% → **15%**. Price cap $1,000 → **$500**
- [x] **1.7** **Move every therapist to PAYG**, unlimited subscribers included.
      Demo accounts, no real revenue, nobody to notify
- [x] **1.8** 🔴 **Stop taking custody of therapist money.** `connect.ts:386`
      selects `capture: "platform"` automatically whenever a clinician has no
      Connect account — so we hold their balance today, by default, for exactly
      the therapists least able to chase us for it. Refuse the payment and
      prompt them to finish Connect onboarding instead. **This is remediation,
      not prevention: it is live**
- **Accept:** changing a rate in the database changes what the next session
      bills, with no deploy. And no code path can put a patient's payment
      anywhere but a clinician's own Stripe account.

### Sprint 2 — The room and the shell · ~1 week · 🔴 LIVE PAIN

Therapists use this every day and it is the worst screen in the product.

- [x] **2.1** 🔴 **Room relayout.** Measured before touching it: on 1440×900 the
      transcript started at **y=1001** with **0px visible**, video 1440×810
      full-bleed. Now two columns at `lg` — transcript at y=98, 701px visible,
      video 546px wide. Phone unchanged (H4)
- [x] **2.2** Desktop nav on wide viewports. The app shell already had a `lg:`
      sidebar and a `lg:hidden` bottom nav; the room deliberately has neither.
      What was a stretched phone is the room's control bar, now `lg:max-w-3xl`
      rather than a 1400px-wide button
- [x] **2.3** Floating orb on every page, in **all five** states including
      offline — which is the state nothing showed before, because `StatusPill`
      renders only when active. Pulsing is reserved for "booked and paying"
      alone; a dot that pulses in four states is decoration
- [x] **2.4** Orb expands — status and what it means, go on/off the radar,
      session rate (with a warning when payouts are not set up, since 1.8 now
      refuses those payments outright), clinic-visit toggle and address
- [x] **2.5** **Keep `/on-call`** as full radar control. Added session history:
      price charged **at the time** (frozen, never re-derived — verified by
      changing settings underneath it), patient record links, the money split
      as three lines, the clinician's own session bill, and copilot questions
      per session. **Access state deferred** — it needs the claimed/unclaimed
      states from sprints 5–7, which do not exist yet (C27)
- [x] **2.6** Act on the `{ kind: "viewing" }` signal. The bug was that you
      **could not** go offline while merely being viewed: `setOnline(false)`
      refused on `status = 'pending'` alone and blamed a booking that did not
      exist. Now a reservation (`pending_session_id IS NULL`) can be stood down
      and a real booking cannot — same conditional-UPDATE shape as
      `claimTherapist`, no second mechanism

### Sprint 3 — Attribution · ~1 week · 🔴 LIVE PAIN

In-person transcripts are 92% unattributed. Video is 12%.

- [x] **3.1** `diarise` batching fixed (H11) and backfilled. The cap was a
      `.limit(160)` on the *query*, so a long session was never read past
      segment 160 — absent, not mislabelled. Now batched at 120 with an 8-line
      overlap for context. Backfill: **136 → 14** unattributed in-person
      segments, **22 → 0** video
- [x] **3.2** Cut on pauses, not the clock. 600ms of quiet ends a chunk once
      there is ≥2s to send; the 8s clock is now only the ceiling
- [x] **3.5** 🆕 **Never label a straddle** (C35 ruling). A line holding two
      speakers is left `unknown`: a wrong label manufactures certainty a
      clinician acts on, and `unknown` is honest. 18 of 151 existing labels
      reclassified
- [x] **3.3** Descriptors — `words_per_minute`, `pause_before_ms`, derived from
      words and timings, no audio analysis and no second model call. **No
      affect/tone/sentiment column exists, and a test asserts none is added**
- [x] **3.4** A dropped track no longer stops attribution *or* stays silent.
      The old two-track guard skipped any session with a single `patient` row,
      so a call whose track dropped at minute 20 kept its whole second half
      `unknown` for good. The clinician is now told, in words, what changed
- **Accept:** ⚠️ **partially met — see C32.** The cutter is proved by 21 unit
      tests; the corpus measurement is a *baseline* (24.4% of interior cuts end
      without punctuation), because every existing segment was recorded by the
      old cutter. Re-run `scripts/measure-cuts.ts` after real sessions.

### Sprint 4 — Paid links · ~1.5 weeks · 💰 REVENUE

The first sprint that earns money.

- [x] **4.1** Reworked to §3, not left as found: the price now carries a cut, a
      VAT line and a currency. `$0` is still today's direct link
- [x] **4.2** `/pay/[token]` — **country first**, then currency, rate and
      methods. Its own route, not a step inside `/join`: abandoning a payment
      must not re-ask a patient whether they consent to being recorded
- [ ] **4.3** Save the patient's payment preferences — **deferred to sprint 5**
      per C12. The country is recorded on the payment; a *preference* belongs on
      `people`, which does not exist yet. See C36
- [x] **4.4** FX quote fixed for **1 hour** and stored on the payment. Reused
      within the hour, so the pay page and the checkout provably agree
- [x] **4.5** Cut and VAT as separate lines with reasons, on **both** sides —
      two Stripe line items for the patient, four figures on `/on-call` for the
      therapist
- [x] **4.6** `sessions.session_type` — direct · paid_link · radar · scheduled.
      Backfilled only from what is derivable; nothing invented

### Sprint 5 — Person layer · ~1 week · FOUNDATION

- [x] **5.1** `people` above `patients`; `patients.person_id` nullable, and
      staying nullable. Every creation path now gives a patient a person
- [x] **5.2** `people.claimed_at` — null means unclaimed. The partial unique
      indexes are on **claimed** rows only: unclaimed rows collide freely,
      because they are not identities
- [x] **5.3** Backfill: 66 patients → 66 people, **nothing merged**. Verified
      field by field, not just by count
- [x] **5.4** Match on email or phone, **suggest only**. Returns no address or
      number — a stranger must not be able to harvest who we hold records for
- [x] **5.5** `assertClaimed` — one gate, throws rather than returns false.
      Sprint 7's grants and sprint 8's documents go through it
- 🔴 **Never auto-merge.** A wrong merge puts one person's trauma in a
      stranger's file and a clinician treats them on it.

### Sprint 6 — Patient accounts · ~1 week · FOUNDATION

- [x] **6.1** ~~Add `"patient"` to `ROLES`~~ **deliberately not done — C42.**
      Every role in `ROLES` is a role *inside an organisation*, and a value
      whose only correct behaviour is to fail every `requireRole` check is a
      trap. The absence is commented in `schema.ts` so it is not re-added
- [x] **6.2** 🔴 **Separate patient identity table — not a nullable
      `organizationId`.** `patient_accounts` / `patient_auth_sessions` /
      `person_claims` / `person_invites` (migration 0034). The hole this
      closes is asserted live: a second account on the same email is refused
      **by the database**, not by remembering to look first
- [x] **6.3** ~~`Actor.organizationId` → `string | null`~~ **deliberately not
      done — C41.** With a separate identity no patient holds an `Actor`, so
      the nullable buys nothing and would put `string | null` into 192
      tenancy filters. Closes C15 by dissolving it
- [x] **6.4** `requirePatient()` / `optionalPatient()`, own cookie
      (`24t_patient`), own table, 4h idle / 7d absolute
- [x] **6.5** Signup and signin reusing `lib/auth/password` unchanged. Duplicate
      email answers exactly what a wrong password answers
- [x] **6.6** `middleware.ts` fixed, and the decision extracted to
      `lib/routing.ts` as a pure function — segment-boundary matching (C45),
      with the no-fall-through claim asserted over every cookie state
- [x] **6.7** `app/(patient)/` route group — home, login, signup, claim, invite
- [x] **6.8** The claim flow, all eight steps. Step 7 defaults **off** in both
      routes, and `verifyClaim` has no default for it — a caller that forgets
      is a type error, not a silent grant
- [~] **6.9** Email only. WhatsApp has no provider and the UI offers no button
      for it rather than promising a message nobody sends — C43
- [x] **6.10** 🆕 **Invite-link claim route.** Issued from the patient's chart,
      single use (conditional UPDATE, not a read), 30-day expiry, revocable,
      never sent by us. Only a hash is stored, so the token is shown once and
      the copy says so

### Sprint 7 — Consent · ~4 days · FOUNDATION

- [x] **7.1** `history_grants` (migration 0035) — one row per (person,
      therapist), walking `pending → granted | rejected → revoked`. A partial
      unique index on the live statuses, so a second pending request is refused
      by the database. **C48**: sprint 6's step 7 now creates or withholds it
- [x] **7.2** 24 hours or open-ended. The window is written at the moment they
      agree, never derived at read time — a window computed on each read moves
      every time somebody reads it
- [x] **7.3** A note, and a limit of two a day **per (therapist, patient)** —
      a global limit would punish a busy practice and do nothing about somebody
      pestering one person
- [x] **7.4** Preset reasons, all optional. "No thanks" has no confirmation
      dialog: a *are you sure?* on a refusal is pressure with a polite face
- [x] **7.5** One tap. Effective on the next read — there is no cache and no
      cron, so nothing can be late
- [x] **7.6** Every request, grant, rejection and revocation, with the patient
      as the actor. **C49**: `actor_account_id` beside `actor_user_id`, and
      `audit()` throws if a row would name both
- [~] **7.7** The four states are decided in one pure module
      (`lib/access/state.ts`, 16 tests) and enforced where a write happens:
      `updatePatient` refuses a diagnosis in the revoked state. **C47** records
      what the degraded state cannot yet remove, and **C46** why the
      five-credit unlock is reported but not enforced
- [x] **7.8** Both controls in the patient's room, on the same poll as the
      recording indicator, **one-way by design** — §3: it cannot be turned off,
      end the session and answer no next time. Turning recording on writes
      `recording_started_at`, and `lateRecordingStamp` puts §3's sentence at the
      top of the note

### Sprint 8 — Personal Profile · ~1.5 weeks

- [x] **8.1** `person_documents` on the **person** (migration 0036): upload,
      type, dictate. Dictation uses the browser's own recogniser — no audio
      leaves the device — and is stored as `dictated` rather than `typed`
      because the two carry different kinds of error
- [x] **8.2** 8 MB → **25 MB**, and PDFs, Word files, scans, HEIC and TIFF all
      accepted. Measured reason: a phone photo of an A4 page is 4–6 MB and a
      multi-page scan is past eight
- [x] **8.3** Chunked by `chunkText` — pure, deterministic, cuts at paragraph
      then sentence (Arabic `؟` included) and never mid-word. Uploads go to the
      **`extract` cron** (H9); typed text is chunked inline because there is
      nothing to parse
- [x] **8.4** Stored, shown, zoomable, labelled *"image — not searchable"*.
      **No OCR.** `unsupported` and `failed` are separate states — see C51
- [x] **8.5** `[D7:3]` where 7 is the person's **ordinal**, not an id — a uuid
      in a citation is a uuid a model eventually mistypes. Unresolvable
      citations are **deleted from the answer**, not shown broken
- [x] **8.6** `resolveRef` opens the exact passage. Verified across two people
      holding the same `D1:1`, which must resolve to different documents
- [x] **8.7** `uploaded_by_user_id` / `uploaded_by_account_id` / `document_date`,
      rendered as a name on the face of every row
- [x] **8.8** `content_flags` over documents, passages and diagnoses. 🔴 **A
      flag never deletes and never edits** — it travels with the material into
      the copilot's prompt, marked
- [x] **8.9** 🔴 `source_sentence` is `NOT NULL`, and `verbatimIn` **discards**
      any proposal whose sentence is not in the passage character for
      character. Inference is structurally impossible, not merely discouraged.
      Nothing is a diagnosis until a human confirms it
- [x] **8.10** Bytes only from `/api/documents/[id]` — consent re-checked,
      every read audited, the blob URL never sent to a browser (H14).
      Read-aloud posts a **document id**; the text is spoken without ever being
      in the page. Watermark over the image. See C52 for what it cannot do

### Sprint 9 — Memory and homework · ~1.5 weeks

- [x] **9.1** `person_profiles` (migration 0037) — one row per person, unique
      index, replaced wholesale after every session and every document. **No
      update path takes prose from a human** (C55). A section whose refs are not
      all real is dropped entirely, not trimmed
- [x] **9.2** `observations` — dated by when a thing **happened**, not when it
      was written down. An observation that cannot be dated is discarded rather
      than silently placed at today
- [x] **9.3** The copilot is told the two reference kinds are not
      interchangeable and must say which it is drawing on. The standing profile
      is passed as material, and withheld in the degraded state — it is derived
      from the documents, so it inherits their consent
- [x] **9.4** *Sessions outrank history, surface conflicts, never resolve.*
      Sessions are laid out **last** so they carry the most weight, and
      contradictions go in a **separate field** requiring **both** sides, both
      real. The screen renders them amber, above the profile
- [x] **9.5** `homework_items`. Therapist authors or promotes a drafted step;
      🔴 **only the person ever closes one**. `skipped` is a first-class answer
      (C54), and an answered step cannot be withdrawn
- ⚠️ **Enforced by two asymmetric queries — C53.** `nextStepFor` cannot return
      a count, a rate or a streak; `homeworkTrend` is the clinician's alone. The
      verifier asserts the patient query's **key set**, so adding a number to it
      fails the build rather than reaching a person.

### Sprint 10 — General copilot · ~4 days

- [x] **10.1** `/assistant`, in the nav beside the per-patient copilot and
      labelled by what it is *not* allowed to see. A first visit gets a
      conversation, not an empty state with a button on it
- [x] **10.2** 🔴 **Enforced by absence — C58.** `assistant_threads` is a
      separate table, and `lib/ai/assistant.ts` imports no table carrying
      clinical text. The one clinical table it touches is `session_notes`,
      only ever inside a `COUNT(*)`. The verifier reads the module's own import
      block, so a future edit adding one fails the build
- [x] **10.3** Names → ids, never ids → names (C59). A hallucinated name is
      inert text, on this render and every future one
- [x] **10.4** Threads: create, pick, continue, delete. Named from the first
      question, once. Soft-deleted, so deleting a thread does not hand back the
      month's messages
- [x] **10.5** 50 a month from **settings**, not a constant, across every
      thread, calendar-month window. Only `therapist` rows count — an assistant
      reply is not a message the clinician spent
- [~] **10.6** Language, voice and speed, asked once on first use and stored on
      `users.profile`. **Skipping stores the defaults** and stamps the timestamp,
      so the card never returns — a prompt that comes back is one people learn
      to ignore. The "editable later" surface is the existing Settings page and
      is not yet wired to these three fields

### Sprint 11 — Scheduling · ~1.5 weeks

- [x] **11.1** `availability_slots` (migration 0039). Whole hours enforced by a
      **CHECK constraint** and by a wire format with no minute field — C61
- [x] **11.2** `sessions.scheduled_at`, **closing C57**. Distinct from
      `started_at`, and the gap between them is what sprint 12 reads to decide
      whether anybody turned up. Not backfilled: 0 of 69 existing sessions
- [x] **11.3** Booking calendar on the public profile. Hold → book, both
      conditional UPDATEs, so two patients racing for one hour produce one
      winner and one honest refusal
- [x] **11.4** The calendar *is* the escape hatch, on the same page as the
      radar button: somebody who is not in crisis books an hour instead of
      pulling a clinician out of their evening
- [x] **11.5** Inside `reachable()`, not a flag — C62. Fifteen minutes before,
      and for the whole booked hour
- [x] **11.6** On the poll the room already makes, under the clock. A fact with
      no instruction attached — "wrap up now" is a clinical judgement
- [~] **11.7** Built and **cannot deliver yet** — C63. The seam
      (`lib/notify/`) picks a channel; the reminder cron runs at 03:20; every
      screen reports whether the message actually went. WhatsApp is written
      against the Meta Cloud API and needs a key — C64
- ⚠️ Still true: the Resend domain is unverified. The difference is that the
      product now *says so* to the patient instead of claiming an email was
      sent.

### Sprint 11R — Repair · ~4 days · 🔴 BEFORE ANYTHING ELSE

Nothing new. This sprint closes every open objection carried out of sprints
7–11 and the three items that have been deferred twice. Sprint 12 does not
start until `verify:sprint11r` is green and sprint 11 + 11R are merged.

**One clock, one rendering.** C61, C62.

- [x] **11R.1** A single `lib/scheduling/tz.ts`. Every time a human reads —
      calendar, editor, confirmation, reminder, room banner — comes from one
      formatter that takes a zone. No `toISOString()` in anything a person sees
- [x] **11R.2** `users.timezone` (IANA, nullable) and `patients.timezone`.
      Clinicians publish hours in **their own** zone; the editor's From/Until
      convert to UTC on submit and the label says which zone it means
- [x] **11R.3** The confirmation and the reminder are rendered in the
      recipient's zone, with the offset spelled out — *"Thursday 12 September,
      22:00 (Cairo)"*. Falls back to the clinician's zone, then UTC, and says so
- [x] **11R.4** `byDay` buckets on the **display** zone, not the UTC date, so a
      23:00Z slot never sits under Monday and reads "Tuesday"
- [x] **11R.5** Test: one slot, three readers (Cairo, Dubai, New York) — three
      renderings, one instant. And a DST boundary in Egypt, which observes it

**Stop editing the patient's words.** C63.

- [x] **11R.6** `availability_slots.reminded_at timestamptz`. `markReminded`
      writes the timestamp; `bookingsNeedingReminder` reads it. Nothing appends
      to `note` ever again
- [x] **11R.7** Migration strips any ` [reminded]` already glued onto a note,
      and the verifier asserts no note contains the marker
- [x] **11R.8** Test: a note containing the literal text `[reminded]` still
      gets its reminder

**Close C43 properly.** C68, C64.

- [x] **11R.9** The claim action routes through `notify()`. It stops calling
      `mailClaimCode` directly
- [x] **11R.10** A `claim.code` template in `TEMPLATES` (Meta *authentication*
      category, which is a different approval track from the utility ones —
      say so in the setup notes)
- [x] **11R.11** The patient is **told which channel it went to**, on screen.
      `ClaimState` carries the channel. Choosing WhatsApp and silently getting
      an email is the defect; a server log is not a fix
- [x] **11R.12** `toE164(value, countryCode)` — expansion needs a country, so
      ask for one. A country selector beside every phone field on the public
      booking form and the patient signup, defaulting from the visitor's locale.
      Store E.164, display local
- [x] **11R.13** `npm run whatsapp:check` refuses a number it cannot prove is
      E.164, instead of sending something Meta will bounce
- [x] **11R.14** Test: `01001234567` + Egypt → `+201001234567`; the same digits
      with no country → refused, never guessed

**The reminder actually reaches people.** C65.

- [x] **11R.15** Reminders run **hourly**, not once at 03:20, and send at the
      first run inside a 24–20 hour window before the session — plus a
      same-day catch-up for anything booked inside that window
- [x] **11R.16** Nothing is sent between 22:00 and 07:00 in the **recipient's**
      zone. It waits for morning
- [x] **11R.17** Weigh the extra Neon wakes against the note at the top of
      `app/api/cron/[job]/route.ts` and record the arithmetic in the build log

**The migration trap.** C66.

- [x] **11R.18** Record 0039 in `drizzle.__drizzle_migrations` on production, or
      re-run it so the ledger and the database agree. Journal count must equal
      the applied count — assert it
- [x] **11R.19** Split multi-constraint `DO $$` blocks: **one constraint per
      block**, so a duplicate on the first never skips the rest. Sweep 0029–0039
      for the same shape
- [x] **11R.20** `scripts/verify-migrations.ts` — journal vs `__drizzle_migrations`
      vs `information_schema`, runnable against any database. Add it to the
      standing checks in `HAZARDS.md`

**The public booking endpoint.** C67.

- [x] **11R.21** A booking requires **one** contact method — an email or a
      phone. A booking nobody can be told about is not a booking
- [x] **11R.22** Per-slot and per-clinician ceilings on top of the per-caller
      one, and unconfirmed bookings expire back to `open`

**The three that have been deferred twice.**

- [x] **11R.23** **C50 — build it.** `unpdf` for PDF, `mammoth` for Word. The
      column-count heuristic is part of the ticket, not a follow-up: a document
      whose extraction looks interleaved is marked `unsupported` and is never
      citable. A wrong word behind a `[D7:3]` is worse than no citation (C35)
- [x] **11R.24** **C46 — turn it on, grandfathered.** The five-credit unlock
      applies only to patients created after a `gateActiveFrom` date in
      `platform_settings`. Verify against production numbers: the 65 of 66 who
      have no history keep the copilot they use today. Assert it
- [x] **11R.25** **C47 / C27** — re-read both now that sprints 7–9 exist, and
      either close them by measurement or say what is still missing
- [x] **11R.26** **C26** — 20 sessions with no `feedback_token`. Backfill or
      exclude explicitly, before sprint 12 computes a reliability score from them
- **Accept:** every row in §2 raised against sprints 7–11 reads **resolved** or
      carries a sentence saying why it is deliberately still open.

### 🔴 THE OPEN CONCERNS, AND WHO RULES ON THEM

Eighteen rows in §2 are still open. **Every one is now the build session's to
rule on, inside the sprint that owns it**, rather than something to raise and
wait on. Nothing in this list blocks a sprint; each one is a decision that
sprint is entitled to make.

| Sprint | Rules on |
|---|---|
| **13R** | C75 — a recycled number locking somebody out. 13R.4's therapist release is the interim answer; say whether it is enough until sprint 20 |
| **14** | C57 — a next-appointment in the general copilot's roster, which 10.2 says structurally cannot read a clinical record. Rule whether a scheduled time is clinical |
| **15** | C16 — twelve admin pages already exist and §3d adds a back office. Rule what the patient app reuses and what it must not |
| **16** | C37 (`STATIC_RATES` must never settle real money), C69 (the "pays for itself out of your earnings" framing describes netting that does not exist), C74, C76 — all four are money, all four are this sprint's to decide |
| **17** | C25 — unscheduled, and pricing is where it lands or dies |
| **18** | C72 — and C34, C39, C20, C7–C9, C17, which are old public-site rows nobody has revisited since the revamp was specified. Either they are real on the new site or they are void; say which and why |
| **19–20** | C77 |
| **20** | C71 — accepted, but say what accepting it costs the people running the back office |

**How to rule.** In the row itself, in §2, and in one paragraph: what was
decided, **why**, what it costs, and the date. A ruling that only says
"resolved" is not a ruling. If the honest answer is *this is a risk we are
taking*, write **"accepted, not resolved"** with the reasoning — a deliberate
decision must never later read as an oversight.

### 🔴 THE RESET — read before any sprint below

**Every row in the production database is test data.** The therapists and
patients are real people who agreed to try it; the records are not clinical
records anybody is keeping. Before launch the database is purged completely,
admin is seeded fresh, and every key is rotated.

**What that changes.** Several decisions in sprints 1–11R were made to protect
live rows, and every one of them is now void:

| Decision made to protect production | What it becomes |
|---|---|
| C46's gate grandfathered on a date, so 65 of 66 patients keep the copilot | **On for everyone.** No date, no grandfather |
| C26's 20 sessions with no `feedback_token` excluded rather than backfilled | Irrelevant — those rows are deleted |
| C39's duplicate emails across organisations left un-merged | Irrelevant |
| `recording_started_at`, `scheduled_at`, homework, attribution: "deliberately not backfilled" | Irrelevant. Never backfill; the rows go |
| C72's stale CMS copy on branch databases | Irrelevant once every database is seeded from `defaults.ts` |
| C102 | 21R | 🔴 **An editor's instruction was printed to the public as a postal address.** `/contact` shipped *"Set your registered address in admin → content → contact."* as the default address for **both** entities, live on the page. The renderer already omits an empty address, so the default is now empty and the line simply does not appear. **Fixed and reseeded 2026-09-07** — but the class matters more than the instance: a CMS default is public copy, and a default written for the editor is a defect the moment it renders. | major | review | **resolved — `14c1397`, content refreshed on production** |
| C103 | 19 | 🔴 **Arabic has no URL.** The language switch is a cookie (`24t_locale`) set by a server action; `/ar/pricing` and `/ar/for-patients` are **404**. The Arabic pages render well — 482 Arabic words against 30 Latin on pricing — but nobody can link to one, share one, or find one in a search engine, in the market this product is built for. **Ruling: the Arabic site needs its own paths** (`/ar/...`), with the cookie kept as the preference and `hreflang` on both. Until then "the site is in Arabic" is true for a visitor and false for Google. | major | review | **ruled — new sprint 23R** |
| C104 | 22 | **Two verifiers pinned themselves to the state before the purge.** `19.0a` asserts staging rows exist and now reports *0 staged rows across 0 locales* — the purge correctly removed the scaffolding it was checking. `21R.6` fetches the live pricing page by URL and reports `ar:PROSE` because there is no Arabic URL to fetch (C103). Same family as the two the build session already caught. **Ruling: a check that asserts on scaffolding must delete itself with the scaffolding**, and a check that fetches a locale must fetch it the way a reader reaches it. | minor | review | **ruled — sprint 23R** |
| C105 | 22 | 🔴 **The report said ledger 55 and a purged production; production was at 53 with 38 users and 56 patients.** `0053_patient_reset` and `0054_validate` had never been applied, so the patient password-reset table did not exist on production — C94's headline fix was not live — and 0054 would have failed outright, because `VALIDATE CONSTRAINT` scans, and the rows it would have scanned were still there. The purge and both migrations were run from this session on 2026-09-07: 61 tables emptied, ledger 55, **0 `NOT VALID` constraints remaining**, 1 seeded admin, content reseeded across 14 pages. **Ruling: H16 is not "apply before pushing main", it is "prove it against `information_schema` and say the number you read".** A sprint report that states a ledger number nobody queried is the same defect as a checker that matches its own prose. | major | review | **resolved — applied and verified from this session** |
| C102b | 27 | 🔴 **The portability pitch has no mechanism.** `requestGrant` takes a *clinician* actor and writes `status: "pending"`; the patient answers. There is no patient-initiated share anywhere in `lib/data/grants.ts`. "Take your record to your next therapist" is a promise the product cannot keep. **Ruling: keep therapist-initiated as the mechanism**, because it means the requester holds an account and is verified before anything moves, **and add a patient-side invite**: the patient generates a code, the new therapist redeems it, which creates the request, which the patient approves in one tap. The patient gets the initiative and nobody gets a back door. Copy says "invite your therapist", never "send your record". | major | founder | **ruled — sprint 27** |
| C106 | 27 | 🔴 **A grant to an unverified account.** Nothing in the database stops `history_grants.status` reaching `granted` for a clinician whose verification is not `approved`. The whole "only certified therapists" claim rests on it. **Ruling: a hard invariant, in the database, asserted by attempting the write.** | major | review | **ruled — sprint 27** |
| C107 | 27 | **Coercion.** Someone pressured into granting access: an abusive partner who is also a clinician, a family member holding the phone. **Ruling: a grant needs the patient's own authenticated action and can never come from a therapist flow that ends in access.** Plus a permanent "who can read my record" screen with one-tap revoke, a notification on every new grant, and revocation that never asks why. | major | review | **ruled — sprint 27** |
| C108 | 27 | **The old therapist refuses, has left, or wants paying.** We cannot promise cooperation. **Ruling: copy says "ask", never "get", and the request is explicit** — the patient asks, the therapist sees it, and uploads or declines with a reason the patient reads. A silent request is worse than a refusal. | minor | review | **ruled — sprint 27** |
| C109 | 28 | 🔴 **"Paid sessions cover our fee" is arithmetically false.** At 15%, a session must be about 27 dollars before the cut covers a 4 dollar fee. At Egyptian prices it does not. This is C69 in a new costume and it would be a false claim on a public page. **Ruling: say what is true, which is netting** — what you owe comes out of what you earn, before it reaches your account. And state plainly that on a free session the therapist pays the fee. | major | founder | **ruled — sprint 28** |
| C110 | 28 | **Never promise earnings.** "Get booked on the radar" is fine. "Earn enough to offset the cost" is a forecast about somebody else's business. | minor | review | **ruled — sprint 28, copy rule + check** |
| C111 | 26 | **Two therapists, one clinical summary.** The summary belongs to the **patient**, not to a clinician. **Ruling: versioned and append-only**, each version stamped with the clinician who approved it and the date. Therapist B never overwrites therapist A. The patient sees both, with authors. And revoking therapist A does **not** retract a version the patient has already read; what the patient holds is theirs. | major | review | **ruled — sprint 26** |
| C112 | 26 | **Approval fatigue.** Three approvals per session is how approvals become rubber stamps. **Ruling: one screen, one action, all three shown together, and the summary defaults to *not published* if the clinician does not act.** Silence publishes nothing. | major | review | **ruled — sprint 26** |
| C113 | 24 | 🔴 **The patient-facing summary is model output reaching a patient.** The rule has to be exact: **a patient never converses with a model, and no model output reaches a patient without a named clinician approving that exact text.** True today — nothing under `app/(patient)` imports `lib/ai/*`. **Ruling: make it an import-graph guard**, proved against a planted offender, so it cannot quietly stop being true. | major | review | **ruled — sprint 24** |
| C114 | 25 | 🔴 **Name editing versus the claim challenge.** The challenge asks what name the patient gave their therapist. If it compared against the patient's own editable profile, somebody holding the phone could fail, edit their profile, and retry. **Ruling: the comparison is always against the therapist's record, never the patient's profile.** One rule, one test. | major | review | **ruled — sprint 25** |
| C115 | 25 | **Patient profile picture.** A new upload surface with no verification, shown to a clinician. **Ruling: images only, size capped, stored private, served through an authenticated route like documents, never a public object, and admin can remove.** | minor | review | **ruled — sprint 25** |
| C116 | 25 | **Mobile app banners for an app that does not exist.** App Store badges for software nobody can install is a false claim on a live page. **Ruling: a PWA "add to home screen" prompt, which is honest and works today, or the words "coming soon". Never a badge.** | minor | founder | **ruled — sprint 25** |
| C117 | 24 | 🔴 **The em dash.** U+2014 and U+2013 read as machine-written and are banned in every CMS default, every `ui_strings` row, every rendered public page, every email and every WhatsApp template. **Ruling: a verifier that scans all of them and fires against a planted offender**, same standard as every other guard here. | minor | founder | **ruled — sprint 24** |
| C118 | 30 | 🔴 **Egyptian counsel says Egyptian data must sit in Egypt.** Neon has no Egyptian region, so this is a second database, not a setting. The realistic provider is **Huawei Cloud Egypt**, the only public-cloud region in the country, with a second Cairo AZ due 2026; the alternatives are Cairo colocation (Link Data Center, Tier IV, runs Postgres) or the telco clouds. **Ruling: build the region seam now and point Egypt at the US instance until Cairo is live**, so going live is an environment variable rather than a migration. Enforcement lands October 2026. | blocker | founder | **ruled — sprint 30** |
| C119 | 25 | 🔴 **A guest with only a phone number has no password, and 13R made a password mandatory.** **Ruling: the password becomes optional.** A code to the phone or the email is always a valid sign-in; a password is a convenience, never the only door. This edits 13R rather than extending it. | major | founder | **ruled — sprint 25** |
| C120 | 25 | 🔴 **A printed QR code on a clinic wall is public.** Anyone can scan it. **Ruling: the QR carries the therapist's identity only, never a patient's.** Scanning opens signup saying which practice they are joining; matching still runs on phone or email plus the full challenge. The code is short and revocable, so a poster left up after a clinician leaves can be killed. | major | founder | **ruled — sprint 25** |
| C121 | 25 | 🔴 **Showing the therapist's name and photo before the handle is proven leaks.** Type a stranger's number, see "Dr Nadia Farouk" and a photo, and you have learned that number belongs to one of her patients. **Ruling: the code comes first, always.** Nothing about any record appears until the handle is proven: handle, then code, then therapist name and photo, then "have you seen them", then the name with a first-letter hint that spends one of three attempts. | major | founder | **ruled — sprint 25** |
| C122 | 25 | **Lookup by email as well as phone, and never by name alone.** Many people share a first and last name, and some records carry only a first name. **Ruling: a record is found by a proven phone or a proven email. A name is only ever a challenge answer, never a lookup key.** | minor | founder | **ruled — sprint 25, standing rule** |
| C123 | 26 | 🔴 **Journals are a three in the morning crisis surface.** A patient writes "I want to die" into a journal at 3am. **Ruling: journals are scanned like a transcript, and a high-risk journal alerts the therapist who holds a grant. But the page never says or implies that anyone is watching**, and the crisis line is always on screen. Promising monitoring we cannot staff is the most dangerous thing this product could do. | major | founder | **ruled — sprint 26** |
| C124 | 26 | **Dictated journals are patient-authored audio.** A new ingestion path from an unverified author. **Ruling: same auth, same audit, same private storage as documents.** | minor | review | **ruled — sprint 26** |
| C125 | 25 | 🔴 **The SOS orb with almost no verified numbers.** C98 left exactly one verified crisis line. **Ruling: the orb shows only numbers we have verified, plus "call your local emergency number" and the practice number if the clinician set one. We never invent a number.** It is a plain `tel:` link, never behind a modal, and it must work when our API does not. | major | founder | **ruled — sprint 25** |
| C126 | 25 | **The orb over a live session.** **Ruling: it stays, reduced opacity, snapped to an edge.** A person in crisis during a session is the case it exists for. | minor | review | **ruled — sprint 25** |
| C127 | 26 | 🔴 **"Proof for court" is a legal representation.** We can attest what our records contain and when. We cannot attest that a diagnosis is correct. **Ruling: the export is a record *extract*, never a certificate.** A cover page saying exactly what it is and is not; every note stamped with the approving clinician's name, licence body and number; a verification code a third party can check on a public page. The words "certified" and "proof of diagnosis" never appear. | major | founder | **ruled — sprint 26** |
| C128 | 26 | **Export by secure email link only, never WhatsApp — but some patients have no email.** **Ruling: they add one to export, and the button says so before it is pressed, not after.** Every export raises an admin alert. | minor | founder | **ruled — sprint 26** |
| C129 | 25 | **Bottom nav during a live session lets a patient wander off mid-session.** **Ruling: the nav is present, the session tab is locked active, and leaving asks first.** | minor | review | **ruled — sprint 25** |
| C130 | 25 | **Asking a guest to sign in "to save your notes" implies the record would otherwise vanish.** It would not; the clinician holds it either way. **Ruling: honest copy — signing in lets *you* see it.** | minor | review | **ruled — sprint 25** |
| C131 | 27 | **A patient invite to an unverified clinician waits forever.** **Ruling: the invite creates a pending grant that cannot activate until that clinician is approved, the patient sees exactly why it is waiting, and it expires after thirty days.** | minor | review | **ruled — sprint 27** |
| C132 | 41 | 🔴 **Calendar auto-join would eventually record a supervision call or an accountant.** **Ruling: the bot joins meetings 24Therapy created for a session. Nothing else. Ever.** No calendar is ever read. | major | founder | **ruled — sprint 41** |
| C133 | 41 | 🔴 **A Zoom link we create bypasses our consent screen.** **Ruling: the link the patient receives is always ours** — it takes consent, then forwards. The raw meeting link is never handed out. Declining consent still admits them to the session; the bot simply does not transcribe. | major | founder | **ruled — sprint 41** |
| C134 | 41 | 🔴 **Never map a person from a meeting display name.** "Omar Ahmed" resolving to patient 184 is how patient A's transcript reaches patient B's chart. **Ruling: identity comes from the session we created, never from the meeting. An unrecognised voice is "Speaker 3", never a guess.** | major | review | **ruled — sprint 41, hard invariant + test** |
| C135 | 36 | **A mixed meeting stream lands on the weakest attribution path.** Video is accurate because it captures two tracks; a bot delivers one mixed stream. **Ruling: acoustic diarisation is a blocking dependency of the meeting bot, not an in-person nicety.** Sprint 37 ships before sprint 41. | major | review | **ruled — sprints 37, 41** |
| C136 | 24 | **The legal pages stay in English, and now say so in Arabic.** 24.5 asks for every pre-revamp page in both languages; 19.1 ruled the four legal documents English-only *on purpose*, and the registry declares it so the gap reads as a decision rather than an oversight. Translating a privacy policy or terms of service is not a content pass, it is a legal act: the Arabic and the English would then be two documents, and the question of which one binds is answered by whichever one somebody sued over. **Ruling: the binding text stays English, and each of the four pages opens with an Arabic paragraph saying that in Arabic and offering a person who will explain it.** What it costs: an Arabic reader still meets an English document, which is worse than a translation and better than a translation nobody has had reviewed. Revisit when there is Egyptian counsel to review a translation. 2026-09-09. | minor | 24.5 | **ruled, and the Arabic preamble shipped** |
| C137 | 25 | 🔴 **`lib/ai/` was a filing convention pretending to be a boundary.** Sprint 25 moved the radar and the clinician profile inside the patient app, and 24.2's import guard immediately found a five-hop path from a patient page to `lib/ai/descriptors.ts` and then to `lib/ai/crisis.ts`: patient page → radar console → booking sheet → the public booking action → `lib/data/sessions.ts` → the forbidden directory. Nothing leaked. Both modules are arithmetic and a keyword list, neither calls a model, and the temptation was to add an allowlist. **Ruling: no exception. `lib/ai/` means "this talks to a model" and nothing else may live there, so `descriptors.ts` moved to `lib/transcript/`. And `lib/data/sessions.ts` was doing two unrelated jobs — booking an hour, which a patient reaches, and writing transcripts and raising risk alerts, which only a clinician's session does — so the writer moved to `lib/data/transcript.ts`.** What it costs: two more modules, and one import to update in the transcribe route. What it buys: the guard's answer stays trustworthy when sprint 35 puts a real model behind `raiseCrisisAlert`'s `source: "model"` seam, because that call will be on a path no patient page can reach. 2026-09-11. | major | 24.2 guard | **ruled, and both modules moved** |
| C138 | 25 | **A "top rated" rail is where a marketplace lies quietly.** 25.1 asks for one on the patient's home screen. The easy version ranks whoever the query returned first and prints a star beside a clinician with one rating. **Ruling: the rail uses the same `RATINGS_VISIBLE_AFTER` bar as the rest of the product (five rated sessions), a clinician below it is not ranked, not padded out and not shown with an empty star, and when nobody clears the bar the rail does not render at all.** The same rule governs the category tiles: a category appears only when a verified clinician has actually listed it, with the real count beside it. What it costs: on today's database the rail renders nothing, which looks like an unfinished screen and is in fact an honest one. 2026-09-11. | minor | 25.1 | **ruled, and asserted in `verify:sprint25`** |
| C139 | 25 | **A patient's photo is not a clinician's credential.** C115 says private storage and an authenticated route. A credential blob is protected by an unguessable URL, which is enough because that URL only ever reaches its owner and an admin. A patient photo is rendered into a clinician's caseload, and an unguessable URL in a page is unguessable only until the page is screenshotted or forwarded. **Ruling: `people.avatar_url` is an internal handle no page may emit. The only reader is `/api/patient/avatar/:personId`, which carries no secret and asks on every request: the patient themselves, a clinician holding a live record for that person, or a super admin. Everyone else gets 404, not 403, because "this person exists and has a photo" is not owed to a stranger.** The route proxies the bytes rather than redirecting, since a redirect hands back the storage URL and republishes it. What it costs: a hop on a 44-pixel image. 2026-09-11. | minor | C115 | **ruled, and the scan refuses any page that emits the column** |
| C140 | 26 | 🔴 **The crisis scanner had to be on the patient's own write path, and it was behind 24.2's wall.** Journals are scanned like a transcript (C123), and the scanner lived in `lib/ai/crisis.ts`, which nothing a patient reaches may import. **Ruling: the same one as C137, applied a second time rather than weakened. `lib/ai/` means "this talks to a model"; a phrase list and an `includes` is not one, so it moved to `lib/crisis/alerts.ts`.** And the forward rule, decided now rather than when sprint 35 arrives: **when risk gets a model, the model call runs from a background job reading the row, never inside the request a patient is waiting on.** That keeps the import graph clean and keeps the property the graph stands in for, which is that somebody writing at 3am is not waiting on an inference call to find out whether their sentence saved. `raiseCrisisAlert` already takes `source: "keyword" \| "model"` for that day. 2026-09-11. | major | 26.7 | **ruled, and the module moved** |
| C141 | 26 | **An append-only table cannot be expressed as a CHECK.** C111 rules the clinical summary versioned and append-only so therapist B never overwrites therapist A, and so revoking A cannot retract what the patient read. A CHECK constrains rows, not statements, so "you may INSERT and never UPDATE" had nowhere to live except a comment. **Ruling: a `BEFORE UPDATE OR DELETE` trigger that raises, so the promise is kept by the database rather than by discipline.** Without it the rule survives exactly until somebody writes a well-meaning "fix a typo in the summary" action, and a patient's record silently loses the version they read last month. 26.2 then costs nothing to build, because nothing in the product can retract a version. The author is also snapshotted by **name and licence** rather than only by id: a clinician can leave or be deleted, and a version whose author resolves to "unknown" a year later is not a record of anything. What it costs: the sprint 26 verifier has to disable its own trigger to clean up its fixtures, which is exactly as awkward as it should be. 2026-09-11. | major | C111 | **ruled, and attempted in `verify:sprint26`** |
| C142 | 26 | **"Cited like a document" assumes a citation model that is document-shaped.** 26.6 asks for journals to be cited in the copilot the way documents are. A document citation is `[D7:3]`, an ordinal and a sequence, resolved by opening `person_documents`; a journal has neither. **Ruling: journals reach the copilot now as dated, attributed material the model is told to quote by date, which is the part that matters clinically, and the clickable marker waits for a citation model that covers both. ⚠️ Incomplete until sprint 33**, where the evidence layer gives every derived fact provenance and is the right place to generalise a reference. Inventing a second half-citation model here is something sprint 33 would have to unpick. The `risk_level` column is deliberately not given to the copilot either: a model told "this entry is high risk" will agree, which is not evidence. 2026-09-11. | minor | 26.6 | **ruled, and named as incomplete** |
| C143 | 26 | **A verification code that resolves to a person is a certificate.** C127 wants a third party able to check an extract, and the obvious page shows the patient's name and what the record says, which is precisely the thing the ruling forbids us to issue. **Ruling: `/verify` answers with counts and a date and nothing else** — sessions, signed notes, summary versions, the day it was produced. No name, no clinician, no diagnosis, and an unknown code looks identical to a real one that is not yours. That distinguishes a real extract from a forged one, which is the entire job, and attests nothing about whether a diagnosis inside it is correct. A code ends up in a solicitor's file, a landlord's inbox and occasionally on a photocopier, and everything this page returns is returned to whoever holds it. 2026-09-11. | major | C127 | **ruled, and the page ships** |
| C144 | 27 | **C106 wanted the invariant "in the database", and the database could not hold it as a CHECK.** Whether a clinician's verification is `approved` lives in another table, and a CHECK constrains one row. **Ruling: a `BEFORE INSERT OR UPDATE` trigger on `history_grants` that refuses `status = 'granted'` for anybody not approved — and deliberately allows `pending`, because 27.3 needs a patient to be able to invite somebody mid-verification.** The trigger rather than a check inside `decideGrant` is the whole point: the case that actually happens is not the insert, it is a pending row sitting for months and being flipped to granted after the clinician's approval lapsed, which no function-level check would have been asked about. It also forced a second, better change: `decideGrant` now catches that refusal and **tells the patient why their tap has not taken effect**, because a person who approved and saw nothing happen would reasonably conclude the product is broken. 2026-09-11. | major | C106 | **ruled, and attempted on both the insert and the update** |
| C145 | 27 | **An invite that is a link is tapped by whoever is holding the phone.** C107's threat model is coercion, and the obvious implementation of 27.2 is a share link. **Ruling: a six-character code, read aloud across a desk to a specific person in a specific room.** Slower and more deliberate, and deliberateness is the only defence a product can offer here. The code also shows the clinician nothing: redeeming it returns a first name, so they know they did not mistype, and creates a pending request. What it costs: a patient who wanted to text somebody a link has to read out six characters instead. 2026-09-11. | minor | 27.2 | **ruled, and the copy on both sides says so** |
| C146 | 27 | **"Revoking never asks why" cannot be checked by scanning for the word "reason".** The consent screen legitimately contains one: declining a *request* may carry a preset reason, and §3 says so. **Ruling: the rule is asserted on the signatures along the revoke path** — one argument in the component, one in the action, three fields in the data function, none of them a reason. That is a fact about what the code *can* do rather than about what it currently says, which is the difference between a check that holds and a check that passes until somebody adds a parameter. 2026-09-11. | minor | 27.5 | **ruled, and `verify:sprint27` asserts the signatures** |
| C147 | 28 | 🔴 **Three verifiers wrote without asking where, and died with a TypeError when the answer was "nowhere".** `verify:sprint25`, `26` and `27` each selected a therapist and dereferenced it unchecked; against the purged production database, which has one seeded admin and no therapist, all three threw `Cannot read properties of undefined (reading 'organizationId')`. That tells the person running it the code is broken. It is not: they pointed a writing script at an empty database. The older verifiers get this right and say so, which is exactly the problem — **the rule lived in a copy inside each file, so every new file started without it.** **Ruling: both halves move into `scripts/_verify.ts`, which is what a new verifier already imports. `writesTo()` prints the host and refuses the production endpoint by name; `required(row, what)` turns a missing fixture into an operator message and exit 1 rather than a stack trace.** Applied to all **fifteen** writing verifiers, not the three that were named: twelve others had no guard either, and fixing only the three that had been noticed is how this recurs. 2026-09-11. | major | handover | **ruled, and the refusal is proved against the production endpoint by name** |
| C148 | 28 | 🔴 **C89's fourth appearance: the code was right and the database served the old thing.** `verify:sprint24` passed here and FAILED against production on 24.1, with em dashes on 13 published pages in both languages, because `content_pages` was still seeded from the pre-sprint-24 defaults. The sprint had banned the character in the code and left it live on every page. It was only caught at all because 24.1 reads **published rows** rather than the defaults file (C93's shape, paying for itself). **Ruling: reseeding published content is part of finishing a content sprint, not a deploy step somebody remembers.** `npm run db:seed -- --refresh-content` runs in the sprint that changes copy, and the sprint's own verifier is re-run against the reseeded database before the report is written. What it costs: a content sprint has one more mandatory step. What it buys: the gap between "the rule is in the code" and "the rule is on the page" stops being invisible. 2026-09-11. **Amended 2026-09-12, after the rule failed on its own sprint:** sprint 28 reseeded the branch database it was built on and left production holding the old rows, so `verify:sprint28` failed 4 of 21 the moment somebody pointed it at the database the sprint was about to be merged into. **The reseed has to happen on the database the sprint MERGES INTO, and the verifier has to be re-run there.** Reseeding where you happen to be working is the same defect wearing the fix's clothes, and it is the fifth costume of C89: twice now the code was right and the deployment was not. **And the mechanism, added in sprint 29, because a rule written in prose and obeyed in the wrong place is not a rule:** `npm run ship:content -- 28 24` reseeds and re-runs the named verifiers in one command that cannot be half-done, run by whoever holds the production credentials. It is the single script in `scripts/` that does **not** call `writesTo()`, because production is the entire point of it, and it says which host it is about to rewrite before it writes anything. | major | handover | **ruled, amended, and given a command** |
| C149 | 28 | 🔴 **28.5 and 28.6 both asked for pages and demos of features that do not exist.** An integrations page is the easiest lie on a software website: twelve logos, each linking to "connect your account", none of which does anything. 28.6 asks for a live component of a Zoom/Meet picker, a webhook payload and a partner UI, and all three belong to sprints 41, 42 and 43. **Ruling: build the pages, and make the state a fact about the code rather than an editorial decision.** `lib/integrations/registry.ts` gives every entry `live`, `partial` or `planned`; a `planned` entry appears on the page **labelled**, because a clinic finding out from us beats a clinic finding out after signing, and every entry (including the working ones) carries what it does **not** do, since that paragraph is where the useful information is. The four new routes are code rather than CMS rows for the same reason the radar link is hard-coded: an editor who could unpublish the page saying "there is no API yet" would leave us with no page saying it. `/developers` says there is no public API and lists the four things one would have to guarantee first, rather than documenting internal routes that take a session cookie and change shape whenever a screen does. **28.6's five named demos wait for the sprints that build what they show**; what shipped is the two screens sprint 26 did build. 2026-09-11. | major | 28.5 | **ruled, and the unbuilt entries say so in their own words** |
| C150 | 28 | **The Arabic pages were showing an English therapy session, and the fallback could not have done otherwise.** `getDemoContent()` asked the runtime for the locale, and `getLocale()` throws **synchronously** outside a request, which `.catch()` does not catch (19.0a learned this once already). So every script-rendered page landed in the outer catch and got the English constant, and there was only one constant anyway. **Ruling: the locale is a parameter, resolved before the try, exactly as C84 made the timezone and 19.4 made the currency locale; and the shipped floor has an Arabic twin written as Arabic rather than translated from the English.** An Egyptian patient does not describe insomnia in translated English syntax. The Arabic patient page now renders with **no English passage left in it**; the 37 that remain are the home page's SOAP note and session-room demo, which are a clinical document and therefore writing rather than translating, and stay on 22R.10 where 21R put them. 2026-09-11. | minor | 21R.8 | **ruled — the patient page's half is closed** |
| C151 | 29 | 🔴 **A passport and a licence were the last two files still protected by nothing but a URL.** H14 has said since sprint 8 that a blob URL is a secret rather than access control, and sprint 8 acted on it for clinical documents. Identity documents were left behind, and they are the worst thing to leave: a real named person's passport page on a URL that works forever, for anybody who ever saw it, with no audit trail and no way to revoke it. Both screens that showed them — the clinician's own onboarding page and the admin review queue — put the raw URL into the HTML, which is where a URL stops being secret: a screenshot, a forwarded tab, a support ticket with the page pasted in. **Ruling: `/api/uploads/[id]` mirrors `/api/documents/[id]` exactly — who is asking, may they now, audited before the bytes — and the reference in a page is `<verificationId>.<kind>`, which carries no secret at all.** Two readers and no third: the clinician it is about, and a super admin, because reviewing these **is** the verification process. 🔴 Deliberately **not** a colleague in the same organisation: organisation membership is the wrong boundary for a passport, and the verifier proves the refusal against a planted same-organisation clinician rather than reading the code. The audit row names which document and whose, because "somebody opened a verification" cannot answer the question this exists for. 2026-09-12. | major | 29.1 | **ruled, and the refusal attempted** |
| C152 | 29 | **The admin queue told reviewers a passport's neighbour was public, and it was not.** The review screen labelled the verification headshot "Headshot (public)". The picture a patient actually sees is `therapist_radar.photo_url`, set by the clinician on their own radar screen; `therapist_verifications.headshot_url` is uploaded for verification and published nowhere. **Ruling: the label is "Headshot", and it lives in `identity-access.ts` beside the rule rather than in the page.** A reviewer told a document is public handles it more casually than the passport beside it, which is exactly backwards, and a wrong label on a screen somebody makes decisions from is a defect rather than a typo. 2026-09-12. | minor | 29.1 | **ruled and corrected** |
| C153 | 29 | **The development-only upload route let any clinician read any other clinician's passport.** `/api/uploads/[...path]` existed so a checkout with no Blob token could run onboarding, and it asked exactly one question: are you signed in. The comment above it said "a clinician has to be able to see the licence they just uploaded, and an admin has to review it" — both true, and neither is what `requireUser()` checks. Walking a path was enough. **Ruling: it calls the same `localUploadAllowed` the blob route's decision module exports, so the two cannot drift, and a refusal is a 404 rather than a 403.** Development-only is not a defence: a development-only hole is the one that gets copied into the real thing. 2026-09-12. | major | 29.1 | **ruled and closed** |
| C154 | 30 | 🔴 **Routing a chart on the practice puts an Egyptian patient's record in the wrong country, and every test passes.** C118 says "route on the entity", and the obvious entity is the organisation, because that is what an `Actor` already carries. It is wrong. An Egyptian patient seeing a clinician registered in the United States is the **ordinary case on this product**, not an edge of it, and the clinic-shaped implementation would have served her record from Virginia while satisfying every check anybody wrote. **Ruling: the region lives on the PERSON as well as on the organisation, and a chart resolves through the patient — `regionOfPatient` reads the person first and falls back to the practice only when a patient row has no person yet.** The verifier plants exactly that pair, an Egyptian person in an American organisation, and asserts the chart resolves to `eg` while the practice resolves to `us`. What it costs: a clinician's caseload is no longer one query, which is why `acrossRegions` exists (C155). 2026-09-12. | major | 30.1 | **ruled, and the wrong-country case is planted** |
| C155 | 30 | **Two things a region seam makes impossible, found by building it rather than by arguing about it.** First: **a clinician's caseload spans regions.** An American clinician with one Egyptian patient has one chart in Cairo and the rest in Virginia, and there is no single query that returns both. That is inherent to data residency, and the expensive way to learn it is the day Cairo goes live and a caseload list quietly returns a caseload minus one. So `acrossRegions()` is a primitive **now**, while both regions are one database and the results are identical either way, and a list that must span says so at the call site. Second: **a lookup keyed on a row id cannot route at all** — `ownerOf(documentId)`, `documentsByIds` — because you need the row to know its region and the region to read the row. The two honest exits are to put the region in the id or to fan out, both of which have consequences for sprints 42 and 43. **Ruling: `lib/data/documents.ts` stays pinned and the circularity is named in the file**, rather than half-routed in a way that reads like a decision. 2026-09-12. | major | 30.1 | **ruled, and `acrossRegions` ships** |
| C156 | 30 | **The Arabic cross-border consent named both countries in English, and a verifier found it rather than a reviewer.** `regionLabel()` returned one string, so the Arabic wording rendered *"سجلّك الصحي يخصّ Egypt"* — an Arabic sentence with two Latin-script country names, on the one screen whose entire legal value is that the person understood it. "They agreed" is not a defence if half the sentence was in a language they do not read. **Ruling: `regionLabel(region, locale)`, with the locale as a parameter, which is C150's standing rule meeting the first surface built after it was written.** The lesson is narrower and sharper than the rule: assert on the **rendered string**, not on the function's existence. A check that the wording mentions the serving country would have passed in English and hidden this; the check that compares the Arabic output to an Arabic expectation caught it in the first run. 2026-09-12. | minor | 30.3 | **ruled and fixed** |
| C157 | 30 | 🔴 **The sprint 30 report said "47 pinned". The truth is 85 call sites in 82 files, and the report was wrong by 45 per cent.** `regionPins()` was a **runtime** registry: a module registers its pin when something imports it, so the verifier printed the modules that one execution happened to load. The mechanism was right — a registered pin with a reason is genuinely better than `dbFor("us")` with a comment — and the counting measured what it could reach rather than what is true. **That is the third time in this repository**: C84's checker matched its own helper, 18.8 was vacuously true against no content, and this counted imports instead of pins. All three were caught by a person counting the source by hand and getting a different answer. **Ruling: a number that describes the source is measured from the source.** `scripts/_region-pins.ts` walks the files the way the C84 guard does. **And because a pin is debt, the count is now a ratchet**: the high-water mark is committed to `scripts/_region-pins.json` and `verify:sprint30` FAILS when the figure goes up, proved by planting an extra pin and watching it fail at 86. Routing a module lowers it; adding one is a deliberate edit to a checked-in number rather than a drift, which is the shape debt has to have or it becomes C89 again. A second check asserts each pin's label names its own file, because a label is a hand-written string beside a path and the two drift the moment a file moves. 2026-09-13. | major | handover | **ruled, counted statically, and ratcheted** |
| C158 | 31 | 🔴 **A guard proved by a redirect can be proved by nothing at all.** 31.1 claims that a private path gets no second URL, so the verifier asked for `/ar/patient/journal` and asserted a 3xx away from the prefix. It passed. Then the offender was planted — `/patient` added to the public list, the guard effectively removed — and **it passed again**: with no guard, the prefix is stripped, the request reaches the ordinary routing, and a signed-out stranger is bounced to `/patient/login` with a 307 that looks exactly like the guard working. The check was measuring the login wall, not the rule. The fix is the path where the difference is visible: `/patient/invite/<token>` is the one private route that serves to a stranger (22R), so it is the only one where a missing guard renders **200** at a prefixed address — and it did, immediately, under the planted build. **Ruling: a negative proof must plant the offender where its absence would actually show.** Sprint 30's rule (prove a structural claim by making it fail) is necessary and not sufficient; a planted offender that produces the same observable as the guard proves nothing, and reads as rigour. 2026-09-13. | major | 31 | **ruled, and the verifier now asserts both paths** |
| C159 | 32 | 🔴 **The crisis scanner could not read Arabic at all, and the first eval run scored it 0%.** Five Arabic sentences saying plainly that somebody wants to die, none found, in the market this product is built for. The list had been English-only since it was written; 21 tests and 31 verifiers passed; nothing anywhere said so, because nothing had ever asked. It is the single most valuable thing sprint 32 found and it was found by **counting**, not by reading. Fixed in the same sprint (24 Arabic phrases, plus a fold that removes diacritics and normalises alef/ة/ى so a phone keyboard and a vowelled sentence match the same list), taking Arabic sensitivity 0% → 80% and overall 38.5% → 84.6%. **Ruling: a safety number is reported per language and never averaged into a total.** An overall 38.5% reads as a middling score; "Arabic 0%" reads as what it is. Every metric in `evals/` that can differ by language now carries a per-language row for that reason. 2026-09-13. | major | 32 | **ruled, fixed, and measured before and after** |
| C160 | 32 | **The eval has its own noise, and a baseline recorded from one run pins the gate to whichever run was lucky.** Two consecutive runs of unchanged code moved `notes.coverage` by 13 points, which is two facts out of fifteen: with three cases, one fact is 6.7 points. A gate set to a lucky run then calls every honest run a regression, and the first thing anybody does with a gate that cries wolf is mute it (C90, arriving through quality instead of through skips). **Ruling: a recording run averages several takes, prints the spread, and says out loud when a metric's spread exceeds its own tolerance** — because that metric cannot see a small real regression, and **the fix is more cases, not a wider band.** The tolerances are written in the suites beside the reason for each, so they can be argued with rather than tuned quietly. 2026-09-13. | major | 32 | **ruled, and `--repeat` implemented** |
| C161 | 32 | 🔴 **A test passed because both sides were empty.** The Arabic diacritic character class was written with literal characters and its ranges swallowed the Arabic **letters**, so every Arabic string normalised to nothing, and `assert.deepEqual(normaliseWords("أنا مُتعَب"), normaliseWords("انا متعب"))` passed on two empty arrays. In the file whose entire job is stopping vacuous numbers. It was caught not by the test but by the crisis scanner suddenly matching **every English sentence** in the eval set, because an empty needle is `includes`-true for everything. **Ruling: an equality between two derived values is not a pass. Assert that the value survived** — the expected content, or at minimum a non-zero length — or the assertion is satisfied by the transformation destroying both sides. Third cousin to C84 and 18.8, and the cheapest of the three to prevent. 2026-09-13. | major | 32 | **ruled, and the assertion strengthened** |
| C162 | 31 | 🔴 **Every canonical and hreflang on the live site named the wrong hostname, and the sitemap agreed with them.** `APP_URL` in the deployment was `habiba-zeta.vercel.app` rather than the domain people reach, so the day sprint 31 shipped, the product told Google that the Arabic pages it had just built live on a different domain. The code was right; the environment was wrong; the founder fixed the variable. **The check was the gap.** `verify:sprint31` asserted the canonical *ends with* `/ar/pricing`, which is true on any domain in the world, and no unit test can see a hostname at all. **Ruling: anything a page asserts about where it lives is checked over HTTP against the host that served it.** That was the stated reason for writing this verifier over the wire and the first version simply did not follow it far enough. Now proved as a negative in the literal shape of the defect: the app is started with `APP_URL=https://habiba-zeta.vercel.app`, and the check fails naming all four tags. One subtlety recorded beside it: the sitemap is prerendered, so its host is baked at **build** time while the canonical is rendered per request, and the two can disagree until a rebuild. 2026-09-13. | major | 33 | **ruled, checked, and proved against the real wrong hostname** |
| C163 | 32 | 🔴 **The Arabic list was formal Arabic, and nobody in distress writes formal Arabic.** The founder verified sprint 32's number independently against his own Egyptian sentences: 3 of 5 caught, and the three misses were *مش قادر اكمل حياتي*, *حاسس اني عبء على اهلي*, *مفيش فايدة من حياتي* — cannot carry on, a burden on my family, no use in my life. Not a missing phrase: a missing **register**. Two things followed. First, **perceived burdensomeness was missing from the ENGLISH list too** — one of the most consistently reported antecedents there is, and it took the Arabic misses for anybody to look, so it was added in both languages. Second, a rule for this list, because a phrase list can always be made to score well on its own fixture: **add the concept in both languages, never a phrase reverse-engineered from a test sentence.** All four new cases are caught on a harder set: sensitivity **88.2%** over 17 positives (Arabic **87.5%**), specificity **76.9%** over 13 negatives. The two that remain missed need a classifier and are left missed on purpose: a person describing letters left in a drawer, and *لا يوجد سبب يجعلني أكمل*. **84.6% was never a result. 88.2% is the floor sprint 35 has to beat, measured rather than asserted.** 2026-09-13. | major | 35 | **ruled; cases added, list widened in both languages, baseline re-recorded** |
| C164 | 33 | 🔴 **PLAN.md 33.1 ranks the sources clinician · document · AI · patient. I built clinician · document · PATIENT · AI, and this is the paragraph saying why.** The commonest conflict this product will ever have is a person saying *"I stopped taking that in June"* against an inference drawn from a transcript recorded in May. Resolving that in the model's favour is wrong every time, and the ranking is not an abstraction: `source_priority` decides which row a note reads, which row the chart shows first, and which rows may supersede which. A model's output is the only source in the list with **no human behind it**, and 33.2 already rules that it is never a confirmed fact — so placing it above the person it is about would let an unconfirmed inference outrank primary testimony about somebody's own body. **What it costs:** a patient's recall is genuinely worse than a document for dates, dosages and history, and this order now lets a remembered "about two years" supersede a letter that says eighteen months. That is a real loss and it is the smaller one; the document still ranks above the patient, so only AI sits below. **Reversing it is one CASE expression in `0062_clinical_facts.sql` and one object in `lib/clinical/currency.ts`**, and the verifier asserts the order explicitly so a change is loud. 2026-09-13. | major | 34 | **ruled, implemented, and asserted, with the deviation named** |
| C165 | 33 | **A trigger that refuses every write satisfies half of any acceptance test.** Sprint 33 has six rules the database enforces by refusing a write, and the obvious way to check them is to attempt each one and assert the failure. That check passes just as well against a trigger with `RAISE EXCEPTION` and nothing else — a table nobody can write to at all. So **every refusal in `verify:sprint33` is paired with the write it must NOT refuse**: the blank quote is refused and the quoted fact is accepted; the AI supersession is refused and the clinician's is accepted; the edit is refused and the dispute goes through. It is C90's argument (a gate that is always red is a gate everyone learns to skim) arriving through data rather than through skips, and it belongs to §6's family: a check earns its place by failing, and the other half of earning it is opening. 2026-09-13. | major | 33 | **ruled, and every rule in 33 is checked in both directions** |
| C166 | 34 | 🔴 **The founder's question: does anything MARK a fact stale? It did not, and the ladder was absolute across time.** Sprint 33 computed currency at read time for the **display** and ordered by source then recency, so the chart printed *"2 years ago (not current)"* beside a fact that was still sorting above last week's discharge summary — and every consumer takes the first row. The label was honest and the order was not. **Ruling: currency gates the ladder.** Any current fact outranks any stale one; the ladder decides among equals. Applied in `rankFacts`, in TypeScript rather than SQL, because the half-lives are per-domain and duplicating them into a `WHERE` clause would be two copies of a clinical rule drifting apart. **The cost, named:** a stale *clinician* entry now sorts below a fresh model inference in the same field. Two things bound it — a diagnosis never expires, so nothing a clinician diagnosed is ever demoted this way, and an AI fact is still unverified on screen and still cannot supersede. 2026-09-13. | major | 34 | **answered, fixed, and asserted in four tests** |
| C167 | 34 | 🔴 **An unverified model guess never enters another model's context.** Bought by the first grounded eval run. An `ai` fact is by 33.2 a guess nobody confirmed; feeding it back as prior context is how a guess becomes a fact by repetition — session 3's inference is read as background in session 4, written into the note, and by session 6 it has been "in the record" three times and nobody can find the sentence it came from. The evidence layer would be laundering its own output. A clinician verifying it breaks the cycle, which is what the evidence screen is for. 2026-09-13. | major | 34 | **ruled and filtered** |
| C168 | 34 | 🔴 **The note generator is sent no diagnoses at all.** Every leak measured in sprint 34 was diagnosis-shaped: a prior "history of panic attacks" became "panic disorder", a misfiled document's "major depressive disorder" was repeated as this patient's, and the Arabic postnatal case picked up a label nobody in the room said. A diagnosis is the highest-consequence thing this product can put in a record and the easiest thing for a model to restate, because restating it reads as competence. It is also the least useful background a SOAP note has: the prompt already forbids diagnosing and the clinician has the chart a tap away. **Cost:** the draft no longer reflects the working diagnosis back at the clinician. 2026-09-13. | major | 34 | **ruled and filtered** |
| C169 | 34 | **A note written in English was reported as Spanish.** Caught by the grounding run, in the `panic-on-the-metro` case; "metro" is the likely pull. Two consequences, neither cosmetic: the viewer gets the wrong direction and font, and `generateNoteContent` sees a non-English language and spends a second model call translating an English note into English. **Ruling: the model's claim is checked against the script it actually wrote in.** A note in Arabic characters is Arabic whatever the tag says; a note in Latin characters is not Arabic whatever it claims. That closes the failure that matters — right-to-left rendered left-to-right. **Residual, named and still in the baseline:** `en` mislabelled as `es` shares a script and this cannot see it. `notes.language` records 86.7% rather than 100% for exactly that reason. 2026-09-13. | minor | 35 | **ruled, checked against the script, residual recorded** |
| C170 | 34 | 🔴 **A model cannot arbitrate a contradiction, so it is no longer asked to.** THE finding of sprint 34, and it is a number: when a prior fact disagreed with the transcript, the note followed the **prior fact 93% of the time** (contradiction metric 6.7% over five cases and three runs). The prompt says *"the transcript is what happened"* twice, once as the overriding rule above the schema. It is worth almost nothing. A model handed two accounts of one patient does not weigh them, it blends them and writes the more confident-sounding one. **Ruling: the domains a session re-measures are not sent at all** — `presentation`, `function`, `risk` — because a stored value for sleep, work or ideation is a rival account rather than background, and the transcript is about to say what is true now. That took the metric from **6.7% to 80%**. 🔴 **And the honest reading of that number: most of the improvement is the situation not arising.** Four of the five contradictions are no longer sent. The one still sent (`social`) is followed about half the time, and **that** is the measure of the model's arbitration. **Cost:** the note loses "this is the third week of early waking", which is the longitudinal framing 34.1 existed for. Smaller than a note saying somebody sleeps through the night on the day they said they do not. 2026-09-13. | major | 35 | **ruled, filtered, and both numbers reported** |
| C171 | 35 | 🔴 **The keyword floor is now the ONLY source of false alarms, and that is the cost of 35.2 stated as a number.** The classifier scores **100% specificity** on the eval set: it correctly refuses every idiom, every past-and-resolved disclosure and every story about somebody else, which is exactly what a phrase list cannot do. What ships scores **76.9%**, unchanged from the list alone, because all three false alarms come from the floor and the floor may only ever raise. **The ruling stands and the trade is deliberate:** a false alarm costs a clinician's attention, a miss costs a life, and a model that can veto an alert is a model adjudicating risk, which 35.3 forbids. But the number now says precisely what the floor costs, and it points at the fix — narrow the LIST ("overdose" and "suicidal" without tense or subject are the three offenders), not the ruling. 2026-09-14. | major | 36 | **ruled, measured, and the fix pointed at the list** |
| C172 | 35 | **A metric noisier than its own band cannot tell a regression from a coin flip, and the run must say which it is without ever going green.** `grounding.contradiction` failed a one-take run against a three-take baseline by 0.20 against a band of 0.19 — inside its own recorded spread of 0.400. Widening the band is what C160 forbids; re-recording is laundering; passing it is a lie. **Ruling: the baseline records each metric's `spread`, and a red line inside that spread is printed `WORSE?` with "re-run with --repeat 3" beside it. The exit code stays 1.** A red line that might be noise is not a green line. It is the skip mechanism's argument (C90) applied to quality: a gate is only worth having if the reason beside it is true. 2026-09-14. | major | 35R | **ruled and implemented; one metric currently qualifies** |
| C173 | 35R | 🔴 **C161 happened again, one sprint after it was ruled on, in a new file, and it silently disabled a safety guard.** The context guard was written with a second copy of the Arabic fold, its literal character class swallowed the letters exactly as C161's had, and every Arabic marker folded to `""`. `"any English sentence".includes("")` is true, so the "is this about the present?" test returned **true for every sentence in every language** and the guard suppressed nothing at all. The eval showed **no change whatsoever** after the guard shipped, which is the only reason anybody looked. **The ruling C161 wrote was a thing to remember, and remembering failed.** So it becomes two things in code: **one fold**, in `lib/crisis/fold.ts`, written with explicit `\u` escapes because a class of literal Arabic marks is unreadable in every editor and diff — unreadable is how it was wrong twice — and **`contains()`, which refuses an empty needle**, used by every membership test in `lib/crisis`. That turns the bug class from "a scanner matches everything" into "a marker does nothing", which is safe in both directions and visible in a test. `foldsToNothing()` asserts every marker list over its data, so a marker added in 2027 is checked too. 2026-09-14. | major | handover | **ruled, and the class closed at the point of damage rather than in a habit** |
| C174 | 35R | **A widened case set silently invalidates every number in the baseline.** Fifteen sessions compared against a figure taken over five is not a regression or an improvement; it is two different measurements printed next to each other, and the gate would have called the difference either. **Ruling: the baseline records the SHAPE it was measured on, and a run over a different shape is REFUSED rather than compared** — the run fails, names what changed, and asks for a deliberate re-record. Same posture as C172: never green on a number that cannot be trusted, and never quietly adjusted to make it green. The existing file has been annotated with the shape it really was measured on (5 / 30 / 3) rather than back-filled with numbers nobody took. 2026-09-14. | major | 36 | **ruled and implemented; the gate is honestly red until a re-record** |
| C175 | 36 | 🔴 **A rule about what a bot may join is kept by a table that cannot describe anything else.** 41.1 says *the bot joins meetings 24Therapy created for a session, nothing else, ever*, and the founder's carry-in was exact: if `session_sources` can represent a source that did not come from a session we created, the rule becomes a convention again. So the table has **no column for a link somebody pasted** and **no column that could hold a calendar** (C132) — no `calendar_event_id`, no `ics_uid`, no `organizer_email`, no `join_url` — an external kind must carry `provisioned_at` and `provisioned_by_user_id` by CHECK, one source per session by unique index, and the meeting identity is **immutable after insert** by trigger, which is 41.7's "bot in the wrong meeting" foreclosed two sprints early. `verify:sprint36` proves the calendar scan against four planted column names, because a scan that finds nothing proves nothing. **The residual, named rather than claimed away:** nothing in the database can tell whether `provisioned_at` was set by the meeting-creating path or by a future caller that lies. What the schema removes is every easy way to represent a foreign meeting and every column that would make reading a diary convenient; sprint 41 owns the one writer. 2026-09-14. | major | 41 | **ruled, and proved by attempting each write** |
| C177 | 37 | 🔴 **THERE IS NO ELIMINATION RULE, AND THIS IS WHAT IT COSTS.** The tempting line of code is four words long: two voices, one of them is provably the clinician, therefore the other one is the patient. It is right most of the time, and the times it is wrong are not random — a supervisor sitting in, a parent answering for a child, a partner arriving twenty minutes late, a mother on speakerphone. Every one of those is a voice that is not the patient in a recording whose only identified voice is the clinician, and elimination writes all of them into the chart under the patient's name. Acoustically there is nothing to separate those cases from an ordinary two-person session, so no confidence score can rescue the rule. **Decided: a voice is bound to a person only by evidence — `track` (the recording already knew, because two tracks were captured) or `operator` (a named human said so, with their id and the date) — and a voice with no evidence of its own is `Speaker N` permanently.** Not even by elimination in a two-voice room, and not even when two voices both look like the clinician: the stronger claim takes the role and the loser is left **unnamed** rather than handed the leftover one, which is elimination wearing a hat. A tie is nobody. **The cost, stated rather than buried:** a single-microphone session with no two-track evidence attributes nobody by this path at all. It falls through to the semantic layer that has shipped since sprint 32, which labels roles from the words and marks every row `speaker_inferred` — so the reader can always tell which of the two answered. The acoustic layer's job is separating voices; naming them is a different question with a different standard of proof. 2026-09-15. | major | 41 | **ruled, proved in both directions, nine fixtures** |
| C178 | 37 | **An unrecognised voice cannot be written down as a person, and the enum is missing the value that would let it.** C175's lesson applied to identity: the rule "when a voice is nobody, write `unknown`" is a convention a service can forget, so migration 0065 makes it a refusal. A transcript line carrying a `voice_id` is checked against that voice — a line on an **unbound** voice may only say `unknown`, a line on a bound voice may say `unknown` or that voice's own role, and a line may not point at a voice from another session at all. `bound_by` is `('track','operator')` and there is **no `model`, no `inferred`, no `auto`**: a schema that cannot express "software decided who this is" is a schema in which 37.2 cannot quietly stop being true, and adding the value is a migration with somebody's name on it. There is also **no display-name, alias or nickname column** anywhere on the voice — a voice shows either the person the session record already names (41.5, two sprints early) or `Speaker N` computed from its ordinal, so a meeting provider's "Mum" or "iPhone" has nowhere to land. **And unbinding cleans up after itself:** the moment a voice is unbound, every line that claimed that person goes back to `unknown` in the same statement, because otherwise 37.2 would be true only of rows written after somebody admitted the mistake. A direct swap from one person to another is refused; a correction is unbind then bind, two deliberate steps. 2026-09-15. | major | 41 | **ruled, every refusal paired with the write it must allow** |
| C176 | 36 | **A third door is only safe if it is NARROWER than the two it joins.** The ingestion token authenticates a machine, so it gets less than a person does, not the same: it is scoped to one session (the id is inside the token **and** the hash is stored on that session's own row, so a token for session A cannot be expressed at session B), it expires in hours, it is revocable, its uses are counted, and it is stored only as a SHA-256 the column's CHECK will not let be anything else. **And what it opens is audio in, a sequence number out.** The copilot never runs on a token request — it reads a chart and writes into a clinician's thread, and a bot is not in the room — and the response body carries no transcript text and no crisis flag, because a credential somebody could leave in a log must not be answerable with clinical text. The two existing doors are untouched: `assertSameOrigin()` and `requireUserApi()` still guard the browser path, and the token branch is taken only when a bearer is presented. 2026-09-14. | major | 41 | **ruled, 17 pure tests, every refusal paired with the acceptance** |
| C179 | 37R | 🔴 **`bound_by = 'operator'` has no screen and no ticket owns one.** Sprint 37 made a named human the only way a voice gets a role without two-track evidence, which is exactly right, and then nothing anywhere lets a human do it. `session_voices` is referenced by **zero** components. Every single-microphone session therefore falls through to the semantic layer permanently, and C177's carefully-built `operator` path is unreachable. **Ruling: 37R either builds the screen or writes the ticket that owns it, and says which.** A capability the database records and no interface offers is a capability nobody has. | major | review | **ruled — sprint 37R.22** |
| C180 | 37R | 🔴 **Nobody has used this product since sprint 22R, and fourteen sprints have shipped.** 57 route files changed or appeared. The patient app was rebuilt, the claim order was corrected, portability, journals, summaries, exports, Arabic URLs, a region seam and a risk classifier all landed. Every one verified against the database or the import graph; **not one walked by a person.** 22R found seven defects in a single pass and every one was a screen that was wrong while the rows beneath it were right — a patient claimed their record and their app said it was empty. That class is invisible to every verifier here. **Ruling: the second walkthrough is its own sprint and it runs before 40**, because each sprint that passes makes it longer and because a beta user is closer than a partner integration is. | major | review | **ruled — sprint 37R** |
| C181 | 37R | 🔴 **The internal apps have never had a design pass, and nobody has checked whether they look finished.** Sprint 25 rebuilt the patient app because the founder looked at it and said so; 24.4 rebuilt one settings page. Everything else in the therapist portal and the entire admin console has been built for **function** since sprint 1, and no sprint, verifier or walkthrough has ever asked whether a page is plain text and bare buttons with no sections, no icons, no hierarchy and nothing to rest the eye on. Empty states have never been looked at at all, and an empty state is the **first** screen a new therapist and a new patient see. **Ruling: 37R gives every page a design verdict separately from its functional one** — *finished · thin · unstyled* — judged narrow and wide, and judged in Arabic as Arabic rather than as the English page mirrored. The output is one complete table, not a highlight reel, because that table is the brief for the design sprint that follows it. | major | founder | **ruled — sprint 37R.23a–g** |
| C182 | 37R | 🔴 **THE PRODUCT IS NOT LOCALISED. ONLY THE WEBSITE IS.** Every page was walked with `Accept-Language: ar-EG`. Direction is correct everywhere — **71 of 71 Arabic renders came back `dir="rtl"`** and no page scrolls sideways on a phone in either language — and what sits inside that frame is English: **all 18 admin pages, all 21 therapist pages, all 14 patient pages and all 8 sign-in pages**. Only `/` and `/for-patients` are genuinely Arabic, because they are CMS rows. `lib/i18n/messages.ts` holds **87 keys**, 43 of them used, by **4 components**, against a product of roughly a thousand strings. Sprint 31 shipped Arabic *addresses* and Arabic *content* and both work; nobody has translated the *application*, and no sprint since has claimed to. For a product whose first market is Egypt and whose patient app is what somebody opens in a crisis, this is the last thing standing between here and a beta in Cairo. **Ruling: a localisation sprint of its own, before launch, and it is mostly mechanical** — a `t()` call per string, the dictionary grown from 87 keys to the real surface, and a verifier that fails when a rendered page in Arabic is more than half English, because that number is measurable and is the only honest gate. 2026-09-16. | major | 37R | **ruled — needs its own sprint** |
| C183 | 37R | **The admin console has never had a design pass, and the numbers say so.** Nine of its eighteen pages render **zero icons**; six are a heading, one card and under sixty words. The audit log is **101 stacked rows of text with no table, no filters and no icons**; `/admin/usage` is two tables of numbers on the page that exists to show a trend; `/admin/tv` is thirty words with no `h1` and is meant to go on a wall. The therapist portal is better but has one shape everywhere: **a single ~620px column pinned beside the sidebar, leaving 40% of a 1440px laptop empty** (C197). Complete verdicts for all 81 pages, with counts, are in `docs/walkthrough-2/REPORT.md`: **13 finished, 34 thin, 14 unstyled**. That table is the brief for the design sprint. 2026-09-16. | major | 37R | **recorded, with the table** |
| C184 | 37R | 🔴 **THE SOS ORB SHOWED AN EGYPTIAN PATIENT A UNITED STATES NUMBER, AND IT IS THE FINDING OF THIS WALKTHROUGH.** Layla's number is `+20 100 123 4567`; her therapist practises in Egypt; her record was created from an Egyptian dialling code. The sheet that opens on the most safety-critical control in the product led with a large red **🇺🇸 Help · 988 · United States**. `lib/crisis/line.ts` exists to prevent exactly this and says so in its own first paragraph — *"`tel:988` dialled from Cairo reaches nothing"* — and exports `crisisLine(country)`. **The orb never called it.** It rendered `Object.entries(CRISIS_LINES)`, the whole table, and the table has one row, so every patient on earth was shown the American lifeline as the primary action and the sentence that is true everywhere was demoted to a footnote. **No verifier could see it:** the string lives where it belongs, the import is from the right module, and the code only looks wrong if you are the patient. **Fixed:** `lineForNumber(e164)` matches the longest dialling-code prefix and answers only when the candidates leave exactly one verified line between them, so `+20` gets nothing and falls through to the sentence while `+1` still gets 988; the orb takes the reader's own number and the patient layout supplies it. Eight tests hold both directions and `verify:sprint37r` proves the scan against the shape that shipped. 🔴 **The rule: a verified number is not enough. It has to be verified FOR THE READER.** 2026-09-16. | major | 37R | **fixed, re-walked, and held by tests** |
| C185 | 37R | **A signed-out visitor got a navigation bar whose every destination bounces them to a sign-in screen.** `PatientChrome` has taken a `nav` prop since sprint 25 and its own comment explains this case in as many words; **nothing ever passed it**, so the default won and a person opening an invite from WhatsApp got four tabs and no way to use any of them. The same layout now asks `optionalPatient()` once and the answer feeds both the bar and C184's crisis line — one question, two things that were wrong for the same reason. **And back is a real control now:** nine patient pages had a fixed `Back` to `/patient` and two had none at all, so moving between consent, summary and journal kept throwing the reader to the top. One `PatientBack` component, `router.back()`, with a named fallback because half this product's traffic arrives on a deep link with no history to go back to. 2026-09-16. | major | 37R | **fixed** |
| C186 | 37R | 🔴 **The same person could be added to a caseload twice, silently.** Same phone, same email, ten seconds apart, two patient records, no warning of any kind — `addPatient` had no duplicate check at all. In a product whose identity model is **the phone number is the handle** (§3b, C119), that is not untidiness: the invite, the claim and the summary attach to one of the two rows and the clinician reading the other sees half a history with nothing on the screen to say the rest exists. **Fixed by refusing rather than merging** — merging two charts is a clinical decision nobody should make implicitly — and refusing rather than by a unique index, because two people really can share a phone and a parent's number on a child's record is ordinary. The refusal names the record that already holds the number, links to it, and takes a deliberate tick from somebody who has read the sentence. 2026-09-16. | major | 37R | **fixed** |
| C187 | 37R | **Eight smaller findings, each fixed, each held by `verify:sprint37r`.** The admin console clipped five of its sixteen destinations off the right edge of a 1440px laptop with no fade, no arrow and no other link to them (**it wraps now**). The therapist's radar control was a floating white circle containing a 12px grey dot, unlabelled (**it carries the sidebar's radar icon now, with the status as a badge**). The invite landing told people to *"open this link again"* when both buttons already carried the invite. The phone selector beside a `+20` number said *United States*. A confirmation read *"chart signed, their copy released."* with no capital. The consent screen said *"look for their request above"* after the request had gone. The SOS button's accessible name omitted its own visible label. And one **recorded rather than fixed**: signing up with a number that already has an account still tells a stranger that it does, because the neutral-response design needs a message channel this deployment does not have. 2026-09-16. | minor | 37R | **fixed, one recorded** |
| C198 | 37L | 🔴 **THE SAME DEFECT AS C184, IN THREE MORE PLACES, AND TRANSLATING IS WHAT FOUND IT.** The live session screen, the feedback page and the radar's safety line each printed **988** to every reader on earth. None was as bad as the orb — each said *"in the US"* rather than showing a flag — but each was the only concrete number an Egyptian patient was given, on the screen they are sitting on during a session, immediately after one, and while looking for help. All three had a dictionary key **already written** that says the thing that is true everywhere; none of them called it. **The rule generalises exactly as the founder said it would:** a verified number is not enough, it has to be verified for the reader, and the reader is not always the person who wrote the sentence. `verify:sprint37l` now scans every component for a bare crisis number, comments stripped, proved against the line that was in the session room. 🔴 **And the method is the finding: a translation pass is a full read of every sentence in the product, which is why it found what fourteen sprints of verifiers and one walkthrough had missed.** 2026-09-17. | major | 37L | **fixed, all three, and guarded** |
| C199 | 37L | **A hook in a server component builds clean, typechecks clean and throws at request time.** Three components were given `useT()` without `"use client"`; `tsc --noEmit` passed, `next build` passed, and the patient's home screen and session list returned a 500 the moment a browser asked for them. Nothing in the toolchain says so, because it is a runtime contract between two module graphs. **Two consequences, both recorded:** the guard is now a check (`no server component calls the client hook`), and the reason it was caught at all is that the sprint ended by **running the app and reading the screens in Arabic** rather than by trusting the gates. The 37R lesson in a new costume, one sprint later. 🔴 **And a second one from the same hour: `next start` does not fail loudly when the port is taken** — a restart script that does not kill the old server leaves the previous build answering, so a fix appears not to work and the log fills with an error that has already been fixed. `tests/run-e2e.sh` has a comment warning about exactly this; the walkthrough harness did not. 2026-09-17. | major | 37L | **fixed, guarded, and the harness corrected** |
| C200 | 37L | **Translating the product broke five gates that asserted copy by grepping for it.** `verify:sprint19`, `21R`, `25` and `26` each held a sentence — *"call your local emergency number"*, *"Leave your session?"*, *"Add an email to get your record"* — by testing that it appeared in a component's source. The moment the sentence moved into the dictionary those checks began asserting, in effect, **that the file had not been translated**. Each was repointed at the dictionary in both languages while keeping the property it was really about, and that is the general rule: **a check on COPY belongs against the source of the copy, not against whichever file currently renders it.** A gate that greps a component for English is a gate with an expiry date, and the expiry date is the day the product learns a second language. 2026-09-17. | minor | 37L | **five gates repointed** |
| C182 | 37L | 🔴 **The website is Arabic and the product is not.** Measured on `main`: **0 of 21 admin pages, 0 of 19 patient pages, 2 of 20 therapist pages** call the dictionary. 87 keys exist, 43 are used, by 4 components. Sprints 19, 21 and 31 each shipped real Arabic work and none of them translated the application, because each was scoped to the surface in front of it and nothing counted what was left. A patient found on an Arabic homepage, signed up on an Arabic form, lands in an English app. **Ruling: its own sprint, 37L, and it blocks a beta in Egypt** — not because anything is broken but because the market cannot use it. And the guard is a ratcheted count of translated pages, because a rule shipped in sprint 19 and ignored for fourteen sprints is a rule that needs a number behind it. | blocker | 37R | **ruled — sprint 37L** |
| C183 | 37R | 🔴 **The SOS orb showed every patient on earth the American lifeline.** `lib/crisis/line.ts` exists precisely to prevent this and says so in its own first paragraph: *"`tel:988` dialled from Cairo reaches nothing."* It exports `crisisLine(country)`. **The orb never called it** — it rendered `Object.entries(CRISIS_LINES)`, and with one row in that table a patient in Cairo pressing the most safety-critical control in the product got a large red card reading **🇺🇸 Help · 988 · United States**, with *"call your local emergency number"* demoted beneath it. C98 was ruled, the module was built, five components were fixed, and the sixth was added afterwards and read the table instead of the function. **No verifier could have seen it**: the string is in the right module, the import is from the right place, and it only looks wrong if you are the patient in Cairo looking at a flag that is not yours. **Ruling, and it goes in §6: a verified number is not enough. It has to be verified FOR THE READER.** `lineForNumber` now matches the longest dialling prefix and answers only when exactly one verified line survives; `+20` gets the sentence, `+1` still gets 988, proved both directions. | blocker | 37R | **resolved — sprint 37R, and the rule generalised** |

**The rule going forward: never shape a product decision around a production
row again.** If a change is right, make it. The migration still has to be
additive because the *running deployment* must survive the gap (H16) — that is
about uptime, not about the data.

---

### Sprint 12 — The sweep · ~1 week · 🔴 FIRST

Everything the reset and §3b change about work that already shipped. One
sprint, so no later sprint has to carry an "except for" clause.

- [x] **12.1** `copilot.gateActiveFrom` deleted. The gate is a boolean and it
      is **on**. `isGated` loses its date argument and its grandfather branch
- [x] **12.2** C26's exclusion removed — every session is ratable or the
      reason is a live fact, not a historical accident
- [x] **12.3** C70 — the ~40 billing, audit and session timestamps that still
      render without a zone go through `lib/scheduling/tz.ts`. Same defect as
      C61, on staff screens
- [x] **12.4** `patients.phone` becomes **NOT NULL** for new records (§3b), and
      every form that creates a patient asks for it with a country
- [x] **12.5** Sweep §2 and close every row whose only reason to stay open was
      a production row
- [x] **12.6** `scripts/reset.ts` — purge every table, re-seed admin, re-seed
      settings, re-publish CMS defaults, in one command with a confirmation
      prompt. This is what sprint 21 runs
- [x] **12.7** `scripts/_fk.ts` deleted. It is a debug script somebody committed
- **Accept:** no code path anywhere reads a value whose default was chosen to
      avoid disturbing a live row.

### Sprint 13 — Claim by phone · ~1.5 weeks · 🔴 FOUNDATION

The claim flow built in sprints 6–7 matched on email and treated the phone as
optional. §3b replaces that. This sprint is the whole identity story and
sprint 15's patient app depends on it.

**The invariant, first, because everything else follows from it:**

> **One phone number, one patient account.** A second account can never claim
> the same number. But **two therapists may hold the same number**, because
> two clinicians really do see the same person — and when that person signs up
> they see *both* claim requests and must answer for each separately.

- [x] **13.1** `patient_accounts.phone` unique and NOT NULL. E.164, using
      11R's `toE164` — a number with no country is refused, never guessed
- [x] **13.2** `patients.phone` mandatory when a therapist creates a record,
      with the reason stated on the form: *"so you can invite them to join by
      WhatsApp."* No silent requirement
- [x] **13.3** **The therapist invites their own patient.** One button on the
      patient record. Sends a WhatsApp invite carrying a link
- [x] **13.4** The link opens signup with the number pre-filled and locked.
      The verification code goes to that number by WhatsApp
- [x] **13.5** Confirming the code proves the number. It does **not** prove
      which record is theirs — a household shares a phone, a number is
      recycled, a therapist mistypes a digit
- [x] **13.6** 🔴 **So the challenge, per record, in this order:**
      1. *"Have you seen this therapist before?"* — yes or no, plainly
      2. Only on yes: *"What name did you give them?"* — matched against the
         record, never shown first
      A no ends it for that record and is remembered, so nobody is asked twice
- [x] **13.7** Two therapists holding the same number produce **two** claim
      requests on the patient's screen, answered one at a time. Claiming one
      never claims the other
- [x] **13.8** 🔴 **A mis-claim must be impossible, not unlikely.** The
      verifier proves it: a second account cannot take a claimed number; a
      patient who answers "no" cannot later be shown that record; a wrong name
      does not partially reveal the right one; and no screen displays a
      record's contents before the challenge is passed
- [x] **13.9** **Email is a complete fallback, same flow, same challenge** —
      invite, code, yes/no, name. For a patient with no WhatsApp
- [x] **13.10** Sprint 7's consent step still runs after a successful claim.
      Claiming is not consenting
- [x] **13.11** 🔴 **Capture the patient's time zone at signup** (C85) —
      detected in the browser, shown to them, editable, stored on
      `patient_accounts` beside the phone. Then every patient screen takes the
      zone as a **prop from the server**, exactly like the clinician screens,
      and `useReaderZone()` is left only for genuinely anonymous pages. Until
      this exists, a patient's consent dates render in UTC and correct
      themselves a frame later — and the date on a consent record is the part
      that matters
- [x] **13.12** **Shown, not assumed.** The column is nullable and the signup
      form arrives **pre-filled with the detected zone and editable**. §3b's
      whole shape is telling somebody what we are about to do with their
      number; where we think they are gets the same courtesy. Nullable is the
      column, not the experience — it is empty only for accounts made before
      this ships, or for somebody who clears it deliberately
- [x] **13.13** **Precedence, written down once:** the account's zone beats
      `patients.timezone`, which `bookSlot` writes from the browser at
      anonymous booking time (11R.2), which beats the therapist's, which beats
      UTC. A person who *chose* outranks a browser read taken once. 🔴 **And
      claiming never overwrites `patients.timezone`** — that row is the record
      of what the browser said the day the booking was made, and one account
      may hold records from two therapists
- ⚠️ **Incomplete until you finish the Meta setup.** Everything works by email
      the moment this ships; the WhatsApp half is proven only when
      `npm run whatsapp:check` prints a message id.
- 🔴 **Superseded in part by 13R.** This sprint built the claim flow on an
      account that still required an email and a password. The claim flow
      stands; the account shape does not. §3b's founder ruling of 2026-09-06
      makes the email optional and lets sign-in accept either handle — see
      13R.0 and 13R.6–13R.13.
- **Accept:** two therapists, one phone, one person — the person ends up with
      one account and two decisions, and no wrong record was ever visible.

### Sprint 13R — Two handles, one lock, and the way out of it · ~1 week · 🔴 BEFORE 14

*(Sprint 13 is otherwise finished and verified: production ledger 45, all 45
hashes reconciled against disk, 18 checks, `challengePassed` correctly gated on
both questions. Three things land here — the identity shape the founder ruled
on (C86), the lock that resets (C87), and the release without which fixing the
lock is worse than leaving it (C88). They share one table and one migration,
which is why they share a sprint rather than being spread across 13R and 15.)*

**Two handles — C86, §3b rewritten**

- [x] **13R.0** 🔴 **Read §3b again before writing anything.** It changed. The
      phone is required on every account; the **email is optional on every
      account**; a password is set either way; sign-in accepts **either**
      handle plus that password. Signing up *by* email still requires a number.
      Identity is not locked to the phone — the phone is only the part that is
      never missing
- [x] **13R.6** `patient_accounts.email` becomes **nullable**. Its unique index
      stays unique **only over rows that have an address** — Postgres's default
      `NULLS DISTINCT` is exactly right here, so 🔴 **do not reach for
      `NULLS NOT DISTINCT`**, which 0043 used correctly for a different problem
      and would here collapse every address-less account into one
- [x] **13R.7** `patient_accounts.phone` becomes genuinely required: 0043's
      `NOT VALID` check is the deploy-gap version, and sprint 22.9 validates it
- [x] **13R.8** **Signup, one form, two routes.** Email entered → the number
      field is required, and the form says why. Number entered → the address is
      optional and labelled as what it buys: *a complete profile and email
      notification as well as WhatsApp*. Never a bare asterisk
- [x] **13R.9** **Sign-in by phone or by email**, same password. One failure
      message for both, matching the existing wording — an error that says
      which handle was wrong tells somebody with a list which of them is in
      therapy
- [ ] **13R.10** 🔴 **Password reset must work for an account with no
      address**, so the reset code goes over WhatsApp. ⚠️ **Incomplete until
      the Meta templates are approved** — until then an address-less account
      can be created but cannot recover a password, and the signup form must
      say so rather than discovering it later
- [x] **13R.11** **Changing either handle notifies both.** Two ways in is two
      ways to lose it. An email change is *not* under the phone's 90-day lock
      (§3d 20.14) — the phone is the identity that cannot be missing, the email
      is a contact detail — but it is refused if the address is on another live
      account, and the old address is told
- [x] **13R.12** Every notification path sends WhatsApp **and** email when an
      address exists. Email is sent *as well*, never *instead*
- [x] **13R.13** The verifier proves the shape by attempting the write: an
      account with a number and no address is **accepted**; a second account on
      the same number is **refused**; two address-less accounts **coexist**; a
      second account on the same address is **refused**; sign-in succeeds by
      each handle and fails identically for both

**The lock, and the way out of it**

- [x] **13R.1** 🔴 **Count name attempts on the (account, patient record) pair,
      across every claim** — not on the claim row (C87). Today the third wrong
      name sets `status = 'expired'`, which drops the row out of the partial
      `WHERE status = 'pending'` index, so the next code request inserts a
      fresh row at `name_attempts` `DEFAULT 0` and the budget resets
- [x] **13R.2** Give the lock **its own status**, `locked`, rather than reusing
      `expired`. A lockout and a code that timed out are different events and
      support cannot tell them apart today — and sprint 20's release path needs
      something to target
- [x] **13R.3** 🔴 **The release ships in the same sprint as the tightening**
      (C88). Until now the escape hatch worked only because the budget reset;
      closing that without a release locks a real patient out of their own
      record until sprint 20
- [x] **13R.4** The release is **one audited action on the therapist's own
      patient record** — they created it, they know the person, they are
      reachable today. Named actor, reason, timestamp. Sprint 20 adds the admin
      tool; it must not be the only one
- [x] **13R.5** The verifier proves the budget does **not** reset: three wrong
      names, then a fresh code request, then a fourth attempt — refused. And
      that the release restores exactly one budget, to one record, for one
      account
- **Accept:** somebody with only a phone number can hold a complete account and
      somebody with both can sign in either way; an attacker holding a recycled
      number cannot grind a first name three guesses at a time; and a patient
      who mistyped their own name can be let back in the same day by the person
      who wrote the record.

### Sprint 14 — No-show recovery · ~1 week

*(was sprint 12)*

- [x] **14.1** 0–5 min: *"joining shortly"*. No blame
- [x] **14.2** At 5 min: report, **and** the live radar inside the room
- [x] **14.3** Only therapists at **equal or lower** price are offered
- [x] **14.4** **Nobody suitable online → full refund and an apology.** Never
      leave them in an empty room
- [x] **14.5** Reassign the session. Nothing transfers a session today
- [x] **14.6** Paid more than the replacement charges → difference becomes
      patient credit, **expires 12 months**, applied after VAT
- [x] **14.7** Reliability score from no-shows, on the public profile
- [x] **14.8** Keep the existing warn → suspend ladder in `lib/data/feedback.ts`

### Sprint 15 — Patient app · ~1.5 weeks

*(was sprint 13. Depends on sprint 13's claim flow.)*

- [ ] **15.1** Bottom nav, globe centre and highlighted
- [ ] **15.2** Home: *"Welcome, name"* + globe, expanding to the full map
- [ ] **15.3** Sessions labelled by type: **upcoming today · scheduled future ·
      past scheduled · past instant from radar**
- [ ] **15.4** Their own patient-version notes
- [ ] **15.5** Homework, grouped by session, with reminders
- [ ] **15.6** Billing — every session as a bill, VAT and platform cut shown,
      plus credits, **in the currency they paid in** (sprint 16)
- [ ] **15.7** Consent screen: who has access, which shape, revoke
- [ ] **15.8** 🔴 **Server-side block: a patient never sees a transcript or a
      clinical note**

### Sprint 16 — Money: two rails, two currencies · ~3 weeks · 💰 THE BIG ONE

*(was sprint 14, and it is roughly twice the sprint it was.)*

🔴 **Read §3c before writing a line of this.** It carries a legal exposure the
rest of the plan does not, and 1.8's rule against holding money is
deliberately being changed by the founder, not accidentally broken.

**Two settings groups in admin, and only two:**

| | International | Egypt |
|---|---|---|
| Patients pay | **USD, Stripe.** Includes the UAE and the rest of MENA | **EGP**, a local collection provider |
| Therapists are paid | **Stripe Connect**, destination charges | **Manual.** They request a payout |
| Payout methods | Whatever Connect supports | **InstaPay bank transfer** or **EGP mobile wallet**, plus their full name *exactly as it appears on that account* |
| Who fulfils it | Stripe | The 24/7 team, from the Egyptian entity |

- [ ] **16.1** The two provider groups, admin-managed. Adding an Egyptian
      collection provider is configuration, not code
- [ ] **16.2** Payout request: method, account identifier, full name as
      registered, and a status the therapist can watch — requested · approved ·
      sent · confirmed. Every transition audited and attributable to a person
- [ ] **16.3** 🔴 **A payout request is a promise. Nothing may quietly fail.**
      A stuck request is visible to admin, to the therapist, and on a queue
      screen the 24/7 team works from
- [ ] **16.3a** **Two queue views, because they are not the same job.**
      *Automated* lists Stripe Connect payouts as completed — a record, not a
      task. *Manual* is the EGP work somebody has to do
- [ ] **16.3b** Every manual request carries an **age, an alert when it ages,
      and a named owner**. 🔴 **The alert reaches a phone AND an email**, through
      `notify()` and the E.164 numbers 11R already built — never only a
      dashboard. A dashboard nobody has open at 3am is not an alert. Same for
      the overdue alarms in 20.12 and 20.20: one alerting path, three callers
- [ ] **16.3c** Staff **upload a screenshot of the transfer** on completion,
      and the therapist sees it on their earnings screen
- [ ] **16.3d** 🔴 **Two-person approval above a threshold, and never the
      person who edited the payout details** (C74)

**Currency is a display choice, everywhere:**

- [ ] **16.4** Every screen showing a price or a balance — session prices, the
      radar, billing, earnings, invoices — shows **USD by default with a small
      EGP toggle beside it**. Live or near-live rate. Kills C37's hardcoded ~48
- [ ] **16.5** A therapist prices a session link in **either** currency. A
      patient pays in **either** currency. The radar price the same. What they
      chose is stored — a receipt must reproduce it exactly
- [ ] **16.6** The rate used for a transaction is **frozen on that
      transaction**, with its timestamp. Never re-converted later, or last
      month's invoice changes value while somebody is reading it
- [ ] **16.6a** 🔴 **Therapists pay us in either currency, and every therapist
      chooses** — not only Egyptian ones. Bundles, single sessions and an
      outstanding pay-as-you-go bill can all be settled by an Egyptian method
      in EGP or by card in USD, picked at checkout
- [ ] **16.6b** **The therapist absorbs the exchange difference when they
      choose EGP**, and the EGP screen says so *before* the button: the rate
      used, and the USD amount it settles. Never discovered afterwards (C76)

**The four crossings, each of which must work:**

| Patient pays | Therapist holds | What happens |
|---|---|---|
| USD, Stripe | Stripe Connect | Destination charge. Untouched, as today |
| EGP, local | No Stripe | Collected in Egypt, paid out manually in EGP |
| **USD, Stripe** | **No Stripe (Egyptian)** | **We hold it** and pay EGP manually on request |
| **EGP, local** | **Stripe Connect (international)** | **We hold it**, it appears on their balance immediately, and they draw it in USD through Connect |

- [ ] **16.7** The two crossings in bold are the new work and the legal
      exposure. Build them explicitly, name them in the code, and make the
      held balance a **first-class, reconcilable ledger** — not a number
      derived at read time
- [ ] **16.8** 🔴 **Money held is money owed.** Every held cent traces to one
      payment in and at most one payout out. A reconciliation report the
      finance team can run daily, and it must balance to zero
- [ ] **16.9** Two entities, two bank accounts, Egypt and the USA. Every
      transaction records **which entity holds it**. A cross-entity movement is
      an explicit, audited event and never an accounting side effect
- [ ] **16.10** Therapist earnings show held, requested, sent and available
      separately. "Available" must never include money we cannot actually move
- **Accept:** a therapist in Cairo with no Stripe account gets paid for a
      patient in London who paid in dollars, the whole path is auditable, and
      the ledger balances.

### Sprint 17 — The pricing story · ~1 week · 💰 REVENUE

*(was sprint 16. After 16 so prices can be shown in either currency.)*

> **Joining is free.** No subscription, no seat fee, no setup fee.
> **You pay per session, only when you run one** — $4, or less in a bundle —
> and that includes ten copilot questions about that patient.
> **Your first completed session is free.**
> **Get booked on the Crisis Radar.** Patients find you and book you, and the
> few dollars a session costs comes out of what that session paid you.

- [ ] **17.1** 🔴 **Resolve C69.** Sprint 16 makes netting possible for the
      first time, so decide it there and state it here. Do not ship a sentence
      describing a mechanic that does not exist
- [ ] **17.2** Pricing page reordered: **tier cards first, no hero section**
- [ ] **17.3** Under the cards, the free-to-use statement and the radar line
- [ ] **17.4** **A slider on Growth.** Minimum 30, drag upward, live total
- [ ] **17.5** The billing FAQ moves **below** all of that
- [ ] **17.6** Call to action everywhere: **"Sign up free"** primary, *"or buy
      a bundle"* secondary. Never "choose a plan" — there are no plans
- [ ] **17.7** **The same three cards as a section on the homepage.** One
      component, two pages — not a copy, or C60 happens again
- [ ] **17.8** Every price on both pages carries the EGP/USD toggle from 16.4
- [ ] **17.9** Rewrite `lib/content/defaults.ts` for `pricing` and `home`,
      publish to `content_pages` in both locales, **bump `CACHE_VERSION`**
- [ ] **17.10** Every figure read from `platform_settings` at render time
- **Accept:** no page states a price, rate, cut or minimum that disagrees with
      `platform_settings`, in either currency.

### Sprint 18 — Public site revamp, and a side for patients · ~1.5 weeks

*(was sprint 17)*

- [ ] **18.1** Full pass over every public page — structure, hierarchy, what
      each page is *for*. Not a reskin
- [ ] **18.2** A **patients** section in the navigation: how to find a
      therapist · what the Crisis Radar is and when to use it · what happens in
      a session · what your therapist can and cannot see · your record and how
      to claim it · what it costs you · getting help now
- [ ] **18.3** 🔴 The crisis page is one tap from every patient page, and never
      behind a signup
- [ ] **18.4** Patient and clinician calls to action separated. A person in
      distress and a clinician evaluating software need different first buttons
- [ ] **18.5** Every new page is a `content_pages` row with a shipped default,
      never a hardcoded route — so 19 and 20 can reach it
- [ ] **18.6** New block types documented where the editor can see them
- [ ] **18.7** Re-check the site against §6: nothing public names a patient,
      quotes a session, or implies we can read a record

**Show the product, not a description of it.**

The homepage already renders live components rather than pictures, and that is
the right instinct — a live radar is more convincing than a screenshot of one
and cannot go stale. There is far more product now than when those were built.

- [ ] **18.8** 🔴 **Live components first, screenshots only where a live one
      is impossible.** A screenshot is a promise that expires silently: the
      product changes, the picture does not, and nobody notices until a visitor
      does. Audit what the homepage renders live today and extend the same
      pattern to what sprints 5–16 added
- [ ] **18.9** Show the **radar**, the **patient app**, the room, the note, the
      copilot, homework, the profile — the things that make this product
      different, as the thing itself
- [ ] **18.10** `scripts/screens.ts` — a sweep that logs in as a demo
      therapist, patient and admin and captures **every page**, committed to
      the repo under `docs/screens/`. Regenerated by command, never by hand, so
      a stale picture is one run away from correct
- [ ] **18.11** 🔴 **Synthetic demo data only, never a real record.** A
      screenshot in a repository is permanent in a way a database row is not,
      and the purge in sprint 22 will not reach it. One seeded demo
      organisation, invented people, and the sweep refuses to run against a
      database holding anything else
- [ ] **18.12** ⚠️ **Admin screens are swept but not committed** with the rest.
      An admin console shows many patients at once and is a map of the system;
      treat the repository as if it will be public one day. `docs/screens/admin`
      is gitignored and produced on demand
- [ ] **18.13** Every live component's copy — labels, the demo transcript, the
      demo note, the names on the demo cards — is **CMS content**, editable and
      translatable like any other string. Sprint 21 must be able to translate
      the *mockups*, not only the paragraphs around them

### Sprint 18R — Contact, and two companies · ~4 days · 🔴 BEFORE 19

*(Founder requirement, 2026-09-08, C91. It lands here rather than in 20 because
every string it creates has to exist before sprint 19 translates the site and
before sprint 21 makes strings editable — adding a page after those two sprints
means doing both again.)*

- [ ] **18R.1** 🔴 **Finish the revamp on the pages the sprint did not reach.**
      18.1–18.5 built the patients section and the showcases; the rest of the
      public site is still the old one. Every remaining public page gets the
      same treatment — the same components, the same CTA pair, the same crisis
      block where it belongs, and no page left in the pre-revamp style
- [ ] **18R.2** **A real contact form**, on a real page, in both locales. Name,
      one handle (email *or* phone, per §3b), a subject from a **list**, and a
      message. Not a `mailto:` link
- [ ] **18R.3** ⚠️ **It is a support ticket, not an email.** It lands in the
      same queue §3d builds in sprint 20, with a topic, an age and a named
      owner — 20.18–20.22's rules apply to it unchanged. An inbox nobody owns
      is how a person in distress gets ignored for a week
- [ ] **18R.4** 🔴 **The submitter is not signed in and may be a patient.**
      Whatever they type is treated as clinical material the moment it lands:
      stored and audited like sprint 8's documents, never in a prompt (C82),
      and the page says plainly *"do not send anything urgent here"* with the
      crisis line beside it
- [ ] **18R.5** Rate-limited and spam-resistant without a third-party widget
      that watches the reader. The measure is that a bot cannot fill the
      support queue, not that a human is inconvenienced
- [ ] **18R.6** 🔴 **Contact details for BOTH companies** — the US entity and
      the Egyptian one (§3c). Company name, address, phone, email, hours, and
      which one to write to about what. **Every field admin-editable** and
      **every field translatable**, so 19 and 21 reach them like any other
      content. Never hardcoded, never a single "our office"
- [ ] **18R.7** Which entity a reader is shown first follows the same rule as
      the currency (§3c): the international one by default, the Egyptian one
      when it is the relevant one — and **both are always visible**, because
      the point of naming two companies is that a person can choose who they
      are dealing with
- [ ] **18R.8** The confirmation says what happens next and when, in the
      reader's language. A form that says only *"thanks"* is a form nobody
      trusts they have used
- **Accept:** somebody can reach a named human at either company, in either
      language, from any public page — and what they send is treated with the
      same care as anything else a patient tells us.

### Sprint 19 — Arabic and English · ~1.5 weeks

*(was sprint 18)*

- [ ] **19.1** Every public page has an `ar` row **and** an `en` row. `pricing`
      has no `ar` row today, which is why `/ar/pricing` serves English
- [ ] **19.2** Every interface string in both languages. An English fallback
      for a UI string stays banned and type-enforced
- [ ] **19.3** Arabic is **right-to-left as a layout**, not translated English
      in a left-to-right frame
- [ ] **19.0** 🔴 **Fix the two red verifiers first (C90).** A check that
      depends on content sprint 22 publishes is **SKIPPED with its reason
      printed**, never FAILED: `-- 17.9 deferred to 22.8b: pricing content not
      yet published`. Sprint 22 flips them back on. Right now
      `verify:sprint17` is 5/14 red and `verify:sprint18` is 5/15 red against
      production, and "all verifiers pass" has to keep meaning something
- [ ] **19.0a** 🔴 **Prove the sprint 17 and 18 render somewhere (C89).**
      Publish the new pages into a draft row or a staging locale and check the
      real output, so what sprint 22 seeds is a script that has been *run*
      rather than one that has been *written*. Two sprints' visible work is
      currently unproven against a real page
- [ ] **19.4** Numerals, currency and dates in the reader's convention — 🔴 **as
      a locale passed from the server, never read off the runtime.** C84 bans
      the runtime read, and `formatMoney` is pinned to `en-US` precisely so it
      is deterministic; without this ticket that pin is permanent and every
      Arabic price renders in English formatting forever. The locale becomes a
      parameter fed from the page's chosen language, exactly as the zone did
- [ ] **19.5** Mixed Arabic and English inside one sentence must survive
- [ ] **19.6** A verifier that fails the build on any string present in one
      language and missing in the other
- [ ] **19.7** 🔴 **Nothing here may hardcode "two languages."** Sprint 20 adds
      more. Every table, key and component is `(key, locale)` from the start

### Sprint 20 — Admin: the back office · ~3 weeks

*(was sprint 15. The numbers, the money operations, and the people who run
them. §3d is the spec.)*

**Every number**

- [ ] **20.1** Edit every pricing figure — rates, tiers, minimums, copilot caps
- [ ] **20.2** VAT and currency per country
- [ ] **20.3** Both payment groups from sprint 16: providers, methods,
      integration status, and which countries have neither
- [ ] **20.4** **Verification requirements per country** — authority, licence
      name, ID format, sample photo. Hardcoded today
- [ ] **20.5** Therapist credentials by country
- [ ] **20.6** Margin per session from real usage
- [ ] **20.7** Total View extended to everything above

**Who can see what** — §3d

- [ ] **20.8** 🔴 **Two roles on top of admin: staff and manager.** Staff see
      only the work — payout queue, therapist ID verification, phone-change
      requests, patient support. Managers see that plus the performance
      overview: ticket ages, overdue counts, throughput, who owns what
- [ ] **20.9** 🔴 **No admin impersonation. The rule does not bend for a
      support ticket.** A staff member helping a patient sees the ticket, not
      the patient's account
- [ ] **20.10** Every staff action attributable to a named person, always

**The payout queue** — the manual half of sprint 16

- [ ] **20.11** The two views built in 16.3a, worked from here: automated
      Connect payouts as a record, manual EGP payouts as the task
- [ ] **20.12** Age, alert, owner, screenshot-on-completion, two-person
      approval above a threshold (16.3b–d)

**Phone-number changes** — §3d

- [ ] **20.13** The request: new number, **the patient's written reason**, and
      their tick-box authorising us to call or message that number
- [ ] **20.14** 90-day lock from the day a number is confirmed, and 90 days
      between changes. 🔴 **A correction inside the first 24 hours after signup
      is not a change** — the lock starts then, or a mistyped digit traps
      somebody for three months
- [ ] **20.15** A number already on another account is **refused outright**,
      and the patient is told that is the reason. Never whose
- [ ] **20.16** Staff verify by calling or messaging the new number, then
      approve. A verification link goes to the **new** number; a code from it,
      entered in the app, completes the change. **24 hours** to use it
- [ ] **20.17** Recorded whole: old number, new number, reason, approver, time,
      and the verification itself

**Patient support** — §3d

- [ ] **20.18** Tickets with **topics chosen from a list**, so the queue sorts
- [ ] **20.19** Attachments: images and PDFs. 🔴 **Stored, audited and access-
      controlled exactly like sprint 8's documents, and they never enter any
      prompt.** A support ticket is not a copilot input
- [ ] **20.20** 24-hour clock, one 24-hour extension with a reason, then
      **overdue** and visible as overdue. 🔴 **The clock pauses while waiting
      on the patient** — staff are measured on their own delay
- [ ] **20.21** A ticket may move to WhatsApp. It is **recorded as having
      moved**, with a written summary brought back into the ticket. A
      conversation we cannot see is not a record
- [ ] **20.22** 🔴 **On close the patient is sent a LINK to a page that
      authenticates — never the correspondence as plaintext in an email.** The
      two halves of this rule are written together on purpose, because they are
      the same rule: an email carrying the conversation is patient data leaving
      the building (§6), and an email that cannot carry the attachments (20.19,
      C82) but does carry the conversation is a half-measure that will drift
      back to "just include the summary" the first time somebody finds the link
      inconvenient. The link is audited; the page shows the whole ticket,
      attachments included, to the authenticated patient only
**Therapist support** — the other half of the queue

- [ ] **20.23** **Therapists raise tickets too**, from a dedicated support page
      in their own shell. Same shape as the patient's: a topic chosen from a
      list (billing · payouts · a session that went wrong · verification ·
      the app itself · something else), free text, attachments
- [ ] **20.24** They land in a **separate admin queue** — therapist support,
      beside patient support, not mixed into it. A therapist chasing a payout
      and a patient in distress are different jobs with different clocks, and
      one list sorted by age puts them in the wrong order
- [ ] **20.25** Same clock, same pause rule, same named owner (20.20, C83). A
      therapist ticket may reference a session or a payout request, and the
      queue shows it, so staff are not asked to work from a ticket that says
      "the payment did not arrive" with nothing attached
- [ ] **20.26** Closing a therapist ticket follows 20.22's rule as well: a link
      to a page that authenticates. A therapist's ticket carries their own
      earnings and their patients' names — it is not plaintext-email material
      either
- **Accept:** a staff member can do every manual job in this product without
      ever seeing a patient's account, and a manager can tell who is behind.

### Sprint 21 — Admin: content, strings and languages · ~3 weeks · LAST

*(was sprint 19, folded into admin at the founder's instruction and then split
back out because it is a sprint's worth on its own.)*

**Every string**

- [ ] **21.1** `ui_strings (key, locale, value, updated_by, updated_at)`. The
      typed dictionary stays as the default; a published row overrides it
- [ ] **21.2** 🔴 **Every button label included.** "Sign up free", "Book",
      "Join", "Publish", "Revoke". Buttons are the copy that changes most
- [ ] **21.3** Editor: search by key, filter by page, locales side by side,
      one save, every write audited
- [ ] **21.4** Cached like the CMS — one tag, no timer. Any write from
      anything but the editor bumps `CACHE_VERSION` (C60)
- [ ] **21.5** Clearing an override **restores the shipped default**. It does
      not blank a button
- [ ] **21.6** A missing key renders the default and reports itself. Never a
      raw key on screen, never blank
- [ ] **21.7** Safety strings marked and undeleteable: crisis copy, the
      recording notice, consent wording. Rewordable, never removable
- [ ] **21.8** **The live components and their mockups are content too** —
      demo transcript lines, the demo note, labels on the demo cards, icons and
      captions (18.13). A translator must be able to translate the *product
      being shown*, not only the prose around it

**Every language**

- [ ] **21.9** 🔴 **Admin can add a language.** Not a code change — a row.
      Every page, section, block, label, button and mockup becomes translatable
- [ ] **21.10** A translation workspace: pick a language, see what is missing,
      fill it in, save. Saving is not publishing
- [ ] **21.11** 🔴 **A completeness checklist per language, and nothing goes
      live until it is 100%.** Every string, every label, every button, every
      mockup — counted, with what is missing listed by page
- [ ] **21.12** 🔴 **Ruling — completeness gates the *launch*, not the *life*,
      of a language.** Once a language is live, one new string added anywhere
      must not take it offline: that string falls back to the default, the
      language stays up, and it is raised loudly as an untranslated-string
      alarm with a deadline. Otherwise adding a button to the homepage silently
      pulls Spanish down, and nobody will ever find out why
- [ ] **21.13** 🔴 **A separate, bigger toggle decides which languages the
      public site offers.** Adding Spanish and translating it does **not** show
      it to anybody. Two switches, deliberately: one to *author*, one to
      *publish*
- [ ] **21.14** So the content team can translate Spanish and Chinese for weeks
      while the site offers only Arabic and English, and the day it flips, the
      whole site is already there
- [ ] **21.15** Turning a live language **off** must not 404 anybody mid-visit.
      Decide and state the behaviour: redirect to the default, or serve and
      stop advertising

**AI translation**

- [ ] **21.16** **Admin can machine-translate a language in one action** —
      whole site, one page, or the untranslated remainder
- [ ] **21.17** 🔴 **Ruling — AI drafts, a human publishes.** A machine
      translation lands as a **draft** and counts as *missing* on 21.11's
      checklist until a person approves it. The alternative is a language going
      live on nobody's judgement, in a product where a mistranslated sentence
      can be a clinical instruction
- [ ] **21.18** 🔴 **Crisis copy, consent wording and the recording notice can
      never be published from a machine draft without a named human approval,
      whatever the bulk action says.** Those three are the strings where being
      wrong is not a typo
- [ ] **21.19** Every AI draft is marked as one, with the model and the date,
      so a reviewer knows what they are reading and a bad batch can be found
- **Accept:** a non-engineer adds a language, machine-translates it, reviews
      it, keeps it hidden, publishes it when it is complete — with no deploy —
      and cannot delete a crisis instruction, blank a button, or put an
      unreviewed machine sentence in front of a patient.

### Sprint 21R — The loose ends a person found · ~1 week · 🔴 AFTER 21, BEFORE 22

*(Everything in this sprint was found by the founder opening the live site,
not by a verifier. That is the point of it, and the argument for 22R.)*

**Three doors, not one — C94**

- [x] **21R.1** 🔴 **A separate admin sign-in.** An admin console, a
      clinician's caseload and a patient's own record are three different
      risks; they do not share a form. Admin sign-in is not linked from the
      public site
- [x] **21R.2** **Therapist sign-in and sign-up**, cross-linked to each other,
      and to the patient pages — *"Looking for your own sessions?"*
- [x] **21R.3** **Patient sign-in and sign-up**, cross-linked the same way
      back. Both already exist; they need the links and the third page below
- [x] **21R.4** 🔴 **Password reset for every one of them, and none exists for
      patients today.** The patient's reset must work for an account with **no
      email address** (§3b, 13R.10) — the code goes over WhatsApp. ⚠️
      Incomplete until the Meta templates are approved, and the page says so
- [x] **21R.5** Every one of these pages carries the reset link. A reset that
      exists and is not linked is a reset nobody has

**The pricing page is wrong, not just plain — C92**

- [x] **21R.6** 🔴 **The live pricing page contradicts §3c.** It still says
      *"we never hold it — the money is a direct charge into your own Stripe
      account"*, which the founder reversed on 2026-09-06. A public page is
      making a claim about where money sits that the product no longer
      honours. This is a correctness bug, not a copy refresh
- [x] **21R.7** Publish the sprint 17 pricing block and the sprint 18 pages
      into **staging**, render them, read them, and fix what reads badly —
      then the same content is what 22 seeds. Cards first, slider, FAQ below,
      currency toggle, no prices written into prose
- [~] **21R.8** **A full written content pass, English and Arabic**, over
      every public page — not translation, *writing*. The Arabic is written as
      Arabic, not rendered from the English. Both read by somebody after 21's
      editor exists, so what is fixed is fixed as content

**The rest — C93, C95**

- [x] **21R.9** Every check that reads published content is **deferrable from
      the start** (C93). The skip-with-reason mechanism exists; apply it as a
      rule, not as a patch to two files. `verify:sprint18r` is 4/20 red and
      `verify:sprint19` is 1/17 red today for exactly C89's reason
- [x] **21R.10** The hero icon sits **inline with the hero text**, not on its
      own line (C95). Check every hero, both languages, both directions — RTL
      is where this kind of thing hides
- **Accept:** three kinds of person can each get in, get back in, and read a
      pricing page that is true.

### Sprint 22R — The walkthrough · ~1.5 weeks · 🔴 AFTER THE PURGE, BEFORE BETA

*(C96. Every verifier so far asserts against the database or the import graph.
Nobody has ever used this product as a person. The founder found three real
defects in minutes by looking at it, which is the whole argument.)*

- [x] **22R.1** 🔴 **On a freshly purged database with seeded admin only.**
      Nothing carried over. Every account created through the real forms
- [x] **22R.2** **The whole clinical arc, as a human, in order:** therapist
      signs up → admin approves them → therapist adds a patient record →
      invites them → **patient signs up and claims it** → session invite →
      patient joins → session runs → transcript → note → patient report →
      invoice raised and paid
- [ ] **22R.3** **Then the hard part, which nothing has ever exercised:** a
      **second** therapist adds the *same* patient → the claim request reaches
      that patient → they claim it → the second therapist sees the documents
      the first uploaded → a session with the second therapist → **it appears
      in the first therapist's history, because access has not been revoked**
      → the patient **revokes the first therapist** → confirm it is gone from
      that side and intact on the other
- [ ] **22R.4** **Documents and copilot:** upload real history files, ask the
      copilot about them, confirm the citations resolve and that a revoked
      clinician gets nothing
- [~] **22R.5** **The patient's own side:** progress, homework, session notes,
      billing, account, both handles, reset
- [ ] **22R.6** **Everything else a therapist can do:** copilot message limit
      reached and refused · going on the radar · on-call · requesting a payout
      · EGP and USD · buying a bundle · **upgrading, then downgrading while
      holding 30 unused sessions — prove exactly how the balance rolls over,
      because that is the case somebody will complain about**
- [~] **22R.7** **Everything an admin, a manager and a staff member can do**,
      each signed in as themselves, each seeing only what their role allows
- [x] **22R.8** 🔴 **Screenshot every page for every user type** and save the
      sweep. Now legitimate: the database is synthetic (C80)
- [x] **22R.9** 🔴 **Write down what was hard, not only what was broken.**
      Buttons that were difficult to find, controls hidden behind a modal or a
      popup, a step where it was unclear what happens next, anything that
      needed the plan to understand. **A verifier cannot report this and no
      sprint so far has looked for it**
- [ ] **22R.10** Fill the gaps that sweep finds, then **a second purge**, then
      beta with the legal disclaimers in place
- **Accept:** every route, for every kind of person, has been walked by
      somebody reasoning as a user — and what was awkward is written down
      beside what was broken.

**Notifications, while the walkthrough is running — C97**

- [ ] **22R.11** **A personalised check-in to every patient.** Their name,
      very short, differently worded each time — never a template everybody
      recognises. Sent on a schedule the founder set at six-hourly; ⚠️ **that
      cadence is the thing to prove rather than assume** — four unprompted
      messages a day is a lot for somebody in distress, and a person who mutes
      it is worse off than one who was messaged less. Ship it with a **rate
      the admin controls**, an opt-out, and a **quiet window overnight**
- [ ] **22R.12** Every notification the product sends carries the person's
      name and is rewritten so no two read the same. Very short. 🔴 **A
      check-in is not a clinical assessment** — it asks how somebody is, it
      never interprets the answer, and a reply that suggests risk goes to the
      crisis path, not to a copilot

### Sprint 22 — Purge, rotate, launch · ~3 days · 🔴 THE GATE

Nothing here is code. It is the checklist that turns a test system into a live
one, and no real patient is invited before all of it is done.

- [x] **22.1** `scripts/reset.ts` (12.6) run against production. Every table
      empty, admin re-seeded, settings re-seeded, CMS republished from defaults
- [ ] **22.2** **Every key rotated** — OpenAI, Deepgram, Daily, Resend, Stripe,
      the database, `CRON_SECRET`. The old ones were pasted into chats.
      🔴 **Two more since**, both from the sprint 24 to 27 handover: the
      `admin@24therapy.ai` password seeded by the purge of 2026-09-07, and the
      Neon `DATABASE_URL` password reissued when the planning session lost its
      `.env.local`. Both have now passed through a transcript, which is the
      same standard that put the rest of this list here
- [ ] **22.3** The Resend domain verified, and a real email proven to arrive
- [ ] **22.4** Meta WhatsApp live: five templates approved,
      `npm run whatsapp:check` printing a message id
- [ ] **22.5** Decide **one** deploy: keep this Vercel project with the domain
      verified and every key rotated, **or** a clean project. Either is fine;
      running both is not
- [ ] **22.6** Stripe out of test mode, both entities' bank accounts connected
- [ ] **22.7** A full pass as a patient and as a therapist, on the real system,
      with nothing seeded
- [ ] **22.8** Legal review of the consent copy, and of §3c
- [~] **22.8b** 🔴 **Republish the public content AFTER the deploy, never before.**
      `npx tsx scripts/republish.ts --all` and again with `--ar`. Sprint 17
      made the prices a `pricing` block; a database carrying that block while
      the old code is still serving renders a pricing page with no prices on
      it. Deploy, then republish, then check `/pricing` and `/` in both
      locales with your own eyes
- [ ] **22.8c** Run `npm run screens` once the purge has emptied the tables and
      the demo tenant is seeded. It refuses to run while a real record exists
      (18.11), which is why `docs/screens/` is empty until this point — and
      commit the public, therapist and patient folders only. `--admin` is
      swept on demand and never committed (18.12)
- [x] **22.9** 🔴 **After the purge, `VALIDATE` all five of 0042's constraints
      and convert the two presence checks to real `NOT NULL`.** `NOT VALID` was
      right for the deploy gap — it binds every new write without scanning rows
      that were about to be deleted — and leaving it that way forever is not: a
      `NOT VALID` check is not enforced against rows a later `UPDATE` moves into
      violation via a path Postgres cannot re-check, and more importantly it
      records a rule the schema does not actually assert. Run it **after** 22.1
      empties the tables, when both scans are free:
      `ALTER TABLE sessions VALIDATE CONSTRAINT sessions_feedback_token_present`
      and the four others, then `ALTER TABLE ... ALTER COLUMN ... SET NOT NULL`
      for `sessions.feedback_token` and — scoped as its own check, since it is
      conditional on `source` — leave `patients_phone_present` as a validated
      CHECK. Assert all five as `convalidated` in `verify-migrations.ts`

### Sprint 23 — The copilot in the room · ~1 week · AFTER LAUNCH

*Added 2026-09-06 by the C25 ruling in sprint 17. It is here rather than
nowhere because a deferred ticket with no home is a ticket that quietly stops
existing.*

- [ ] **23.1** An ask-anything surface **inside** the session room, not a
      second screen. The question a therapist wants to ask happens in the room
- [ ] **23.2** The four access states from §3, unchanged — this is a new
      surface on the existing machinery, never a second set of rules
- [x] ~~**23.3** The per-session, per-patient allowance from C14, spent by the
      same counter as `/copilot`. One allowance, two doors~~ 🔴 **STRUCK by
      C210, 2026-09-12.** The founder has ruled the in-room allowance **free
      and uncounted**, carried by the platform fee. A shared counter would lock
      a therapist out of the copilot on exactly the session where the patient
      refused recording. **Sprint 48 absorbs and replaces this whole sprint.**
- [ ] **23.4** Citations resolve exactly as they do elsewhere, or the answer is
      dropped (sprint 8's rule)
- **Accept:** a therapist runs a whole session, asks two questions from inside
      the room, and the allowance, the citations and the audit trail are
      indistinguishable from having asked them at `/copilot`.

### Sprint 24 — Content law, and every page that never got the revamp · ~1 week

*Everything after this writes copy, so the rules come first.*

- [x] **24.1** 🔴 **Ban U+2014 and U+2013** in every CMS default, every
      `ui_strings` row, every rendered public page, every email body and every
      WhatsApp template (C117). A verifier that scans all of them and is
      **proved against a planted offender**
- [x] **24.2** 🔴 **Import-graph guard: nothing under `app/(patient)` may
      import `lib/ai/*`** (C113). True today. Make it impossible to stop being
      true, proved against a planted offender file
- [x] **24.3** Rename `lib/ai/patient-copilot.ts` to `case-copilot.ts`. It is
      the clinician's copilot scoped to one patient, and the name has already
      misled one careful reader into thinking patients chat with a model
- [x] **24.4** **The therapist settings page, rebuilt.** It is the oldest
      screen in the product and it looks it
- [x] **24.5** Every remaining pre-revamp page brought to the sprint 18
      components: no page left in the old style, both languages
- [x] **24.6** **New content defaults throughout**, written not translated,
      English and Arabic, under the copy rules above
- **Accept:** no page written before sprint 18 survives, and not one dash of
      either banned kind exists anywhere a person can read.

### Sprint 25 — The patient app, as an app · ~2 weeks · 🔴 THE ONE PEOPLE SEE

*The patient app works and looks like scaffolding. It is the surface the whole
patient story is sold on, so it gets a design sprint, not a tidy-up.*

**How it looks**

- [x] **25.1** 🔴 **A real mobile home**: cards, banners, sections,
      categories, search, recent sessions, top-rated therapists. Not a list of
      links
- [x] **25.2** 🔴 **Every patient screen lives inside the app chrome**,
      including the radar and including a **live session** (C129, ruling 15).
      A patient never falls out into the public site's top nav
- [x] **25.3** The radar renders **inside** the app with real controls and
      filters, and the bottom nav is a client component so the public radar
      stays cacheable and carries no user data in its HTML
- [x] **25.4** During a live session the nav is present, the session tab is
      **locked active**, and leaving asks first (C129)
- [x] **25.5** 🔴 **The SOS orb** (C125, C126): a draggable red dot on every
      patient screen. Tapping opens big click-to-call buttons side by side,
      one per country, with the word for help written in that country's
      language above each number, and a flag beside each. **Only verified
      numbers.** Where we have none: "call your local emergency number", plus
      the practice number if the clinician set one. Plain `tel:` links, never
      behind a modal, and it works when our API does not
- [x] **25.6** 🔴 **PWA "add to home screen", or the words "coming soon".
      Never an App Store badge** for software nobody can install (C116)

**Profile and tabs**

- [x] **25.7** Profile with **name and picture** (C115): images only, size
      capped, private storage, authenticated route, admin can remove
- [x] **25.8** **Sessions** tab with sub-tabs **All · Upcoming · Past**
- [x] **25.9** **Billing and credit** tab
- [x] **25.10** **Clinical summary** tab, built in sprint 26 — shipped with 26.1 rather than stubbed: a tab saying "coming soon" about somebody's own clinical record is a placeholder this product does not get to ship

**Getting in**

- [x] **25.11** 🔴 **The password becomes optional** (C119). A code to the
      phone or the email is always a valid sign-in. This edits 13R
- [x] **25.12** 🔴 **A guest needs one handle and nothing else.** A phone, or
      an email, and they are a full patient user missing only the other one
- [x] **25.13** At the end of a session a guest is asked to sign in. 🔴 **The
      copy is honest** (C130): the clinician holds this record either way;
      signing in lets *you* see it
- [x] **25.14** 🔴 **Lookup by proven phone or proven email, never by name**
      (C122). A name is only ever a challenge answer
- [x] **25.15** 🔴 **The claim order, corrected** (C121): handle, then code,
      then the therapist's name and photo, then "have you seen them", then the
      name with a first-letter hint that **spends one of three attempts**.
      Nothing about any record appears before the handle is proven
- [x] **25.16** 🔴 **The name is compared against the therapist's record,
      never the patient's editable profile** (C114). One rule, one test
- [x] **25.17** 🔴 **A therapist QR code** (C120), for the clinic wall or the
      end of an in-person session. It carries **the therapist's identity
      only**. Scanning opens signup saying which practice, matching runs on
      phone or email plus the full challenge, and the code is short and
      **revocable** so a stale poster can be killed
- [x] **25.18** **New session, new patient, one step**: name and **mobile
      number**, and the WhatsApp invite goes immediately. Both halves already
      exist and are two screens apart
- **Accept:** somebody's mother could use this, in Arabic, on a four-year-old
      Android, and reach an emergency number in two taps from any screen.

### Sprint 26 — The record the patient owns · ~2 weeks

- [x] **26.1** 🔴 **The clinical summary belongs to the patient** (C111):
      versioned, append-only, each version stamped with the clinician who
      approved it and the date. Therapist B never overwrites therapist A, and
      the patient sees both with authors
- [x] **26.2** Revoking a clinician **does not retract a version the patient
      has already read**. What the patient holds is theirs
- [x] **26.3** 🔴 **One approval screen, one action, three items** (C112):
      clinical note, patient note, summary. **Silence publishes nothing**
- [x] **26.4** Summary copy obeys the `patientBrief` constraints: no
      diagnosis, no impressions, no risk language, no other clinician's words
- [x] **26.5** 🔴 **Journals replace patient uploads.** Patients stop adding
      files and dictating clinical history; they write or dictate journals
- [~] **26.6** Journals are visible to clinicians holding a grant, feed the
      intelligence layer, and are **cited like a document** in the copilot — the
      first two shipped; ⚠️ **the clickable citation is incomplete until sprint
      33**, because `[D7:3]` resolves through `person_documents` and
      generalising it is the evidence layer's job (C142)
- [x] **26.7** 🔴 **Journals are scanned for risk** (C123) and a high-risk
      journal alerts the clinician who holds a grant. **The page never says or
      implies anyone is watching**, and the crisis line is always on screen
- [x] **26.8** Dictated journals: same auth, audit and private storage as
      documents (C124)
- [x] **26.9** 🔴 **The export, rebuilt as the most complete record of
      themselves a person can hold** (C127) — every session, every approved
      note, every summary version, diagnoses, journals, homework, dates and
      the clinician behind each. **A record extract, never a certificate.** A
      cover page saying exactly what it is and is not; each note stamped with
      the approving clinician's name, licence body and number; a verification
      code a third party can check on a public page. The words "certified" and
      "proof of diagnosis" never appear
- [x] **26.10** 🔴 **Export by secure email link only, never WhatsApp**
      (C128). No email on file means adding one, said on the button. Every
      export raises an **admin alert** and is audited as patient data leaving
- **Accept:** a patient can hold, read and hand to a lawyer the complete
      record of their own therapy, and nothing in it claims more than we know.

### Sprint 27 — Portability, which is the whole pitch · ~1.5 weeks

- [x] **27.1** 🔴 **A grant can only be held by a clinician whose verification
      is `approved`** (C106). In the database, asserted by attempting the write
- [x] **27.2** 🔴 **The patient invite** (C102b): the patient generates a code,
      a clinician redeems it, which **creates a request** the patient then
      approves in one tap. The patient gets the initiative; nobody gets a back
      door. Copy says "invite your therapist", never "send your record"
- [x] **27.3** An invite to a clinician with no account still works: they sign
      up, and 🔴 **the grant cannot activate until they are verified** (C131).
      The patient sees exactly why it is waiting. Thirty-day expiry
- [x] **27.4** 🔴 **A grant needs the patient's own authenticated action** and
      can never come from a clinician flow that ends in access (C107)
- [x] **27.5** **"Who can read my record"**, permanently in the app: every
      grant, when it was given, one-tap revoke, **no reason ever asked**
- [x] **27.6** A notification to the patient on **every** new grant
- [x] **27.7** 🔴 **"Ask my previous therapist to add my history"** (C108): the
      patient asks, the clinician sees it in their queue, and either uploads or
      **declines with a reason the patient reads**. Copy says "ask", never
      "get"
- [x] **27.8** Unchanged and confirmed: two requests per day, the 24-hour
      grant window, the open grant a holding clinician gets on claim, and a new
      request permitted after a revocation
- **Accept:** a patient can move between clinicians without telling the story
      twice, and cannot be walked into sharing by anybody but themselves.

### Sprint 28 — The site talks to patients, honestly · ~1 week

- [x] **28.1** Repositioned around **patient intelligence and portability**,
      speaking to patients directly, in both languages
- [x] **28.2** 🔴 **"Paid sessions cover our fee" never appears** (C109). What
      appears is netting: what you owe comes out of what you earn, before it
      reaches your account. And on a free session the therapist pays the fee
- [x] **28.3** 🔴 **No earnings promises** (C110), checked
- [x] **28.4** The patient page says plainly: **you never talk to the AI.** It
      learns from your sessions and your journals, it shows you your progress,
      and only a clinician you have granted access can ask it anything
- [x] **28.5** New public pages: `/integrations`, `/integrations/[slug]`,
      `/for-clinics`, `/developers` and its docs, `/verify/[code]` for an
      export's verification code
- [~] **28.6** 🔴 **Live components, invented people, never a screenshot** —
      the New session screen with the Where picker switching between Zoom and
      Meet; the consent screen a patient sees before a Zoom session; the widget
      inside a mock chart, recording and filing; a real request beside a real
      webhook payload; the note landing in a mock partner UI. 🔴 **Every one of
      those five demonstrates a feature that does not exist** (sprints 36, 41,
      42, 43), and a live component of an unbuilt feature is the exact thing
      this item exists to prevent (C149). What shipped instead are the two
      screens sprint 26 *did* build, as live components: the versioned clinical
      summary with two clinicians on it, and the journal. ⚠️ **The five named
      demos are incomplete until the sprints that build what they show**
- **Accept:** every claim on the public site is a screen somebody can open.

### Sprint 29 — Identity documents, private · ~1 day

- [x] **29.1** An `/api/uploads/[id]` route mirroring `/api/documents/[id]`:
      who is asking, may they now, audited before the bytes. Licences and
      passports stop depending on an unguessable URL

### Sprint 30 — Egypt sits in Egypt · ~1.5 weeks · 🔴 BEFORE ANY PARTNER

- [x] **30.1** 🔴 **The region seam**: every data call routes on the entity
      (C118), with Egypt pointed at the US instance until Cairo is live, so
      going live is `DATABASE_URL_EG` and not a migration
- [ ] **30.2** ⚠️ **Not mine to make.** Provider decision. **Huawei Cloud Egypt** is the only public
      cloud region in the country, second Cairo AZ due 2026; the alternatives
      are Cairo colocation (Link Data Center, Tier IV, runs Postgres) or the
      telco clouds. Neon has no Egyptian region
- [x] **30.3** Cross-border consent wording, a record of processing, and the
      dated decision. Enforcement lands October 2026
- [ ] **30.4** ⚠️ **Incomplete until the founder signs a provider.** The seam
      ships regardless

### Sprint 31 — Arabic URLs · ~2 days

- [x] **31.1** `/ar/*` real paths with `hreflang`, cookie kept as preference
      (C103). Today `/ar/pricing` is a 404 and no Arabic page can be shared or
      indexed, in the market this product is for

### Sprint 32 — AI evaluation · ~1.5 weeks · 🔴 BEFORE 33

- [x] **32.1** `evals/` on synthetic cases: transcription WER, attribution
      DER, unsupported-claim rate, required-section coverage, risk sensitivity
      and false positives, Arabic semantic preservation
- [x] **32.2** Every AI change after this reports its numbers. There are 21
      tests and 25 verifiers today and **zero AI quality measurement**

### Sprint 33 — The clinical evidence layer · ~3 weeks · 🔴 THE MOAT

*Not a key-value table. A fact with a history.*

- [x] **33.1** `patient_clinical_facts`: `person_id, domain, field, value`,
      `source_type + source_id`, `evidence_ref`, `confidence`,
      `source_priority` (clinician · document · AI · patient),
      `status` (active · resolved · historical · disputed),
      `first_observed_at`, `last_observed_at`, `effective_at`,
      `supersedes_id`, `verified_by`, `verified_at`, `sensitivity`
- [x] **33.2** 🔴 **AI inference is never a confirmed fact.** Confidence is not
      truth, and a clinician-entered diagnosis outranks a model
- [x] **33.3** **Temporal reasoning**: ideation eight months ago is not
      ideation now. Every fact carries when it was true, not only when it was
      written
- [x] **33.4** **Conflict**: session 17 may contradict session 4. Both are
      kept, one supersedes, and the clinician can see why
- [x] **33.5** **Deletion**: removing a source must not leave a fact standing
      with nothing behind it
- [x] **33.6** An **evidence screen**: why the system believes something, back
      to the transcript line or document passage
- **Accept:** every clinical fact the system holds can be traced to the exact
      sentence that produced it, and a clinician can disagree with it in place.

### Sprint 34 — Note generation reads the evidence layer · ~3 days

- [x] **34.1** `notes.ts` builds context from two lines today: diagnoses and
      goals. Point it at sprint 33. This one edit turns an isolated SOAP
      generator into longitudinal documentation

### Sprint 35 — Risk intelligence · ~2 weeks

- [x] **35.1** `raiseCrisisAlert` **already takes `source: "model"` and has
      never received it.** Fill the seam: a classifier producing structured
      indicators — ideation, intent, plan, means, timeframe, protective
      factors, previous attempt, self-harm, homicidal ideation, psychosis,
      abuse — with evidence and confidence
- [x] **35.2** The keyword pass stays as an always-on floor
- [x] **35.3** 🔴 **The AI flags and structures. It never adjudicates risk.**
      Persistence, dedup, notification and cron retry all survive untouched

### Sprint 35R — The eval case set · ~1 week · 🔴 BEFORE ANY MORE MODEL WORK

*Named rather than absorbed. The founder's ruling after 34: the next widening
is its own sprint, and no band grows to make a run pass.*

- [x] **35R.1** Fifteen synthetic sessions, not five. `grounding.contradiction`
      reports a spread of **0.400** against a tolerance of 0.19, so it can fall
      from 0.80 to 0.61 without failing — which is the regression that matters
      most, invisible
- [x] **35R.2** The risk set too: 30 utterances is one case per 3.3 points, and
      both risk numbers now sit at or near 100%, which is where a small set
      stops being able to show an improvement
- [x] **35R.3** 🔴 **No tolerance may widen in this sprint.** The runner keeps
      printing which metrics are noisier than their own band until the cases
      close the gap
- [ ] **35R.4** ⚠️ **Blocked on credit, not on code.** The OpenAI account ran
      out mid-sprint, so the five model suites could not be re-recorded on the
      widened set. `evals/baseline.json` still holds five-session figures and
      now says so; the runner REFUSES to compare a fifteen-session run against
      it. One `npm run evals -- --record` closes this

### Sprint 36 — Session sources, design only · ~1 week

- [x] **36.1** `session_sources`: 24Therapy room · Google Meet · Zoom · Teams
      · in person · uploaded recording
- [x] **36.2** 🔴 **A third auth door on ingestion**: a session-scoped
      ingestion token. `POST /api/sessions/[id]/transcribe` is already source
      agnostic; what blocks a bot is `requireUserApi()` and
      `assertSameOrigin()`, which exist for good reasons
- [x] **36.3** **No bots ship in this sprint.** The shape only

### Sprint 37 — Acoustic diarisation · ~2 weeks · 🔴 BLOCKS 41

Built in two halves, because the model credits ran out and building the
measurable half unmeasured is how sprint 34's five-out-of-five would have
shipped. The offline half is done; **41 stays blocked on 37.4**, which is a
measurement and not a build.

- [x] **37.1** VAD, diarisation, speaker embeddings, alignment. The existing
      LLM attribution becomes the semantic correction layer — *the turn
      arithmetic, the alignment and the evidence rules ship; the provider call
      is 37.4*
- [x] **37.2** 🔴 **An unrecognised voice is "Speaker 3", never a guess** —
      *enforced by migration 0065: a line on an unbound voice cannot hold a
      person, and `bound_by` has no value meaning "a model decided"*
- [x] **37.3** Group and couples: N speakers, no invented identities
- [ ] **37.4** ⚠️ **THE NAMED GAP: the provider call and the acoustic DER.**
      No diarisation provider is called anywhere in the codebase, and the
      number that says how well one separates two voices sharing a microphone
      in a real room is **not measured**. A DER against synthetic turns would
      measure `align.ts` agreeing with its own fixtures, so it is not
      reported. Needs real audio of two people with a gold transcript, a
      provider, and credits. Named the way **35R.4** is named. 🔴 **41 is
      blocked on this being MEASURED, not merely built.**
- [ ] **37.5** ⚠️ **The voice screen, and it ships with 37.4 rather than before
      it** (C179, 37R.22). `bound_by = 'operator'` means a named human binds a
      voice, and today no human can: `session_voices` is referenced by zero
      components. The reason it is a ticket rather than a screen is that the
      rows do not exist yet — they are created by the diarisation provider,
      which is 37.4 — so a binding screen built now would be the first screen
      in this product nobody could walk. It lives on the session page beside
      the transcript: each voice with its speaking time, its number, and a
      control that binds it to the therapist or a named patient, audited,
      with unbind clearing every line it had named.

### Sprint 37R — The second walkthrough · ~1.5 weeks · 🔴 BEFORE 40

*Sprint 22R was the last time a person used this product. It predates sprints
24 to 37 entirely. Since then: fourteen sprints, 57 route files changed or
added, a rebuilt patient app, a new claim order, portability, journals,
summaries, exports, Arabic URLs, a region seam and a risk classifier. All of it
verified by machines. **None of it walked by anybody.***

*22R found seven defects in one pass, and every one of them was a screen that
was wrong while every row underneath it was right. A patient claimed their
record and their app told them it was empty. That class of defect is invisible
to every verifier in this repository, and there are now fourteen sprints of it
unexamined.*

**Before anything**

- [x] **37R.1** 🔴 **A fresh purge, seeded admin only.** Every account created
      through the real forms. `scripts/reset.ts`, then `ship:content` so the
      rows match the code
- [x] **37R.2** Both languages, both directions, on every screen walked. RTL is
      where layout defects hide and nobody has looked since 31 shipped

**Re-walk everything 22R walked, because all of it changed**

- [~] **37R.3** *(walked to the invoice, which needs Stripe: E2)* Therapist signs up → admin approves → adds a patient with a
      **phone number** → invites by WhatsApp → patient signs up and claims →
      session invite → patient joins → session runs → transcript → note →
      patient report → invoice raised and paid
- [ ] **37R.4** The second therapist: same patient, claim request, documents
      the first uploaded, a session, it appearing in the first therapist's
      history, then the patient **revoking** the first therapist
- [ ] **37R.5** Documents and the case copilot: upload history, ask about it,
      citations resolve, a revoked clinician gets nothing
- [ ] **37R.6** Everything else a therapist can do: copilot limit refused ·
      radar · on-call · payout requested · EGP and USD · bundle bought ·
      **upgrade then downgrade holding 30 unused sessions**
- [ ] **37R.7** Admin, manager and staff, each signed in as themselves

**Then everything built since 22R, which nobody has ever used**

- [x] **37R.8** 🔴 **The patient app as an app** (25): the home, the profile
      with **name and picture**, Sessions with **All · Upcoming · Past**,
      Billing and credit, and the radar **inside the app chrome**. Does it look
      like the best mental-health app anybody has built, or does it look like
      scaffolding? Say which
- [x] **37R.9** 🔴 **The SOS orb**, from every patient screen including a live
      session. Draggable, reachable in two taps, the numbers we have verified
      and nothing invented. **This is the most safety-critical control in the
      product and no person has ever pressed it**
- [x] **37R.10** 🔴 **The claim order as corrected** (C121): handle, then code,
      **then** the therapist's name and photo. Confirm nothing about any record
      appears before the handle is proven. Try a stranger's number and see what
      you learn
- [x] **37R.11** **Three ways in** (C119): phone only, email only, both. A
      password is optional; a code always works. A guest with one handle
- [x] **37R.12** **The therapist QR** (C120): print it, scan it, claim from it
- [x] **37R.13** **Journals** (26): written and **dictated**, seen by a
      clinician with a grant, cited in the copilot, and a high-risk journal
      raising an alert
- [x] **37R.14** **The clinical summary** (26): versioned, two clinicians'
      versions side by side, **one approval screen with three items**, and
      silence publishing nothing
- [ ] **37R.15** **The export** (26): the whole record, the secure email link,
      the cover page, the **verification code checked at `/verify/[code]`**
- [x] **37R.16** **Portability** (27): the patient invite, a grant refused to
      an unverified clinician, ask-my-old-therapist including a **decline with
      a reason**, and who-can-read-me with one-tap revoke
- [x] **37R.17** **The public site** (28, 31): `/for-patients`, `/developers`,
      `/for-clinics`, `/integrations`, and every one of them at `/ar/...`
- [x] **37R.18** **Cross-border consent** (30) at `/patient/residency`
- [x] **37R.19** **The evidence screen** (33) at `/patients/[id]/evidence`:
      does a clinician understand why the system believes something?
- [x] **37R.20** **The risk assessment** (35) on a session: indicators,
      quotes, and the prior-risk panel that the classifier does not read

**The two things that have no screen, confirmed rather than assumed**

- [x] **37R.21** `session_sources` (36) has no interface anywhere, **by
      design**. 41.2 builds it. Confirm and record
- [x] **37R.22** 🔴 `session_voices` (37) has no interface anywhere, **and no
      ticket builds one** (C179). `bound_by = 'operator'` means a named human
      binds a voice, and there is no way for any human to do it. Either build
      the screen in this sprint or write the ticket that owns it

**Every page judged as a design, not only as a feature**

- [x] **37R.23a** 🔴 **Give every single page a design verdict, separately from
      whether it works.** A page that works and looks unfinished is a defect and
      goes on the list. The question is not "did the button do the thing", it is
      "would somebody paying for this believe it was finished"
- [x] **37R.23b** 🔴 **Flag every page that is plain text and bare buttons** —
      no sections, no cards, no icons, no chart where a number is trying to tell
      a story, no visual hierarchy, nothing to rest the eye on. Name them all.
      Do not stop at the two or three worst
- [x] **37R.23c** **Empty states are pages too.** A screen with no data yet is
      the FIRST thing a new therapist and a new patient see, and a blank list
      under a heading is how a product looks abandoned. Every empty state gets
      the same verdict
- [x] **37R.23d** **Arabic is judged as Arabic.** A page that looks fine in
      English can look broken in Arabic: line length, numerals, icon direction,
      a heading that wraps at a different point, a button whose label no longer
      fits. Judge the Arabic screen on its own, never as "the English one but
      mirrored"
- [x] **37R.23e** **Narrow and wide.** The patient app is a phone product and
      the therapist app is used on a laptop in a clinic. Both, for every page
- [x] **37R.23f** 🔴 **The internal apps have never had a design pass.** Sprint
      25 rebuilt the patient app and 24.4 rebuilt one settings page; the rest of
      the therapist portal and the whole admin console have been built for
      function since sprint 1. Expect the worst pages to be there, and say so
- [x] **37R.23g** Produce **one table**: every page, a verdict of *finished ·
      thin · unstyled*, and one line on what is missing. That table is the
      brief for the design sprint that follows, so it has to be complete rather
      than a highlight reel

**The record**

- [x] **37R.23** 🔴 **Screenshot every page for every user type**, both
      languages, into `docs/walkthrough-2/`. Synthetic people only; admin
      screens swept and gitignored (C80)
- [x] **37R.24** 🔴 **Write down what was HARD, not only what was broken.**
      Buttons you could not find, controls hidden behind a modal, a step where
      it was unclear what happens next, anything you needed the plan to
      understand. **No verifier in this repository can report this**, and it is
      the reason 22R existed
- [x] **37R.25** Fix what the sweep finds, then say plainly whether this
      product is ready for a beta user who has never seen it
- **Accept:** every route, for every kind of person, in both languages, has
      been walked by somebody reasoning as a user who has a patient waiting —
      and every page has a design verdict beside its functional one, with the
      unstyled ones named rather than the worst two mentioned.

### Sprint 37L — The product speaks Arabic · ~2.5 weeks · 🔴 BEFORE ANY BETA IN EGYPT

*C182. Sprint 19 translated the interface strings that existed. Sprint 31 gave
Arabic an address. Sprint 21 made every string editable. All three shipped and
all three work, and the **application** was never translated: measured on `main`
today, **0 of 21 admin pages, 0 of 19 patient pages and 2 of 20 therapist pages**
call the dictionary at all. The website is Arabic. The product a patient actually
uses is English.*

- [x] **37L.1** 🔴 **Every patient screen in Arabic.** This is the one that
      matters: a patient in Cairo who found us on an Arabic homepage, signed up
      on an Arabic form, and then lands in an English app has been handed to a
      competitor
- [~] **37L.2** *(not done: 105 English literals left, counted and ratcheted)* Every therapist screen. Clinical Arabic for a clinician, which
      is a different register from the patient's
- [~] **37L.3** *(not done: 312 English literals left, counted and ratcheted)* Every admin screen. The back office is staffed in Cairo
- [~] **37L.4** *(the patient's three auth screens are done; the clinician's four,
      the emails and the WhatsApp templates are not)* Every auth screen, every
      email, every WhatsApp template
- [x] **37L.5** 🔴 **Written as Arabic, never rendered from the English**
      (21.x). The AI may draft; a person publishes; and crisis, consent and
      recording copy can never publish from a draft at all
- [x] **37L.6** 🔴 **The guard has to be structural or this recurs.** Sprint 19
      shipped a rule and fourteen sprints wrote English past it. A check that
      counts pages calling the dictionary, ratcheted like the region pins, so
      the number can only go up
- [x] **37L.7** RTL judged per page, not assumed from `dir=rtl`. 37R proved
      direction is right on all 71 renders and that says nothing about whether
      a heading wraps or a button's label still fits
- [x] **37L.8** The completeness checklist from 21.11 finally has something to
      count. Nothing goes live in a language until it is 100%, and that gates
      the **launch** of a language, never its **life** (C78) — *535 keys, both
      languages, enforced by the type system and by `verify:sprint37l`*
- [ ] **37L.9** ⚠️ **NAMED GAP: dates and times are English in both languages.**
      `formatWhen` renders `Friday 11 September, 16:09 (Cairo)` to an Arabic
      reader, because `lib/scheduling/tz.ts` formats with a fixed locale. It is
      a shared layer with its own tests and its own rule (§ `lib/i18n/config.ts`:
      **Western digits, always** — a patient in crisis reading `٩٨٨` is a worse
      outcome than a small loss of authenticity), so it is its own careful pass
      rather than the last edit of a long sprint.
- **Accept:** a patient who speaks only Arabic can find a therapist, claim their
      record, read their summary, write a journal and press SOS without meeting
      one English word.

### Sprint 38 — Note templates · ~3 weeks

- [ ] **38.1** `note_templates(key, name, schema, prompt, sections)`, a
      validator per schema, a renderer. `session_notes` gains `template_key`
- [ ] **38.2** Additive migration: existing notes become `template_key='soap'`
- [ ] **38.3** SOAP · DAP · BIRP · GIRP · PIRP · SIRP · PIE · intake ·
      treatment plan · discharge · MSE · couples · family · group · child ·
      EMDR · CBT · DBT · ACT · trauma-focused. Templates are content

### Sprint 39 — Before and after the session · ~2 weeks

- [ ] **39.1** **Session prep**: what happened, what is unresolved, which
      goals have not been touched, homework completion, risk changes
- [ ] **39.2** **The golden thread**: diagnosis to problem to goal to
      objective to intervention to response to progress, on one screen
- [ ] **39.3** **Compliance checker** before signing
- [ ] **39.4** Therapist voice profile: tone, length, terminology, adaptive

### Sprint 40 — Verification adapters · ~1 week

- [ ] **40.1** `verification_sources` as a **registry, not an enum**. Vezeeta
      is adapter one, the Syndicate is adapter two, manual is always there
- [ ] **40.2** `roster_snapshots`, `roster_entries`, `verification_matches`
      with a named matcher and a date
- [ ] **40.3** 🔴 **A partner never flips the approval bit.** `isCleared()`
      does not change. A bad match is a named person's mistake, never an
      unexplained approval
- [ ] **40.5** 🔴 **Vezeeta lists 1,158 PSYCHIATRISTS, not therapists.**
      Psychiatrists are physicians carrying a Medical Syndicate licence;
      psychologists and counsellors are not syndicate members at all. Adapter
      one therefore covers roughly half the supply this marketplace needs, and
      the other half still has no credential path. Build the registry so that
      second path is an adapter rather than a rewrite, and say on the admin
      screen which source a match came from, because "verified" will otherwise
      mean two different things
- [ ] **40.4** `roster_entries` is PII about people who never signed up:
      retention rule, lawful basis, and **no therapist can ever search it**

### Sprint 41 — Meeting bots · ~3 weeks · AFTER 37

- [ ] **41.1** 🔴 **The bot joins meetings 24Therapy created for a session.
      Nothing else. Ever.** No calendar is read (C132)
- [ ] **41.2** One new field on New session: **Where** — 24Therapy room ·
      Zoom · Meet · Teams · in person — and a **Record** tick. We create the
      meeting inside their connected account
- [ ] **41.3** Connect by OAuth on `/settings/integrations`. 🔴 **A therapist
      never sees an API key**
- [ ] **41.4** 🔴 **The patient always receives our link** (C133), which takes
      consent then forwards. The raw meeting link is never handed out.
      Declining consent still admits them; the bot simply does not transcribe
- [ ] **41.5** 🔴 **Identity comes from the session we created, never from a
      meeting display name** (C134). Hard invariant, and a test
- [ ] **41.6** Recall.ai for v1. Our differentiation is not that we worked out
      how to join Zoom
- [ ] **41.7** Edge cases, each with a stated behaviour: consent refused ·
      patient joins first · therapist joins late · consent revoked mid-session
      · AI paused with the timestamp kept · bot disconnects · bot reconnects
      without duplicating · multiple patients · couples · group · unknown
      speaker · device change · link change · **bot in the wrong meeting is a
      hard stop** · two simultaneous sessions never cross · recording without
      consent is refused processing · out-of-order transcript reconciled

- [ ] **41.8** 🔴 **There is no bot button, and that is the design** (C216). A
      button a therapist can forget is a session that silently went
      untranscribed; a button they can press is a bot that can be sent
      somewhere it should not go. The bot is dispatched by the patient's
      consent and by nothing else
- [ ] **41.9** Every new string via 45.8, both languages, admin editable

**🔴 The sequence, decided 2026-09-12. Nothing here is left to a build choice.**

*Whoever creates the meeting holds the link, and a therapist holding it will
eventually send it straight to the patient, not maliciously but because it is
one fewer step on a busy afternoon. The consent screen then never happens.
This is why sprint 36 built `session_sources` with no column that can hold a
pasted link and why an external source requires `provisioned_at` and
`provisioned_by_user_id` (C175, C215): a therapist pasting their own Zoom link
is structurally excluded, and that was a decision rather than an omission.*

**Once, ever:** `Settings → Integrations → Connect Zoom → approve → back`. A
therapist who cannot connect uses the 24Therapy room, which already works, and
the Integrations page says so **before** they try, because many clinics block
third-party Zoom apps.

**Every session:** `New session → patient → Where: Zoom → [x] Transcribe →
Create`. We create the meeting **inside their account**. The therapist sees
their own join link for their calendar and a line saying the patient gets a
different one.

**At the time:**

| Who | Does |
|---|---|
| Therapist | Clicks **Join**. Straight into Zoom |
| Patient | Opens **our** link. Sees who they are meeting, pays if the session is paid, answers the AI question, is forwarded to Zoom |
| Bot | Joins **at the moment consent is given**, before the patient arrives |

🔴 **The bot joins on consent, not on invite.** It lands in the right order
anyway, since the patient consents on our page before reaching the meeting, so
the bot is already in the room when they arrive and nobody watches it appear
mid-conversation. It also settles the cost question the "knock like Google
Meet" design loses on: Recall.ai bills per bot-hour, so joining at meeting
creation means paying for bots on sessions that were then declined. **A
decline dispatches no bot at all**, not a bot that joins and stays quiet.

🔴 **The order for a paid session is: pay, then the AI question, then in, and
declining still admits them.** Consent first would let them consent and then
not pay. A consent wall after payment would be pressure applied to somebody who
has already spent money. Payment buys the session; consent turns on the AI; the
split fee in §3c is what makes those two separate things rather than a slogan.

**The therapist's screen says "the patient chose not to turn the AI on."** In
those words. Not "consent declined", which reads like a failure.

**Couples, one consents and one does not: any decline means no AI.** Cheaper to
state than to litigate.

### Sprint 42 — The partner plane · ~3 weeks

- [ ] **42.1** `partners`, `partner_api_keys` (hashed, scoped, rotatable),
      `partner_webhooks`, `partner_webhook_deliveries`
- [ ] **42.2** 🔴 `partner_subjects` unique on `(partner_id, external_ref)`.
      Two partners will both send `"P123"`
- [ ] **42.3** 🔴 **A launch mints a short-lived `auth_sessions` row** with
      `partner_id` and `created_via`, so every existing screen works unchanged
      and the audit names the partner. There stays exactly one way to be
      signed in
- [ ] **42.4** 🔴 **A webhook carries an event and an id, never content.** A
      leaked webhook URL then leaks nothing
- [ ] **42.5** The embedded widget: **no video by default**, our room optional
- [ ] **42.6** `organizations.partner_id`, `billing_mode = 'partner_billed'`,
      monthly aggregate invoice to the partner
- [ ] **42.7** `audit_log` gains `partner_id` and `via`, so "who read this"
      answers "their server, on behalf of Dr X"
- [ ] **42.8** **A patient CSV importer.** A clinician leaving another
      platform is the sales motion; make the migration a button

### Sprint 43 — SMART on FHIR · ~10 weeks

- [ ] **43.1** `ehr_connections`, `ehr_launches`, `ehr_writebacks`
- [ ] **43.1b** 🔴 **A connection is owned by the organization, and a solo
      therapist is an organization of one** (C266). A hospital connects once
      for every clinician under it; a solo clinician connects their own. A
      therapist leaving a clinic loses that connection immediately, without a
      question, because the credential was the hospital's
- [ ] **43.1c** The Connect button appears in the **clinic portal** for a
      practice and in **settings** for a solo therapist. Same flow, two homes
- [ ] **43.2** We are the OAuth **client**. FHIR R4 / US Core 6.1.0, pinned
- [ ] **43.3** The note files back as a `DocumentReference`
- [ ] **43.4** 🔴 **In an EHR the chart is their system of record, not ours.**
      Decide and write down what a shadow copy holds and for how long

### Sprint 44 — Check-ins · ~1 week

- [ ] **44.1** C97, still unbuilt: personalised, very short, differently
      worded, their name, admin-controlled rate, opt-out, overnight quiet
      window
- [ ] **44.2** 🔴 **A check-in asks. It never interprets.** A worrying reply
      goes to the crisis path, never to a copilot

### Sprint 45 — Every string, both languages, admin editable · ~2 weeks · 🔴 BLOCKS 46 TO 52

*C217. Everything after this sprint adds copy, and until this is built there is
no honest way to say a new string is admin editable, because today none of them
are. Measured before this was written: the strings editor writes `ui_strings`,
read by four public marketing files; every other screen reads `messages.ts`,
read by 142 components. An admin changing a button's words sees nothing change
anywhere a patient or a therapist will ever look.*

- [ ] **45.0** 🔴 **FIRST, BEFORE ANYTHING ELSE GREPS THIS REPOSITORY.**
      Remove the two NUL bytes from `lib/data/facts.ts`, and add a verifier
      that fails on any NUL in any `.ts` or `.tsx` file (C245). Until this
      lands, every audit silently skips the clinical evidence layer
- [x] ~~**45.1** `messages.ts` stays the shipped default and gains an Arabic
      entry for every key it does not have~~ **ALREADY TRUE.** 1,536 of 1,536
      keys present in `ar`, and `ar: Record<MessageKey, string>` already makes
      a gap a compile error (C217)
- [x] ~~**45.2** `ui_strings` becomes an override layer keyed by the same
      `MessageKey`~~ **ALREADY BUILT.** `lib/i18n/strings.ts:139` resolves
      `overrides[key] ?? dictionary[key] ?? en[key]`
- [ ] **45.3** 🔴 **The only real defect: the client provider is
      override-blind.** `lib/i18n/client.tsx:37` reads `DICTIONARIES[locale]`
      directly, so roughly 72 client components ignore every admin edit while
      the 53 server ones honour it. **Serialise only the keys that were
      actually overridden** into the provider, with the static dictionary
      underneath as the floor. That keeps the tree-shaking trade
      `client.tsx:9-17` made on purpose and makes the payload proportional to
      what an admin changed rather than to the size of the product
- [x] ~~**45.4** The admin editor lists every key in the product~~ **ALREADY
      BUILT.** `lib/i18n/authoring.ts:326` maps over every shipped key
- [ ] **45.5** Draft and published states, as `ui_strings` already has. A
      broken override can now break a screen that used to be a constant, so
      publishing is a deliberate act and reverting to default is one click
- [ ] **45.6** 🔴 **Absorb the three bodies of copy named in C207**: the
      verification document slots from `lib/regulators.ts`, the copilot's six
      prompt templates in `lib/ai/case-copilot.ts` (label and prompt split into
      two constants), and the country names in `lib/geo.ts`
- [ ] **45.7** The ratchet in `scripts/_i18n-coverage.json` counts **overridable
      keys reaching a screen**, not imports. C157's defect was counting the
      wrong thing and it is the defect family in §6
- [ ] **45.8** 🔴 **Every ticket in sprints 46 to 52 that adds a word to any
      screen adds it as a `MessageKey` with an English and an Arabic default.**
      A verifier fails the sprint on a literal string in a rendered component
- **Accept:** an admin changes the words on the patient app's session button,
      publishes, and a patient sees the new words in both languages without a
      deploy.

### Sprint 46 — The split fee, plans and credits · ~2 weeks

*C209, C223. Today `chargeForSession` bills identically whether or not any AI
ran, which is a coercion channel and a free video giveaway at the same time.*

- [ ] **46.1** 🔴 **Two line items on one invoice.** A **platform fee** on
      every session, always, including free, in person and declined ones; and
      an **AI fee** only where `recording_consent = 'granted'`. Additive
      migration; existing rows become a platform fee plus an AI fee so history
      does not change value
- [ ] **46.2** Defaults in settings, not in code: platform fee **$1**; AI fee
      **$3** pay as you go, **$2** on the $30 plan, **$1** on the $60 plan
- [ ] **46.3** 🔴 **A tier is a price threshold and an AI rate, never a session
      count.** `{ key, name, unlockCents, aiRateCents }` replaces
      `{ rateCents, minimumSessions }`. The word "sessions" leaves the offer
- [ ] **46.4** **Credit is money, spendable on any line.** $30 buys $30 of
      credit, usable against platform fees and AI fees alike. The **rate the
      money unlocked does not expire when the credit does**
- [ ] **46.5** 🔴 **The therapist chooses which balance settles a bill first**:
      session credit, or held earnings. A new setting per therapist, honoured
      by the netting path in `lib/billing/service.ts`, with a default and a
      plain sentence saying what it means
- [ ] **46.6** Neither balance covers it, so Stripe in USD or the Egyptian
      gateway in EGP, unchanged from §3c
- [ ] **46.7** 🔴 **The plan page inside the portal**: the plan they are on,
      **their AI rate per session in words**, their credit balance, their held
      earnings, what they have spent this month split by line item, and the
      upgrade. Upgrading is a purchase, takes effect immediately, and never
      touches credit already bought
- [ ] **46.8** Downgrade holds the credit and drops the rate at the end of the
      period. 37R.6 already walks upgrade then downgrade holding unused credit
- [ ] **46.9** 🔴 The public pricing page, rewritten: **"$1 per session. AI
      from $1 more, only when your patient turns it on."** The two plans as
      dollar figures with what each unlocks. `lib/content/honesty.ts` gains the
      new true sentence and keeps rejecting the old false one
- [ ] **46.10** 🔴 **Never put "the patient pays nothing for AI" and "raise
      your price because you use AI" on the same page.** Both are true and only
      the first is ours to say. We never suggest what a therapist should charge
- [ ] **46.11** Every new string via 45.8, both languages, admin editable
- [ ] **46.12** 🔴 **FIRST TICKET IN THE SPRINT: rename both `rateCents`
      fields** (C252). `users.sessionRateCents` is the therapist's price to a
      patient; `pricing.tiers[].rateCents` is our fee to the therapist. Forty
      call sites, one search and replace away from a money defect that
      typechecks
- [ ] **46.13** 🔴 **A child `invoice_lines` table. The unique index stays**
      (C251). `invoices_session_unique` exists because it fixed a real double
      charge and is not traded for a billing shape
- [ ] **46.14** 🔴 **Rewrite `reconcileMissingCharges` per line kind** (C251).
      Today it asks "has this session an invoice", which with two lines answers
      yes for a session whose AI fee failed, silently, forever
- [ ] **46.15** 🔴 **`payerName` and `payerEmail` leave the therapist's
      ledger** (C243), replaced by the patient's own name from the chart. This
      lands here, before corporate exists, because after it exists the same
      column is a sorted list of who a sponsor pays for
- [ ] **46.16** 🔴 **No consent surface anywhere renders a currency symbol**
      (C209), proved by a verifier. The protection against coercion is the
      platform fee being unavoidable, not the AI fee being conditional
- [ ] **46.17** 🔴 **The crisis path is independent of every billing state**
      (C253): no credit, unpaid invoice, suspended account, and later an empty
      pot. Written here rather than in 53, because this sprint rewrites the
      charge path months before that one
- [ ] **46.18** Admin discount picks a line (platform, AI, or both). Silently
      discounting the first row found is a support ticket a month
- **Accept:** a declined session raises **one** line for $1; a consented
      session on the $60 plan raises **two**, $1 and $1; and a verifier proves
      the $1 line **is present** on the declined one, because a check that only
      asserts the absence of the AI fee passes against code that charges
      nothing at all (§6).

### Sprint 47 — The honest record · ~1.5 weeks

*C212, C213, C214. A future therapist reads eight notes and cannot tell that
three of them rest on a colleague's recollection of a session nobody recorded.*

- [ ] **47.1** 🔴 `session_notes` gains **provenance**, stamped at save from
      the session's consent state. Three values: `transcript`, `partial`,
      `clinician`. Additive; existing rows are backfilled from
      `sessions.recording_consent` and rows with no answer become `clinician`,
      which is the honest default rather than the flattering one
- [ ] **47.2** `partial` carries the **minutes off record**, from
      `offRecordGaps()` in `lib/data/feedback.ts`, which computes this already
      and is read only by the radar investigation screen
- [ ] **47.3** 🔴 Shown on **every surface a note appears on**: the clinician's
      own view, the next clinician's view, the patient's record, the export,
      and the evidence screen. Five places, one component
- [ ] **47.4** The patient sees which of their own sessions were transcribed.
      It is their record and their choice that produced it
- [ ] **47.5** The evidence screen keeps `clinician` as source priority 1. A
      hand-written note is not weaker evidence, it is **differently sourced**,
      and the screen says which rather than demoting it
- [ ] **47.6** 🔴 **Journals may be summarised, quoted and cited. They may
      never produce a diagnosis, a risk level, or any statement phrased as a
      conclusion about the person.** The bound lives in the evidence layer, not
      in a prompt, so a future prompt change cannot lift it. Proved against a
      planted journal that invites exactly that conclusion
- [ ] **47.7** The lone journaller: a patient on no therapist's list writes
      journals. They are scanned as today, **the crisis line is always on
      screen rather than triggered**, and no page says or implies anybody is
      reading. Promising a watch we do not staff is the most dangerous thing
      this product could do
- [ ] **47.8** Every new string via 45.8, both languages, admin editable
- **Accept:** a session where the patient declined produces a note badged as
      clinician-written, visible to the patient and to the next therapist, and
      the copilot can cite it while being unable to draw a diagnosis from any
      journal.

### Sprint 48 — The copilot in the room, free · ~1.5 weeks

*Absorbs and replaces sprint 23. C210 strikes 23.3 outright: the founder has
ruled the in-room allowance free rather than shared. C211, C224.*

- [ ] **48.1** 🔴 An ask-anything panel **inside** the session room, on the
      therapist's side. Minimised it shows live suggestions; expanded it is the
      full chat. The question a therapist wants to ask happens in the room
- [ ] **48.2** 🔴 **Free and uncounted, carried by the platform fee.**
      `checkQuota` in `lib/data/copilot.ts` stops counting in-room messages.
      This replaces 23.3, which said the opposite
- [ ] **48.3** 🔴 **Prepare me**, one click, free, one per session. Absorbs
      39.1, which was scheduled eighteen months out as a separate screen
- [ ] **48.4** 🔴 **The copilot reads the record as of `startedAt` and nothing
      after it**, identically whether consent was granted, declined or
      withdrawn. One bound, one test, no branch
- [ ] **48.5** 🔴 The panel says so: **"This session is not being recorded. I
      only know what came before it."** A therapist asking what the patient
      just said gets that sentence, not an answer about last month
- [ ] **48.6** The free window **is the session**. It opens with the room and
      closes when the session ends. Outside a live session the earned allowance
      applies unchanged
- [ ] **48.7** The four access states from §3 unchanged. This is a new surface
      on existing machinery, never a second set of rules
- [ ] **48.8** Citations resolve exactly as they do elsewhere, or the answer is
      dropped (sprint 8's rule)
- [ ] **48.9** The live-session indicator appears on `/copilot` the moment the
      patient joins. **Polling, not websockets** (founder's ruling)
- [ ] **48.10** 🔴 **The patient's own off-record button**, in the patient
      room. `offRecord` exists at `components/session/session-room.tsx:78` and
      is a clinician control. Audio stops; what was already captured stays,
      because a chart that rewrites itself is worse than one with a gap
- [ ] **48.11** Every new string via 45.8, both languages, admin editable
- **Accept:** a patient declines, the therapist opens the panel in the room,
      asks two questions, gets cited answers about the past and the refusal
      sentence about the present, spends **zero** credits, writes the note by
      hand, and the invoice shows one $1 line.

### Sprint 49 — Total View · ~3 weeks

*C220, C221, C222. `/admin/tv` predates eighteen sprints and cannot answer a
single question the business asks.*

- [ ] **49.1** 🔴 **The globe is the frame.** Clicking a country scopes the
      **entire screen** to it; clearing returns to platform wide. Closed
      countries are not rendered and not clickable (sprint 50)
- [ ] **49.2** **Live now**: therapists online, sessions in progress
- [ ] **49.3** **Sessions**: today, lifetime, custom range. AI-assisted
      sessions on the same three
- [ ] **49.4** 🔴 **Consent rate**: what share of sessions patients turned AI
      on for and what share they did not, by range and by country. This is the
      single number that says whether the split fee works
- [ ] **49.5** **Revenue**: to date, today, custom range, **split by source**:
      plan purchases versus pay-as-you-go session billing, and platform fee
      versus AI fee
- [ ] **49.6** **By therapist**: sessions, AI usage, total and breakdown, what
      they have paid us, and what we spent serving them
- [ ] **49.7** 🔴 **Cost, metered honestly.** Every model call records the
      exact model, input and output tokens, the cost at the rate in force, and
      what it was for, attributed to an organization, a therapist, a patient
      and where applicable a session. Rates live in settings; a historical row
      keeps the cost it was priced at. **An unattributable call is recorded
      against the platform, never dropped**
- [ ] **49.8** **By patient**: claimed or not, facts, context, past sessions,
      transcriptions held, and 🔴 **three separate revenue figures, never
      summed**: what they paid their therapist, what we earned in platform fees
      on their sessions, and what we earned in AI fees they unlocked by
      consenting (C222)
- [ ] **49.9** 🔴 **Two charts, always on screen.** Where platform revenue
      comes from, and where usage and cost come from by account. Either can be
      switched to a **list sorted highest first**, or to **horizontal bars**,
      by the admin, and the choice persists
- [ ] **49.10** Everything on this screen filters by country and by date range
      and sorts, including both charts and both lists
- [ ] **49.11** 🔴 **Every figure is a query against the ledger and the usage
      tables.** No number computed in a component, no number derived from
      another number on screen
- [ ] **49.12** Every new string via 45.8, both languages, admin editable
- [ ] **49.13** 🔴 **The corporate wall binds this sprint, which ships first**
      (C244). No screen here may join a sponsor to a session, a booking, a date
      or a patient name. Sponsor-level totals yes; platform-level per-patient
      figures yes; **never both inside one filtered view**
- [ ] **49.14** C221's cost table is a **new table**, not a column.
      `aiRequestLogs` records no tokens and no price
- **Accept:** an operator answers, without leaving the screen and without
      asking anybody, what share of Egyptian patients consented to AI last
      month, which five therapists cost us the most, and what we earned from
      each of them.

### Sprint 50 — The switches that do nothing · ~1 week · 🔴 LIVE DEFECT

*C218, C219. The founder switched a country off, the audit log recorded it, and
the country stayed on the map and stayed clickable.*

- [ ] **50.1** 🔴 **REWRITTEN. Two switches, each named for its question, one
      admin action that sets both** (C218, C219). `country_settings.enabled`
      is the **money** switch and **KEEPS its two payment consumers**
      (`lib/billing/connect.ts:449`, `app/pay/[token]/actions.ts:50`). Deleting
      it, as this ticket first said, would leave the payment rail open in a
      country we had just closed. The taxonomy entry is the **visibility**
      switch. The admin screen spells out what each one does
- [ ] **50.1b** 🔴 **The country filter belongs in `queryBoard`**
      (`lib/data/radar.ts:245`), not in the route, which has no `where` at all
- [ ] **50.1c** 🔴 **Invalidate the radar cache on save** (C254). It is a
      per-instance TTL cache, so without this the operator closes a country,
      reloads, and sees it still there, which is the original symptom all over
      again
- [ ] **50.2** 🔴 A closed country disappears from **the globe, the radar list,
      the radar filters and onboarding**. Its dots are not rendered and not
      clickable. `app/api/radar/route.ts` has **no country condition of any
      kind** today, which is where this starts
- [ ] **50.3** 🔴 A clinician already live in a country that closes is **taken
      off the radar and told why**. Their existing patients, sessions, notes
      and money are untouched
- [ ] **50.4** 🔴 The same rule for languages: a hidden language disappears
      from the radar, its filters and onboarding, and a clinician who had
      selected it **keeps the row and stops being matched on it**
- [ ] **50.5** A verifier that switches a country off, queries the radar API,
      and asserts zero rows. Then switches it back on and asserts the rows
      return, because a check that only proves absence passes against a radar
      that returns nothing at all (§6)
- [ ] **50.6** Every new string via 45.8, both languages, admin editable
- **Accept:** the founder closes a country in admin, reloads the public radar,
      and it is gone from the map, from the filters and from the signup form.

### Sprint 51 — Content and design, everything · ~3 weeks

*The CMS defaults were written before eleven sprints of product changes, and
37R.8 is still expected to answer whether the patient app looks like the best
mental-health app anybody has built or like scaffolding.*

- [ ] **51.1** 🔴 **Re-read every CMS default in both languages against what
      the product now is** and rewrite it. The split fee, the plans, the
      consent story, portability, the meeting bot, the EHR position. A page
      describing a product we no longer sell is worse than no page
- [ ] **51.2** Both entities' contact details and a working contact form, USA
      and Egypt, admin-editable, with no invented address anywhere
      (`lib/content/defaults.ts` ships empty rather than instructional)
- [ ] **51.3** 🔴 **The patient app, designed rather than assembled.** Every
      screen, both directions. If a page is plain text and buttons with no
      structure, it is flagged and rebuilt, not excused
- [ ] **51.4** 🔴 **The SOS orb** on every patient screen including a live
      session. Draggable, two taps, verified numbers only, a plain `tel:` link
      that works when our API does not
- [ ] **51.5** The therapist portal and the admin surfaces get the same pass at
      the same standard. A therapist looks at this all day
- [ ] **51.6** 🔴 **Every route the code can reach has a page a human can
      reach.** `session_sources` and `session_voices` both have tables and no
      interface (37R.21, 37R.22, C179). Either a screen exists or a ticket owns
      it. No third option
- [ ] **51.7** 🔴 **The bookings page**, which is a third built: therapist
      calendar with day, week and month views; tap a date to edit that day's
      availability; invite a patient to a **future scheduled** session; a
      confirmed booking **blocks the radar and blocks double booking**;
      reminders on WhatsApp, paid by us
- [ ] **51.8** The U+2014 and U+2013 ban holds across every new string, every
      CMS default and every email (C117)
- [ ] **51.9** 🔴 **Sell what we already built and never mention** (§7): an
      Arabic-speaking therapist for the diaspora, which needs no code and is
      the largest unsold group we have; a psychiatrist and a therapist on one
      record, which multi-grant already does; a verified badge a clinician can
      show off-platform; and a record that is still there years later
- [ ] **51.10** Rating volume floor (C273) · one price per clinician, never
      geo-priced (C274) · 🔴 **"24/7" describes the radar, never a response
      time** (C275) · dormant caseloads and deliberate handover (C272)
- [ ] **51.11** Every new string via 45.8, both languages, admin editable
- **Accept:** a person who has never seen this product uses every screen in
      both languages without asking a question, and nobody looking at the
      patient app calls it scaffolding.

### Sprint 54 — Clinics and hospitals · ~3 weeks

*§3f. A practice signs up, adds its clinicians, pays their bills, and sees a
schedule. It sees no clinical content at all. C259 to C267.*

- [ ] **54.1** 🔴 **A clinic IS an `organizations` row** (C259). Opposite
      answer to a sponsor, and both are correct. Write the reason at the top of
      the file, because the two sprints read alike and the tables must not be
      shared
- [ ] **54.2** A **clinic manager** is a new kind of user inside that
      organization holding **zero clinical access**. Not a `Role` on the back
      office enum, which is ours
- [ ] **54.3** A clinic signs up through its own door, is **held**, and is
      activated by admin exactly as a sponsor is
- [ ] **54.4** The clinic adds therapists **one at a time, by email and
      phone**, and each is invited
- [ ] **54.5** 🔴 **An invited clinician verifies themselves exactly as a solo
      one does** (C267). The clinic sees that verification is pending and can
      chase it. **It can never complete it.** C106's database invariant is not
      bypassed by the most credible-looking route available
- [ ] **54.6** 🔴 **No private patients on a clinic-attached account** (C261).
      Every session is the clinic's. **Stated in the invitation, before they
      accept.** A clinician wanting private work keeps a separate solo account
- [ ] **54.7** 🔴 **The clinic pays the platform fee and the AI fee** on every
      session its therapists run, through the same path as a solo therapist
      (C226's rule restated: one billing system, not two)
- [ ] **54.8** 🔴 **Its invoice is aggregated and never itemised to a session**
      (C263). A clinic bill that lists AI fees per session discloses which of a
      small caseload consented, which is the most protected choice in the
      product
- [ ] **54.9** 🔴 **What the clinic sees: its therapists' schedules, their
      usage, its bills, and a list of patient names with appointment times.
      Nothing else, in any form.** No note, transcript, journal, summary, risk,
      diagnosis, evidence panel or copilot. Asserted by a verifier running as a
      clinic-manager principal against **rendered output**, never against
      queries (C243's lesson)
- [ ] **54.10** The C229 denominator floor governs clinic reporting too
      (C262), the same setting and the same code path, not a second one
- [ ] **54.11** A therapist leaving a clinic keeps their record of their own
      patients and loses the clinic's connections immediately (C266)
- [ ] **54.12** 🔴 **The clinic portal, designed.** It is the therapist portal
      minus every clinical surface, which is a different product rather than
      the same one with things hidden. §3f, and the 51 standard
- [ ] **54.13** Every new string via 45.8, both languages, admin editable
- **Accept:** a hospital adds six clinicians, each verifies independently, the
      hospital reads a week of schedules and one aggregated invoice, and a
      verifier proves the manager cannot reach a single clinical word.

### Sprint 55 — The partner portal, and the API that has use cases · ~3 weeks

*Extends sprint 42 from a set of tables into a product somebody can sign up for
and use. C255, C264, C265. The first customer for this API is our own corporate
flow, which is why it ships beside 53 and 54 rather than after them.*

- [ ] **55.1** 🔴 **A partner is the sixth principal and the router is rewritten
      once, for all six** (C264), before a third portal is bolted on. No
      `require*` in `lib/auth/guard.ts` may return a sponsor or a partner as an
      `Actor`, asserted by a verifier
- [ ] **55.2** Partner signup, sign-in, and a **developer portal**: keys
      (hashed, scoped, rotatable), webhook endpoints, delivery logs, sandbox
      credentials, and docs generated from the same source as the API
- [ ] **55.3** 🔴 **A therapist never sees an API key** (§7). If a therapist
      reaches this portal, they got lost in our product

**🔴 The use cases, each one built and walkable end to end**

*An API with no named use case becomes a set of endpoints nobody can sell. Each
of these is a flow with a screen at one end.*

- [ ] **55.4** 🔴 **Employment verification.** A company's HR system answers
      "is this identifier currently active". **One person, one question, one
      boolean, one timestamp. Never a directory, never a list, never a sync**
      (C255). Scoped to one sponsor, rate-limited hard, and **only answerable
      about an identifier a person submitted through enrolment minutes ago**
      (C265). Every call audited; an abnormal rate suspends the key
- [ ] **55.5** **Clinician verification lookup.** Is this clinician verified
      with us, and by which body. A boolean and a source, never a document
- [ ] **55.6** **Record read under a grant.** A partner's clinician reads a
      patient's record exactly as ours does, because they hold a grant the
      patient gave and can revoke (C267's sibling: **a partner is a clinician
      for access purposes, never a special case**, and the patient can claim
      their record and leave)
- [ ] **55.7** **Session writeback.** A session held on the partner's platform
      lands in our record, source-attributed, through the door 36 built
- [ ] **55.8** **Note delivery.** A finished, clinician-approved note is pushed
      to their system. 🔴 Never a draft, never model output nobody signed
- [ ] **55.9** **The embedded widget.** Their clinician sees our panel inside
      their product. No video by default (42.5)
- [ ] **55.10** 🔴 **Webhooks carry an event and an id, never content** (42.4).
      A leaked URL then leaks nothing
- [ ] **55.11** **Patient CSV import** (42.8), because a clinician leaving
      another platform is the sales motion
- [ ] **55.12** 🔴 **A public `/developers` page that names the use cases,
      with a real example of each.** Today it names "SMART on FHIR" and nothing
      else. A developer must be able to read what this is for in one screen
- [ ] **55.13** Every new string via 45.8, both languages, admin editable
- **Accept:** a developer signs up, reads the docs, calls each of the seven use
      cases against the sandbox, and a verifier proves no key can enumerate
      anything and no webhook carries a word of content.

### Sprint 56 — Assessments · ~2.5 weeks

*Founder requirement from the flows dictation, and it had no ticket anywhere in
this plan until 2026-09-12. C278. It is the one thing in the product that gives
the copilot structured data a transcript cannot produce.*

- [ ] **56.1** `instruments`, `assessment_assignments`, `assessment_responses`.
      An instrument is **content**, not code, so a new one is added without a
      deploy
- [ ] **56.2** 🔴 **Free-to-use instruments only** (C278), each naming its
      source on screen. PHQ-9 and GAD-7 ship; anything licensed waits for a
      licence
- [ ] **56.3** 🔴 **Gamified, interactive and rewarding**, not a survey with
      radio buttons. One question at a time, progress, a streak. The founder's
      test is whether somebody finishes it
- [ ] **56.4** A clinician **shares an assessment into the live room**, and the
      patient does it on their phone while the session runs
- [ ] **56.5** The clinician watches progress live and can ask about it as it
      happens. **Polling, not websockets** (founder's ruling)
- [ ] **56.6** Assigned as **homework** instead, landing in the homework
      surface that already exists, with its reminders
- [ ] **56.7** 🔴 **Per-answer timings are data.** Which answer, and how long
      it took, folded into the session record beside the transcript. This is
      the structured signal the product has never had
- [ ] **56.8** The copilot may cite a score and its date. 🔴 **It may never
      turn a score into a conclusion about the person**, which is C214's bound
      in a second costume and enforced the same way, on the fact's domain
- [ ] **56.9** 🔴 **A patient sees their answers and their trend, never a
      verdict** (C278, C113). No clinical word appears beside a number on a
      patient screen
- [ ] **56.10** An assessment result is a fact with provenance, like every
      other clinical fact since 33
- [ ] **56.11** Every new string via 45.8, both languages, admin editable.
      **Instruments are translated as content**, and a mistranslated clinical
      instrument is not a typo, so an instrument's Arabic is reviewed by a
      named person before it publishes
- **Accept:** a clinician assigns GAD-7 in the room, the patient finishes it on
      their phone without being told how, the clinician sees it land, and the
      copilot can cite the score and cannot conclude from it.

### Sprint 52 — The last walkthrough and the four films · ~2.5 weeks · 🔴 LAST

*Runs only when every sprint above is done and every end-to-end flow works.
C225 governs the whole capture.*

- [ ] **52.1** 🔴 **A fresh purge and a single seeded database**, synthetic
      people only, names that cannot be mistaken for real ones. The walkthrough
      and the capture share one run, because the films must never be shot
      against an environment a real patient has touched
- [ ] **52.2** 🔴 **The full walkthrough, every user type, both languages**, on
      the complete product: the split fee on a declined session, the free
      in-room copilot, note provenance, the meeting bot sequence, plans and
      upgrade, Total View, and a closed country
- [ ] **52.3** **Write down what was hard, not only what was broken.** Buttons
      nobody could find, steps where it was unclear what happens next. No
      verifier in this repository can report this, and it is why 22R existed
- [ ] **52.4** Fix what the sweep finds. Then the films
- [ ] **52.4b** 🔴 **All six portals walked** (C268), not three: patient,
      therapist, clinic, sponsor, partner, admin
- [ ] **52.5** 🔴 **Three promo films, one per user type**: patient, therapist,
      admin. Promo in style, complete in coverage: **every screen and every
      interaction captured click by click**, cut for pace, showing the value
      rather than narrating the interface
- [ ] **52.6** 🔴 **A fourth film, split screen**: the patient's side and the
      therapist's side of **every flow we have**, at the same time, click by
      click. Claim, invite, consent, the session, the note, the summary, the
      invoice. This is the one that proves the product is one system. **And the
      cross-portal flows that did not exist when this was written** (C268): a
      sponsor funding a session the patient never pays for, a clinic seeing an
      appointment its therapist has just booked, a partner's call landing in a
      chart
- [ ] **52.7** 🔴 **On-screen explainer text in Arabic and English** on all
      four, correct in both directions
- [ ] **52.8** 🔴 **A written voiceover script, per screen, in Arabic and
      English**, timed to the cut, so the VO can be recorded to match the
      picture exactly without a re-edit
- [ ] **52.9** Every frame reviewed against C225. Raw captures of admin
      surfaces gitignored (C80)
- **Accept:** four films anybody can watch end to end, a VO script in two
      languages that matches them frame for frame, and a plain answer to
      whether this product is ready for a beta user who has never seen it.

### Sprint 53 — Corporate: companies and universities · ~4 weeks · 🔴 THE ONE WITH A CHEQUE

*§3e. The only flow in this plan that brings hundreds of funded patients from
one conversation, and the only one where a single leak ends the company. Read
§3e and C226 to C242 before the first ticket. **C227 is the sprint.***

**The wall**

- [ ] **53.1** 🔴 **The payer sees the roster and never sees usage attributable
      to a person.** Every ticket below is subordinate to this sentence. A
      verifier attempts, as a sponsor, to reach a session, a booking, a
      therapist, a date or a name, and fails on every one
- [ ] **53.2** 🔴 **Enrolment is eligibility, never therapy.** The words are
      "activate your benefit". Nothing on any enrolment screen, email or poster
      implies the person needs help (C227)
- [ ] **53.3** 🔴 Reporting floors: **weekly is the finest granularity that
      will ever exist** (C228), and below a headcount setting the sponsor sees
      the balance and nothing else, cohorts included (C229)

**The sponsor**

- [ ] **53.4** 🔴 `sponsors` is a **new table with its own auth and its own
      roles**, with no relationship to `organizations` and no path to an
      `Actor` (C230). A sponsor user is never scoped into clinical tenancy
- [ ] **53.5** A separate corporate door: sign up, choose **company or
      university**, give a contact name, email, phone and best time to call.
      The account is **held**, not active
- [ ] **53.6** Admin activates, verifies and manages sponsors. Company and
      university are one type with two faces: same controls, different words,
      different reporting emphasis (§3e)
- [ ] **53.7** The sponsor defines their **identifier fields**, capped, from a
      constrained set. **Never a national identifier, never health
      information, never free text** (C238)
- [ ] **53.8** Listed publicly or reachable only by code. **Unlisted is the
      default** (C236)
- [ ] **53.9** A printed **QR**, carrying the sponsor's identity only, short,
      revocable, and a dead code answered with a sentence (C237, C120)

**The pot**

- [ ] **53.10** 🔴 **A payment method, not a billing system** (C226). One new
      ledger account, one new funding source at the point of payment, **no new
      session type and no parallel invoice path**
- [ ] **53.11** Top up, minimum **$5,000 as a setting**, in the currency of the
      entity that holds it. §3c's rails unchanged
- [ ] **53.12** 🔴 **Spendable on therapy sessions on this platform and nothing
      else.** No cash out, no transfer, no other product
- [ ] **53.13** Refund and expiry terms **shown on the top-up screen with the
      button**, decided before any deal (C233)
- [ ] **53.14** A session that has started always completes and is always paid.
      One session negative per patient, then the sponsor is invoiced (C239)
- [ ] **53.15** 🔴 **Receipt, VAT invoice and proof of payment** that look like
      they came from a company. Egyptian e-invoicing confirmed with counsel
      before the Egyptian entity takes a corporate payment (C241)
- [ ] **53.16** Every pot cent traces to one payment in and one session out, in
      the real ledger, covered by the daily reconciliation (C232)

**The person**

- [ ] **53.17** 🔴 **REBUILT on the joining code. There is no approval queue
      and there is no roster** (C227). The sponsor is issued a **joining code**
      and a **QR** of the same code, which they circulate internally and print.
      They separately define **which identifier they require** and **the shape
      of a valid one**. Matching is automatic, against a shape and a domain,
      never against a list of people
- [ ] **53.17b** 🔴 **The sponsor never sees an enrolment, a rejection or a
      join date**, and performs no act about any individual. Their only
      individual-level power is removal, from the enrolled list (C234)
- [ ] **53.18** The person signs up as an ordinary patient, taps join, enters
      the code **or scans the QR while signed in**, confirms the name and phone
      we already hold, and supplies the identifier. **Nothing is pre-filled for
      anybody who is not signed in** (C121)
- [ ] **53.18b** 🔴 **The identifier is a gate and nothing else.** A work email
      used to cross it is **never** used for communication unless the person
      signed up with it. Stored for matching and de-duplication only, never
      returned to the sponsor, never a destination for anything we send except
      the one verification code in 53.19
- [ ] **53.19** 🔴 **Prefer proof over pattern** (C246). An **email on the
      sponsor's domain, verified by a one-time code**, is the recommended
      default. **An ID matched only by shape is a weak gate**, permitted, and
      the sponsor is told in plain words that it is guessable and that they
      carry the risk. Underneath both: **one identifier used once, ever**,
      attempts rate-limited per code, the code short, revocable and rotatable,
      and a spike alerting admin and the sponsor as a **number, never names**
- [ ] **53.19b** 🔴 **Re-verify periodically** (C247), a setting defaulting to
      six months, because without a roster nothing else can notice somebody has
      left. No reply pauses funding, tells the person how to fix it, is
      reversible by us in one step, and **never touches their record**
- [ ] **53.19c** The identifier example is **a description of the shape, never
      a specimen value** (C248). The domain may be named; a sample local part
      may not
- [ ] **53.19d** More than one sponsor is allowed; **exactly one is primary**,
      chosen by the patient (C249). **Enrolment funds forward only, never
      retroactively** (C250)
- [ ] **53.20** 🔴 A **patient notification log**: net new, append only,
      nothing ever deleted, dismissible from the main view only (C231)
- [ ] **53.21** A badged patient books and **pays nothing**. Pot first, always;
      they never pay out of pocket while it has money
- [ ] **53.22** 🔴 **Removal from the roster ends funding and the badge and
      touches nothing else.** Not the record, not the grants, not the journals,
      not the summaries, not the history. Said **before** they enrol (C234)
- [ ] **53.23** 🔴 **Crisis is never gated on money.** Proved by emptying a pot
      and asserting the crisis surface is unchanged (C235)

**The therapist**

- [ ] **53.24** 🔴 **Nothing changes and nothing shows** (C242). And the
      verifier **asserts on rendered output, never on queries**: the check as
      first written passes against C243's leak, because that leak is an
      absence rather than a value

**Reporting**

- [ ] **53.25** Balance, total spend, total sessions, and a **weekly spend**
      heatmap across the year. Spend, never session counts, never people (C228)
- [ ] **53.26** The university face adds **demand planning**: is the pot sized
      for next term. The company face adds **spend against budget**
- [ ] **53.27** Every figure a query against the ledger, and every figure
      passed through the floors in 53.3 before it renders
- [ ] **53.28** Every new string via 45.8, both languages, admin editable

- **Accept:** a sponsor funds a pot, runs a universal enrolment drive, approves
      a roster, and reads a year of weekly spend, while a verifier proves that
      no sponsor surface can reach a single session, name, date or therapist,
      and that emptying the pot changes nothing about the crisis path.




## §5 · BUILD LOG

| Date | Sprint | What | Commit | Verified how |
|---|---|---|---|---|
| 2026-09-04 | 1.1–1.3 | `platform_settings` (4 jsonb groups) + `country_settings`; typed accessor `lib/settings` with per-field fallback | *this* | Migration `0029` verified against `information_schema`: 12 columns, all present (H1). `npx tsx scripts/settings.ts show` prints the seeded rows |
| 2026-09-04 | 1.4 | H12 — transcribe costing now reads `input.model`; both branches look the model up and fall back to the **dearest** rate, never zero | *this* | 3 new tests in `safety`: two rates cannot collapse into one; an unpriced model overstates; H13's 1e5 divisor |
| 2026-09-04 | 1.5 | Clock is 50 running → 10-minute countdown on **both** screens → hard stop at 60. `decision`/`extended` stages and `extendSession` removed | *this* | `clock` suite rewritten, 12 tests. One runs the whole ladder at 20+2 minutes (H4) and one at a zero-length countdown |
| 2026-09-04 | 1.6 | Repriced: PAYG $4 · Starter $3/min 10 · Growth $2/min 30; cut 10%→**15%**; cap $1,000→**$500**. New `session_credits` table makes the tiers purchasable | *this* | Migration `0030`: 12 columns, 3 indexes. `verify:sprint1` asserts every figure against the live rows |
| 2026-09-04 | 1.7 | Every therapist moved to PAYG; `unlimited` removed from `PLANS`, from Stripe checkout, and from the pricing page | *this* | `SELECT DISTINCT plan FROM subscriptions` → `payg` only, 36 rows, 0 stragglers |
| 2026-09-04 | 1.8 | `createSessionCheckout` **refuses** a payment when the clinician has no transfer-capable Connect account, instead of capturing to our own balance | *this* | Only one `capture` value is now reachable (`"destination"`, typed `as const`). `verify:sprint1` confirms 0 historical `platform` rows — the door closed before anything went through it |
| 2026-09-05 | 5.x | **Sprint 5 complete.** `people` above `patients` · claimed/unclaimed · backfill with no merging · suggest-only matching · the unclaimed rule | *sprint 5* | Migration 0033 verified against `information_schema`: 11 cols, 5 indexes, `patients.person_id` linked. **66 patients → 66 people, 0 orphans, 0 merges** — and checked field by field, because an `INSERT…SELECT` joined by `row_number()` can pair the wrong rows while every count still looks right: 66 pairs, 0 name and 0 email mismatches. `verify-sprint5.ts` asserts the three duplicate-email cases stayed separate. 155 tests / 9 suites |
| 2026-09-05 | 4.x | **Sprint 4 complete.** Money model migrated · `/pay/[token]` country-first · FX quotes held an hour · cut and VAT as separate lines both sides · `session_type` | *sprint 4* | Migration 0032 verified against `information_schema`: 9 new columns on `session_payments`, `fx_quotes` 7 cols / 2 indexes, `session_type` backfilled 8 paid_link + 61 direct. `verify-sprint4.ts`: 17 checks incl. §3's worked example to the cent ($30 → $34.20 / $4.20 VAT / $4.50 cut / $25.50 net → 1641.60 EGP), quote reuse within the hour, and an unpriceable pair refused. It caught C38. 144 tests / 8 suites, build clean |
| 2026-09-05 | 6.x | **Sprint 6 complete.** A separate patient identity · `requirePatient` · the `(patient)` route group · the eight-step claim · C19's invite link · the clinician's side of handing a record over | *sprint 6* | Migration 0034 verified against `information_schema`: `patient_accounts` 10 cols, `patient_auth_sessions` 8, `person_claims` 11, `person_invites` 9; three unique indexes present; `people.claimed_by_account_id` confirmed pointing at `patient_accounts`, not `users`. `verify-sprint6.ts` runs 30 checks that *try the thing that must fail*: a duplicate patient email is refused by the database, a forwarded invite cannot be redeemed twice, a superseded code stops working, a claimed record cannot be claimed or invited again, and `users.organization_id` is still `NOT NULL` (C41). It caught **C44** — an upsert against a partial index that Postgres would have refused outright, i.e. a 500 on every second "send me a code". 139 tests / 7 pure suites + 9 ledger, build clean, all five `/patient/*` routes present |
| 2026-09-05 | 7.x | **Sprint 7 complete.** `history_grants` · two shapes · request with a note · reject freely · revoke in one tap · a patient in the audit log · the four states in one pure module · both room controls and the late-recording stamp | *sprint 7* | Migration 0035 verified against `information_schema`: `history_grants` 14 cols + the partial unique index, three new `sessions` columns, `audit_log.actor_account_id`. `verify-sprint7.ts` runs 28 checks, all against the real database: a second pending request refused **by the index**, a 24-hour window measured at 24h ±60s, an answer arriving twice landing once, a grant belonging to somebody else refused, and the whole of §3's step 7 exercised both ways — **no** produces 0 grants and lands the clinician in the degraded state; **yes** produces exactly 1 and restores it. The diagnosis refusal is checked by *attempting the write* and then re-reading the row to confirm nothing changed. 16 pure tests in `consent`, including §3's worked example ("recording began at 10:32… the first 10 minutes… do not exist") and the Cairo/UTC clock. 164 tests / 9 suites, build clean, `/patient/consent` present. **Deliberately not backfilled**: `recording_started_at` is null on all 69 existing sessions — we do not know when their microphones started, and guessing would make a note claim a completeness it lacks |
| 2026-09-05 | 8.x | **Sprint 8 complete.** Documents on the person · any format, 25 MB · deterministic chunking · `[D7:3]` citations that resolve or are deleted · provenance · flags that never delete · diagnoses that cannot exist without their source sentence · an audited read-only viewer with server-side speech | *sprint 8* | Migration 0036 verified against `information_schema`: `person_documents` 18 cols, `document_chunks` 6, `person_diagnoses` 12, `content_flags` 10; the ordinal and sequence unique indexes and the partial worker-queue index all present; `source_sentence` confirmed `NOT NULL`. `verify-sprint8.ts` runs 32 checks on the real database, the sharpest being isolation and consent: the **same `[D1:1]` resolves to different documents for two different people**; a flag on another person's passage is refused; and **C47 closed by measurement** — the copilot's document assembly returns **0 characters** to a revoked clinician and 216 to a granted one, on the same person, so the material never enters the prompt. 23 pure tests in `documents`, including that every chunk is a verbatim substring of its source and that an inferred diagnosis is dropped because its sentence is not there. 187 tests / 10 suites, build clean, `/patients/[id]/documents`, `/patient/profile` and both API routes present |
| 2026-09-05 | 9.x | **Sprint 9 complete.** Rolling profile regenerated from sources · dated observation timeline · the copilot told which references are history and which are sessions · conflicts surfaced and never resolved · homework with the scoreboard rule built into the queries | *sprint 9* | Migration 0037 verified against `information_schema`: `person_profiles` 8 cols with its unique index, `observations` 8, `homework_items` 15. `verify-sprint9.ts` runs 26 checks, the sharpest being the ⚠️ rule asserted on the **shape** of what each side receives — the patient's query returns exactly `id, title, detail, dueAt, othersWaiting` and the clinician's returns the trend; a person who has closed nothing has a **null** rate, not 0%. Also: a borrowed item id closes nothing, an answered step cannot be withdrawn, and a second profile row for the same person is refused by the database. 15 pure tests in `memory`: a section with an invented ref is dropped rather than trimmed, a one-sided "conflict" is not a conflict, an undated observation is never dated to today. **Deliberately not backfilled**: 0 homework rows from the notes that already carry drafted steps — see C56. 202 tests / 11 suites, build clean, sprints 6–8 verifiers still pass |
| 2026-09-05 | 10.x | **Sprint 10 complete.** A general copilot that structurally cannot read a clinical record · roster-validated patient links · threads · a monthly allowance from settings · first-use preferences | *sprint 10* | Migration 0038 verified against `information_schema`: `assistant_threads` 7 cols, `assistant_messages` 7, and the partial quota index on `role = 'therapist'`. `verify-sprint10.ts` runs 24 checks. The two that matter: **10.2 asserted on the module's import block** — none of the seven clinical tables, and no note content selected — and the roster's own **key set**, which is `patientId, name, lastSessionAt, nextSessionAt, draftNotes` and nothing else. Also: another user's id opens no thread and reads no messages; an assistant reply does not spend a message (1 → 1) while a question does (1 → 2); deleting a thread leaves the allowance unchanged (2 → 2). 15 pure tests in `assistant`, including that "Sara" does not light up inside "Sarah", that "Sara Mahmoud" beats "Sara", and that Arabic names match on Unicode boundaries. It caught **C57** before it shipped — a `MIN(scheduled_for)` on a column that does not exist, which typechecks inside a `sql` template and would have thrown on every load. 217 tests / 12 suites, build clean, sprints 6–9 verifiers still pass |
| 2026-09-05 | merge | **Sprints 1–10 merged to `main` and deployed.** Fast-forward `7f883e2 → c1e0030`, 17 commits, 161 files. Migrations **0029–0038 applied to production first**, then the push — Vercel runs `next build` and nothing else, so the reverse order would have served code whose tables do not exist (H16). Verified on production after: 19 new tables, 39 rows in `__drizzle_migrations`, all 3 `unlimited` subscriptions moved to `payg` (36 payg, 0 elsewhere), 56 people created and all 56 patients linked, settings seeded ($4/$3/$2 · 1500bps · 12 months · EG 1400bps · US 0). Deploy green, `/patient/login` and `/patient/signup` serving 200. Found at the merge: **C60**, the pricing page still selling $6 and Unlimited | *`c1e0030` + this* | `information_schema`, `settings:show`, live route sweep, typecheck, `next build`, 140 offline tests across 8 suites |
| 2026-09-06 | 11.x | **Sprint 11 complete.** Bookable whole hours · `scheduled_at` · a public booking calendar · the radar's escape hatch · auto-offline inside the reachability predicate · a mid-session warning · a notification seam with WhatsApp written but unkeyed | *sprint 11* | **Migration 0039 applied to PRODUCTION first (H16), then verified there against `information_schema`**: `availability_slots` 12 cols, 4 indexes, the `availability_slots_whole_hour` CHECK, `sessions.scheduled_at` present, and **0 of 63 production sessions backfilled**. Additive only — the running deployment survives the gap. `verify-sprint11.ts` runs 25 checks on the branch: a **19:15 insert refused by the database**; a second hold on the same hour refused rather than overwriting; a booked hour that cannot be re-booked, cannot be deleted, and vanishes from the public calendar; the session written as `scheduled` with a **null `started_at`**; and auto-offline asserted twice — through the helper *and* against the radar's raw `NOT EXISTS`, because a helper can be right while the query is wrong. 16 pure tests in `scheduling`, including that an inverted 21→18 range yields nothing rather than wrapping past midnight. Also closed **C57** and wired **10.6** into Settings. 233 tests / 13 suites, build clean, sprints 6–10 verifiers still pass |
| 2026-09-06 | 14.x | **Sprint 14 complete.** Five minutes then a real choice · replacements at or below what was paid · the session moves rather than being recreated · the difference back as patient credit · a reliability score that is absent below five sessions | *sprint 14* | **Migration 0046 applied to production before the push (H16)**, additive: four columns on `sessions` and a new `patient_credits` table with CHECKs that money owed is never negative and never over-spent. `verify-sprint14.ts` runs 13 checks. The sharpest is the price ceiling asserted **at the write, not only in the list**: a clinician who raises their price between the two screens must not be able to charge a let-down patient more, and the reassign is refused when they do. Also proved: the difference becomes exactly $10 of credit on a $30 session taken by a $20 clinician, expiring in twelve months; a negative credit and an over-spend are both refused by the database; the moved session remembers who did not turn up, so 14.7 counts it against the absentee rather than the replacement; and the score is **null** below five sessions rather than a small-sample percentage. `refundSessionPayment` now takes a nullable `adminUserId` — a no-show refund is issued by the clock and stamping a staff member's name on it would be a lie. C57 ruled and closed. 295 tests / 19 suites, 11 verifiers pass, build clean |
| 2026-09-17 | 37L | **Sprint 37L, the product speaks Arabic.** The patient app is Arabic end to end · **197 new strings written AS Arabic, not translated from the English** · a ratchet so this cannot happen a fourth time · and the same crisis-number defect found in three more places | *sprint 37L* | **No migration.** Nothing is waiting for the planning session. **37L.1 — the patient app is done, and it was walked in Arabic rather than assumed.** Every one of the 19 patient pages and every patient-facing component: the home, sessions, journal, summary, record, profile, consent, claim, invite, billing, account, homework, residency, browse, the radar, the booking sheet, **the live session room**, the rating and summary screen, and the SOS sheet. Measured on the running app with `Accept-Language: ar-EG`: **13 of 14 screens 90%+ Arabic**, the remainder being the patient's own data — her therapist's name, the summary he wrote her — plus dates, which are **gap 37L.9**. Direction is right on every screen and nothing scrolls sideways at 414px. **The dictionary went from 338 keys to 535**, and the 197 new ones were written as Arabic first: where the two languages are not literal translations of each other that is deliberate, because a sentence composed in English and then translated carries English sentence shape and reads like a ministry form. **🔴 C198 — the same defect as C184, three more times, and translating is what found it.** The live session screen, the feedback page and the radar's safety line each printed **988** to every reader on earth. Each said *"in the US"* rather than flying a flag, so none was as bad as the orb — but each was the only concrete number an Egyptian patient was given, on the screen she is sitting on during a session, immediately after one, and while looking for help. **All three had a dictionary key already written that says the thing that is true everywhere, and none of them called it.** The founder's rule generalised exactly as he said it would. A verifier now scans every component for a bare crisis number, comments stripped, proved against the line that was in the session room. 🔴 **The method is the finding:** a translation pass is a full read of every sentence in the product, which is why it caught what fourteen sprints of verifiers and one walkthrough had missed. **37L.6 — the ratchet, which is the half that stops this being sprint 19 again.** `scripts/_i18n-coverage.ts` counts English literals in the markup per surface and `_i18n-coverage.json` holds the high-water mark: **patient 22, auth 4, portal 105, admin 312, shared 434**. A number may only go down, and the CONTROL proves the gate catches a surface that grew. The count is honestly a **floor, not a total** — a string inside a ternary or an ordinary prop is invisible to it — and the file says so; the walkthrough found six such strings this sprint and they are fixed. The patient's 22 are the clinician's view of a patient's record, deferred to 37L.2 by name. **🔴 C199 — a hook in a server component builds clean, typechecks clean, and throws at request time.** Three components got `useT()` without `"use client"`; `tsc` and `next build` both passed and two patient screens returned 500 to the first browser that asked. Guarded by a check now, and caught only because the sprint ended by **running the app and reading the screens**. A second one from the same hour, also recorded: **`next start` does not fail loudly when the port is taken**, so a restart script that does not kill the old server leaves the previous build answering and a fix appears not to work. **C200 — translating broke five gates that asserted copy by grepping for it.** `verify:sprint19`, `21R`, `25` and `26` each held a sentence by testing that it appeared in a component; the moment it moved into the dictionary they were asserting that the file had **not** been translated. All five repointed at the dictionary, in both languages, keeping the property each was really about. **What is NOT done, counted rather than claimed:** the therapist portal (**105**), the admin console (**312**), the clinician's auth screens, the emails and the WhatsApp templates, and **37L.9, dates and times, which render `Friday 11 September, 16:09 (Cairo)` to an Arabic reader** because the formatting layer takes a fixed locale. That one is a shared layer with its own tests and its own standing rule about Western digits, so it is its own pass rather than the last edit of a long sprint. `verify:sprint37l` **13 checks PASS**, every other verifier green, typecheck and build clean |
| 2026-09-16 | 37R | **Sprint 37R, the second walkthrough.** Fourteen sprints and 57 route files since anybody used this product · **the SOS orb was showing an Egyptian patient a United States number** · every page judged as a design, and 48 of 81 are not finished | *sprint 37R* | **No migration.** Nothing is waiting for the planning session. Fresh purge on the working branch, one seeded admin, `ship:content 28 24`, **every account created through the real forms**, both languages, both widths, **334 screenshots in `docs/walkthrough-2/`**. 🔴 **C184 IS THE FINDING AND IT IS THE ORB.** Layla's number is `+20 100 123 4567`, her therapist practises in Egypt, and the sheet that opens on the most safety-critical control in the product led with a large red **🇺🇸 Help · 988 · United States**. `lib/crisis/line.ts` exists to prevent exactly that and says so in its first paragraph; **the orb never called it** — it rendered `Object.entries(CRISIS_LINES)`, the whole table, and the table has one row, so every patient on earth got the American lifeline as the primary action and *"call your local emergency number"* as a footnote. No verifier could see it: the string lives where it belongs and the import is from the right module. **Fixed and re-walked:** `lineForNumber` matches the longest dialling-code prefix and answers only when the candidates leave one verified line between them, so `+20` now gets the sentence and `+1` still gets 988; the orb takes the reader's own number and the layout supplies it. **The rule: a verified number is not enough, it has to be verified FOR THE READER.** 🔴 **C182, and it is scope rather than a bug: the product is not localised, only the website is.** Direction is right everywhere — **71 of 71 Arabic renders are `dir=rtl`** and nothing scrolls sideways on a phone — and inside that frame **all 18 admin pages, all 21 therapist pages, all 14 patient pages and all 8 auth pages are English**. The dictionary is **87 keys used by 4 components**. Sprint 31 shipped Arabic addresses and Arabic content and both work; nobody translated the application. That is the sprint before a beta in Cairo. **C185 / C186, both found by using it:** a signed-out visitor got a four-tab bar every destination of which bounces to sign-in (the prop to prevent it has existed since 25 and nothing passed it), and **the same person could be added to a caseload twice, silently** — same phone, same email, ten seconds apart, two charts, in a product whose identity model is *the number is the handle*. Both fixed; the duplicate is refused, names the record that already holds the number, and takes a deliberate tick for the real case of a shared phone. **Six smaller fixes**, including five admin destinations clipped off a 1440px laptop with no affordance, and the therapist's radar control which was an unlabelled grey dot. **What works, and each one was checked:** the whole clinical loop end to end; **the claim order refuses to say anything before the handle is proven**, in those words; consent off by default on an invite the therapist sent; portability's full round trip including a decline with a reason the patient reads; the risk banner firing on the keyword floor alone with no credits; and **honest degradation on every unconfigured capability** rather than silent failure. **C183 — every page has a design verdict: 13 finished, 34 thin, 14 unstyled**, with 9 of 18 admin pages carrying zero icons and the whole therapist portal in one 620px column beside a laptop's worth of empty space. The table is in `REPORT.md` and it is the brief for the design sprint. **37R.22 ruled: the voice screen is a TICKET (37.5), not a build** — `session_voices` rows are made by the provider that is gap 37.4, so a screen built now would be the first one nobody could walk. **Five environment gaps named rather than absorbed**: no blob storage, no Stripe, no WhatsApp or email, no Daily, no OpenAI credits — so uploads, payment, code delivery, video and the model half are **not walked**, and two deviations (documents written directly, one transcript seeded) are recorded in the scripts that made them. `verify:sprint37r` **16 checks PASS**, 8 new crisis-line tests, all other verifiers green, typecheck and build clean |
| 2026-09-15 | 37 | **Sprint 37, acoustic diarisation — the OFFLINE HALF.** The arithmetic, the alignment and the evidence rules · **there is no elimination rule** · and a database that refuses to write a guess down as a person | *sprint 37* | ⚠️ **MIGRATION 0065 IS WAITING FOR THE PLANNING SESSION.** Applied and verified on the working database only: `session_voices`, **13 columns**, **6 CHECKs all validated**, 4 unique indexes, 3 triggers, one additive nullable column on `transcript_segments`, **0 unvalidated constraints anywhere**, ledger **66**. Production is at 65. A new table plus one nullable column, so the running deployment survives the gap (H16). **Built in the order the planning session set, and 38 and 39 are untouched.** **37.1 — the half that can be measured exactly, measured exactly.** `lib/diarisation` is three pure modules and no network: turn normalisation (a provider's negative, zero-length, out-of-order and overlapping turns come back usable, and the discards are **counted** rather than swallowed), alignment of acoustic turns onto transcript chunks, and the evidence rules. 🔴 **Crosstalk is preserved, never resolved** — a normaliser that kept the louder voice would delete the evidence that a chunk is contested before anything had the chance to refuse it. A chunk is attributed only when one voice holds **three quarters** of its speech; below that it is `contested`, and a chunk that is mostly room tone is `silence`, which look identical in a transcript and mean completely different things. **37.2 / C177 — THE FINDING, and it is a line of code that is not there.** Two voices, one provably the clinician, therefore the other is the patient: right most of the time, and wrong for the supervisor sitting in, the parent answering for a child, the partner arriving late, the mother on speakerphone. **A voice is bound only by evidence — `track` or a named `operator` — and never by elimination**, not in a two-voice room and not when two voices both claim the clinician (the stronger claim takes it, the loser is left *unnamed*, and a tie is nobody). The cost is stated rather than buried: a single-microphone session with no two-track evidence attributes nobody by this path and falls through to the sprint-32 semantic layer, which marks every row `speaker_inferred` so the reader can tell which answered. **37.2 / C178 — the rule is the schema, again.** A line on an unbound voice **cannot** hold a person; `bound_by` is `('track','operator')` with **no value meaning a model decided**; there is **no display-name, alias or nickname column**, so a meeting provider's "Mum" has nowhere to land (41.5, two sprints early); a voice keeps its label and its number for the life of the recording; and **unbinding puts every line that claimed that person back to `unknown` in the same statement**, because otherwise 37.2 would be true only of new rows. **37.3 — N speakers.** One clinician per session by partial unique index, **two patient voices allowed because couples exist**, five voices in a group are five voices and five numbers, and "Speaker 3" is the third voice in the room whether or not one and two were identified — the number a person reading the transcript would use. **The fixtures are proved against a planted offender.** Nine handwritten recordings, 68 chunks, gold decided by how the audio was constructed rather than by running the aligner — and `verify:sprint37` **removes the share floor and watches the straddle and crosstalk recordings start producing confident labels**, because a fixture set nobody has watched fail may be agreeing with itself (C84, C158). ⚠️ **37.4 IS A NAMED GAP, not a silence.** No provider is called anywhere, and the **acoustic DER is not measured**: a DER over synthetic turns would measure `align.ts` agreeing with its own fixtures. It needs real audio of two people in a room, a gold transcript, a provider and credits. Named the way **35R.4** is named, and 🔴 **41 stays blocked on 37 being MEASURED, not merely built.** Two checks in the verifier assert the gap is real and that it is written down where the plan can see it. Pins unchanged at **85**. `verify:sprint37` **33 checks PASS**, 21 new diarisation tests, every database refusal paired with the write it must allow, all other verifiers green, build clean |
| 2026-09-15 | 36 | **Sprint 36, session sources.** Design only, no bots · a table that cannot describe a meeting we did not create · a third door that is narrower than the two it joins | *sprint 36* | ⚠️ **MIGRATION 0064 IS WAITING FOR THE PLANNING SESSION.** Applied and verified on the working database only: `session_sources`, **14 columns**, **4 CHECKs all validated**, one trigger, **0 unvalidated constraints anywhere**, ledger **65**. Production is at 64. A new table and nothing else touched, so the running deployment survives the gap (H16). **36.1 / C175 — the rule is the schema.** 41.1 says the bot joins meetings we created for a session, nothing else, ever, and the carry-in was that a table able to represent anything else turns that back into a convention. So there is **no column for a pasted link** and **no column that could hold a calendar** (C132): an external kind must carry `provisioned_at` and `provisioned_by_user_id` by CHECK, there is one source per session by unique index, and the meeting identity is immutable after insert by trigger — 41.7's *bot in the wrong meeting* foreclosed two sprints early. The calendar scan is proved against four planted column names. The residual is named rather than claimed away: nothing in the database knows whether `provisioned_at` was set honestly, and 41 owns the one writer. **36.2 / C176 — a third door, and no second transcription path.** The route was already source agnostic; what blocked a bot was `assertSameOrigin()` and `requireUserApi()`, and **both are untouched**. The new door is narrower than either: the session id is inside the token *and* the hash is stored on that session's own row, so a token for session A cannot be expressed at session B; it expires in hours, revokes, counts its uses, and the column's CHECK will not hold anything but a SHA-256. 🔴 **What it opens is audio in, a sequence number out** — the copilot never runs on a token request, and the response carries no transcript text and no crisis flag, because a credential somebody could leave in a log must not be answerable with clinical text. **36.3 — no bots.** No provider, no OAuth, no joining. The shape only, as the plan says. **Also, from the founder's own testing after 35R:** his four sentences are now cases. Three are quiet and the fourth still alarms, and it is kept as a **case rather than chased with a fix** on his reading — *a first-person verb with a third-person object is the shape, and a list will keep meeting it.* Specificity on the 48-case set is therefore **95.7%**, not 100%, with the one miss named in the fixture; sensitivity is **92.0%**. The classifier refuses all four, so what ships is unaffected in the direction that matters. **And one call with nothing to route on.** A bot presents a session id and no person, so the region cannot be resolved before the row is read. The answer was not a pin: `acrossRegions` asks every region, which is the fan-out C155 shipped for exactly this. Pins unchanged at **85**. `verify:sprint36` **20 checks PASS**, 17 new token tests, every refusal paired with the write it must allow, all other verifiers green, build clean |
| 2026-09-14 | 35R | **Sprint 35R, the eval case set.** Five sessions to fifteen · 30 risk cases to 44 · the three C171 offenders fixed in the LIST · and the guard written to fix them was silently dead on arrival | *sprint 35R* | **No migration.** Nothing is waiting for the planning session. 🔴 **C173 is the finding, and it is C161 happening again one sprint after it was ruled on.** The context guard — tense and subject for the phrase list — was written with a second copy of the Arabic fold, whose literal character class swallowed the letters exactly as C161's had. Every Arabic marker folded to `""`, `"any English sentence".includes("")` is true, so *"is this about the present?"* answered **yes for every sentence in every language** and the guard suppressed nothing. The eval showed **no change at all** after it shipped, which is the only reason anybody looked. The ruling C161 wrote was a thing to remember and remembering failed, so it is now two things in code: **one fold** with explicit `\u` escapes, and **`contains()`, which refuses an empty needle**, used by every membership test in `lib/crisis`. `foldsToNothing()` checks every marker list over its data, so a marker added next year is checked too. **C171 fixed in the list, as ruled.** On the **old 30-case set**, like for like: sensitivity **88.2% unchanged**, specificity **76.9% → 100%**. All three offenders gone. On the **new 44-case set**: sensitivity **92.0%**, specificity **100%**, English 92.9%, Arabic 90.9%, with only the two known-unreachable cases missed. 🔴 **The widened set caught a bug in the guard within the hour.** *"Years ago I felt suicidal and it passed. It is back now, worse than it was."* was **missed**, in both languages: the sentence was past and resolved on its own terms, and the correction that mattered was in the next sentence where nothing was looking. The file's own doc promised *"a present-tense marker beats everything"* and the code applied it only within one sentence. The present now wins over the whole text, and it errs toward alerting, which is the only direction this file is allowed to be wrong in. **The set:** 15 sessions (5 Arabic), 11 with a contradiction so one case is 9.1 points rather than 50, 14 poisoned, 72 stated facts, 89 planted traps. Deliberately harder, not merely bigger: a session where the patient says almost nothing (testing the prompt's claim that an empty field is a normal outcome), a first session with no chart at all, and several whose prior facts disagree in exactly the way 34 was getting wrong. Risk: 44 cases, 25 positives and 19 negatives, eight of them written to push the guard from the side that must still fire. **C174:** a widened set silently invalidates every number in the file, so the baseline now records the SHAPE it was measured on and a run over a different shape is **refused rather than compared**. ⚠️ **35R.4 is incomplete and it is credit, not code.** The OpenAI account ran out mid-sprint, so the five model suites could not be re-recorded on the widened set. `evals/baseline.json` still holds five-session figures, says so in its own comment, and the gate is **honestly red** until one `npm run evals -- --record`. The `risk` suite needs no model and is fully measured above. **And nothing got easier:** `verify:sprint35r` reads all **27 tolerances from the suite sources** and fails if any one grew against the baseline. None did. `verify:sprint35r` **24 checks PASS**, the guard proved in both directions in eleven of them, 26 risk tests, all other verifiers green, build clean |
| 2026-09-14 | 35 | **Sprint 35, risk intelligence.** The `source: "model"` seam filled after thirty-two sprints · a classifier that structures and cannot adjudicate · **what ships: 100% sensitivity, 100% in Arabic** | *sprint 35* | ⚠️ **MIGRATION 0063 IS WAITING FOR THE PLANNING SESSION.** Applied and verified on the working database only: `risk_assessments` now **16 columns**, two new CHECKs **both validated**, **0 unvalidated constraints anywhere**, ledger **64**. Production is at 63. Purely additive: three columns on one table, no existing column touched, so the running deployment survives the gap (H16). **35.1 — the classifier structures, and there is no level in its schema to fill in.** It returns indicators (ideation, intent, plan, means, timeframe, previous attempt, self-harm, homicidal ideation, psychosis, abuse, protective factor) each with the sentence that produced it, and `levelFor` — pure, deterministic, 16 unit tests — turns those into the level. A finding at confidence 0.01 counts exactly as much as one at 0.99, asserted, because a level computed from a confidence is a level a model decided. 🔴 **No quote, no finding:** a finding whose quote is not in the transcript is **dropped** and counted, and the count is a column, because a dropped finding is invisible by construction. **35.2 — the floor holds.** The phrase list is scanned first, before the model is called, and its level is a minimum the model can only raise. A classifier outage leaves exactly the behaviour sprint 32 shipped, proved by handing the ladder an empty classification beside a keyword hit. **🔴 C170 enforced by the import graph.** The classifier takes a transcript and can reach nothing else: `verify:sprint35` walks its imports transitively and proves the walk is not blind by planting a helper that reaches `lib/data/facts.ts` two hops away. Prior risk history goes to the **clinician**, beside the alert, from a module the classifier does not import — with a line on the screen saying so. **The numbers, three takes each.** Model alone: sensitivity **94.1%**, specificity **100%**. What ships: sensitivity **100%** (English 100%, Arabic 100%) against the **88.2%** floor it had to beat. Findings dropped for an untraceable quote: **0.0%**. The two cases the phrase list could never reach — letters left in a drawer, and *لا يوجد سبب يجعلني أكمل* — are both found. 🔴 **C171 is the honest half:** specificity is **unchanged at 76.9%**, and all three false alarms are now the floor's. The model refuses every one of them correctly. The trade is deliberate (a model that can veto an alert is a model adjudicating risk) but the number says what the floor costs, and points the fix at the list rather than at the ruling. **The eval found the ladder's own bug.** It returned `none` for *"I have written letters and put them in the drawer"* because no ideation was stated, which is the exact case 35 exists for. A plan or an intent now alerts on its own. **C172:** a one-take run failed `grounding.contradiction` by 0.20 against a 0.19 band, inside its own recorded spread of 0.400. Widening is forbidden, re-recording is laundering, passing is a lie — so the baseline now records each metric's `spread`, a red line inside it prints **WORSE?** with "re-run with --repeat 3", and **the exit code stays 1**. **Also:** the pin ratchet caught this sprint's own new module at 86, and the answer was to route it rather than raise the number — `regionOfPatient` first, the organisation only when a join-link session has no patient (C154). Pins unchanged at **85**. `verify:sprint35` **21 checks PASS**, 16 new ladder tests, all other verifiers green, build clean |
| 2026-09-14 | 34 | **Sprint 34, the note reads the record.** One line of plan, five rulings, and a number that says the obvious implementation would have been worse than no evidence layer | *sprint 34* | **No migration.** Nothing is waiting for the planning session. 🔴 **The first grounded run made everything worse, and that is the whole point of having built 32 first.** Pointing `notes.ts` at the evidence layer, with a careful prompt, measured: unsupported claims **0.0% → 10.0%** (a true prior fact of "episodes on public transport" licensed the model to write *panic disorder*), another patient's facts repeated **10%**, and — the one that matters — when a prior fact contradicted the transcript the note followed **the prior fact**, in five cases out of five. Nobody reading those notes would have spotted it; they read beautifully. **C170 is the finding.** Over five cases and three runs the transcript-beats-the-record rule scored **6.7%**, with the instruction stated twice including as the overriding rule above the schema. A model handed two accounts of one patient does not weigh them, it blends them. So the domains a session re-measures — `presentation`, `function`, `risk` — are **not sent at all**: a stored value for sleep, work or ideation is a rival account, not background. That moved the metric to **80%**, and the honest reading is that most of the gain is the situation not arising: four of the five contradictions are never sent, and the one still sent (`social`) is followed about half the time. That residual is the real measure of the model's arbitration and it is recorded rather than rounded away. **C167:** an unverified model guess never enters another model's context, or the layer launders its own output into a fact by repetition. **C168:** no diagnoses are sent, because every leak measured this sprint was diagnosis-shaped and a label is the highest-consequence, easiest-to-restate thing in a record. **C169:** a note written in English was reported as `es`, which would have rendered wrong and triggered a pointless English-to-English translation; the model's claim is now checked against the script it wrote in, with the same-script residual left visible in the baseline at 86.7%. **C166 answers the founder's question.** Nothing marked a fact stale: currency was display-only, so a two-year-old remark still sorted above last week's discharge summary. Currency now gates the ladder — any current fact outranks any stale one — with the cost named and bounded by a diagnosis never expiring. **Where it landed, measured over three takes each:** grounded unsupported **1.1%** against 18 planted terms, another patient's facts repeated **6.7%**, contradiction **80%**, stated facts kept **66.7%** against **74.7%** ungrounded. Grounding still costs fact coverage and that is in the baseline rather than in a footnote. ⚠️ **Four metrics now report themselves noisier than their own tolerance** (`notes.language`, `grounding.coverage`, `grounding.leak`, `grounding.contradiction`). C160 says the fix is more cases rather than a wider band, and the case set has already been widened twice this sprint. **The next widening is sprint-sized** — fifteen sessions, not five — and it is named here rather than absorbed. `verify:sprint34` **13 checks PASS** (proving the filters on the RENDERED BLOCK, C156, not on the filter function), 24 pure tests, all other verifiers green, build clean |
| 2026-09-13 | 33 | **Sprint 33, the clinical evidence layer.** Not a key-value table, a fact with a history · every fact traceable to the sentence that produced it · a clinician can disagree in place | *sprint 33* | ⚠️ **MIGRATION 0062 IS WAITING FOR THE PLANNING SESSION.** Applied and verified on the working database only: **26 columns, 11 CHECKs all validated, 0 unvalidated, 5 triggers, ledger 63**. Production is at 62 and this session cannot reach it. `patient_clinical_facts` is additive and touches no existing table, so the running deployment survives the gap (H16). **33.1 — the rules are in the database, not in a service module.** The evidence quote is `NOT NULL` and non-blank, which makes "the model inferred it from the mood of the session" structurally impossible in the way `person_diagnoses.source_sentence` made it impossible for diagnoses (8.9). `source_priority` is CHECKed against `source_type`, so an extraction job cannot write an `ai` row carrying a clinician's rank — the attack a code review cannot see, because the row looks like a clinician's. Value, quote, domain, field and person are immutable after insert: disagreeing is a status change and a superseding row, never an edit under a fact somebody has already read. **33.2 — an AI fact cannot be inserted already verified.** A CHECK cannot say it, because verifying later is exactly what the evidence screen is for, so it is a trigger on the INSERT. A model at 0.97 has produced a well-phrased guess, and the confidence number never appears on screen without the word *unverified* beside it. A lower-ranked source may not supersede a higher one, at any confidence. **33.3 — age is measured from `effective_at`, when the fact was TRUE.** A session in November describing last spring produces a fact that is eight months old the moment it is written, and ageing from the row's own timestamp would show it as today's news. Half-lives are per domain: risk 30 days, medication 90, presentation 60, and a **diagnosis never expires**, because the clinician who has not seen this patient for a year is the one who most needs it on the chart. **33.4 — both rows are kept.** Superseding retires the old row to `historical` and `contestedFields` returns the winner **with what it contradicts**, because "session 17 says he stopped and session 4 says 20mg" is clinical information, and a panel that silently showed one would be making a judgement it is not qualified to make. **33.5 — deleting a source leaves nothing standing on it.** The evidence pointers are typed FKs with `ON DELETE SET NULL` rather than a polymorphic string, so deleting a document nulls the pointer and a trigger marks the fact `unsupported` **in the same statement**. A text pointer would have needed a sweeper, and a sweeper that has not run yet is a fact standing on nothing. The row is kept: "we believed this, because of this sentence, until it was deleted" is what a clinician needs a year later. **33.6 — the evidence screen**, where the quote is the interface rather than a disclosure, and a transcript fact shows the **lines either side**, because one sentence out of a session supports almost anything. 🔴 **C164: I deviated from the plan's source order and the paragraph says why.** 33.1 lists AI above the patient; this ships patient above AI. The commonest conflict here is a person saying "I stopped in June" against an inference from May, and the model is the only source with no human behind it. The cost is named (a patient's recall is worse than a document for dates, and now outranks only the model), and reversing it is one CASE expression. **C165: every refusal is paired with the write it must ALLOW** — a trigger that refuses everything satisfies half of any acceptance test, so the blank quote is refused and the quoted fact accepted, the AI supersession refused and the clinician's accepted, the edit refused and the dispute allowed. **Also:** `lib/data/facts.ts` is the first clinical module added since the seam and it is **ROUTED, not pinned** — the region comes from the person (C154), and the pin ratchet is unmoved at 85. `verify:sprint33` **24 checks PASS**, every one of them by attempting the write; 12 new pure tests for the temporal and priority rules; build clean; all other verifiers green |
| 2026-09-13 | 31/32 | **Carry-ins, before 33 starts.** The wrong-hostname check the live site needed · the founder's own Arabic sentences as cases · the failure family named in §6 | *sprint 33 branch* | **No migration.** **C162:** every canonical and hreflang on the live site named `habiba-zeta.vercel.app` because `APP_URL` in the deployment did. The code was right, the environment was wrong, and **the check was the gap**: asserting a canonical *ends with* `/ar/pricing` is true on every domain in the world. `verify:sprint31` now compares the host of every canonical, every hreflang and every sitemap URL against the host it asked, and it is proved in the literal shape of the defect, by starting the app with `APP_URL=https://habiba-zeta.vercel.app` and watching it name all four tags. 21 checks. **C163:** the founder checked sprint 32's number against his own Egyptian Arabic and found 3 of 5. The three misses were a **register**, not a phrase: cannot carry on, a burden on my family, no use in my life. Following them exposed that **perceived burdensomeness was missing from the English list too** — one of the best-attested antecedents there is, absent in both languages until the Arabic misses made somebody look. All four sentences are now cases, the list gained the concept in both languages, and the rule for this list is written down: **add the concept in both languages, never a phrase reverse-engineered from a test sentence**, because a list tuned to its fixture scores well and catches nobody. On the harder set: sensitivity **88.2%** over 17 positives, Arabic **87.5%**, specificity **76.9%** over 13 negatives. Two misses left on purpose (letters in a drawer; *لا يوجد سبب يجعلني أكمل*) because they need 35's classifier. **88.2% is the floor to beat, measured.** **C160 honoured rather than quoted:** `notes.sections` reported its own spread at 0.167 against a tolerance of 0.12, so the case set went from three sessions to **five** (a panic case in English, a postnatal case in Arabic) rather than the band going up. The warning is gone and the baseline is re-recorded at five cases. One reporting fix came out of it: a take's details are now **unioned** across runs, because an average of 1.9% unsupported claims printed beside the last run's "no planted term appeared" is a fabrication hidden by an average, which is C159's rule in reverse. **§6 now names the family**: C84, 18.8, C157, C158 and C161 listed together as one failure in five costumes, with the rule stated once — a check earns its place by failing, the offender is planted where its absence would show, and an assertion proves the value survived rather than that two derived values agree. `verify:sprint31` 21 PASS, `verify:sprint32` 15 PASS, evals 16 metrics PASS, 41 tests, 17 scorer tests |
| 2026-09-13 | 32 | **Sprint 32, the AI is measured.** 21 tests, 31 verifiers and zero AI quality measurement, until now · four suites, 16 metrics, a committed baseline that fails on a regression · the crisis scanner could not read Arabic | *sprint 32* | **No migration.** Nothing is waiting for the planning session on this sprint. 🔴 **The finding first, because it is the sprint: the crisis scanner scored 0% in Arabic.** Five sentences saying plainly that somebody wants to die; none found. English-only phrase list, every test green, nothing anywhere saying so. Fixed in the same sprint and measured before and after: **Arabic sensitivity 0% → 80%, overall 38.5% → 84.6%**, specificity unchanged at 72.7% with a different composition (the bare word "hopeless" stopped flagging "I am hopeless at keeping a diary"; Arabic "إيذاء نفسي" started flagging a past, resolved disclosure). That is C159. **The numbers, recorded from three takes each:** attribution error **0.0%** with 3.8% of lines refused and 2 straddles caught; unsupported claims **0.0%** against 18 planted terms; stated facts kept **84.4%**; required sections filled **90.7%**; note language correct **100%**; Arabic facts kept **93.3%**; word error rate **2.3%** with the language given and **2.8%** with it detected. **What each number is NOT.** The WER is clean synthesised studio speech, so it is a floor, not session accuracy. The cases are synthetic, because a real transcript in a repository is a clinical record in git; synthetic dialogue is cleaner than a room, so every quality figure is an upper bound and what the suite really catches is **regression**. The unsupported-claim rate counts fabrications somebody thought to plant, which is a lower bound and a narrow true number rather than a broad unauditable one. There is **no model-as-judge** anywhere: every scorer is string comparison against a fixture, and `metrics.ts` is asserted to contain no model call. **32.2 is a mechanism, not a promise.** Nine model call sites are found statically; four are measured and six are **named with a reason that says what is missing**, and the count is ratcheted like the region pins (C157) so a new unmeasured model call fails `verify:sprint32`. Proved by planting a module that calls a model and watching the scan name it, and by planting a seventh unmeasured surface and watching the ratchet fail at 7. The gate is proved in **both** directions: a move past the tolerance fails, and a move inside it does not, because a gate that fires on noise is a gate people mute. **C160:** the eval has its own noise and it is measurable. Two runs of unchanged code moved one metric 13 points, so a recording run averages three takes and prints the spread, and says out loud when a metric's spread exceeds its own tolerance. The fix for that is more cases, not a wider band, and it is written down where the next person will read it. **C161:** a test in this very sprint passed because both sides were empty. The Arabic diacritic class swallowed the letters, every Arabic string normalised to nothing, and two empty arrays are deeply equal. Caught by the crisis scanner matching every English sentence in the set, since an empty needle is `includes`-true for everything. **Also:** `noteFromTranscript`, `attributeLines` and `transcribeAudio` were lifted out of their database-bound callers so the evals exercise **the shipped prompts** rather than a copy of them; `soap.objective` was removed from the required-section set, because requiring an objective section from an audio transcript asks the model to invent observations and puts two metrics in direct opposition. `verify:sprint32` **15 checks PASS**, `npm run evals` 16 metrics PASS against the baseline, 17 new scorer tests, 41 safety tests, all other verifiers green, typecheck clean |
| 2026-09-13 | 31 | **Sprint 31, Arabic has an address.** `/ar/pricing` was a **404** · a rewrite, not a second route tree · the cookie demoted to a preference · nothing private gets a second URL | *sprint 31* | **No migration.** Nothing is waiting for the planning session on this sprint. **31.1 — the defect was invisible to every check in the repository.** The Arabic pages existed and rendered well (2,335 Arabic characters against 314 Latin on pricing); the language lived in a cookie, so there was no URL to link, share in a WhatsApp group or index, in the market this product is built for. Source scans, dictionary checks and `render:check` all passed, because every one of them reads something other than a status code. `verify:sprint31` is therefore made of **HTTP**: it asks the server what a stranger's browser asks and asserts on the response. **The shape:** the prefix is stripped in the middleware and handed to the render on a request header, so no route in the app learned about languages and `lib/routing.ts` still decides on the path it always decided on. An `app/[locale]/` tree would have been ten more files whose job is to be identical, and the first divergence between them a page that is correct in one language only. English stays unprefixed so every existing link keeps working, with `x-default` pointing at it. **The cookie is still the preference** (C103), and the URL beats it, because a shared link has to open in the language it was shared in. 🔴 **Two proofs as negatives, and one of them was wrong first.** The forged header: `x-locale: ar` sent to `/pricing` must not change the page, and with the middleware's `delete` removed it did, 2,335 Arabic characters at the URL that declares itself canonical English. The private path: `/ar/patient/journal` must not be a second address for somebody's record — and that check **passed with the guard removed**, because a signed-out request is bounced to `/patient/login` either way. It was measuring the login wall. `/patient/invite/<token>` is the one private route that serves to a stranger, and under the planted build it returned **200** at a prefixed address. That is C158, and it is the sprint's real finding. **Also shipped:** `hreflang` declared once in the public layout so a new marketing page is correct the day it is added rather than the day somebody notices; the sitemap lists both languages through the **same function** the pages use; the chrome carries the prefix through every link, because a prefix that does not survive a click only ever worked for the first page; `/en/*` redirects to the unprefixed page; the switcher navigates to the counterpart URL and takes the server's path rather than the router's, since a rewrite hides the prefix from `usePathname()`. `verify:sprint31` **19 checks PASS**, 10 new pure tests, `test:routing` 14, typecheck clean, build clean, `verify:sprint30` still 19 with the pin ratchet unmoved at 85 |
| 2026-09-12 | 30 | **Sprint 30, the region seam.** No bare database anywhere · a chart routes on the patient, not the practice · Egypt pointed at the US instance and saying so | *sprint 30* | **Migration 0061 applied and verified against `information_schema`**: `region` on `organizations` and `people` (`NOT NULL DEFAULT 'us'`, which records where rows **already are** rather than backfilling a guess), `cross_border_consents` (8 columns), four validated CHECKs, **0 unvalidated CHECKs**, ledger **62** on the working database. ⚠️ **Production is at 61 and this session cannot reach it**: 0061 must be applied there before `main` moves. **30.1 / C118 — the seam is the type system, not a convention.** `lib/db` exports **no database at all** any more; there are two ways to Postgres and both name a plane: `dbFor(region)` for somebody's data, `controlDb` for facts about the product. Removing the export was the lever the founder named: the compiler produced **442 errors across 108 files**, every one of them a call site that had to declare which plane it was on. 🔴 Proved as a negative, the only way a negative can be: a planted module importing the old bare `db` is written to disk, `tsc` is run, and the check passes only when it **fails to compile**. A second scan proves no module outside `lib/db` builds its own pool, because a seam with a `new Pool()` beside it is not a seam (C153, one sprint old). **The counts, honestly:** 9 modules declared control plane, 22 operator scripts declared their region, **4 clinical modules genuinely routed on the entity** (journals, summaries, patient-view, and the session-list read), and **85 call sites across 82 files pinned** with `pinnedToDefaultRegion(where, reason)` — which registers each one so `verify:sprint30` **prints the list** and the number appears here. 🔴 **This row first said 47, and 47 was wrong.** `regionPins()` was a runtime registry counting the modules one execution imported rather than the pins in the source; the founder counted the files by hand and got 86 including the definition. The count is now static and ratcheted (C157), and the figure here is the measured one: `lib` 49, `app` 35, `scripts` 1. That is deliberate: `dbFor("us")` with a comment compiles, is indistinguishable from a decision, and would have left 47 guesses nobody could audit. The debt is a printed list rather than an archaeology exercise. 🔴 **C154 was the sprint's real finding.** Routing a chart on the practice is the obvious implementation and it puts an Egyptian patient's record in Virginia while every test passes, because an Egyptian patient of an American clinician is the ordinary case here. The verifier plants exactly that pair and asserts the chart resolves `eg` while the practice resolves `us`. **C155:** building it surfaced two facts worth having early — a caseload spanning regions is not one query (so `acrossRegions` ships now, while both regions are one database and the answer is the same either way), and a lookup keyed on a row id cannot route at all, which is why `documents.ts` stays pinned with the circularity named. **30.3:** the record of processing is a table, not a policy document, and it stores the **wording** rather than a version number, because a pointer at editable text proves nothing a year later. The database refuses a consent row whose two regions are the same, so a page cannot manufacture agreement to a transfer that is not happening. **30.4 / C156:** Egypt is **not resident**, said out loud on the patient's own screen, and the check derives what the product *says* from the routing rather than comparing two strings that happen to agree. Going live is `DATABASE_URL_EG`, read once, in one function, asserted. The Arabic consent named both countries in English until a verifier caught it. ⚠️ **30.2 and 30.4 incomplete until the founder signs a provider.** `verify:sprint30` 17 checks, all 28 other verifiers green, `render:check` 15, 41 tests, build clean |
| 2026-09-12 | 29 | **Sprint 29, identity documents behind a route.** A passport stops depending on an unguessable URL · a colleague is refused · the label that was lying | *sprint 29* | **No migration**, so production stays at ledger 61. **29.1 / H14 / C151:** `/api/uploads/[id]` mirrors `/api/documents/[id]` down to the order of its three questions, because the two routes protect the same class of thing and the day they diverge is the day one is weaker for no reason anybody decided. The reference in a page is `<verificationId>.<kind>` and carries no secret; the stored URL never leaves the server. 🔴 **The check that matters is the refusal, and it is attempted rather than read:** a planted clinician in the **same organisation**, signed in with a valid session, is refused the passport of a colleague. Before this sprint the only thing between them and it was not knowing the URL. A super admin may, because reviewing these is the verification process; nobody else, which means organisation membership is explicitly the wrong boundary for identity material, the same line 20.9 draws in the other direction. The audit row names **which document and whose**, and the ordering is asserted on the source: `audit` before `fetch`, because a read that streams and then fails to log is a read nobody can prove happened. **C153 found on the way through:** the development-only local-disk route required only a session, so any clinician on such a deployment could walk a path to any other clinician's passport. It now calls the same decision module, and development-only is not a defence, because that is the hole that gets copied into the real thing. **C152:** the admin queue labelled the verification headshot "(public)". The public picture is a different column entirely, and a reviewer told a document is public handles it more casually than the passport next to it. **C148 given a mechanism:** `npm run ship:content -- <sprints>` reseeds and re-runs the named verifiers in one command that cannot be half-done, the single script here that does not call `writesTo()`, because production is the entire point of it. ⚠️ **This session cannot reach production**, which is precisely how sprint 28's reseed went to the wrong database; the command exists so the person who can runs one thing rather than two. `verify:sprint29` 13 checks, sprints 24 to 28 still green, 41 tests, build clean |
| 2026-09-11 | 28 | **Sprint 28, the site talks to patients honestly.** Two claims made unpublishable · the patient page repositioned around the record they own · pages that say what is not built | *sprint 28* | **No migration.** Opened by answering the handover: **C147**, the production guard and the missing-fixture message moved into `scripts/_verify.ts`, which is what a new verifier already imports, and were applied to all **fifteen** writing verifiers rather than the three that had been noticed. `writesTo()` is proved against the production endpoint **by name**; `required()` is proved in a subprocess, exit 1 with an operator message and no stack trace. **28.2 / 28.3 / C109 / C110:** the two claims this product may not make are now a module, enforced in two places — `savePage` **refuses to publish** one, with a message naming the sentence and saying what the true version is (netting, not "sessions cover our fee"), and the verifier scans the **published rows** because C148 is the reminder that the code being right has never been the same thing as the database serving the right thing. 🔴 The scanner is proved three ways: it catches the false fee claim, it catches an earnings promise, **and it leaves four legitimate sentences about money alone** — "your earnings page", "comes out of what you earn", "get booked" — because a checker that flags those is a checker somebody deletes within a month. **28.1 / 28.4:** the patient page is rebuilt around portability and the record they own, in both languages, and says in so many words that **you never talk to the AI** — asserted in Arabic against the Arabic sentence rather than a string match, and backed by 24.2's import guard rather than by its own paragraph, because a marketing claim whose guard was quietly deleted is worse than no claim. **28.5 / C149:** `/integrations`, `/integrations/[slug]`, `/for-clinics`, `/developers` and `/verify/[code]` ship as **code routes, not CMS rows**, because each carries a claim about what exists and an editor who could unpublish "there is no API yet" would leave us with no page saying it. Two integrations are marked **not built** and say "nothing works today" in their own prose, asserted on the data so a later editor cannot soften one quietly; every entry, including the working ones, carries what it does **not** do. `/developers` refuses to document internal routes that take a session cookie and are not versioned. **28.6:** the five demos the sprint names all show features from sprints 36, 41, 42 and 43, so what shipped is the two screens sprint 26 **did** build, as live components: the versioned summary with two clinicians' names on it, which is the portability argument shown rather than asserted, and the journal — which draws **no shield and no reassurance**, because C123 governs the picture of that screen as much as the screen. 🔴 **C150 found on the way through:** every Arabic page was rendering an English therapy session inside its demo panels, and could not have done otherwise, because `getDemoContent()` asked the runtime for a locale and `getLocale()` throws synchronously outside a request. The locale is a parameter now, like the zone (C84) and the currency locale (19.4), and there is an Arabic floor written as Arabic. **The Arabic patient page now renders with no English passage left in it**; the 37 that remain are the home page's SOAP note, which stays on 22R.10 because writing a clinical note in Arabic is writing. **C148 obeyed:** content reseeded to production before the report, 14 pages across both languages, and every verifier re-run against the reseeded rows. `verify:sprint28` 21 checks, `render:check` 15 (1 deferred), sprints 24 to 27 still green, 41 tests, build clean |
| 2026-09-11 | 27 | **Sprint 27, portability.** The pitch finally has a mechanism · a grant the database will not let an unverified clinician hold · asking backwards, with the answer guaranteed | *sprint 27* | **Migration 0060 applied to production before the push (H16)**: a trigger on `history_grants`, `patient_invites` (10 columns, two validated CHECKs, a unique code index) and `history_asks` (two validated CHECKs and a partial unique index). Verified against `pg_trigger` and `pg_constraint`; **zero unvalidated CHECKs on the database**. **27.1 / C106 / C144:** a grant cannot be *held* by a clinician whose verification is not approved, enforced by a trigger, and the verifier attempts it twice — on the insert, and on the UPDATE that flips a months-old pending row, which is the case that actually happens and the one no function-level check would ever be asked about. `pending` is deliberately allowed, because 27.3 needs a patient to be able to invite somebody mid-verification. That forced a better change downstream: `decideGrant` catches the refusal and **tells the patient why their tap did nothing** (C131), since a person who approved into silence would reasonably conclude the product is broken. **27.2 / C102b / C145:** the patient mints a six-character code and reads it across a desk. Redeeming it returns a **first name and nothing else**, creates a **pending request**, and never access — asserted by redeeming one and reading the row that appears. A code is single use (a conditional UPDATE, so two clinicians racing cannot both win), expires in thirty days, at most three live at once, and the patient sees **who used it**, so a code handed to the wrong person is visible rather than silent. 🔴 The copy is checked as copy: "send your record" may not appear on the invite screen, and "get my history" may not appear on the ask screen, because both rulings are about words. **27.4 / C107:** there is no clinician path that ends in access, which is the shape of the flow rather than a warning printed on it. **27.5:** already built in sprint 7, and now asserted properly (C146): scanning for the word "reason" was wrong, because declining a *request* legitimately carries one, so the check follows the revoke **signatures** instead and proves the path has nowhere to put one. **27.6:** the patient is told on every grant, from the single place a grant is decided, over their own handle rather than `notifications` (which hangs off `users` and has no room for somebody who is not in an organisation, C41). **27.7 / C108:** "ask", never "get". The ask is a row, the clinician sees it in a queue at `/connect`, and a **decline carries a reason the patient reads** — refused by the action and, underneath it, by the database, attempted both ways. A patient can only ask a clinician they have actually seen, drawn from their own sessions rather than typed, so this cannot become a way to message anybody on the platform. **27.8** confirmed unchanged. `verify:sprint27` 20 checks, 41 tests, build clean |
| 2026-09-11 | 26 | **Sprint 26, the record the patient owns.** A summary the database will not let anybody rewrite · one approval instead of three · journals instead of filing · an extract that says what it is not | *sprint 26* | **Migration 0059 applied to production before the push (H16)**, additive: `clinical_summaries` (13 columns, a unique index on `(person_id, version)`, two validated CHECKs and a trigger), `journals` (three validated CHECKs), and two columns on `data_exports`. **26.1 / C111 / C141:** the summary hangs off the **person**, not a clinic's file, and is append only — enforced by a `BEFORE UPDATE OR DELETE` trigger, because a CHECK constrains rows and this is a rule about statements. The verifier attempts both an UPDATE and a DELETE and is refused by name. That one decision pays for **26.2** outright: revoking a clinician cannot retract a version because *nothing* can. The author is snapshotted by name and licence as well as by id, so a clinician leaving does not turn a patient's record into a document by "unknown". **26.3 / C112:** one screen, three items, one button, and **everything defaults to off** — the two checkboxes start unticked and the summary box starts empty, so a clinician who opens the panel and closes the tab has published exactly nothing. Underneath they stay three writes with three audit entries, because signing a chart, releasing text to somebody's phone and writing into a record they own are three different acts; collapsing the log to simplify the screen would make the log worse. `NoteReview` lost its own approve buttons: two approval surfaces for one document is the fatigue the ruling is about. **26.4:** a summary in clinical register is refused before it can be published, by the shapes of clinical writing ("patient presents", "differential", "rule out") rather than a list of disorders, which no list would catch. **26.5:** the patient upload and dictate-your-history actions are **deleted, not hidden** — a server action nobody renders is still a function somebody re-wires. What replaced them asks a different question: not "give us your history" but "how was your week". **26.7 / C123:** a journal is scanned by the same scanner a transcript is, and the clinicians holding a live grant are told, and 🔴 **the page never says or implies anybody is watching.** That is asserted by scanning the screen for the sentences it must not contain, with a planted reassurance as the control, and it is expressed in the type: `writeJournal` returns an id and nothing a screen could render as "we noticed something". The notification does not quote the entry, because a crisis alert is read on a lock screen. **26.9 / C127 / C143:** the extract is rebuilt person-wide (somebody who changed practice gets their whole record, not half), carries the summary versions, the journals, the homework and the diagnoses with the sentence each came from, stamps every note with the licence of whoever signed it, and opens with **what this is** and **what this is not**. The words "certified" and "proof of diagnosis" are scanned for in the **rendered document**, not the source, because the source is allowed to name them and the cover page is not. `/verify` answers a third party with counts and a date and nothing else; an unknown code and a real one that is not yours look identical. **26.10 / C128:** email only, enforced by passing `phone: null` so the WhatsApp fallback *cannot* fire rather than by a branch that could be edited; with no address the **button itself** says "Add an email to get your record" before it is pressed; every export raises an admin alert naming nothing clinical. 🔴 **C140 was the sprint's second structural finding**: the crisis scanner had to be on the patient's own write path and was behind 24.2's wall, so it moved out of `lib/ai/` for the same reason `descriptors.ts` did, and the forward rule is written down now rather than in sprint 35: when risk gets a model, the model runs from a background job reading the row, never inside a request somebody is waiting on at 3am. ⚠️ **Incomplete until sprint 33:** 26.6's clickable journal citation (C142). `verify:sprint26` 27 checks, `verify:sprint25` 29, `verify:sprint24` 8, 41 tests, build clean |
| 2026-09-11 | 25 | **Sprint 25, the patient app as an app.** A home screen instead of a site map · the chrome follows a patient into the radar and into a live session · a photo that is not a public object · a wall code that carries one clinician and nothing else · the invite goes with the session | *sprint 25* | **Migrations 0057 and 0058 applied to production before the push (H16)**, both additive and nothing backfilled: `people.avatar_url` / `avatar_updated_at`, and `therapist_codes` (9 columns, a unique index on the code, and `therapist_codes_shape` **validated**). Verified against `information_schema` rather than the "Migrations applied" line. **25.1** replaced five stacked cards with a home screen: a face, one search box, the globe, what is waiting on you, the next step, categories, a rated rail, then sessions. 🔴 **Every number on it is a fact (C138):** a category tile appears only where a verified clinician has listed it, with the real count; the rail uses the product's own five-rating bar, so today it renders **nothing at all**, which looks unfinished and is honest. Search runs over what somebody actually types, what is wrong and which language, and deliberately **not over names** — a directory of real people paged by name is a scraping surface. **25.2/25.3/25.4** the chrome moved out of the `(patient)` layout and into a component, because the two screens a patient must never fall out of are not in that route group: the radar, which is public and cacheable, and the live session at `/join/[token]`, which works before anybody signs in. During a session the bar stays, a Session tab is **locked active**, and every other destination asks first — a question asked in the component rather than by `beforeunload`, which a client-side route change never fires. `/t/:id` and `/patient/t/:id` are one body component, so the reliability and price rules cannot drift between them. **25.7 / C115 / C139:** name and photo are the patient's. The stored path is an internal handle **no page may emit**, proved by a scan; the only reader is `/api/patient/avatar/:personId`, which carries no secret, asks on every request, proxies the bytes rather than redirecting (a redirect republishes the storage URL) and answers a stranger with 404 rather than 403. Editing the name is safe **only because C114 is closed**, and `verify:sprint25` still performs that attack. **25.17 / C120:** the wall code carries one clinician. That is asserted as a fact about the **table** — no patient or person column exists — rather than about the function that mints them today; the eight-character shape is a database CHECK, proved by attempting `aO0I1xyz` and being refused by name; a revoked code reads as **retired rather than broken**, because the person reading it is standing in front of the poster. **25.18:** the number is asked beside the name on the one screen where the clinician is looking at the person, and the invite that hands over the record goes **with the session** instead of from a page nobody visits twice. 🔴 **The sprint's real finding was C137**: bringing the radar inside the app made 24.2's guard fire on a five-hop path into `lib/ai/`. Nothing leaked — both modules were arithmetic — and the fix was not an allowlist: `lib/ai/` now means "this talks to a model", `descriptors.ts` moved to `lib/transcript/`, and the transcript writer moved out of `lib/data/sessions.ts`, which had been doing booking (a patient reaches it) and risk alerting (only a clinician's session does) in one file. ⚠️ **Incomplete until 26.1:** 25.10, the clinical summary tab, deliberately not stubbed. **25.13 / C130:** the prompt a guest meets after a session no longer implies anything would be lost. The verifier scans for the **lie** rather than the truth, because the true sentence can be worded a hundred ways and "create an account to save your notes" has a shape. `verify:sprint25` 29 checks, `verify:sprint24` 8, 41 tests, build clean |
| 2026-09-09 | 24 | **Sprint 24, content law.** No dash a machine would write · patients structurally cannot reach a model · the settings page rebuilt · the legal pages given a short version | *sprint 24* | **24.1**: 484 em and en dashes removed from real copy across 142 files, and the rule is enforceable rather than remembered. The scan strips comments first, because comments are for developers and may name the character; what is left of a TypeScript file is code plus copy, and a dash has no syntactic use in TypeScript. Three files are allowed **by name**, never by pattern. Proved twice: a planted offender in a copy module is caught, and a dash inside a comment is **not** reported, because without that half the rule is one people delete rather than obey. The rewrite was mechanical and not blind, an independent clause after a dash becomes its own sentence (a comma there is a splice, which is worse writing than the dash was), Arabic strings take the Arabic comma, and every public-copy file was then read by eye. 🔴 **It found a live regression as it went**: sprint 18's testimonial detector held a real em dash inside its character class, so the rewrite silently narrowed a rule about fabricated patient quotes. Detectors that must recognise the character now build it from its code point. **24.2** makes C113 structural: nothing under `app/(patient)` may reach `lib/ai`, and the walk is **transitive**, because the way this rule dies is not a patient page importing a model, it is a patient page importing a helper that grows a model call six sprints later. The control is planted **two hops away**. **24.3**: `patient-copilot.ts` is `case-copilot.ts`. **24.4**: the settings page was six equal cards in a column, one added per sprint since sprint 2, with no headings; it is five titled sections now, each with a line saying what it is *for*, ordered by why somebody opens the page, with a jump list at the top and the **verification state on it at last** — "am I approved?" was a question only answerable on the onboarding page a verified clinician never sees again. **24.5**: privacy and security open with a three-point summary a reader can act on before the wall of text, and all four legal pages open with an Arabic paragraph saying the binding text is English and offering a person who will explain it (C136). **24.6**: the copy pass is the dash rewrite plus those blocks, republished to production, live and staging, both languages. `verify:sprint24` 8 checks |
| 2026-09-09 | 22R | **Sprint 22R — the walkthrough. Seven defects nothing else could have found.** Every account made through the real forms, on the purged database, at a phone-sized viewport | *sprint 22R* | The whole clinical arc walked as a person: therapist signs up → submits verification → **admin approves** → adds a patient → issues an invite → **patient signs up, claims the record** → session → transcript → note → patient summary → the first-session-free invoice. 50 routes swept across four roles, screenshots in `docs/walkthrough/`, every one reachable and none broken. **🔴 Seven defects, and not one was visible to a verifier** — in every case the row was right, the query was right, the import graph was right, and the screen was wrong: (1) the middleware never let an anonymous person see `/patient/invite/<token>`, so the link a therapist hands over showed a sign-in form for an account they do not have; (2) `patientSignUp` dropped the invite token the form carries, landing them in the matching route, which asks for a code by email or WhatsApp — **a dead end**, since most patients here have no email and WhatsApp waits on Meta; (3) the claim screen offered the patient **their own** record back; (4) claiming succeeded and the success card was replaced within the second by *"this link is no longer valid"*, because a single-use token stops resolving the moment it is used; (5) 🔴 **the claim never moved the account onto the record**, so a patient who had just taken ownership was told their record was empty while their session and note sat in it (C99); (6) the file count was a correlated subquery returning 0 against a record with one file; (7) two patients with one phone number, no warning (C101, ruled open). **What the product got right, and it is worth recording:** the session room says plainly *"No microphone access, so nothing is being transcribed"*; an empty session **refuses to invent a note** — *"the note could not be written… try again"*; the claim screen asks the §3 step 7 consent question in the plainest English on the site and defaults it off. **22R.9's list of what was HARD is `docs/walkthrough/FINDINGS.md`** — the verification form showing empty fields after a successful save, no way to tell which document you already uploaded, *"try again shortly"* with no number (fixed: the limiter knew the minutes and threw them away), the patient's summary approval hidden behind a tab nobody prompts you to press, and a SOAP note quietly rendering three of four letters (fixed: a missing section now says so). ⚠️ **Not walked, and named rather than implied:** the second therapist and revocation (22R.3), documents and the copilot (22R.4), payouts, bundles and the upgrade-then-downgrade case (22R.6 — Stripe is not configured on this deployment), a manager and a staff member as themselves (22R.7), and C97's check-ins, which are not built |
| 2026-09-09 | 22 | **Sprint 22 — the purge, and the two defects it found.** 62 tables emptied · admin and settings re-seeded · content back from defaults in both languages · every CHECK validated | *sprint 22* | **The purge ran against production**: 62 tables truncated (47 users, 66 patients, 66 people, 69 sessions, 972 audit rows), the migration ledger deliberately untouched, then settings, the super admin and the CMS re-seeded from the repository. What came back: **1 user, 1 organisation, 14 content pages across `en` and `ar`, everything else zero, ledger 55**. 🔴 **The seed itself was broken and nobody knew**: `ON CONFLICT (slug)` against `content_pages`, whose unique index has been `(slug, locale)` since sprint 19 — Postgres refuses a conflict target it has no constraint for, so `db:setup` and `reset.ts` had failed at the step that stands the site back up **since sprint 19**, and only running the purge found it. It seeded English only, too, so a purged database would have come back monolingual with 19.1 red on a database nobody had edited. 🔴 **And the second lesson of C93, one table over:** three verifiers borrowed fixtures instead of planting them — sprint 16 took "the first organisation and three users" and stopped at its first line, checking none of its 31 things; sprint 14 wanted two clinicians; 18.11's control and C17 measured whatever rows happened to exist, and C17 in particular was a *measurement* (the figures the founder correctly said would not reproduce) rather than a proof. All four now plant what they need and remove it: C17 writes three calls costing 0.4¢, 0.3¢ and 0.25¢ — the exact sub-cent case that made the old column record zero — and asserts the vault reports 1¢ where `cost_cents` reports 0. Sprint 1's "all four groups" was an equality against a list sprint 16 had legitimately grown; it asks for presence now. **22.9 — migration 0054 applied to production**: all **fifteen** `NOT VALID` CHECKs validated, not the five 22.9 names, because the argument does not stop at 0042 and a launch that validates a third of the rules leaves the same question open about the other two thirds; `sessions.feedback_token` is `NOT NULL` rather than a CHECK standing in for a column type. `verify-migrations.ts` now asserts **zero** unvalidated CHECKs, so the next one added and left that way is caught. The `NOT NULL` immediately found two inserts that never minted a token — the seeded demo session (a dead feedback link) and a verifier fixture. **Every verifier passes on the empty database**: 24 of them, 1 deferred, plus the render check. ⚠️ **Not done in this sprint, and not mine to do:** 22.2 key rotation, 22.3 the Resend domain, 22.4 Meta's template approval, 22.5 the deploy decision, 22.6 Stripe out of test mode, 22.8 legal review — each needs a person with a dashboard. 22.8b (republish after the deploy) is **already satisfied for the current deployment**, which carries sprint 17's renderer; the live site will pick the content up within five minutes of the next deploy (C92) |
| 2026-09-09 | 21R | **Sprint 21R — the loose ends a person found.** Three doors · a patient who can get back in · the live page, not the row · the hero icon · Arabic that is actually Arabic | *sprint 21R* | **Migration 0053 applied to production before the push (H16)**, additive: `patient_auth_tokens` (9 cols, four CHECKs), verified against `information_schema`, ledger **54**, 0 rows. **C94 — there was no patient password reset.** Not a broken one: none. `auth_tokens` hangs off `users`, so a person who signed up at `/patient/signup` and forgot their password had no route back to their notes, their homework or the list of who can read their record; it survived eight sprints because every check we had asserted about therapists. The code goes over **WhatsApp**, because most patients in this database have no email at all (§3b, C43), and the guess budget is a CHECK — `attempts <= 5` — proved by writing 6 straight to the table and being refused by name. The verifier **recovers the issued code by exhausting the six-digit space**, so what `notify()` carried is provably what `completePatientReset` accepts, and the token is spent once. ⚠️ **Incomplete until Meta approves `password_reset_code`** (an authentication template, the stricter track): until then nothing arrives, and the page says that in those words with the way to reach a person beside it. The back office got its own door at `/staff/sign-in` — same action, same lockout, same timing-equal failure — **not linked from the public site** (asserted, with a planted link as the control), and the role check runs **after** the password is verified, because before it the form would tell a stranger which addresses are admins. `/patient/forgot-password` is in `PATIENT_AUTH_ROUTES`, which is not a detail: a person who cannot sign in has no cookie, so a reset route missing from that list is bounced to the page they cannot use. **C92 — the live pricing page was wrong and the database was right.** `content_pages` held the corrected page and `verify:sprint17` passed on it, while `24t.vercel.app/pricing` served a copy from before the sprint 17 rewrite: prices in prose, no cards, and *"a direct charge into your own Stripe account — we never hold it"*, which §3c reversed on 6 September. The defect was the **delivery**: `unstable_cache(..., { revalidate: false })`, an entry only a click in the editor, a script holding `CRON_SECRET` or a `CACHE_VERSION` bump could retire. Staleness is **bounded** now — five minutes, twelve database reads an hour, against a public page misstating where somebody's money sits for two days — and `npm run check:live` is the first check in this repository that reads the **product** rather than the database. It reproduces the founder's finding exactly: two pricing pages wrong, eight pages fine. ⚠️ **Incomplete until main deploys** — in `verify:sprint21r` the live checks are deferred on *the deployment carrying this build* (`GET /api/revalidate` reports the running cache version), never on their own result. **C93 — deferrable by construction.** Published content now reaches a verifier only through `withPublishedContent`, whose body does not run when the content is absent, so a content check cannot be written outside a deferral: the rows are not in scope out there. 17, 18, 18R and 19 converted; a scan proves no verifier queries `content_pages` by hand, with a planted offender of exactly the shape 18R shipped as its control. One check was passing **vacuously** rather than failing — 18.8, "every demo named in content is one the renderer can draw", is trivially true when no content names a demo. **C95** — the hero icon sat alone in a block between the eyebrow and the heading; it shares a row with whichever of them is present, proved by rendering the component and reading where the icon sits, with the arrangement that shipped as the control. **21R.8, the content pass — the finding was bigger than the copy:** the Arabic pricing page rendered **entirely in English**. C72 asserted that an Arabic *row* exists, and passed; the row's only block is `pricing`, and the component drawing it had every word typed in. Same for the contact form, the crisis buttons, the companies labels and the radar hero's chrome — including *"Not an emergency service"*, the line on that page that most needs reading. ~110 strings moved into the dictionary in both languages, written as Arabic rather than rendered from the English, and the render check now asserts a regression list on the Arabic pages with the English page as its control. **🔴 C98 found on the way through:** `988` — the US lifeline — was printed to every reader on six surfaces including the patient's in-session notice, with a test pinning it in place. Ruled and fixed: a number appears only where it is verified. ⚠️ **Incomplete until 22R.10:** 42 English passages remain on the Arabic pages, all inside the demo panels, because their fixtures are an English transcript and an English SOAP note — writing those in Arabic is writing, not translating. The skip names it. 41 tests, 21 verifiers pass (`verify:sprint21r` 25 checks, 1 deferred; `render:check` 15, 1 deferred), build clean |
| 2026-09-09 | 21.x | **Sprint 21 complete.** Every string is data · a language is a row · machine translation drafts and a person publishes · completeness gates the launch, not the life | *sprint 21* | **Migrations 0051 and 0052 applied to production before the push (H16)**, additive: `locales` (9 cols), `ui_strings` (8, PK on `(key, locale)`), and one nullable column on `audit_log`. Verified on production against `information_schema`: both tables, ten CHECKs, ledger **53**, 0 rows. `verify-sprint21.ts` runs 18 checks, every refusal attempted: an **empty override** refused by the code *and* by `ui_strings_not_blank`, because 21.5's rule is that clearing an override restores the shipped wording and never blanks a button — proved by reading the string back through the accessor before, during and after; a language **published at 0%** refused with the count in the message; a **machine draft counted as missing** (21.17), so a language whose completeness is made of machine output cannot go live; a machine row with **no model named** refused by the database (21.19); and a **bulk approval containing a crisis string** refused, while the same string alone is approvable by somebody who has read it (21.18). Safety strings are matched **by prefix** so a consent string added next month is protected the day it is added, not the day somebody remembers this list. 21.15 ruled: a language switched off is **served and stops being advertised** — a reader mid-visit keeps reading it, because redirecting somebody out of the page they are on is worst on the page where it matters most. **🔴 A live defect found and fixed on the way through:** `audit_log.resource_id` is a `uuid`, and callers pass natural keys — `"pricing"`, `"language:ar"`, `"common.continue:ar"`. Postgres refuses those, and because `audit()` is deliberately allowed to throw, **the whole admin action failed with it** — the taxonomy editor had been doing that since sprint 1: the row saved, the audit threw, the admin saw an error and assumed the change was lost. `audit()` now routes a value to whichever column can hold it (`resource_id` or the new `resource_key`), so ~30 call sites are unchanged and the next person to audit a non-row resource cannot reintroduce it. ⚠️ **Incomplete until 21R:** the full written content pass (21R.8) and the machine-translation run itself — `draftTranslations` is built and the model is not called in this sprint, because the strings it would translate are about to be rewritten. 337 tests / 20 suites, 20 verifiers pass, build clean |
| 2026-09-09 | 20R | **Sprint 20R — the half of sprint 20 that was not built.** Every figure editable from admin · countries with no rail named · verification requirements as data · margin per session from real spend · support attachments | *sprint 20R* | **Migration 0050 applied to production before the push (H16)**, additive: eight columns on `country_settings` and two `NOT VALID` CHECKs. Verified on production against `information_schema`: all eight present, ledger **51**, and both country rows configured. **20.1–20.7 built:** `/admin/settings` edits the tiers, the minimums, the credit expiry, our cut, the price floor and cap, the copilot allowances and the payout rails — each group its own form writing its own row, and every figure shown in the unit a person thinks in (dollars, per cent) with the conversion done once in the action, because an admin typing 1500 into a field labelled `%` is how a platform starts taking fifteen times its cut. The save **refuses** rather than falling back: `settingsProblem` runs on the whole prospective object, so a cap below the floor is caught even though neither figure is wrong alone. **20.4/20.5 were a nested ternary per country** in `lib/regulators.ts`; they are `country_settings` columns now, merged **field by field** so a half-configured country keeps the shipped wording for the rest — proved by a check that configures only the licence label and asserts the ID labels survive. **20.6:** margin per session is revenue minus *measured* model spend, and the percentage is **null rather than 0** when nothing was collected — the same refusal 14.7 makes about a small-sample reliability score. **20.19:** attachments upload from the public form and the therapist's page through the same uploader, the same opaque path and the same audit as a clinical document, capped at 25 MB, images and PDFs only — and a second C82 check now asserts that **nothing outside `lib/data/support.ts` touches an attachment at all**, because a chunker pointed at that table would put a prescription into the consented-document pipeline one import at a time. **A configuration step, not a backfill:** `npm run settings:rails` fills the new country fields **only where they are empty**, so it cannot undo an administrator's edit; run twice it reports *"0 countries configured"*. Without it Egypt read as a country with no rail, which is worse than wrong — it was the product's real configuration. `verify-sprint20.ts` now runs **36 checks**. 337 tests / 20 suites, 19 verifiers pass, build clean |
| 2026-09-08 | 20.x | **Sprint 20 complete — the back office.** Two new roles · two support queues · a clock that pauses · a closed ticket read on a page that authenticates · number changes that a staff member cannot complete | *sprint 20* | **Migration 0049 applied to production before the push (H16)**, additive: `phone_change_requests` (18 cols), `support_attachments` (8), seven columns on `support_tickets`, and two new **values** for `users.role` — which needed no schema change, because the column is text and the union is the check. Verified on production against `information_schema` after: both tables present, five CHECKs (three validated, two `NOT VALID` on the existing table, joining 22.9's list), ledger **50**, **0 rows changed** — every existing ticket is a patient ticket, which is what all of them are, and the 38 existing users keep the roles they had. `verify-sprint20.ts` runs **23 checks**. The sharpest: **20.9 asserted as an import graph** — every page behind `requireStaff`/`requireManager` walked for a clinical data module, with an offender page planted under `app/(admin)/admin` and caught; **20.20's pause proved on one ticket** by making it overdue, then marking it *waiting on them* and watching the same row stop being overdue (staff are measured on their own delay, C83); **20.21 refused twice** — once by `closeTicket`, once by the CHECK, because a busy night is exactly when a code path gets skipped; **20.22 proved as two factors** — the link alone opens nothing, and an unknown token fails with the *same message* as a wrong code so the page is not an oracle for references; and **20.16's hash**, so a staff member reading the table cannot finish the change they approved. Also: a payout chase and somebody in distress are in **separate queues** (20.24), a change marked done with no verification is refused by the database, and 20.15 refuses a number already in use **without saying whose**. C71 ruled — re-examined because 20.19 adds a second upload door, and closed as accepted because that door never extracts at all. *(20.1–20.7 and 20.19's upload were finished in **20R**, below.)* 337 tests / 20 suites, 19 verifiers pass, build clean |
| 2026-09-08 | 19.x | **Sprint 19 complete.** Two red gates turned into honest skips · sprints 17 and 18 rendered against production for the first time · the locale became a parameter · Arabic as a layout | *sprint 19* | **No migration.** **19.0 (C90):** `scripts/_verify.ts` gives every acceptance script one reporter with `skipUnless` — a check that depends on content a later sprint publishes is deferred with its reason printed and counted, never failed. Proved by running the same files against two databases: production reports **9 checks / 2 deferred** (17) and **9 / 3** (18); the seeded branch reports 14 and 15 with **zero** deferred. The controls deliberately never skip. **19.0a (C89):** `republish.ts --staging` writes every page into a locale no reader path asks for, and `render-check.ts` renders those rows through the **real `BlockRenderer`** and asserts on the HTML — run against **production**, 14 staged rows, 13 checks, PASS. Two defects fell out of it: staged rows would have appeared in the **live navigation** (`readNav` reads every locale; fixed with two locks and the live nav re-checked against the deployed code's own query), and `getLocale()` threw outside a request so no page with a price could be rendered by a script at all — fixed with a `try`, because `cookies()` throws *synchronously* and the first attempt chained onto a promise that never existed. **19.4:** `formatMoney` takes the locale as a **required** argument, which found 26 call sites in 8 files exactly as the required zone found 56 in 12.3 — and the hydration test immediately caught the sequel: a *type* is not present at runtime, `toLocaleString(undefined)` asks the machine, and the test's own two-argument call rendered `$1,234.50` on one machine and `1.234,50 $` on another. The fallback is now pinned to `en-US`, and the test carries both calls as its control. **19.7 / C77:** the shipped content is a map keyed by locale and the publisher takes `--locale=xx`; `--locale=es` fails with *"Shipped languages: en, ar"* rather than silently doing nothing. **A checker corrected in flight:** 19.7's first scan matched the phrase *"two languages"* anywhere in a file and failed on two files that only *say* it in their own documentation — the fifth time a checker in this repository has matched prose. It strips comments now, and carries a control proving the un-stripped version would have failed. Also found: **`NoShowRecovery` was rendered nowhere** — sprint 14's whole patient-facing recovery, dead since it was built, the same defect as `InvoiceList` in sprint 12 and found the same way, by a type error asking who passes the new locale. It is now on the join page, shown when a scheduled session's clinician has not arrived. Rulings: **C89, C90, C77**. 337 tests / 20 suites, 18 verifiers pass, build clean |
| 2026-09-08 | 18R | **Sprint 18R complete.** A real contact form in both languages · a support ticket, not an inbox · both companies as content · the rest of the public site brought into the revamp | *sprint 18R* | **Migration 0048 applied to production before the push (H16)**, additive: `support_tickets` (22 cols) and `support_ticket_events` (6), nothing touched, nothing backfilled — there is no history of contact messages because until now the page had a `mailto:` link and every message went somewhere this system cannot see. Verified on production against `information_schema` after: both tables present, six CHECK constraints **validated**, ledger **49**, 0 tickets. `verify-sprint18r.ts` runs 20 checks, every refusal by attempting the write: a ticket with **neither** an email nor a phone refused by `support_tickets_one_handle` (§3b's shape, one table further out), a topic off the list refused so the queue can sort, and a `closed` ticket with no timestamp refused because a report cannot count it. The three that matter are all 18R.4: the **queue query cannot carry a message body** (asserted on its key set), a support message is **never written to the application log**, and C82's *never in a prompt* is an **import-graph ban** on `lib/data/support.ts` — proved by planting a real offender file inside `lib/ai`, re-running the walk, and deleting it, because a regex tested against a string in the verifier proves the regex and not the scan. The rate limiter was exercised rather than described: five submissions in a burst, **2 accepted, 3 refused**. Both companies are content in both locales — the renderer contains no company name, address or address-of-record, asserted — with the international entity first and both always visible (18R.7). Also 18R.1: the features page gained the patient-side showcases and the CTA pair, contact lost its `mailto:` (asserted absent from every published page), and every marketing page now carries at least one revamp block. **C91 ruled.** ⚠️ **Incomplete until sprint 20:** the tickets land in a queue with no screen yet — stored, owned by nobody, and unanswerable until 20.18–20.22 builds the console. ⚠️ Production content still not republished (22.8b). 336 tests / 20 suites, 17 verifiers pass, build clean |
| 2026-09-06 | 18.x | **Sprint 18 complete.** A patients section in both languages · help now on every patient page and never behind a signup · the patient app shown as the thing itself · demo copy became content · a screens sweep that refuses to photograph a real record | *sprint 18* | **No migration.** Two new block types (`crisis`, and `pricing` from 17) and three new live demos (`patient-sessions`, `homework`, `profile`) rendering the **real** components — sprint 15's `PatientSessionList` among them — against synthetic fixtures; no `<img>`, no `next/image`, nothing that can go stale silently (C80). `for-patients` ships in **English and Arabic** as real `content_pages` rows, which is 18.5's whole point: a page that exists only in `defaults.ts` is invisible to admin and untranslatable in 21, so `republish.ts` gained a narrow `--create` for a genuinely new page. The header now offers two first buttons (18.4) — *I need a therapist* and *Start free — for therapists* — because a person in distress and a clinician evaluating software were being asked to press the same one. 18.13: the transcript, the brief, the steps and the observations inside the live components are now a `demo` content row per locale with the shipped fixtures as fallback, so **21 can translate the mockups, not only the paragraphs around them**. `verify-sprint18.ts` runs 15 checks. The two that matter carry controls: **18.7's forbidden-shape scan** over all 14 published pages in both locales, with five sentences written to break its five rules and all five caught — the first draft of the scan missed *"Our team can read your notes"*, which is exactly the sentence a real marketing writer produces, and the control is what found that; and **18.11's refusal**, proved by running the sweep's own query and by running the sweep itself, which refused: *"this database holds 66 patients and 21 notes outside a demo organisation."* **C17 was a real defect and is fixed here:** the admin Vault summed `cost_cents`, which `lib/ai/client.ts` writes as `round(microcents / 1000)`, so every model call under half a cent stored as **zero** while the dear ones rounded up — the column overstated true spend by low single-digit percent, and the usage page beside it read microcents and disagreed. Every figure in `vault.ts` now sums `cost_microcents` and divides **once**. *(The figures first written here — 466 of 596 rows, 8.59¢ on 209.41¢, 212¢ → 204¢ — were a measurement taken on 6 Sept and they move with every model call the platform makes; the founder re-measured on the 8th and got 596/466 and 218¢ vs 209¢. **The finding is the method, not the numbers**: run the query in `verify-sprint18.ts` for today's, and never quote a drifting measurement as though it were a constant.)* Seven rulings: **C72, C7, C8, C9, C17, C20, C34, C39** — C7 closed as C25's duplicate rather than left open beside it. ⚠️ **Incomplete until 22:** `docs/screens/` holds only its README. The sweep is built and its guard is proved, but there is no demo-only database to photograph until the purge — added to the launch checklist as 22.8c. ⚠️ Production content still not republished (22.8b). 336 tests / 20 suites, 16 verifiers pass, build clean |
| 2026-09-06 | 17.x | **Sprint 17 complete.** The cards are the page · a slider that answers "what does my month cost" · one component on two pages · every figure from `platform_settings` · the netting sentence, published conditionally | *sprint 17* | **No migration.** The pricing page lost its hero (17.2) and now begins with a new `pricing` **block** rather than a renderer special-cased on the slug — which is why the same cards can now be a section on the homepage (17.7) without either page owning a second copy of a number. The old `PricingCards` was **deleted**, not left beside its replacement. `verify-sprint17.ts` runs 14 checks and **renders the real component**, walking the returned element tree and reading the numbers actually handed to each price: `400, 300, 200` rendered against `400, 300, 200` in settings, the slider starting at the bundle's own minimum (30 at $2, against $4 pay-as-you-go), and every `PriceTag` carrying the EGP rate quoted once on the server (17.8). The acceptance criterion — *no page states a price, rate, cut or minimum that disagrees with `platform_settings`* — is asserted against **every published content row in every locale**: 12 pages scanned, zero price-shaped strings, because the figures are no longer in the content at all. Its **control** plants the exact sentence C60 shipped ("$6 a session, or 15% of what you charge") in a draft row and proves the scan catches both figures. **C69's sentence carries its own control:** netting is switched **off** in the database, the component is re-rendered, and the paragraph is proved *gone* — §6 forbids describing a mechanic the product does not have, and a conditional nobody has seen fail is not known to be conditional. The sentence is also **hedged**: netting is real for clinicians whose earnings we hold and not for one paid straight into their own Stripe account, and it says so. Also ruled: **C25**, accepted-not-resolved and given a home in a new **sprint 23**. ⚠️ **Incomplete until sprint 19:** the Arabic pricing page is published and its FAQ is Arabic, but the card *chrome* ("Sign up free", the feature list) is still English — those are component strings, and 19 is where strings become `(key, locale)`. ⚠️ **Launch step, not done here:** production content is deliberately **not** republished — a `pricing` block in the database before the code that renders it deploys would serve a pricing page with no prices. It goes in 22's checklist, after the deploy. 336 tests / 20 suites, 15 verifiers pass, build clean |
| 2026-09-06 | 16.x | **Sprint 16 complete — the big one.** Two rails · two currencies · two entities · a manual payout queue with an age, an owner and an alert · two-person approval in the DATABASE · the rate frozen on the transaction · netting built · a reconciliation that balances | *sprint 16* | **Migration 0047 applied to production before the push (H16)**, additive: `payout_methods`, `payout_requests` and `payout_request_events`; `entity` on `ledger_entries`, `crossing` + `entity` on `session_payments`, `rate_currency` on `users`, `price_currency` on `sessions`, and four settlement columns on `invoices`. Verified on production against `information_schema` after: ledger **48**, three tables (12 / 28 / 7 columns), all nine columns present, and **0 existing ledger legs changed** — every default describes what the old rows already were: one entity, one currency, one crossing. The CHECKs on existing tables are `NOT VALID`, so they bind new writes without scanning old ones, and they join 22.9's VALIDATE list. `verify-sprint16.ts` runs **31 checks**, every one by attempting the write. The sharpest: **C74's two-person rule asserted by writing the forbidden approval STRAIGHT TO THE TABLE**, past `approvePayout` entirely — because a check on a function's own error string only proves the function agrees with itself, and Postgres refuses it (`payout_requests_approver_not_editor`); a payout marked *sent* with no approval, likewise refused; **C69 netting proved in both directions** — a clinician whose money we hold has the fee taken out of it (`netted: 6000 → 5600`) while a **control** clinician we hold nothing for is still billed `due`, so the check cannot pass against code that nets unconditionally; **C37's production refusal proved in a CHILD PROCESS booted at `NODE_ENV=production`**, because `lib/env` reads it once at load and flipping it in-process would have proved nothing; and 16.8's reconciliation balancing to zero with every held cent traced to one payment in and at most one payout out. 9 new pure tests in `money`, including that a refund converts to the **exact negation** of the payment it reverses — `Math.round(-0.5)` is `-0` in JavaScript and the naive version leaves a cent in the ledger for ever. Four rulings: **C37**, **C69**, **C74**, **C76**. ⚠️ **Incomplete until a rate feed is bought:** `PROVIDERS` is empty, so in production the EGP rail refuses rather than settles — deliberate, enforced, and written into C37 as accepted rather than resolved. 336 tests / 20 suites, 14 verifiers pass, build clean |
| 2026-09-06 | 15.x | **Sprint 15 complete.** The patient's own app · five tabs with the globe under the thumb · four session lists, not one history · the brief only once it is signed · billing that says why · **15.8 enforced by a select list, not a screen** | *sprint 15* | **No migration** — sprint 15 adds no table and no column; everything it shows already exists. `verify-sprint15.ts` runs 12 checks, and the two that matter both carry their own control. **15.8:** a sentinel string is planted in every clinical field of a `session_notes` row — all four SOAP fields, the summary, the talking points, the observations, the impressions, the recommendations — and in a `transcript_segments` line, then everything `sessionsForPatient()` hands the screen is serialised and searched for it. It is absent. The **control** runs the identical assertion over the same join one column wider and the sentinel surfaces, so the check has teeth rather than passing on an empty haystack (C84's lesson, applied before the fact this time). The row's **key set** is asserted too — `at, brief, briefPending, group, id, modality, paymentStatus, priceCents, therapistName` — so a widened select fails here instead of shipping. **C16 ruled:** the patient app reuses the design system and the formatters and **no clinician data layer at all**; a second scan bans `sessionNotes`, `transcriptSegments` and `sessionInsights` from every file under `app/(patient)` and `components/patient`, with its own control proving the scan finds `app/(app)/sessions/actions.ts`, which legitimately uses them. Also proved: an **unsigned** brief is withheld and reported as pending rather than shown as a draft, and a past radar session and a past booked session land in **different lists** — one history that mixes them reads as a course of treatment somebody never had. ⚠️ **Incomplete until sprint 16:** the billing screen renders in USD because there is one currency in `formatMoney` today; 16 gives it the two rails. **Caught by re-running the older verifiers, and fixed here:** sprint 13's check that a locked record leaves the queue had started failing, because 13R moved the attempt budget into `claim_attempts` and `openChallenges` was still reading `person_claims.name_attempts`. A claim row is disposable — ask for a fresh code and a new one appears with a zeroed counter — so a locked record was reappearing in the queue on the next code request. That is C87 again through a different door, introduced by the fix for C87. `openChallenges` now joins `claim_attempts` for both the filter and the remaining-attempts count. 295 tests / 19 suites, 12 verifiers pass, build clean |
| 2026-09-06 | 13R | **Sprint 13R complete.** Two handles · the budget that stopped resetting · the door out of the lock | *sprint 13R* | **Migration 0045 applied to production before the push (H16)**, additive: `patient_accounts.email` nullable, its unique index rebuilt **`NULLS DISTINCT`**, and a new `claim_attempts` table keyed unique on (account, record). `verify-sprint13r.ts` runs 15 checks, every one by attempting the write. The sharpest is C87 replayed as a *sequence*: three wrong names, a fresh code request, then the **correct** name — refused, because the budget is no longer the claim row's to carry. Also proved: two address-less accounts coexist (the `NULLS NOT DISTINCT` mistake would have collapsed them into one), a second account on the same address or number is refused, an account with no number is refused, one account answers to both handles, and sign-in has exactly **one** failure message. Two corrections during the build: my first schema edit made `users.email` nullable rather than `patient_accounts.email` — caught by 11 type errors naming `therapistEmail` and `clinicianEmail` — and the release first set the locked claim back to `pending`, colliding with the claim a fresh code had already created. `notify()` now sends WhatsApp **and** email rather than stopping at the first that works (13R.12). 295 tests / 19 suites, 10 verifiers pass, build clean |
| 2026-09-06 | 13.x | **Sprint 13 complete.** One phone, one account · the therapist invites · signup with the number locked · the two-question challenge · a no remembered · three strikes and a lock · the patient's own time zone | *sprint 13* | **Migrations 0043 and 0044 applied to production before the push (H16)**, additive: a partial unique index on `patient_accounts.phone`, a `NOT VALID` presence check, `timezone`, and five columns carrying the challenge. Verified on production after: ledger **45**, `person_claims` 16 columns, `patient_accounts` 11, and `person_claims_open_unique` rebuilt as (account, person, patient) **NULLS NOT DISTINCT** — without that clause the invite route's null `patient_id` would have silently dropped the one-live-attempt guarantee, because Postgres treats NULLs as distinct. `verify-sprint13.ts` runs 18 checks and every one of them **attempts the thing that must fail**: a second account taking a claimed number is refused by the index; an account with no number is refused by the check; two therapists on one number produce two separate questions; a record answered *no* is never offered again while the other therapist's is untouched; a near-miss name is refused without saying how close; three wrong names lock the record and it leaves the queue. **It caught a real defect while being written**: `challengePassed` — the gate 13.8 says every screen consults — originally opened on `seen_therapist = true`, so clicking *yes* to question one would have opened the record with the name gate still standing but no longer guarding anything. The verifier's label said "still unpassed" and its assertion said `=== true`, and the contradiction is what exposed it. 0044 adds `name_confirmed_at` so the state between *challenge passed* and *record claimed* has somewhere to live — 13.10 keeps consent after the claim. 289 tests / 19 suites, 9 verifiers pass, build clean |
| 2026-09-06 | 12.x | **Sprint 12 complete — the sweep.** The copilot gate on for everybody · every session ratable · ~40 staff timestamps given a zone · a phone number on every therapist-created patient · §2 swept · `scripts/reset.ts` · `_fk.ts` deleted | *sprint 12* | **Migration 0042 applied to production before the push (H16)**, additive: three CHECK constraints added `NOT VALID`, which is the whole trick — `SET NOT NULL` scans the table and fails on the existing null rows, `NOT VALID` binds every insert and update from that moment and never looks at what is already there. So the rule holds now, the running deployment survives the gap, and nothing is backfilled. `verify-sprint12.ts` runs 17 checks and asserts the constraints **by attempting the write**: a session with no `feedback_token` refused, a therapist-created patient with no phone refused, `01001234567` refused for its shape, and — the other half of §3b — a `join_link` patient with only an email still accepted. Found while writing it: **`bookSlot` never minted a `feedback_token`**, so every session booked from a public profile since sprint 11 was unratable and its patient could never receive a brief; C26 was the same defect in historical rows and this was it still happening. 12.3 was done by making the zone a **required argument** — the type error found all 56 call sites in 28 files, and `relativeDay` turned out to compare `getDate()` on two Dates, so a session finished an hour ago read as "Yesterday" to anyone east of UTC. §2 went from 32 open rows to 14, and the duplicate C61–C66 numbering (two different concerns per number) is resolved by renumbering the sprint-11 set to C61a–C66a. 283 tests / 18 suites, 8 verifiers pass, build clean. **Corrected twice in the same sprint:** 12.3's first version filled the required zone argument from `readerZone()` at module scope in six client components, on a comment of mine that wrongly claimed it returns null on the server. It returns `"UTC"`. Next.js server-renders client components, so every date was a hydration mismatch. Fixed by props from the server and one effect-based hook, and pinned by `tests/hydration.test.tsx` — two child processes, `TZ=UTC` and `TZ=Africa/Cairo`, byte-identical output required, plus a control that must differ, and a fourth test pinning the money case. **Then corrected again (C84):** the guard beside that test banned the *helper*, not the construct, and reported zero over seven files that inlined it — including the public booking calendar and the public feedback page. Rewritten to ban the construct and proved against all six offending shapes. `InvoiceList` deleted: it was exported, took the new `zone` prop, and was rendered nowhere, so 12.3's first pass documented a fix on code no screen runs |
| 2026-09-06 | 11R | **Sprint 11R complete.** One clock, one rendering · clinicians publish in their own zone · `reminded_at` instead of editing the patient's words · the claim code actually routes through `notify()` · E.164 with a country the form asks for · hourly reminders with a quiet window · the ledger reconciled · a booking needs a contact method and the calendar has ceilings · **C50 built** · **C46 turned on, grandfathered** · **C26 excluded, not backfilled** · **C27's access column built** | *sprint 11R* | **Migration 0040 applied to production before the push (H16)**, additive only, and 0039/0040 recorded in `drizzle.__drizzle_migrations` — ledger and journal now agree at 42 on both. `verify-migrations.ts` is new and asserts all three sources: journal vs ledger vs `information_schema`, 108 foreign keys, 52 tables. `verify-sprint11r.ts` runs 11 checks on the branch database, three of which are the point of the sprint: the **same 18:00 Cairo stored as 15:00Z in July and 16:00Z in January**; **0 of 66 existing patients locked out** if the copilot gate is switched on today; and **0 stored phone numbers** that are not E.164. Also measured: 0 slot notes carry a `[reminded]` marker, and 12 of 23 completed sessions are unratable and are now *counted* rather than read as unrated. New pure suites: `timezones` (21 → one instant, four readers, Egypt DST both directions, the spring-forward gap refused) and `documents-extract` (10, two of them real PDF bytes through the real parser — a one-column letter extracting its lines, a two-column page extracting **null**). `hoursOn` and `byDay` **deleted**, not deprecated. Build clean |
| 2026-09-05 | 3.5 | **C35 — a straddling line is never labelled.** Prompt rule placed above the schema (H2) + a deterministic refusal at the write | *sprint 3* | Signal chosen by measurement, not guess: interior `.`/`!` fires on 60/151 and was rejected; interior `?`/`؟` fires on 22. Hand-read all 22 — 18 real straddles, 3 one-clinician question runs. Refined to measure from the **last** question mark, which drops exactly those 3 → 18. 6 new tests. Applied: 18 labels returned to `unknown`, in-person 12.2% → 21.6%, video 2.7% → 4.9% |
| 2026-09-05 | 3.x | **C33 closed — backfill re-run against the real model.** Reset all 160 mock labels to `unknown` first, then `gpt-4o-mini`, 13 sessions, 151 segments, 31s | *sprint 3* | H10 honoured again (retention 0 → 86400 around the write pair). Coverage in-person **91.9% → 12.2%**, video **20.5% → 2.7%**. Note the video baseline is 20.5% not 11.9%: resetting exposed 16 rows an *earlier real* run had inferred. Quality hand-read on two sessions, one Arabic one English — new finding filed as C35 |
| 2026-09-05 | 3.x | **Sprint 3 complete.** H11 batching + backfill · pause-based cutting · descriptors · dropped-track handling | *sprint 3* | Baseline measured first (video 11.9% / in-person 91.9% unknown — §3's figures exact). After backfill: **video 0%, in-person 9.5%**, the remaining 14 being sessions under the 4-segment floor. H10 honoured: retention set to 0 before the bulk write and restored to 86400 after. Migration 0031 verified against `information_schema`. 21 new tests. Two caveats filed as C32/C33 |
| 2026-09-04 | 2.x | **Sprint 2 complete.** C24 (the red test) fixed first · room two-column at `lg` · `/on-call` session history · viewing-signal stand-down · orb in five states | *sprint 2* | Room geometry measured before/after in a real browser at 4 viewports (transcript y=1001→98, 0px→701px visible; phone unchanged, H4). Orb states asserted on their accessible names. `verify-sprint2.ts` proves history is frozen by moving every rate +999 and re-reading. 112 tests / 8 suites, 0 failures |
| 2026-09-04 | C14 | Copilot allowance re-counted: 10 **per session per patient**, rolling over, expiring with `creditExpiryMonths`. Was per calendar month | *this* | `checkQuota` rewritten; earned and used are counted over the same window |

---

## §6 · STANDING RULES

Breaking one of these is a bug regardless of what any ticket says.

### 🔴 The family of failures this repository actually has

Five now, each one a check that passed while the thing it checked was broken.
They are listed together because they are one failure wearing five costumes,
and because the next one will look like none of them:

1. **C84** — the guard matched its own helper, so six files doing the banned
   thing by hand reported clean.
2. **18.8** — the check was vacuously true against no content, and said so in
   the same words it would have used for a pass.
3. **C157** — a runtime registry counted the modules one execution imported and
   called it the number of pins in the source. Wrong by 45 per cent.
4. **C158** — the planted offender produced the **same observable as the
   guard**: a private path with a language prefix redirected to the login wall
   with the guard and without it, so the proof proved the login wall.
5. **C161** — two empty arrays are deeply equal. The transformation destroyed
   both sides of the assertion and the test passed on nothing.

**The rule: a check earns its place by failing.** Prove it against a planted
offender, plant that offender **where its absence would show**, and assert the
value survived rather than that two derived values agree. A check nobody has
watched fail is a check nobody knows the meaning of.

| Rule | |
|---|---|
| Therapists can **never** delete a patient or a session | Hard |
| Reset clears the therapist's messages and copilot replies — **never** in-session notes | Hard |
| **No admin impersonation** | Hard |
| **Never reveal who wrote a rating** | Hard |
| A patient never sees a transcript or clinical note — enforced server-side | Hard |
| Nothing unclaimed is ever shared | Hard |
| Only admin sends patient data anywhere, audited, clinician notified | Hard |
| Verify every migration against `information_schema` (H1) | Process |
| Measure before claiming; re-measure what already worked (H4) | Process |
| Short tables in replies. Never walls of text | Process |
| Never force-push a shared branch (H15) | Process |
| **`main` is live.** Apply the migration to production *before* pushing `main` (H16) | Process |
| H16 is not "applied": **prove it against `information_schema` and quote the number you read** (C105) | Process |
| A content sprint is not finished until the published rows are reseeded and its verifier re-run against them (C148) | Process |
| Every verifier that **writes** starts at `writesTo()`, and a missing fixture exits through `required()` (C147) | Process |
| **Anything that renders in more than one context takes its locale and its zone as a PARAMETER**, never by asking the runtime (C84, C150) | Hard |
| **There is no bare database.** Every query names its plane: `dbFor(region)` or `controlDb` (C118, 30.1) | Hard |
| A chart routes on the **patient**, never on the practice holding it (C154) | Hard |
| **A number about the source is measured FROM the source.** A runtime registry counts what one execution reached, not what is true (C84, 18.8, C157) | Hard |
| Debt that is counted is **ratcheted**: the committed figure may go down, and a rise fails the gate (C157) | Process |
| Anything a page asserts about **where it lives** is checked over HTTP against the host that served it (C162) | Process |
| A negative proof plants the offender **where its absence would show**. Same observable as the guard means the check proves nothing (C158) | Hard |
| A rule proved by a refusal is also proved by the write it must **allow**. Half a proof is a locked door nobody opened (C165) | Hard |
| A clinical fact carries **when it was true**, and is aged from that, never from when it was written (33.3) | Hard |
| **AI inference is never a confirmed fact.** A model's row is born unverified and cannot supersede a human's (33.2) | Hard |
| A model's output is never fed back to a model as evidence. Unverified in, nothing out (C167) | Hard |
| Where two accounts of a patient conflict, **the system does not ask a model which is true** (C170) | Hard |
| **A model handed two accounts of one patient does not weigh them.** It blends them and writes the more confident-sounding one. Prompt instructions do not arbitrate: 6.7% with the rule stated twice is the measurement (C170, 34) | Hard |
| A safety classifier **structures and never adjudicates**. The level is arithmetic over indicators, in a file a model cannot reach (35.3) | Hard |
| A dumber always-on floor is never lowered by a cleverer system (35.2) | Hard |
| A red line that might be noise is **still red**. Never widen a band to make a run pass (C172) | Process |
| **A level computed from a confidence is a level a model decided.** A model reports what it saw and where; arithmetic a clinician can read turns that into a level (35.3) | Hard |
| A normaliser is written with **escapes**, and an empty needle matches nothing (C161, C173) | Hard |
| A measurement is comparable only to itself **over the same cases**. A changed case set is refused, not compared (C174) | Process |
| A rule about what software may reach is kept by a **schema that cannot express the alternative**, never by a service that remembers (C175) | Hard |
| A door for a machine is **narrower** than the door for a person: one scope, one purpose, expiring, and nothing clinical comes back out (C176) | Hard |
| A check on **copy** belongs against the source of the copy. A gate that greps a component for English expires the day the product learns a second language (C200) | Process |
| **A translation pass is a full read of every sentence in the product**, which is why it finds what verifiers and a walkthrough both missed (C198) | Process |
| A rule with **no number behind it drifts**. Sprint 19 shipped one and fourteen sprints wrote English past it; the ratchet is the number (C182, 37L.6) | Hard |
| **Identity is never assigned by elimination.** A voice with no evidence of its own is a numbered speaker, however few voices are in the room (C177, 37.2) | Hard |
| **A verified number is not enough: it has to be verified FOR THE READER.** A crisis line for another country is a button that looks like help and reaches nothing (C184) | Hard |
| A capability the database records and **no interface offers** is a capability nobody has. Build the screen or write the ticket, and say which (C179) | Process |
| **A screen nobody has walked is unverified**, however green the gates are. Every sprint of built-but-unused screens makes the next walkthrough longer (C180) | Process |
| A fixture set that has never been **watched failing** may be agreeing with itself. Plant the offender the fixtures claim to catch (C84, C158, 37.1) | Process |
| Anything private has **one URL**. A language prefix on it is a second address for the same bytes (C153, 31.1) | Hard |
| A quality or safety number is reported **per language**, never averaged across them. Not only crisis: an average is where a zero hides (C159) | Hard |
| An equality between two derived values is not a pass. Assert the value **survived** (C161) | Hard |
| An eval's own noise is measured, printed beside its numbers, and fixed with **more cases, not a wider band** (C160) | Process |
| A second door into the same bytes is a door, whatever environment it is gated to (C153) | Hard |
| **When sprint N merges and you branch for N+1, delete sprint N-1's Neon preview branch.** Keep one as a buffer. Never touch `main`, `sprint-1-settings`, the plan branch or `vercel-dev` | Process |
| A migration must be additive, so the running deployment survives the gap | Process |
| Changing a price or a rate? grep `lib/content/` **and** check `content_pages` (C60) | Process |
| **Never edit text a patient wrote.** No markers, no flags, no suffixes in a column holding their words (C63) | Hard |
| **No `toISOString()` in anything a person reads.** One instant, one formatter, the reader's zone (C61) | Hard |
| A channel that falls back to another **tells the person on screen**, not the server log (C68) | Hard |
| Every price, rate, cut and minimum on a public page is read from `platform_settings` at render time. Never typed into a sentence | Process |
| Never describe a mechanic the product does not have, however fair the economics (C69) | Hard |
| One constraint per `DO $$` block — a duplicate on the first silently skips the rest (C66) | Process |
| **Never shape a product decision around a production row.** Every row is test data and is being purged (§4 · THE RESET). Migrations stay additive for *uptime*, not for the data | Process |
| **A phone number proves a number, never a person.** Both questions in §3b's step 5–6 run before any record is claimed or shown | Hard |
| **Money held is money owed.** Every held cent traces to one payment in and at most one payout out, in a ledger — never a number computed at read time (§3c) | Hard |
| An exchange rate is **frozen onto the transaction** that used it. Never re-converted (C76) | Hard |
| Nothing hardcodes "two languages". Every string is `(key, locale)` and admin can add a locale (C77) | Process |
| **AI drafts a translation, a human publishes it.** Crisis, consent and recording copy never go live from a machine draft (C79) | Hard |
| **A screenshot is a promise that expires silently.** Live components where possible; a committed screenshot is regenerated by command and never shows a real record (C80) | Process |
| Anything a patient attaches anywhere is clinical material: stored, audited and access-controlled like a document, and **never in a prompt** (C82) | Hard |
| A service clock **pauses while waiting on the other person.** Measure your own delay, not theirs (C83) | Process |
| **A completeness rule may gate a launch, never a live thing.** Falling back and shouting beats going dark (C78) | Process |
| **A ruling is a paragraph, not a word.** What was decided, why, what it costs, and the date. "Accepted, not resolved" is a legitimate outcome and must be written as one — a deliberate decision must never later read as an oversight | Process |
| **Do not stop to ask when the plan already says who decides.** A concern pointed at a sprint is that sprint's to rule on. Build, decide, record, keep going | Process |
| **No em dash and no en dash in any product copy.** U+2014 and U+2013 read as machine-written. CMS defaults, `ui_strings`, public pages, emails, WhatsApp templates (C117) | Hard |
| **A patient never converses with a model, and no model output reaches a patient without a named clinician approving that exact text.** Enforced as an import-graph guard, not a convention (C113) | Hard |
| **A grant can only ever be held by a clinician whose verification is `approved`.** In the database (C106) | Hard |
| **Nothing about any record is shown before the handle is proven.** Not a clinician's name, not a photo, not an initial (C121) | Hard |
| **A record is found by a proven phone or a proven email. Never by a name.** A name is only ever a challenge answer, and it is compared against the clinician's record, never the patient's editable profile (C114, C122) | Hard |
| **We never invent an emergency number.** Only verified lines appear; everywhere else says "call your local emergency number" (C125) | Hard |
| **The meeting bot joins meetings 24Therapy created for a session. Nothing else. Ever.** No calendar is read (C132) | Hard |
| **Identity comes from the session we created, never from a meeting display name** (C134) | Hard |
| **A partner never flips an approval bit, and a webhook carries an event and an id, never content** | Hard |
| **Never promise earnings, and never claim a paid session covers our fee.** Netting is what is true (C109, C110) | Hard |
| **The phone is required on every patient account; the email is optional on every patient account.** Sign-in accepts either handle plus the password. Identity is never locked to one of them (§3b, 2026-09-06) | Hard |
| **A uniqueness rule over an optional column is unique only over the rows that have a value.** Postgres's default `NULLS DISTINCT` is that rule; `NULLS NOT DISTINCT` collapses every empty row into one and is right only when the NULL genuinely means "the same thing" (C87's claim key, not C86's email) | Hard |
| **Email is sent *as well* as WhatsApp, never *instead*.** WhatsApp is the channel that always exists | Hard |
| **Anything rendered on both passes takes its zone as a prop from the server.** `readerZone()` answers with the *server's* zone during SSR, never null — reading it during render is a hydration mismatch on every date (C70) | Hard |
| **No `"use client"` file calls `Intl.DateTimeFormat()`, `toLocaleDateString`, `toLocaleTimeString` or `toLocaleString` during render** — zone *and* locale, dates *and* money. `useReaderZone()` is the only sanctioned reader, because it runs in an effect (C84) | Hard |
| **A guard bans the construct, not the helper.** A checker scoped to one function name passes while six files do the same thing by hand. Four checkers here have now passed by matching the wrong text — three matched their own prose, one matched its own helper. Prove a guard fires against a deliberate offender *of the shape it claims to catch* | Process |
| **A translated label never doubles as an identifier.** A list whose values are matched, stored or checked against an allowlist carries a code and a label; the code is what submits (C203) | Hard |
| **A formatter that renders for a person takes the reader's language as a REQUIRED parameter.** No default. The type error is the audit, and a parameter with a default is invisible to it (C201) | Hard |
| **Copy never lives in a module-level constant as a string.** It lives there as a `MessageKey`, typed with `satisfies`, resolved where it is rendered. A database enum is never rendered directly (C204) | Hard |
| **`stripComments` before any scan of source, without exception.** Seven checkers have now matched the prose describing the defect they hunt, and the seventh was written by somebody who had just fixed the sixth (C205) | Hard |
| **A component asks for its own language rather than being handed one.** Then there is no call site to forget (C206) | Hard |
| **One tag cannot be right for dates and for money.** `dateTag` is `en-GB`; `localeTag` is `en-US`. A single "locale" that silently means two things is how the wrong one gets used (C202) | Hard |
| 🔴 **Every word a person reads is a `MessageKey` with an English default, an Arabic default, and an admin override.** From sprint 45 on there is no third kind of string. A literal in a rendered component fails the sprint (C217, 45.8) | Hard |
| 🔴 **A control is proved dead by its ACCESSOR and every caller of that accessor, never by the name of its column.** `country_settings.enabled` was searched for by field name, declared dead, and ordered deleted. It is read through `getCountrySettings`, which returns null when it is false, and two payment call sites then refuse the charge. The file appeared in the search output and was not opened. Eighth occurrence of the family below (C218) | Hard |
| 🔴 **A file with a NUL byte is invisible to every grep in this repository.** `grep` answers `binary file matches` and prints nothing. One file had two, and it was the clinical evidence layer, which is how C214 came to be written backwards (C245) | Hard |
| 🔴 **A wall is a property of the data, not of the audience.** "The payer never learns" and "no employee of ours can produce the list" are different promises. Build the second or you have neither (C244) | Hard |
| 🔴 **A check for the absence of something passes when the thing is null.** "No therapist-facing query reaches a sponsor row" passes against a ledger column that shows a real name for private patients and the word "Patient" for sponsored ones. Assert on rendered output (C243) | Process |
| 🔴 **A switch an operator can set is read by the code, or it does not exist.** `country_settings.enabled` was written, audited and read by nobody, so an operator closed a country and watched it stay on the map. A dead control is worse than a missing feature, because a missing feature does not tell somebody they have acted (C218) | Hard |
| 🔴 **One source of truth per operator decision.** Two switches claiming to govern the same thing will disagree, and the one nobody wired up wins by silence. Remove the loser, never wire both (C219) | Hard |
| 🔴 **The platform fee is charged on every session and the AI fee only on consent.** A fee that vanishes when a patient refuses gives a therapist a reason to lean on them; a fee of zero gives away hosted video (C209) | Hard |
| 🔴 **In the session room the copilot reads the record as of `startedAt` and nothing after it**, identically whether consent was granted, declined or withdrawn. One bound, no branch (C211) | Hard |
| 🔴 **A note carries how it was made.** Transcript, partial, or the clinician's own memory, shown everywhere the note is shown. Evidence and recollection presented identically is the defect (C212) | Hard |
| 🔴 **Journals may be summarised, quoted and cited, and may never produce a diagnosis, a risk level, or any conclusion about the person.** The bound lives in the evidence layer, not in a prompt (C214) | Hard |
| 🔴 **24Therapy creates the meeting, or there is no external meeting.** Whoever holds the link controls whether consent happens, and a therapist in a hurry will send it directly (C215) | Hard |
| 🔴 **Every model call records its exact model, its tokens and its cost, attributed to somebody.** A call that cannot be attributed is booked to the platform, never dropped, because an unattributable cost that disappears is how a margin goes wrong quietly (C221) | Hard |
| 🔴 **A test that asserts a thing is absent must also assert the thing that should be present.** "No AI fee on a declined session" passes against code that charges nothing at all. This is the §6 family in its billing costume (46, 50.5) | Process |

---

## §7 · WHERE THIS IS GOING — read before sprint 24

Sprints 1 to 22R built a product. Sprints 24 to 44 turn it into a position.
Read this whole section before the first ticket, because several sprints only
make sense as steps toward something further out, and building them without
the destination produces the right code in the wrong shape.

**The one-sentence position:**

> **24Therapy is the clinical record layer above whatever a therapist already
> uses.** Not a scribe, not an EHR. The layer that makes every session, held
> anywhere, part of one patient's story that the patient owns and carries.

### The three audiences, and the three doors

Everything in §7 is one of three products. Keeping them separate is the whole
trick, because conflating them is what makes the roadmap unreadable.

| Product | Who touches it | What that person sees |
|---|---|---|
| **The meeting bot** | A therapist | A **Connect** button. 🔴 Never an API key |
| **The embedded widget** | A clinic's IT, or a platform like Shezlong | An install, once. Their clinician just sees a panel appear |
| **The partner API** | A developer at another company | Keys, docs, webhooks. 🔴 A therapist never sees this |

🔴 **There is no self-serve API key for therapists in v1.** A therapist holding
an API key is a therapist who got lost in our product.

### The patient story, which is the go-to-market

The therapist pays. The patient is the reason the therapist stays. So the
patient has to want this, and what they want is **portability**:

> Years of what you told one person do not have to be told again. Ask your
> therapist to write it down. Claim it. Take it with you. Your next therapist
> can ask about your history without you reliving it.

Which sets three hard rules that every sprint below inherits:

1. 🔴 **A patient never converses with a model, and no model output reaches a
   patient without a named clinician approving that exact text.** True today.
   Sprint 24 makes it structurally impossible to stop being true.
2. 🔴 **A grant can only ever be held by a clinician whose verification is
   `approved`.** In the database, not in a service. This is what makes "only
   certified therapists" a fact rather than a policy.
3. 🔴 **Nothing about any record is shown before the handle is proven.** Not a
   therapist's name, not a photo, not an initial.

### The economics, stated correctly

Sprint 28 puts this on a public page, so it has to be true:

- The platform is free. A session costs the therapist, first one free.
- 🔴 **"Paid sessions cover our fee" is arithmetically false** at typical
  Egyptian prices: 15% of a 20 dollar session is 3 dollars against a 4 dollar
  fee. What is true is **netting**: what you owe comes out of what you earn
  before it reaches your account. Say that.
- On a free session the therapist pays the fee themselves. Not a footnote.
- 🔴 **Never promise earnings.** "Get booked" is fine. "Earn enough to cover
  it" is a forecast about somebody else's business.

### What is coming that today's code should not fight

Do not build these yet. Do not make them expensive later either.

| Coming | What to avoid doing now |
|---|---|
| **Egypt-resident database** (sprint 30) | Any query that assumes one connection. Every data call goes through a region seam from sprint 30 on, pointed at the US instance until Cairo is live |
| **Session sources** (36) | A second transcription path. 🔴 `POST /api/sessions/[id]/transcribe` is **already source agnostic**: it takes a multipart file. What it lacks is a third auth door, because it calls `requireUserApi()` and `assertSameOrigin()`, which exist to stop exactly what a bot does |
| **The clinical evidence layer** (33) | Any new derived clinical fact stored without provenance. From 33 on, a fact carries where it came from, when, who verified it, and what it replaced |
| **The partner plane** (42) | Accepting a foreign id as one of ours. `partner_subjects` maps them. Two partners will both send `"P123"` |
| **Meeting bots** (41) | Calendar auto-join, ever. See below |

### 🔴 The rule the meeting bot exists under

> **The bot joins meetings 24Therapy created for a session. Nothing else. Ever.**

Fireflies watches a calendar and joins everything. For therapy that is not a
feature, it is a catastrophe waiting for a supervision call or an accountant.
Tying the bot to a session instead of a calendar settles four problems at once:
their other calls are untouched because we never read a calendar; a therapy
session they do not want recorded simply has the box unticked; billing is
unambiguous because a charge exists when a session exists; and accidental
recording is structurally impossible rather than forbidden.

And the trap inside it: if we create the Zoom meeting, the patient would get a
Zoom link and never see our consent screen. So 🔴 **the link the patient
receives is always ours**, which takes consent and then forwards. We never hand
out the raw meeting link. Declining consent still lets them into the session;
the bot simply does not transcribe.

### The em dash

🔴 **U+2014 and U+2013 are banned in all product copy** — CMS defaults,
`ui_strings`, every rendered public page, every email, every WhatsApp template.
They read as machine-written. Sprint 24 adds the check and proves it against a
planted offender. This paragraph is the last place in this repository that may
contain one, and only because it is naming the character.

