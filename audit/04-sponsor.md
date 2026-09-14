# Sponsor audit — the corporate wall

Auditor beat: `app/(sponsor)/**`, `lib/sponsor-auth/**`, `lib/data/enrolment.ts`,
`lib/data/enrolment-verify.ts`, `lib/data/sponsors.ts`, `lib/data/sponsor-admin.ts`,
`lib/billing/pot.ts`, the sponsor tables in `lib/db/schema.ts`, PLAN.md §3e and
sprints 60 to 61.

Every finding below was checked against the actual file, not the comment above
it. Where I searched and found nothing, I say what I searched and what a real
defect would have looked like, so the absence is not just an unread search.

---

## Finding 1 — the anti-differencing floor is dead code; the sponsor sees a live balance

**What:** `potBalance()`, the only function in the codebase that gates the pot
balance behind C229's activity floor, is never called from anywhere. Both
sponsor-facing screens that show a balance instead call `ledgerPotBalance()`,
which is a raw, unfloored, real-time sum straight off the ledger, updated the
moment `payFromPot` posts. This is the exact differencing attack C229 was
written to close, live in production right now.

**Where:**
- `lib/data/sponsors.ts:240-255` defines `potBalance()`. Its own comment says
  "a balance is only shown once the period since it last moved has cleared the
  floor" and calls a raw balance beside a suppressed chart "the differencing
  attack with the chart removed."
- Confirmed by search: `grep -rn "\bpotBalance\b"` across `app/`, `lib/`,
  `components/`, `scripts/` finds only the definition. Zero call sites.
- `app/(sponsor)/sponsor/page.tsx:5,50` imports and calls `ledgerPotBalance`
  (not `potBalance`) and renders it unconditionally at lines 90-101, **outside**
  the `underFloor` block that correctly suppresses the weekly heatmap
  (lines 63-64, 142-165). The balance card is not inside that guard.
- `app/(sponsor)/sponsor/pot/page.tsx:7,34,49-53` does the same: `ledgerPotBalance`
  rendered with no floor check at all.
- `lib/billing/pot.ts:490-505` — `ledgerPotBalance()` is a plain `SUM` over
  `ledger_entries`, no suppression logic, no activity count, nothing.

**Who is harmed:** Every enrolled patient at every sponsor account. A sponsor
who watches the balance figure (which both pages show, unconditionally, and
which they are entitled to check daily since it is literally the only figure
that always renders) can read the exact cents debited by any single session
the instant it is paid. The weekly heatmap being correctly suppressed does
nothing to stop this, because the balance card sits right next to it and is
not suppressed. This is precisely the scenario §3e's own table forbids ("A
day, an hour, or a date tied to a person") and the scenario C229 names by name
("in week 14 the balance drops by exactly one session's cost... the payer
knows one person went and which week").

**Severity:** blocker.

**Already known?** C229 (ruled, sprint 53) rules exactly this attack and
prescribes exactly the fix that exists in the code as `potBalance()`. The
ruling is correct. It was never wired to the screens that render it. This is
"the ruling was never built," not a new design question, and it sits directly
under Invariant 8 and the brief's own worked example ("a pot balance that
drops by one session's price tells the sponsor somebody had a session
today") — which is not hypothetical, it is the current behavior of both
sponsor screens.

---

## Finding 2 — C246's cross-sponsor uniqueness does not exist; the identifier hash is salted per sponsor

**What:** `hashIdentifier(sponsorId, value)` includes `sponsorId` in the hash
input, so the same real-world identifier ("20215544") produces a *different*
hash at every sponsor. The database's `enrolments_identifier_unique` index,
which the schema comment says enforces "one identifier, used once, ever...
across every sponsor, not per sponsor," in fact only prevents the same
identifier being reused **at the same sponsor**. Across sponsors it enforces
nothing, because the values it compares are never equal to begin with.

**Where:**
- `lib/data/enrolment.ts:98-102` — `hashIdentifier`:
  ```
  createHash("sha256").update(`${env.authSecret}${sponsorId}${value...}`).digest("hex")
  ```
- `lib/data/enrolment.ts:318` — `enrol()` calls it as
  `hashIdentifier(lookup.sponsorId, input.identifier)`, so every real
  enrolment's hash is sponsor-specific by construction.
- `lib/db/schema.ts:5907-5915` — the comment directly above
  `enrolments_identifier_unique` claims: "Across every sponsor, not per
  sponsor: an identifier that crossed one gate must not cross another." The
  index it describes cannot do this given how the hash is built.
- `scripts/verify-sprint53.ts:608-645` — the verifier titled "C246 — ONE
  IDENTIFIER, USED ONCE, EVER, ACROSS EVERY SPONSOR" does **not** call
  `hashIdentifier`. It manufactures its own raw hash string
  (`createHash("sha256").update(randomBytes(16))`, line 619) and inserts that
  *identical, hand-picked string* into `enrolments.identifier_hash` for two
  different sponsors, then asserts the second insert is refused. That only
  proves Postgres enforces a unique index on a column, which is true of any
  unique index and proves nothing about whether the real code path ever
  produces a colliding hash. It never does, so the real gate this verifier
  claims to test does not exist.

**Who is harmed:** Every sponsor using the `id_number` gate (explicitly
described in the plan as guessable and weak on purpose, C246). The stated
"backstop" against a guessed ID being reused is that it can only ever work
once, anywhere. In the built code, a guessed or known ID number ("20215544")
can be submitted at every single sponsor whose `id_number` pattern happens to
match it, each one separately, each one successfully draining that sponsor's
own pot. A person (or a script) with one plausible-looking number can walk it
across every corporate client on the platform. Sponsors are the ones who pay
for this, and it directly contradicts the plain-language promise made to them
at signup (C246: "the sponsor is told in plain words that it is guessable and
that they carry the risk" — the risk they were told they carry is bounded by
"once, ever," and it is not).

**Severity:** blocker.

**Already known?** C246 is ruled (sprint 53) and its ruling explicitly
requires global, cross-sponsor uniqueness as the backstop for a
pattern-matched gate. The ruling was never actually built; the verifier that
was supposed to catch this tests the database's unique-index mechanism in the
abstract rather than the actual hash function, which is exactly the failure
mode the audit brief calls out by name: "a check that passes by measuring the
wrong thing."

---

## Finding 3 — the pot's overdraft bound can be exceeded by concurrent bookings, and the failure surfaces after irreversible effects

**What:** `payFromPot` reads the pot's balance with a plain `SELECT` (no lock,
no transaction), compares it in application code against the gross price, and
only enforces the true bound with a final, unguarded `UPDATE ... SET
balance_cents = balance_cents - gross`, relying on the database CHECK
constraint `sponsor_pots_overdraft_bounded` to refuse it if the sponsor would
go past their overdraft. But by the time that UPDATE runs, the session has
already been marked paid, a `session_payments` row has already been inserted,
and both ledger legs have already been posted — none of which is wrapped in a
transaction with the final balance update, and none of which rolls back if
that update fails.

**Where:**
- `lib/billing/pot.ts:108-353` (`payFromPot`), specifically:
  - `potRow()` at `lib/billing/pot.ts:529-541`: a plain `SELECT`, no
    `FOR UPDATE`, no isolation directive.
  - `lib/billing/pot.ts:188-191`: the affordability check, against the value
    just read.
  - `lib/billing/pot.ts:210-216`: claim the session (`UPDATE sessions SET
    payment_status='paid' WHERE payment_status='pending'`). Correctly guards
    against double-paying the *same* session, but does nothing for the shared
    pot resource across *different* sessions.
  - `lib/billing/pot.ts:218-283`: insert `session_payments`.
  - `lib/billing/pot.ts:301-343`: post both ledger legs via `journal()`.
  - `lib/billing/pot.ts:346-349`: only now, last, the actual bound-enforcing
    write: `UPDATE sponsor_pots SET balance_cents = balance_cents - gross`.
  - No `controlDb.transaction(...)` anywhere in the file (`grep -n
    "transaction"` in `lib/billing/pot.ts` finds nothing but a comment).
  - `drizzle/0072_corporate.sql:279-282` — the CHECK constraint
    `sponsor_pots_overdraft_bounded` is the only thing that would actually stop
    this at the database, and it fires on the last statement, after the
    session/payment/ledger writes already committed as separate statements.
- Two different sessions being booked concurrently against the same sponsor's
  pot (a realistic scenario for any company with more than a handful of
  enrolled staff booking around the same time) can both read the same
  pre-decrement balance, both pass the affordability check, both commit their
  session-paid and ledger-debit writes, and only the *second* pot decrement
  throws. That throw is unhandled: `app/join/[token]/actions.ts:174-175` and
  `lib/data/scheduling.ts:515-516` both call `await payFromPot(sessionId)`
  with no try/catch. The exception propagates out of the server action after
  the session was already marked paid.

**Who is harmed:**
- The **sponsor**, whose pot can be pushed further negative than the overdraft
  they were shown and agreed to (C239's entire point was that the overdraft is
  "a small, bounded, deliberate credit exposure" — the code no longer bounds
  it under concurrency).
- The **patient**, who in the failing (second) booking gets an unhandled
  server error mid-booking, after their session has silently already been
  marked paid in the database — a broken UI state that also violates "does
  the screen tell the truth about what will happen".
- Silently, this also reintroduces exactly the drift `reconcilePots()` exists
  to catch (`lib/billing/pot.ts:458-479`), except this is not a rare crash —
  it is a foreseeable race under ordinary concurrent use, and `reconcilePots`
  is only ever read by a human opening `/admin/sponsors` (see Finding 6 for
  the equivalent gap on the cron side).

**Severity:** blocker.

**Already known?** C239 (ruled, sprint 53, amended) establishes the bound and
says explicitly "the overdraft is per sponsor... new bookings stop once the
sponsor overdraft is spent." The ruling assumed the bound would hold; nothing
in C239 or the code comments considers concurrent bookings against the shared
pot resource. This is a genuinely new finding, not a restatement: the
"safe to call twice" claim in the function's own doc comment
(`lib/billing/pot.ts:100-106`) is true and is about a *different* race (two
calls for the *same* session), and is correctly solved. It does not address,
and the comment does not claim to address, two calls for *different* sessions
against the *same* pot, which is the actual gap.

---

## Finding 4 — a pot-funded session cannot be refunded; the sponsor's pot is never credited back

**What:** The only refund function in the codebase, `refundSessionPayment`,
requires `payment.stripePaymentIntentId` to exist and returns an error if it
does not. A pot-funded `session_payments` row never has a Stripe payment
intent (there was no card charge; the pot stood in for the card). So refunding
any pot-funded session is currently impossible through the one code path that
exists, and the sponsor's pot balance, once debited at booking, is never
credited back for a session that is later refunded or that never happened.

**Where:**
- `lib/billing/connect.ts:771-797` — `refundSessionPayment`: line 794 checks
  `payment.status !== "paid"`, line 795-797 checks `!payment.stripePaymentIntentId`
  and returns `{ error: "That payment has no Stripe charge to refund." }`.
- `lib/billing/pot.ts:218-272` — the `session_payments` insert for a pot
  payment never sets `stripePaymentIntentId`, confirming it is always null for
  every pot-funded session.
- `lib/billing/ledger.ts:369-418` — `postSessionRefund`, the function that
  would reverse the ledger legs on a refund, is only ever reached from inside
  `refundSessionPayment` (`lib/billing/connect.ts:834-844`), so it is
  unreachable for a pot payment too. There is no `sponsor_pot` leg anywhere in
  `postSessionRefund`'s leg list even hypothetically — it was written before
  the pot existed and was never extended for it.
- Two live callers hit this and handle the failure two different, both wrong,
  ways:
  - `lib/data/recovery.ts:266-283` (`refundNoShow`, the automatic no-show
    refund the platform issues on the clock): calls `refundSessionPayment`,
    checks `result.error`, `log.error`s it — and then **still returns
    `{ ok: true, outcome: "refunded" }`** to its own caller regardless
    (line 283 is outside the `if` block). The system reports success while
    the sponsor's money is not returned.
  - `app/feedback/[token]/actions.ts:76-108` (a patient filing their own
    no-show report): wraps the call in `try { await refundSessionPayment(...)
    } catch { /* Already refunded, or payments are not configured here. */ }`
    (lines 96-107). But `refundSessionPayment` does not throw for this case,
    it resolves normally with `{ error: ... }` — so the `catch` never fires
    and the return value is never even inspected. The failure produces no log
    line at all on this path.

**Who is harmed:** The **sponsor**. Once `payFromPot` debits the pot at
booking (which happens immediately, not at session start — see
`lib/data/scheduling.ts:502-516`), that money is gone even if the therapist
never joins, even if the session is cancelled before it starts, even if a
patient reports a no-show. C239's entire framing ("a session that has started
always completes and is always paid") implicitly assumes the reverse case (a
session that never starts) is handled by an ordinary refund; it is not. This
also directly undercuts sprint 60's C315 and C347, both of which describe
*apportioned* refunds for a split payment as the new problem to solve, while
the underlying mechanism (crediting the pot back at all) does not exist for
today's 100%-covered sessions.

**Severity:** blocker.

**Already known?** No C-number rules this directly. C239 rules the overdraft
bound at booking and is silent on reversal. C315/C347 (sprint 60, not yet
built) assume a working refund-to-pot mechanism exists to apportion; it does
not, even for the simple 100% case that is live today. This is a live defect,
not a plan gap.

---

## Finding 5 — no reschedule mechanic exists; cancel-and-rebook double-spends the pot

**What:** There is no reschedule feature anywhere in the codebase today
(`grep -rln "reschedule\|Reschedule"` across `app/` and `lib/` returns
nothing). The only way to move a booked session to a new time is to cancel it
and book a new slot. `cancelBooking` does not reverse any payment
(`lib/data/scheduling.ts:536-578` touches only `availability_slots` and
`sessions.status`, never `session_payments` or the pot). Combined with
Finding 4 (no refund path exists for a pot payment anyway), "rescheduling" a
pot-funded session today means the sponsor is charged twice for what the
patient experiences as one appointment: once for the original booking
(never refunded, per Finding 4) and again for the new one.

**Where:**
- `lib/data/scheduling.ts:536-578` — `cancelBooking`. No call to any refund
  or pot-crediting function.
- `lib/data/scheduling.ts:429-527` — `bookSlot`, called fresh for the new
  time, calls `payFromPot` again at line 516.
- No `sessions.rescheduledFromId`, no link between a cancelled session and its
  replacement, anywhere in `lib/db/schema.ts`.

**Who is harmed:** The sponsor, again, and it is a direct hole in sprint 60's
own ruling: C342 says "a reschedule keeps the frozen percentage. Only a NEW
booking takes the new one" (60.5), which presumes the product can already
distinguish a reschedule from a new booking. It cannot: the only mechanic that
exists *is* cancel-and-rebook, which the ruling itself would have to classify
as "a new booking," and which today loses the sponsor their money twice with
no refund on the first leg. Sprint 60's plan does not name this dependency:
before "a reschedule keeps the frozen percentage" can mean anything, a
reschedule has to exist as a distinguishable operation, and today it does
not.

**Severity:** blocker (as a plan gap for sprint 60, since C342 cannot be built
correctly without first defining what a reschedule *is* in the schema) / major
(as a live defect today, since a patient asking to move their appointment and
getting cancel-and-rebook from support already double-spends their sponsor's
pot).

**Already known?** C342 ("loophole in C311," ruled sprint 60) rules the
*outcome* a reschedule should have. It does not rule, and no other concern
rules, *what a reschedule is at the data level*, and the current codebase
has no such concept to extend. This is the case the brief asked for
explicitly ("a session booked then rescheduled across a notice window") and
it is not covered.

---

## Finding 6 — C247's "reversible by us in one step" has no call site

**What:** `unpause()`, the function whose entire purpose per its own doc
comment is to be the one-step manual override staff use to restore someone's
paused funding, is never called from anywhere in the product. There is no
admin action, no admin page, no API route that reaches it. The only way an
enrolment's `pausedAt` is ever cleared is the person themselves successfully
re-answering their own verification code.

**Where:**
- `lib/data/enrolment-verify.ts:296-311` — `unpause()`.
- `grep -rn "\bunpause\b"` across `app/` and `lib/` finds only the definition
  (`lib/data/enrolment-verify.ts:304`) and its own doc comment referencing
  itself. No caller.
- `grep -rln "pausedAt: null"` across the whole codebase finds only
  `lib/data/enrolment-verify.ts` — the successful re-verification path inside
  `confirmEnrolmentCode` (lines 197-202), which requires the *person* to
  answer a code sent to *their own* address.
- `app/(admin)/admin/sponsors/*` has no unpause control, and neither does any
  sponsor-facing screen (removal is the sponsor's only individual-level power
  by design, C234, and a sponsor is never shown who is paused beyond a
  boolean on the roster — see `roster()` at `lib/data/sponsors.ts:91-127`).

**Who is harmed:** The patient C247 itself names as the hard case: "a person
on extended leave who cannot reach their work inbox has their benefit pause...
so the pause must be reversible by us in one step." Today there is no "us" —
no operator has a button. The product's own promise about how this gets fixed
does not exist as a reachable action. The only remedy left is a direct
database edit outside the product, which is exactly what C247 says a phone
call should not require.

**Severity:** major.

**Already known?** C247 (ruled, sprint 53) states the requirement in these
words. The function that would satisfy it was written and then never wired
to anything, which is the same class of defect as Finding 1: a mechanism that
exists in the codebase but was never reached from a screen or action.

---

## Finding 7 — "who did this" is collected from the sponsor and then thrown away

**What:** Both individual-affecting sponsor actions accept a "who did this"
identifier and never persist it anywhere. `removeFromRoster`'s
`bySponsorUserId` parameter and `topUpPot`'s `bySponsorUserId` parameter are
both declared, both passed in from the calling server action with a comment
saying they are "for the audit," and neither is ever written to a column, a
log field, or an audit row.

**Where:**
- `lib/data/sponsors.ts:330-380` — `removeFromRoster`. The type at line 335
  declares `bySponsorUserId: string`. The function body (lines 337-379) never
  references `input.bySponsorUserId`. `enrolments` (`lib/db/schema.ts:5843-5930`)
  has no `removed_by_sponsor_user_id` column. The only log line,
  `log.info("enrolment removed", { reason: input.reason })` at line 378, does
  not include it either.
- `app/(sponsor)/sponsor/people/actions.ts:37-42` — the caller, whose own
  comment on the *type* says "The sponsor user who did it, for `audit`" —
  a claim the callee does not honour.
- `lib/billing/pot.ts:363-368` — `topUpPot`'s `bySponsorUserId` parameter,
  same pattern: declared, documented ("Who authorised it, for the audit"),
  never referenced in the function body (lines 369-446).

**Who is harmed:** Any patient whose benefit is wrongly ended, and the
sponsor's own compliance position. If an HR account is compromised, or if one
named individual at a sponsor removes a colleague from the roster
retaliatorily, there is no record inside the product of *which* sponsor user
did it, only that "some admin, at sponsor X, for reason Y" did. This is worth
noting beside C234's own framing: "this is the strongest thing we can say to
an employee" is a claim about what removal does *not* touch; it says nothing
about being able to answer "who did this" later, and the code cannot answer
that question despite two separate comments asserting it can.

**Severity:** minor (it is an accountability and dispute-resolution gap, not
a direct clinical or privacy leak — nothing about a patient is exposed by this
absence).

**Already known?** No C-number rules this directly. It is new: a comment
asserting a wiring the code does not have, the exact pattern `pot.ts:141-149`
itself calls out as "the second most common defect in this repository" —
found here in the sibling function to the one that comment is about.

---

## Finding 8 — `benefit_paused` is fully built and never used

**What:** `PATIENT_NOTICE_KINDS` includes `"benefit_paused"` with complete,
correct bilingual copy ("Your benefit is paused until you confirm you are
still eligible." / Arabic equivalent), but nothing in the codebase ever
inserts a notification of that kind. The actual pause job inserts
`kind: "verify_needed"` instead, whose copy ("Confirm your work address to
keep your benefit.") tells the person what to do but never plainly states
that their funding has, in fact, already stopped.

**Where:**
- `lib/db/schema.ts:6005-6011` — `PATIENT_NOTICE_KINDS` lists
  `"benefit_paused"`.
- `lib/i18n/messages.ts:1150,3993` — the copy exists in English and Arabic.
- `lib/data/enrolment-verify.ts:275-281` (`pauseUnverified`) inserts
  `kind: "verify_needed"`, not `"benefit_paused"`.
- `grep -rn '"benefit_paused"'` across `app/` and `lib/` finds only the
  schema constant. No insert anywhere uses it.

**Who is harmed:** The patient, mildly. This is a clarity gap, not a privacy
leak: no employer is named either way (both message keys comply with C231).
A person whose funding just stopped is told to confirm their address, which
is actionable, but is never told in plain words that their sessions have, in
the meantime, stopped being free.

**Severity:** minor.

**Already known?** Not ruled directly. Adjacent to C231's amendment, which
rules the *content* of the removal notice (no employer named) but does not
rule which notice kind a pause should actually use; the schema anticipated a
dedicated one and the implementation quietly used a different one.

---

## Sprint 60 — attacking the coverage-percentage rulings

The rulings in C311, C312, C313, C314, C315, C317, C342, C344, C345, C346,
C347 are each internally sound as written. None of the built code
contradicts them yet, because none of sprint 60 is built. The gaps are in
what the ruling set, taken together, does not cover.

| # | Case from the brief | What the plan says | The gap |
|---|---|---|---|
| 1 | Reschedule across a notice window | C342: reschedule keeps the frozen percentage | See Finding 5. There is no reschedule mechanic to attach this rule to, and the only existing substitute (cancel + rebook) already double-spends the pot with no refund. Building "reschedule keeps the frozen %" on top of that either has to invent a real reschedule primitive (a schema change not in the sprint 60 ticket list) or silently inherit the double-spend bug into the coverage feature. |
| 2 | Series booking | C343: a series reserves against the pot at booking, reservations expire on cancellation | The reservation mechanic is specified as expiring "when a session is cancelled" but the ticket list never says what happens to a reservation when the *sponsor's account* changes state (suspended, closed) between the series booking and a later session in it, nor what happens when the patient's *primary enrolment changes* (C249 permits this at any time) mid-series. `payFromPot`'s existing WHERE clause checks `sponsors.state = 'active'` and `enrolments.isPrimary = true` at the moment of payment (`lib/billing/pot.ts:151-166`); a reservation model has to decide whether each session in the series is re-checked against these at spend time or only once at series-booking time, and the ticket list does not say. |
| 3 | Enrolment changes mid-series | C317: coverage follows the primary enrolment at the moment of booking and freezes | Ruled for a single booking. Not extended to what "at the moment of booking" means for a whole series booked in one click (C343) — is the freeze per-session (each session in the series checks the primary enrolment as it is reserved) or per-series (one freeze covers every session even if the person's primary sponsor changes mid-series)? The two tickets (60.5/C342 and 60.11/C343) do not cross-reference each other on this point. |
| 4 | Refund after the percentage changed | C315: refunds apportioned in the frozen ratio | Sound as written, but see Finding 4: there is currently no way to refund a pot-funded payment at all. C315 assumes the refund mechanism it apportions already exists. It does not, and no sprint 60 ticket names fixing the underlying refund path as a precondition, the way C233's terms-before-money was made an explicit precondition of C232. |
| 5 | Sponsor empties the pot after freezing | C239 (existing) bounds the overdraft; not revisited for split payments | Not directly addressed by sprint 60. If a session is booked with an 80% frozen split and the sponsor's pot subsequently runs past its overdraft before the session happens, does the *sponsor's 80% share* still pay (per C239's "a session that has started always completes") even though the booking may not yet have "started" in the clock sense the overdraft rule uses? The frozen-percentage tickets do not restate or extend C239 for the split case. |
| 6 | Cancellation | Not named in C311-C317 or C342-C347 at all | A cancelled, never-started, partially sponsored session's split payment has no ruling. Does the sponsor's share get refunded per C315's frozen ratio (as if it were a refund) or is cancellation treated separately? The word "cancel" does not appear in any of C311 to C317 or C342 to C347. |

**Severity of this section as a whole:** major. None of these are contradicted
rulings; they are rulings that stop short of the case the brief asked for,
and sprint 60 cannot be built correctly from the ticket list alone without
resolving each one first.

**Already known?** Each row is checked against PLAN.md §2 by C-number above;
none of the six gaps has its own concern. They are new.

---

## Sprint 61 — attacking domain proof, the banner, and provisional enrolment

Sprint 61 is entirely unbuilt (confirmed: no `listedPublicly` reference
outside the admin and sponsor-settings screens that manage the flag today, no
DNS-proof table, no public banner component anywhere in `app/` or
`components/`). The following are plan-level findings.

| # | Attack from the brief | Finding |
|---|---|---|
| Domain transfer / company sale | Nothing in PLAN.md addresses this. `grep -n -i "acqui\|domain transfer\|change hands\|reassign"` across the whole file returns nothing relevant to sponsors. C318/61.1 prove a domain **once**, at setup (email code + DNS TXT). No ticket re-checks the TXT record on any schedule after that. A domain that is later abandoned, sold, or re-registered (ordinary events: startups fold, rebrands happen, IT lets a legacy domain lapse) continues to silently authorise enrolment against the *original* sponsor's pot forever, because the plan has no re-proof or expiry for domain ownership, only for the *person's* re-verification (C247, which re-checks the individual, not the sponsor's claim on the domain). |
| Company acquisition / merger | Same search, same result: no ruling anywhere. Two sponsors merging, or one sponsor's staff moving to an acquirer's domain, has no described path — not a removal, not a domain reassignment, not a pot transfer. This is silent by omission across the whole plan, not just sprint 61. |
| Enumeration via domain guessing | C349/61.6 states the *outcome* ("constant message, constant timing") correctly but the ticket gives no mechanism. Compare to the pattern this repo already uses correctly: `checkSponsorPassword` (`lib/data/sponsor-admin.ts:381-419`) achieves constant-time behavior by explicitly hashing a dummy password even on an unknown email (lines 396-398), and the doc comment names *why*. Ticket 61.6 does not name an equivalent mechanism (a padding delay, a decoy DB lookup, or reuse of the same "compute the expensive thing regardless" pattern) for the domain-guessing flow, which given this repo's own history of exactly this bug class is a gap worth naming explicitly before the ticket is picked up, not after. |
| Provisional enrolment spending more than N | C350/61.9 caps a provisional person at N sessions, default 1, but no ticket specifies the enforcement mechanism. Given Finding 3 above (the existing pot-spend path already has an unguarded read-then-write race on a shared counter), a naive "count sessions this provisional enrolment has spent, compare to N" check implemented the same way `payFromPot`'s overdraft check is implemented today would have exactly the same concurrency hole: two concurrent bookings under one compromised HR-matched identity could each read "0 of N spent" and both proceed, spending 2 sessions against a cap of 1. C350's own stated threat model (a compromised HR API key booking sessions) is precisely the adversary who would exploit this, since a script can fire concurrent requests trivially. |
| Company appears on the banner without opting in | Not found as a live bug (the banner does not exist yet), but the ticket list has a gap: 61.5 says the banner shows "opted-in sponsors only" using the existing `listed_publicly` column, default off (C236, already correctly defaulted off today, confirmed at `lib/db/schema.ts:5621` and enforced with no form field to set it in `applyToSponsor`, `lib/data/sponsor-admin.ts:69-93`). But sprint 61 also adds two *new* proof states (DNS TXT pending/passed, agreement pending/passed) and does not say whether completing domain proof has any effect on `listed_publicly`, or whether the two are fully independent. If a future implementer conflates "domain proved" with "should be listed" (an easy mistake, since both read as "this company is legitimately a customer now"), a sponsor could end up on the public banner without the separate, deliberate opt-in C236 requires. This is a plan-clarity gap: the ticket list never states explicitly that proof and listing are unrelated toggles. |

**Severity:** major for the domain-transfer/acquisition gap and the N-session
race (both are blockers-in-waiting once sprint 61 is built on the current
ticket wording); minor for the banner-conflation risk and the enumeration
ticket's missing mechanism, since both are plan clarity issues rather than
described defects.

**Already known?** Checked against C318 to C322 and C348 to C350 above. None
of the five rows restates an existing ruling; each is a case the existing
rulings do not reach.

---

## What I tried and could not break

**Invariant 8, direct joins.** I read every function in `lib/data/sponsors.ts`,
`lib/billing/pot.ts`, `lib/data/sponsor-admin.ts`, every page and action under
`app/(sponsor)/`, and the one admin screen that touches sponsors
(`app/(admin)/admin/sponsors/page.tsx` and `actions.ts`). None of them
constructs a query joining a sponsor to a session, a booking, a date, or a
patient name. `roster()` (`lib/data/sponsors.ts:91-127`) is explicitly not
called from the admin sponsors page, and its own select list has no session,
booking, therapist, or `createdAt` column. `weeklySpend()`
(`lib/data/sponsors.ts:419-484`) groups by week in raw SQL so no daily or
per-session row ever exists in the pipeline. I also checked our own most
powerful internal screen, Total View (`app/(admin)/admin/tv/page.tsx` and
`lib/console/reads.ts`), which can search any patient by name or email and
show their sessions, transcript, and clinician — a `grep -n "sponsor"` over
`lib/console/reads.ts` returns nothing, confirming it has no sponsor-facing
join either. The only way to connect a sponsor's roster (a name) to that
search box is for one human to read a name off a screen and type it into
another, which requires a staff member to *also* be looking at a sponsor's
roster, and no admin screen shows one. I could not find the query, export, or
admin screen the brief asked me to find under this heading directly, only the
inference-based route documented as Finding 1, which achieves the same harm
(identifying a person's session activity) without ever executing a join.

**C243's payer-name leak.** Confirmed already fixed: `payerName`/`payerEmail`
are absent from every current query that reaches a therapist screen
(`lib/data/vault.ts:138-141`, `components/billing/ledger.tsx:55`,
`components/billing/payment-history.tsx:15`, all carry comments recording the
removal). `payFromPot` writes `payerName: null` unconditionally
(`lib/billing/pot.ts:225`). I looked for a second path that might still read
the column and found none: `grep -rn "payerName"` across the whole repo
returns only the sites already named plus `app/pay/[token]/actions.ts:111`,
which is the ordinary card-payment flow writing the *patient's own* name,
unrelated to sponsors.

**C247's pause reaching something clinical.** I traced every write
`pauseUnverified` and `confirmEnrolmentCode` perform
(`lib/data/enrolment-verify.ts:233-311`): `enrolments.paused_at`,
`enrolments.last_verified_at`, and one row in `patient_notifications`. No
write to `patients`, `sessions`, `grants`, `notes`, or anything region-scoped.
I could not find a path from a pause to a clinical table. The gap I did find
(Finding 6) is the opposite direction: the pause is well-isolated but poorly
reversible.

**C231's employer-naming to the patient.** I read every `messageKey` string
used by `patient_notifications` in both languages
(`lib/i18n/messages.ts:1148-1155, 3991-3998`) and confirmed none interpolates
a sponsor name or reason. I checked `lib/data/portability.ts` and
`lib/data/export.ts` for any inclusion of enrolment or notification rows in a
patient export; `grep -n "enrolment\|sponsor\|patientNotification"` over both
files returns nothing, meaning this data is not currently exported at all
(not a leak, simply not built yet either way).

---

## What I could not verify

- **Whether `reconcilePots()` and `pauseUnverified()` actually run on a
  schedule in production.** I found both wired into `app/api/cron/[job]/route.ts`
  (lines 218-230), which is correct code, but I have no way to confirm from
  static reading whether the cron trigger that calls this route is actually
  configured and firing in the deployed environment. If it is not, Finding 3's
  drift (and any drift from ordinary crashes) accumulates unnoticed
  indefinitely rather than being caught weekly.
- **Runtime behavior of the concurrency race in Finding 3.** I traced the code
  path and the missing transaction boundary precisely, and the database CHECK
  constraint that would fire is confirmed in the migration SQL, but I did not
  and could not run two concurrent bookings against a live database (the
  audit brief forbids writing to the database). This is a structural finding
  from reading the code, not an observed failure.
- **Whether any support tooling outside this codebase (a database console, an
  internal spreadsheet, a ticketing system) lets staff reconstruct "who did
  this" for a sponsor removal (Finding 7) by some means outside the product.**
  I can only say the product itself does not record it.
- **The exact behavior of `verify:sprint53` when actually executed.** I read
  its source and traced the specific assertion in question (lines 608-645)
  by hand rather than running it, per the brief's restriction on running
  scripts that write to a database (`verify:sprintNN` scripts are excluded
  from the read-only command list in AUDIT-PROMPT.md). The reasoning above
  follows directly from the literal code in both files; I have high
  confidence in it but did not observe the script's pass/fail output myself.
