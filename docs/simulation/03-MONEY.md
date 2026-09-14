# The money, for six months

**Handed to the money agent. This is the longest document because money is the half of the
product that cannot be checked by looking at a screen.**

Every other part of this simulation is judged by whether a person could do the thing. This
part is judged by whether **the books balance**, and a set of books that balances by
accident is indistinguishable from one that balances because the product is right, until
somebody is owed money.

## The three rails, and only one of them is a card

| Rail | Who is on it | What actually happens |
|---|---|---|
| **Stripe, direct** | A therapist with a verified Stripe account, mostly the UK ones | The patient's card charges straight into the therapist's own account. We never hold it. Our share is taken as a fee on the same charge |
| **Stripe, held** | A therapist who has connected but is not verified yet | The charge happens, we hold their share, and it moves to them by itself the moment Stripe finishes |
| **Manual, Egypt** | 🔴 **Every Egyptian therapist, clinic and employer** | **Egypt has no Stripe.** There is no card rail. Money is collected outside the product, recorded inside it, held by us, and paid out by hand on request |

**Stripe runs in test mode.** Test-mode money is still a real money cycle: real charges,
real fees, real payouts, real failures. Report it as test-mode and the numbers mean
something.

## 🔴 Egypt is not a special case to be skipped. It is the main case

Most of this cast is Egyptian. The product's own answer is already built and it is not a
fake: `lib/billing/egypt.ts` refuses to pretend a gateway exists, `payoutRailFor` routes
Egyptian therapists to the manual queue, and the operator console has the screens to work
that queue.

**So the simulation drives the built path, not a shortcut around it.**

1. A patient in Cairo books and the product refuses to take a card, honestly, naming what is
   missing. **Capture that refusal.** It is correct behaviour and it goes in the video.
2. The session happens anyway, because the money was arranged outside the product, which is
   how this market works today.
3. The money agent records the collection through the path the product provides for it, and
   the session is marked as paid by that route.
4. Our share accrues against the therapist. Their earnings screen shows it held.
5. At month 6, `T1` requests a payout. The operator sees the request, approves it, stamps
   it, and the therapist watches every step.

**Never write a ledger row directly to make the totals look right.** If a collection cannot
be recorded through the product, that is the finding, and it is a large one.

## The six-month money story, wave by wave

### Wave 1 · month 0

- `T2` (Leeds) connects Stripe. It is **not verified yet**. He charges anyway, and we hold
  his share. **Capture the held balance and the sentence that explains it.**
- `T1` and `T3` (Egypt) have no rail. Their sessions collect manually.
- Every session bills the platform fee. The AI fee bills **only where the patient turned
  recording on**, which is not every session and must not be.
- First session free for each therapist. Prove it: the first invoice is zero and the second
  is not.

### Wave 2 · month 1

- `T2`'s Stripe verification completes. **The held balance moves to him by itself.** Capture
  before and after.
- `C1` buys 3 seats. The seat price must match the published ladder to the cent.
- 🔴 **`T1` joins `C1` with an existing subscription.** Sprint 62: her own plan is cancelled,
  a seat is taken, and she is not billed twice for the same month. **Check the arithmetic by
  hand.** This is the single most likely place for a real money bug.
- `E1` funds a pot. The terms and the expiry are set before a penny can be spent.
- `E1`'s patients have sessions covered at 100%. The patient pays nothing and the therapist
  is paid in full. **Both sides must say so.**

### Wave 3 · month 3

- 🔴 **`E1`'s pot runs out.** Not artificially: let the sessions spend it. The meter goes
  amber then red, coverage stops, patients start being asked to pay, HR is alerted, HR tops
  up, coverage resumes. **Capture all five states.** This is the most important sequence in
  this document.
- `E2` funds a pot at **10% coverage**. Every one of their patients pays 90%. The patient's
  billing screen and the employer's spend must agree about the same session from two
  directions.
- 🔴 **`T2` upgrades to a monthly plan.** He has already paid for part of the month. The
  bill before, the bill at the moment of change, and the bill after. Per-session charges
  must stop. **Check by hand that he was not charged twice.**
- `C1` is billed for its seats for the second and third months, as one total for the period
  and never a line per session, because a line per session would tell a practice manager
  which of their patients turned recording on.

### Wave 4 · month 6

- 🔴 **`T1` requests a payout**, the Egyptian manual path, end to end.
- 🔴 **`P8` moves from `E2` to `E3`.** Her old employer's funding stops. Her new employer's
  starts. **Neither employer's spend may move by so much as a cent on the other's account**,
  and neither may learn that the other exists.
- `C1-A` leaves the practice. The seat is released and the next bill is lower by exactly one
  seat, prorated as the product says it prorates.
- A card declines somewhere. Let it. Capture what the patient sees and what the therapist
  sees, and prove that the session did not silently proceed as paid.

## What the money agent must produce at the end

A single reconciliation, and it either balances or the discrepancy is the finding:

| Line | Where it comes from |
|---|---|
| Gross collected, by rail | The payment rows, split Stripe direct / Stripe held / manual Egypt |
| Our platform fee | The fee lines, which must equal the published percentage of each session |
| Our AI fee | Only on sessions where recording was on. Count them and check |
| VAT | A separate line on both sides, never folded into a total |
| Paid out to therapists | Stripe transfers plus manual payouts |
| Still held by us | And for each holder, the reason: unverified Stripe, or Egypt |
| Employer pots: funded, spent, remaining | Per employer, and the sum must equal what their patients' sessions cost at their coverage rate |
| Seats billed | Per clinic, per month, matching the ladder |
| Subscriptions billed | And the one upgrade, proved not to double-charge |
| **Balance** | Gross = paid out + held + our fees + VAT. **If it does not, say by how much and where** |

## The rules that do not bend

1. **Never a figure typed into a screenshot or a report that did not come from the
   database.** If a number is wanted and cannot be got, say it could not be got.
2. **Never invent a collection.** An Egyptian session whose money cannot be recorded through
   the product is a defect, not a rounding error.
3. **Test mode is disclosed** everywhere the numbers appear, including the video.
4. **A pot that runs out is the feature**, not an inconvenience. Do not top it up early to
   keep the simulation tidy.
5. **Check the two upgrade moments by hand**: T1 joining a clinic with a live subscription,
   and T2 moving to a monthly plan. Automated checks cover the rules; neither of these has
   ever been done by a person with a calculator.
