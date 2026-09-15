# The money, for six months

**Handed to the money agent.** The longest document, because money is the half of this product
that cannot be checked by looking at a screen.

Every other part of this run is judged by whether a person could do the thing. This part is
judged by whether **the books balance**, and books that balance by accident are
indistinguishable from books that balance because the product is right, until somebody is owed
money.

---

## What we charge. The run bills against exactly this and nothing else

| | |
|---|---|
| A session | **1,000 EGP, about $20** |
| What an Egyptian patient is actually asked to send | **1,140 EGP.** The price plus the 14% VAT `country_settings` says Egypt charges. The screen names the 140 in its own line, so it does not read as a markup |
| Our cut of what the patient paid | **15%**, on paid sessions only, and on the **1,000**, never on the tax |
| Metered: the room | **$1 a session**, on **every** session. Paid, free, radar, invite, in person |
| Metered: the note | **$3 more**, and **only** where the patient consented to recording |
| So metered is | **$4 a session**, or **$1** where consent was declined |
| Solo plan | **$80 a month**, one therapist, and **no per session charge at all** |
| Clinic plan | **$72 a seat**, so $144 for the smallest practice. Ten per cent under solo. A practice that drops to one clinician pays the $80 solo price rather than nothing |
| Pounds to the dollar | **50**, an operator's setting on `/admin/settings`, edited daily |

### The two charges are separate, and the run must show both

The **cut** is on what the patient paid. The **room and note fees** are on the session existing
at all.

A free first session still bills $1 and $3. An in person session where nobody paid anything
still bills $1 and $3. A radar session a stranger never paid for still bills $1 and $3. **An
invoice that shows only one of the two is a defect**, and it is the kind that would take months
to notice.

### A subscriber pays neither per session charge

That is the whole of what $80 buys. We still take the 15%.

`M4` in `01-THE-CAST.md` checks the promise on the therapist's own screen: at 15 sessions she
earns $300, we take $45, she pays $80, **she keeps $175.** Her earnings screen shows **$255**,
not $300, because the 15% has already come out. **An agent comparing against $300 will report a
defect that is not one.**

And the money that ARRIVED for those fifteen sessions is **$342**, not $300, because each
patient sent the price plus 14% VAT. The extra $42 is the government's and sits in
`vat_payable`. Her earnings, our cut and her bill are all computed on the $300. **An agent
reconciling cash against earnings and finding $42 too much has found the tax, not a defect.**

---

## The offer, and what happens when it ends

| Their month | They pay |
|---|---|
| 1 | **Free** |
| 2 | **50%** |
| 3 | **50%** |
| 4 onward | **Full price** |

So a solo therapist pays nothing, then $40, then $40, then $80. A two seat practice pays
nothing, then $72, then $72, then $144.

**The month is theirs, not the calendar's.** A therapist who signs up in wave 3 is free in wave
3. Their first full price invoice is three months after they joined, whenever that was.

### The offer closes with the beta

| Who joined | What they get |
|---|---|
| Months 0 to 3 | One free month, two at half price, then full price |
| **Months 4 to 6** | **One free month. Then full price.** No half price, no schedule |

**And nothing at all after that.** There is no grandfathering, no permanent discount, and no
second offer for the people who took the first one. When somebody's schedule runs out they pay
list price like everybody else, and the plan has no scenario for anything else. Two therapists
in the run see the post beta sequence, `T5` in wave 4 and `T6` in wave 5, so that it reads as a
rule rather than as one person's exception.

### And a company gets $100 of welcome credit

**$100 is an argument, not a round number.** At 10% coverage a company pays $2 of a $20
session, so $100 is about **fifty sponsored sessions**. At 100% it is five.

It was $200 and was halved deliberately: the number that matters is how many companies try us,
not how long the first one lasts. The coverage slider says that arithmetic out loud before an HR
manager presses Save, because "10%" is abstract and "your $100 covers 50 sessions" is a decision
a finance team can take.

**The credit is cash leaving, not a discount.** It funds a real pot that real sessions really
spend. Nobody except a company ever gets one.

---

## Two sides, and the second one is the one that gets forgotten

| Side | What it is | Where the product records it |
|---|---|---|
| **Income** | Subscriptions, seats, and our fees on sessions | `invoices` for the first two, `session_payments.platform_fee_cents` for the third |
| **Expense** | What the models cost us to earn it | `ai_request_logs.cost_microcents`, written on every call |
| **The result** | Income minus model spend, by month | `/admin/vault`, which prints all four per month |

**Both sides are already built.** Nothing in this run writes an accounting row the product does
not write for itself. The money agent's job is to make the business happen and then read what
the operator's own screens say about it, **not to keep a second ledger.**

### What the operator must be able to read at the end, on screen, without you

This is the acceptance test for the whole money half, and it is a screenshot rather than a table
in a report:

1. `/admin/vault`, top card: **income, all time**, and it includes both subscriptions and
   session fees. A figure here that excludes one of them is a defect this product has had before.
2. `/admin/vault`, the month table: **six rows**, one per month, each showing subscriptions,
   session fees, income, model spend, and what was left over. **The income column must total to
   the card above it.** If it does not, stop and report that.
3. `/admin/usage`: **cost per session**, and the consent rate beside it.
4. `/admin/vault`, held balances: **what we are holding for other people**, and the reason for
   each holder.

**Every figure in the report comes from those screens.** If a number is wanted and the screens
cannot produce it, that is a finding about the product, not a reason to run a query.

---

## The three rails, and only one of them is a card

| Rail | Who is on it | What happens |
|---|---|---|
| Stripe, direct | A verified therapist outside Egypt | The card charges into their own account. We never hold it, and our share is a fee on the same charge |
| Stripe, held | Connected but not verified yet | The charge happens, we hold their share, and it moves by itself the moment Stripe finishes |
| **Manual, Egypt** | **Everybody in this run** | Money in arrives by InstaPay or bank transfer, is claimed by the payer on their own screen, and **moves nothing until an operator confirms it.** Money out is held by us and paid by hand on request |

**Stripe runs in test mode**, and in this run it carries almost nothing. The cast is Egyptian,
so the first two rows are the exception and the third is the product. `04-THE-RAIL.md` is the
whole of the third.

**A session is $20**, and the plan's whole gross margin rests on it: at 500 EGP the six months
end in deficit and at 1,000 they break even in month 5. If the run shows patients balking at
that price, **that is the most important finding the simulation can produce**, and it outranks
every defect in the dev log.

### Egypt is not a special case to be skipped. It is the main case

The product's answer is already built and it is not a fake. `lib/billing/egypt.ts` refuses to
pretend a gateway exists, `payoutRailFor` routes Egyptian therapists to the manual queue, and
the console has the screens to work it.

**So the run drives the built path, never a shortcut around it.**

1. A patient in Cairo books and the product refuses to take a card, honestly, naming what is
   missing. **Capture that refusal.** It is correct behaviour and it goes in the video.
2. The money is arranged through the transfer rail, which is how this market works today.
3. The session is marked paid by that route, through the product.
4. Our share accrues against the therapist. Their earnings screen shows it held.
5. In wave 3, `T1` requests a payout. The operator sees it, approves it, stamps it, and the
   therapist watches every step.

**Never write a ledger row directly to make a total look right.** If a collection cannot be
recorded through the product, that is the finding, and it is a large one.

---

## The six month story, wave by wave

### Wave 1 · month 0 · nothing is free except the first session

- `T1`, `T2` and `T3` are all Egyptian and all metered. There is no card rail for any of them.
- Every session bills **$1 for the room**. The **$3 note fee** bills only where the patient
  turned recording on, which is not every session and must not be.
- **The first session is free to the THERAPIST**, once per organisation, and that is what the
  product actually does: `chargeForSession` claims `trialSessionUsed` and raises a `waived`
  invoice with both lines zeroed and the description "First session, on us". The PATIENT still
  pays the therapist's price. Prove it: the therapist's first invoice is zero and says why, and
  the second is not.
- Each therapist's own first month is **free** under the offer. The invoice must **exist**, must
  be **zero**, and must **say why.** An invoice that is simply absent is indistinguishable from
  a billing bug.
- **Model spend starts accruing from the first transcription.** At the end of this wave
  `/admin/vault` shows a month with income near zero and spend above it. **That month loses
  money and the screen must say so.** A first month that shows a profit is a bug.

### Wave 2 · month 1 · the first practice and the first pot

- `C1` buys **3 seats at $72**, so $216, halved to $108 by the offer in its second month. The
  seat price must match the published ladder to the cent.
- **`T1` joins `C1` with a live subscription.** Her own plan is cancelled, a seat is taken, and
  she is not billed twice for the same month. **Check the arithmetic by hand.** This is the most
  likely place in the product for a real money bug.
- **`T4` takes the third seat while still unverified.** The practice pays for a seat occupied by
  somebody who cannot see a patient. That is correct: the seat is the practice's purchase, not a
  licence. **Check the bill charges for three seats, not two**, and capture the practice's own
  screen showing one of them as not yet working.
- `E1` funds a pot with the **$100 welcome credit** plus its own top up. The terms and the
  expiry are set before a penny can be spent.
- `E1`'s patients have sessions covered at **100%**. The patient pays nothing and the therapist
  is paid in full. **Both sides must say so.**
- The wave 1 cohort gets its **half price invoice**: list price, discount line and payable
  amount, **all three visible.**

### Wave 3 · month 3 · the partial pot, the payout and the edge cases

- `E2` funds a pot at **10% coverage**. Every one of their patients pays 90%. The patient's
  billing screen and the employer's spend must agree about the same session from two directions.
- **`T1` requests a payout**, the Egyptian manual path, end to end.
- **`P5` moves from `E2` to `E3`.** Her old employer's funding stops, her new employer's starts.
  **Neither employer's spend may move by a cent on the other's account**, and neither may learn
  the other exists.
- `C1` is billed for its seats as one total for the period, **never a line per session**, because
  a line per session would tell a practice manager which of their patients turned recording on.
- The wave 1 cohort gets its **second half price invoice.** Whoever joined this wave gets their
  free one.

### Wave 4 · month 4 · the month the money stops being free

This wave is why the run is six months long.

- **Wave 1's therapists are billed at full price, with no discount line.** Capture the invoice.
  **The single most important frame in the run.**
- **One of them does not pay.** `T3` lets it lapse. Watch what happens: nothing demotes him. The
  obligation is never settled, `lapseOverdue` marks it lapsed, and `entitledTier` puts him back
  on metered by itself. **His next session bills $4 and his own screen says why.**
- **`T2` subscribes by transfer.** No checkout. A bill is raised, he transfers, and he is still
  metered until the operator confirms. **Capture the gap: it is the design.**
- **`T1` checks the promise.** One month of earnings against her $80 bill, on her own screens,
  **net**. If the arithmetic does not hold there, the plan is wrong and the run found it.
- **`E1`'s pot runs to nothing mid month.** Not artificially: let the sessions spend it. The
  meter goes amber, then red, coverage stops, **the sponsor's admins are emailed** (naming no
  patient, no time and no therapist: C243), the patient falls through to the ordinary paid route,
  HR tops up, coverage resumes. **Capture all five states.** The most important sequence in this
  document.

  🔴 **Fund it with the $100 welcome credit and nothing else**, or it cannot empty inside the
  run: a $5,000 top-up is 250 covered sessions and the whole run has 62. The credit is granted by
  the operator when they open the pot on `/admin/sponsors`, which is the only place in the product
  that can put a figure below the $5,000 floor into a pot.

  ⚠️ **The patient is NOT shown "Account on hold, ask HR to activate".** No such screen exists.
  What happens is that the session falls back to the paid route and they are asked to pay. Report
  that as what it is: correct behaviour, thin copy, and a finding for the dev log rather than a
  defect.
- **`B3`: a transfer that never arrives**, rejected with a reason in the operator's own words,
  read back verbatim on HR's screen, then a real one sent.
- **`T5` upgrades to three seats on the 15th.** The screen quotes the difference for the days
  remaining **before** she agrees, and then that exact figure is billed. **Compare the two
  numbers by hand.** A quote that is not what happens is not a quote.
- **`C1-A` leaves the practice** and lands on metered by himself. The seat is released and the
  next bill is lower by exactly one seat, prorated as the product says it prorates.
- A card declines somewhere. Let it. Capture what the patient sees and what the therapist sees,
  and prove that the session did not silently proceed as paid.

### Wave 5 · month 5 · churn, which is the number everything turns on

- **`T2` cancels rather than keep paying $80.** He is the only wave 1 therapist who can: `T1` is
  on a practice seat, `T3` lapsed in wave 4 and `T4` is the rejection case. One observation. It is not a rate,
  `08-THE-NUMBERS.md` says so, and it is still worth more than the guess it replaces. Capture the
  cancellation screen and what it says about the month already paid for.
- `T6` joins on the post beta offer: **one free month, then full price.** No half price.
- **`T6` never subscribes at all, and is right not to.** At $4 a session he would need 20 a month
  to reach $80. **The product must not push him**, and a screen that nags a therapist for whom
  the plan is worse value is a finding.
- `E3` funds its pot by transfer, so the queue carries more than one kind of row.

### Wave 6 · month 6 · the close

- The whole cycle, read off the operator's own screens rather than the database.
- **Compare month 3 against month 6.** Revenue, cost, what is held, what is owed. The CFO's two
  passes sit side by side and a number that moved between them is worth more than either alone.
- **Month 6 revenue and what it implies annually**, stated plainly, **with how much of it is
  invoiced rather than collected.** A forecast built on invoiced revenue is a forecast of a
  company that runs out of money.

---

## What the money agent produces at the end

A single reconciliation, which either balances or the discrepancy is the finding:

| Line | Where it comes from |
|---|---|
| Gross collected, by rail | The payment rows, split Stripe direct / Stripe held / manual Egypt |
| Our 15% | The fee lines, which must equal the published percentage of each session |
| Room fees | **Every session**, including free, radar, invite and in person. Count them and check |
| Note fees | **Only** sessions where recording was on. Count them and check |
| VAT | A separate line on both sides, never folded into a total. **Every confirmed Egyptian session transfer carries 280 cents of it**, and it sits in `vat_payable` as a liability. A run that reports it as revenue has counted the government's money as ours |
| Paid out to therapists | Stripe transfers plus manual payouts |
| Still held by us | And for each holder, the reason: unverified Stripe, or Egypt |
| Employer pots: funded, spent, remaining | Per employer, and the sum must equal what their patients' sessions cost at their coverage rate |
| Seats billed | Per practice, per month, matching the ladder |
| Subscriptions billed | And the one upgrade, proved not to double charge |
| **Model spend, per month** | From `ai_request_logs`, and it must match what `/admin/vault` prints |
| **Left over, per month** | Income minus spend. **Say plainly which months lost money** |
| **Balance** | Gross = paid out + held + our fees + VAT. If it does not, say by how much and where |

### And one number that is not in the table, because it is the business

**Cost per real session.** `/admin/usage` computes it from actual rows for the sessions that
happened. For the sessions that did **not** happen, which is to say real fifty minute ones, the
answer comes from `npm run physics`, never from multiplication:

```
npm run physics -- --at 50
```

Measured **$0.0254** at three minutes. Fitted **$0.2167** at fifty. Multiplied **$0.4230**, and
that last one is the number to never put in a deck.

**Report the measured figure and the fitted one separately, and label which is which.** Quoting
a three minute session's cost as the unit economics is the most flattering mistake available
here, and every pricing decision downstream would inherit it.

---

## What the run must count, because the plan needs it

These replace guesses. Count them, do not estimate them.

| Count | Replaces the guess of |
|---|---|
| Recording consent rate, as a fraction of completed sessions | 70% |
| Sessions per patient per month | 1.5 to 2.5, by segment |
| Patients per clinician | 8 to 20, by segment |
| The two cost terms, fitted from this run's own rows | Nothing. Already measured. This confirms them inside the product |

## What the run must not claim

**It cannot measure churn, and it will look like it can.** Twenty one synthetic people who never
leave is not a 0% churn rate, it is an absence of evidence about churn. The report says **"not
measurable in a simulation"** rather than reporting a number, and `verify:plan` asserts that the
churn inputs are never labelled measured.

The same goes for what anybody will actually pay, card processing costs in Egypt, how many of a
call centre's staff would enrol, and whether a company renews once the credit runs out. All four
are in the plan as **guesses**, and six months of invented people cannot move any of them.

---

## The rules that do not bend

1. **Never a figure in a screenshot or a report that did not come from the database.** If a
   number is wanted and cannot be got, say it could not be got.
2. **Never invent a collection.** An Egyptian session whose money cannot be recorded through the
   product is a defect, not a rounding error.
3. **Test mode is disclosed** everywhere the numbers appear, including in the video.
4. **A pot that runs out is the feature**, not an inconvenience. Do not top it up early to keep
   the run tidy.
5. **Check the two upgrade moments by hand**: `T1` joining a practice with a live subscription,
   and `T2` moving to a plan by transfer. Automated checks cover the rules. Neither of these has
   ever been done by a person with a calculator.
6. **The expense side is read, never recorded.** If a month's model spend looks wrong, the answer
   is to find which calls produced it, not to adjust anything.
