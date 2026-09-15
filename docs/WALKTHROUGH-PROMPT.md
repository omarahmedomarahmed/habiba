# The six-month simulation: the prompt for a fresh session

Paste everything below the line into a new session. Nothing above it is part of the prompt.

**Before you paste it, one thing:**

**Top up OpenAI with $10.** Then paste your keys into the block at the top of the prompt
below, replacing the placeholders. You do not need to touch any file: the new session writes
`.env.local` itself as its first act.

Rotate both keys when the run is done. They will have been in a chat transcript.

---

## 🔴 KEYS. Replace the first three lines, then send the whole message.

```
OPENAI_API_KEY=sk-paste-yours-here
DAILY_API_KEY=paste-yours-here
STRIPE_SECRET_KEY=sk_test_paste-yours-here
DATABASE_URL=postgresql://neondb_owner:npg_nBpWM0F5DVLc@ep-empty-queen-a62vlkkp-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

**Your first action, before reading anything else: write those four lines into `.env.local`
in the repository root, and add nothing else to that file.** The fourth is already correct
and is in the block so that the database survives a new shell: an `export` does not, and a
script that silently falls back to another database is the worst possible way to discover
that.

Then confirm with `npm run spend -- --budget 10`, which needs a database and not a key, and
with a single cheap call once you reach step 2.

If any of the first three still says "paste-yours-here", **stop and say so**. A run that
starts without a funded key produces six months of empty notes and spends an afternoon doing
it.

`STRIPE_SECRET_KEY` must begin `sk_test_`. If it begins `sk_live_`, stop: this simulation
moves money through every path it can find and a live key would move real money.

---

You are running a six-month simulation of 24Therapy: a swarm of agents behaving as real
people, using the real product, producing a database that looks like half a year of trading
and a folder of screenshots that proves it.

**Read these ten files from the repository first, in this order, before doing anything:**

```
docs/simulation/00-START-HERE.md      the shape, the five rules, the order of work, the $10 budget
docs/simulation/01-SEED.md            the cast: 28 identities, 6 waves, and how often each patient comes
docs/simulation/02-ORCHESTRATION.md   the swarm: who launches what, how claims are verified
docs/simulation/03-MONEY.md           income, expenses, and Egypt, which has no card rail
docs/simulation/04-CAPTURE.md         what is photographed, where it goes, the video scripts
docs/simulation/05-AGEING.md          how six months happens in one afternoon
docs/simulation/06-COPILOT-EXAM.md    the test at the end: what the copilot really knows
docs/simulation/07-FINANCIAL-MODEL.md what the run feeds into the 36-month forecast, and what it can never measure
docs/simulation/08-THE-OFFER.md       🔴 the commercial offer: free month, half price, and the full-price invoice
docs/simulation/09-THE-RAIL.md        🔴 how money reaches us in Egypt: a bank transfer and a person checking it
```

They are one design in ten documents. **Do not start until you have read all ten.**

🔴 **And read `docs/FINANCIAL-PLAN.md` once before you begin.** It is not part of the run; it
is the business this run is a rehearsal of. Twenty thousand dollars, Egypt, two salespeople,
three companies, six clinics, nine therapists, and an offer of one free month then half price.
Everything the simulation captures is evidence for or against something in that document.

## In one paragraph

Twenty-eight synthetic people sign themselves up and use the product: seven therapists,
seven patients, a practice, three companies, an integrator and an operator. **All of them
are Egyptian**, which means none of them can pay by card. They arrive in six waves. Cheap
agents act as them. One expensive orchestrator sequences them and **verifies every claim
against the database rather than believing the agent that made it**. Between waves, a script
ages the rows that wave created, so at the end the database holds six months of history
produced in one afternoon by real interactions with the real product. Screenshots are taken
at month 0, 1, 3 and 6, per person, on the same screens each time. Then the copilot sits an
exam about every one of those patients.

## 🔴 The three things that make this run different from the last one

**It is six months, not three, and the second half is the point.** Three months ends inside
the beta, when everything is free and everybody is happy. **Month 4 is when the first
full-price invoice goes out**, and what people do that week is the number the entire
thirty-six month forecast turns on. A three-month run photographs the easy half.

**Everybody is Egyptian, so there is no card rail.** `topUpPot` refuses `entity = 'eg'` and
it is right to. Money reaches us by InstaPay or bank transfer: the payer claims it on their
own screen, and **nothing moves until an operator confirms it**. That rail is new, it has
never carried a real payment, and it is the largest surface this run exercises.
`09-THE-RAIL.md` is the whole of it.

**Four new standing agents.** A payments operator working the transfer queue by the minute,
a business strategist writing one note a month off the operator's own screens, a CFO after
month 3 and again after month 6, and a CTO keeping the dev log. All four work by clicking.
`02-ORCHESTRATION.md` says what each one is for.

## 🔴 The budget is $10 and it must not run out halfway

| | |
|---|---|
| Sessions | **62** over six months: 🔴 **42 at 3 minutes and 20 at 8**, not one length |
| Total audio | 265 minutes |
| Planned model spend | **≈ $4.75** |
| Left over | **≈ $5.25**, which is headroom, not a licence to add sessions |
| In-session copilot | capped at **4** messages. Already set on the branch |

🔴 **Doubling the months did not double the bill, and that is not luck.** The model spend
tracks the SESSION COUNT and not the calendar. Three more months of trading is twenty-seven
more sessions, about ninety cents. Everything else months 4 to 6 contain, from invoices and
transfers to a pot running dry and somebody cancelling, calls no model at all. **So there is
nothing to save by compressing the run back to three months**, and what would be lost is the
only part that shows what happens when the free month ends.

🔴 **The two session lengths are not a detail and must not be flattened.** Session cost is
`FIXED + VARIABLE x minutes`; the fixed half is 52% of a 3-minute session and 6% of a
50-minute one, so multiplying a short session to reach a long one **overstates it by 95%**.
Two unknowns need two measurements. `01-SEED.md` has the arithmetic, and
`lib/finance/physics.ts` **refuses** to fit a single cluster rather than returning a
confident wrong number.

```
npm run spend -- --budget 10
```

**After every wave, without exception.** It sums what the product actually spent, warns at
70% and exits non-zero past the line. `00-START-HERE.md` has the arithmetic and says what to
cut first if it runs ahead. The one thing never to cut is `P3` Mostafa's weekly cadence: he
is the entire top of the copilot exam's ladder.

## The database branch, made, migrated, seeded and ready

```
postgresql://neondb_owner:npg_nBpWM0F5DVLc@ep-empty-queen-a62vlkkp-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

On it, already:

| | |
|---|---|
| Schema | Migrated 0000 to 0106. 107 journal, 107 ledger, every CHECK validated |
| Settings | 9 groups, 2 countries, the rate table |
| Public site | 14 published pages. All 24 page-and-locale pairs render |
| Operator | `nour.example@example.com` / `Simulation2026!`, super admin |
| Waiting in his queue | Nile Practice, Cairo Foundry, Alexandria Textiles, Delta Logistics. **All four held, none approved, and all four on the `us` entity** |
| People | **Zero** therapists, zero patients, zero sessions. They sign themselves up |
| 🔴 The transfer details | **Empty.** An operator types the real bank account in on camera, in wave 1. A seeded one would be a bank account in this repository and a screen nobody walks |
| Spent | **$0.00** |

**Confirm that yourself before you trust this paragraph.** A prompt that says a database is
ready is exactly the kind of claim rule 1 exists to distrust. Step 1 below is how.

## 🔴 What you report back, and when. Do not save it all for the end.

The person who pasted this is not watching a terminal for four hours. **Report upward at
seven fixed points**, each one short enough to read on a phone.

| When | What, in at most eight lines |
|---|---|
| After step 2 | The branch is what the prompt claimed, or it is not. Gate results. **Say plainly if anything is already red before a single agent has acted** |
| After step 3b | The rail is open: the bank details are in, three companies and two practices moved to `eg`. This is the first thing that has ever done it |
| End of each wave, six times | One table: sessions so far, the depth ladder (`P3` against `P6`), `npm run spend` against $10, defects found this wave, and **anything an agent is blocked on** |
| After wave 4 | 🔴 **The full-price invoice.** Whether it rendered with no discount line, and what the therapists did. This is the single most important moment in the run |
| After the exam | The mark per patient, and whether the claim held: does a thicker record make a better copilot |
| After the CFO's second pass | The money, end to end, and the two passes side by side |
| At the end | The report, the dev log, and 🔴 **the five things `npm run plan` says the model cannot know, answered or still open** |

### 🔴 Three things to say immediately, without waiting for a checkpoint

1. **The spend passes 70% of $10.** Say so the moment `npm run spend` warns, with what is
   left to do. Do not decide alone to cut the run.
2. **An agent is blocked and cannot resume.** One `BLOCK-<n>`, the screen, and what it needs.
3. 🔴 **A defect that would lose somebody money or expose a record.** Everything else goes in
   the log and waits; these two do not.

### What the final report contains

`docs/walkthrough-3/REPORT.md`, and `00-START-HERE.md` lists it in full. The eight headings:

1. **The money**, end to end, read off the operator's own screens, not queried
2. **The copilot exam**, per patient, and what it invented about people it knew nothing about
3. **Every defect**, with the screenshot and the person who hit it
4. **A verdict per screen**: finished, thin, unstyled
5. **What was actually spent**, against the $4.75 estimate, and why it differed
6. 🔴 **The fitted cost model**: the two terms per AI kind, the r², and a 50-minute session
7. **The AI accuracy**, or plainly "not re-recorded, no budget"
8. **What could not be simulated**, and why

🔴 **A clean report means you did not look.** The last two walkthroughs each found defects
that sixty verifiers had missed, and this run exercises far more of the product than either.

## 🔴 Step by step, from a cold start

### Step 1 · Write the keys, point at the branch, check it

```bash
# 1. Write .env.local from the KEYS block at the top of this message. Nothing else in it.

# DATABASE_URL is in .env.local from the block above. Scripts do NOT read that file
# themselves, so export it once per shell as well, from the same value:
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)

npm run verify:migrations      # 107 journal, 107 ledger
npm run simulate:seed          # MUST REFUSE: "already has an operator". That refusal is the proof
npm run verify:age             # 8 checks. The ageing script obeys its own rule
npm run verify:synthetic       # 5 checks. Every person here is invented
npm run physics                # says there is nothing to fit yet. After the run it says something else
npm run spend -- --budget 10   # $0.0000, 0.0% used
```

If `simulate:seed` does not refuse, you are pointed at the wrong database. Stop.

### Step 2 · Check the product, before twenty agents tell you it is broken

```bash
npm run build
npm run gates    # prose · claims · principals · i18n · boundary · renders · finance · plan · rail · entitlement
```

Ten gates. `renders` starts the built app and fetches all 24 public pages; it is there
because `/pricing` answered 500 in production for seven sprints and nothing asked.
🔴 **`entitlement` is the only one that writes.** It makes a throwaway practice, subscribes
it by transfer, checks it is NOT on the plan until a confirmation, checks it IS after, and
deletes the lot in a `finally`. Three defects it found were true of the source and false of
the database, which is why it exists.

### Step 3 · Mark the start of wave one

```bash
npm run age -- --marker wave1 --start
```

Everything created from this moment is wave one's and ages together. **Do this before any
agent acts.**

### Step 3b · 🔴 Open the rail, before any money moves

Signed in as the operator, through the browser, not a script:

| Where | What |
|---|---|
| `/admin/settings` | Type the Egyptian bank details in. Until you do, every payer sees "not on the system yet" |
| `/admin/sponsors` | Move all three companies from `us` to `eg` |
| `/admin/clinics` and each solo therapist's own `/settings` | Move each practice to Egypt |

**Nothing in the Egyptian half of this run works until those are done**, because
`sponsorNeedsTransfer` and `organizationNeedsTransfer` read exactly those two columns. The
run starts with the rail shut on purpose: opening it is a photographed act rather than a
seeded fact, and until sprint 74 nothing in the product could do it at all.

### Step 4 · Launch the orchestrator, and through it everybody else

Hand it `02-ORCHESTRATION.md` and `01-SEED.md`. **Make it report its plan before it launches
anybody.** Six agents awake at most.

#### 🔴 You launch ONE agent. It launches the rest.

```
  YOU  ·  the main session
   │   reads the ten documents, checks the branch, opens the rail, ages each wave,
   │   runs the exam, writes the report, and reports upward to the human
   ▼
  THE ORCHESTRATOR  ·  one agent, the most capable one available
   │   owns the wave clock. Wakes agents, sequences them, VERIFIES EVERY CLAIM
   │   against the database, watches the depth ladder and the spend
   │
   ├── standing agents, awake for the whole run ──────────────────────────────
   │     growth and operations      approvals, the verification queue, T4's rejection cycle
   │     money                      03-MONEY.md, every wave, income AND expenses
   │     codes                      reads real verification codes so twenty agents do not each improvise
   │     🔴 payments operator        /admin/transfers, by the minute. 09-THE-RAIL.md
   │     🔴 business strategist      one note per month, off the operator's own screens
   │     🔴 CFO                      after month 3, and again after month 6. The two are compared
   │     🔴 CTO                      the dev log. Fixes nothing during the run
   │
   ├── cast agents, one per identity, woken for their wave and then idle ─────
   │     7 therapists · 7 patients · 1 practice manager · 1 practice staff
   │     3 company HR admins · 1 integrator · 1 operator
   │
   └── capture agent, at the end of every wave ───────────────────────────────
         04-CAPTURE.md. Runs BEFORE the ageing, never after
```

**Cheap agents do the acting. One expensive agent keeps them honest. You supervise the one
that keeps them honest.**

#### The launch order, which is not alphabetical

| When | Who wakes | Why then |
|---|---|---|
| Before wave 1 | growth and operations, codes, **payments operator**, CTO | The rail has to be open and the console has to work before anybody can do anything |
| Wave 1 | operator, `T1` `T2` `T3` `T4`, `P1` `P2` | Seven identities. The product with nobody on it |
| End of every wave | capture, money, **strategist** | In that order. The strategist reads what the money agent just closed |
| Wave 2 | `C1` and its three people, `E1` and its HR admin, `P3` `P4` | Growth is an event: when the operator approves a clinic, a clinic agent wakes |
| After wave 3 | **CFO, first pass** | Three months of rows |
| Wave 4 | `T5`, and the four injected bugs | The month the bills come |
| Wave 5 | `T6`, `P7` | Churn, and a therapist for whom the plan is worse value |
| Wave 6 | **CFO, second pass** | Compared against the first, which it reads before it starts |

🔴 **Every one of them works by clicking.** No agent writes SQL, calls a server action
directly, or runs a script that changes a row. They sign in on the sign-in form and press the
buttons. An agent that reached around the product cannot find the defect it was launched to
find, and four of the seven standing agents exist to be the first person ever to use a screen.

#### 🔴 What every agent reports, in this shape and no other

```
DID: booked a session with T2 for Thursday 14:00
SAW: docs/walkthrough-3/m1/p2-salma/booking-confirmed.png
ROW: availability_slots id 8f3e… state=booked session_id=41ba…
```

**The orchestrator verifies `ROW` against the database itself.** An agent's word is an input,
never a fact. An agent that cannot produce a row id did not do the thing, and it is re-tasked
rather than recorded as a success.

#### 🔴 When an agent hits a wall: PAUSE, report, wait, resume

It does **not** restart from scratch and it does **not** work around the product. It stops,
writes one `BLOCK-<n>` block naming the screen, what it expected, what it got, and **the step
to resume from**, and waits. `02-ORCHESTRATION.md` has the exact shape. An agent that
restarts loses everything the wave built; an agent that works around the product destroys the
only thing this exercise produces.

### Step 5 · Each wave, in this order, six times

```bash
# 1. the wave acts, agents report DID / SAW / ROW, the orchestrator verifies every ROW
# 2. the capture agent runs                           (04-CAPTURE.md)
npm run spend -- --budget 10                        # 3. the number, before anything moves
npm run age -- --marker wave1 --days 90             # 4. only now, and only after the capture
npm run verify:migrations                           # 5. did the shift break an ordering constraint
npm run age -- --marker wave2 --start               # 6. open the next wave
```

| Wave | Ages by | Lands at |
|---|---|---|
| 1 | **180** days | month 0 |
| 2 | **150** days | month 1 |
| 3 | **90** days | month 3 |
| 4 | **60** days | month 4 |
| 5 | **30** days | month 5 |
| 6 | not at all | month 6, which is today |

🔴 **Never age before the capture.** The frames would show the wrong dates and cannot be
retaken.

### Step 6 · The exam, and the cost model

```bash
npm run copilot:exam -- --dry                                    # who is about to be examined
npm run copilot:exam -- --json docs/walkthrough-3/COPILOT.json   # ≈ $0.36

npm run physics -- --at 50 --json docs/walkthrough-3/PHYSICS.json   # free, reads rows
```

🔴 **`physics` must fit every kind with no refusals.** A refusal means the durations came out
flat and the financial model that follows this run cannot be built from it. It prints the
measured short session, the two-term figure for fifty minutes, and the number naive
multiplication would have given, side by side.

`06-COPILOT-EXAM.md` is the method. Half the questions are about things the record does
**not** contain, and a copilot that answers those is failing worse than one that forgets.
Report the correlation whichever way it comes out.

### Step 7 · The accuracy figures, only if there is money left

```bash
npm run spend -- --budget 10
npm run evals -- --record      # ≈ $2.00. Only if the line above leaves room
```

If it does not, write "not re-recorded, no budget" in the report. That is a better sentence
than a simulation that stopped in wave two.

### Step 8 · The console, photographed in full

```bash
npm run verify:synthetic       # MUST pass immediately before you commit any operator frame
```

🔴 **All 24 admin pages, at month 3, committed.** C80 said admin frames are never committed
and its reason was real names; this run has none, and `verify:synthetic` proves it rather
than assuming it. `04-CAPTURE.md` lists every page and what each frame has to show.

**Four of the 24 are `requireStaff()`** (verifications, payouts, numbers, support).
Photograph those signed in as **staff**, not as the owner, or the capture shows a console
nobody on the rota actually sees.

### Step 8b · The financial model

```bash
npm run forecast                 # four scenarios, thirty-six months
npm run physics -- --at 50       # the two terms, from this run's own rows
```

Then on `/admin/financial-model`, signed in as the operator: type a label into **Measure and
freeze** and press it. It writes one row to `finance_benchmarks` and never updates it, so the
figure is reproducible later. Photograph the page **after** that, so the provenance bar at the
top says this database rather than the shipped estimate.

🔴 **`07-FINANCIAL-MODEL.md` is the whole brief for this step**, including the four things the
run can never establish (churn, acquisition cost, card fees, video cost) and the rule that a
short-session cost is never quoted as unit economics.

### Step 8c · 🔴 The offer, and the invoice that decides everything

The offer this business launches with is **one free month, then two at half price, then full
price**. `08-THE-OFFER.md` is the brief. Three invoices have to exist and be photographed:

| | |
|---|---|
| The free one | Wave 1, a therapist's first invoice. **Zero, and it says why.** An invoice that is simply absent is indistinguishable from a billing bug |
| The half-price one | A wave later. List price, discount line and payable amount, all three visible |
| 🔴 **The full-price one** | **Wave 4.** It is a wave of the run now, not an extra step at the end: a cohort reaches its fourth month and is billed with no discount line |
| 🔴 **The post-beta one** | `T5` and `T6` join in months 4 and 5 and get **one free month, then full price**. No half price, no schedule. Two people see it so it reads as a rule |

The third is the single most important frame in the run. The plan assumes a quarter to two
fifths of customers leave at that moment, and that guess moves break-even by nine months
either way. **The run cannot tell you whether a real therapist would pay. It can tell you
whether the product bills them correctly, which is the half that is our fault if it is wrong.**

⚠️ **Automatic promotional billing is not built.** `discount_cents` and `discount_reason`
exist; the schedule does not. An operator applies each one by hand from `/admin/therapists`.
Record how long that takes: it is the first thing to build after the beta.

Also: fund a company pot with the **$200 welcome credit**, drain it, and capture the moment it
empties. 🔴 **The patient's screen must say "Account on hold, ask HR to activate"**, not a
payment error, and HR must be alerted at the same moment.

🔴 **And one arithmetic check that outranks every defect in the log.** `T1` compares one
month of her session earnings against her $100 bill, on her own screens. At $20 a session,
ten sessions earns her $200 against it. The plan's central promise is that a therapist's
earnings cover their subscription. **If that is not visibly true, the plan is wrong**, and no
number of working screens makes up for it.

```bash
npm run plan                     # the five scenarios, with the counts you just measured
```

### Step 8d · 🔴 The four standing agents that are new

They are not extras and they do not run at the end. Three of them run **during** the waves.

| Agent | When | What it produces |
|---|---|---|
| **Payments operator** | continuously | Works `/admin/transfers`. Types the bank details in, moves everybody to the `eg` entity, confirms real transfers and **rejects one with a reason in its own words** |
| **Business strategist** | once per wave | One note a month, at most a page, read off the operator's own screens. What changed that nobody planned for, which number is moving the wrong way, what it would do differently |
| **CFO** | after month 3 **and** after month 6 | Tries to break the numbers. Does income minus expenses match the ledger, what is recognised that nobody has paid, what in the pots is somebody else's money, which inputs are still guesses. **The two passes are compared** |
| **CTO** | continuously | `docs/walkthrough-3/DEV-LOG.md`. One entry per defect, at the moment it was hit, with `Blast` and `Fix later`. **Fixes nothing during the run** |

🔴 **All four work by clicking.** No standing agent writes SQL or calls a server action
directly. An agent that reached around the product cannot find the defect it was launched to
find, and three of these four exist to be the first person ever to use a screen.

### Step 9 · The report

`docs/walkthrough-3/REPORT.md`. What is in it is listed in `00-START-HERE.md`.

## What is already built, so you do not rebuild it

| | |
|---|---|
| `npm run simulate:seed` | The operator, the four applications, the copilot quota. Already run |
| `npm run age` | Wave ageing, with `verify:age` proving the past moves and the future does not |
| `npm run spend` | The budget guard, over real rows |
| `npm run copilot:exam` | The memory test |
| `npm run smoke` | Every public page, every locale, 200 with words on it |
| `npm run verify:boundary` | Nothing hands a function to a client component |
| `npm run physics` | Fits the two-term session cost model. Refuses one duration cluster |
| `npm run verify:synthetic` | Proves every person is invented, so the console can be committed |
| `npm run forecast` | The thirty-six month model, four scenarios, from the command line |
| `npm run plan` | The operating plan: Egypt, the $20k, the offer, five scenarios |
| `npm run verify:plan` | 25 checks that the plan says which numbers are guesses |
| `npm run verify:finance` | 30 checks that the forecast is pure, reconciles, and cannot move a price |
| `npm run verify:rail` | 52 checks on the Egyptian rail: nothing is granted before a person confirms, and every column that decides which rail somebody is on can be set through a screen |
| `npm run verify:entitlement` | 13 checks, **against a real database**: subscribing by transfer bills but grants nothing, confirming grants, lapsing takes it away, and a mid-month seat change bills what it quoted |

## The five rules, repeated here because they are the whole design

1. **A claim without a database row id did not happen.** Agents report what they did, what
   they photographed, and the row that proves it. The orchestrator checks the row itself.
2. **Act through the product, never around it.** No agent writes to the database.
3. **Every person is unmistakably synthetic.** Surname Demo or Example, address at
   `example.com`. These frames are committed and go in a video.
4. **Never production.** The write scripts refuse it by name. If one refuses, read why.
5. **Do not fix defects during the run.** Write them down and carry on.

## Three things this run has that the last one did not

| | |
|---|---|
| 🔴 **The Egyptian rail, end to end** | A patient, a therapist and a company all paying by bank transfer, and an operator confirming each one by hand. Built in sprints 73 and 74, **never carried a payment**. `09-THE-RAIL.md`, and six numbered things it must put through it |
| 🔴 **Expenses beside income** | `/admin/vault` prints subscriptions, session fees, income, model spend and what was left over, per month. Until C349 the chart and the card on that page disagreed about what income meant |
| 🔴 **Egypt's crisis line** | `lib/crisis/line.ts` now holds 105, with the instruction to press 1 for Arabic and then 1 for mental health. Photograph it in Arabic, as Layla. That button was empty in the first market from the day the product opened |
| 🔴 **The rejection cycle** | A therapist rejected twice, documents deleted, locked out, invited by a practice, **still refused**, finally approved. Thirteen steps in `01-SEED.md` |
| 🔴 **Months 4 to 6** | The full-price invoice, a lapse back to metered, a mid-month upgrade billed for the days it bought, a pot running dry with the patient told to ask HR, and one person cancelling. None of it has ever happened |

## Known environment limits, so they are not filed as bugs

| What | Status |
|---|---|
| OpenAI | **Live, and capped at $10.** If notes do not generate, check `npm run spend` before filing a defect |
| Daily | Live |
| Stripe | Test mode, deliberately |
| Egypt card payments | **There is no gateway.** That is not a limitation to work around, it is the product: money arrives by transfer and an operator confirms it. See `09-THE-RAIL.md` |
| The pounds-per-dollar rate | An operator's setting, default **50**, not a market feed. `quoteFor` refuses a static rate in production for a good reason, so a rail built on it would have no price to show anybody |
| Email and WhatsApp codes | 🔴 **Assumed delivered.** The codes agent reads the real code and types it into the real form. Every agent tries one wrong code first and reports the refusal |
| Blob storage | Not configured. **Document upload is simulated only as far as the form goes**, which matters for `T4`: his rejection cycle turns on documents being deleted, so record what the row says rather than what storage did |
| Dates in Arabic | A known gap. Photograph it anyway |

**A clean report would mean you did not look.**
