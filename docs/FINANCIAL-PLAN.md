# The plan: $20,000, Egypt, and what happens next

**Run it yourself:**

```
npm run plan                  three scenarios, summarised
npm run plan -- beta-cliff    the six months, month by month, every line
```

Or open `/admin/financial-model` and move the sliders.

---

## Part 1 · What a financial model actually is

A financial model is one sentence repeated as many times as there are months:

> **cash at the end of the month = cash at the start + what came in − what went out**

Everything else is detail about those two middle terms. There is no hidden
technique. What makes a model useful or useless is entirely **which numbers you
put in and whether you are honest about where each one came from.**

### The four numbers that decide everything

**1. How many customers you get, and when.** Called *acquisition*. Yours is not a
forecast, it is a target: **7 companies, 9 clinics and 14 therapists in three
months**, because that is what three salespeople are being paid to do.

**2. How many leave, and when.** Called *churn*. This is the one that kills
companies quietly. You give a free month, everyone signs up, the number looks
wonderful, and then month four arrives and they see a real invoice. **The month
the discount ends is the only month that tells you anything.**

**3. What each one pays you.** Called *ARPU*, average revenue per user. Yours has
three parts: a subscription, our cut of each session, and the metered fees.

**4. What it costs to serve them and to run the company.** Split into:

- **Cost of goods sold** are costs that exist *because* a session happened: the
  AI, the video, the card fee. Revenue minus that is **gross profit**.
- **Operating expenses** are costs that exist whether or not anybody uses the
  product: salaries, marketing, hosting, accounting.

Gross profit minus operating expenses is **net profit**. When it turns positive
you have **broken even**. Until it does you are **burning** cash, and how many
months of burn your bank balance covers is your **runway**.

### The two numbers investors will ask for

**Burn rate**, how much cash you lose per month. Yours starts at **$6,647** and
falls every month until it turns positive in month 5, which is the right shape.

**CAC**, customer acquisition cost: sales salaries plus marketing, divided by
customers won. Yours is **$200 per account** over the six months and **$188** over
eighteen. Compare it to **lifetime value**: what a customer pays before they
leave. A clinic at $144 a month that stays two years is $3,456 of subscription
plus far more in our cut of their sessions. **Above 3:1 is the usual bar.** Yours
clears it comfortably, on assumed churn.

---

## Part 2 · The plan, and every assumption in it

Every number below is one of three things, and confusing them is the expensive
mistake:

| Label | Means | Can it be wrong? |
|---|---|---|
| **MEASURED** | Somebody measured it | No. It is a fact about a real system |
| **DECIDED** | You chose it | No. It is true if you make it true |
| **GUESS** | Nobody knows yet | **Yes, and probably is.** This is what the beta replaces |

There are exactly **two measured numbers** in this whole model: the two terms of
the AI cost. Everything else is a decision or a guess, and the current split is
**2 measured, 20 decided, 12 guessed.**

The split is data, not prose. `PROVENANCE` in `lib/finance/plans.ts` lists every
input with its label and **a sentence saying what it rests on**,
`npm run verify:plan` counts them and fails if any label carries no reason, and
the admin screen prints the split above the tables.

### Currency

| | | Label |
|---|---|---|
| Exchange rate | 50 EGP = $1 | **GUESS.** It has run 47 to 52 through 2025. Every revenue line moves with it. It is an operator setting on `/admin/settings`, edited daily |

### What one session is worth

| | EGP | USD | Label |
|---|---|---|---|
| Patient pays the therapist | **1,000** | **$20** | **DECIDED**, the founders' benchmark. ⚠️ Top of the Cairo range, not the middle |
| Our cut, on paid sessions only | 150 (15%) | **$3.00** | **DECIDED** |
| The room, on **every** session | 50 | **$1.00** | **DECIDED.** Paid, free, radar, invite, in person |
| The note, where the patient consented | 150 | **$3.00** | **DECIDED** |
| Patients who consent to recording | | 70% | **GUESS.** The beta counts this exactly |

🔴 **The session price is the most load-bearing number in this document.** Part 5
has the sensitivity.

🔴 **The two charges are separate, and that is the settlement of sprint 75.** The
cut is on what the patient paid. The room and note fees are on the session
existing at all. A metered therapist pays **$4 a session**, or $1 where consent
was declined. **A subscriber pays neither**, and we still take the 15%.

### What each kind of customer pays

| | EGP/month | USD/month | Label |
|---|---|---|---|
| Solo therapist, unlimited | 4,000 | **$80** | **DECIDED.** Exactly 20 metered sessions |
| Solo therapist, metered | 200/session | **$4** | **DECIDED.** $1 room plus $3 note |
| Clinic seat, minimum two | 3,600 | **$72** | **DECIDED.** Ten per cent under solo |
| Company or university | 0 | $0 | **DECIDED.** They fund a pot; we take our cut of the sessions |

### What each kind of customer does

| | Clinicians | Patients each | Sessions each | Sessions/month | Ramp |
|---|---|---|---|---|---|
| Company (1,000 staff) | 1 | 20 | 1.5 | **30** | 3 months |
| Clinic | **2.5** | 10 | 2.5 | **62** | 3 months |
| Solo therapist | 1 | 8 | 2.5 | **20** | 2 months |

All **GUESS**. The company row is the shakiest: it assumes **5% of a 1,000-person
call centre enrols** and **40% of those have a session in a given month**.
Corporate mental-health benefits worldwide report single-digit first-year take-up,
and this is a market where therapy still carries stigma.

🔴 **A clinic is two or three clinicians, never four or five.** A small Cairo
practice is two people who share a waiting room, sometimes three. Four is a
different kind of business with a manager and a lease, and modelling it inflates
both seat revenue and sessions per account. `verify:plan` holds the average
between 2 and 3.

🔴 **The ramp matters more than it looks.** A clinic that signs in month 3 is not
seeing sixty sessions in month 3. Without a ramp the model hands a month-three
signature a month-three caseload, which flatters exactly the months a beta is
judged on. Volume climbs to full over two or three months.

### The pitch a therapist can check themselves

| | |
|---|---|
| Unlimited, solo | **$80 a month** |
| Unlimited, clinic | **$72 a seat**, minimum two |
| Metered | **$4 a session**: $1 for the room, $3 for the note |
| The break-even between them | **exactly 20 sessions** |

Below twenty sessions a month, metered is cheaper and they should use it. Above
it, unlimited is, and the note writing comes free. **Nobody has to be talked into
a number they can work out on their own.**

### 🔴 Why $80, and not $100 or $60

It was $100 until sprint 75, and $100 put the break-even at 25 sessions while
**this same plan forecasts a typical therapist doing 20.** We were modelling
subscription revenue from people for whom the subscription was the worse deal, and
who would have been right to refuse it.

The floor is set from the other end. A 50-minute session costs us about **$0.62**:
the measured model time plus video. A flat plan stops paying for itself past
`price / 0.62` sessions.

| Plan | Worth buying above | We lose money past |
|---|---|---|
| $100 | 25 sessions | 162 |
| **$80** | **20 sessions** | **130** |
| $60 | 15 sessions | **97** |

A therapist doing six sessions a day, five days a week, reaches about **120 a
month**, and that is a heavy full-time load. So 97 is inside what one person can
actually do and **$60 would lose money on exactly our best customers.** 130 is
not. `verify:plan` asserts both ends, so the next price change has to survive the
same argument.

🔴 **And the promise underneath is arithmetic, not marketing, stated NET.** At a
$20 session, **15 sessions earns $300, we take $45, they pay $80, and they keep
$175.** Their earnings screen shows $255, not $300, because the 15% has already
come out. Quoting the gross number is how a promise gets quoted back at us. A
therapist who works at all pays for this out of what they earned through it, which
`payouts.netFeeFromHeldEarnings` already implements rather than something we would
have to build.

The one case where a session bills with no platform earnings behind it is an
**in-person session the patient already paid for at the clinic**. The therapist
still got their money; our bill is for the note, the risk pass, the copilot and
the patient history that was ready before they walked in.

### The offer

| Month of *their* life | They pay | Label |
|---|---|---|
| 1 | Free | **DECIDED** |
| 2 | 50% | **DECIDED** |
| 3 | 50% | **DECIDED** |
| 4 onward | Full price | **DECIDED** |

**Anyone joining after month 3 gets one free month and then full price.** No
half-price months. The beta's job was to buy evidence, and evidence bought once
does not need buying again.

🔴 **And nothing happens after that.** There is no grandfathering, no permanent
discount and no second offer for the people who took the first one. Two scenarios
used to model that choice and both are deleted: a plan that carried the comparison
would be offering a decision nobody is going to make, and the first person to read
it would assume the decision was still open.

Plus: a company or university gets **$100 of welcome credit** in its pot.

🔴 **This is read off each customer's own age, not the calendar.** A therapist who
joins in month 3 is free in month 3 and half price in months 4 and 5. Their cliff
arrives in month 6, not month 4. This is why a spreadsheet gets it wrong and why
the model is cohort-based.

🔴 **The $100 credit is real cash leaving, not a discount.** A discount is revenue
you choose not to bill. A pot credit is money a therapist actually withdraws. Our
fee comes straight back, so the true cost is 85% of $100, about **$85 per
company.**

🔴 **And $100 is an argument, not a round number.** At 10% coverage a company pays
$2 of a $20 session, so $100 is about **fifty sponsored sessions.** At 100% it is
five. It was $200 and was halved deliberately: **the number that matters is how
many companies try us, not how long the first one lasts.**

### Churn, and the surprising thing the model says about it

| | While discounted | **The month full price hits** | Steady after |
|---|---|---|---|
| Company | 0% | **33%** | 3% |
| Clinic | 2% | **25%** | 4% |
| Solo therapist | 3% | **40%** | 6% |

All **GUESS**, and the middle column is the number everyone expects to be decisive.

🔴 **In the six-month window it is very nearly not decisive at all**, and the
reason is worth understanding rather than hiding:

| Case | vs the plan | Break even | Cash at month 6 |
|---|---|---|---|
| Good, roughly a third as many leave | ×0.3 | month 5 | $7,279 |
| **Medium, the reported case** | **×1** | **month 5** | **$7,526** |
| Bad, 40% more leave | ×1.4 | month 5 | $7,668 |

**A therapist who cancels at the cliff does not disappear. They land on metered**,
by themselves, because the default for no subscription is metered and nothing in
the product demotes them. They keep running sessions and we keep billing $1 a room
and $3 a note. So the cliff moves revenue between two lines rather than deleting
it.

⚠️ **Read the direction honestly: more churn is very slightly better here, and
that is a finding about the clinic price rather than good news.** A clinic seat is
$72 for a clinician the model has doing 25 sessions a month, and 25 metered
sessions bill about $77. The seat discount is real, which is correct for the
customer and means a clinic that cancels is worth marginally more to us for as
long as it keeps working. **It is a six-month artefact.** Over a longer horizon
the accounts that walk stop being accounts, and `churnSteady` removes them.

🔴 **What this does mean is that the beta's job has changed shape.** It is no
longer only "how many leave". It is **how many leave and keep working**, which is
a different question and one only month 4 can answer.

### The team

| | $/month | From | Label |
|---|---|---|---|
| Founder, product and engineering | 500 | month 1 | **DECIDED** |
| Founder, clinical and operations | 500 | month 1 | **DECIDED** |
| Sales, companies and universities | 500 | month 1 | **DECIDED** |
| Sales, clinics and therapists | 500 | month 1 | **DECIDED** |
| **Founder, selling full time** | **0** | month 1 | **DECIDED.** Already on the payroll above |
| Marketing | 500 | month 1 | **DECIDED** |
| Support, the transfer queue | 500 | month 1 | **DECIDED** |
| Support, the transfer queue | 500 | month 1 | **DECIDED** |
| **Total payroll** | **$3,500** | | |

🔴 **The third seller is the decision this whole plan turns on.** One of the two
founders sells full time from month one. It costs nothing, because they already
draw their $500, and it buys fifty per cent more selling capacity from the first
month. The acquisition targets rise to match: 7 companies, 9 clinics and 14
therapists in the first quarter, which is **3.3 accounts a month for each of three
sellers.** Without it the six months end at roughly break-even with about a
thousand dollars left. With it the company is profitable in month 5 and has a
buffer.

⚠️ **It is also the assumption most likely to be wrong.** A founder selling is a
founder not building, and this model has no line for what stops being built. That
cost is real and it is not here, because nothing in a cash forecast can see it.
Read the arrival numbers as "what three sellers can do" rather than as free
growth.

🔴 **The two support staff are forced by the payment rail, not chosen.** Egypt has
no card gateway for us yet, so every payment is a bank transfer somebody checks,
and a person is on a spinner waiting to join a therapy session while that happens.
A plan that modelled the rail without modelling the people would be describing a
product nobody can operate.

🔴 **The marketer's salary is not CAC.** CAC counts who sells and what markets.
Their pay is an operating cost; the budget they spend is the acquisition cost.
`verify:plan` proves it by paying them ten times more and watching CAC not move.

No employer burden is modelled: at this size they are contractors. If you put them
on formal contracts with social insurance, add roughly 15 to 20%.

### Marketing

| | EGP | USD | When | Label |
|---|---|---|---|---|
| Three videos, produced and cast | 30,000 | $600 | month 1, one-off | **GUESS.** 10,000 EGP each is a competent 60 to 90 second explainer in Cairo |
| Ad spend, Meta and TikTok | 30,000/mo | $600/mo | every month | **DECIDED.** Part of the $1,000 |
| Three influencer therapists | 20,000/mo | $400/mo | every month | **DECIDED.** The rest of the $1,000 |

**$1,000 a month total**, held by the marketing hire, covering production, cast,
ads and sponsorships. The split is theirs to change; the total is the decision.

🔴 **The influencers' free subscription costs nothing in cash.** Neither does the
free month their referrals get. Both are *forgone revenue* and show up in the
"given away" column, not in marketing spend. That is the correct place for them:
you cannot spend money you never had.

### Everything else

| | USD | When |
|---|---|---|
| Hosting and infrastructure | $120/mo | every month |
| Tools, accounting, insurance | $150/mo | every month |
| Company formation and legal | $1,200 | month 1, one-off |

### The one measured thing

| | Value | How |
|---|---|---|
| AI, fixed per session | **$0.01317** | **MEASURED**, live OpenAI API, 2026-09-14 |
| AI, per audio minute | **$0.00407** | **MEASURED**, same run |
| A 50-minute session | **$0.2167** | Computed from those two |

Four transcript lengths, $0.37 of real spend, no database rows written.
`evals/physics.json` has every row, and `lib/finance/scenarios.ts` reads the two
terms out of it rather than retyping them.

---

## Part 3 · The numbers

### The six months, which is the scenario that matters

**Accounts and volume**

| Month | Companies | Clinics | Therapists | Clinicians | Patients | Sessions |
|---|---|---|---|---|---|---|
| 1 | 3.0 | 2.0 | 3.0 | 11 | 49 | 102 |
| 2 | 5.0 | 5.0 | 7.9 | 25 | 154 | 332 |
| 3 | 7.0 | 8.9 | 13.7 | 43 | 316 | 689 |
| 4 | 8.9 | 11.7 | 19.2 | 57 | 476 | 1,052 |
| 5 | 10.7 | 14.3 | 24.2 | 71 | 627 | 1,392 |
| **6** | **12.4** | **16.7** | **28.8** | **83** | **757** | **1,685** |

**Money in**

| Month | Subscriptions | Given away | Our cut and the room | The note | **Revenue** |
|---|---|---|---|---|---|
| 1 | $0 | $600 | $305 | $0 | **$305** |
| 2 | $293 | $1,233 | $997 | $0 | **$1,290** |
| 3 | $744 | $1,944 | $2,068 | $0 | **$2,812** |
| 4 | $1,409 | $2,053 | $3,235 | $166 | **$4,810** |
| 5 | $2,175 | $1,592 | $4,437 | $549 | **$7,161** |
| **6** | **$2,940** | $1,020 | $5,532 | $1,002 | **$9,474** |

🔴 **The note fee is zero until month 4, and that is correct.** Everybody is on a
subscription during the beta and a subscriber pays neither metered fee. It appears
the month the first cohort's cliff arrives and some of them land on metered.

**Money out**

| Month | AI | Video | Cards | Credit | People | Marketing | Other | **Total** |
|---|---|---|---|---|---|---|---|---|
| 1 | $15 | $41 | $71 | $255 | $3,500 | $1,600 | $1,470 | **$6,952** |
| 2 | $50 | $133 | $241 | $170 | $3,500 | $1,000 | $270 | **$5,365** |
| 3 | $105 | $276 | $505 | $170 | $3,500 | $1,000 | $270 | **$5,825** |
| 4 | $160 | $421 | $779 | $170 | $3,500 | $1,000 | $270 | **$6,299** |
| 5 | $211 | $557 | $1,040 | $170 | $3,500 | $1,000 | $270 | **$6,747** |
| 6 | $256 | $674 | $1,268 | $170 | $3,500 | $1,000 | $270 | **$7,137** |

**What is left**

| Month | Revenue | Gross margin | Net | **Cash** |
|---|---|---|---|---|
| 1 | $305 | −25% | −$6,647 | **$13,353** |
| 2 | $1,290 | 54% | −$4,075 | **$9,278** |
| 3 | $2,812 | 62% | −$3,013 | **$6,265** |
| 4 | $4,810 | 68% | −$1,489 | **$4,776** |
| 5 | $7,161 | 72% | **+$414** | **$5,189** |
| **6** | **$9,474** | **75%** | **+$2,337** | **$7,526** |

🔴 **Break even is month 5, and the cash never goes negative.** Six months of
revenue $25,852, six months of spend $38,325, ending with **$7,526** of the
$20,000. The month-6 run rate is **$9,474**, which is **$113,688 of ARR** at a 75%
gross margin.

⚠️ **$7,526 is a buffer, not a cushion.** About six weeks of payroll.

### Can the $20k alone do it, with no round ever?

**Yes.** Break even in month 5, and by month 18:

| | |
|---|---|
| Revenue | **$24,816 a month** |
| Cash in the bank | **$119,292** |
| Accounts | 29 companies, 39 clinics, 66 therapists, 193 clinicians |
| Sessions | 4,342 a month |
| Blended CAC | $188 an account |

**This is the scenario to show an angel.** It says what *their* money buys, not
what a later round might.

---

## Part 4 · Answers to what you asked

**"How much do we burn to get the first accounts?"**
Sales and marketing over the six months is $6,600 of marketing plus two paid
sellers, winning the accounts above at a **blended CAC of $200.** The third seller
is free, which is exactly why the blended figure fell from $220 in the three-month
scenario to $200 in the six.

**"What does the $20k buy?"**
Not three months. **Break even in month 5**, and then eighteen months of
compounding with no round at all. The three-month framing understates your own
runway badly.

**"What do we have to show an angel at month 6?"**
$9,474 a month of revenue, 75% gross margin and rising, positive net for two
months running, $7,526 still in the bank, 58 accounts of which 45 pay us a
subscription, and, the part nobody else has, **a measured unit cost.**

**"What growth rate should we expect?"**
Do not think in percentages at this size; think in **accounts per salesperson per
month.** This plan assumes each of three sellers lands about 3.3 accounts a month
and holds it. In percentage terms that is 40 to 80% month on month early, easy
from a small base, and about 6% by month 18. **Anyone quoting a "SaaS growth rate"
at twenty customers is selling something.**

---

## Part 5 · Three things the model found that are worth acting on

### 1. Everything hangs on the session price, and it is a benchmark not a measurement

| Session price | Break even | Cash at month 6 |
|---|---|---|
| 500 EGP ($10) | month 6 | **$1,224** |
| 750 EGP ($15) | month 6 | $4,375 |
| **1,000 EGP ($20)** | **month 5** | **$7,526** |
| 1,250 EGP ($25) | month 5 | $10,678 |

Halving the session price costs six months of buffer and leaves the company with
five days of payroll at the end. **It is the first thing the beta should measure,
and the answer is a query over what therapists actually charged, not a number
anybody chose.**

### 2. Video costs more than the AI. Much more

| At month 18 | Per month |
|---|---|
| OpenAI | $659 |
| **Daily video** | **$1,737** |
| Card and wallet processing | $3,273 |

You are building an AI company whose largest controllable variable cost is a video
vendor, and whose largest cost of any kind is payment processing. Both are worth
pricing alternatives for, and the second is a reason the Egyptian transfer rail may
stay worth operating even after a gateway arrives.

### 3. The cliff is not a cliff, it is a slide onto metered

The single most valuable correction this model has had. Modelling the price cliff
as people *leaving* made the plan pessimistic by roughly the size of the number the
beta exists to measure. **They do not leave. They stop subscribing and keep
working**, and the product bills them $4 a session by itself.

So the question for month 4 is not "how many cancelled" but **"how many cancelled
and kept working"**, and only a real month 4 answers it.

---

## Part 6 · What the product does not do yet

| | Built? |
|---|---|
| Sponsor joining code and QR poster | ✅ Yes, server-rendered QR at `/sponsor/code` |
| Print the poster | ⚠️ Browser print only. **No PDF export** |
| Upload the company's logo onto it | ❌ **Not built** |
| Patient invites their therapist | ✅ Yes, invite codes |
| Invite a therapist by email or phone | ⚠️ Partial. Check before you sell it |
| Automatic "free month then 50%" billing | ❌ **Not built.** Discounts are applied by hand today |
| Card payments in Egypt | ❌ **No gateway.** Bank transfer, and an operator confirming each one |

That second-to-last one matters commercially: **the offer this entire plan is
built on has to be operated manually right now.** At thirty accounts that is fine.
At a hundred it is not, and it is the first thing to build after the beta.

---

## Part 7 · What the simulation does with this

`docs/simulation/00-START-HERE.md` starts the run, and
`docs/simulation/07-THE-RECORD.md` says what it reports.

The six-month simulation rehearses **this plan**, not a generic one: the same offer,
the same pot credit, the same prices, the same cadence. What it produces is the
measured half. The AI cost fitted from real rows, the consent rate counted,
sessions per patient counted, and those replace the guesses above.

**What it can never tell you** is whether a real Egyptian therapist pays 4,000 EGP
in month 4. Twenty-one invented people cannot answer that, and the run is required
to say "not measurable in a simulation" rather than reporting a number.
`verify:plan` asserts that the churn inputs are never labelled measured.

The five things `npm run plan` prints as unknowable, every time it runs:

- whether an Egyptian therapist will pay 4,000 EGP a month at all
- how many leave the month the discount ends. **Assumed 40%** of solo therapists
- what share of a call centre's staff enrol. **Assumed 5%**, then 40% of those
  active monthly
- what card and wallet processing actually costs in Egypt. **Assumed 3%**
- whether a company renews once the welcome credit runs out. **Assumed two in
  three**
