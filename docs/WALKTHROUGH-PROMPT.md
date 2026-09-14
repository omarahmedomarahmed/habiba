# The three-month simulation: the prompt for a fresh session

Paste everything below the line into a new session. Nothing above it is part of the prompt.

**Before you paste it, one thing:**

**Top up OpenAI with $10.** Then paste your keys into the block at the top of the prompt
below, replacing the placeholders. You do not need to touch any file: the new session writes
`.env.local` itself as its first act.

Rotate both keys when the run is done. They will have been in a chat transcript.

---

## 🔴 KEYS. Replace these three lines, then send the whole message.

```
OPENAI_API_KEY=sk-paste-yours-here
DAILY_API_KEY=paste-yours-here
STRIPE_SECRET_KEY=sk_test_paste-yours-here
```

**Your first action, before reading anything else: write those three lines into
`.env.local` in the repository root, and add nothing else to that file.** Then confirm it
with `npm run spend -- --budget 10`, which needs a database and not a key, and with a single
cheap call once you reach step 2.

If any of the three still says "paste-yours-here", **stop and say so**. A run that starts
without a funded key produces three months of empty notes and spends an hour doing it.

`STRIPE_SECRET_KEY` must begin `sk_test_`. If it begins `sk_live_`, stop: this simulation
moves money through every path it can find and a live key would move real money.

---

You are running a three-month simulation of 24Therapy: a swarm of agents behaving as real
people, using the real product, producing a database that looks like a quarter of trading
and a folder of screenshots that proves it.

**Read these seven files from the repository first, in this order, before doing anything:**

```
docs/simulation/00-START-HERE.md    the shape, the five rules, the order of work, the $10 budget
docs/simulation/01-SEED.md          the cast: 22 identities, 3 waves, and how often each patient comes
docs/simulation/02-ORCHESTRATION.md the swarm: who launches what, how claims are verified
docs/simulation/03-MONEY.md         income, expenses, and Egypt, which has no card rail
docs/simulation/04-CAPTURE.md       what is photographed, where it goes, the video scripts
docs/simulation/05-AGEING.md        how three months happens in one hour
docs/simulation/06-COPILOT-EXAM.md  the test at the end: what the copilot really knows
```

They are one design in seven documents. **Do not start until you have read all seven.**

## In one paragraph

Twenty-two synthetic people sign themselves up and use the product: five therapists, six
patients, a practice, three employers, an integrator and an operator. They arrive in three
waves. Cheap agents act as them. One expensive orchestrator sequences them and **verifies
every claim against the database rather than believing the agent that made it**. Between
waves, a script ages the rows that wave created, so at the end the database holds three
months of history produced in one hour by real interactions with the real product.
Screenshots are taken at month 0, 1 and 3, per person, on the same screens each time. Then
the copilot sits an exam about every one of those patients.

## 🔴 The budget is $10 and it must not run out halfway

| | |
|---|---|
| Sessions | **35**: 🔴 **24 at 3 minutes and 11 at 8**, not one length |
| Total audio | 160 minutes |
| Planned model spend | **≈ $3.25** |
| Left over | **≈ $6.75**, which is headroom, not a licence to add sessions |
| In-session copilot | capped at **4** messages. Already set on the branch |

🔴 **The two session lengths are not a detail and must not be flattened.** Session cost is
`FIXED + VARIABLE x minutes`; the fixed half is 61% of a 3-minute session and 9% of a
50-minute one, so multiplying a short session to reach a long one **overstates it by 100%**.
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
| Schema | Migrated 0000 to 0100. 101 journal, 101 ledger, 112 tables, 249 foreign keys, every CHECK validated |
| Settings | 9 groups, 2 countries, the rate table |
| Public site | 14 published pages. All 24 page-and-locale pairs render |
| Operator | `nour.example@example.com` / `Simulation2026!`, super admin |
| Waiting in his queue | Nile Practice, Cairo Foundry, Thames Analytics, Delta Logistics. **All four held, none approved** |
| People | **Zero** therapists, zero patients, zero sessions. They sign themselves up |
| Spent | **$0.00** |

**Confirm that yourself before you trust this paragraph.** A prompt that says a database is
ready is exactly the kind of claim rule 1 exists to distrust. Step 1 below is how.

## 🔴 Step by step, from a cold start

### Step 1 · Write the keys, point at the branch, check it

```bash
# 1. Write .env.local from the KEYS block at the top of this message. Nothing else in it.

export DATABASE_URL='postgresql://neondb_owner:npg_nBpWM0F5DVLc@ep-empty-queen-a62vlkkp-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require'

npm run verify:migrations      # 101 journal, 101 ledger, 112 tables
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
npm run gates                  # prose · claims · principals · i18n · boundary · renders
```

Six gates. `renders` starts the built app and fetches all 24 public pages; it is there
because `/pricing` answered 500 in production for seven sprints and nothing asked.

### Step 3 · Mark the start of wave one

```bash
npm run age -- --marker wave1 --start
```

Everything created from this moment is wave one's and ages together. **Do this before any
agent acts.**

### Step 4 · Launch the orchestrator

Hand it `02-ORCHESTRATION.md` and `01-SEED.md`. Make it report its plan before it launches
anybody. Six agents awake at most. Wave one is seven identities: the operator, four
therapists and two patients.

### Step 5 · Each wave, in this order, three times

```bash
# 1. the wave acts, agents report DID / SAW / ROW, the orchestrator verifies every ROW
# 2. the capture agent runs                           (04-CAPTURE.md)
npm run spend -- --budget 10                        # 3. the number, before anything moves
npm run age -- --marker wave1 --days 90             # 4. only now, and only after the capture
npm run verify:migrations                           # 5. did the shift break an ordering constraint
npm run age -- --marker wave2 --start               # 6. open the next wave
```

Wave 1 ages by **90** days, wave 2 by **60**, wave 3 not at all. Wave 3 is today.

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

🔴 **All 23 admin pages, at month 3, committed.** C80 said admin frames are never committed
and its reason was real names; this run has none, and `verify:synthetic` proves it rather
than assuming it. `04-CAPTURE.md` lists every page and what each frame has to show.

**Four of the 23 are `requireStaff()`** (verifications, payouts, numbers, support).
Photograph those signed in as **staff**, not as the owner, or the capture shows a console
nobody on the rota actually sees.

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
| 🔴 **The rejection cycle** | A therapist rejected twice, his documents deleted, locked out, invited by a practice, **still refused**, and finally approved after reapplying. Thirteen steps in `01-SEED.md`. Built in sprint 69 (C351), never exercised |
| 🔴 **Expenses beside income** | `/admin/vault` prints subscriptions, session fees, income, model spend and what was left over, per month. Until C349 the chart and the card on that page disagreed about what income meant |
| 🔴 **Egypt's crisis line** | `lib/crisis/line.ts` now holds 105, with the instruction to press 1 for Arabic and then 1 for mental health. Photograph it in Arabic, as Layla. That button was empty in the first market from the day the product opened |

## Known environment limits, so they are not filed as bugs

| What | Status |
|---|---|
| OpenAI | **Live, and capped at $10.** If notes do not generate, check `npm run spend` before filing a defect |
| Daily | Live |
| Stripe | Test mode, deliberately |
| Egypt card payments | **There is no gateway and the product refuses honestly.** That refusal is correct behaviour and is captured, not worked around. See `03-MONEY.md` |
| Email and WhatsApp codes | 🔴 **Assumed delivered.** The codes agent reads the real code and types it into the real form. Every agent tries one wrong code first and reports the refusal |
| Blob storage | Not configured. **Document upload is simulated only as far as the form goes**, which matters for `T4`: his rejection cycle turns on documents being deleted, so record what the row says rather than what storage did |
| Dates in Arabic | A known gap. Photograph it anyway |

**A clean report would mean you did not look.**
