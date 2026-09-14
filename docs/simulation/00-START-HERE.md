# The six-month simulation — start here

**You are the main session. Read all five of these files before you do anything.** They are
one design split across five documents because they are read by different agents.

| Read | What it is | Who reads it |
|---|---|---|
| `00-START-HERE.md` | This. The shape, the rules that bind everyone, and the order of work | You |
| `01-SEED.md` | The exact cast: every identity, which wave they arrive in, what scenario each one exists to prove | You and the seed agent |
| `02-ORCHESTRATION.md` | The swarm: who launches what, how agents wait, how their claims are verified | You and the orchestrator |
| `03-MONEY.md` | The full money cycle for six months, including Egypt, which has no card rail | The money agent |
| `04-CAPTURE.md` | What is photographed, when, where it is saved, and the video scripts | Every agent |
| `05-AGEING.md` | How six months happens in one hour, and the one rule that keeps it honest | You, before wave one |

---

## What this is

Not a walkthrough. **A simulation of six months of operating this product**, run by a swarm
of agents, each one behaving as a real person with a real reason to be there, in one sitting.

At the end you have: a database that looks like six months of trading, screenshots of every
principal's own screens at four points in that history, a full money cycle including payouts
and a pot that ran out, a list of every defect a person hit while trying to do something
ordinary, and the real measured accuracy of the AI.

## The shape

```
  You  ·  Opus 5  ·  the main session
   │     reads the five documents, prepares the branch, builds the two scripts
   │     that do not exist yet, then hands over and supervises
   ▼
  The orchestrator  ·  one agent, the smartest one you can afford
   │     owns the clock, the waves, and the truth. Wakes agents, verifies their
   │     claims against the database, never takes a report at face value
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
SAW: docs/walkthrough-3/m1/p2-layla/booking-confirmed.png
ROW: availability_slots id 8f3e… state=booked session_id=41ba…
```

**The orchestrator verifies `ROW` against the database itself.** An agent's word is an
input, never a fact. An agent that cannot produce a row id did not do the thing, and the
orchestrator re-tasks it rather than recording a success.

This repository has spent sixty-eight sprints on the principle that a rule is true in the
database or it is not true. The same principle governs the agents that exercise it.

### 2. Act through the product, never around it

Agents sign in through the sign-in form, book through the booking sheet, pay through the
checkout. **No agent writes to the database directly.** The only scripts that touch rows
are the seed (before anyone acts), the ageing script (between waves) and the capture
script (read-only).

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
remove it, do not work around it, and if a script refuses, read why rather than forcing it.

### 5. A defect is not fixed during the run

Write it down, take the screenshot, carry on. A run that stops to fix its first defect
finds one defect. Fixes come after, in one pass, and each one says what now catches it.

## The order of work

| # | Step | Who | Gate before moving on |
|---|---|---|---|
| 1 | Create the simulation branch, migrate it, confirm against `information_schema` | You | Ledger matches `drizzle/`'s file count, and `npm run verify:migrations` passes against it |
| 2 | Build `scripts/age.ts` per `05-AGEING.md` | You | Its own test: age a known row, read it back, and prove a future-dated row did not move |
| 3 | Build `scripts/simulate-seed.ts` per `01-SEED.md` | You | Every identity exists and can sign in. Prove it by signing in, not by counting rows |
| 4 | Re-record the AI accuracy | You | `npm run evals -- --record` with real credit, then report the number |
| 5 | Launch the orchestrator, hand it `02-ORCHESTRATION.md` | You | It reports back its plan before it launches anybody |
| 6 | Waves one to four | Orchestrator | Each wave's capture is complete and verified before the next begins |
| 7 | The report | You | `docs/walkthrough-3/REPORT.md`, and it is honest |

**Do not start step 5 until steps 1 to 4 are done and proved.** A swarm launched against a
half-migrated database produces thirty agents all finding the same missing column.

## What you must report at the end

1. **The real AI accuracy**, measured, not remembered. The number in `evals/baseline.json`
   was recorded on a smaller case set before the account ran out of credit. Re-record it and
   say what it is now, including where it got worse.
2. **The money**, end to end: revenue collected, our share, therapists paid out, what is
   still held, what a pot cost an employer, and whether the books balance.
3. **Every defect**, with the screenshot and the person who hit it.
4. **A verdict per screen**: finished, thin, or unstyled.
5. **What you could not simulate**, and why.

**A clean report means you did not look.** The last two walkthroughs each found defects
that sixty verifiers had missed, and this one exercises far more of the product than either.
