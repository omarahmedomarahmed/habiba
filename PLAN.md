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
| C10 | 4 | **1.5 weeks is ~2× optimistic.** No `currency`, `vat_cents` or FX column exists on `session_payments`, `invoices` or `ledger_entries`; `ledgerEntries.currency` (schema.ts:1446) is the only one in the schema and defaults `'usd'`. Multi-currency + VAT is a migration across every money table and reader. | major | audit @2a3965d | open |
| C11 | 4.1 | **Already built.** `sessions.priceCents` (schema.ts:372) is set at creation (`sessions/actions.ts:59`, validated by `priceProblem`) and gates entry at `join/[token]/actions.ts:40`. Sprint 4's "first sprint that earns money" framing is wrong — paid links earn today. | minor | audit @2a3965d | **resolved sprint 1** — reworked to §3: cut, VAT lines and settings-driven bounds |
| C12 | 4.3 → 5 | **Ordering.** 4.3 saves payment preferences onto a patient row that 5.1 immediately re-parents under `people`. Land 5.1–5.3 first, or accept a second migration. | minor | audit @2a3965d | open |
| C13 | 1.5 | **Under-specified.** Three constants, not one: `INCLUDED_MINUTES = 30`, `MAX_MINUTES = 50`, `WARNING_MINUTES = 5` (`lib/session-clock.ts:44-50`). The ticket does not say what `INCLUDED_MINUTES` becomes, and it drives the *patient's* countdown. 12 clock tests assert current behaviour. | major | audit @2a3965d | **resolved sprint 1.5** — 50 running / 10 countdown / hard stop 60, all from settings |
| C14 | 1, 10 | **§3 changes copilot semantics, not just its number.** `plans.ts:22` = "per patient per **calendar month**", enforced in `lib/data/copilot.ts`. §3 = "10 per **session**, rolls over on that patient, expires 12 months". Different feature. Needs a ticket. | major | audit @2a3965d | **resolved sprint 1** — `checkQuota` recounts per session per patient with rollover |
| C15 | 6.3 | **Measured cost:** `Actor.organizationId` is non-null `string` (`lib/auth/session.ts:32`); 32 direct `actor.organizationId` reads, 192 `.organizationId` reads overall, across 52 files calling `requireUser`/`requireRole`. "Audit every consumer" is the whole sprint, not a bullet. | major | audit @2a3965d | open |
| C16 | 15 | **Admin is not greenfield.** 12 pages already exist under `app/(admin)/admin/` (`tv`, `usage`, `audit`, `errors`, `ratings`, `radar`, `taxonomy`, `therapists`, `verifications`, `vault`, `content`, `announce`). ~2 weeks may be right, but as extension work; the "built last so it can be verified" rationale does not apply to what is already shipped. | minor | audit @2a3965d | open |
| C17 | — | **H13 has no owner.** `client.ts:108` (`costCents = microcents/1000`) is itself correct. The hazard lives in consumers of `cost_microcents`; no sprint audits them. One ticket, cheap now, expensive after sprint 4 adds currencies. | minor | audit @2a3965d | open |
| C18 | 3 | **No acceptance measurement is possible from source.** "92% unattributed in-person, 12% video" and §3's "46 of 56 patients have no email" are DB claims; without C5 resolved neither the baseline nor the sprint-3 acceptance test can be run. | major | audit @2a3965d | **resolved** — Neon branch `sprint-1-settings` off `br-curly-dream`. §3 confirmed exactly: 56 patients, 46 with no email |
| C19 | 5, 6 | **46 of 56 patients have neither email nor phone**, not just no email — measured, `WHERE email IS NULL AND phone IS NULL` → 46. §3's claim flow keys on "email **or** phone" (step 1), so for 82% of existing patients there is nothing to match on and no path to claiming at all. Sprint 5.4's "match on email or phone" will find zero candidates for them. The plan needs an answer for a record whose only identifier is a name. | major | sprint 1 @f06b82c | open |
| C20 | 1 | **Scope taken beyond the ticket, deliberately.** 1.6 says "reprice to Starter $3/min 10, Growth $2/min 30" — but minimums are unsellable without something to buy. Added `session_credits` (purchase, expiry, oldest-first consumption) and replaced the `unlimited` Stripe subscription checkout with a one-time credit checkout. Without it 1.6 would have shipped three tiers a therapist could not reach. | minor | sprint 1 | **accepted, built** |
| C21 | 15 | **`invoices.kind` still has the value `subscription`** for what is now a credit purchase. Renaming means migrating every historical row and every reader for a label. Left as-is; `recordCreditPurchaseInvoice` says so at the call site. | minor | sprint 1 | open |
| C22 | 5, 6 | **§3's "unclaimed patient gets 5 credits, unlocked by a diagnosis and a history" cannot be enforced yet** — it needs the claimed/unclaimed state from sprint 5. `checkQuota` currently applies `unclaimedPatientCredits` as a floor for *every* patient, which is the more generous reading and cannot lock a therapist out of a patient they just added. Tighten when `people` lands. | minor | sprint 1 | open |
| C25 | — | 🆕 **There is no copilot in the room, and that is the real gap behind old 2.1.** `session-room.tsx` renders only `CopilotToasts` — passive one-line suggestions written from the transcript. A therapist who wants to *ask* something mid-session must leave the room for `/copilot`. Scoped as its own ticket per ruling, deliberately **not** absorbed into sprint 2. Needs: a room surface, the four access states from §3, and the per-session credit accounting from C14. Estimate ≥1 week on its own. | major | sprint 2 | open, unscheduled |
| C32 | 3 | **Sprint 3's acceptance cannot be fully met on existing data.** "No transcript line ends mid-word across a 10-session sample" is a claim about *recordings*, and every segment in this database was cut by the old 8-second metronome. The new rule only applies to audio recorded after it ships. Measured baseline via `scripts/measure-cuts.ts`: 311 interior cuts across 21 sessions, **24.4% end without terminal punctuation**, 5.5% are followed by a line reading as a continuation. Re-run after real sessions to close this. | major | sprint 3 | open — needs new recordings |
| C33 | 3 | **The backfill's labels came from the mock, not a model.** No `OPENAI_API_KEY` was available, so the first backfill ran against `tests/mock-openai.ts` with alternating speakers — machinery verified, labels meaningless. | major | sprint 3 | **resolved** — a real key was provided. All 160 mock labels were reset to `unknown` first (so the model started from truth, not from fiction), then re-run against `gpt-4o-mini`: 13 sessions, 151 segments, 31s. Coverage **in-person 91.9% → 12.2%**, **video 20.5% → 2.7%**. Quality hand-checked, see C35 |
| C35 | 3 | 🔴 **Diarisation quality is capped by chunk alignment, not by the model.** Hand-read two real sessions after the live backfill. Arabic (session `452f8851`, 18 lines read): ~15 clearly correct, including the code-switched *"كملي. What feelings come up for you?"* — labelled therapist, right. English (`1798409d`, all 27 lines): materially worse, and **almost every error is the same error** — the line contains *both* speakers, because the old 8-second cutter sliced across turn boundaries. Line 13 reads *"What made you decide to come here today? Um, well, as I told you, I wanna kill myself."* and is labelled `patient`: half right, and the half it gets wrong is a therapist question attached to a crisis disclosure. **Measured lower bound: 14.6% of labelled segments (22 of 151) contain an interior `?` or `؟`** — a turn boundary mid-line, where no single label can be correct. The true rate is higher, since a straddle needs no question mark. This is the strongest argument for 3.2: pause-aligned cutting should collapse this class directly, and until real sessions are recorded that way, backfilled labels on straddling lines are structurally at best half right. | major | sprint 3 | **resolved** — a straddling line is now left `unknown`, never labelled. Enforced twice: the prompt says so *above* the JSON schema (H2), and `straddlesTurnBoundary` refuses at the write whatever the model returns. Reclassified **18 of 151 (11.9%)** already-written labels. C32 still governs whether the underlying cause goes away |
| C34 | 3 | **H11's cap never actually bit on this data.** Measured before backfilling: 0 of 22 sessions exceed 160 segments — the longest is 95. So the fix matters for the 60-minute sessions sprint 1.5 just made possible, not for anything already recorded. Worth stating so nobody reads the backfill's improvement as evidence the cap was the cause; the cause here was the two-track guard and in-person sessions having no second track at all. | minor | sprint 3 | noted |
| C30 | 2 | **The "someone is looking" toast was removed, not just relocated.** The orb says the same sentence permanently in the same corner, so the two overlapped and told the clinician the same thing twice. The *booking* card stays — that one is an interruption, not a status, and the orb steps aside for it (`liftedForBooking`). | minor | sprint 2 | **resolved** |
| C31 | 2.5 | **`savePractice` cannot be used for a single toggle.** It takes the whole practice payload, so driving it from a floating control would rebuild name, address and coordinates from nothing and silently erase them. Added `setAcceptsWalkIns`, a conditional UPDATE that refuses to publish an address which has not been confirmed — and never guards turning it *off*, because somebody withdrawing consent to be visited must not be told they cannot. | minor | sprint 2 | **resolved** |
| C27 | 2.5 | **"Access state" in 2.5 could not be built.** The four copilot states in §3 are defined by claimed/unclaimed and by `historyGrants`, which arrive in sprints 5–7. `/on-call` shows everything else the ticket asks for; the access column is deliberately absent rather than faked with a placeholder that would always read the same. Revisit after sprint 7. | minor | sprint 2 | open |
| C28 | 2.5 | **Copilot questions had no session attribution.** `copilot_messages.session_id` was written only on `session_note` rows — measured: 97/97 notes, **0/23 therapist questions**. So "credits used per session" had no answer. Now stamped when the question is asked during a live session with that patient. **Historical rows are not backfilled** and must not be: nothing recorded which session those 23 belong to, and inferring it from timestamps would invent an attribution nobody can check. | minor | sprint 2 | **resolved going forward** |
| C29 | 1 | **Stale copy left behind by sprint 1.** The copilot quota error still said "…for this patient this month. Unlimited removes the cap." The allowance is no longer monthly and there is no Unlimited plan — telling a clinician to wait for a reset that never comes, or to buy something that does not exist, is worse than the cap. Found while building 2.5; fixed there. A reminder to sweep user-facing strings when semantics change, not just the code. | minor | sprint 2 | **resolved** |
| C26 | 12 | **20 of 59 sessions have no `feedback_token` at all** — rows predating the column. Those sessions can never be rated and their patients can never receive a brief. Harmless today (all completed long ago) but sprint 12's reliability score is computed from feedback, so it will read those therapists as unrated rather than unratable. One backfill, or an explicit exclusion. | minor | sprint 2 | open |
| C23 | 2 | **`sessions.extendedAt` is now written by nothing but still read** by the session detail page and admin Total View, which show "· Extended" for historical rows. That is correct — those sessions really were extended — but the column will look like dead schema to the next reader. Documented at the top of `lib/session-clock.ts`. | minor | sprint 1 | open |
| C24 | all | **One test fails on `main` and still fails here** — `radar.test.ts:19`, "a finished session still resolves for feedback". Verified pre-existing by stashing this branch and re-running at `7f883e2`: identical failure. Not caused by sprint 1, and not fixed by it. Needs an owner. | major | sprint 1 | **resolved in sprint 2** — the test was stale, not the code. It asserted the *join* token reaches the feedback page; the two-token design deliberately makes that false. Measured: 0 of 59 sessions have `join_token = feedback_token`. Rewritten to assert the real invariant, plus that the dead join token is *not* a second key |

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

## §4 · SPRINTS

**Ordered by who is waiting.** Therapists are live on this product today, so
their pain ships first — sprints 2 and 3 are fixes to things they use every day.
Revenue comes next. The patient-side rebuild is foundation work with nothing
visible until sprint 13, which is why it sits after the parts that pay for it.

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

- [ ] **4.1** Price on session creation. `$0` = today's direct link, unchanged
- [ ] **4.2** `/pay/[token]` — patient picks **country first**, then sees
      currency, exchange rate and their country's methods
- [ ] **4.3** Save the patient's payment preferences
- [ ] **4.4** FX quote fixed for **1 hour**, stored with the payment
- [ ] **4.5** 15% cut + VAT, shown to patient and therapist as separate lines
      with reasons — never one number
- [ ] **4.6** Session type recorded: free link · paid link · radar · scheduled

### Sprint 5 — Person layer · ~1 week · FOUNDATION

- [ ] **5.1** `people` above `patients`; `patients.personId` nullable at first
- [ ] **5.2** `people.claimedAt` — null means unclaimed
- [ ] **5.3** Backfill: every patient becomes its own person. **No merging**
- [ ] **5.4** Match on email **or** phone. Suggest only
- [ ] **5.5** **Server-side rule:** unclaimed can never be shared, granted or
      merged
- 🔴 **Never auto-merge.** A wrong merge puts one person's trauma in a
      stranger's file and a clinician treats them on it.

### Sprint 6 — Patient accounts · ~1 week · FOUNDATION

- [ ] **6.1** Add `"patient"` to `ROLES`
- [ ] **6.2** 🔴 **Separate patient identity table — not a nullable
      `organizationId`.** Nullable voids `users_org_email_unique`, because
      Postgres treats NULLs as distinct: one email, unlimited signups
- [ ] **6.3** `Actor.organizationId` → `string | null`. **Audit every consumer**
- [ ] **6.4** `requirePatient()` mirroring `requireUser()`
- [ ] **6.5** Signup, signin, reset — reuse `lib/auth/*`
- [ ] **6.6** Fix `middleware.ts` — a signed-in patient lands on the therapist
      dashboard today
- [ ] **6.7** `app/(patient)/` route group
- [ ] **6.8** The claim flow, all eight steps from §3
- [ ] **6.9** Verification by email or WhatsApp
- [ ] **6.10** 🆕 **Invite-link claim route** (§3). Bound to one record, single
      use, expiring, revocable, never sent by us. The only route that works for
      the 46 of 56 patients with no contact details at all

### Sprint 7 — Consent · ~4 days · FOUNDATION

- [ ] **7.1** `historyGrants` — person, therapist, granted, expires, revoked
- [ ] **7.2** Two shapes: **24 hours**, or **open-ended until revoked**
- [ ] **7.3** Request access with a note. Rate-limited against spam
- [ ] **7.4** Patient rejects freely — silently, or with a preset reason
- [ ] **7.5** Revoke in one tap, effective immediately
- [ ] **7.6** Audit every grant, denial, expiry, revocation and read
- [ ] **7.7** Copilot honours the four states in §3
- [ ] **7.8** Two consent controls in the room, per §3. Note stamped when
      recording started late

### Sprint 8 — Personal Profile · ~1.5 weeks

- [ ] **8.1** Documents on the person: upload, type, dictate
- [ ] **8.2** **Accept any format** — PDF, Word, scans, photos. Raise the 8 MB
      cap
- [ ] **8.3** Text we can read is chunked on a worker, not a request handler (H9)
- [ ] **8.4** An image we cannot read is still stored, shown and zoomable, and
      labelled *"image — not searchable"* so nobody assumes the copilot read it.
      **No OCR**
- [ ] **8.5** `[D7:3]` citations that resolve or are discarded
- [ ] **8.6** Click a citation, see the exact passage
- [ ] **8.7** Provenance — which therapist, which date
- [ ] **8.8** Flag a document, phrase or diagnosis as outdated or wrong
- [ ] **8.9** Diagnosis fields — **extract only what is written**, show the
      source sentence, require confirmation. Never inferred from symptoms
- [ ] **8.10** Read-only viewer, watermark, audited. **Server-side speech — the
      text never reaches the browser**

### Sprint 9 — Memory and homework · ~1.5 weeks

- [ ] **9.1** Rolling profile, regenerated from sources after each session and
      document. Dated, cited, **never hand-edited into permanence**
- [ ] **9.2** Dated observation timeline
- [ ] **9.3** Copilot cites history alongside sessions, marking which is which
- [ ] **9.4** **Sessions outrank history.** Surface conflicts, never resolve
- [ ] **9.5** Homework: `NoteContent.patientSteps` already drafts it. Add
      therapist authoring, patient completion, history across sessions
- ⚠️ A completion rate shown to a depressed patient is a scoreboard of their
      failures. Trend to the therapist; next action to the patient.

### Sprint 10 — General copilot · ~4 days

- [ ] **10.1** Chat box on the therapist home
- [ ] **10.2** Roster only — names, next appointment, draft count. **No clinical
      content in context.** The guarantee comes from what is absent, not from
      what the prompt says
- [ ] **10.3** Patient names as links, **validated server-side against the real
      roster** so a hallucinated name can never become one
- [ ] **10.4** Multiple threads: pick, continue, delete
- [ ] **10.5** **50 messages per month**, across all threads
- [ ] **10.6** Preferences on first use — language, voice, playback speed.
      Editable later

### Sprint 11 — Scheduling · ~1.5 weeks

- [ ] **11.1** `availability_slots` — whole hours only, 19:00–20:00, never 19:15
- [ ] **11.2** `sessions.scheduledAt`
- [ ] **11.3** Booking calendar on the public profile
- [ ] **11.4** Radar escape hatch: *"not urgent? see their calendar"*
- [ ] **11.5** Auto-offline as a booked slot approaches
- [ ] **11.6** Mid-session warning about an upcoming booking
- [ ] **11.7** Confirmation and reminder emails
- ⚠️ Needs the Resend domain verified before real patients get reminders. Being
      arranged — build it, do not wait on it.

### Sprint 12 — No-show recovery · ~1 week

- [ ] **12.1** 0–5 min: *"joining shortly"*. No blame
- [ ] **12.2** At 5 min: report, **and** the live radar inside the room
- [ ] **12.3** Only therapists at **equal or lower** price are offered
- [ ] **12.4** **Nobody suitable online → full refund and an apology.** Never
      leave them in an empty room
- [ ] **12.5** Reassign the session. Nothing transfers a session today
- [ ] **12.6** Paid more than the replacement charges → difference becomes
      patient credit, **expires 12 months**, applied after VAT
- [ ] **12.7** Reliability score from no-shows, on the public profile
- [ ] **12.8** Keep the existing warn → suspend ladder in `lib/data/feedback.ts`

### Sprint 13 — Patient app · ~1.5 weeks

- [ ] **13.1** Bottom nav, globe centre and highlighted
- [ ] **13.2** Home: *"Welcome, name"* + globe, expanding to the full map
- [ ] **13.3** Sessions labelled by type: **upcoming today · scheduled future ·
      past scheduled · past instant from radar**
- [ ] **13.4** Their own patient-version notes
- [ ] **13.5** Homework, grouped by session, with reminders
- [ ] **13.6** Billing — every session as a bill, VAT and platform cut shown,
      plus credits
- [ ] **13.7** Consent screen: who has access, which shape, revoke
- [ ] **13.8** 🔴 **Server-side block: a patient never sees a transcript or a
      clinical note**

### Sprint 14 — Payments by country · ~1.5 weeks

- [ ] **14.1** Provider registry per country, admin-managed. **Build the
      abstraction so adding Paymob or Paymint is configuration, not code** — the
      Egyptian entity and the provider contracts are being arranged in parallel
- [ ] **14.2** A provider has many methods — Paymob → Instapay, Vodafone Cash
- [ ] **14.3** Country locks currency: no USD in Egypt, no EGP in the US
- [ ] **14.4** Keys as environment variables, presence checked at boot
- [ ] **14.5** Payout preferences: country, then available methods
- [ ] **14.6** Wallet screen — **display only**, showing what Connect will pay

🔴 **Do not hold therapist balances.** Closed in sprint 1.8 — this sprint must
not reopen it. Holding money and paying it out later makes this company a money
transmitter: ~48 US state licences with bonds from
$50k, Central Bank licensing in Egypt and the UAE. Stripe Connect exists so we
never touch it. The wallet is a screen over Connect, or a licensed local partner
is the payer of record. **Not our balance sheet.**

### Sprint 15 — Admin · ~2 weeks · LAST

Built last so it can be verified against everything that already exists.

- [ ] **15.1** Edit every pricing figure — rates, tiers, included, copilot caps
- [ ] **15.2** VAT and currency per country
- [ ] **15.3** Payment providers per country, integration status, and which
      countries have none
- [ ] **15.4** 🆕 **Verification requirements per country** — authority name,
      licence name, ID number format, sample photo. Hardcoded today
- [ ] **15.5** Therapist credentials by country
- [ ] **15.6** Margin per session from real usage
- [ ] **15.7** Total View extended to everything above
- **Accept:** every number in §3 is editable without a deploy, and admin can see
      and correct anything built in sprints 1–14.

## §5 · BUILD LOG

| Date | Sprint | What | Commit | Verified how |
|---|---|---|---|---|
| 2026-09-04 | 1.1–1.3 | `platform_settings` (4 jsonb groups) + `country_settings`; typed accessor `lib/settings` with per-field fallback | *this* | Migration `0029` verified against `information_schema`: 12 columns, all present (H1). `npx tsx scripts/settings.ts show` prints the seeded rows |
| 2026-09-04 | 1.4 | H12 — transcribe costing now reads `input.model`; both branches look the model up and fall back to the **dearest** rate, never zero | *this* | 3 new tests in `safety`: two rates cannot collapse into one; an unpriced model overstates; H13's 1e5 divisor |
| 2026-09-04 | 1.5 | Clock is 50 running → 10-minute countdown on **both** screens → hard stop at 60. `decision`/`extended` stages and `extendSession` removed | *this* | `clock` suite rewritten, 12 tests. One runs the whole ladder at 20+2 minutes (H4) and one at a zero-length countdown |
| 2026-09-04 | 1.6 | Repriced: PAYG $4 · Starter $3/min 10 · Growth $2/min 30; cut 10%→**15%**; cap $1,000→**$500**. New `session_credits` table makes the tiers purchasable | *this* | Migration `0030`: 12 columns, 3 indexes. `verify:sprint1` asserts every figure against the live rows |
| 2026-09-04 | 1.7 | Every therapist moved to PAYG; `unlimited` removed from `PLANS`, from Stripe checkout, and from the pricing page | *this* | `SELECT DISTINCT plan FROM subscriptions` → `payg` only, 36 rows, 0 stragglers |
| 2026-09-04 | 1.8 | `createSessionCheckout` **refuses** a payment when the clinician has no transfer-capable Connect account, instead of capturing to our own balance | *this* | Only one `capture` value is now reachable (`"destination"`, typed `as const`). `verify:sprint1` confirms 0 historical `platform` rows — the door closed before anything went through it |
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
