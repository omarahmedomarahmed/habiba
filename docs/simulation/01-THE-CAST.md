# The cast

**Twenty seven people and four organisations, across six waves.** Every one of them exists to
prove something specific, named in its own row. A person with no scenario is a row in a
database, and this simulation already has enough rows.

| Customers | Count |
|---|---|
| Therapists | 7 |
| Patients | 7 |
| Practice manager, practice staff | 2 |
| Company HR admins | 3 |
| Integrator | 1 |
| **Cast agents, one each** | **20** |

| Us | Count |
|---|---|
| Founders | 2 |
| Sales | 2 |
| Marketing | 1 |
| Support, sharing the transfer queue | 2 |
| **The payroll** | **7** |

| | Count |
|---|---|
| **People** | **27** |
| Organisations they belong to | 1 practice, 3 companies |

🔴 **Those numbers are read by a machine.** `scripts/verify-cast.ts` parses the `People` row
out of this file and fails if `scripts/_cast.ts` holds a different number. The version of this
document that said twenty one while the code held nineteen is how `T5`, `T6`, `P7` and `D1`
went a sprint with no address anybody could sign in with, and it is also how five people drew
a salary for six months with no account to work their queue from. A count in prose is a claim;
a count something checks is a fact.

One agent per customer. **Our own seven are worked by the standing agents** in
`02-THE-SWARM.md`, because their screens are queues rather than journeys. So **20 cast
agents**, plus eight standing, plus capture, plus the orchestrator.

## What is already on the branch, and what is not

`scripts/simulate-seed.ts` creates only what a person could not create for themselves:

1. The platform operator.
2. Platform settings, countries, taxonomy, published content.
3. The clinic and company **applications**, in a pre approval state.

**It creates no therapist, no patient and no session.** Those are people, and people sign
themselves up. A cast seeded into existence never walks the sign up flow, and sign up is where
two of the last three walkthroughs found their worst defects.

**It has already been run.** Run `npm run simulate:seed` anyway as your first act: it will
refuse, saying an operator already exists, and that refusal is the cheapest proof available
that you are pointed at the right database.

## The naming rule, which is not negotiable

Surname **Demo** or **Example**. Address at `example.com`. Phone in the block
`+20 100 900 00NN`. One shared password: `Simulation2026!`

🔴 **A PATIENT HAS NO ADDRESS, AND THAT IS THE PRODUCT RATHER THAN AN OVERSIGHT.**
`/patient/signup` asks for a first name, a phone, a time zone and an optional password, and
**it never asks for an email**. Nothing anywhere else lets her add one: `/patient/account`
shows the address as "not added" beside a notice calling it *"another way to sign in, and
the only way to receive your record"*, and offers no control to add it.

So every patient's handle is her number, `P1` to `P7` hold `+20 100 900 0041` to `0047`, and
the way in is a one-time code. The mini simulation found this by filling the form the way a
clinician's is filled and being refused; before that, `12-THE-LOGINS.md` promised seven
addresses that cannot exist and `verify:cast --complete` would have reported seven people
missing at the end of six months — which reads as an agent who never finished a wave.

**Everybody is Egyptian.** An earlier cast had a therapist in Leeds and a company in London,
which gave the money half of the run a card rail to fall back on. There is no card rail in
Egypt: `topUpPot` refuses `entity = 'eg'` and the transfer queue is the whole of how money
reaches us. A run with one non Egyptian customer would have proved that the easy path works.

---

## Wave 1 · month 0 · the platform opens

Thirteen people: our whole company of seven, and the first six customers. This is the product
with nobody on it, which is the state every real platform starts in and the one nobody ever
photographs.

### Us, all seven seeded, all seven able to sign in

🔴 **This was two of seven until 76.55**, and the other five drew $500 a month with no account.
Every row they clear now carries their own name, which is the only reason an audit log of a
six month run is evidence about a company rather than about one person.

| # | Who | Role | The queue that is theirs |
|---|---|---|---|
| `OP` | Nour Example, founder, clinical and operations | `super_admin` | Opens Egypt, **reads the transfer details back on camera** (they are placeholders, filled in, and stay that way for the run), moves each customer onto the Egyptian entity, publishes content, and holds the settings |
| `OP2` | Sherif Example, founder, product and engineering | `super_admin` | The board, the radar, benefits, the error log and `/admin/actuals`. **The founder-only half**, so that Heba being refused it means something |
| `SU1` | Heba Example, support | `staff` | Transfers. **Not a founder:** she is refused the benefits board and the radar, and that refusal is captured |
| `SU2` | Sara Example, support and onboarding | `staff` | Transfers, **shared with Heba.** They both open one transfer, which is the collision a queue of one never produces |
| `SU3` | Amal Example, sales, companies and universities | `staff` | Sponsors and their pot top-ups |
| `SU4` | Hossam Example, sales, clinics and therapists | `staff` | Verifications and payouts. Both of Dr Omar's rejections are his |
| `SU5` | Farida Example, marketing | `staff` | Support and the crisis numbers directory. In a company of seven the marketer answers the inbox |

### And the first six customers

| # | Who | Signs up as | Exists to prove |
|---|---|---|---|
| `T1` | Dr Amira Demo, Cairo, Arabic and English | therapist, metered | **The Egyptian therapist.** No card rail. Everything she earns is held by us and paid out by hand. Joins a practice in wave 2 and takes her payout in wave 3 |
| `T2` | Dr Yassin Demo, Cairo | therapist, metered | **The one who upgrades, and pays by transfer.** In wave 4 he subscribes: there is no checkout, we raise the bill, he transfers, and an operator confirms before he is on the plan |
| `T3` | Dr Karim Demo, Alexandria | therapist, metered | **The radar therapist.** Lives on call. Most of his work arrives from strangers in crisis, none of it booked. In wave 4 he lets his bill lapse |
| `T4` | Dr Omar Demo, Giza | therapist, **rejected twice** | Rejected, resubmits, rejected again, documents deleted, locked out. A practice invites him in wave 2 and he is **still** locked out. See the panel below |
| `P1` | Layla Demo, Cairo, Arabic only | patient, self pay | **The whole product in Arabic.** Finds `T3` on the radar with no account, has the session, then claims the record he kept. Revokes his access in wave 3 |
| `P2` | Salma Example, Cairo | patient, self pay | **The calendar path, on the transfer rail.** Books an hour with `T2` like an ordinary appointment. Her payment screen is a bank account, not a card form. She transfers, waits, an operator clears it, and **she joins the session the moment they do** |

**What wave 1 must produce before it is aged:** at least one session per therapist, one found
on the radar with no account, one booked on a calendar, one in Arabic end to end, every one
transcribed and noted by the real model, every note approved, every summary sent, and every
payment settled or held.

### T4, the rejection cycle, spelled out because it is new product

The operator agent and `T4`'s agent walk this together. **Every step is a screen somebody
presses, and every one is photographed.**

| Step | Who | What must be true |
|---|---|---|
| 1 | `T4` | Signs up, uploads identity document, licence and headshot, submits |
| 2 | `OP` | Rejects, with a reason in his own words. The card warns him this is the first no |
| 3 | `T4` | **Reads that reason, verbatim**, in his email and on his own onboarding screen. Not a code, not "rejected" |
| 4 | `T4` | Resubmits the same documents. Allowed once, and it is the case the first rejection is for |
| 5 | `OP` | Rejects again. The button says **"Reject and clear"** and the card says what that will do before it is pressed |
| 6 | (us) | The documents are **deleted**, the row keeps the count, `documents_cleared_at` is stamped |
| 7 | `T4` | Signs in. The slots are empty and the screen says why: we looked twice, we did not keep them, upload again |
| 8 | `T4` | Presses submit with nothing uploaded. **Refused**, and the sentence names the reason rather than listing three missing fields |
| 9 | `C1` | Invites him in wave 2. He accepts and joins the practice |
| 10 | `T4` | **Still cannot see a patient.** A practice's invitation is not evidence of a licence. Refused at the gate, and the refusal is captured |
| 11 | `T4` | Uploads fresh documents and submits, now from inside the practice |
| 12 | `OP` | Sees the queue row carrying **Nile Practice**, not the organisation he left, and approves it |
| 13 | `T4` | Works. Takes a patient. The count stays at 2 for ever |

If any of steps 6, 8, 10 or 12 does not hold, that is the most valuable finding this wave can
produce, and it is written down rather than worked around.

---

## Wave 2 · month 1 · the first practice and the first employer

Six new people and two organisations. The product stops being one therapist and one patient. `C1-B` and `C1-C` are wave 1's `T1` and `T4` arriving somewhere new, not new people.

| # | Who | Signs up as | Exists to prove |
|---|---|---|---|
| `C1` | Nile Practice, Cairo, **3 seats** | clinic, applied then approved | The practice buys seats at **$72** each and the invoice matches the pricing page. Three, not four: a small Cairo practice is two clinicians, sometimes three, and the plan models nothing bigger |
| `C1-M` | Hana Example, practice manager | clinic admin | Sees schedules and bills, and **must fail** to reach a note. That failure is captured as evidence |
| `C1-S` | Fatma Example, practice staff | delegated by `C1-M` | Given some powers and not others. Must succeed at what she was given and be refused the rest, both captured |
| `C1-A` | Dr Tarek Demo | clinician, invited | The ordinary path: invited, verifies his own licence, joins. Leaves again in wave 4 |
| `C1-B` | **`T1` joins `C1`** | existing account | **The hard one.** A therapist who already has patients joins a practice: her own subscription is cancelled, a seat is taken, her patients follow her, and the practice must still never see their notes |
| `C1-C` | **`T4` is invited** | existing, rejected account | Steps 9 to 13 above. The seat is taken and the gate still holds |
| `E1` | Cairo Foundry, **100% coverage** | employer | The pot, funded once, covering everything, and spent to nothing in wave 4 |
| `E1-HR` | Dalia Example | sponsor admin | Watches money, **must fail** to learn who attended |
| `P3` | Mostafa Demo | patient, enrols with a code | **THE DEEP RECORD.** Covered at 100%, so he comes every week. Ends with the most sessions, the most journal entries and two therapists, and `07-THE-EXAM.md` expects his copilot to be the best on the platform. If it is not, that is the finding |
| `P4` | Hoda Demo | enrolment **fails**, then succeeds | Two proofs, one person. Types a staff number the employer's system does not recognise and is refused. Then enrols with her work email, which sends a code to an address on the employer's domain. Both captured |

---

## Wave 3 · month 3 · scale, strain and the edge cases

Five new people, one new organisation, and four events. **Nothing here is decoration.** Each
is a case this product claims to handle and has never been made to.

| # | Who or what | Exists to prove |
|---|---|---|
| `E2` | Alexandria Textiles, **10% coverage** | **The partial pot, and the arithmetic on the slider.** At 10% of a $20 session they pay $2, so a **$100** welcome credit covers about **50 sessions**, and the screen must say so before they press Save |
| `E2-HR` | Mariam Example, sponsor admin | Sets coverage: **must press Edit first**, then move the slider, read the session estimate, then Save. Gets the notice period and cannot shorten it |
| `P5` | Nadia Example | Covered at 10%, pays the rest herself, **and is then hired away by `E3`.** Her old funding stops, her new funding starts, her record does not move, and neither employer learns the other exists. If one line of this is wrong it is the worst defect the run can find |
| `E3` | Delta Logistics | Hires `P5` away from `E2` |
| `E3-HR` | Rania Example | Funds a pot by transfer in wave 5, so the queue carries more than one kind of row |
| `P6` | Ziad Example, Cairo | **Never creates an account.** Sees a therapist three times through join links and remains a stranger to us. Pays by transfer each time **as the session itself**, which is the payer kind the rail exists for. Proves the product works for somebody who refuses it, and is **the thin record** the exam measures `P3` against |
| `D1` | Tamer Example, developer at Helio Health | Partner. Keys, scopes, a rate limit. Opens sessions through the API and gets notes back. Never sees a patient it did not bring. **A sixth principal**: his own table, his own cookie, his own sign-in at `/partner/sign-in`, and no shape that any clinical query would accept |

And the events:

| What | Exists to prove |
|---|---|
| `T1` requests her payout | The Egyptian manual rail end to end: request, operator approval, stamp, and a therapist who can watch every step |
| `P1` revokes `T3`'s access | It stops that second, and the notes he already wrote stay his |
| `P2` asks for her history | A previous therapist is asked, he answers, and she hears back either way |
| `E1`'s re check runs | Somebody does not answer. Their funding pauses and nothing else about them changes |

---

## Wave 4 · month 4 · the month the bills come and the month things break

**The most valuable wave in the run, and the one nothing has ever exercised.** The offer ends,
the first full price invoice goes out, and four things go wrong on purpose. A simulation in
which nothing breaks proves only that the happy path is happy.

### The money stops being free

| # | What | Must be true |
|---|---|---|
| `M1` | **Wave 1's therapists are billed at FULL PRICE** | An invoice with **no discount line**. The single most important frame in the run: everything the plan says about month 7 rests on what these people do when they see it |
| `M2` | **One of them does not pay** | `T3` lets the month lapse. Nothing demotes him: the obligation is never settled, `lapseOverdue` marks it lapsed, and `entitledTier` puts him back on metered by itself. His next session bills at $4 and he can see why |
| `M3` | **`T2` subscribes by transfer and IS on the plan** | He presses Subscribe. There is no checkout. A bill is raised, the card asks for it in pounds, he sends it, **and he is still metered until an operator confirms.** That gap is the design, not a delay |
| `M4` | **A therapist checks the promise** | `T1` compares one month of session earnings against her **$80** bill. **Net, not gross.** Fifteen sessions at $20 earns $300, we take $45, so her screen shows **$255** and she pays $80. An agent comparing against $300 will report a defect that is not one |
| `M5` | **A new therapist gets one free month and then full price** | `T5` Dr Hala Demo joins this month. After the beta the offer is one free month, then the full **$80**. No half price, no schedule, no exception, and **nothing at all after that** |

### The four bugs, injected deliberately

Not defects to find. **States a real month produces**, which nothing has ever put this product
into. Each is walked by an agent through the screens.

| # | What happens | What must hold |
|---|---|---|
| `B1` | **An employee is removed from a company** while they have a session booked next week | Funding stops for anything not yet booked, the booked session keeps the coverage it was booked under, and the patient is told which |
| `B2` | **One person works for two customer companies** | `P5` is on `E2` and `E3` at once for a week. Exactly one pot pays for each session, the rule that picks which is the same rule twice, and **neither employer learns the other exists** |
| `B3` | **A company tops up and the transfer never arrives** | `E1-HR` declares a transfer with a reference nobody can find. An operator rejects it **with a reason in their own words.** HR reads that reason verbatim, not a code, and sends a real one. The pot moves only on the second |
| `B4` | **A pot runs to nothing mid month** | `E1`'s pot empties. Coverage stops. HR is alerted **and so is the patient**, whose screen says **"Account on hold, ask HR to activate"** rather than a payment error. HR tops up, and the next booking works |

### And two seats that move

| # | Who | Exists to prove |
|---|---|---|
| `S1` | Dr Tarek Demo leaves `C1` | He lands on **metered by himself**: his new practice has no subscription and the default for no subscription is metered. His patients follow him, his notes stay with the practice, and the clinic's next bill is lower by exactly one seat |
| `S2` | `T5` upgrades mid month | A practice of one becomes a practice of three on the 15th. The screen quotes the difference **for the days remaining, before she agrees**, and then that exact figure is billed. A quote that is not what happens is not a quote |

### And the one a practice manager must fail at

`C1-M` Hana Example tries to suspend `C1-A`. **There is no such control, anywhere.** A practice
manager can end the working relationship and cannot reach into an account that is not theirs.
The absence is the feature, and the screenshot of the screen without that button is the
evidence.

---

## Wave 5 · month 5 · churn, and growth that has to be paid for

Two new people, and the month the plan is actually tested.

| # | Who or what | Exists to prove |
|---|---|---|
| `T6` | Dr Sameh Demo | Joins on the post beta offer: **one free month, then $80.** The second therapist to see that sequence, so it reads as a rule rather than an accident |
| `P7` | Yousra Demo | **The metered therapist's patient.** `T6` never subscribes at all: $4 a session on a $20 session is why $80 is exactly 20 sessions. A therapist below 20 a month is right to stay metered, and **the product must not push them** |
| `churn` | **`T2` leaves at full price** | He subscribed by transfer in wave 4 and cancels in wave 5 rather than keep paying $80. He is the only wave 1 therapist who can: `T1` is on a practice seat, `T3` lapsed in wave 4 and `T4` is the rejection case. **The number the whole plan turns on**, and the run produces exactly one observation of it. One observation is not a rate, and `08-THE-NUMBERS.md` says so. It is still worth more than the guess it replaces |
| `E3` tops up | Delta Logistics funds its pot by transfer | The second company on the rail |

---

## Wave 6 · month 6 · the close

No new people. This wave reads what the other five produced.

| # | What | Who |
|---|---|---|
| `X1` | The full money cycle, closed and read off the operator's own screens | the money agent |
| `X2` | The copilot exam, and the cross month recall questions | you |
| `X3` | The cost model fitted from real rows, at 3, 8 and 50 minutes | you |
| `X4` | **The CFO's second pass**, with six months of rows rather than three | `02-THE-SWARM.md` |
| `X5` | **The strategist's sixth note**, and the one that matters: what six months say about the next six | `02-THE-SWARM.md` |
| `X6` | **The Total View watcher's one page**: what a founder could see through one screen for six months, and what they could not | `02-THE-SWARM.md` |

---

## How often each patient comes, which is the whole cost model

**Sixty two sessions across six months, and they are not spread evenly.** An even spread would
buy a tidy database that answers nothing: the claim being tested is that a thick record makes a
better copilot, and that cannot be tested on a cast where everybody has five sessions.

So the cadence is **designed**, and it is the first thing the orchestrator drives towards.

### Months 0 to 3

| Who | Comes | Sessions | Minutes each | Journals | Docs | Therapists | Why this cadence |
|---|---|---|---|---|---|---|---|
| `P3` Mostafa | **every week** | **11** | **8** | **14** | 2 | 2 | Covered at 100%, so nothing stops him. The deep end of the ladder |
| `P1` Layla | every two weeks | **6** | 3 | **8** | 1 | 1 | Self pay, entirely in Arabic, so the exam covers both languages at depth |
| `P5` Nadia | every two weeks | **5** | 3 | 3 | 0 | 2 | Covered at 10%, pays the rest, changes employer half way |
| `P2` Salma | every month | **3** | 3 | 2 | 1 | 2 | Self pay by transfer. An ordinary appointment, kept ordinarily |
| `P4` Hoda | every month | **3** | 3 | 1 | 0 | 2 | Enrolled after one refusal. Her second therapist is `T4`, once approved |
| `P6` Ziad | monthly, from month 3 | **1** | 3 | **0** | **0** | 1 | **The thin end.** No account, so no journal and no documents. His copilot has transcripts and nothing else. He ARRIVES in wave 3, so only one of his three sessions falls inside months 0 to 3: see `10-THE-STORY.md` |
| Radar strangers | once each | 2 | 3 | 0 | 0 | 1 | `T3`'s crisis arrivals. Nobody comes back |
| `D1` via the API | n/a | 2 | 3 | 0 | 0 | 1 | A partner opens sessions and gets notes back |
| | | **33** | **154 min** | **28** | **4** | | |

### Months 4 to 6

| Who | Comes | Sessions | Minutes each | Journals | Why |
|---|---|---|---|---|---|
| `P3` Mostafa | every week | **9** | **8** | 8 | The deep record keeps getting deeper, which is what the exam measures |
| `P1` Layla | every two weeks | **5** | 3 | 5 | Arabic, at depth, across the price change |
| `P5` Nadia | every two weeks | **4** | 3 | 2 | Two employers for one week of it (`B2`) |
| `P7` Yousra | every month | **3** | 3 | 1 | The metered therapist's patient |
| `P2` Salma | every month | **2** | 3 | 1 | Ordinary, and paying by transfer |
| `P4` Hoda | every month | **2** | 3 | 1 | |
| `P6` Ziad | monthly | **2** | 3 | 0 | The other two of his three, in months 4 and 5. No account either time |
| Radar strangers | once each | **2** | 3 | 0 | `T3`'s crisis arrivals keep arriving after he drops to metered |
| | | **29** | **132 min** | **18** | |

### The totals the budget was built on

| | Sessions | Minutes | Journals |
|---|---|---|---|
| Months 0 to 3 | 33 | 154 | 28 |
| Months 4 to 6 | 29 | 132 | 18 |
| **Six months** | **62** | **286** | **46** |

⚠️ **The split moved by two sessions and the totals did not.** `P6` Ziad arrives in wave 3, so
he cannot have had three monthly sessions inside months 0 to 3; two of his three fall after the
free month ends. The old table said 35 and 27, which added to 62 by having him come before he
existed. Sixty two sessions, 286 minutes and the $1.98 model bill are all unchanged, and
`10-THE-STORY.md` is where his three sessions are now dated.

**20 of the 62 run 8 minutes and 42 run 3.** At the measured rate that is
`62 x $0.01317 + 286 x $0.00407 = $1.98`.

### The ladder has to be driven, or the exam measures nothing

`P3` at 20 sessions against `P6` at 3 is a depth score of roughly 137 against 15, on the
weighting `scripts/copilot-exam.ts` actually uses. If the run
ends with everybody on four sessions because each agent did its task once and reported
success, `07-THE-EXAM.md` will correlate nothing and the most interesting question in the
simulation goes unanswered.

**So the orchestrator reports the ladder at the end of every wave**, and a wave that ends with
`P3` level with `P6` is a wave that is not finished.

### If the spend runs ahead, cut in this order

1. **The radar strangers and the partner sessions.** Four sessions. They prove a path each and
   neither is on the ladder.
2. **`P2` and `P4` down to two sessions each IN TOTAL**, from five. The exam only needs them
   as middle ground.
3. **Never `P3`, and never shorten his sessions.** His twenty sessions, every one of them 8
   minutes, are two things at once: the top of the exam's ladder, and the **whole long cluster
   the cost model is fitted from.** Cutting him to save a dollar throws away the most
   interesting question in the run and makes the cost model underivable. If the budget is
   genuinely tight, cut short sessions, never long ones.

---

## One thing the seed sets that is easy to miss

`country_settings` for Egypt still leaves the crisis line null, and that is correct: a
configured line is an operator's entry with their name and the date on it.

But the product no longer falls back to silence. `lib/crisis/line.ts` holds Egypt's verified
line, **105, press 1 for Arabic then 1 for mental health**, given directly by the product's
owner on 2026-09-14 and the first entry that table has ever had for the first market.

**So the SOS orb is now a real thing to photograph in Cairo**, and `P1` Layla is the person to
photograph it as: she reads only Arabic and the menu instruction is the half of that button
that decides whether it works.
