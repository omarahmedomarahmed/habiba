# The commercial offer, rehearsed

**Read with `07-FINANCIAL-MODEL.md`. That one is about measuring the unit cost.
This one is about proving the offer the company is about to sell actually works
end to end in the product.**

## 🔴 The simulation rehearses the plan's MECHANICS, not its volumes

`docs/FINANCIAL-PLAN.md` says month 3 has 543 sessions. This run has 35, because
the whole budget is $10 of OpenAI credit and 543 fifty-minute sessions would cost
$117 of it.

That is not a compromise, it is the correct division of labour:

| | Answers | How |
|---|---|---|
| **The simulation** | Does the offer work in the product? | 22 people, real screens, real invoices |
| **The model** | What does it add up to? | Arithmetic on measured unit costs |

A run that tried to do both would do neither: it would spend its budget proving
a multiplication and never once check whether a 50% discount actually lands on an
invoice.

## What the offer is

| Their month | They pay |
|---|---|
| 1 | **Free** |
| 2 | **50%** |
| 3 | **50%** |
| 4 onward | Full price |

**$80 a month solo** and **$72 a seat for a clinic**, minimum two seats. So the offer is
free, then $40, then $40, then $80; and for a two-seat clinic free, then $72, then $72, then
$144.

Plus: a company or university gets **$100 of welcome credit** in its pot.

🔴 **$100 is not a round number, it is an argument.** At 10% coverage a company
pays $2 of a $20 session, so $100 is about **50 sponsored sessions**. At 100% it
is five. It was $200 until sprint 76 and was halved deliberately: the number that
matters is how many companies try us, not how long the first one lasts. The coverage slider says that arithmetic out loud before an HR manager
presses Save, because "10%" is abstract and "your $100 covers 50 sessions" is a
decision a finance team can actually take.

🔴 **The month is theirs, not the calendar's.** A therapist who signs in wave 3
is free in wave 3. Their first full-price invoice is three months after they
joined, whenever that was.

## 🔴 And the offer CHANGES after the beta, which is the second thing to capture

The schedule above is the **beta**, and the beta closes at the end of month 3. It
buys evidence, once. Paying for it forever would be a discount rather than a
launch.

| Who joined | What they get |
|---|---|
| Months 0 to 3 | Two months free, then half price, then full price |
| 🔴 **Months 4 to 6** | **One month free. Then the full $100.** No half price, no schedule |

Two therapists in the run see the second sequence, `T5` in wave 4 and `T6` in
wave 5, so that it reads as a rule rather than as one person's exception. If
either of them is quietly given the beta schedule, the model's month-7 revenue is
wrong and nothing on any screen would say so.

## The five moments that must be captured

Everything else in this document exists to produce these five frames. If the run
produces nothing else, produce these.

### 1. The free first invoice

A therapist joins in wave 1. Their first invoice must exist, must be for **zero**,
and must **say why** rather than simply being absent. An invoice that does not
appear is indistinguishable from a billing bug.

Capture: the therapist's billing page, and `/admin/vault` showing the same zero.

### 2. The half-price invoice

The same therapist, one wave later. The invoice carries the list price, the
discount line, and the payable amount, all three visible.

🔴 **`discount_cents` and `discount_reason` are columns that exist. Automatic
promotional scheduling is not built.** An operator applies this by hand today,
from `/admin/therapists`. That is fine at 18 accounts and is the first thing to
build after the beta, and the run should record how long it took to do by hand.

### 3. 🔴 THE FULL-PRICE INVOICE. The single most important frame in the run.

Age the first cohort **one wave past the offer**, so that at least one account
reaches its fourth month and is billed the full amount with no discount line.

This is the moment the entire plan turns on. `docs/FINANCIAL-PLAN.md` assumes
25% to 40% of them leave here, and that guess drives break-even by nine months
either way. The simulation cannot tell you whether a real therapist would pay.
**It can tell you whether the product bills them correctly, which is the half
that is our fault if it is wrong.**

Capture: the invoice, and the therapist's own view of it.

### 4. The welcome credit, funded and consumed

A company's pot, funded with the **$100 welcome credit**, then drawn down by its
employees' sessions until it is empty, then the moment it runs out.

🔴 **A pot that empties is the feature.** The employee must be told clearly, must
not be dropped mid-session, and must be offered the paid route. `03-MONEY.md`
already requires this; here it is the commercial half of the same moment.

Capture: the sponsor's pot at full, at 10%, and empty. The employee's screen at
the moment of refusal.

### 5. The joining poster

The company's QR code and printable poster at `/sponsor/code`, as an employee
would see it on a wall.

| | Built? |
|---|---|
| Server-rendered QR, no third party sees the code | ✅ |
| Printable A4 poster | ⚠️ Browser print only, **no PDF export** |
| The company's own logo on it | ❌ **Not built** |

Record both gaps as findings with the frame beside them. They are small and they
are the first thing a sales conversation will ask for.

## What the run must count, because the model needs it

These four replace guesses in `docs/FINANCIAL-PLAN.md`. Count them; do not
estimate them.

| | Replaces the guess |
|---|---|
| Recording consent rate, as a fraction of completed sessions | 70% |
| Sessions per patient per month | 1.5 to 2.5, by segment |
| Patients per clinician | 8 to 20, by segment |
| The two AI cost terms, fitted | Nothing. These are already measured; this confirms them in the product |

## What the run must NOT claim

🔴 **It cannot measure churn, and it will look like it can.** Twenty-two
synthetic people who never leave is not a 0% churn rate; it is an absence of
evidence about churn. The report must say "not measurable in a simulation"
rather than reporting a number, and `verify:plan` asserts that the churn inputs
in the model are never labelled as measured.

The same goes for: what anybody will actually pay, card processing costs in
Egypt, how many of a call centre's staff would enrol, and whether a company
renews. All four are in the model as **GUESS**, and six months of invented
people cannot move any of them.

## The order

| | Step | Where |
|---|---|---|
| 1 | Seed wave 1 with the offer applied: the first invoice is free | `01-SEED.md` |
| 2 | Wave 2: half-price invoices for the wave 1 cohort | `03-MONEY.md` |
| 3 | Wave 3: half price again for wave 1, free for whoever just joined | |
| 4 | 🔴 **Age one wave further and bill wave 1 at full price** | `05-AGEING.md` |
| 5 | Fund a pot with $100, drain it, capture the refusal | `03-MONEY.md` |
| 6 | Count consent, sessions per patient, patients per clinician | `07-FINANCIAL-MODEL.md` |
| 7 | `npm run plan` and `npm run forecast`, with those counts in hand | |

## The rule that does not bend

**Every figure that reaches `docs/FINANCIAL-PLAN.md` must be a count from a
query, never a screenshot read by eye and never a number an agent remembered.**
The plan is what an angel will be shown. A single figure in it that nobody can
reproduce from a database makes every other figure worth arguing about.
