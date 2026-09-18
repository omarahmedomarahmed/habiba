# What the run hands the plan, and what it can never measure

**Run by the main session, after the last wave and before the report.**

```
npm run physics -- --at 50 --json docs/simulation-run/PHYSICS.json
npm run plan                        the operating plan, three scenarios
npm run plan -- beta-cliff          the six months, month by month
npm run forecast                    the abstract growth model, four scenarios
```

And on screen, signed in as the operator: **`/admin/financial-model`**.

## Why this document exists

The run is six months, twenty synthetic customers, our own seven, and 286 minutes of audio. **Nobody is going to
raise money on that, and nobody should.** What it can do is establish a handful of numbers no
amount of spreadsheet work can, and hand them to a plan that is honest about which half it
measured.

> **The run measures the unit economics. It does not measure the business.**

Everything below follows from that sentence, in both directions.

---

## The two models, and they are not the same thing

| | `npm run plan` | `npm run forecast` |
|---|---|---|
| What it is | **The operating plan.** Egypt, the $20,000, the offer, the people we are actually hiring | An abstract growth model: pick a growth rate, see what falls out |
| Horizon | 3, 6 and 18 months | 36 months |
| Prices a cohort | off **its own age**, so somebody who joined in March and somebody who joined in May are billed differently in the same June | off the calendar |
| Answers | Does this company pay for itself before the money runs out | What does a business of this shape look like at scale |

`/admin/financial-model` puts the plan **above** the abstract model, deliberately, and
`verify:plan` asserts that ordering. **The plan is the company; the forecast is a shape.**

They disagree about how much runway is needed, and the disagreement is not a bug. The forecast's
base case assumes founders on a market salary; the plan assumes $500 each, which is what the
founders said they need to live on. **Say which one a figure came from, every time.**

## What the plan says today, before the run

The six month scenario, `beta-cliff`, is the one this simulation rehearses.

| | |
|---|---|
| Month 6 revenue | **$9,474** |
| Gross margin | **75%** |
| Net in month 6 | **+$2,337** |
| Cash at month 6 | **$7,526**, from $20,000 opening |
| Break even | **month 5** |
| Blended acquisition cost | **$200** an account |

**Break even before month 6 is a target, not an output.** What makes it reachable is a third
seller: **one of the two founders sells full time from month one.** It costs nothing on the
payroll, because they already draw their $500 as a founder, and it raises arrivals on every
segment by half.

`verify:plan` holds that property with a control: take the third seller out and the target is
missed. **It is also the assumption most likely to be wrong.** A founder selling is a founder not
building, and this model has no line for what stops being built. Read the arrival numbers as
"what three sellers can do" rather than as free growth.

**The run cannot confirm or refute break even.** Twenty invented customers do not test whether
an Egyptian therapist will pay 4,000 pounds a month. What the run tests is whether the product
can bill them correctly when they try, which is the half that is our fault if it is wrong.

---

## What the run establishes

| | Where it comes from |
|---|---|
| The fixed and variable halves of a session's model cost | `npm run physics`, fitted over `ai_request_logs` |
| The recording consent rate | completed sessions with `recording_consent = 'granted'` |
| Patients per therapist, sessions per patient per month | the rows, divided |
| The prices, the fees and the tiers | `platform_settings`, **read, never invented** |

### The cost model, and why it needs two clusters

The obvious way to get a fifty minute number is to run fifty minute sessions. That would cost
roughly **$13.44** against **$1.98**, which is most of the budget spent proving something
arithmetic already knows.

So the run produces **two clusters**, 42 sessions at 3 minutes and 20 at 8, and
`lib/finance/physics.ts` solves `cost = FIXED + VARIABLE x minutes` from `ai_request_logs`. Two
unknowns need two measurements. **It refuses to fit a single cluster** rather than returning a
slope drawn through noise that looks exactly as authoritative as a real fit.

```
  fixed   = $0.01317 a session
  perMin  = $0.00407 a minute
```

| | Cost |
|---|---|
| 3 minute session | **$0.0254** |
| 8 minute session | **$0.0457** |
| 50 minute session | **$0.2167** |
| 50, by multiplying the 3 minute figure | $0.4230, **95% too high** |
| This whole run, 42 short and 20 long | **$1.98** |
| A fully booked therapist, 66 fifty minute sessions | **$14.31 a month** |

(`verify:finance` prints $14.30 for the same quantity. The gap is one rounding step, not a
disagreement: 66 x $0.21675 is $14.3055.)

That last row is why the $70 spend flag is a flag and not a cost control: it sits nearly five
times above what somebody who cannot physically work harder can spend. It fires for a practice
sharing one login, a runaway loop, or a bug.

**The run's own fit should reproduce the two terms above.** If `npm run physics` comes back
materially different, that is a finding and belongs in the report. The API benchmark measured the
prompts in isolation; the run measures them inside the product, and a gap between the two is the
product doing something the benchmark did not.

---

## Not measurable here, and the screen says so before it shows a chart

| | Why |
|---|---|
| **Therapist churn** | Six months and one cohort of invented people. One cancellation is one observation, not a rate |
| **Acquisition cost, conversion** | There is no marketing in a simulation, and no founder making calls |
| **Card processing fees** | Stripe runs in test mode and charges nothing. Egyptian gateways charge about 3% and nothing here can confirm it |
| **Video cost** | Daily bills per participant minute, and that invoice is not in this database |

**Do not fill any of these in.** An assumed input quietly relabelled as measured is the exact
failure the provenance system exists to prevent, and `verify:finance` asserts that churn and the
payment fees can never carry the measured tag.

**And one more that is easy to miss**: whether a company renews once its $100 credit runs out.
The plan assumes two in three. Six months of invented people cannot move it.

---

## Taking the measurement

At the end, signed in as the operator, on `/admin/financial-model`:

1. Type a label into **Measure and freeze** and press it. It reads the sessions, the consent rate
   and the fee settings, and writes **one row** to `finance_benchmarks`.
2. **The row is never updated.** Re measuring writes a new one. A figure quoted in March has to be
   reproducible in June, and it cannot be if the numbers behind it are a live query.
3. Compare the provenance split at the top of the page before and after. Before the measurement
   the unit costs are the shipped API benchmark; after it they are this database.

Then capture the page. `05-CAPTURE.md` lists it.

---

## What goes in the report

1. **The two terms**, from `npm run physics`, beside the API benchmark's, labelled.
2. **The fifty minute figure**, and the multiplied one beside it, so the difference is on the page
   rather than in an argument.
3. **The consent rate.** The $3 note fee rides on it, so every margin in every scenario moves with
   it.
4. **The provenance split**: how many of the plan's inputs this run made measurable, and how many
   are still somebody's judgement.
5. **The plan's three scenarios**, re run with the counts in hand, and whether the six month one
   still breaks even in month 5.
6. **The four things that cannot be measured here**, in the report, not in a footnote. A forecast
   quoted without them is the failure this whole module was built to prevent.

---

## The rules that do not bend

1. **Never quote a short session cost as unit economics.** The most flattering mistake available
   in this run, and every pricing decision downstream inherits it.
2. **Never flatten the durations to tidy the run.** One length is the single input shape from
   which the fifty minute figure cannot be derived at all.
3. **Never type a number into the model that did not come from a measurement or an argument.**
   Every input carries `measured`, `decided` or `guess`, and every one says **why** in a sentence
   somebody can argue with.
4. **The model reads prices and never sets one.** `/admin/financial-model` is not
   `/admin/settings`: a number in `platform_settings` changes somebody's next invoice, and a
   forecast input must be structurally incapable of that. `verify:finance` asserts the module
   graph that keeps it so.
5. **Every figure that reaches a document an investor will read must be a count from a query**,
   never a screenshot read by eye and never a number an agent remembered. A single figure nobody
   can reproduce makes every other figure worth arguing about.
