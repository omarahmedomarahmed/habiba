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
| C7 | 2.1 | **Stated premise is wrong.** Video is `aspect-[3/4] w-full sm:aspect-video` (`video-call.tsx:158`), already responsive. The real gap: **no copilot exists in the room** — only `CopilotToasts` (session-room.tsx:546); the copilot lives at `app/(app)/copilot`. 2.1 is "build a room copilot", not "relayout". Re-scope and re-estimate. | major | audit @2a3965d | open |
| C8 | 2.2 | **Likely already done.** `session-room.tsx:384` is a single `min-h-dvh` column with a `safe-bottom sticky` bottom bar, used on every viewport. There is no second desktop shell to merge. Verify on a real desktop before spending a ticket. | minor | audit @2a3965d | open |
| C9 | 2.3, 2.4 | **Zero prior art** — no match for `orb`/`Orb` in `app/` or `components/`. Costed inside a 1-week sprint that also contains the room rebuild (C7). At least its own week. | major | audit @2a3965d | open |
| C10 | 4 | **1.5 weeks is ~2× optimistic.** No `currency`, `vat_cents` or FX column exists on `session_payments`, `invoices` or `ledger_entries`; `ledgerEntries.currency` (schema.ts:1446) is the only one in the schema and defaults `'usd'`. Multi-currency + VAT is a migration across every money table and reader. | major | audit @2a3965d | **resolved** — sprint 4 shipped with migration 0032 (9 columns on `session_payments`, `fx_quotes` 7 cols / 2 indexes). The estimate was optimistic and the work was done; recorded so the next currency estimate is not made the same way. §3c makes this sprint 16's ground again, at considerably larger scope |
| C11 | 4.1 | **Already built.** `sessions.priceCents` (schema.ts:372) is set at creation (`sessions/actions.ts:59`, validated by `priceProblem`) and gates entry at `join/[token]/actions.ts:40`. Sprint 4's "first sprint that earns money" framing is wrong — paid links earn today. | minor | audit @2a3965d | **resolved sprint 1** — reworked to §3: cut, VAT lines and settings-driven bounds |
| C12 | 4.3 → 5 | **Ordering.** 4.3 saves payment preferences onto a patient row that 5.1 immediately re-parents under `people`. Land 5.1–5.3 first, or accept a second migration. | minor | audit @2a3965d | **resolved** — both sprints shipped in the stated order, 5.1–5.3 before 4.3's preferences landed on a person. No second migration was needed |
| C13 | 1.5 | **Under-specified.** Three constants, not one: `INCLUDED_MINUTES = 30`, `MAX_MINUTES = 50`, `WARNING_MINUTES = 5` (`lib/session-clock.ts:44-50`). The ticket does not say what `INCLUDED_MINUTES` becomes, and it drives the *patient's* countdown. 12 clock tests assert current behaviour. | major | audit @2a3965d | **resolved sprint 1.5** — 50 running / 10 countdown / hard stop 60, all from settings |
| C14 | 1, 10 | **§3 changes copilot semantics, not just its number.** `plans.ts:22` = "per patient per **calendar month**", enforced in `lib/data/copilot.ts`. §3 = "10 per **session**, rolls over on that patient, expires 12 months". Different feature. Needs a ticket. | major | audit @2a3965d | **resolved sprint 1** — `checkQuota` recounts per session per patient with rollover |
| C15 | 6.3 | **Measured cost:** `Actor.organizationId` is non-null `string` (`lib/auth/session.ts:32`); 32 direct `actor.organizationId` reads, 192 `.organizationId` reads overall, across 52 files calling `requireUser`/`requireRole`. "Audit every consumer" is the whole sprint, not a bullet. | major | audit @2a3965d | **resolved** — measured before sprint 6 and absorbed: `Actor.organizationId` stayed non-null `string`, and C41's ruling made a patient a *separate* actor type rather than an `Actor` with a nullable org. The 192 reads were never touched |
| C16 | 15 | **Admin is not greenfield.** 12 pages already exist under `app/(admin)/admin/` (`tv`, `usage`, `audit`, `errors`, `ratings`, `radar`, `taxonomy`, `therapists`, `verifications`, `vault`, `content`, `announce`). ~2 weeks may be right, but as extension work; the "built last so it can be verified" rationale does not apply to what is already shipped. | minor | audit @2a3965d | **still true, repointed** — 12 admin pages exist and §3d adds a whole back office on top. Now sprints **20 and 21**, which is where the two-week estimate belongs |
| C17 | — | **H13 has no owner.** `client.ts:108` (`costCents = microcents/1000`) is itself correct. The hazard lives in consumers of `cost_microcents`; no sprint audits them. One ticket, cheap now, expensive after sprint 4 adds currencies. | minor | audit @2a3965d | open |
| C18 | 3 | **No acceptance measurement is possible from source.** "92% unattributed in-person, 12% video" and §3's "46 of 56 patients have no email" are DB claims; without C5 resolved neither the baseline nor the sprint-3 acceptance test can be run. | major | audit @2a3965d | **resolved** — Neon branch `sprint-1-settings` off `br-curly-dream`. §3 confirmed exactly: 56 patients, 46 with no email |
| C19 | 5, 6 | **46 of 56 patients have neither email nor phone**, not just no email — measured, `WHERE email IS NULL AND phone IS NULL` → 46. §3's claim flow keys on "email **or** phone" (step 1), so for 82% of existing patients there is nothing to match on and no path to claiming at all. Sprint 5.4's "match on email or phone" will find zero candidates for them. The plan needs an answer for a record whose only identifier is a name. | major | sprint 1 @f06b82c | **resolved 12.5** — void by §3b and THE RESET. The 46 patients with neither address nor number are test data being purged, and a therapist-created record now *cannot* exist without a phone (12.4, migration 0042). The claim flow no longer has to work for a person we have no way to reach |
| C20 | 1 | **Scope taken beyond the ticket, deliberately.** 1.6 says "reprice to Starter $3/min 10, Growth $2/min 30" — but minimums are unsellable without something to buy. Added `session_credits` (purchase, expiry, oldest-first consumption) and replaced the `unlimited` Stripe subscription checkout with a one-time credit checkout. Without it 1.6 would have shipped three tiers a therapist could not reach. | minor | sprint 1 | **accepted, built** |
| C21 | 15 | **`invoices.kind` still has the value `subscription`** for what is now a credit purchase. Renaming means migrating every historical row and every reader for a label. Left as-is; `recordCreditPurchaseInvoice` says so at the call site. | minor | sprint 1 | **resolved 12.5** — void by THE RESET. Every `invoices.kind = 'subscription'` row is test data being purged, so there is no historical row a rename would have had to migrate. The label stays as it is because nothing now carries the old meaning |
| C22 | 5, 6 | **§3's "unclaimed patient gets 5 credits, unlocked by a diagnosis and a history" cannot be enforced yet** — it needs the claimed/unclaimed state from sprint 5. `checkQuota` currently applies `unclaimedPatientCredits` as a floor for *every* patient, which is the more generous reading and cannot lock a therapist out of a patient they just added. Tighten when `people` lands. | minor | sprint 1 | **resolved 12.1** — the state exists (sprint 7) and the gate now bites for everybody, with no date and no grandfather. §3's unlock is a diagnosis **and** a typed-or-dictated history, both answerable since sprint 8 |
| C25 | — | 🆕 **There is no copilot in the room, and that is the real gap behind old 2.1.** `session-room.tsx` renders only `CopilotToasts` — passive one-line suggestions written from the transcript. A therapist who wants to *ask* something mid-session must leave the room for `/copilot`. Scoped as its own ticket per ruling, deliberately **not** absorbed into sprint 2. Needs: a room surface, the four access states from §3, and the per-session credit accounting from C14. Estimate ≥1 week on its own. | major | sprint 2 | open, unscheduled |
| C32 | 3 | **Sprint 3's acceptance cannot be fully met on existing data.** "No transcript line ends mid-word across a 10-session sample" is a claim about *recordings*, and every segment in this database was cut by the old 8-second metronome. The new rule only applies to audio recorded after it ships. Measured baseline via `scripts/measure-cuts.ts`: 311 interior cuts across 21 sessions, **24.4% end without terminal punctuation**, 5.5% are followed by a line reading as a continuation. Re-run after real sessions to close this. | major | sprint 3 | **resolved 12.5** — void by THE RESET. "No transcript line ends mid-word" is a claim about recordings, and every segment in this database was cut by the old 8-second slicer and is being purged. The acceptance test is answerable on the first recordings made after launch, and only on those |
| C33 | 3 | **The backfill's labels came from the mock, not a model.** No `OPENAI_API_KEY` was available, so the first backfill ran against `tests/mock-openai.ts` with alternating speakers — machinery verified, labels meaningless. | major | sprint 3 | **resolved** — a real key was provided. All 160 mock labels were reset to `unknown` first (so the model started from truth, not from fiction), then re-run against `gpt-4o-mini`: 13 sessions, 151 segments, 31s. Coverage **in-person 91.9% → 12.2%**, **video 20.5% → 2.7%**. Quality hand-checked, see C35 |
| C35 | 3 | 🔴 **Diarisation quality is capped by chunk alignment, not by the model.** Hand-read two real sessions after the live backfill. Arabic (session `452f8851`, 18 lines read): ~15 clearly correct, including the code-switched *"كملي. What feelings come up for you?"* — labelled therapist, right. English (`1798409d`, all 27 lines): materially worse, and **almost every error is the same error** — the line contains *both* speakers, because the old 8-second cutter sliced across turn boundaries. Line 13 reads *"What made you decide to come here today? Um, well, as I told you, I wanna kill myself."* and is labelled `patient`: half right, and the half it gets wrong is a therapist question attached to a crisis disclosure. **Measured lower bound: 14.6% of labelled segments (22 of 151) contain an interior `?` or `؟`** — a turn boundary mid-line, where no single label can be correct. The true rate is higher, since a straddle needs no question mark. This is the strongest argument for 3.2: pause-aligned cutting should collapse this class directly, and until real sessions are recorded that way, backfilled labels on straddling lines are structurally at best half right. | major | sprint 3 | **resolved** — a straddling line is now left `unknown`, never labelled. Enforced twice: the prompt says so *above* the JSON schema (H2), and `straddlesTurnBoundary` refuses at the write whatever the model returns. Reclassified **18 of 151 (11.9%)** already-written labels. C32 still governs whether the underlying cause goes away |
| C34 | 3 | **H11's cap never actually bit on this data.** Measured before backfilling: 0 of 22 sessions exceed 160 segments — the longest is 95. So the fix matters for the 60-minute sessions sprint 1.5 just made possible, not for anything already recorded. Worth stating so nobody reads the backfill's improvement as evidence the cap was the cause; the cause here was the two-track guard and in-person sessions having no second track at all. | minor | sprint 3 | noted |
| C39 | 5 | 🔴 **The auto-merge hazard is real in this data, measured — and confirmed on PRODUCTION, where it is worse.** Three duplicate addresses on production, one of them across **three** patients in **three** organisations. On the branch: three addresses sit on more than one patient, and one of them — `omarabdelgawad001@gmail.com` — is on patients named **"Omar"** and **"Sam"**, in two different organisations. A shared family address, a typo, or somebody booking for a relative; there is no way to tell from the address. §3's "never auto-merge" is not a precaution against a hypothetical. The backfill kept all three as separate people and the verifier asserts they stayed separate. | major | sprint 5 | **noted — rule holds** |
| C40 | 5 | **`ensurePersonForPatient` runs outside the join-link transaction, deliberately.** It opens its own connection, so calling it inside would deadlock against the row that transaction still holds. A patient briefly without a person is a row the next read repairs; a deadlock is a patient who cannot get into the room. The trade is recorded here because it is invisible in the code. | minor | sprint 5 | **resolved — deliberate.** `ensurePersonForPatient` runs outside the join-link transaction because calling it inside deadlocks against the row that transaction holds. A patient briefly without a person is a row the next read repairs; a deadlocked join link is a patient who cannot get into the room |
| C36 | 4.3 | **Payment preferences deferred, as C12 predicted.** The payment now records the country, currency, rate and VAT it was made under, which is history and belongs on the payment. A *preference* — "this is where I pay from" — is an attribute of a person, and `people` arrives in sprint 5. Storing it on `patients` now means migrating it in two sprints' time. Build it in 5, on the row that will own it. | minor | sprint 4 | **resolved sprint 5** — `people.preferred_country` / `preferred_currency`, with `savePaymentPreference`. The *payment* still records the country it was actually made under; that is history and never moves |
| C37 | 4.4, 14 | 🔴 **The exchange rates are indicative, not a feed.** `lib/billing/fx.ts` has a `STATIC_RATES` table (~48 EGP/USD) and stamps every quote `source: "static"`, so a payment made against one is distinguishable in the row from a payment made against a real provider — and the pay page says so to the patient. `fetchRate` is the single function to replace. **A static rate must not settle real money in production.** An unpriceable pair is refused rather than guessed, so the failure is a country that cannot be paid in yet rather than a patient charged wrongly. Sprint 14 owns the real feed, next to the payment providers it must agree with. | major | sprint 4 | **still true, repointed to sprint 16.** `STATIC_RATES` (~48 EGP/USD, stamped `source: "static"`) must never settle real money, and §3c now puts a live rate on the critical path in both directions — every price shown in EGP, and every therapist paying us in EGP. C76 is the other half: who absorbs the difference |
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
| C57 | 10.2 | **CLOSED IN SPRINT 11** — `sessions.scheduled_at` exists (migration 0039) and `availability_slots` carries the calendar. The roster still returns null pending a follow-up to read it, which is a one-line change now that the column is there. Original finding: **"Next appointment" could not be answered, so the roster returned null rather than guessing.** There is no `scheduled_for` column — `sessions` records what happened, not what is planned, and scheduling is sprint 11. Caught before it shipped: the first version of `buildRoster` selected `MIN(s.scheduled_for)`, which typechecks (it is inside a `sql` template) and would have thrown on every load. The roster block now omits the phrase entirely and the system prompt says there is no schedule — a copilot answering "nothing booked" for a practice with no booking system states a fact about our schema as though it were a fact about their week. | minor | sprint 10 | open — sprint 11 |
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
| C71 | 11R | **The two-column heuristic refuses wide tables along with genuine columns.** `columnCount` marks a page multi-column when 40% of its lines carry a wide gap through the middle, and a medication table or a results panel looks exactly like that. Those documents are stored and honestly labelled *"Stored, but not searchable"*, so nothing is claimed falsely — but a clinician who uploads a results table gets no copilot help with it. Deliberate, and the right direction (C35: a wrong number behind a `[D7:3]` is worse than no citation), recorded so nobody later reads the false positives as a bug in the maths. Fix, if it matters: a table is a gap in the *same place on every line*; a two-column layout's gutter wanders. | minor | 11R | open — accepted |
| C72 | 11R | **`/ar/pricing` still falls back to English, and a sprint branch can carry copy production has already had corrected.** Re-checked on **production** during 11R: all 11 published `content_pages` rows are free of the old `$6 / Unlimited / 10%` copy — C60 stayed closed. But the *branch* database still held the pre-C60 pricing row, because it was forked before the merge fix and CMS content is data rather than schema, so no migration carried the correction across. Republished on the branch; production untouched. The residue: `pricing` has **no `ar` row** on either, so an Arabic visitor reads the English page. Sprint 18 is the bilingual sprint and this is squarely its work. **The general lesson, beside C60:** a Neon branch is a snapshot of data too, and a content fix made on production does not travel to a branch cut before it. | minor | 11R | open — **sprint 18** |
| C78 | 21 | 🔴 **"No language goes live until it is 100% translated" is right at launch and wrong forever after.** The rule as stated means one new string added anywhere silently takes a live language offline — add a button to the homepage and Spanish drops, with nobody able to explain why. **Ruling: completeness gates the *launch* of a language, not its *life*.** Once live, a new untranslated string falls back to the default, the language stays up, and it is raised loudly as an alarm with a deadline. | major | review | **ruled — sprint 21.12** |
| C79 | 21 | 🔴 **A machine translation published without a human is a clinical instruction nobody read.** Bulk AI translation is worth having and is in the plan; publishing straight from it is not. **Ruling: AI drafts, a human publishes.** A machine translation lands as a draft and counts as *missing* on the completeness checklist until somebody approves it — and crisis copy, consent wording and the recording notice can never be published from a draft at all, whatever a bulk action offers. | major | review | **ruled — sprint 21.17–21.19** |
| C80 | 18 | **A screenshot in a repository is permanent in a way a database row is not.** The purge in sprint 22 will not reach `docs/screens/`. So the sweep runs only against a seeded demo organisation of invented people and refuses otherwise — and **admin screens are swept but gitignored**, because an admin console shows many patients at once and the repository should be treated as if it will be public one day. Live components remain the default; a screenshot is a promise that expires silently. | major | review | **ruled — sprint 18.10–18.12** |
| C81 | 20 | **A 90-day lock on a mistyped phone number traps somebody for three months.** The lock is right — the number is the identity and changing it is how an account gets stolen. But a typo caught in the first hour is a correction, not a change. **Ruling: the lock starts 24 hours after the number is first confirmed.** | minor | review | **ruled — sprint 20.14** |
| C82 | 20 | **Support attachments are clinical material arriving through a non-clinical door.** A patient uploading a photo of a prescription to a support ticket has just sent us a medical record. Same storage, same audit, same access control as sprint 8's documents — and 🔴 **they never enter any prompt.** Likewise the closing email is patient data leaving the building under §6: audited, and carrying the correspondence rather than the attachments. | major | review | **ruled — sprint 20.19, 20.22** |
| C83 | 20 | **An overdue clock that runs while waiting on the patient measures the wrong person.** Staff would be marked down for a patient who replies in three days. The clock pauses when the ball is in the patient's court. Also: a ticket moved to WhatsApp leaves our record entirely — it is recorded as moved, with a written summary brought back, or the audit trail has a hole in exactly the conversations that mattered most. | minor | review | **ruled — sprint 20.20–20.21** |
| C84 | 12 | 🔴 **12.3's guard checks a symbol, not a behaviour, and reports zero while six client components still do the thing.** `verify-sprint12.ts` scans `"use client"` files for `readerZone(`. Six others never used the helper — they inline the identical construct, `Intl.DateTimeFormat().resolvedOptions().timeZone`, read during render — or format dates and money straight off the runtime: `booking-calendar.tsx:60` (**the public booking page**, and C61 was exactly this), `rating-form.tsx:84` (the public feedback page), `availability-editor.tsx:65` (where a therapist publishes hours), `timezone-settings.tsx:28`, `radar-command.tsx:374,559` (`toLocaleDateString()` / `toLocaleTimeString()` bare), `presence.tsx:703` (`toLocaleString()` bare), and `pay-flow.tsx:79`, which formats currency with the runtime's *locale* — the same mismatch in the same place, on the payment screen sprint 16 rebuilds. **Ruling: the check is behavioural or it is theatre.** Ban the construct, not the helper: no `Intl.DateTimeFormat()`, `toLocaleDateString`, `toLocaleTimeString` or `toLocaleString` may be called during render in a `"use client"` file, zone and locale both, with `useReaderZone()` the single sanctioned exception. This is the fourth checker in this repository to pass by matching the wrong thing — the first three matched their own prose, this one matched its own helper. | major | review | **resolved 12.3, second correction** — the guard now bans the **construct**: `Intl.DateTimeFormat(`, `Intl.NumberFormat(`, `toLocaleDateString`, `toLocaleTimeString`, `toLocaleString` in any `"use client"` file, with `useReaderZone()` the single sanctioned reader. Proved to fire against **all six** offending shapes, one at a time, before being kept — the previous version was proved only against a `readerZone()` call it already caught. Seven files fixed: `booking-calendar` and `rating-form` (the public funnel) take the therapist's zone as the server-side fallback and the reader's after mount; `availability-editor`, `radar-command` and `presence` take a prop; `timezone-settings` uses the hook, since offering the browser's zone is that screen's whole job; `pay-flow`'s money is pinned to a named locale via a new `formatMoney`. The inline `Intl.DateTimeFormat` in the availability editor moved into `tz.ts` as `formatWeekday` — §6's one-formatter rule, which the wholesale ban now enforces rather than merely stating ⬛ **One blind spot left, same sprint:** the walk covers `components/` and `app/` only, and six `"use client"` files sit outside them — including `lib/i18n/client.tsx`, which sprints 19 and 21 will grow. Clean today; the gap is not. Walk `lib/` too. |
| C86 | 13 | **A patient account still requires an email, and §3b says the email often does not exist.** 13.1 made the phone mandatory and unique; `patient_accounts.email` is still `NOT NULL` with its own unique index, and signup still asks for one. For the Egyptian caseload this is the wrong way round — the number is the identity and the address is the fallback — but making email nullable is a migration plus a rewrite of sign-in, password reset and `patient_accounts_email_unique`, none of which sprint 13 asked for. Flagged rather than silently done: **somebody with no email cannot create an account today**, which is a real exclusion in the market this product is for. | major | 13 | open — needs a ruling 🔴 **Ruled — sprint 15, and it is bigger than the email.** `password_hash` is `NOT NULL` too, so today an account needs an address *and* a chosen password while §3b says the identity is a phone number. The real ticket is a phone-first account: email optional, the WhatsApp code as the sign-in factor, password optional. That is sign-in, reset and the unique index rewritten — a sprint 15 piece, not a bolt-on to 13, and the sprint 22 purge means there are no live rows to migrate, only code. Correct call to flag it rather than do it quietly. |
| C87 | 13 | 🔴 **The three-strike lock is per *claim*, not per *record*, so a new code request buys three more guesses — and 13.8 says a mis-claim must be impossible, not unlikely.** 0043's own comment states the intent: *"an attacker with a fresh IP must not get a fresh budget against it."* The implementation does not hold it. On the third wrong name `answerName` sets `status = 'expired'`; `person_claims_open_unique` is partial on `WHERE status = 'pending'`, so the locked row leaves the index, `startClaim`'s `onConflictDoUpdate` no longer finds a conflict, and the next "send me a code" **inserts a fresh row with `name_attempts` at its `DEFAULT 0`**. Anyone holding the number — the recycled-number case in C75, or a household member — gets three guesses per code request, unbounded, against a first name. **Ruling: count the attempts on the (account, patient record) pair across every claim, not on the row**, and give the lock its own `status = 'locked'` rather than reusing `expired`, which today makes a lockout indistinguishable from a code that timed out. | major | review | **ruled — sprint 13R** |
| C88 | 13 | **Fixing C87 removes the only escape hatch there is.** The invite route is what C75 leans on today, and it works *because* a new claim resets the budget — close that and a patient who gave their therapist "Yasmine" and types "Yasmin" three times is locked out of their own record until sprint 20 builds the admin release. That is a support catastrophe traded for a security hole. **Ruling: the tightening and the release ship together.** The release lives with the therapist who owns the record — they created it, they know the person, and they are reachable today — as one audited action on the patient record. Admin gets the fuller tool in sprint 20; it must not be the *only* one. | major | review | **ruled — sprint 13R** |
| C85 | 13 | **Nothing stores a patient's time zone, so `useReaderZone` is permanent rather than temporary.** The hook is the right answer for a screen the server knows nothing about, but every patient screen now flashes UTC before correcting — including the consent list, where the date is the legally meaningful part of the record. Nobody has ruled on this. **Recommended ruling: sprint 13 captures the zone at signup** — detected in the browser, shown, editable, stored on `patient_accounts` beside the phone. Patient screens then take it as a prop exactly like the clinician ones, and `useReaderZone()` is left only for genuinely anonymous pages. The identity sprint is where a person tells us who and where they are; adding a column later means a second migration and a second sweep. | minor | review | **resolved 13.11–13.13** — `patient_accounts.timezone` (0043), detected in the browser by `useReaderZone`, **shown and editable** on signup, stored. Precedence is `resolveZone`'s existing shape: the account's, then `patients.timezone`, then the therapist's, then UTC. 🔴 Claiming never copies the account's zone onto the patient row — asserted in `verify-sprint13.ts`, because that row records what the browser said the day the booking was made and one account may hold records from two therapists |
| C73 | 16 | 🔴 **Holding money makes this a money transmitter, and that is now the plan.** §3c changes 1.8 deliberately, and the two cross-border crossings — USD collected for an Egyptian therapist, EGP collected for an international one — are the exposed ones. In the US that is licensing in roughly 48 states with bonds from $50k; in Egypt and the UAE it is central-bank licensing. The domestic Egyptian leg (EGP in, EGP out, one entity, one country) is a materially smaller question than the cross-border legs and should be separated when counsel is asked. | blocker | founder decision | **accepted, not resolved — 2026-09-06.** Founder's ruling: build it and ship it. The cross-border crossings may prove rare, and finding out is itself worth doing; counsel comes when there is traction to protect. **This row stays open permanently as a known, accepted risk** — it is not a blocker and it is not something anybody gets to be surprised by later. The code obligation is unconditional either way: a real ledger, one entity stamped per transaction, daily reconciliation to zero |
| C74 | 16 | **Manual payouts are three people, and people sleep.** A payout request that nobody picks up is money a therapist is owed and cannot see moving. The queue needs an age, an alert, and an owner per request — and a therapist-visible status, because "requested" with no date is how trust is lost. Also: a manual process is where the fraud is. Two-person approval above a threshold, and never the same person who edited the payout details. | major | review | open — **sprint 16** |
| C75 | 13 | **One phone, one account excludes real people.** A mother and daughter sharing a handset, a shared clinic phone, a recycled number that used to belong to somebody else. The invariant is right for safety and it will lock somebody out. There must be an admin path to release a number from a dead account — audited, never self-service, and never a way to take over a live one. | major | review | **still open, and 13.1 makes it sharper** — the unique index is now live on production, so a recycled number really can lock somebody out. The admin release path is sprint 20's (staff queue, audited, never self-service). Until then the escape hatch is the invite route, which binds a link to one record and does not consult the number at all |
| C76 | 16 | **Nobody has decided who absorbs the FX spread.** A price shown in EGP at a live rate and settled hours later at a different one leaves a difference. Freezing the rate on the transaction (16.6) fixes what the *reader* sees; it does not say whose margin moves when the real settlement differs. Decide it explicitly — platform absorbs, or the therapist does — and show it on the receipt. | major | review | open — **sprint 16** |
| C77 | 20 | **A language that is authored but hidden is a half-state nothing else models.** Turning a live language off mid-visit, a page translated into Spanish while its buttons are not, a `content_pages` row in a language the site no longer offers — each needs a defined behaviour. Sprint 19 must not hardcode "two languages" anywhere or sprint 20 rewrites it. | major | review | open — **sprints 19–20** |
| C69 | 16 | **"The session pays for itself out of your earnings" describes a mechanic that does not exist.** The platform never holds money (1.8, C6): Stripe Connect destination charges send the patient's payment to the clinician and the 15% to us, and the **session credit is a separate purchase**. Nothing nets one against the other. The requested framing is fair as economics — a $4 session fee against a $30 session you were paid for — but it must be written as arithmetic the reader can check, not as an automatic deduction, unless netting is actually built. | major | review of sprint 11 | open — **sprint 16 decides** |

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

## §3b · IDENTITY IS A PHONE NUMBER

Sprints 5–7 built the person layer around email, with the phone optional.
That was wrong for this market. In Egypt and the Gulf the number is the
identity and WhatsApp is the channel; the email often does not exist.

**The invariant:**

> **One phone number, one patient account.** A second account can never claim
> a number that is already claimed. **Two therapists may hold the same
> number** — two clinicians really do see the same person — and when that
> person signs up they see *both* claim requests and answer each separately.

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
- **Accept:** two therapists, one phone, one person — the person ends up with
      one account and two decisions, and no wrong record was ever visible.

### Sprint 13R — The lock, and the way out of it · ~3 days · 🔴 BEFORE 14

*(Sprint 13 is otherwise finished and verified: production ledger 45, all 45
hashes reconciled against disk, 18 checks, `challengePassed` correctly gated on
both questions. These two are one defect and its consequence, and they are
worth three days now rather than a support queue later.)*

- [ ] **13R.1** 🔴 **Count name attempts on the (account, patient record) pair,
      across every claim** — not on the claim row (C87). Today the third wrong
      name sets `status = 'expired'`, which drops the row out of the partial
      `WHERE status = 'pending'` index, so the next code request inserts a
      fresh row at `name_attempts` `DEFAULT 0` and the budget resets
- [ ] **13R.2** Give the lock **its own status**, `locked`, rather than reusing
      `expired`. A lockout and a code that timed out are different events and
      support cannot tell them apart today — and sprint 20's release path needs
      something to target
- [ ] **13R.3** 🔴 **The release ships in the same sprint as the tightening**
      (C88). Until now the escape hatch worked only because the budget reset;
      closing that without a release locks a real patient out of their own
      record until sprint 20
- [ ] **13R.4** The release is **one audited action on the therapist's own
      patient record** — they created it, they know the person, they are
      reachable today. Named actor, reason, timestamp. Sprint 20 adds the admin
      tool; it must not be the only one
- [ ] **13R.5** The verifier proves the budget does **not** reset: three wrong
      names, then a fresh code request, then a fourth attempt — refused. And
      that the release restores exactly one budget, to one record, for one
      account
- **Accept:** an attacker holding a recycled number cannot grind a first name
      three guesses at a time, and a patient who mistyped their own name can be
      let back in the same day by the person who wrote the record.

### Sprint 14 — No-show recovery · ~1 week

*(was sprint 12)*

- [ ] **14.1** 0–5 min: *"joining shortly"*. No blame
- [ ] **14.2** At 5 min: report, **and** the live radar inside the room
- [ ] **14.3** Only therapists at **equal or lower** price are offered
- [ ] **14.4** **Nobody suitable online → full refund and an apology.** Never
      leave them in an empty room
- [ ] **14.5** Reassign the session. Nothing transfers a session today
- [ ] **14.6** Paid more than the replacement charges → difference becomes
      patient credit, **expires 12 months**, applied after VAT
- [ ] **14.7** Reliability score from no-shows, on the public profile
- [ ] **14.8** Keep the existing warn → suspend ladder in `lib/data/feedback.ts`

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

### Sprint 19 — Arabic and English · ~1.5 weeks

*(was sprint 18)*

- [ ] **19.1** Every public page has an `ar` row **and** an `en` row. `pricing`
      has no `ar` row today, which is why `/ar/pricing` serves English
- [ ] **19.2** Every interface string in both languages. An English fallback
      for a UI string stays banned and type-enforced
- [ ] **19.3** Arabic is **right-to-left as a layout**, not translated English
      in a left-to-right frame
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

### Sprint 22 — Purge, rotate, launch · ~3 days · 🔴 THE GATE

Nothing here is code. It is the checklist that turns a test system into a live
one, and no real patient is invited before all of it is done.

- [ ] **22.1** `scripts/reset.ts` (12.6) run against production. Every table
      empty, admin re-seeded, settings re-seeded, CMS republished from defaults
- [ ] **22.2** **Every key rotated** — OpenAI, Deepgram, Daily, Resend, Stripe,
      the database, `CRON_SECRET`. The old ones were pasted into chats
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
- [ ] **22.9** 🔴 **After the purge, `VALIDATE` all five of 0042's constraints
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
| **Anything rendered on both passes takes its zone as a prop from the server.** `readerZone()` answers with the *server's* zone during SSR, never null — reading it during render is a hydration mismatch on every date (C70) | Hard |
| **No `"use client"` file calls `Intl.DateTimeFormat()`, `toLocaleDateString`, `toLocaleTimeString` or `toLocaleString` during render** — zone *and* locale, dates *and* money. `useReaderZone()` is the only sanctioned reader, because it runs in an effect (C84) | Hard |
| **A guard bans the construct, not the helper.** A checker scoped to one function name passes while six files do the same thing by hand. Four checkers here have now passed by matching the wrong text — three matched their own prose, one matched its own helper. Prove a guard fires against a deliberate offender *of the shape it claims to catch* | Process |
