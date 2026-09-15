# The plan: $20,000, Egypt, and what happens next

**Run it yourself:**

```
npm run plan                  every scenario, summarised
npm run plan -- runway        one of them, month by month, every line
```

Or open `/admin/financial-model` and move the sliders.

---

## Part 1 · What a financial model actually is

A financial model is one sentence repeated thirty-six times:

> **cash at the end of the month = cash at the start + what came in − what went out**

Everything else is detail about those two middle terms. There is no hidden
technique. What makes a model useful or useless is entirely **which numbers you
put in and whether you are honest about where each one came from.**

### The four numbers that decide everything

**1. How many customers you get, and when.** Called *acquisition*. Yours is not
a forecast, it is a target: three companies, six clinics, nine therapists, in
three months, because that is what two salespeople are being paid to do.

**2. How many leave, and when.** Called *churn*. This is the one that kills
companies quietly. You give a free month, everyone signs up, the number looks
wonderful, and then month four arrives and they see a real invoice. **The month
the discount ends is the only month that tells you anything.**

**3. What each one pays you.** Called *ARPU*, average revenue per user. Yours has
three parts: a subscription, a cut of each session, and the AI fee.

**4. What it costs to serve them and to run the company.** Split into:
- **Cost of goods sold (COGS)** — costs that exist *because* a session happened:
  the AI, the video, the card fee. Revenue minus COGS is **gross profit**.
- **Operating expenses (opex)** — costs that exist whether or not anybody uses
  the product: salaries, marketing, hosting, accounting.

Gross profit minus opex is **net profit**. When it turns positive you have
**broken even**. Until it does you are **burning** cash, and how many months of
burn your bank balance covers is your **runway**.

### The two numbers investors will ask for

**Burn rate** — how much cash you lose per month. Yours starts at $4,748 and
falls every month, which is the right direction.

**CAC** — customer acquisition cost. Sales salaries plus marketing, divided by
customers won. Yours is **$239 per account** over eighteen months. Compare it to
**LTV** (lifetime value): what a customer pays you before they leave. A clinic at
$60/month that stays 25 months is $1,500 of subscription plus far more in session
fees. **LTV:CAC above 3:1 is the usual bar.** Yours clears it comfortably, on
assumed churn.

---

## Part 2 · Your plan, and every assumption in it

Every number below is one of three things, and confusing them is the expensive
mistake:

| Label | Means | Can it be wrong? |
|---|---|---|
| **MEASURED** | Somebody measured it | No. It is a fact about a real system |
| **DECIDED** | You chose it | No. It is true if you make it true |
| **GUESS** | Nobody knows yet | **Yes, and probably is.** This is what the beta replaces |

There are exactly **two measured numbers** in this whole model. Everything else
is a decision or a guess. The split is data, not prose: `PROVENANCE` in
`lib/finance/plans.ts` lists every input with its label and a sentence on what it
rests on, `npm run verify:plan` counts them, and the admin screen prints the
split above the tables.

### Currency

| | | Label |
|---|---|---|
| Exchange rate | 50 EGP = $1 | **GUESS.** It has run 47–52 through 2025. Every revenue line moves with it |

### What one session is worth

| | EGP | USD | Label |
|---|---|---|---|
| Patient pays the therapist | **1,000** | **$20** | **DECIDED**, the founders' benchmark. ⚠️ Top of the Cairo range, not the middle |
| Our cut | 150 (15%) | $3.00 | **DECIDED** |
| Flat platform fee | 0 | $0 | **DECIDED**, changed from the shipped $1 |
| AI fee, if the patient consents | 50 | $1.00 | **DECIDED**, changed from the shipped $3 |

🔴 **The session price is the most load-bearing number in this document.** At 500 EGP the plan runs out of cash; at 1,000 it breaks even in month 7. See Part 5.
| Patients who consent to recording | — | 70% | **GUESS.** The beta counts this exactly |

🔴 **The pricing was settled in sprint 75, and the product and this plan now
agree.** They did not before: the product shipped $99 and $179 monthly plans
against a plan modelling $100 and $60, and the plan had dropped the $1 session fee
to zero and the AI fee to $1 while the product charged $1 and $3. The product was
right about the two metered fees and the plan was right that $99 and $179 were US
numbers nobody had re-pointed at Egypt.

What is settled: **15% of what the patient paid, on paid sessions only**, plus
**$1 for the room and $3 for the note on every session a metered account runs** —
paid or free, online or in person. A subscriber pays neither. Solo is $80 and a
clinic seat is $72. The numbers
made for you.

### What each kind of customer pays

| | EGP/month | USD/month | Label |
|---|---|---|---|
| Solo therapist, unlimited | 5,000 | **$100** | **DECIDED.** The shipped tier. Exactly 25 pay-as-you-go sessions |
| Solo therapist, pay as you go | 200/session | **$4** | **DECIDED.** 20% of a $20 session |
| Clinic, up to 5 clinicians | 3,000 | $60 | **GUESS.** 600 EGP a clinician |
| Company or university | 0 | $0 | **DECIDED.** They fund a pot; we take our cut of sessions |

### What each kind of customer *does*

| | Clinicians | Patients each | Sessions each | Sessions/month | Ramp |
|---|---|---|---|---|---|
| Company (1,000 staff) | 1 | 20 | 1.5 | **30** | 3 months |
| Clinic | 4 | 10 | 2.5 | **100** | 3 months |
| Solo therapist | 1 | 8 | 2.5 | **20** | 2 months |

All **GUESS**. The company row is the shakiest: it assumes **5% of a 1,000-person
call centre enrols** and **40% of those have a session in a given month**.
Corporate mental-health benefits worldwide report single-digit first-year
take-up, and this is a market where therapy still carries stigma.

🔴 **The ramp matters more than it looks.** A clinic that signs in month 3 is not
seeing a hundred sessions in month 3. Without a ramp the model hands a
month-three signature a month-three caseload, which flatters exactly the months a
beta is judged on. Volume climbs to full over 2–3 months.

### The pitch a therapist can check themselves

| | |
|---|---|
| Unlimited, solo | **$80 a month** |
| Unlimited, clinic | **$72 a seat**, minimum two |
| Pay as you go | **$4 a session**: $1 for the room, $3 for the note |
| The break-even between them | **exactly 20 sessions** |

Below 20 sessions a month, pay as you go is cheaper and they should use it. Above
it, unlimited is, and the note writing comes free. Nobody has to be talked into a
number they can work out on their own.

### 🔴 Why $80 and not $100, and why not $60

⚠️ It was $100 until sprint 75, and $100 put the break-even at 25 sessions while
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
actually do and $60 would lose money on exactly our best customers. 130 is not.
`verify:plan` asserts both ends of that, so the next price change has to survive
the same argument.

🔴 **And the promise underneath is arithmetic, not marketing, stated NET.** At a
$20 session, **15 sessions earns $300, we take $45, they pay $80, and they keep
$175.** Their earnings screen shows $255, not $300, because the 15% has already
come out; quoting the gross number is how a promise gets quoted back at us. A
therapist who works at all pays for this out of what they earned through it, which
`payouts.netFeeFromHeldEarnings` already implements rather than something we would
have to build.

The one case where a session bills with no platform earnings is an **in-person
session the patient already paid for at the clinic**. The therapist still got
their money; our bill is for the note, the risk pass, the copilot and the patient
history that was ready before they walked in.

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

Plus: companies get **$200 of welcome credit** in their pot.

🔴 **This is read off each customer's own age, not the calendar.** A therapist who
joins in month 3 is free in month 3 and half price in months 4 and 5. Their cliff
arrives in month 6, not month 4. This is why a spreadsheet gets this wrong and
why the model is cohort-based.

🔴 **The $200 credit is real cash leaving, not a discount.** A discount is revenue
you choose not to bill. A pot credit is money a therapist actually withdraws. Our
fee comes straight back, so the true cost is 85% of $200 = **$170 per company**,
spent over the ~3 weeks their staff burn through it.

### Churn — the guesses that matter most

| | While discounted | **The month full price hits** | Steady after |
|---|---|---|---|
| Company | 0% | **33%** | 3% |
| Clinic | 2% | **25%** | 4% |
| Solo therapist | 3% | **40%** | 6% |

All **GUESS**, and the middle column is the single most important number in this
document. It is now a named variable with three cases, and **medium is the one
reported**:

| Case | vs the plan | Break even | Lowest cash |
|---|---|---|---|
| Good, roughly 1 in 10 leaves | ×0.3 | month 6 | +$2,800 |
| **Medium, the reported case** | **×1** | **month 8** | **+$669** |
| Bad, half leave | ×1.4 | month 10 | **−$2,025** |

🔴 **Only the medium case is shipped as a plan.** Every deck ever assembled from a
model with an optimistic toggle has used the optimistic toggle. Free-trial conversion for unproven small-business software is commonly
worse than these. **The entire purpose of your beta is to replace this column
with counted facts.**

### The team

| | $/month | From | Label |
|---|---|---|---|
| You | 500 | month 1 | **DECIDED** |
| Co-founder | 500 | month 1 | **DECIDED** |
| Sales — companies and universities | 500 | month 1 | **DECIDED** |
| Sales — clinics and therapists | 500 | month 1 | **DECIDED** |
| Marketing | 500 | month 1 | **DECIDED** |
| Support, the transfer queue | 500 | month 1 | **DECIDED** |
| Support, the transfer queue | 500 | month 1 | **DECIDED** |
| **Total payroll** | **$3,500** | | |

🔴 **The two support staff are forced by the payment rail, not chosen.** Egypt has no card gateway for us yet, so every payment is a bank transfer somebody checks. A person is on a spinner waiting to join a therapy session while that happens. A plan that modelled the rail without modelling the people would be describing a product nobody can operate. The founders work the same queue alongside them, and cover sales and marketing too — that is why there are seven people and not eleven.

🔴 **The marketer's salary is not CAC.** CAC counts who sells and what markets. Their pay is an operating cost; the budget they spend is the acquisition cost. `verify:plan` proves it by paying them ten times more and watching CAC not move.

No employer burden modelled — at this size they are contractors. If you put them
on formal contracts with social insurance, add roughly 15–20%.

### Marketing

| | EGP | USD | When | Label |
|---|---|---|---|---|
| Three videos, produced and cast | 30,000 | $600 | month 1, one-off | **GUESS.** 10,000 EGP each is a competent 60–90s explainer in Cairo |
| Ad spend, Meta + TikTok | 30,000/mo | $600/mo | every month | **DECIDED.** Part of the $1,000 |
| Three influencer therapists | 20,000/mo | $400/mo | every month | **DECIDED.** The rest of the $1,000 |

**$1,000 a month total**, held by the marketing hire, covering production, cast, ads and sponsorships. The split is theirs to change; the total is the decision.

🔴 **The influencers' free subscription costs you nothing in cash.** Neither does
the free month you give their referrals. Both are *forgone revenue* and show up
in the "given away" column, not in marketing spend. That is the correct place for
them: you cannot spend money you never had.

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

Three runs, $0.37 of real spend, four transcript lengths, no database rows
written. `evals/physics.json` has every row.

---

## Part 3 · The numbers

### Scenario A — the beta, three months

| Month | Companies | Clinics | Therapists | Clinicians | Patients | Sessions |
|---|---|---|---|---|---|---|
| 1 | 2 | 1 | 2 | 8 | 35 | 73 |
| 2 | 3 | 3 | 5 | 20 | 114 | 251 |
| 3 | 3 | 6 | 9 | 35 | 238 | 543 |

**Money in**

| Month | Subscription | At full price | Given away | Session fees | AI fees | **Revenue** |
|---|---|---|---|---|---|---|
| 1 | $0 | $100 | $100 | $110 | $51 | **$161** |
| 2 | $49 | $278 | $229 | $376 | $176 | **$601** |
| 3 | $136 | $531 | $396 | $814 | $380 | **$1,329** |

**Money out**

| Month | AI | Video | Cards | Welcome credit | People | Marketing | Other | **Total** |
|---|---|---|---|---|---|---|---|---|
| 1 | $11 | $29 | $29 | $170 | $2,000 | $1,200 | $1,470 | **$4,910** |
| 2 | $38 | $100 | $102 | $255 | $2,000 | $600 | $270 | **$3,365** |
| 3 | $82 | $217 | $221 | $85 | $2,000 | $600 | $270 | **$3,475** |

**What is left**

| Month | Revenue | Gross margin | Net | **Cash** |
|---|---|---|---|---|
| 1 | $161 | −49% | −$4,748 | **$15,252** |
| 2 | $601 | 18% | −$2,765 | **$12,487** |
| 3 | $1,329 | 54% | −$2,146 | **$10,341** |

🔴 **You end the beta with $10,341 of the $20,000 and a $1,329/month run rate.**
Total burn for the quarter: **$9,659.**

### Scenario B — can the $20k alone get you to break-even?

**Yes. Month 7, and the cash never goes negative.**

| Month | Sessions | Revenue | Net | Cash |
|---|---|---|---|---|
| 3 | 543 | $2,143 | −$2,310 | $8,681 |
| **6** | 1,217 | $5,046 | **−$434** | **$5,533** ← low point |
| **7** | 1,402 | $5,845 | **+$205** | $5,738 |
| 12 | 2,214 | $9,347 | +$2,838 | $16,104 |
| 18 | 2,980 | $12,653 | +$4,933 | $38,049 |

This is the scenario to show the angel. It says what **their** money buys, not
what a later round might.

### Scenario C vs D — after a $150k round at month 6

Identical in every way except **what a new customer pays after the beta**.

| | Grandfathered (new customers pay full) | Half price for everybody |
|---|---|---|
| Break even | **month 27** | **month 18** |
| Revenue, month 36 | $17,501/mo | **$28,607/mo** |
| Cash, month 36 | $109,725 | **$205,660** |
| Accounts, month 36 | 133 | **259** |
| Revenue over 36 months | $385,782 | **$558,348** |

🔴 **Half price for everybody wins, and by a lot.** Halving the price loses 50%
of one customer; the price cliff loses 25–40% of *all* of them. Keeping people is
worth more than charging them more.

⚠️ **This rests on one guess**: that a customer who never faces a price rise
churns at the steady rate (4–6%) instead of the cliff rate (25–40%). That guess
is doing all the work. Do not treat this as proven — treat it as the hypothesis
your beta is designed to test.

---

## Part 4 · Answers to what you asked

**"How much do we burn to get 3 companies?"**
Sales + marketing over the three months = $3,000 + $2,400 = **$5,400**, winning
18 accounts. **Blended CAC $300 per account.** If you attribute the
company-focused salesperson's $1,500 to the 3 companies alone, that is **$500 per
company**, before their share of marketing.

**"What does the $20k buy?"**
Not three months. **Ten months, to break-even**, with the low point at $5,326 in
month 9. The three-month framing understates your own runway by a factor of
three.

**"What do we have to show an angel at month 3?"**
$1,329/month of revenue, more than doubling month on month, 18 accounts, 543 sessions, 54% gross margin and rising, $10,341 still in the bank,
and — the part nobody else has — **a measured unit cost**.

**"What growth rate should we expect?"**
Do not think in percentages at this size; think in **accounts per salesperson per
month**. This plan assumes each rep lands 2–4 accounts a month and holds it. In
percentage terms it is 40–80% month-on-month early (easy from a small base) and
about 6% by month 18. Anyone quoting you a "SaaS growth rate" at 20 customers is
selling something.

---

## Part 5 · Two things the model found that are worth acting on

**1. Video costs more than the AI. Much more.**

| At month 18 | Per month |
|---|---|
| OpenAI | $452 |
| **Daily video** | **$1,192** |
| Card processing | $1,241 |

You are building an AI company whose largest variable cost is a video vendor.
Worth pricing alternatives, or defaulting to in-person and phone sessions where
clinically fine.

**2. 🔴 Everything hangs on the session price, and it is a benchmark not a measurement.**

| Session price | Break even | Lowest the cash ever gets |
|---|---|---|
| 500 EGP ($10) | month 13 | **−$3,760. It runs out** |
| 750 EGP ($15) | month 9 | +$2,236 |
| **1,000 EGP ($20)** | **month 7** | **+$5,533** |
| 1,250 EGP ($25) | month 6 | +$7,590 |

Doubling the session price moves break-even by six months and is the difference between
running out of money and not. It is the first thing the beta should measure, and the answer
is a query over what therapists actually charged, not a number anybody chose.

**3. The half-price finding inverts the usual instinct.** The instinct is to
protect margin and let the price-sensitive go. The arithmetic says the opposite,
because the cliff takes a quarter to two-fifths of everybody, not just the
marginal ones.

---

## Part 6 · What the product does not do yet

You described the company flow as: upload a logo → we generate a great-looking,
print-ready QR flyer PDF → staff scan → they invite their therapist by QR, email
or phone.

| | Built? |
|---|---|
| Sponsor joining code + QR poster | ✅ Yes, server-rendered QR, `/sponsor/code` |
| Print the poster | ⚠️ Browser print only. **No PDF export** |
| Upload the company's logo onto it | ❌ **Not built** |
| Patient invites their therapist | ✅ Yes, invite codes |
| Invite a therapist by email or phone | ⚠️ Partial. Check before you sell it |
| Automatic "free month then 50%" billing | ❌ **Not built.** Invoice discounts are applied by hand today |

That last one matters commercially: **the offer this entire plan is built on has
to be operated manually right now.** At 18 accounts that is fine. At 100 it is
not, and it is the first thing to build after the beta.

---

## Part 7 · What the simulation now does with this

`docs/simulation/07-FINANCIAL-MODEL.md` is the brief. The three-month simulation
rehearses **this plan**, not a generic one: the same cast shape, the same offer,
the same pot credit, the same cadence. What it produces is the measured half —
the AI cost fitted from real rows, the consent rate counted, sessions per patient
counted — and those replace the guesses above.

**What the simulation can never tell you** is in the table in Part 2 marked
GUESS-and-churn. No number of synthetic patients can tell you whether a real
Egyptian therapist pays 1,000 EGP in month 4. Only month 4 can.
