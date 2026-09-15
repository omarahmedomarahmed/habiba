# 24Therapy

**The clinical record layer above whatever a therapist already uses.** Not a scribe,
not an EHR. The layer that makes every session, held anywhere, part of one patient's
story that the patient owns and carries.

**One Next.js application. One deployment. One database.**

> **Status: development. Nothing has launched.** Production holds one administrator
> and no patient data. Every account that has ever existed here was synthetic.

---

## Who signs in, and what each one can never see

Six kinds of person authenticate today. A seventh is being built. The last
column is the product.

| Portal | Route group | Sees | Never sees |
|---|---|---|---|
| **Patient** | `app/(patient)` | Everything about their own care | Another person's anything. A transcript. A clinical note |
| **Therapist** | `app/(app)` | Their own caseload, in full | Another clinician's caseload. Who paid for a session |
| **Clinic** | `app/(clinic)` | Its therapists' schedules, usage and bills. Patient names and appointment times only | **Any clinical content at all** |
| **Sponsor** | `app/(sponsor)` | The pot, the enrolled roster, aggregate spend | Who booked, when, with whom, about what |
| **Partner** | `app/(partner)` | Keys, docs, webhooks, their own subjects | Content. A webhook carries an event and an id |
| **Admin** | `app/(admin)` | The operating picture | A join between a sponsor and a session, booking, date or name |
| **Clinic staff** *(sprint 63)* | `app/(clinic)` | Only what their role was granted, on the resources it was granted for | A record, a note, a transcript, a copilot, a risk alert. A patient's full surname |

### The seventh: clinic staff

A practice is not one person. A receptionist books, an office manager chases
bills, an assistant runs one therapist's calendar. Today all of that requires
the clinic admin's own login, which is the account that can buy seats and
invite clinicians.

Six things decide the shape of it, and all six are already ruled:

- **Its own table and its own auth session**, like `sponsor_users` and
  `partner_users`. Never a `users` row: `staff` and `manager` there are *our*
  back office and one mistake away from a clinical grant.
- **`clinic_admin`, plus up to two custom roles the admin names.** Not a
  permission matrix nobody maintains.
- **Capabilities are checked in the data layer, on the resource.** An assistant
  assigned to therapist A is refused therapist B's calendar on the same route,
  not shown a hidden button.
- **The capability vocabulary is a closed list in code.** An unknown capability
  is refused, never ignored, and a custom role is a strict subset of the
  admin's.
- **Only the admin buys a seat or invites a clinician.** Money and membership
  are never delegable.
- **Patient identity to staff is first name plus last initial, and the patient
  is told**, on their own record page and on the radar card. Every read is
  audited.

A human who is both a clinician and a clinic admin gets **two linked principal
rows**, and the cookie names which one is active. Switching is explicit and
audited. One session never carries both capability sets.

🔴 **A clinic IS an `organizations` row. A sponsor is NOT.** They look like one
problem and have opposite answers: a clinic employs clinicians and its patients sit
inside the tenancy `actor.organizationId` scopes, while a sponsor pays for care it
must never see. Do not share a table between them.

---

## What it does

| Flow | Where |
|---|---|
| A session, recorded in person or in our room, transcribed and written up | `app/(room)/sessions/[id]/room` |
| A session on Zoom, Meet or Teams, with a bot we dispatch | `lib/meetings/` |
| A patient claims their record and carries it to a new therapist | `lib/data/portability.ts` |
| A clinician asks the record about a patient, with citations that resolve | `lib/ai/case-copilot.ts` |
| A patient books a therapist who is available right now | `app/(public)/radar` |
| A company or university funds therapy and never learns who went | `lib/data/sponsor.ts` |
| A hospital connects its EHR and our chart appears inside it | `lib/ehr/` |
| A partner platform reads a record under a grant the patient gave | `lib/partner/` |

---

## The money

One session raises **two line items**, and only one is conditional.

| | Charged to | When |
|---|---|---|
| **Platform fee** | The therapist, or their clinic | **Every session.** Free, in person, and declined ones |
| **AI fee** | The therapist, or their clinic | **Only when the patient turned AI on** |

There are **two ways to pay, and joining is free either way.**

| | Costs | A session then costs |
|---|---|---|
| **Pay as you go** | nothing to be on | $1 + $3 with AI, $1 without |
| **Practice** | $80 a month, one therapist | nothing |
| **Clinic** | $72 a seat, minimum two | nothing |

A monthly plan is **unlimited**: unlimited sessions, unlimited AI, and no
per-session fee at all. That is also a safety property and not only a price —
the AI fee is incurred by the therapist and switched on by the **patient**, so an
unlimited plan removes the last amount that could ride on a consent
conversation. Pay as you go keeps the split fee, which does the same job from the
other side (C209).

🔴 **A subscribed session still raises both invoice lines, at zero.** Not no
lines. A missing row is a gap; a zero is a fact, and every report keyed on line
kind keeps working without being told a plan exists.

🔴 **No amount of credit reaches a plan.** A subscription is bought, never
earned, and `tierForSpend` walks credit tiers only — the one-line filter that
stops any therapist who ever topped up a dollar from holding a clinic plan for
nothing.

Every figure above is a row in `platform_settings`, read at render time. Nothing
is typed into a page, a checkout or a test fixture.

**The patient never pays us.** They pay their therapist. A sponsored patient pays
nobody: a corporate pot stands in for their card and changes nothing downstream.

### Two currencies, and which one is not a display choice

**EGP in Egypt. USD everywhere else.** There is no third, and adding a country
does not add one. GBP and EUR countries are coming, and in them the price is
quoted in USD, paid in USD and paid out in USD.

| | Egypt | Everywhere else |
|---|---|---|
| Patient pays | **EGP**, through the Egyptian gateway | **USD**, through Stripe |
| Entity that collects | The Egyptian one | The US one |
| VAT | **14%, on top** | None. VAT is Egypt only |
| Clinician is paid | **Manually**, in EGP, by InstaPay or wallet | Stripe Connect, in USD |

🔴 **Collection follows the patient. Payout follows the clinician. They are
allowed to disagree.** An Egyptian patient seeing a British therapist pays EGP
into the Egyptian entity, and that therapist is paid USD out of the US entity
through Connect. A patient in Germany seeing an Egyptian therapist pays USD into
the US entity, and that therapist is paid manually in EGP. Both are cross-border
crossings, both mean **we are holding the money**, and both need an explicit
`entity_transfer` to settle. `isCrossBorder` counts them and §3c is the register.

🔴 **An Egyptian clinician is always on manual payouts**, whatever the row says,
because Stripe does not pay out to Egypt. Asking only "do they have a Connect
account" is a question about our database rather than about the world, and the
answer would have recorded money we hold as money we do not.

The rate is quoted once and frozen onto the transaction, so the receipt, the
refund and any later audit read the same number rather than each re-deriving it.

🔴 **The Egyptian rail is not live yet.** The company is being registered and the
gateway contract signed. Until then `collectionProblem` refuses an Egyptian card
payment in plain words and points at the free link, because a silent fallback to
Stripe would collect into the wrong entity, in the wrong currency, under the
wrong licence, and look like success from every screen.

---

## Rules the database enforces, not the application

A rule that lives in one function is a rule the second caller forgets. These are
constraints and triggers, provable by attempting the write.

| Rule | Where |
|---|---|
| A grant can only be held by a clinician whose verification is **approved** | trigger, `0060` |
| A journal or an assessment may be cited and **never concluded from** | `facts_journal_never_concludes` |
| A recorder joins only a meeting **we** provisioned | `session_sources_bot_only_if_ours` |
| One invoice per session, one line of each kind | `invoices_session_unique`, `invoice_lines_invoice_kind_unique` |
| A published instrument is **free to use** and, if translated, reviewed by a named person | `instruments_free_only`, `instruments_translation_reviewed` |
| `users.verification_status` is **derived**, never written by hand | trigger, `0083` |
| No column carries two foreign keys; no `SET NULL` contradicts a `CHECK` | audited in `scripts/_verify.ts` |

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, React 19 |
| Styling | Tailwind v4, tokens in `app/globals.css` |
| Database | Neon Postgres via Drizzle |
| Driver | `@neondatabase/serverless` |
| Auth | Opaque session tokens, httpOnly. Six principals, one router (`lib/routing.ts`) |
| AI | OpenAI. `gpt-4o-mini-transcribe`, `gpt-4o` |
| Video | Daily.co for our room; Recall.ai for external meetings |
| Email | Resend |
| Payments | Stripe (USD). An Egyptian gateway for EGP is contracted, not yet live |

**No WebSocket server and no separate API service.** The browser uploads an audio
chunk every eight seconds and the response carries new transcript text and any
crisis flag. That is the entire realtime layer, and live panels poll.

---

## Migrations: read this before you write one

🔴 **Nothing applies migrations on deploy.** Every migration is applied to
production **before** `main` moves, and every one is additive so the running
deployment survives the gap.

🔴 **`db:migrate` prints "Migrations applied" whether or not it did anything.**
Verify against `information_schema` every time. `scripts/migrate.ts` now refuses
before applying if the directory and the journal disagree, but the success line is
still not evidence.

🔴 **`drizzle-kit generate` without `--custom` cannot be used in this repository.**
`drizzle/meta/` holds only `0000_snapshot.json`; the chain was never built, so a
plain generate emits a migration recreating eighty-nine existing tables. Use
`--custom`, then **correct the generated `when`** to continue this journal's
sequence: drizzle applies a migration only when the previous ledger timestamp is
lower, and the generated value is a wall clock that lands behind our synthetic ones.

---

## Environment variables

### Required — the app refuses to boot in production without them

| Var | What it is |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string |
| `AUTH_SECRET` | Session cookie signing secret, 32 chars or more |
| `OPENAI_API_KEY` | Transcription and note generation |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhooks |
| `APP_URL` | Public origin, no trailing slash |

### Recommended — the feature degrades, the app still runs

| Var | What breaks without it |
|---|---|
| `DAILY_API_KEY` | Our room shows an honest "video is not configured" state. Audio and notes still work |
| `RECALL_API_KEY` | External meetings connect but no bot is dispatched |
| `STRIPE_SECRET_KEY` | No checkout. Nothing is charged |
| `RESEND_API_KEY` | No emails |
| `EMAIL_FROM` | Sender identity |
| `CRON_SECRET` | Scheduled jobs reject every request |
| `TOKEN_ENCRYPTION_KEY` | OAuth refresh tokens cannot be sealed, so meeting and EHR connections fail closed |

### Optional

| Var | Notes |
|---|---|
| `DATABASE_URL_DIRECT` | Non-pooled, for maintenance PgBouncer cannot carry |
| `DATABASE_SSL` | Tri-state. Leave unset unless running local Postgres without TLS |
| `SENTRY_DSN` | Disable session replay before enabling on a clinical app |
| `E2E_CHROMIUM` | Overrides browser resolution. `scripts/_browser.ts` resolves without it |

---

## Local development

```
npm install
cp .env.example .env.local     # fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate             # then VERIFY against information_schema
npm run dev
```

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | The safety suite |
| `npm run test:e2e` | Playwright, **through `tests/run-e2e.sh`**, which resolves the browser and starts a server. Running the file directly fails for that reason alone |
| `npm run verify:claims` | 🔴 Reads every published sentence and refuses a promise about a person's response time or an absolute about how well anything performs. Needs no database |
| `npm run verify:sprintNN` | Per-sprint gates. Most need a **branch** database and refuse production by name |
| `npm run demo:seed` | Synthetic clinicians and invented people. **Refuses production by name** |
| `npm run ship:content` | Publishes CMS defaults **to production**, then re-runs the verifiers you name. The CMS is authored-content-wins, so a copy fix that has not been shipped is a copy fix nobody can read |
| `npm run screens` | Screenshots every screen |

---

## Scheduled jobs

| Job | Schedule | What |
|---|---|---|
| `/api/cron/crisis` | every 5 min | Re-delivers crisis alerts whose notification failed. The alert is written **before** anyone is notified |
| `/api/cron/billing` | every 30 min | Charges completed sessions with no charge row; drains partner webhooks; runs the enrolment re-verification cycle |
| `/api/cron/retention` | daily 03:00 | Deletes audit records older than six years and expired tokens |

---

## Safety invariants

These are the ones that end the company if they break.

1. **A patient never converses with a model**, and no model output reaches a patient
   without a named clinician approving that exact text. Enforced on the import graph.
2. **The crisis path never depends on money.** No credit, an unpaid invoice, a
   suspended account or an empty pot all leave it untouched.
3. **A journal may be quoted and never concluded from.** C123's alerting path is
   separate and unchanged: a journal is still scanned and a grant-holder still told.
4. **A note carries how it was made** — transcript, partial, or the clinician's own
   memory — on every surface it appears.
5. **Nothing about any record appears before a handle is proven.** Not a name, not a
   photo, not an initial.
6. **"24/7" describes the radar being open**, never that anybody will answer. No
   response-time promise appears anywhere.

---

## The business, and the evidence for it

> ⚠️ **Read the provenance line before the numbers.** The operating plan runs on
> **2 measured inputs, 18 decided ones and 14 guesses**, and `npm run verify:plan`
> fails if that ratio is ever claimed to be better than it is. Everything below is
> a model, not a result. The one thing that is measured is the AI cost, and it was
> measured against the live API rather than estimated.

### What it costs to run a session, which is the only number here that was measured

Session cost is `FIXED + VARIABLE x minutes`, and on 2026-09-14 both terms were
fitted from real calls at four transcript lengths for $0.37 of spend.
`evals/physics.json` holds every row.

| Session length | AI cost |
|---|---|
| 3 minutes | $0.0254 |
| 8 minutes | $0.0457 |
| **50 minutes, a real one** | **$0.2167** |

🔴 **Multiplying the 3-minute figure to reach 50 gives $0.4230, which is 95% too
high.** At a $1 platform fee plus 15% that is the difference between a business
with a gross margin and one without, and it is why the simulation runs two
session lengths rather than one.

### The plan

Egypt first. A session is **1,000 EGP, about $20**. A therapist pays **$80 a
month unlimited**, which is exactly 20 pay-as-you-go sessions at $4, so a
therapist doing fewer than that is right to stay metered and the product does
not push them. A clinic is **two or three clinicians at $72 a seat**. Two
founders at $500 each, two salespeople, one marketer, two support staff, because
a bank transfer rail needs a person by the minute.

```
npm run plan            # five scenarios, thirty-six months
npm run plan -- beta    # one of them, month by month
```

### 🔴 The six months, month by month

This is the plan a $20,000 cheque actually buys. Nothing here is a raise.

| Month | In | Out | Net | **In the bank** |
|---|---|---|---|---|
| start | | | | **$20,000** |
| 1 | $183 | $6,816 | −$6,633 | $13,367 |
| 2 | $770 | $5,112 | −$4,342 | $9,025 |
| 3 | $1,715 | $5,309 | −$3,594 | $5,431 |
| 4 | $3,011 | $5,695 | −$2,684 | $2,747 |
| 5 | $4,519 | $5,979 | −$1,460 | $1,287 |
| **6** | **$6,020** | $6,230 | −$210 | **$1,077** |

**Six months of revenue: $16,218. Six months of spend: $35,141.** The month-6
run rate is $6,020, which is **$72,240 of ARR**, and the month itself is within
$210 of breaking even.

⚠️ **That ending balance is thin and it is the honest number.** $1,077 is about
five days of payroll. The plan does not run out of money and it does not have a
buffer either, and anything that slips — a month of slower sales, one company
not renewing — is felt immediately. This is what a $20,000 cheque buys with
seven people on it, and the answer to it is either fewer people, more months, or
a second cheque at month 5 rather than month 6.

### Where the money goes

| Line | Six months |
|---|---|
| People, seven at $500 | $21,000 |
| Marketing: $1,000 a month plus three videos | $6,600 |
| Welcome credit to companies | $510 |
| Models, video, card and wallet fees, hosting | $7,031 |
| **Total** | **$35,141** |

🔴 The **beta discount is not in that table.** It is revenue we chose not to
charge, not money we spent, and a spend column would count it twice.

### 🔴 The angel's return at month 6, which is the one that matters

The 36-month numbers are further down. **This is what a cheque today is worth
when the six months are over**, which is the point an angel can actually check.

| | |
|---|---|
| The cheque | **$20,000 for 20%** |
| Implied valuation today | **$100,000 post-money** |
| Month-6 run rate | **$6,020 a month** |
| Month-6 ARR | **$72,240** |

| If the company is valued at | It is worth | The 20% is | **Return** |
|---|---|---|---|
| 2x ARR | $144,480 | $28,896 | **1.4x** |
| 3x ARR | $216,720 | $43,344 | **2.2x** |
| 4x ARR | $288,960 | $57,792 | **2.9x** |
| 5x ARR | $361,200 | $72,240 | **3.6x** |

**So: roughly 2x to 3.6x in six months, on paper.** Not 29x. The big multiples
come from holding for three years and are in the long-horizon table below;
this is the near one, and it is the one nobody can wave away.

⚠️ **Three things that table is not.** It is not cash: nobody has sold anything,
and a valuation is what a next investor would pay rather than what is in the
bank. The ARR multiple is **my assumption**, not an output of the model. And
every revenue figure it rests on comes from fourteen guesses the beta exists to
replace.

### Two angels instead of one

| | Cheque | Stake | Same valuation |
|---|---|---|---|
| One angel | $20,000 | 20% | $100,000 post-money |
| Two angels | $10,000 each | 10% each | $100,000 post-money |

The return per dollar is **identical** either way, because both price the
company the same. Two angels is not a worse deal, it is the same deal split, and
it is usually the easier one to close.

### 🔴 What "dilution" means here, and why there is a row without it

If the company raises again later, new shares are issued and every existing
holder owns a smaller slice of a bigger company. A 40% dilution row means: after
one normal later round, a 20% stake has become 12%.

**The no-dilution row is not optimism, it is the case where no further round
happens** — which the `runway` scenario says is genuinely possible, because the
$20,000 alone reaches break-even. An angel should see both, because the two are
different bets: one on a company that raises and grows faster, one on a company
that never needs to.

### The three-year scenarios, and who decides between them

Two of the five scenarios are the same company with a different decision made at
month 6 about **what early customers pay from then on.**

| | In plain language | Whose decision |
|---|---|---|
| **`grandfathered`** | Everybody who joined during the beta **keeps half price for ever.** New customers pay full price | 🔴 **Yours.** It is a promise to the first hundred customers and it cannot be taken back |
| **`half-price`** | **Everybody** pays half price for ever, old and new, and there is no free first month | 🔴 **Yours.** It is a permanent price cut, not an offer |

`grandfathered` rewards the people who took a risk on an unproven product and
charges the market rate to everybody after them. `half-price` is a decision that
the market rate *is* half price, and it buys growth by giving up margin on every
customer for ever: it reaches more accounts and lower gross margin, and in this
model it ends up at roughly the same revenue by a longer road.

**Neither is a forecast and neither is mine to make.** The model prices both so
the decision is made with the difference on a page rather than in a conversation.

| Scenario | What it asks | Break even | Where it ends |
|---|---|---|---|
| `beta` | Three months on the cheque | not in 3 | $1,715/mo at m3 |
| `beta-cliff` | **Six months, no new money** | not in 6 | $6,020/mo, $1,077 of cash |
| 🔴 `runway` | **Can the $20k alone do it?** | **month 7** | $15,949/mo at m18, $52,977 of cash |
| `grandfathered` | Raise at m6, early adopters keep half price | month 6 | $35,442/mo at m36 |
| `half-price` | Raise at m6, half price for everybody | month 14 | $37,951/mo at m36 |

### The three-year table, for completeness

⚠️ **Read the six-month one above first.** This is the same arithmetic held for
three years, and every extra month multiplies the fourteen guesses by another
month of compounding. It is here because an angel is entitled to see it, not
because it is more reliable than the near one.

| Scenario at month 36 | Run rate | ARR | At 3x ARR | At 5x ARR |
|---|---|---|---|---|
| `grandfathered` | $35,442/mo | $425,304 | $1.28M | $2.13M |
| `half-price` | $37,951/mo | $455,412 | $1.37M | $2.28M |

| Stake | Diluted by a later round | `grandfathered`, 5x | `half-price`, 5x |
|---|---|---|---|
| 20% on $20k | none | $425k, **21x** | $455k, **23x** |
| 20% on $20k | 40% | $255k, **13x** | $273k, **14x** |
| 10% on $10k | none | $213k, **21x** | $228k, **23x** |
| 10% on $10k | 40% | $128k, **13x** | $137k, **14x** |

🔴 The 3x and 5x multiples and the 40% dilution are **assumptions I applied by
hand.** Nothing in the model computes them.

### The raise, and what it is for

**Recommended: $20,000 now, and a decision at month 6 rather than a plan for
one.** The model says the cheque alone reaches break-even in month 7 and then
compounds to $52,977 of cash by month 18 with no round at all. It also says a
round at month 6 roughly doubles month-36 revenue. Both are projections off the
same fourteen guesses.

So the honest shape is: take the $20k, run the six months, **replace the guesses
with counts**, and decide with evidence rather than committing now to a round
priced on a model.

🔴 **The first of those guesses is the one that matters.** At 500 EGP a session
the plan runs out of cash; at 1,000 it ends the six months at break-even with
$1,077 left. The session price is the most load-bearing number in the business
and nothing except a real customer can settle it.

The five things `npm run plan` prints as unknowable every time it runs:

- whether an Egyptian therapist will pay 4,000 EGP a month at all
- how many leave the month the discount ends. **Assumed 40%**
- what share of a call centre's staff enrol. **Assumed 5%**, then 40% active monthly
- what card and wallet processing actually costs in Egypt. **Assumed 3%**
- whether a company renews once the welcome credit runs out. **Assumed two in three**

---

## Run the simulation yourself, on your own keys

**You do not have to take any of the above on trust.** The six-month simulation
is in this repository and it runs against a database you make, on an OpenAI key
you top up, for about **$5**.

```
docs/WALKTHROUGH-PROMPT.md     paste into a fresh session. It writes .env.local itself
docs/simulation/               the ten documents it reads first
```

What you need: a Neon branch of your own, an OpenAI key with $10 on it, and a
Stripe **test** key. The write scripts refuse a production endpoint by name.

What you get: twenty-eight synthetic people who sign themselves up and use the
product through its real forms, six months of history aged into place, a full
money cycle read off the operator's own screens, every defect anybody hit, and an
exam measuring how much the copilot actually knows about each patient.

🔴 **A clean report means you did not look.** The last two walkthroughs each found
defects that sixty verifiers had missed.

---

## Documentation

| File | What |
|---|---|
| `PLAN.md` | The specification. §2 is every concern and its ruling; §6 is the standing rules |
| `HAZARDS.md` | Traps that have already caused defects here. Read once before your first commit |
| `docs/simulation/` | **The six-month simulation**, in ten documents: the cast, the swarm, the money, the Egyptian payment rail, the capture, and how six months of history is produced in one afternoon. Read with `docs/WALKTHROUGH-PROMPT.md`, which is the prompt that starts it |
| `docs/FINANCIAL-PLAN.md` | The operating plan the simulation rehearses. Egypt, the $20k, the offer, five scenarios, and every number labelled measured, decided or guessed |
| `docs/walkthrough-3/` | What that simulation produced: frames per person at month 0, 1, 3 and 6, the database in words at each, the money reconciliation, and the findings |
| `docs/walkthrough-archive/` | The written record of the two earlier walkthroughs. **Their frames were deleted on 2026-09-14**, and both video scripts are marked stale: they were written for a product that had one therapist and one patient in it |

---

## Layout

```
app/(public)     marketing, radar, developers, verify
app/(auth)       sign-in for clinicians and staff
app/(app)        the therapist portal
app/(patient)    the patient app
app/(clinic)     practices and hospitals
app/(sponsor)    companies and universities
app/(partner)    the developer portal
app/(admin)      the back office
app/(room)       the live session
lib/data/        every database read and write
lib/ai/          prompts, transcription, the copilot
lib/billing/     fees, credit, the ledger, payouts
lib/crisis/      scanning, levels, lines, alerts
drizzle/         migrations. Additive, applied before main moves
scripts/         verifiers, seeds, ratchets
```
