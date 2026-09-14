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
| Patient pays the therapist | 500 | $10 | **GUESS.** Cairo private therapy runs 300–800 |
| Our cut | 75 (15%) | $1.50 | **DECIDED** |
| Flat platform fee | 0 | $0 | **DECIDED**, changed from the shipped $1 |
| AI fee, if the patient consents | 50 | $1.00 | **DECIDED**, changed from the shipped $3 |
| Patients who consent to recording | — | 70% | **GUESS.** The beta counts this exactly |

🔴 **I changed your pricing and you should know why.** The product currently
ships $99 and $179 monthly plans, a $1 session fee and a $3 AI fee. In Egypt that
$99 plan is about **4,950 EGP a month**, which is more than many Egyptian
therapists net in a week. And $1 + 15% + $3 on a 500 EGP session is **$5.50 on a
$10 session — 55% of what the patient paid.** Nobody signs that twice. The prices
below are what I think is sellable in Egypt; they are inputs, not decisions I have
made for you.

### What each kind of customer pays

| | EGP/month | USD/month | Label |
|---|---|---|---|
| Solo therapist | 1,000 | $20 | **GUESS.** Two sessions' fee for a tool they use forty times |
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

### The offer

| Month of *their* life | They pay | Label |
|---|---|---|
| 1 | Free | **DECIDED** |
| 2 | 50% | **DECIDED** |
| 3 | 50% | **DECIDED** |
| 4 onward | Full price | **DECIDED** |

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
document. Free-trial conversion for unproven small-business software is commonly
worse than these. **The entire purpose of your beta is to replace this column
with counted facts.**

### The team

| | $/month | From | Label |
|---|---|---|---|
| You | 500 | month 1 | **DECIDED** |
| Co-founder | 500 | month 1 | **DECIDED** |
| Sales — companies and universities | 500 | month 1 | **DECIDED** |
| Sales — clinics and therapists | 500 | month 1 | **DECIDED** |
| **Total payroll** | **$2,000** | | |

No employer burden modelled — at this size they are contractors. If you put them
on formal contracts with social insurance, add roughly 15–20%.

### Marketing

| | EGP | USD | When | Label |
|---|---|---|---|---|
| Three videos, produced | 30,000 | $600 | month 1, one-off | **GUESS.** 10,000 EGP each is a competent 60–90s explainer in Cairo |
| Ad spend, Meta + TikTok | 15,000/mo | $300/mo | every month | **DECIDED.** Egyptian CPMs are low; this buys reach, not a brand |
| Three influencer therapists | 15,000/mo | $300/mo | every month | **GUESS.** 5,000 EGP each is micro-influencer rate here |

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

**Yes. Month 10, and the cash never goes negative.**

| Month | Sessions | Revenue | Net | Cash |
|---|---|---|---|---|
| 3 | 543 | $1,329 | −$2,146 | $10,341 |
| 6 | 1,217 | $3,220 | −$994 | $6,310 |
| **9** | 1,749 | $4,720 | **−$10** | **$5,326** ← low point |
| **10** | 1,911 | $5,177 | **+$289** | $5,615 |
| 12 | 2,214 | $6,031 | +$849 | $7,040 |
| 18 | 2,980 | $8,182 | +$2,257 | $17,245 |

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

**2. The half-price finding inverts the usual instinct.** The instinct is to
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
