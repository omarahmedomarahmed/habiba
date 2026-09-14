# The three-month simulation: start here

**You are the main session. Read all seven of these files before you do anything.** They are
one design split across seven documents because they are read by different agents.

| Read | What it is | Who reads it |
|---|---|---|
| `00-START-HERE.md` | This. The shape, the rules that bind everyone, the order of work, and what it costs | You |
| `01-SEED.md` | The exact cast: 22 identities, three waves, one scenario each | You and the seed agent |
| `02-ORCHESTRATION.md` | The swarm: who launches what, how agents wait, how claims are verified | You and the orchestrator |
| `03-MONEY.md` | Income, expenses and the full cycle for three months, including Egypt, which has no card rail | The money agent |
| `04-CAPTURE.md` | What is photographed, when, where it is saved, and the video scripts | Every agent |
| `05-AGEING.md` | How three months happens in one hour, and the one rule that keeps it honest | You, before wave one |
| `06-COPILOT-EXAM.md` | The test at the end: how much the copilot actually knows about each person | You, after the last wave |

---

## What this is

Not a walkthrough. **A simulation of three months of operating this product**, run by a swarm
of agents, each one behaving as a real person with a real reason to be there, in one sitting.

At the end you have: a database that looks like a quarter of trading, screenshots of every
principal's own screens at three points in that history, a full money cycle with income and
expenses on the operator's own screens, a list of every defect a person hit while trying to
do something ordinary, the real measured accuracy of the AI, and a mark out of five for how
well the copilot knows each patient.

## Three months, not six, and what that changed

The previous version of this design ran six months with 31 identities. It has been cut to
**three months and 22 identities**, and the cut was made by merging people rather than by
dropping scenarios. **Every edge case in the six-month design is still here.**

Two examples of how that was done, because the same judgement applies if you have to cut
further: the failed enrolment and the work-email enrolment used to be two patients, and are
now one person who is refused on her staff number and then succeeds on her work address,
which is a truer story as well as a smaller one. The poached employee and the partial-cover
employee used to be two, and are now one.

One thing was **added**, not cut: a therapist who is rejected twice, blocked, invited by a
practice anyway, and who still has to get through verification. That is new product built
this sprint and nothing has ever exercised it.

## 🔴 What it costs, so you can top up before you start

These are computed from `lib/settings/defs.ts`'s own rate table, which is what the product
bills itself against. Recompute them if that table has moved.

| | |
|---|---|
| Sessions the simulation produces | **50 to 60** |
| Approved notes | **one per session**, so the same |
| Journal entries | **55 to 70** |
| Copilot conversations | **80 to 100 turns** |
| Audio per session | **6 minutes**, deliberately short |

| What | Cost |
|---|---|
| Per simulated session, all in: transcribe, diarise, note, risk, in-session copilot, profile | **$0.06** |
| 55 sessions | **$3.30** |
| Journal risk scans, document reading, copilot chats between sessions | **$0.60** |
| The copilot exam (`06-COPILOT-EXAM.md`), one full run | **$0.51** |
| `npm run evals -- --record`, one full run | **$2.00** |
| Retries, re-tasked agents, flows run twice | **× 1.6** |
| **Total, OpenAI** | **≈ $14** |
| **Top up** | **$25**, which leaves room for a second eval record and one re-run |
| Daily, video: 55 sessions × 6 min × 2 people ≈ 660 participant-minutes | **≈ $3**, and the free tier may cover it |

### 🔴 And the number that matters to the business, which is not the one above

A simulated session is six minutes. **A real one is fifty.** At real length the same pipeline
costs about **$0.25 per session**, and almost all of the difference is the note and risk
passes reading a transcript seven times longer.

Report both. The simulation's bill says what this exercise cost; the per-real-session figure
is the one every pricing decision downstream depends on, and `/admin/usage` computes it from
actual rows once the run is over. **Do not quote the simulation's cheap figure as the unit
economics.** That is the single most misleading number this exercise can produce.

## The shape

```
  You  ·  Opus 5  ·  the main session
   │     reads the seven documents, prepares the branch, builds the two scripts
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

| # | Step | Who | Gate before moving on |
|---|---|---|---|
| 1 | Create the simulation branch, migrate it, confirm against `information_schema` | You | Ledger matches `drizzle/`'s file count, and `npm run verify:migrations` passes against it |
| 2 | Build `scripts/age.ts` per `05-AGEING.md` | You | Its own test: age a known row, read it back, and prove a future-dated row did not move |
| 3 | Build `scripts/simulate-seed.ts` per `01-SEED.md` | You | Every identity exists and can sign in. Prove it by signing in, not by counting rows |
| 4 | Re-record the AI accuracy | You | `npm run evals -- --record` with real credit, then report the number |
| 5 | Launch the orchestrator, hand it `02-ORCHESTRATION.md` | You | It reports back its plan before it launches anybody |
| 6 | Waves one to three | Orchestrator | Each wave's capture is complete and verified before the next begins |
| 7 | The copilot exam | You | `npm run copilot:exam -- --json docs/walkthrough-3/COPILOT.json` |
| 8 | The report | You | `docs/walkthrough-3/REPORT.md`, and it is honest |

**Do not start step 5 until steps 1 to 4 are done and proved.** A swarm launched against a
half-migrated database produces twenty agents all finding the same missing column.

## What you must report at the end

1. **The real AI accuracy**, measured, not remembered. The number in `evals/baseline.json`
   was recorded on a smaller case set before the account ran out of credit. Re-record it and
   say what it is now, including where it got worse.
2. **The money**, end to end, and **as the operator's own screens show it**: income by
   source, model spend as the expense against it, what is left over per month, therapists
   paid out, what is still held, what a pot cost an employer, and whether the books balance.
3. **The copilot exam**: the mark per patient, whether the claim held, and what the copilot
   invented about people it knew nothing about.
4. **Every defect**, with the screenshot and the person who hit it.
5. **A verdict per screen**: finished, thin, or unstyled.
6. **What you actually spent**, against the estimate above, and why it differed.
7. **What you could not simulate**, and why.

**A clean report means you did not look.** The last two walkthroughs each found defects
that sixty verifiers had missed, and this one exercises far more of the product than either.
