# 24Therapy

**The clinical record layer above whatever a therapist already uses.** Not a scribe,
not an EHR. The layer that makes every session, held anywhere, part of one patient's
story that the patient owns and carries.

**One Next.js application. One deployment. One database.**

> **Status: development. Nothing has launched, and nobody real has an account here.**
> As of 2026-09-19 production holds 9 users (4 administrators, 5 staff), 7 people on the
> payroll, 2 organisations, 3 sponsors, 1 patient and 1 completed session, all of them
> planted by `simulate:seed` to give the six month run something to start from. **Every
> account that has ever existed here was synthetic**, and that is the claim to keep true:
> the counts move every time the run does.

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
> **2 measured inputs, 20 decided ones and 12 guesses**, every one of them
> labelled in `lib/finance/plans.ts` with a sentence saying why, and
> `npm run verify:plan` fails if that ratio is ever claimed to be better than it
> is. Everything below is a model, not a result. The one thing measured is the AI
> cost, and it was measured against the live API rather than estimated.

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
high.** At a $1 room fee plus 15% that is the difference between a business with
a gross margin and one without, and it is why the simulation runs two session
lengths rather than one.

### What we charge

Egypt first. A session is **1,000 EGP, about $20**, and we take **15%** of what
the patient paid.

| | |
|---|---|
| Metered, the room | **$1** on **every** session: paid, free, radar, invite, in person |
| Metered, the note | **$3 more**, and only where the patient consented to recording |
| So metered is | **$4 a session**, or $1 where consent was declined |
| Solo plan | **$80 a month**, and a subscriber pays **neither** per-session charge |
| Clinic plan | **$72 a seat**, minimum two. Ten per cent under solo |
| The offer | Month 1 free, months 2 and 3 at half price, full price after |
| Joining later | One free month, then full price. **And nothing after that** |

🔴 **$80 is exactly 20 metered sessions at $4.** A therapist doing fewer than
twenty a month is right to stay metered and the product does not push them. It is
also high enough that a full-time clinician cannot outrun it: a session costs us
about $0.62 all in, so the plan stops paying for itself past 130 sessions a month
and a heavy full-time load is about 120.

### The plan

Two founders at $500 each, two salespeople, one marketer, two support staff,
because a bank transfer rail needs a person by the minute.

🔴 **And one of the two founders sells full time.** That is the decision the whole
plan turns on. It costs nothing on the payroll, because they already draw their
$500, and it buys fifty per cent more selling capacity from month one. Without it
the six months end at roughly break-even with about a thousand dollars left. With
it the company is profitable in month 5 and has a buffer.

⚠️ **It is also the assumption most likely to be wrong.** A founder selling is a
founder not building, and a cash forecast has no line for what stops being built.

```
npm run plan                  # three scenarios
npm run plan -- beta-cliff    # the six months, month by month
```

### 🔴 The six months, month by month

This is what a $20,000 cheque buys. Nothing here is a raise.

| Month | In | Out | Net | **In the bank** |
|---|---|---|---|---|
| start | | | | **$20,000** |
| 1 | $305 | $6,952 | −$6,647 | $13,353 |
| 2 | $1,290 | $5,365 | −$4,075 | $9,278 |
| 3 | $2,812 | $5,825 | −$3,013 | $6,265 |
| 4 | $4,810 | $6,299 | −$1,489 | $4,776 |
| 5 | $7,161 | $6,747 | **+$414** | $5,189 |
| **6** | **$9,474** | $7,137 | **+$2,337** | **$7,526** |

**Break-even is month 5.** Six months of revenue: $25,852. Six months of spend:
$38,325. The month-6 run rate is $9,474, which is **$113,688 of ARR**, at a 75%
gross margin.

⚠️ **$7,526 is a buffer, not a cushion.** It is about six weeks of payroll. The
plan does not run out of money and it is not comfortable either, and a month of
slower sales is felt immediately.

### Where the money goes

| Line | Six months |
|---|---|
| People: seven at $500, plus a founder selling at no extra cost | $21,000 |
| Marketing: $1,000 a month plus three videos | $6,600 |
| Models, video, card and wallet fees, hosting | $9,623 |
| Welcome credit to companies | $1,105 |
| **Total** | **$38,325** |

🔴 The **beta discount is not in that table.** It is revenue we chose not to
charge, not money we spent, and a spend column would count it twice. Over the six
months it is **$8,442** of list price never billed.

### 🔴 The angel's return at month 6

**This is what a cheque today is worth when the six months are over**, which is
the point an angel can actually check. There is no three-year table any more:
every extra month multiplies twelve guesses by another month of compounding, and
a number nobody can check is not evidence.

| | |
|---|---|
| The cheque | **$20,000 for 20%** |
| Implied valuation today | **$100,000 post-money** |
| Month-6 run rate | **$9,474 a month** |
| Month-6 ARR | **$113,688** |

| If the company is valued at | It is worth | The 20% is | **Return** |
|---|---|---|---|
| 2x ARR | $227,376 | $45,475 | **2.3x** |
| 3x ARR | $341,064 | $68,213 | **3.4x** |
| 4x ARR | $454,752 | $90,950 | **4.5x** |
| 5x ARR | $568,440 | $113,688 | **5.7x** |

**So: roughly 2x to 5.7x in six months, on paper.**

⚠️ **Three things that table is not.** It is not cash: nobody has sold anything,
and a valuation is what a next investor would pay rather than what is in the
bank. The ARR multiple is an **assumption applied by hand**, not an output of the
model. And every revenue figure it rests on comes from twelve guesses the beta
exists to replace.

### The longer view, if no round ever happens

The `runway` scenario asks whether the $20,000 alone can do it. It says yes:
break-even in month 5, and by month 18 the company is at **$24,816 a month** with
**$119,292** in the bank, having never raised again.

| At month 18 | ARR | 20% at 3x ARR | 20% at 5x ARR |
|---|---|---|---|
| $24,816/mo | $297,792 | $178,675, **8.9x** | $297,792, **14.9x** |

🔴 The multiples are assumptions applied by hand. Nothing in the model computes
them, and eighteen months is far enough out that the guesses dominate.

### Two angels instead of one

| | Cheque | Stake | Same valuation |
|---|---|---|---|
| One angel | $20,000 | 20% | $100,000 post-money |
| Two angels | $10,000 each | 10% each | $100,000 post-money |

The return per dollar is **identical** either way, because both price the company
the same. Two angels is not a worse deal, it is the same deal split, and it is
usually the easier one to close.

### 🔴 What "dilution" means, and why the table above has none in it

If the company raises again later, new shares are issued and every existing
holder owns a smaller slice of a bigger company. After one normal later round a
20% stake typically becomes about 12%.

**The tables above assume no further round**, which the `runway` scenario says is
genuinely possible, because the $20,000 alone reaches break-even and keeps
compounding. If a round does happen, take roughly 40% off every return figure
above and the company behind them is larger. Those are two different bets and an
angel should see both: one on a company that raises and grows faster, one on a
company that never needs to.

### The raise, and what it is for

**Recommended: $20,000 now, and a decision at month 6 rather than a plan for
one.** The model says the cheque alone breaks even in month 5 and then compounds
with no round at all. It also says a round would buy speed. Both are projections
off the same twelve guesses.

So the honest shape is: take the $20k, run the six months, **replace the guesses
with counts**, and decide with evidence rather than committing now to a round
priced on a model.

🔴 **The first of those guesses is the one that matters.** At 500 EGP a session
the plan runs out of cash; at 1,000 it breaks even in month 5. The session price
is the most load-bearing number in the business and nothing except a real
customer can settle it.

The five things `npm run plan` prints as unknowable every time it runs:

- whether an Egyptian therapist will pay 4,000 EGP a month at all
- how many leave the month the discount ends. **Assumed 40%** of solo therapists
- what share of a call centre's staff enrol. **Assumed 5%**, then 40% of those
  active monthly
- what card and wallet processing actually costs in Egypt. **Assumed 3%**
- whether a company renews once the welcome credit runs out. **Assumed two in
  three**

---

## Run the simulation yourself, on your own keys

**You do not have to take any of the above on trust.** The six-month simulation is
in this repository and it runs against a database you make, on an OpenAI key you
top up, for about **$5**.

```
docs/SIMULATION-PROMPT.md      paste into a fresh session. It writes .env.local itself
docs/simulation/               the seventeen documents it reads first
```

What you need: a Neon branch of your own, an OpenAI key with $10 on it, a Stripe
**test** key and a Vercel Blob token. The write scripts refuse a production
endpoint by name.

What you get: **twenty-one synthetic people** who sign themselves up and use the
product through its real forms, across one practice and three companies, six
months of history aged into place, a full money cycle read off the operator's own
screens, every defect anybody hit, and an exam measuring how much the copilot
actually knows about each patient.

🔴 **A clean report means you did not look.** The last two walkthroughs each found
defects that sixty verifiers had missed.

---

## Documentation

| File | What |
|---|---|
| `PLAN.md` | The specification. §2 is every concern and its ruling; §6 is the standing rules |
| `HAZARDS.md` | Traps that have already caused defects here. Read once before your first commit |
| `docs/SIMULATION-PROMPT.md` | **The prompt that starts the simulation.** Keys, the branch, the steps, and what to report back |
| `docs/simulation/` | The seventeen documents it reads first: what was hit before it, the cast, the swarm, the money, the Egyptian payment rail, the capture, the ageing, the copilot exam, what the run hands the plan, the forty eight money edges, each person's week by week story, who is allowed to read a record, the logins, the audio, the rehearsal and the deploy. `verify:runbook` checks them against the code |
| `docs/FINANCIAL-PLAN.md` | The operating plan the simulation rehearses. Egypt, the $20k, the offer, and every number labelled measured, decided or guessed |
| `docs/simulation-run/` | What the simulation produced: frames per person at months 0, 1, 3 and 6, the board every week for six months, the database in words at each checkpoint, the money reconciliation, and the findings |
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
