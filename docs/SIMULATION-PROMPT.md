# The six month simulation: the prompt for a fresh session

Paste everything below the line into a new session. Nothing above it is part of the prompt.

**Before you paste it, two things:**

1. **Top up OpenAI with $10.**
2. **Paste your keys into the block at the top of the prompt**, replacing the placeholders. You
   do not need to touch any file: the new session writes `.env.local` itself as its first act.

**Rotate every key when the run is done.** They will have been in a chat transcript.

---

## KEYS. Replace the first four lines, then send the whole message.

```
OPENAI_API_KEY=sk-paste-yours-here
DAILY_API_KEY=paste-yours-here
STRIPE_SECRET_KEY=sk_test_paste-yours-here
BLOB_READ_WRITE_TOKEN=paste-yours-here
DATABASE_URL=postgresql://neondb_owner:npg_nBpWM0F5DVLc@ep-empty-queen-a62vlkkp-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

**Your first action, before reading anything else: write those five lines into `.env.local` in
the repository root, and add nothing else to that file.** The fifth is already correct and is in
the block so the database survives a new shell: an `export` does not, and a script that silently
falls back to another database is the worst possible way to discover that.

If any of the first four still says "paste-yours-here", **stop and say so.** A run that starts
without a funded key produces six months of empty notes and spends an afternoon doing it.

`STRIPE_SECRET_KEY` must begin `sk_test_`. **If it begins `sk_live_`, stop**: this run moves money
through every path it can find, and a live key would move real money.

`BLOB_READ_WRITE_TOKEN` is **not optional**. Without it a payer who attaches a receipt to a bank
transfer gets a hard failure and **loses the whole payment claim**, which is a defect the run
would spend an hour chasing. With it, receipts upload and the payments operator opens them
through a route that audits the read.

---

You are running a six month simulation of 24Therapy: a swarm of agents behaving as real people,
using the real product, producing a database that looks like half a year of trading and a folder
of screenshots that proves it.

**Read these nine files from the repository first, in this order, before doing anything:**

```
docs/simulation/00-START-HERE.md   the shape, the five rules, the order of work, the $10 budget
docs/simulation/01-THE-CAST.md     21 people, 4 organisations, 6 waves, and how often each patient comes
docs/simulation/02-THE-SWARM.md    who launches what, how a claim is verified, what to do at a wall
docs/simulation/03-THE-MONEY.md    what we charge, what it costs, and the cycle month by month
docs/simulation/04-THE-RAIL.md     how money reaches us in Egypt: a transfer and a person checking it
docs/simulation/05-CAPTURE.md      what is photographed, when, and where it goes
docs/simulation/06-AGEING.md       how six months happens in one afternoon
docs/simulation/07-THE-EXAM.md     what the copilot knows, and whether it learned
docs/simulation/08-THE-NUMBERS.md  what the run hands the plan, and what it can never measure
```

They are one design in nine documents. **Do not start until you have read all nine.**

**And read `docs/FINANCIAL-PLAN.md` once before you begin.** It is not part of the run; it is the
business this run is a rehearsal of. Everything the simulation captures is evidence for or
against something in that document.

---

## In one paragraph

Twenty one synthetic people sign themselves up and use the product: seven therapists, seven
patients, a practice manager and her staff, three company HR admins, an integrator and an
operator, across one practice and three companies. **All of them are Egyptian**, which means none
of them can pay by card. They arrive in six waves. Cheap agents act as them. One expensive
orchestrator sequences them and **verifies every claim against the database rather than believing
the agent that made it.** Between waves a script ages the rows that wave created, so at the end
the database holds six months of history produced in one afternoon by real interactions with the
real product. Screenshots are taken at months 0, 1, 3 and 6, per person, on the same screens each
time. Then the copilot sits an exam about every one of those patients.

## The four things that make this run different from the last one

**It is six months, and the second half is the point.** Three months ends inside the beta, when
everything is free and everybody is happy. **Month 4 is when the first full price invoice goes
out**, and what people do that week is the number the whole plan turns on.

**Everybody is Egyptian, so there is no card rail.** `topUpPot` refuses `entity = 'eg'` and it is
right to. Money reaches us by InstaPay or bank transfer: the payer claims it on their own screen,
and **nothing moves until an operator confirms it.** That rail has never carried a real payment
and it is the largest surface this run exercises.

**Eight standing agents, five of them new.** A payments operator working the transfer queue by the
minute, a business strategist writing one note a month off the operator's own screens, a CFO after
month 3 and again after month 6, a CTO keeping the dev log, and **an agent who does nothing for
six months but watch `/admin/tv`** and screenshot it every week. All of them work by clicking.

**The board is new and it is the screen the founders run the company from.** Nine collapsible
dashboards on `/admin/tv`: money in and owed, every company and what its pot holds, every practice
and its seats, every clinician and **which way they pay us**, sessions, model spend by kind, the
transfer queue with the longest wait in it, people, and every recorded act by category. Each
section refreshes on its own and each ends in a door to the page that manages it. The joke it
exists to make true is *"I run the company by sitting back and watching TV."* **The run finds out
whether it is.**

---

## What we charge, and the run bills against exactly this

| | |
|---|---|
| A session | **1,000 EGP, about $20** |
| Our cut of what the patient paid | **15%**, on paid sessions only |
| Metered: the room | **$1 a session**, on **every** session. Paid, free, radar, invite, in person |
| Metered: the note | **$3 more**, and **only** where the patient consented |
| So metered is | **$4 a session**, or **$1** where consent was declined |
| Solo plan | **$80 a month**, one therapist, no per session charge at all |
| Clinic plan | **$72 a seat**, minimum two, so $144. Ten per cent under solo |
| The offer | Month 1 free, months 2 and 3 at **half price** ($40 solo, $36 a seat), full price after |
| Joining in months 4 to 6 | **One free month, then full price.** No half price |
| After the offer ends | **Nothing.** No grandfathering, no permanent discount, no second offer |
| A company's welcome credit | **$100**, which is about fifty sponsored sessions at 10% coverage |
| Pounds to the dollar | **50**, an operator's setting on `/admin/settings`, edited daily |

**The two charges are separate and the run must show both.** The cut is on what the patient paid;
the room and note fees are on the session existing at all. A free first session still bills $1 and
$3, and an in person session where nobody paid anything still bills $1 and $3. **An invoice that
shows only one of them is a defect.**

**A subscriber pays neither per session charge.** That is the whole of what $80 buys. The
therapist's own screens must make it true: at 15 sessions she earns $300, we take $45, she pays
$80, **she keeps $175.** Her earnings screen shows **$255**, not $300, because the 15% has already
come out. **A check that compares against the gross number will report a defect that is not one.**

---

## The budget is $10 and it must not run out halfway

| | |
|---|---|
| Sessions | **62** over six months: **42 at 3 minutes and 20 at 8**, never one length |
| Total audio | **286 minutes** |
| Planned model spend | **≈ $4.80** |
| Left over | **≈ $5.20**, which is headroom, not a licence to add sessions |
| In session copilot | capped at **4** messages. Already set on the branch |

**Doubling the months did not double the bill, and that is not luck.** Model spend tracks the
session count, not the calendar. Three more months of trading is twenty seven more sessions, about
a dollar. Everything else months 4 to 6 contain calls no model at all. **So there is nothing to
save by compressing the run back to three months**, and what would be lost is the only part that
shows what happens when the free month ends.

**The two session lengths must not be flattened.** Session cost is `FIXED + VARIABLE x minutes`;
the fixed half is 52% of a 3 minute session and 6% of a 50 minute one, so multiplying a short
session to reach a long one **overstates it by 95%**. Two unknowns need two measurements, and
`lib/finance/physics.ts` **refuses** to fit a single cluster rather than returning a confident
wrong number.

```
npm run spend -- --budget 10
```

**After every wave, without exception.** It sums what the product actually spent, warns at 70% and
exits non zero past the line. `01-THE-CAST.md` says what to cut first if it runs ahead. The one
thing never to cut is `P3` Mostafa's weekly cadence: he is the entire top of the copilot exam's
ladder and the whole long cluster the cost model is fitted from.

---

## The database branch, made, migrated, seeded and ready

On it already:

| | |
|---|---|
| Schema | Migrated to 0106, journal and ledger agreeing, every CHECK validated |
| Settings | The rate table, the countries, the prices |
| Public site | Published, and every page and locale pair renders |
| Operator | `nour.example@example.com` / `Simulation2026!`, super admin |
| Waiting in his queue | Nile Practice, Cairo Foundry, Alexandria Textiles, Delta Logistics. **All four held, none approved, all four on the `us` entity** |
| People | **Zero** therapists, zero patients, zero sessions. They sign themselves up |
| The transfer details | **Empty.** An operator types the bank account in on camera, in wave 1. A seeded one would be a bank account in this repository and a screen nobody walks |
| Spent | **$0.00** |

**Confirm that yourself before you trust this paragraph.** A prompt that says a database is ready
is exactly the kind of claim rule 1 exists to distrust. Step 1 is how.

---

## What you report back, and when. Do not save it all for the end

The person who pasted this is not watching a terminal for four hours. **Report upward at seven
fixed points**, each short enough to read on a phone.

| When | What, in at most eight lines |
|---|---|
| After step 2 | The branch and the product are what this prompt claimed, or they are not. **Say plainly if anything is red before a single agent has acted** |
| After step 3b | The rail is open: the bank details are in, three companies and the practices moved to `eg`. The first thing that has ever done it |
| End of each wave, six times | One table: sessions so far, the depth ladder (`P3` against `P6`), `npm run spend` against $10, defects this wave, and **anything an agent is blocked on** |
| After wave 4 | **The full price invoice.** Whether it rendered with no discount line, and what the therapists did. The single most important moment in the run |
| After the exam | The mark per patient, and whether a thicker record really made a better copilot |
| After the CFO's second pass | The money end to end, with the month 3 pass beside it |
| At the end | The report, the dev log, and the things the plan still cannot know |

### Three things to say immediately, without waiting for a checkpoint

1. **The spend passes 70% of $10.** The moment `npm run spend` warns, with what is left to do. **Do
   not decide alone to cut the run.**
2. **An agent is blocked and cannot resume.** One block, the screen, and what it needs.
3. **A defect that would lose somebody money or expose a record.** Everything else goes in the log
   and waits. These two do not.

---

## Step by step, from a cold start

### Step 1 · Write the keys, point at the branch, check it

```bash
# 1. Write .env.local from the KEYS block above. Nothing else in it.

# Scripts do NOT read that file themselves, so export it once per shell from the same value:
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)

npm run verify:migrations      # journal and ledger agree, every CHECK validated
npm run simulate:seed          # MUST REFUSE: "already has an operator". That refusal is the proof
npm run verify:age             # 8 checks. The ageing script obeys its own rule
npm run verify:synthetic       # 5 checks. Every person here is invented
npm run physics                # says there is nothing to fit yet. After the run it says otherwise
npm run spend -- --budget 10   # $0.0000, 0.0% used
```

**If `simulate:seed` does not refuse, you are pointed at the wrong database. Stop.**

### Step 2 · Check the product, before twenty agents tell you it is broken

```bash
npm run build
npm run gates
```

Eleven gates: prose, claims, principals, i18n, boundary, renders, finance, plan, rail,
entitlement, board.

`renders` starts the built app and fetches every public page. It exists because `/pricing`
answered 500 in production for seven sprints and nothing asked. **`entitlement` is the only one
that writes**: it makes a throwaway practice, subscribes it by transfer, checks it is NOT on the
plan until a confirmation, checks it IS after, and deletes the lot in a `finally`. Three defects
it found were true of the source and false of the database, which is why it exists.

### Step 3 · Mark the start of wave one

```bash
npm run age -- --marker wave1 --start
```

Everything created from this moment is wave one's and ages together. **Do this before any agent
acts.**

### Step 3b · Open the rail, before any money moves

Signed in as the operator, through the browser, not a script:

| Where | What |
|---|---|
| `/admin/settings` | Type the Egyptian bank details in. Until you do, every payer sees "not on the system yet" |
| `/admin/sponsors` | Move all three companies from `us` to `eg` |
| `/admin/clinics`, and each solo therapist's own `/settings` | Move each practice to Egypt |

**Nothing in the Egyptian half of this run works until those are done**, because
`sponsorNeedsTransfer` and `organizationNeedsTransfer` read exactly those columns. The run starts
with the rail shut on purpose: opening it is a photographed act rather than a seeded fact, and
until sprint 74 nothing in the product could do it at all.

### Step 4 · Launch the orchestrator, and through it everybody else

Hand it `02-THE-SWARM.md` and `01-THE-CAST.md`. **Make it report its plan before it launches
anybody.** Six agents awake at most.

```
  YOU  ·  the main session
   │   reads the nine documents, checks the branch, opens the rail, ages each wave,
   │   runs the exam, writes the report, and reports upward to the founder
   ▼
  THE ORCHESTRATOR  ·  one agent, the most capable one available
   │   owns the wave clock. Wakes agents, sequences them, VERIFIES EVERY CLAIM
   │   against the database, watches the depth ladder and the spend
   │
   ├── 8 standing agents, awake for the whole run ────────────────────────────
   │     growth and operations   approvals, the verification queue, T4's rejection cycle
   │     money                   03-THE-MONEY.md, every wave, income AND expenses
   │     codes                   reads real codes so twenty agents do not each improvise
   │     payments operator       /admin/transfers, by the minute. 04-THE-RAIL.md
   │     Total View watcher      /admin/tv, weekly, for six months. Does nothing else
   │     business strategist     one note per month, off the operator's own screens
   │     CFO                     after month 3, and again after month 6. The two are compared
   │     CTO                     the dev log. Fixes nothing during the run
   │
   ├── 20 cast agents, one per person, woken for their wave and then idle ────
   │     7 therapists · 7 patients · 1 practice manager · 1 practice staff
   │     3 company HR admins · 1 integrator
   │
   └── the capture agent, at the end of every wave ───────────────────────────
         05-CAPTURE.md. Runs BEFORE the ageing, never after
```

**Cheap agents do the acting. One expensive agent keeps them honest. You supervise the one that
keeps them honest.**

**Every one of them works by clicking.** No agent writes SQL, calls a server action directly, or
runs a script that changes a row. They sign in on the sign in form and press the buttons. An agent
that reached around the product cannot find the defect it was launched to find, and five of the
eight standing agents exist to be the first person ever to use a screen.

#### What every agent reports, in this shape and no other

```
DID: booked a session with T2 for Thursday 14:00
SAW: docs/simulation-run/m1/p2-salma/booking-confirmed.png
ROW: availability_slots id 8f3e… state=booked session_id=41ba…
```

**The orchestrator verifies `ROW` against the database itself.** An agent's word is an input,
never a fact. An agent that cannot produce a row id did not do the thing, and it is re tasked
rather than recorded as a success.

#### When an agent hits a wall: pause, report, wait, resume

It does **not** restart from scratch and it does **not** work around the product. It stops, writes
one block naming the screen, what it expected, what it got, and **the step to resume from**, and
waits. `02-THE-SWARM.md` has the exact shape. An agent that restarts loses everything the wave
built; an agent that works around the product destroys the only thing this exercise produces.

### Step 5 · Each wave, in this order, six times

```bash
# 1. the wave acts, agents report DID / SAW / ROW, the orchestrator verifies every ROW
# 2. the capture agent runs                           (05-CAPTURE.md)
npm run spend -- --budget 10                        # 3. the number, before anything moves
npm run age -- --marker wave1 --days 180            # 4. only now, and only after the capture
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

**Never age before the capture.** The frames would show the wrong dates and cannot be retaken.

### Step 5b · The copilot progression test, which runs DURING the waves

The exam in step 6 runs once at the end and answers "how much does it know". It cannot answer
**"did it learn"**, and learning is the claim. So ask `P3` Mostafa's copilot the same question,
word for word, three times:

| After | Sessions behind it |
|---|---|
| Wave 1 | **1** |
| Wave 2 | **4** |
| Wave 4 | **10** |

**Capture all three replies in full, quoted.** A copilot that says "he has stopped mentioning work
since the third session" has a model of a person over time; one that says "he discusses family and
work" has a good summariser. Both read well and only one is the product.

Then at month 6, four recall questions whose answers each live in a different month, plus two with
**no answer in the record at all**. `07-THE-EXAM.md` has all of them. About $0.05.

### Step 6 · The exam, and the cost model

```bash
npm run copilot:exam -- --dry                                      # who is about to be examined
npm run copilot:exam -- --json docs/simulation-run/COPILOT.json    # ≈ $0.36

npm run physics -- --at 50 --json docs/simulation-run/PHYSICS.json # free, reads rows
```

**`physics` must fit every kind with no refusals.** A refusal means the durations came out flat
and the cost model that follows this run cannot be built from it. It prints the measured short
session, the two term figure for fifty minutes, and the number naive multiplication would have
given, side by side.

Half the exam's questions are about things the record does **not** contain, and a copilot that
answers those is failing worse than one that forgets. **Report the correlation whichever way it
comes out.**

### Step 7 · The accuracy figures, only if there is money left

```bash
npm run spend -- --budget 10
npm run evals -- --record      # ≈ $2.00. Only if the line above leaves room
```

If it does not, write "not re recorded, no budget" in the report. That is a better sentence than a
simulation that stopped in wave two.

### Step 8 · The console, photographed in full

```bash
npm run verify:synthetic       # MUST pass immediately before you commit any operator frame
```

**All 25 admin pages, at month 6, committed.** C80 said admin frames are never committed and its
reason was real names; this run has none, and `verify:synthetic` proves it rather than assuming
it. `05-CAPTURE.md` lists every page and what each frame has to show.

**Five of the 25 are `requireStaff()`** (verifications, transfers, payouts, numbers, support) and
one is `requireManager()` (tv). Photograph those signed in as **staff**, not as the owner, or the
capture shows a console nobody on the rota actually sees.

### Step 8b · The numbers

```bash
npm run physics -- --at 50       # the two terms, from this run's own rows
npm run plan                     # the operating plan: three scenarios
npm run plan -- beta-cliff       # the six months, month by month
npm run forecast                 # the abstract 36 month growth model
```

Then on `/admin/financial-model`, signed in as the operator: type a label into **Measure and
freeze** and press it. It writes one row to `finance_benchmarks` and never updates it, so the
figure is reproducible later. Photograph the page **after** that, so the provenance bar says this
database rather than the shipped estimate.

**`08-THE-NUMBERS.md` is the whole brief for this step**, including the four things the run can
never establish (churn, acquisition cost, card fees, video cost) and the rule that a short session
cost is never quoted as unit economics.

### Step 8c · The offer, and the invoice that decides everything

Four invoices have to exist and be photographed:

| | |
|---|---|
| The free one | Wave 1, a therapist's first invoice. **Zero, and it says why.** An invoice that is simply absent is indistinguishable from a billing bug |
| The half price one | A wave later. List price, discount line and payable amount, **all three visible** |
| **The full price one** | **Wave 4.** A cohort reaches its fourth month and is billed with no discount line at all |
| The post beta one | `T5` and `T6` join in months 4 and 5 and get **one free month, then full price.** Two people see it, so it reads as a rule |

The third is the single most important frame in the run. The plan assumes a quarter to two fifths
of therapists leave at that moment, and that guess moves break even either way. **The run cannot
tell you whether a real therapist would pay. It can tell you whether the product bills them
correctly, which is the half that is our fault if it is wrong.**

**Automatic promotional billing is not built.** `discount_cents` and `discount_reason` exist; the
schedule does not. An operator applies each one by hand from `/admin/therapists`. **Record how long
that takes**: it is the first thing to build after the beta.

Also: fund a company pot with the **$100 welcome credit**, drain it, and capture the moment it
empties. **The patient's screen must say "Account on hold, ask HR to activate"**, not a payment
error, and HR must be alerted at the same moment.

**And one arithmetic check that outranks every defect in the log.** `T1` compares one month of her
session earnings against her **$80** bill, on her own screens, **net**. Fifteen sessions at $20
earns $300, we take $45, and her screen shows **$255**. An agent comparing against $300 will report
a defect that is not one. The central promise is that a therapist's earnings cover their
subscription. **If that is not visibly true, the plan is wrong**, and no number of working screens
makes up for it.

### Step 9 · The report

`docs/simulation-run/REPORT.md`. What is in it is listed in `00-START-HERE.md`.

---

## What is already built, so you do not rebuild it

| | |
|---|---|
| `npm run simulate:seed` | The operator, the four applications, the copilot quota. Already run |
| `npm run age` | Wave ageing, with `verify:age` proving the past moves and the future does not |
| `npm run spend` | The budget guard, over real rows |
| `npm run copilot:exam` | The memory test |
| `npm run physics` | Fits the two term session cost model. Refuses one duration cluster |
| `npm run verify:synthetic` | Proves every person is invented, so the console can be committed |
| `npm run smoke` | Every public page, every locale, 200 with words on it |
| `npm run plan` | The operating plan: Egypt, the $20k, the offer, three scenarios |
| `npm run forecast` | The abstract 36 month model, four scenarios |
| `npm run verify:plan` | 36 checks that the plan says which numbers are guesses, and that the six months break even before month 6 |
| `npm run verify:finance` | 30 checks that the forecast is pure, reconciles, and cannot move a price |
| `npm run verify:rail` | The Egyptian rail: nothing is granted before a person confirms, and every column that decides which rail somebody is on can be set through a screen |
| `npm run verify:entitlement` | 13 checks **against a real database**: subscribing by transfer bills but grants nothing, confirming grants, lapsing takes it away, and a mid month seat change bills what it quoted |
| `npm run verify:board` | 16 checks on `/admin/tv`: all nine sections run, none of them writes, and due money is never counted as collected |

---

## The five rules, repeated here because they are the whole design

1. **A claim without a database row id did not happen.** Agents report what they did, what they
   photographed, and the row that proves it. The orchestrator checks the row itself.
2. **Act through the product, never around it.** No agent writes to the database.
3. **Every person is unmistakably synthetic.** Surname Demo or Example, address at `example.com`.
   These frames are committed and go in a video.
4. **Never production.** The write scripts refuse it by name. If one refuses, read why.
5. **Do not fix defects during the run.** Write them down and carry on.

---

## Known environment limits, so they are not filed as bugs

| What | Status |
|---|---|
| OpenAI | **Live, and capped at $10.** If notes do not generate, check `npm run spend` before filing a defect |
| Daily | Live |
| Stripe | Test mode, deliberately |
| Egypt card payments | **There is no gateway.** Not a limitation to work around: it is the product. Money arrives by transfer and an operator confirms it |
| The pounds per dollar rate | An operator's setting, default **50**, not a market feed |
| Email and WhatsApp codes | **Assumed delivered.** The codes agent reads the real code and types it into the real form. Every agent tries one wrong code first and reports the refusal |
| Blob storage | **Configured.** Receipts and identity documents upload for real. `T4`'s rejection cycle turns on documents being deleted, so check the row **and** that the blob is gone |
| Dates in Arabic | A known gap. Photograph it anyway |
| Promotional billing | Manual. An operator applies each discount from `/admin/therapists` |

**A clean report would mean you did not look.**
