# The three-month simulation: start here

**You are the main session. Read all nine of these files before you do anything.** They are
one design split across nine documents because they are read by different agents.

| Read | What it is | Who reads it |
|---|---|---|
| `00-START-HERE.md` | This. The shape, the rules that bind everyone, the order of work, and the budget | You |
| `01-SEED.md` | The exact cast: 22 identities, three waves, one scenario each, and how often each patient comes | You and the seed agent |
| `02-ORCHESTRATION.md` | The swarm: who launches what, how agents wait, how claims are verified | You and the orchestrator |
| `03-MONEY.md` | Income, expenses and the full cycle for three months, including Egypt, which has no card rail | The money agent |
| `04-CAPTURE.md` | What is photographed, when, where it is saved, and the video scripts | Every agent |
| `05-AGEING.md` | How three months happens in one hour, and the one rule that keeps it honest | You, before wave one |
| `06-COPILOT-EXAM.md` | The test at the end: how much the copilot actually knows about each person | You, after the last wave |
| `07-FINANCIAL-MODEL.md` | What the run feeds into the thirty-six month forecast, and the four things it can never measure | You, after the money agent closes month three |
| `08-THE-OFFER.md` | 🔴 The commercial offer, rehearsed: free month, half price, and the full-price invoice that decides everything | You and the money agent, every wave |

---

## What this is

Not a walkthrough. **A simulation of three months of operating this product**, run by a swarm
of agents, each one behaving as a real person with a real reason to be there, in one sitting.

At the end you have: a database that looks like a quarter of trading, screenshots of every
principal's own screens at three points in that history, a full money cycle with income and
expenses on the operator's own screens, a list of every defect a person hit while trying to
do something ordinary, and a mark out of five for how well the copilot knows each patient.

## 🔴 The budget is $10 and it must not run out halfway

That is the constraint everything else was sized against. Read this section before the cast.

| | |
|---|---|
| Sessions | **35** |
| Approved notes | one per session, so 35 |
| Journal entries | **28** |
| Audio per session | 🔴 **two lengths: 24 at 3 minutes, 11 at 8**. See below |
| Total audio | **160 minutes** |
| In-session copilot | **4 messages**, not the shipped 10. The seed sets it |

| What | Cost |
|---|---|
| A 3-minute session: transcribe, diarise, note, risk, 4 copilot turns, profile | **$0.0254** |
| An 8-minute session, same calls | **$0.0457** |
| 24 short + 11 long | **$1.11** |
| The copilot exam, one full run | **$0.36** |
| Journal risk scans, document reading, copilot chats between sessions | **$0.31** |
| Retries, re-tasked agents, flows run twice: **× 1.6** | |
| **Planned total** | **≈ $3.00** |
| **Left of the $10** | **≈ $7.00** |

🔴 **Those three are measured, not estimated.** On 2026-09-14 the four prompts were run
against the live OpenAI API at four transcript lengths, for $0.37 in total. `evals/physics.json`
holds every row and `lib/finance/scenarios.ts` reads the two terms out of it.

### 🔴 Two session lengths, because one cannot be extrapolated from

`01-SEED.md` has the full argument and it is the one part of this design that serves the
**financial model** rather than the walkthrough. In short: cost is `FIXED + VARIABLE x
minutes`, the fixed half is 52% of a 3-minute session and 6% of a 50-minute one, and
multiplying a short session to reach a long one **overstates it by 95%**.

Two unknowns need two measurements, so the run produces two clusters and
`npm run physics` solves for both from `ai_request_logs`. It **refuses** to fit a single
cluster rather than returning a confident wrong number.

**Do not flatten the durations to tidy the run.**

### Where the surplus goes, and what it is NOT for

`npm run evals -- --record` costs about **$2.00** and re-records the AI accuracy figures. It
is **last, optional, and paid for out of what is left**, not planned for up front. At a $10
ceiling, a full eval record is a fifth of the budget spent on a number that does not change
whether the simulation ran.

So: **run the simulation first, check the spend, and re-record only if there is room.** If
there is not, say so in the report. A figure that was not measured and is reported as not
measured is worth more than a simulation that stopped in wave two.

The surplus is not for more sessions. Thirty-five is what makes the copilot exam separate a
deep record from a thin one; sixty would make a prettier chart and answer nothing new.

### 🔴 Check the spend after every wave, with the thing that counts it

```
npm run spend -- --budget 10
```

It sums `ai_request_logs.cost_microcents`, which the product writes on every model call. It
exits non-zero past the line and warns at 70%. **The orchestrator runs it at the end of every
wave and reports the number upward.** A budget nothing checks is a number somebody read once.

It counts what **the product** spent. Agent reasoning on the same key is not in that table,
so treat the figure as a floor, and it says so every time it prints.

### 🔴 And the number that matters to the business, which is not any of the above

A simulated session is 3 or 8 minutes. **A real one is fifty.** At real length the same
pipeline costs **$0.2167**, computed from the two-term fit rather than by multiplication.
Naive multiplication gives **$0.4230**, which is 95% too high.

```
npm run physics -- --at 50 --json docs/walkthrough-3/PHYSICS.json
```

It prints the measured short session, the two-term figure for fifty minutes, **and the
number naive multiplication would have given**, side by side, so the difference is on the
page rather than in an argument.

Report both, labelled. **Never quote the short-session figure as unit economics**, and never
quote the multiplied one at all. Those are the two most flattering mistakes this exercise can
produce and every pricing decision downstream would inherit either.

## The shape

```
  You  ·  Opus 5  ·  the main session
   │     reads the nine documents, checks the branch, launches the orchestrator,
   │     checks on it, ages each wave, runs the exam, writes the report
   ▼
  The orchestrator  ·  one agent, the smartest one you can afford
   │     owns the wave clock. Wakes agents, sequences them, **verifies every claim
   │     against the database**, watches the depth ladder and the spend
   ├──────────────┬──────────────┬──────────────┬─────────────
   ▼              ▼              ▼              ▼
  growth        money         user agents      capture
  agent         agent         (one per         agent
                              identity)
```

**Cheap agents do the acting. One expensive agent keeps them honest. You supervise the one
that keeps them honest.**

## The five rules that bind every agent

### 1. A claim without evidence did not happen

**This is the most important rule in the whole design.** A cheap agent asked to "book a
session as Layla" will sometimes report that it booked a session as Layla without having
done so. Not from malice: from a confident summary of an attempt.

So every agent reports in one shape and no other:

```
DID: booked a session with T2 for Thursday 14:00
SAW: docs/walkthrough-3/m1/p2-sarah/booking-confirmed.png
ROW: availability_slots id 8f3e… state=booked session_id=41ba…
```

**The orchestrator verifies `ROW` against the database itself.** An agent's word is an
input, never a fact. An agent that cannot produce a row id did not do the thing, and the
orchestrator re-tasks it rather than recording a success.

This repository has spent sixty-nine sprints on the principle that a rule is true in the
database or it is not true. The same principle governs the agents that exercise it.

### 2. Act through the product, never around it

Agents sign in through the sign-in form, book through the booking sheet, pay through the
checkout. **No agent writes to the database.** The only scripts that touch rows are the seed
(already run), the ageing script (between waves) and the capture script (read-only).

An agent that cannot complete a flow through the UI has found a defect. That is the entire
value of this exercise. Working around it destroys the only thing the simulation produces.

### 3. Every person is unmistakably synthetic

Every surname is **Demo** or **Example**. Every address is at `example.com`, which RFC 2606
reserves and which can never reach a real inbox. Every phone number is in one obviously
sequential block.

The frames from this run are **committed to the repository and used in a video**. A single
real name in one frame is a disclosure that cannot be recalled.

### 4. Nothing runs against production, ever

The simulation runs on its own branch. `writesTo()` refuses production by name; do not
remove it, do not work around it, and if a script refuses, read why.

### 5. A defect is not fixed during the run

Write it down, take the screenshot, carry on. A run that stops to fix its first defect
finds one defect. Fixes come after, in one pass, and each one says what now catches it.

## 🔴 Codes: assume every one of them arrived

Email verification codes and WhatsApp codes are **treated as delivered and correct**. An
agent that reaches "we have sent you a code" reads the code out of the database and enters
it through the form, exactly as a person reading their own inbox would, and carries on.

This is a deliberate exemption from rule 2 and it is the only one. WhatsApp templates are
unapproved on this account and email is not wired to a real inbox, so the alternative is not
a more honest simulation, it is twenty agents stuck on the same screen.

**What is NOT exempt** is everything the code is a gate on. The form still has to accept it,
the expiry still has to be honoured, a wrong code still has to be refused, and the agent
still has to walk the screen. **Each agent that uses a code checks the wrong one first**, in
one attempt, and reports the refusal. A gate nobody tested is a gate that was assumed.

## The order of work

🔴 **Steps 1 to 3 of the old plan are done.** The branch exists, is migrated, is seeded, and
both scripts this design used to ask you to build are built and have their own verifiers.

| # | Step | Command | Gate |
|---|---|---|---|
| 1 | Confirm the branch is what this says it is | `npm run verify:migrations` | 102 journal, 102 ledger, 114 tables |
| 2 | Confirm the platform is seeded and the applications are waiting | `npm run simulate:seed` | It **refuses**, saying an operator already exists. That refusal is the proof |
| 3 | Confirm the ageing script obeys its own rule | `npm run verify:age` | 8 checks, including one past and one future timestamp in the same row |
| 4 | Confirm nothing is spent yet | `npm run spend -- --budget 10` | $0.0000 |
| 4b | Confirm the physics fitter refuses an empty database | `npm run physics` | It says there is nothing to fit. After the run it will say something else |
| 5 | Mark the start of wave one | `npm run age -- --marker wave1 --start` | Writes `.simulation-wave1.json` |
| 6 | Launch the orchestrator with `02-ORCHESTRATION.md` | | It reports its plan before it launches anybody |
| 7 | Waves one to three | | Each wave: capture, then `npm run spend`, then age |
| 8 | The copilot exam | `npm run copilot:exam -- --json docs/walkthrough-3/COPILOT.json` | |
| 8b | **Fit the cost model** | `npm run physics -- --at 50 --json docs/walkthrough-3/PHYSICS.json` | Every kind fitted, no refusals. A refusal means the durations came out flat |
| 8c | **Feed the financial model**, per `07-FINANCIAL-MODEL.md` | `npm run forecast` and **Measure and freeze** on `/admin/financial-model` | One row in `finance_benchmarks`, and the provenance split on the page moves |
| 8d | 🔴 **Bill wave 1 at full price**, per `08-THE-OFFER.md` | `npm run age -- --marker wave4 --start`, then run the billing cycle | An invoice with NO discount line. The single most important frame in the run |
| 8e | **Print the plan with the counts in hand** | `npm run plan` | The tables in `docs/FINANCIAL-PLAN.md`, re-run against what was measured |
| 9 | Re-record accuracy **only if there is budget** | `npm run evals -- --record` | |
| 10 | The report | | `docs/walkthrough-3/REPORT.md`, and it is honest |

## What you must report at the end

1. **The money**, end to end, and **as the operator's own screens show it**: income by
   source, model spend as the expense against it, what is left over per month, therapists
   paid out, what is still held, what a pot cost an employer, and whether the books balance.
2. **The copilot exam**: the mark per patient, whether the claim held, and what the copilot
   invented about people it knew nothing about.
3. **Every defect**, with the screenshot and the person who hit it.
4. **A verdict per screen**: finished, thin, unstyled.
5. **What you actually spent**, from `npm run spend`, against the $3.00 estimate, and why it
   differed.
6. 🔴 **The fitted cost model**, from `npm run physics`: the fixed and variable terms per AI
   kind, the r² on each, and what a fifty-minute session costs. This is the input the
   financial model is built on, and it is the only number in this run that outlives it.
   `07-FINANCIAL-MODEL.md` says what to do with it, what the model can then say, and the
   four things it can never measure however long the run goes on.
7. **The AI accuracy**, if there was budget to measure it, and plainly "not re-recorded, no
   budget" if there was not.
8. **What you could not simulate**, and why.

**A clean report means you did not look.** The last two walkthroughs each found defects
that sixty verifiers had missed, and this one exercises far more of the product than either.
