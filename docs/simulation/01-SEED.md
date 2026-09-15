# The cast

Twenty-eight identities across six waves. **Every one of them exists to prove something
specific**, named in its own row. An identity with no scenario is a row in a database, not a
person, and this simulation already has enough rows.

`scripts/simulate-seed.ts` creates only what a person could not create for themselves: the
platform operator, and the four applications waiting in his queue. **Everybody else signs
themselves up, through the real forms, as their own agent.** A cast that is seeded into
existence never walks the sign-up flow, and sign-up is where two of the last three
walkthroughs found their worst defects.

🔴 **It has already been run.** The simulation branch has the operator, the settings, the
published site and the four applications on it. Run `npm run simulate:seed` anyway as your
first act: it will **refuse**, saying an operator already exists, and that refusal is the
cheapest proof available that you are pointed at the right database.

## The naming rule, which is not negotiable

Surname **Demo** or **Example**. Address at `example.com`. Phone in the block
`+20 100 900 00NN`, reserved for fiction.

🔴 **Everybody is Egyptian.** The earlier cast had a therapist in Leeds and a company in
London in it, and that was a mistake: it gave the money half of the run a card rail to fall
back on. There is no card rail in Egypt. `topUpPot` refuses `entity = 'eg'`, and the bank
transfer queue is the whole of how money reaches us. A run with one non-Egyptian customer
would have proved that the easy path works.

These frames are committed and go into a video. A frame containing "Layla Demo" is one
anybody can see is synthetic without checking.

Shared password for every account: `Simulation2026!`

---

## Wave 1 · month 0 · the platform opens

Seven identities. This is the product with nobody on it, which is the state every real
platform starts in and the one nobody ever photographs.

| # | Who | Signs up as | Exists to prove |
|---|---|---|---|
| `OP` | Nour Example, operator | seeded | The console works before there is anything in it. Opens Egypt, **types the bank transfer details in by hand**, moves each customer onto the Egyptian entity, publishes content, and **works the verification queue and the payments queue from here on** |
| `T1` | Dr Amira Demo, Cairo, Arabic + English | therapist, pay as you go | **The Egyptian therapist.** No card rail. Everything she earns is held by us and paid out by hand. She is the reason `03-MONEY.md` exists. Joins a practice in wave 2 and takes her payout in wave 3 |
| `T2` | Dr Yassin Demo, Cairo | therapist, pay as you go | **The one who upgrades, and pays by transfer.** Starts metered. In wave 3 he subscribes to Practice: there is no checkout, we raise the bill, he transfers, and an operator confirms before he is on the plan. The bill must make sense on both sides of the change |
| `T3` | Dr Karim Demo, Alexandria | therapist, pay as you go | **The radar therapist.** Lives on call. Most of his work arrives from strangers in crisis, none of it booked |
| `T4` | Dr Omar Demo, Giza | therapist, **rejected twice** | 🔴 **NEW, AND NOTHING HAS EVER RUN IT.** Rejected, resubmits, rejected again, documents deleted, locked out. A practice invites him in wave 2 and he is still locked out. He reapplies with new documents and is approved. See the panel below |
| `P1` | Layla Demo, Cairo, Arabic only | patient, self-pay | **The whole product in Arabic.** Finds T3 on the radar with no account, has the session, then claims the record he kept. Revokes his access in wave 3 |
| `P2` | Salma Example, Cairo | patient, self-pay | **The calendar path, on the transfer rail.** Books an hour with T2 like an ordinary appointment. 🔴 Her payment screen is a bank account, not a card form. She transfers, waits on the processing screen, an operator clears it, and **she joins the session the moment they do**. Asks a previous therapist for her history in wave 3 |

**What wave 1 must produce before it is aged:** at least one session per therapist, one of
them found on the radar with no account, one booked on a calendar, one in Arabic end to
end, every one of them transcribed and noted by the real AI, every note approved, every
summary sent, and every payment settled or held.

### 🔴 T4, the rejection cycle, spelled out because it is new product

This is the sequence the operator agent and T4's agent walk together. **Every step is a
screen somebody presses, and every one of them is photographed.**

| Step | Who | What must be true |
|---|---|---|
| 1 | `T4` | Signs up, uploads ID, licence and headshot, submits |
| 2 | `OP` | Rejects, with a reason in his own words. The card warns him this is the first no |
| 3 | `T4` | **Reads the reason, verbatim, in his email and on his own onboarding screen.** Not a code, not "rejected" |
| 4 | `T4` | Resubmits the same documents. This is allowed once, and it is the case the first rejection is for |
| 5 | `OP` | Rejects again. 🔴 **The button says "Reject and clear" and the card says what that will do, before it is pressed** |
| 6 | (us) | The documents are **deleted**, the row keeps the count, and `documents_cleared_at` is stamped |
| 7 | `T4` | Signs in. The slots are empty and the screen says why: we looked twice, we did not keep them, upload again |
| 8 | `T4` | Presses submit with nothing uploaded. **Refused**, and the sentence names the reason rather than listing three missing fields |
| 9 | `C1` | Invites him in wave 2. He accepts and joins the practice |
| 10 | `T4` | 🔴 **Still cannot see a patient.** The practice's invitation is not evidence of a licence. He is refused at the gate and the refusal is captured |
| 11 | `T4` | Uploads fresh documents and submits, now from inside the practice |
| 12 | `OP` | Sees the queue row carrying **Nile Practice**, not the org he left, and approves it |
| 13 | `T4` | Works. Takes a patient. The count stays at 2 forever |

If any one of steps 6, 8, 10 or 12 does not hold, that is the most valuable finding this
wave can produce, and it is written down rather than worked around.

---

## Wave 2 · month 1 · the first practice and the first employer

Nine identities. Growth begins and the product stops being one therapist and one patient.

| # | Who | Signs up as | Exists to prove |
|---|---|---|---|
| `C1` | Nile Practice, Cairo, 3 seats | clinic, applied then approved | The practice buys seats and the seat ladder charges what the pricing page says |
| `C1-M` | Hana Example, practice manager | clinic admin | Sees schedules and bills, and **must fail** to reach a note. That failure is captured as evidence |
| `C1-S` | Fatma Example, practice staff | delegated by C1-M | 🔴 **Sprint 63's whole point.** Given some powers and not others. Must succeed at what she was given and be refused the rest, both captured |
| `C1-A` | Dr Tarek Demo | clinician, invited | The ordinary path: invited, verifies his own licence, joins. Leaves again in wave 3 |
| `C1-B` | **T1 joins C1** | existing account | 🔴 **The hard one.** A therapist who already has patients joins a practice. Sprint 62 built this: her own subscription is cancelled, a seat is taken, her patients follow her, and the practice must still never see their notes |
| `C1-C` | **T4 is invited** | existing, rejected account | 🔴 Steps 9 to 13 above. The seat is taken and the gate still holds |
| `E1` | Cairo Foundry, 100% coverage | employer | The pot, funded once, covering everything, and spent to nothing in wave 3 |
| `E1-HR` | Dalia Example | sponsor admin | Watches money, **must fail** to learn who attended |
| `P3` | Mostafa Demo | patient, enrols with a code | 🔴 **THE DEEP RECORD.** Covered 100%, so he comes every week. He ends the simulation with the most sessions, the most journals and two therapists, and `06-COPILOT-EXAM.md` expects his copilot to be the best one on the platform. If it is not, that is the finding |
| `P4` | Hoda Demo | enrolment **fails**, then succeeds | 🔴 **Two proofs, one person.** Types a staff number the employer's system does not recognise and is refused. Then enrols with her work email, which sends a code to an address on the employer's domain. The refusal and the recovery are both captured |

---

## Wave 3 · month 3 · scale, strain, and the edge cases

Six identities and seven events. **Nothing here is decoration.** Each one is a case this
product claims to handle and has never been made to.

| # | Who or what | Exists to prove |
|---|---|---|
| `E2` | Alexandria Textiles, **10% coverage** | 🔴 **The partial pot, and the arithmetic on the slider.** Covers a tenth. At 10% of a $20 session they pay $2, so their $200 welcome credit covers about 100 sessions, and the screen must say so before they press Save. Every patient of theirs pays the other 90% themselves, and both halves appear on both sides |
| `E2-HR` | Mariam Example, sponsor admin | Sets coverage: **must press Edit first**, then move the slider, read the session estimate, then Save. Gets the notice period and cannot shorten it |
| `P5` | Nadia Example | 🔴 Covered 10%, pays the rest herself, **and then is hired away by `E3`.** Her old funding stops, her new funding starts, her record does not move, and neither employer learns the other exists. If one line of this is wrong it is the worst defect the simulation can find |
| `E3` | Delta Logistics | Hires `P5` away from `E2` |
| `P6` | Ziad Example, Cairo | 🔴 **Never creates an account.** Sees a therapist three times through join links and remains a stranger to us. 🔴 He pays by transfer each time **as the session itself**, which is the payer kind 0105 exists for: a guest has no account and being asked for one before a crisis session would be the wrong trade. Proves the product works for somebody who refuses it, and is **the thin record** the copilot exam measures `P3` against |
| `D1` | Helio Health, integrator | partner. Keys, scopes, a rate limit. Opens sessions through the API and gets notes back. Never sees a patient it did not bring |
| `E1→empty` | The pot runs out | 🔴 The pot funded in wave 2 is spent. The meter goes amber, then red, coverage stops, patients are asked to pay, HR is alerted, HR tops up. **The single most important money moment in the simulation** |
| `T2→plan` | The upgrade | 🔴 T2 moves from metered to monthly. The bill before, the bill after, and the month he had already paid for |
| `T1 payout` | Amira requests her money | 🔴 The Egyptian manual rail, end to end: request, operator approval, stamp, and a therapist who can see every step |
| `C1-A leaves` | Dr Tarek leaves the practice | The seat is released, his notes stay with the practice, his patients keep their records, and the next bill is lower by exactly one seat |
| `P1 revokes` | Layla ends a therapist's access | It stops that second, and the notes he already wrote stay his |
| `P2 asks` | Sarah asks a previous therapist for her history | He is asked, he answers, and she hears back either way |
| `E1 re-check` | The verification cycle runs | Somebody does not answer. Their funding pauses and nothing else about them changes |

---

---

## Wave 4 · month 4 · the month the bills come, and the month things break

🔴 **This is the most valuable wave in the run and the one nothing has ever exercised.** The
beta promise ends, the first full-price invoice goes out, and four things go wrong on
purpose. A simulation in which nothing breaks proves only that the happy path is happy.

### The money stops being free

| # | What | Must be true |
|---|---|---|
| `M4-1` | 🔴 **Wave 1's therapists are billed at FULL PRICE** | An invoice with **no discount line**. `08-THE-OFFER.md` calls this the single most important frame in the run, and it is: everything the forecast says about month 7 rests on what these people do when they see it |
| `M4-2` | 🔴 **One of them does not pay** | `T3` lets the month lapse. Nothing anywhere demotes him: the obligation is never settled, `lapseOverdue` marks it lapsed, and `entitledTier` puts him back on pay as you go by itself. His next session bills at the metered rate and he can see why |
| `M4-3` | 🔴 **`T2` subscribes by transfer and IS on the plan** | He presses Subscribe. There is no checkout. A bill is raised, the transfer card asks for it in pounds, he sends it, **and he is still on pay as you go until an operator confirms**. That gap is the design, not a delay |
| `M4-4` | 🔴 **A therapist checks the promise is true** | `T1` compares one month of session earnings against her $100 bill. Ten sessions at $20 earns her $200 against it. **If that is not true on her own screens, the plan is wrong and the run has found it** |
| `M4-5` | 🔴 **A new therapist gets one free month and then full price** | `T5` joins this month. The offer after the beta is one month free, then the full $100. No half price, no schedule, no exception |

### The four bugs, injected deliberately

These are not defects to find. They are **states a real month produces** and which nothing
has ever put this product into. Each one is walked by an agent through the screens.

| # | What happens | What must hold |
|---|---|---|
| `B1` | 🔴 **An employee is removed from a company** while they have a session booked next week | Their funding stops for anything not yet booked, the booked session keeps the coverage it was booked under, and the patient is told which. C311's notice rule, applied to one person rather than a percentage |
| `B2` | 🔴 **One person works for two customer companies** | `P5` is on `E2` and `E3` at the same time for one week. Exactly one pot pays for each session, the rule that picks which is the same rule twice, and **neither employer learns the other exists** |
| `B3` | 🔴 **A company tops up and the transfer never arrives** | `E1-HR` declares a transfer with a reference nobody can find. An operator rejects it **with a reason in their own words**. HR reads that reason verbatim, not a code, and sends a real one. The pot moves only on the second |
| `B4` | 🔴 **A pot runs to nothing mid-month** | `E1`'s pot empties. Coverage stops. 🔴 HR is alerted **and so is the patient**, and the patient's screen says **"Account on hold, ask HR to activate"** rather than a payment error. HR tops up, and the next booking works |

### And two people whose seats move

| # | Who | Exists to prove |
|---|---|---|
| `C1-A leaves` | Dr Tarek Demo | 🔴 He leaves the clinic and lands on **pay as you go**, by himself: his new practice has no subscription and the default for no subscription is metered. His patients follow him, his notes stay with the practice, and the clinic's next bill is lower by exactly one seat |
| `T5→clinic` | Dr Hala Demo | 🔴 **Mid-month upgrade with proration.** A practice of one becomes a practice of three on the 15th. The screen quotes the difference for the days remaining **before** she agrees, and then that exact figure is billed. A quote that is not what happens is not a quote |

### 🔴 And the one a clinic admin must fail at

| `C1-M` | Hana Example tries to suspend `C1-A` | **There is no such control, anywhere.** A practice manager can end the working relationship and cannot reach into an account that is not theirs. The absence is the feature, and the screenshot of the screen without that button is the evidence |

---

## Wave 5 · month 5 · churn, and growth that has to be paid for

Two identities and the month the plan is actually tested.

| # | Who or what | Exists to prove |
|---|---|---|
| `T6` | Dr Sameh Demo | Joins on the post-beta offer: **one free month, then $100**. The second therapist to see that sequence, so it is a rule rather than an accident |
| `P7` | Yousra Demo | 🔴 **The pay-as-you-go-only patient's therapist.** `T6` never subscribes at all: $4 a session on a $20 session, which is why $80 is exactly 20 sessions. A therapist below 20 a month is right to stay metered, and the product must not push them |
| `churn` | 🔴 **Somebody leaves at $100** | One of wave 1's therapists cancels rather than pay full price. **This is the number the whole forecast turns on** and the run produces exactly one observation of it. One observation is not a rate, and `07-FINANCIAL-MODEL.md` says so; it is still worth more than the guess it replaces |
| `E3` tops up | Delta Logistics funds its pot | The second company on the transfer rail, so the queue has more than one kind of row in it |

---

## Wave 6 · month 6 · the close

No new people. This wave exists to read what the other five produced.

| # | What | Who |
|---|---|---|
| `X1` | The full money cycle, closed and read off the operator's own screens | the money agent |
| `X2` | The copilot exam | you |
| `X3` | The cost model fitted from real rows, at 3, 8 and 50 minutes | you |
| `X4` | 🔴 **The CFO agent's second pass**, with six months of real rows rather than three | see `02-ORCHESTRATION.md` |
| `X5` | 🔴 **The strategist's sixth monthly note**, and the one that matters: what the six months say about the next six | see `02-ORCHESTRATION.md` |
| `X6` | The forecast re-run with everything measured, and the provenance split on `/admin/financial-model` moved | you |

---

## 🔴 How often each patient comes, which is the whole cost model

**Sixty sessions across six months, and they are not spread evenly.** The budget is
$10 (`00-START-HERE.md`) and an even spread would buy a tidy database that answers nothing:
the claim being tested is that a thick record makes a better copilot, and that cannot be
tested on a cast where everybody has five sessions.

🔴 **Six months costs almost nothing more than three.** The AI bill tracks the SESSION COUNT
and not the calendar, so the extra three months are twenty-seven more sessions at the measured
rate, which is about ninety cents. What the extra three months buy is the only thing the
first three cannot show: what people do when the free month ends.

So the cadence is **designed**, and it is the first thing the orchestrator drives towards:

| Who | Comes | Sessions | **Minutes** | Journals | Docs | Therapists | Why this cadence |
|---|---|---|---|---|---|---|---|
| `P3` Mostafa | **every week** | **11** | **8** | **14** | 2 | 2 | Covered at 100%, so there is nothing to stop him. The deep end of the ladder, and the copilot exam's top mark should be his |
| `P1` Layla | **every two weeks** | **6** | 3 | **8** | 1 | 1 | Self-pay, and entirely in Arabic, so the exam covers both languages at depth |
| `P5` Nadia | **every two weeks** | **5** | 3 | 3 | 0 | 2 | Covered at 10%, pays the rest, and changes employer half way |
| `P2` Salma | **every month** | **3** | 3 | 2 | 1 | 2 | Self-pay by bank transfer. An ordinary appointment, kept ordinarily |
| `P4` Hoda | **every month** | **3** | 3 | 1 | 0 | 2 | Enrolled after one refusal. Her second therapist is `T4`, after he is finally approved |
| `P6` Ziad | **every month** | **3** | 3 | **0** | **0** | 1 | 🔴 **The thin end.** No account, so no journal and no documents. His copilot has transcripts and nothing else |
| Radar strangers | once each | 2 | 3 | 0 | 0 | 1 | `T3`'s crisis arrivals. Nobody comes back |
| `D1` through the API | n/a | 2 | 3 | 0 | 0 | 1 | A partner opens sessions and gets notes back |
| | | **35** | **160** | **28** | **4** | | |

### Months 4 to 6, on top of that

| Who | Comes | Sessions | **Minutes** | Journals | Why |
|---|---|---|---|---|---|
| `P3` Mostafa | **every week** | **9** | **8** | 8 | The deep record keeps getting deeper, which is what the exam measures |
| `P1` Layla | every two weeks | **5** | 3 | 5 | Arabic, at depth, across the price change |
| `P5` Nadia | every two weeks | **4** | 3 | 2 | Two employers for one week of it (`B2`) |
| `P7` Yousra | every month | **3** | 3 | 1 | The pay-as-you-go therapist's patient |
| `P2` Salma | every month | **2** | 3 | 1 | Ordinary, kept ordinarily, and paying by transfer |
| `P4` Hoda | every month | **2** | 3 | 1 | |
| Radar strangers | once each | **2** | 3 | 0 | `T3`'s crisis arrivals keep arriving after he drops to metered |
| | | **27** | **105** | **18** | |

| | Sessions | Minutes | Journals |
|---|---|---|---|
| Months 0 to 3 | 35 | 160 | 28 |
| Months 4 to 6 | 27 | 105 | 18 |
| **Six months** | **62** | **265** | **46** |

## 🔴 TWO SESSION LENGTHS, AND THE SECOND ONE IS NOT DECORATION

**`P3`'s eleven sessions run 8 minutes. The other twenty-four run 3.** Not a single length,
and not an accident. This is the only part of the whole design that exists to serve the
**financial model** rather than the product walkthrough, and without it the forecast that
comes after this run would be wrong by a factor of two.

### Why

A session's model cost has two terms, not one:

```
  cost = FIXED + VARIABLE x minutes
```

The fixed term is everything that happens once whatever the length: the note writer's system
prompt, measured at **995 tokens**; the note it writes, which is **659 tokens and shrinks
slightly with length**; the risk prompt and its five-token verdict; four copilot turns, whose
input is **flat at 629 tokens** because `CONTEXT_SEGMENTS = 14`; the diarist's own overhead;
and the profile rebuild. The variable term is transcription at $0.003 a minute, plus **198
tokens a minute** into each of the note and risk prompts and **243 a minute** into the diarist.

🔴 **These are measurements, not estimates.** On 2026-09-14 all four prompts were run against
the live OpenAI API at 3, 8, 20 and 50 minutes, for $0.37 of spend. `evals/physics.json` holds
every row; `lib/finance/scenarios.ts` reads the two terms out of it.

| | 3 min | 8 min | 50 min |
|---|---|---|---|
| Fixed | $0.0132 | $0.0132 | $0.0132 |
| Variable | $0.0122 | $0.0325 | $0.2035 |
| **Total** | **$0.0254** | **$0.0457** | **$0.2167** |

At three minutes the fixed term is **52%** of the bill. At fifty it is **6%**. So a run of
uniform short sessions sits in the regime where linear extrapolation is worst:

> Multiply the 3-minute session by 50/3 and you get **$0.4230**.
> The truth is **$0.2167**. Multiplication overstates it by **95%.**

That is not a rounding argument. At a $1 platform fee plus 15%, it is the difference between
a business with a gross margin and one without.

### How two lengths fix it

Two unknowns need two measurements. One duration gives one equation and the fit is
underdetermined; a regression through a single cluster returns a slope drawn through noise
and an intercept equal to the mean, and **it looks exactly as authoritative as a real fit.**

So the run produces two clusters, 3 and 8 minutes, and `npm run physics` solves for both
terms from `ai_request_logs`. `lib/finance/physics.ts` **refuses to fit** a single cluster
and says so rather than returning a number.

### What it costs

Nothing. It is cheaper than the flat plan it replaces:

| | Audio | Cost |
|---|---|---|
| 35 sessions, flat 4 min | 140 min | $1.19 at the measured rate |
| **24 at 3 min + 11 at 8 min** | **160 min** | **$1.11** |

And the longer sessions are `P3`'s, which is where the copilot exam wants the richest
transcripts anyway. The calibration and the memory test want the same thing.

🔴 **Do not flatten the durations to tidy the run.** Every session the same length is the one
input shape from which scenario two cannot be derived at all.

### What the ladder has to produce, or the exam measures nothing

`P3` at 11 sessions against `P6` at 3 is a depth score of roughly 80 against 15. If the run
ends with everybody on four sessions because each agent did its task once and reported
success, `06-COPILOT-EXAM.md` will correlate nothing and the most interesting question in the
simulation goes unanswered.

**So the orchestrator reports the ladder at the end of every wave**, and a wave that ends
with `P3` level with `P6` is a wave that is not finished.

## What the seed script creates, and nothing more

1. The operator.
2. Platform settings, countries, taxonomy, published content.
3. The three employer and one clinic **records in a pre-approval state**, because
   applying is a form a person fills in but approving is an operator's decision and the
   operator agent must make it on camera.

**It creates no therapist, no patient, and no session.** Those are people, and people sign
themselves up.

## 🔴 One thing the seed does set, and did not before

`country_settings` for Egypt still leaves the crisis line null, and that is correct: a
configured line is an operator's entry with their name and the date on it.

But the product no longer falls back to silence there. `lib/crisis/line.ts` now holds
Egypt's verified line, **105, press 1 for Arabic, then 1 for mental health**, given directly
by the product's owner on 2026-09-14 and the first entry that table has ever had for the
first market.

**So the SOS orb is now a real thing to photograph in Cairo**, and `P1` Layla is the person
to photograph it as: she reads only Arabic and the menu instruction is the half of that
button that decides whether it works.
