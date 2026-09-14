# What the run feeds into the financial model

**Run by the main session, after the money agent has closed month three and before the
report.**

```
npm run forecast                    # all four scenarios, one screen
npm run forecast -- base            # one of them, thirty-six months, month by month
npm run physics -- --at 50          # the two terms, solved from ai_request_logs
```

And on the screen, signed in as the operator: **`/admin/financial-model`**.

## Why this document exists

The simulation is three months, twenty-two synthetic people and 160 minutes of audio. Nobody
is going to raise money on that, and nobody should. What it CAN do is establish a handful of
numbers that no amount of spreadsheet work can, and hand them to a model that is honest about
which half it measured.

> **The run measures the unit economics. It does not measure the business.**

Everything in this document follows from that sentence, in both directions.

## The four scenarios, and which one this run is

| Scenario | Months | What it is |
|---|---|---|
| `benchmark` | 3 | 🔴 **This run, as it happened.** A calibration, not a forecast |
| `real-sessions` | 3 | The same quarter with **fifty-minute** sessions, derived through the two-term model |
| `base` | 36 | Two founders, from home, no round |
| `funded` | 36 | A pre-seed at month 6, hiring against it |

Scenario one is the only one the simulation produces. Scenario two is **derived** from it and
is the reason the run splits its session durations at all. Three and four are forecasts built
on scenario two's unit economics plus assumptions nobody here can measure.

### 🔴 Scenario two is derived, never simulated

The obvious way to get a fifty-minute number is to run fifty-minute sessions. That would cost
roughly **$7.60** on the seeded volume against **$1.11**, which is most of the $10 budget
spent proving something arithmetic already knows.

So the run produces **two clusters**, 24 sessions at 3 minutes and 11 at 8, and
`lib/finance/physics.ts` solves `cost = FIXED + VARIABLE x minutes` from `ai_request_logs`.
Two unknowns need two measurements. It **refuses** to fit a single cluster rather than
returning a slope drawn through noise that looks exactly as authoritative as a real fit.

## What the run establishes, and what it cannot

### Measured here

| | Where it comes from |
|---|---|
| The fixed and variable halves of a session's model cost | `npm run physics`, fitted over `ai_request_logs` |
| The recording consent rate | completed sessions with `recording_consent = 'granted'` |
| Patients per therapist, sessions per patient per month | the rows, divided |
| The platform fee, the AI fee, the tiers | `platform_settings`, **read, never invented** |

### 🔴 Not measurable here, and the screen says so before it shows a chart

| | Why |
|---|---|
| Therapist churn | Three months and one cohort. Nobody left, and that is not a churn rate |
| Acquisition cost, conversion | There is no marketing in a simulation |
| Card processing fees | **Stripe runs in test mode and charges nothing** |
| Video cost | Daily bills per participant-minute, and that invoice is not in this database |

Do not fill any of these in. An `assumed` input that gets quietly relabelled `measured` is
the exact failure the whole provenance system exists to prevent, and `verify:finance` asserts
that churn and the payment fees can never carry the `measured` tag.

## The measured unit cost, before the run starts

On 2026-09-14 the four prompts were run against the live OpenAI API at 3, 8, 20 and 50
minutes, using the product's own `noteFromTranscript`, `classifyRisk` and `attributeLines`
and a faithful reconstruction of the in-session copilot. **$0.37 of spend, no database rows
written.** `evals/physics.json` holds every measurement.

```
  fixed   = $0.01317 a session
  perMin  = $0.00407 a minute
```

| | Measured |
|---|---|
| 3-minute session | **$0.0254** |
| 8-minute session | **$0.0457** |
| 50-minute session | **$0.2167** |
| 50, by multiplying the 3-minute figure | $0.4230, **95% too high** |
| This whole simulation, 24 short and 11 long | **$1.11** |
| A fully booked therapist, 66 fifty-minute sessions | **$14.31 a month** |

That last row is why the `$70` flag is a flag and not a cost control: it sits nearly **five
times** above what somebody who cannot physically work harder can spend. It fires for a
clinic sharing one login, a runaway loop, or a bug.

🔴 **The run's own fit should reproduce these.** If `npm run physics` comes back materially
different from the two terms above, that is a finding and belongs in the report. The API
benchmark measured the prompts in isolation; the simulation measures them inside the product,
and a gap between the two is the product doing something the benchmark did not.

## Taking the measurement

At the end, signed in as the operator, on `/admin/financial-model`:

1. Type a label into **Measure and freeze** and press it. It reads the sessions, the consent
   rate and the fee settings, and writes **one row** to `finance_benchmarks`.
2. The row is **never updated**. Re-measuring writes a new one. A figure quoted in March has
   to be reproducible in June, and it cannot be if the numbers behind it are a live query.
3. Compare the provenance split at the top of the page before and after. Before the
   measurement the unit costs are the shipped API benchmark; after it they are this database.

Then capture the page. `04-CAPTURE.md` lists it.

## The finding this model has already produced

Both thirty-six month scenarios **run out of cash in month 3** on $20,000 of opening cash and
two founders at $4,000 a month plus 15% burden.

| | Crosses zero | Low point | Needs |
|---|---|---|---|
| `base` | month 3 | **month 13, $35,216 down** | **$55,216** to reach break-even at m14 |
| `funded` | month 3 | month 5, $15,013 down | **$35,013** to survive to the round at m6 |

🔴 **The month it crosses zero is the alarm; the low point is the size of the problem**, and
they are ten months apart in the base case. Plan against the first number and you raise a
tenth of what you need.

Neither figure is a measurement of anything. `openingCashUsd` is an assumption and so is the
founder salary; both are sliders on the screen. What is NOT an assumption is the shape: at
these salaries the unfunded path needs about fifty-five thousand dollars of runway before it
turns, and no amount of the AI being cheap changes that, because the AI is $5 a therapist a
month and the payroll is $9,200.

## What goes in the report

1. **The two terms**, from `npm run physics`, beside the API benchmark's, labelled.
2. **The fifty-minute figure**, and the multiplied one beside it, so the difference is on the
   page rather than in an argument.
3. **The consent rate**, because C209 means the AI revenue rides on it and every margin in
   every scenario moves with it.
4. **The provenance split**: how many of the model's inputs this run made measurable, and
   how many are still somebody's judgement.
5. **The four scenarios' final months**, from `npm run forecast`.
6. 🔴 **The four things that cannot be measured here**, in the report, not in a footnote. A
   forecast quoted without them is the failure this whole module was built to prevent.

## The rules that do not bend

1. **Never quote a short-session cost as unit economics.** It is the most flattering mistake
   available in this whole simulation, and every pricing decision downstream inherits it.
2. **Never flatten the durations to tidy the run.** One length is the single input shape from
   which scenario two cannot be derived at all.
3. **Never type a number into the model that did not come from a measurement or an argument.**
   Every input carries `measured`, `assumed` or `derived`, and overriding a measured one on
   the screen flips it to `assumed` on purpose.
4. **The model reads prices and never sets one.** `/admin/financial-model` is not
   `/admin/settings`: a number in `platform_settings` changes somebody's next invoice, and a
   forecast input must be structurally incapable of that. `verify:finance` asserts the module
   graph that keeps it so.
