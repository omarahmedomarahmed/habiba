# The rehearsal, and what it found before the run spent anything

**Nine main flows, one run, on the dev branch, through the browser.** Thirty-three steps.
Every claim carries the row id it produced, read back out of the database after the browser
did the pressing.

    rm -rf .next && npm run build && npm run screens:prep && npm run probe

🔴 The `rm -rf .next` matters: `next dev` and `next build` share that directory, and the probe
needs a dev server. A build over one dies while prerendering `/for-patients` and reads as a
broken page (H37).

## Why this happened before the six months and not after

The six month run is twenty-eight agents, sixty-two sessions, ten dollars of model credit and
a production database nobody restores afterwards. The two most expensive ways for it to go
wrong are both discoverable in an hour: **a main path that does not walk**, and **an obstacle
that makes every agent invent the same workaround**.

It is deliberately not about edge cases. `09-THE-EDGES.md` has thirty of those and they are
the run's own job. This answers the narrower question that comes first: *can a therapist sign
up, can a patient pay, does money come out, can the operator clear a queue, does the founder's
screen add up.*

---

## The result

| Flow | Who | Walks | What it produced |
|---|---|---|---|
| **F1** | A therapist signs up and asks to be verified | ✅ | `users`, `therapist_verifications` at `submitted`, four documents stored |
| **F2** | A patient signs herself up | ⚠️ | `patient_accounts`, **with no email address and no way to add one** |
| **F3** | A session, up to the money | ✅ | Dashboard reached, transcription door present and refusing untokened requests |
| **F4** | Money out, what a clinician sees | ✅ | Screen honest about a zero balance, and the ledger agrees with it |
| **F5** | A therapist pays us by transfer | ✅ | Bill of **EGP 4,000**, receipt attached, `manual_payments` at `submitted`, nothing granted |
| **F6** | A practice applies | ✅ | A **held** `organizations` row. Applying grants no console |
| **F7** | An employer applies | ✅ | A **held** `sponsors` row |
| **F8** | Support works the verification queue | ✅ | Approved, `reviewed_by` set, audit row written |
| **F9** | The founder's six screens | ✅ | All 200, none rendering an error |

**32 of 33 steps ok. Nothing blocked. One defect.**

---

## 🔴 The five obstacles, and what each would have cost

### 1 · Sign-in is rate limited by NETWORK, and the swarm is one network

Twenty attempts per fifteen minutes, bucketed by the caller's /24. Right for the public
internet. **Twenty-eight agents behind one egress address is not close to it.**

The run would have stalled in wave 1, every agent reporting *"too many attempts"* as a defect
in the product, and nobody would have found the cause for hours. Four runs of a three-flow
probe exhausted the bucket, which is how it was found.

**Fixed.** While `SIMULATION_RUNNING=1` — the flag that already disallows indexing and paints
the violet strip — every per-network limit is multiplied by twenty-five. The platform-wide
`global:` ceiling is **not**, because that is the one number that would notice an actual
attack. `npm run verify:limits` is a gate of its own and holds both halves.

### 2 · 🔴 A patient cannot have an email address

`/patient/signup` asks for a first name, a phone, a time zone and an optional password. **It
never asks for an email.** Nothing anywhere else lets her add one: `/patient/account` shows
the address as "not added" beside a notice calling it *"another way to sign in, and the only
way to receive your record"*, and offers no control to add it.

So `patient_accounts.email` is null for every patient who signs herself up. Before this,
`12-THE-LOGINS.md` promised seven patient addresses that cannot exist, and at the end of six
months `verify:cast --complete` would have reported **seven people missing** — which reads as
an agent who never finished a wave and is the product working exactly as designed.

**The run is corrected, the product gap is written down.** `P1` to `P7` carry
`+20 100 900 0041` to `0047`, `verify:cast` looks a patient up by phone before address, and
the login list says so. The missing control is a real gap and it is recorded rather than
papered over.

### 3 · 🔴 An Egyptian customer on the default region is offered Stripe

`organizations.region` defaults to `us`. On `us` the plan panel says *"You will be taken to
the card page to finish"* and Confirm redirects to **checkout.stripe.com**. That is correct
for a US customer and impossible in the launch market, where `topUpPot` refuses `entity='eg'`
and the bank transfer is the entire rail.

On `eg` the same button raises a bill of EGP 4,000 and offers the bank, the account name and
the IBAN. **Asserted in both directions.**

**The operator moving each customer to region `eg` is not a tidying step.** It comes BEFORE
anybody is asked for money, or the run's money leaves by the card rail, the transfer queue
stays empty, and the evidence about the half of this product that is new is a Stripe page
nobody in Cairo can pay.

### 4 · The onboarding chips are in the same form as the licence fields

Languages and specialties are `sr-only` checkboxes inside a label. Two obstacles in one
control: a driver has to click the label rather than the input, **and** selecting them after
pressing Save details saves nothing, because they are part of the same form. The screen gives
no sign of it — the submit button simply stays disabled with every visible field filled in.

Nine clinicians walk this in wave 1.

### 5 · Both enquiry forms end in "Ask us to call"

Not Apply, not Submit. And there is no applications table: a practice's enquiry creates a
**held `organizations` row** and an employer's a `sponsors` row, with the state on the row
itself, because 54.3's rule is that nothing is set up until somebody has spoken to them.

---

## Four smaller ones, worth knowing

| | |
|---|---|
| The country select is by **code**, and its labels carry a flag emoji | Selecting by the visible label `Egypt` matches nothing, and the form then reports Country and Regulator missing |
| An upload takes about **2.3 seconds** to reach its column | Submit is disabled until all four are there. An agent that uploads and presses submit immediately sees a dead button |
| The plan card she is **already on** is disabled | "Pay as you go" is marked Yours and refuses a click. A driver taking the first plan button hangs on it |
| The submit button is React's, so it reads disabled **until hydration** | A check taken at that instant is measuring the server's HTML rather than the product |

---

## What this rehearsal did NOT do, said out loud

**It did not run a session end to end.** Sixty-two sessions and 286 minutes of audio cost
about $4.80 of product-side model spend and another $4 to $5 of synthesis that `npm run spend`
cannot see. Rehearsing that would spend most of the run's budget to learn what the run itself
is going to measure. `13-THE-AUDIO.md` is the document; the first session of the real run is
the measurement.

What F3 does check is everything up to the money: that an approved clinician reaches her own
dashboard, and that the session-scoped transcription door the audio goes through is still
there and still refuses a request with no token.

**It did not walk the edge cases**, on purpose. Thirty of those are the run's job.

**It ran on dev, not production.** `writesTo()` refuses production by name, and the
`Probe` surname exists so that a Probe row turning up in the run's evidence is immediately
legible as a mistake rather than as a patient.

---

## Go or no go

**Go.**

Every main path walks. The one defect is understood, its consequence for the run's evidence is
closed, and the product gap behind it is written down rather than hidden. The obstacle that
would actually have stopped the run — the rate limiter — is fixed in the product with a gate
holding both directions, and the one that would have quietly ruined the money evidence — the
region — is now stated as an ordering rule rather than a clause.

All 27 gates pass.

🔴 **Until 76.61 they could not be run twice from one build, and that is worth its own
paragraph.** Two of them fought over `.next`: `renders` needs `next build` output and `served`
recompiled over it with `next dev`. Worse, `served` leaked the `next-server` its dev server
forked, which kept compiling in the background with the port already released, so the
corruption arrived minutes AFTER the gate reported PASS. A later pass then failed on
`/for-patients` or `/ar/pricing`, naming public pages that were perfectly fine. The pass went
green twice and red on the third run with nothing changed between, which is the shape that
teaches people that red means run it again. H37 and H39.

Measured after the fix: `served` leaves **zero** `next-server` processes behind and no longer
touches `.next/server/middleware.js`. And the whole thing end to end, one build, two passes,
nothing touched between them:

    PASS 1                                      all 27 pass.
    PASS 2 (no rebuild, nothing touched)        all 27 pass.

The migrations ledger and the journal agree at 112 on production.

Production, dev and the simulation agree on every setting group and every country **except
one, which is a decision rather than drift**: the in-session copilot is capped at 4 on
production to protect the run's $10 of model credit, and stays at the shipped 10 on the other
two. `settings:compare` prints that difference with its reason beside it instead of failing on
it, and fails on anything else, including the same key at a third value. The gate caught it;
what changed is that a caught decision no longer reads as a broken product.

The two things to do first, in the run, in this order:

1. **Move every Egyptian customer to region `eg`** before anybody is asked for money.
2. **Check `SIMULATION_RUNNING=1` is live on production** before the swarm signs in. Without
   it the limiter is at its production setting and wave 1 stalls. `curl
   https://24t.vercel.app/robots.txt` is the instrument: `Disallow: /` means the flag is on in
   the deployed runtime, because the same variable drives both.

And one thing NOT to do, because the document used to tell you to:

3. 🔴 **Do not run `simulate:seed`.** It has already run on production and refuses a second
   time. Its refusal advises making a fresh branch, which is written for an empty database and
   would throw the seeded run away. `npm run on:production -- verify:cast` is the check that
   answers the same question: 7 of 26 sign in, 5 of 5 green.
