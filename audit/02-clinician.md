# Audit 02 - The clinician, and the money

Beat: `app/(app)/**`, `app/(room)/**`, `components/session/**`, `lib/billing/**`,
`lib/data/sessions.ts`, `patients.ts`, `copilot.ts`, `facts.ts`, `memory.ts`,
`grants.ts`, `session-risk.ts`, `lib/auth/guard.ts`.

Method: read the code for every finding below, then searched for a matching
concern in PLAN.md §2 (C1 to C366) before writing it up. Where I state a
control held, I name what I searched and what a violation would have looked
like, per the brief's own rule that an absence proves nothing without one.

---

## 1. The copilot reads the live session it is supposed to be blind to

**Invariant 11: the copilot reads the record as of `startedAt` and nothing
after it, identically whether consent was granted, declined or withdrawn.**

| Field | Detail |
|---|---|
| What | The in-room copilot's "as of `startedAt`" bound filters which *other* sessions are pulled into context by `sessions.createdAt`, but never excludes the current live session itself. For any patient with fewer than `MAX_SESSIONS` (12) sessions on file, which is most patients early in treatment, the session being asked about is included in its own context, and its full transcript so far (everything said moments ago) is handed to the model as ordinary history. |
| Where | `lib/ai/case-copilot.ts:239-253` (`buildPatientContext`, the query `and(eq(sessions.patientId, patientId), lt(sessions.createdAt, before))` has no clause excluding the current session's own id); `lib/ai/case-copilot.ts:268-273` (the transcript-segment read for each included session has no time bound at all, just `eq(transcriptSegments.sessionId, session.id)`, up to 220 rows); `app/(app)/copilot/actions.ts:119-142` (`askPatientCopilot` is called with `liveSince: live?.startedAt` but is never given `live.id` to exclude). |
| Who is harmed | The patient. The rule exists specifically so a therapist cannot use the copilot to "catch up on the last ten minutes" (the code's own comment at `case-copilot.ts:227-229`), and the system prompt separately instructs the model to say "I only know what came before this session." But the data handed to the model contradicts that instruction: a session row's `createdAt` (set at booking) is essentially always earlier than its own `startedAt` (set when the room opens), so the live session passes the `lt(createdAt, before)` filter and is rendered into the prompt exactly like an ordinary past session, header, date and `[S_N:seq]` references included, with nothing marking it as the forbidden one. This applies with consent granted, declined or withdrawn alike, since the bound is meant to be the *only* thing standing between the model and "what the patient just said." |
| Severity | blocker |
| Already known? | C211 is the ruling that created this bound (sprint 48.4/48.5), described as "one bound, no branch." I searched PLAN.md for a concern naming this specific gap (current-session exclusion, or an unbounded segment read) and found none: C211 asserts the design intent, not that the query was checked against it. This is the ruling not fully built, not a duplicate. |

Control I ran to be sure this was not a false read: I checked whether any
other parameter (session id, status) narrows the query - it does not; the
only filter besides patient id is the `createdAt` comparison. I also checked
whether `MAX_SESSIONS=12` with ascending order would reliably exclude the
current session for a long-established patient - it would only once a
patient has passed 12 prior sessions, which makes the defect *more* likely
to hit early in treatment, the period this product markets itself on.

---

## 2. Switching a monthly plan opens a second live Stripe subscription

**Attack 4: the new subscription, built two days ago.**

| Field | Detail |
|---|---|
| What | `subscribeTo` (used both to buy a first plan and, per the UI, to "switch" an existing unlimited plan to a different tier) always opens a brand new Stripe Checkout in `mode: "subscription"`. Nothing cancels the therapist's existing Stripe subscription first. Since the local `subscriptions` table has one row per organisation (`subscriptions_org_unique`), the second checkout's webhook simply overwrites the row's `stripeSubscriptionId`, plan and status - the app now shows only the new plan, while the old Stripe subscription is still live and still renewing. |
| Where | `components/billing/plan-card.tsx:249-264` (the "switch to" button, rendered only when already `unlimited`, calls `subscribeTo(tier.key)` directly, with no cancel step); `app/(app)/billing/actions.ts:55-68` (`subscribeTo` has no check for an existing subscription); `lib/billing/stripe.ts:186-246` (`createSubscriptionCheckout` validates the *target* tier but never looks at whether the org already has a live `stripeSubscriptionId`, and never calls `cancelSubscription` on it); `lib/db/schema.ts:1665-1688` (`subscriptions_org_unique` - the schema has no room to record two Stripe subscription ids for one org, so the old one becomes untracked, not cancelled). |
| Who is harmed | The therapist. Stripe will charge both subscriptions on their own monthly cycles (for example $99 Practice and $179 Clinic, $278/month total) while the product's own screen shows one plan, one price, one "renews on" date. This compounds: `invoice.payment_failed` (`lib/billing/stripe.ts:600-617`) resolves the organisation from the Stripe **customer** id alone and blindly sets whatever subscription row currently exists to `past_due` on any failed invoice for that customer, so a failure on the abandoned old subscription can silently downgrade the currently-paid plan's status. And `mirrorSubscription` (`lib/billing/stripe.ts:459-512`) upserts by organisation id from *any* subscription event that carries that org's metadata or customer id, so a stray renewal of the forgotten old subscription can silently roll the therapist's plan key and period end back to the old tier. |
| Severity | blocker |
| Already known? | Sprint 57's own checklist (57.3) marks "switch" as delivered ("the therapist portal card shows the plan, the date, switch, cancel and resume"). I found no C-number addressing plan-to-plan switching specifically; C294 covers entitlement against a period for a single subscription, not two concurrent ones. Genuinely new. |

---

## 3. `abandonSession` ignores the session's own state machine

**Attack 7: the cancel button added yesterday.**

| Field | Detail |
|---|---|
| What | The file that defines how a session may legally change status also defines `cancelSession`, which does not consult that table. A completed, billed session with a signed note can be flipped to `cancelled` by calling the same server action the "Cancel" button calls. |
| Where | `lib/data/sessions.ts:339-344` - the `TRANSITIONS` table: `completed: []`, i.e. no legal transition out of `completed`. Compare `startSession` (`lib/data/sessions.ts:348-367`) and `completeSession` (`lib/data/sessions.ts:513-527`), both of which read `TRANSITIONS[current.status]` and throw `TransitionError` when a transition is not listed. `cancelSession` (`lib/data/sessions.ts:576-581`) does neither: `db.update(sessions).set({status:"cancelled", joinToken:null, ...}).where(and(scope(actor), eq(sessions.id, sessionId)))` - no read of the current status, no reference to `TRANSITIONS` at all. `abandonSession` (`app/(app)/sessions/actions.ts:348-354`) calls `cancelSession` with nothing extra. `components/session/cancel-session.tsx` only *renders* the button when `live` is true (`app/(app)/sessions/[id]/page.tsx:65,165`) - that is a client-side render condition, not a server check; the exported server action itself takes no status argument and enforces none. |
| Who is harmed | Every principal who relies on the session record being honest once it is `completed`: the therapist's own billing history (the invoice raised by `chargeForSession` is never reversed by `cancelSession`, so a "cancelled" session can sit beside a paid invoice for it), and the clinical record (an approved, patient-releasable note can remain attached to a session the product now displays as cancelled and unbilled). This is exactly the "does the screen tell the truth about what will happen" question the brief opens with - a session marked cancelled implies nothing was charged and nothing was written, and after a completed session neither is true here. |
| Severity | blocker |
| Already known? | PLAN.md cites C359 for `abandonSession`, but only for **reachability** - sprint 58's `verify:reachable` found that no screen called the function at all, and 58.1 built the button to fix that. Nothing in C359 or elsewhere addresses that the function itself, once reachable, has no status guard. Genuinely new, and arguably worse than the original defect: the fix for "you can't cancel a mistake" shipped without the one check that would have kept it to mistakes. |

Belonging-to-somebody-else is closed correctly: `scope(actor)` (`lib/data/sessions.ts:46-53`)
restricts both the read and the update to the caller's own caseload, so a
guessed session id belonging to another clinician's session is a silent
no-op, not a leak. I checked this specifically because it was the third
thing the brief asked about for this button.

`releaseClaim` (`lib/data/radar.ts:914-930`) does not appear to be corruptible
by this bug: it only clears a radar slot whose `pendingSessionId` still
equals the cancelled session's id, so cancelling an old, already-completed
session (whose radar slot has long since moved on to something else) is a
no-op there rather than a corruption of the *current* claim.

---

## 4. C74's two-person payout approval is a code path, not a database rule

**Attack 5: earnings and payouts.**

| Field | Detail |
|---|---|
| What | The requirement that a payout above a threshold needs a second person to take ownership before approval, and never the person who last edited the payout's destination, is checked entirely in application code inside `approvePayout`. The actual row transition (`move()`) enforces nothing beyond "status is still `requested`." Nothing in the schema (no `CHECK`, no trigger) stops a direct update, a different call path, or a future refactor of `approvePayout` from approving a large payout single-handedly. |
| Where | `lib/billing/payouts.ts:301-344` (`approvePayout`: the self-approval check, the last-editor check and the two-person-threshold check are all `if` statements over values read into JS); `lib/billing/payouts.ts:247-285` (`move()`, the only function that actually writes the status transition, guards its `UPDATE` solely on `inArray(payoutRequests.status, input.from)` - the two-person rule plays no part in the `WHERE` clause that makes the write succeed or fail). |
| Who is harmed | The platform and, indirectly, every therapist waiting in the manual payout queue - the safeguard this repository built specifically because "a manual payment queue is where fraud lives" (§3d) has no backstop below the application layer that reads and calls it. |
| Severity | major |
| Already known? | C74 (§3d, 16.3d) mandates the rule but does not specify where it must be enforced. I checked this because the brief asked directly whether C74 is "enforced by the database rather than by a code path," and it is not. This repository's own standing rule - "one source of truth per invariant, and it is the one the database enforces" (the lesson C285 is written up under, §6) - is not applied to this invariant. I am recording this as the same lesson unapplied elsewhere, not as a restatement of C285 itself. |

---

## 5. A payout request has no database-level defence against a duplicate

| Field | Detail |
|---|---|
| What | `requestPayout` checks "is there already an open request" with a plain `SELECT` immediately before its `INSERT`, with no unique constraint behind it. |
| Where | `lib/billing/payouts.ts:165-243`. The held balance is read (`heldForTherapist`), then a separate query checks for any row in `("requested","approved","sent")` for that therapist, and only if that comes back empty is a new row inserted. I checked `payoutRequests` in `lib/db/schema.ts` for a unique index scoped to therapist and open status and found none - the only guard is this read-then-write. |
| Who is harmed | The platform (over-commitment against a single held balance) if two submissions race - a double-click, two tabs, or a retried request after a slow response - both pass the "no open request" check before either commits. |
| Severity | major, marked as hypothesis: I read the code and the schema; I did not have a database to fire two concurrent requests against to confirm the race actually lands both rows. What I would have needed to fully confirm it is named in "What I could not verify" below. |
| Already known? | No matching C-number found for double-submission on a payout request specifically. |

FX freezing on a payout *is* done correctly: `requestPayout` calls `quoteFor`
once and stores `fxRateMicro`/`fxQuotedAt`/`payoutAmountMinor` on the row
(`lib/billing/payouts.ts:202-220`), so a rate move after the request cannot
change what is paid. I checked this because the brief asked directly whether
the rate is frozen, and it is.

---

## 6. The split fee (C209 / sprint 57 / sprint 46) checks out

I read `sessionLines` and `entitledTier` (`lib/billing/plans.ts:53-207`)
looking specifically for the four things the brief named: a session raising
no line at all, a subscriber billed twice per session, a therapist reaching
a plan without paying, and a plan key granting entitlement it should not.

- A session always raises a platform line, at the full fee or at zero when
 `tier.monthlyCents > 0`; it never raises zero lines (`plans.ts:196-201`).
- `currentTier` (`lib/billing/credits.ts:375-...`) and `chargeForSession`
 (`lib/billing/service.ts:70-101`) both resolve the tier through
 `entitledTier`, not a raw `subscription.plan` lookup, so a session is
 priced against the same clock-aware entitlement rule the plan page shows.
- `createSubscriptionCheckout` validates the tier key and its monthly price
 against live settings before calling Stripe (`lib/billing/stripe.ts:194-199`),
 so a crafted tier key cannot buy a cheaper plan than is on offer, and a
 tier that is pay-as-you-go (`monthlyCents <= 0`) is refused as a
 subscription target.
- `tierForSpend` filters to `monthlyCents === 0` tiers only (`plans.ts:56`),
 so no amount of session credit reaches a subscription (C290's fix holds).

One loose thread, minor: `applyCheckoutOutcome`'s subscription branch
(`lib/billing/stripe.ts:347-373`) upserts `status: "active"` without checking
`session.payment_status === "paid"` first, unlike the adjacent
`credit_purchase` and `session_payment` branches in the same function, which
both gate on it. In ordinary Stripe behaviour a subscription-mode checkout
only reaches `checkout.session.completed` once the first invoice is paid, so
I could not construct a live path where this matters, but the asymmetry
with its neighbours in the same function is worth a second look. Marked
minor / hypothesis.

---

## 7. Verification: the source of truth is right; the verifier that guards it is narrower than it claims

**Attack 6.**

C285 (0083, `drizzle/0083_verification_one_truth.sql`) is built correctly
and I could not break it. The migration installs a `BEFORE INSERT OR UPDATE`
trigger on `users` that *forces* `verification_status` to
`derived_verification_status(id)` on every write, so any application code
that still tries to set the column by hand is neutralised at the database
layer, not merely discouraged. I confirmed the surfaces the brief named
specifically read the derived source rather than the cached column:

| Surface | Reads |
|---|---|
| Public radar | `isVerifiedClinician()` (`lib/data/radar.ts:23,329,544,1104`) |
| Partner API (identity, roster, launch) | `verifiedFlag()` (`lib/partner/api.ts:16,66,176,242`), `verifiedFlag()` (`lib/partner/launch.ts:17,125,209`) |
| Clinic portal | `users.verificationStatus` displayed read-only (`lib/data/clinic.ts:76-97`), which is now safe to read directly because the trigger makes it a true mirror |

So an unverified clinician cannot reach the radar, take a booking, or be
asserted verified to a partner or a clinic through any of the paths I
checked - each asks `therapist_verifications` directly or through the
forced column, never a value application code could have set.

| Field | Detail |
|---|---|
| What | `verify-c285.ts`'s static check that "the approval path no longer mirrors onto the user row by hand" reads exactly one file (`lib/data/verification.ts`) for the banned pattern. `lib/data/admin.ts:144-168` (`setVerification`, the actual function the admin console calls to approve a clinician) still contains that exact pattern - `db.update(users).set({verificationStatus, ...})` - and is never scanned. |
| Where | `scripts/verify-c285.ts:53-59` (`readSource("lib/data/verification.ts")`, single file); `lib/data/admin.ts:156-159`. |
| Who is harmed | Nobody today - the trigger neutralises the write regardless of which file performs it, confirmed by reading `0083_verification_one_truth.sql` itself ("piece 3 FORCES rather than RAISES... writes to it are not refused, they are irrelevant"). The harm is to confidence in the gate: its own pass/fail line asserts a codebase-wide property while testing one file, which is exactly the "check that measures the wrong thing" pattern this repository has logged thirteen times over. |
| Severity | minor |
| Already known? | C285 is ruled and the underlying mechanism is sound. This is a gap in the verifier's coverage, not the invariant, so it is new rather than a restatement. |

---

## 8. Invariant 1 - I tried to find a delete path and could not

I searched every `.delete(` call in the repository (`app/`, `lib/`,
`components/`) against `sessions` and `patients`. Every hit lives in
`scripts/verify-*.ts` or `tests/*.ts` fixture teardown, run outside the
product, against a database seeded by the same script. None is reachable
from `app/(app)`.

- `app/(app)/patients/actions.ts:163-179` carries an explicit comment
 recording that `deletePatient` was removed from the file entirely, with
 the reasoning (retention law, six-plus years, a deleted chart after a
 complaint is destroyed evidence). This is a positive control: the capability
 was deliberately withdrawn rather than merely hidden from a menu.
- `app/(app)/patients/import/actions.ts` is create-only; `commit` calls
 `importPatients`, never a delete or replace.
- The EHR writeback (`lib/ehr/fhir.ts`) exposes exactly one write operation,
 `fileDocumentReference` (create), and declares
 `READ_THROUGH_IS_NEVER_STORED = true`. No update or delete function exists
 in the module.
- Cascades in `lib/db/schema.ts` that touch `users.id` or `organizations.id`
 with `onDelete: "cascade"` (for example `authSessions`, `authTokens`,
 `therapistVerifications`) require a `users` or `organizations` row to be
 deleted first, and I found no reachable action that deletes either from
 `app/(app)`.

I did not find the path. I am recording the search and the specific control
(the comment in `patients/actions.ts`) rather than a bare "found nothing,"
per the brief's own rule that an absence needs to show what it checked.

---

## 9. Sprint 62 (clinic seats) - arithmetic and a spec gap

Not built (`grep` for `seats` across `lib/` and `app/` returns nothing), so
this is a review of the plan text, PLAN.md:4022-4059, not of code.

| Field | Detail |
|---|---|
| What | The published table is internally consistent for the one boundary it calls out (2 to 3 seats, +$91, flagged by 62.2) but produces a smaller, undisclosed jump at the next boundary: 4 seats at $90 each is $360; 5 seats at $80 each is $400 - a marginal cost of **$40** for the 5th seat, cheaper than the $90 marginal cost of the 4th and the $91 marginal cost of the 3rd. The retroactive design (correctly specified by C351, "the remainder... recomputed at the new rate... shown before the click") means every tier boundary is a cliff, not only the one 62.2 names, and the plan only requires disclosure "before the click" in general terms rather than naming that more than one cliff exists. |
| Where | PLAN.md:4027-4031 (the table), PLAN.md:4035 (62.2, names only the 2-to-3 jump). |
| Who is harmed | A clinic admin who reads 62.2's example and reasonably assumes the 2-to-3 jump is the only unusual one; the actual schedule has a non-monotonic marginal price at seat 5, which is the kind of number worth stating rather than discovering, exactly the standard this plan applies to the EGP exchange rate (C76) and the 2-to-3 jump itself. |
| Severity | minor |
| Already known? | C351 rules on retroactive recomputation generally; I found nothing naming this specific non-monotonic step. New, and cheap to fix in the spec before 62.2's disclosure copy is written. |

| Field | Detail |
|---|---|
| What | The plan specifies what happens when a therapist already on Practice or Clinic joins a clinic (C329, C355: their own subscription cancels at period end, the seat is not billed until then) but does not say what happens when the joining therapist is on **pay as you go**, with no current subscription period to wait for. |
| Where | PLAN.md:4044-4047 (62.6, 62.7 / C355, C329), both phrased in terms of "the joining therapist's own subscription period." |
| Who is harmed | Whoever builds sprint 62 against this text as written would have to invent the pay-as-you-go case unassisted; the two most likely default implementations (bill the seat immediately, since there is no period to wait for; or never bill it, since the "wait for period end" code path finds no period) land on opposite answers, and the plan does not say which is intended. |
| Severity | minor, hypothesis (a spec gap, not a code defect, since nothing is built) |
| Already known? | Not found under C329, C355 or C351. New. |

I could not evaluate proration (62.4) or the retroactive recompute (62.3) as
code, since neither exists yet; both are specified in terms that match the
`entitledTier`/period-end pattern already proven correct for the two-tier
case in sprint 57.

---

## What I could not verify

- **The payout double-submission race (finding 5).** I read the code and
 the schema and found the guard is read-then-write with no unique index. I
 did not have a database available to fire two concurrent `requestPayout`
 calls and confirm both commit. A confirming test would seed one therapist
 with a held balance, fire two requests in parallel, and check whether the
 `payoutRequests` table ends up with one open row or two.
- **Whether the copilot's live-session leak (finding 1) is also reachable
 from the general `/copilot` route rather than only the in-room one.** I
 traced the one caller that passes `liveSince` (`app/(app)/copilot/actions.ts`)
 but did not exhaustively check every other caller of `askPatientCopilot`
 for a similar `before` value computed a different way.
- **Live behaviour of the Stripe double-subscription bug (finding 2)
 against a real Stripe account.** I read the checkout, webhook and
 `mirrorSubscription` code and the schema's unique constraint; I did not
 have Stripe test-mode credentials in this environment to actually drive
 two subscriptions through checkout and watch the webhook race.
- **The ledger's handling of a refund or chargeback after the affected
 money has already been paid out to a therapist.** `postSessionRefund`
 (`lib/billing/ledger.ts:369-418`) reverses `therapist_payable` by the
 original net amount regardless of whether that balance has since been
 drawn down by a payout, which would put the account negative. I did not
 trace whether `heldForTherapist` and `requestPayout` correctly refuse
 further withdrawals against a negative balance, or whether a negative
 balance is surfaced to anyone. This needs a read of `heldForTherapist`'s
 full definition and a walk of the payout queue's handling of a
 therapist who owes money back, which I did not complete.
- **`lib/data/facts.ts`, `memory.ts`, `grants.ts` and `session-risk.ts`**
 were read only far enough to support the copilot and verification
 findings above; I did not give each a full independent pass against its
 own invariants (journals never concluded from, C214; a grant only ever
 held by an approved clinician, C106) the way I did for billing and the
 session state machine. A dedicated pass on those four files is worth a
 second auditor's time.
- **Sprint 62 proration arithmetic against real billing periods.** Nothing
 is built, so nothing could be run; my review above is of the specification
 text only.
