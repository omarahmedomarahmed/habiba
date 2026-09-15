# The money, for six months

**Handed to the money agent. This is the longest document because money is the half of the
product that cannot be checked by looking at a screen.**

Every other part of this simulation is judged by whether a person could do the thing. This
part is judged by whether **the books balance**, and a set of books that balances by
accident is indistinguishable from one that balances because the product is right, until
somebody is owed money.

## 🔴 Two sides, and the second one is new to this design

The six-month version of this document tracked money coming in. It did not track what the
quarter **cost**, and a revenue figure with no expense beside it is the number every failing
company reports right up until the end.

| Side | What it is | Where the product already records it |
|---|---|---|
| **Income** | Subscriptions, seats, and our fee on every session a patient pays for | `invoices` for the first two, `session_payments.platform_fee_cents` for the third |
| **Expense** | What the models cost us to earn it | `ai_request_logs.cost_microcents`, written on every single call |
| **The result** | Income minus model spend, by month | `/admin/vault`, which prints all four figures per month since C349 |

**Both sides are already built.** Nothing in this simulation writes an accounting row that
the product does not write for itself. The money agent's job is to make the business happen
and then read what the operator's own screens say about it, not to keep a second ledger.

### What the operator must be able to read at the end, on screen, without you

This is the acceptance test for the whole money half, and it is a screenshot rather than a
table in a report:

1. `/admin/vault`, top card: **income, all time**, and it includes both subscriptions and
   session fees. A figure here that excludes one of them is C349 back.
2. `/admin/vault`, the month table: **three rows**, one per month, each showing
   subscriptions, session fees, income, model spend, and what was left over. 🔴 **The income
   column must total to the card above it.** If it does not, stop and report that.
3. `/admin/usage`: **cost per session**, and the consent rate beside it.
4. `/admin/vault`, held balances: **what we are holding for other people**, and for each
   holder the reason.

**Every figure in the report comes from those screens.** If a number is wanted and the
screens cannot produce it, that is a finding about the product, not a reason to run a query.

## The three rails, and only one of them is a card

| Rail | Who is on it | What actually happens |
|---|---|---|
| **Stripe, direct** | A therapist with a verified Stripe account and a practice outside Egypt | The patient's card charges straight into the therapist's own account. We never hold it. Our share is taken as a fee on the same charge |
| **Stripe, held** | A therapist who has connected but is not verified yet | The charge happens, we hold their share, and it moves to them by itself the moment Stripe finishes |
| **Manual, Egypt** | 🔴 **Everybody in this simulation** | **Egypt has no Stripe.** Money in arrives by InstaPay or bank transfer, is claimed by the payer on their own screen, and **moves nothing until an operator confirms it**. Money out is held by us and paid by hand on request. `09-THE-RAIL.md` is the whole of it |

**Stripe runs in test mode**, and in this run it carries almost nothing: the cast is
Egyptian, so the first two rows above are the exception and the third is the product. That
is the correct proportion and the earlier design had it backwards.

🔴 **A session is $20**, which is 1,000 EGP, and that is the benchmark every figure in this
document is against. The plan's whole gross margin rests on it: at 500 EGP the six months end
in deficit and at 1,000 they break even. If the run shows patients balking at that price,
**that is the most important finding the simulation can produce**, and it outranks every
defect in the dev log.

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
5. At month 3, `T1` requests a payout. The operator sees the request, approves it, stamps
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
- 🔴 **Model spend starts accruing from the first transcription.** At the end of this wave,
  `/admin/vault` should show a month with income near zero and spend above it. **That month
  loses money and the screen must say so.** A first month that shows a profit is a bug.

### Wave 2 · month 1

- `T2`'s Stripe verification completes. **The held balance moves to him by itself.** Capture
  before and after.
- `C1` buys 3 seats. The seat price must match the published ladder to the cent.
- 🔴 **`T1` joins `C1` with an existing subscription.** Sprint 62: her own plan is cancelled,
  a seat is taken, and she is not billed twice for the same month. **Check the arithmetic by
  hand.** This is the single most likely place for a real money bug.
- 🔴 **`T4` takes the third seat while still unverified.** The practice pays for a seat
  occupied by somebody who cannot see a patient. That is correct: the seat is the practice's
  purchase, not a licence. **Check the bill charges for three seats, not two**, and capture
  the practice's own screen showing one of them as not yet working.
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
- 🔴 **`T1` requests a payout**, the Egyptian manual path, end to end.
- 🔴 **`P5` moves from `E2` to `E3`.** Her old employer's funding stops. Her new employer's
  starts. **Neither employer's spend may move by so much as a cent on the other's account**,
  and neither may learn that the other exists.
- `C1-A` leaves the practice. The seat is released and the next bill is lower by exactly one
  seat, prorated as the product says it prorates.
- `C1` is billed for its seats for the second and third months, as one total for the period
  and never a line per session, because a line per session would tell a practice manager
  which of their patients turned recording on.
- A card declines somewhere. Let it. Capture what the patient sees and what the therapist
  sees, and prove that the session did not silently proceed as paid.

### Wave 4 · month 4 · 🔴 the month the money stops being free

This wave is why the run is six months long.

- 🔴 **Wave 1's therapists are billed at full price**, with **no discount line**. Capture the
  invoice. `08-THE-OFFER.md` calls it the single most important frame in the run.
- 🔴 **One of them does not pay.** `T3` lets it lapse. Watch what happens: nothing demotes
  him. The obligation is never settled, `lapseOverdue` marks it lapsed, and `entitledTier`
  puts him back on metered by itself. **His next session bills at the pay-as-you-go rate and
  his own screen says why.**
- 🔴 **`T2` subscribes by transfer.** No checkout. A bill is raised, he transfers, and he is
  still on pay as you go until the operator confirms. Capture the gap: it is the design.
- 🔴 **`T1` checks the promise.** One month of her session earnings against her $80 bill.
  Fifteen sessions at $20 earns $300, we take $45, and her screen shows $255 against an $80
  bill. **On her own screens, net.** If the arithmetic does
  not hold there, the plan is wrong and the run found it.
- 🔴 **`E1`'s pot runs to nothing mid-month.** Coverage stops. HR is alerted **and so is the
  patient**, whose screen says "Account on hold, ask HR to activate" rather than a payment
  error. Capture both.
- 🔴 **`B3`: a transfer that never arrives.** Rejected with a reason in the operator's own
  words, read back verbatim on HR's screen, then a real one sent.
- 🔴 **`T5` upgrades to three seats on the 15th.** The screen quotes the difference for the
  days remaining **before** she agrees; then that exact figure is billed. Compare the two
  numbers by hand.
- `C1-A` leaves the practice and lands on metered by himself.

### Wave 5 · month 5 · churn, which is the number everything turns on

- 🔴 **Somebody cancels rather than pay $100.** One observation. It is not a rate and
  `07-FINANCIAL-MODEL.md` says so, and it is still worth more than the guess it replaces.
  Capture the cancellation screen and what it says about the month already paid for.
- `T6` joins on the post-beta offer: **one free month, then full price.** No half price.
- 🔴 **`T6` never subscribes at all**, and is right not to: at $4 a session he would need 25
  a month to reach $100. **The product must not push him**, and a screen that nags a
  therapist for whom the plan is worse value is a finding.
- `E3` funds its pot by transfer, so the queue carries more than one kind of row.

### Wave 6 · month 6 · the close

- The whole cycle, read off the operator's own screens rather than the database.
- 🔴 **Compare month 3 against month 6.** Revenue, cost, what is held, what is owed. The
  CFO agent's two passes sit side by side and a number that moved between them is worth more
  than either alone.
- **Month-6 MRR and the ARR it implies**, stated plainly, with how much of it is invoiced
  rather than collected. A forecast built on invoiced revenue is a forecast of a company that
  runs out of money.

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
| 🔴 **Model spend, per month** | From `ai_request_logs`, and it must match what `/admin/vault` prints |
| 🔴 **Left over, per month** | Income minus spend. Say plainly which months lost money |
| **Balance** | Gross = paid out + held + our fees + VAT. **If it does not, say by how much and where** |

### 🔴 And one number that is not in the table, because it is the business

**Cost per real session.** `/admin/usage` computes it from actual rows for the sessions that
happened. For the sessions that did **not** happen, which is to say real fifty-minute ones,
the answer comes from `npm run physics`, not from multiplication:

```
npm run physics -- --at 50
```

The simulation's sessions run 3 and 8 minutes. **Multiplying the short one to reach fifty
overstates it by 95%**, because a system prompt, a note, a risk verdict and four copilot turns
happen once per session and not once per minute. The two duration clusters exist precisely so
the fixed and variable halves can be separated; `01-SEED.md` has the arithmetic.

Measured: **$0.0254** at three minutes. Fitted: **$0.2167** at fifty. Multiplied: **$0.4230**,
and that last one is the number to never put in a deck.

**Report the measured figure and the extrapolation separately, and label which is which.**
Quoting a six-minute session's cost as the unit economics is the most flattering mistake
available here, and every pricing decision downstream would inherit it.

### 🔴 And where those two numbers go afterwards

`07-FINANCIAL-MODEL.md`. The fit this document produces is the measured half of a
thirty-six month forecast that already exists on `/admin/financial-model`; the other half is
assumptions somebody has to defend, and the screen labels which is which. Your job here ends
at the numbers. **Do not fill in churn, acquisition cost, card fees or video cost** because a
month table has a gap in it: this run cannot establish any of the four, the model says so on
its own screen, and an assumption quietly relabelled as a measurement is the one failure that
whole system exists to prevent.

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
6. 🔴 **The expense side is read, never recorded.** If the model spend for a month looks
   wrong, the answer is to find which calls produced it, not to adjust anything.
