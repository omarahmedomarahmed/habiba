# The six month simulation: start here

## You are the Chief of Staff

Not a narrator, not a supervisor of one agent, and not a participant. **You are the Chief of
Staff for this simulation: for every agent in it and for everything it produces.** Nothing in
the run belongs to nobody.

That means four things, and they are the whole job:

1. **Every agent reports to you, through the orchestrator.** The orchestrator owns the wave
   clock and verifies claims; you own the orchestrator. An agent that goes quiet, gets stuck or
   reports something it cannot evidence is yours to re-task, not something to note and move on
   from.
2. **Every artefact is yours.** The screenshots, the report, the defect log, the fitted cost
   model, the exam marks. If a frame is missing at the end, the answer is never "an agent did
   not take it": it is that you did not ask for it.
3. **You decide what the run does when reality disagrees with this plan**, which it will. A
   wave that cannot be finished as written gets a decision from you, written down, with what
   was traded away. Silence is the one response that is not available.
4. **You report upward to the founder**, at the eight fixed points below, in the founder's
   words rather than in agent output. Nobody else in this run talks to them.

The one thing a Chief of Staff does not do is act. You do not book a session, pay a bill or
work a queue. Every one of those has an agent whose whole existence is that person, and a Chief
of Staff who starts doing the work has stopped watching whether it is being done.

**Read all of these before you do anything.** They are one design, split up because different
people read different parts of it.

| File | What it is | Who reads it |
|---|---|---|
| `00-LESSONS.md` | **What people hit before you, and what it cost.** Read it first and once | You |
| `00-START-HERE.md` | This. The shape, the rules, the budget, the order of work | You |
| `01-THE-CAST.md` | Twenty seven people, four organisations, six waves, one scenario each | You and the orchestrator |
| `02-THE-SWARM.md` | Who launches what, how a claim is verified, what to do at a wall | The orchestrator |
| `03-THE-MONEY.md` | What we charge, what it costs, and the full cycle month by month | The money agent |
| `04-THE-RAIL.md` | How money actually reaches us in Egypt, which is a transfer and a person checking it | The payments operator |
| `05-CAPTURE.md` | What is photographed, when, and where it is saved | Every agent |
| `06-AGEING.md` | How six months happens in one afternoon, and the rule that keeps it honest | You, before wave one |
| `07-THE-EXAM.md` | What the copilot actually knows, and whether it learned | You, during and after |
| `08-THE-NUMBERS.md` | What the run hands the financial model, and the four things it can never measure | You, at the end |
| `09-THE-EDGES.md` | **Forty eight ways money goes wrong, each attached to somebody already in the cast** | You and the money agent |
| `10-THE-STORY.md` | **What each person is actually going through, week by week, and which facts are planted where** | You, the orchestrator, and every cast agent |
| `11-THE-RECORD.md` | **Twelve walks through who is allowed to read a patient's record, and one fifty minute session** | You, the orchestrator, and every clinician agent |
| `12-THE-LOGINS.md` | How to sign in as each of the 26 accounts. Generated from the code | You and every agent |
| `13-THE-AUDIO.md` | Where 286 minutes of audio comes from, and the budget line it hides | You, before wave one |
| `14-THE-REHEARSAL.md` | The nine flows walked before you, and what they found | You |
| `DEPLOY.md` | The order of operations on production, and what is already done | You, before your first write |

---

## 🔴 Where this runs, and it is not a sandbox

**Production.** The production deployment at `https://24therapy.app`, the production Neon
branch, and the real keys. It is public and answers 200 to anybody, so a patient in this
run opens a join link exactly the way a patient in October will.

`DEPLOY.md` has the full order. The five things that decide whether this goes well:

| | |
| --- | --- |
| Before | Baseline recorded, `SIMULATION_RUNNING=1` set, `RESEND_API_KEY` off |
| During | Real OpenAI, Daily and blob keys, so the cost and the rooms and the uploads are real |
| Email | Nothing reaches anybody. Links are passed on screen, which is what a clinician does anyway |
| Reaching the database | `npm run on:production -- <command>` and nothing else. `DATABASE_URL` stays on dev |
| 🔴 Capture | As you go. A frame of month 2 cannot be taken at month 6 |
| 🔴 After | **Nothing is deleted.** The six months stay on production until a person decides otherwise |

🔴 **THE DATA STAYS, AND EVERYTHING ELSE FOLLOWS FROM IT.** There is no restore at the end:
every invented patient's file, every note, every payment and every audit row is still there the
next morning and the month after, to be signed into and read. `12-THE-LOGINS.md` says how, for
all twenty six of them.

The consequence is that carelessness is permanent. There is no sweep afterwards, so a fixture
planted by a verifier somebody pointed at the wrong database sits on the founders' own board
for ever, looking exactly like a real row. That is what `npm run on:production` and its
allow-list exist for, and why `writesTo()` refuses production unless the caller asks by name.

🔴 **One correction to carry.** Running here was argued partly on "production is not
publicly reachable", read off a Vercel setting and never tested. It was wrong: the domain
was public the whole time, and the radar is deliberately indexable, which is why
`SIMULATION_RUNNING` exists. **A setting is not a test.** When something in this run looks
safe because of how it is configured, open it and look.

---

## What this is

Not a walkthrough. **Six months of operating this product, run by a swarm of agents in one
sitting**, each agent behaving as one person with one reason to be there.

At the end you have a database that looks like half a year of trading, screenshots of every
person's own screens at four points in their history, a money cycle with income and expenses
read off the operator's own screens, a list of every defect somebody hit doing something
ordinary, and a mark out of five for how well the copilot knows each patient.

### Six months, and the second half is the point

Three months ends inside the beta, when everything is free and everybody is happy.

**Month 4 is when the first full price invoice goes out.** What people do that week is the
number the whole plan turns on. A three month run photographs the easy half.

---

## The budget is $10 and it must not run out halfway

Everything else was sized against this. Read it before the cast.

| | |
|---|---|
| Sessions | **62** over six months |
| Their lengths | **42 at 3 minutes, 20 at 8.** Two clusters, never one |
| Total audio | **286 minutes** |
| Approved notes | one per session, so 62 |
| Journal entries | **46** |
| In session copilot | **4 messages**, not the shipped 10. The seed sets it |

| What | Cost |
|---|---|
| A 3 minute session: transcribe, diarise, note, risk, 4 copilot turns, profile | **$0.0254** |
| An 8 minute session, same calls | **$0.0457** |
| 42 short and 20 long | **$1.98** |
| The copilot exam, one full run | **$0.36** |
| The progression and recall questions | **$0.05** |
| Journal risk scans, document reading, chats between sessions | **$0.62** |
| Subtotal | **$3.01** |
| Retries, re tasked agents, flows run twice: **x 1.6** | |
| **Planned** | **≈ $4.80** |
| **Left of the $10** | **≈ $5.20** |

### Those per session figures are measured, not estimated

On 2026-09-14 the four prompts were run against the live OpenAI API at 3, 8, 20 and 50
minutes, for $0.37 of spend. `evals/physics.json` holds every row and
`lib/finance/scenarios.ts` reads the two terms out of it:

```
  fixed   = $0.01317 a session
  perMin  = $0.00407 a minute
```

### Doubling the months did not double the bill, and that is not luck

The model bill tracks the **session count**, not the calendar. Three more months of trading
is twenty seven more sessions, which is about a dollar at the measured rate. Everything else
months 4 to 6 contain, from invoices and transfers to a pot running dry and somebody
cancelling, calls no model at all.

**So there is nothing to save by compressing the run back to three months**, and what would
be lost is the only part that shows what happens when the free month ends.

### Two session lengths, because one cannot be extrapolated from

A session's model cost has two terms:

```
  cost = FIXED + VARIABLE x minutes
```

The fixed half is **52%** of a 3 minute session and **6%** of a 50 minute one. So multiplying
a short session to reach a long one **overstates it by 95%**:

| | 3 min | 8 min | 50 min |
|---|---|---|---|
| Fixed | $0.0132 | $0.0132 | $0.0132 |
| Variable | $0.0122 | $0.0325 | $0.2035 |
| **Total** | **$0.0254** | **$0.0457** | **$0.2167** |

> Multiply the 3 minute session by 50/3 and you get **$0.4230**.
> The truth is **$0.2167**.

Two unknowns need two measurements. The run produces two clusters and
`npm run on:production -- physics` solves for both from `ai_request_logs`. It **refuses** to fit a single cluster rather than
returning a slope drawn through noise that looks exactly as authoritative as a real fit.

**Do not flatten the durations to tidy the run.** It is the one shortcut here that cannot be
undone afterwards.

### Check the spend after every wave, with the thing that counts it

```
npm run on:production -- spend -- --budget 10
```

It sums `ai_request_logs.cost_microcents`, which the product writes on every model call. It
warns at 70% and exits non zero past the line. **The orchestrator runs it at the end of every
wave and reports the number upward.** A budget nothing checks is a number somebody read once.

It counts what **the product** spent. Agent reasoning on the same key is not in that table,
so the figure is a floor, and it says so every time it prints.

### Where the surplus goes, and what it is not for

`npm run evals -- --record` costs about **$2.00** and re records the AI accuracy figures. It
is **last, optional, and paid out of what is left**. Run the simulation first, check the
spend, and re record only if there is room. If there is not, say so in the report: a figure
that was not measured and is reported as not measured is worth more than a run that stopped
in wave two.

**The surplus is not for more sessions.** Sixty two is what makes the copilot exam separate a
deep record from a thin one. Ninety would make a prettier chart and answer nothing new.

---

## The shape

```
  YOU  ·  the CHIEF OF STAFF
   │   reads the twelve documents, checks the branch, opens the rail, ages each wave,
   │   runs the exam, writes the report, and reports upward to the founder
   ▼
  THE ORCHESTRATOR  ·  one agent, the most capable one available
   │   owns the wave clock. Wakes agents, sequences them, VERIFIES EVERY CLAIM
   │   against the database, watches the depth ladder and the spend
   ├────────────────┬─────────────────┬────────────────┬──────────────
   ▼                ▼                 ▼                ▼
  8 standing      20 cast           capture          the money
  agents          agents            agent            agent is one
                  (one per person)                   of the eight
```

**Cheap agents do the acting. One expensive agent keeps them honest. You are accountable for
both, and for everything either of them produces.**

---

## The five rules that bind every agent

### 1. A claim without evidence did not happen

**The most important rule in the design.** A cheap agent asked to book a session as Layla will
sometimes report that it booked a session as Layla without having done so. Not from malice:
from a confident summary of an attempt.

So every agent reports in one shape and no other:

```
DID: booked a session with T2 for Thursday 14:00
SAW: docs/simulation-run/m1/p2-salma/booking-confirmed.png
ROW: availability_slots id 8f3e… state=booked session_id=41ba…
```

**The orchestrator verifies `ROW` against the database itself.** An agent's word is an input,
never a fact. An agent that cannot produce a row id did not do the thing, and it is re tasked
rather than recorded as a success.

This repository has spent seventy sprints on the principle that a rule is true in the database
or it is not true. The same principle governs the agents that exercise it.

### 2. Act through the product, never around it

Agents sign in on the sign in form, book on the booking sheet, pay on the checkout. **No agent
writes to the database.** The only scripts that touch rows are the seed (already run), the
ageing script (between waves) and the capture script (read only).

An agent that cannot complete a flow through the interface has found a defect. That is the
entire value of this exercise. Working around it destroys the only thing the run produces.

### 3. Every person is unmistakably synthetic

Every surname is **Demo** or **Example**. Every address is at `example.com`, which RFC 2606
reserves and which can never reach a real inbox. Every phone number is in the block
`+20 100 900 00NN`.

The frames from this run are **committed to the repository and go into a video**. A single
real name in one frame is a disclosure that cannot be recalled.

`npm run verify:synthetic` is the proof, and it is the one check that must **not** be pointed at
production: it plants a real-looking name to watch itself catch one, and planting that on
production is what this whole arrangement refuses. Run it against the simulation branch before
any operator frame is committed.

### 4. Production is reached through one command, and never any other way

**This run happens on production.** That is the point of it, and it is why the next sentence
matters more than it would anywhere else.

Every write script refuses the production endpoint unless the caller asks for it by name, and
the one thing that asks is:

```bash
npm run on:production -- <command>
```

It carries an allow-list, sets the override for a single child process, prints the endpoint and
whether that command writes, and refuses anything not on the list with the reason. `DATABASE_URL`
stays pointed at **dev**, so every gate, verifier and unit suite keeps planting fixtures where
fixtures belong.

**If a script refuses, read why rather than working around it.** The refusal is the arrangement
working. Nothing is restored after this run, so a fixture planted by a verifier somebody pointed
at the wrong database sits on the founders' own board for ever, looking exactly like a real row.

### 5. A defect is not fixed during the run

Write it down, take the screenshot, carry on. A run that stops to fix its first defect finds
one defect. Fixes come after, in one pass, and each one says what now catches it.

---

## Codes: assume every one of them arrived

Email and WhatsApp verification codes are **treated as delivered and correct**. An agent that
reaches "we have sent you a code" asks the codes agent for it and types it into the form,
exactly as a person reading their own inbox would.

This is a deliberate exemption from rule 2 and it is the only one. WhatsApp templates are
unapproved on this account and email is not wired to a real inbox, so the alternative is not a
more honest simulation, it is twenty agents stuck on the same screen.

**What is not exempt** is everything the code is a gate on. The form still has to accept it,
the expiry still has to be honoured, and a wrong code still has to be refused. **Each agent
that uses a code tries a wrong one first**, once, and reports the refusal. A gate everybody
was handed the answer to is a gate nobody tested.

---

## The order of work

| # | Step | Command | What proves it |
|---|---|---|---|
| 1 | The database is the one you think | `npm run on:production -- verify:migrations` | journal and ledger agree at 112, every CHECK validated |
| 2 | The cast that exists, exists | `npm run on:production -- verify:cast` | **7 of 26 sign in**, 5 of 5 checks green. Seven is our payroll; the other nineteen sign themselves up |
| 3 | The mark before the run | `npm run on:production -- baseline -- check` | 🔴 **exits 1**, with exactly five seed deltas and no sixth |
| 4 | Almost nothing is spent yet | `npm run on:production -- spend -- --budget 10` | **$0.0286**, the founder's own session. Not zero |
| 5 | The cron secret matches the deployed site | `curl` with `CRON_SECRET`, in `SIMULATION-PROMPT.md` | **200.** A 401 means wave 4 breaks and you find out now |
| 6 | The product itself is not already broken | `rm -rf .next && npm run build && npm run gates` | 32 gates, against **dev**, which is correct |
| 7 | The ageing script obeys its own rule | `npm run verify:age` | 8 checks, one past and one future timestamp in the same row. Dev, because it plants a row |
| 8 | Mark the start of wave one | `npm run on:production -- age -- --marker wave1 --start` | writes the marker. 🔴 **Bare, this ages dev and the six month clock never starts** |
| 9 | **Open the rail** | `/admin/settings`, `/admin/sponsors`, `/admin/clinics` | `04-THE-RAIL.md`. Nothing Egyptian works until this is done |
| 10 | Launch the orchestrator | hand it `02-THE-SWARM.md` | It reports its plan before it launches anybody |
| 11 | Waves one to six | each wave: act, capture, spend, age | `02-THE-SWARM.md` and `06-AGEING.md` |
| 12 | The exam | `npm run on:production -- copilot:exam` | `07-THE-EXAM.md` |
| 13 | The numbers | `npm run on:production -- physics -- --at 50`, then `npm run plan`, then Measure and freeze | `08-THE-NUMBERS.md` |
| 14 | Accuracy, only if there is budget | `npm run evals -- --record` | about $2.00, and last |
| 15 | **The edge ledger** | | `09-THE-EDGES.md`, all forty eight, each marked `held` or `broke` |
| 16 | **The record ledger** | | `11-THE-RECORD.md`, all twelve walks. `R7` needs the same question asked twice, with both answers |
| 17 | The report | | `docs/simulation-run/REPORT.md`, and it is honest |

🔴 **Every command that touches the run's data is prefixed `on:production --`, and that is the
whole difference between a run and an afternoon.** Written bare they operate on dev: `spend`
reports dev's zero against a $10 budget, `baseline` compares dev to production's mark, and step 8
leaves the six month clock unstarted with nothing saying so. `npm run verify:runbook` fails if any
document in this folder writes one of them bare.

The three that are **correctly** bare are steps 6 and 7 and the evals: they prove the code and
they plant fixtures, and dev is where fixtures belong.

**Step 9 is a numbered step and not an assumption.** The run starts with the rail shut, on
purpose, because that is the state a real Tuesday starts from.

---

## What you report back, and when

The person who pasted the prompt is not watching a terminal for four hours. **Report upward at
eight fixed points**, each short enough to read on a phone.

| When | What, in at most eight lines |
|---|---|
| After step 6 | The branch and the product are what the prompt claimed, or they are not. **Say plainly if anything is red before a single agent has acted** |
| After step 9 | The rail is open: companies and practices moved to `eg`, details read back on camera |
| End of each wave, six times | Sessions so far, the depth ladder, `npm run on:production -- spend` against $10, defects this wave, and anything an agent is blocked on |
| After wave 4 | **The full price invoice.** Whether it rendered with no discount line, and what the therapists did |
| After the exam | The mark per patient, and whether a thicker record really made a better copilot |
| After the CFO's second pass | The money end to end, with the month 3 pass beside it |
| After wave 5 | **The edge ledger so far.** How many of the forty eight in `09-THE-EDGES.md` have been walked, and which of them broke |
| At the end | The report, the dev log, and what the plan still cannot know |

### Three things to say immediately, without waiting for a checkpoint

1. **The spend passes 70% of $10.** Say so the moment it warns, with what is left to do. Do
   not decide alone to cut the run.
2. **An agent is blocked and cannot resume.** One block, the screen, and what it needs.
3. **A defect that would lose somebody money or expose a record.** Everything else goes in the
   log and waits. These two do not.
4. **`CV10`, `CV11` or `RR4` from `09-THE-EDGES.md` breaks.** An employer learning which of their
   staff is in therapy, or a patient in crisis blocked by anything to do with money. Both are
   the disclosure the whole constraint set exists to prevent, and neither waits for a
   checkpoint.

---

## What the final report contains

`docs/simulation-run/REPORT.md`, nine headings:

1. **The money**, end to end, read off the operator's own screens rather than queried: income
   by source, model spend as the expense against it, what was left over per month, therapists
   paid out, what is still held, what a pot cost an employer, and whether the books balance.
2. **The copilot exam**: the mark per patient, whether the claim held, and what the copilot
   invented about people it knew nothing about.
3. **Every defect**, with the screenshot and the person who hit it.
4. **A verdict per screen**: finished, thin, unstyled.
5. **What was actually spent**, against the $4.80 estimate, and why it differed.
6. **The fitted cost model**: the two terms, the fit quality, and what a fifty minute session
   costs. The only number in this run that outlives it.
7. **The AI accuracy**, or plainly "not re recorded, no budget".
8. **The edge ledger.** One row per case in `09-THE-EDGES.md`: the case, who hit it, what the
   screen said, the row id, and `held` or `broke`. **Including the ones that held**, because a
   table of only the breakages leaves a reader unable to tell "we checked and it was fine" from
   "nobody looked".
9. **What could not be simulated**, and why.

**A clean report means you did not look.** Forty eight of the rows in it are money going wrong
on purpose, and four of those were real defects found by hand in one afternoon of sprint 76. The last two walkthroughs each found defects that
sixty verifiers had missed, and this run exercises far more of the product than either.
