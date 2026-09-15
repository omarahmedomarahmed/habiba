# The swarm

**Handed to the orchestrator. The orchestrator owns the truth; the main session owns the
orchestrator.**

## The three tiers, and why they are different sizes

| Tier | Model | Count | Job |
|---|---|---|---|
| Main session | Opus 5 | 1 | Prepares the branch, builds the two scripts, launches the orchestrator, checks on it, runs the copilot exam, writes the report |
| Orchestrator | the best you can afford | 1 | Owns the wave clock. Wakes agents, sequences them, **verifies every claim against the database**, decides when a wave is complete |
| Agents | Haiku or Sonnet | 22, never more than 6 awake | Each one is one person, doing what that person would do |

The asymmetry is the design. **Acting like a patient is cheap. Knowing whether the patient
actually booked is expensive**, and it is expensive because it means reading the database
rather than reading a report.

## Agents wake, work, and then wait

An agent is **not closed when its task ends.** It finishes its wave's work, reports, and
then stays available for the orchestrator to wake with its context intact. Use
`SendMessage` to the agent by name; a fresh `Agent` call starts a stranger who has never
met their own patients.

This matters more than it sounds. At month 3, Layla must revoke access from the therapist
she chose at month 0. That is the same person making a decision about a relationship she
formed six months and five waves earlier, and an agent that was restarted has no idea who
he is.

```
  wave 1: P1 wakes, finds T3 on the radar, has a session, claims her record, sleeps
  wave 2: P1 wakes briefly, has two more sessions, writes in her journal, sleeps
  wave 3: P1 wakes, revokes T3's access, and knows exactly why she is doing it
```

## Six awake at once, never more

Twenty-two agents at once is a thundering herd against one dev server, a bill nobody wants,
and a transcript nobody can read. **Six.** The orchestrator queues the rest.

Choose the six by dependency, not by number. A patient cannot book a therapist who has not
gone on the radar. A clinic cannot invite a clinician before it is approved. **The
orchestrator's real job is this ordering**, and the order is:

```
  operator approves  →  therapist verifies  →  therapist goes on radar / publishes hours
                                                        ↓
  employer funds pot  →  staff enrol  →  patient books  →  session runs
                                                        ↓
                                    therapist approves note  →  patient rates  →  money settles
```

## How a wave runs

1. **Orchestrator announces the wave** and the identities in it, to the main session.
2. **Launches the first six**, in dependency order.
3. **Each agent reports in the three-line shape** from `00-START-HERE.md`. Nothing else is
   accepted.
4. **Orchestrator verifies every `ROW` against the database.** Not a sample. Every one.
5. **An unverifiable claim is re-tasked**, not recorded. If it fails twice, it is a defect:
   write it down with the screenshot and move on.
6. When the wave's work is done, **the capture agent runs** (`04-CAPTURE.md`).
7. **Only then** the main session ages the wave (`05-AGEING.md`).
8. Orchestrator reports the wave complete, with the numbers, and waits for the main session
   to say go.

**A wave is not complete because every agent said it was done.** It is complete when the
database says so and the frames exist.

### 🔴 And one extra gate on every wave, which is new

Before the wave is called complete, the orchestrator checks the **record depth ladder** in
`01-SEED.md` and reports where each patient stands against their target.

`P3` Mostafa is meant to finish the simulation with nine to eleven sessions and a dozen
journal entries. That will not happen on its own: a cheap agent playing a patient does the
thing it was asked once and reports success. **The depth is driven, wave by wave, or the
copilot exam at the end has nothing to measure.**

If a wave ends with every patient on three sessions, the orchestrator says so and the main
session decides whether to run a catch-up pass before ageing.

## The seven standing agents

These never sleep. They are awake for the whole simulation because their real-world
counterparts are.

🔴 **Every one of them works by clicking.** No standing agent writes SQL, calls a server
action directly, or runs a script that changes a row. They sign in on the sign-in form and
press the buttons, exactly like rule 2 in `00-START-HERE.md`. An agent that reached around
the product would be an agent that cannot find the defect it was launched to find, and four
of the seven below exist entirely to be the first person ever to use a screen.

### The growth and operations agent

Plays the platform: the operator console, and the outbound motion that brings people in.

- Approves clinic and employer applications, on camera
- Works the verification queue as each therapist submits documents
- 🔴 **Owns the `T4` rejection cycle end to end** (`01-SEED.md`). Thirteen steps, two
  rejections, a deletion, a practice invitation that changes nothing, and an approval. This
  agent writes the rejection reasons itself, in its own words, and **reads them back on
  `T4`'s screen** to prove they arrived verbatim
- Opens and closes countries, edits the taxonomy, answers a support ticket
- **Announces each new arrival to the orchestrator**, which is what triggers a new agent to
  be launched. Growth is an event, not a schedule: when this agent approves a clinic, a
  clinic agent wakes

### The money agent

Owns `03-MONEY.md` end to end, for all six months. Read that document; it is long because
the money is the half of this product that cannot be checked by looking at a screen.

🔴 Its scope now includes the **expense** side: at the end of each wave it reads
`/admin/vault`'s month table and reports income, model spend and what was left over, from
the screen rather than from a query. A month that lost money is reported as a month that
lost money.

### 🔴 The codes agent

Small, and it exists so that twenty other agents do not each reinvent the same workaround.

Email and WhatsApp verification codes are **assumed delivered** (`00-START-HERE.md`). When
any agent reaches a "we have sent you a code" screen, it asks this agent for the code, gets
it, and types it into the form.

The codes agent does two things and only two:

1. Reads the code that the product actually generated, for that one person, right then.
2. **Records that the wrong code was tried first and refused**, once per agent, because a
   gate everybody was handed the answer to is a gate nobody tested.

It never creates a code, never marks one used, and never touches a row the form would have
touched. If a code cannot be found for somebody who was told one was sent, **that is a
defect and it is a serious one**, and it is reported rather than worked around.

### 🔴 The payments operator, which is new and is the busiest agent in the run

There is no processor behind the Egyptian rail. Nothing confirms a transfer except a person
looking at a bank statement, and **that person is this agent**. `09-THE-RAIL.md` is its
document.

It lives on `/admin/transfers` and does four things:

1. **Types the bank details in, once, in wave 1.** They are not seeded. Until it does, every
   payer in Egypt sees "not on the system yet", which is the correct screen and a terrible
   one to leave up.
2. 🔴 **Moves each customer onto the Egyptian entity.** An enquiry lands on `us`, because
   which of our companies bills somebody is a decision made with paperwork in hand. Three
   companies on `/admin/sponsors`, two practices on `/admin/clinics`. **Nothing in the
   Egyptian half of this run works until it does**, and the run should start with the rail
   unreachable so that opening it is a photographed act rather than a seeded fact.
3. **Works the queue, by the minute.** Somebody is on a waiting screen for every row in it.
   The badge in the nav carries the count for that reason.
4. 🔴 **Rejects one, with a reason in its own words** (`B3` in `01-SEED.md`), and then
   watches the payer read that reason verbatim on their own screen. A rejection that arrives
   as "rejected" is a support ticket and a lost customer.

🔴 **It never confirms a payment it has not been shown evidence for.** In this simulation
the evidence is the reference the payer typed and the receipt they uploaded. An agent that
confirms everything that arrives is not testing an operator, it is testing a rubber stamp,
and the whole rail rests on the difference.

### 🔴 The business strategist, monthly

Wakes once per wave, after the money agent has closed the month. Reads **the operator's own
screens**, never the database: `/admin/vault`, `/admin/financial-model`, `/admin/numbers`,
the radar board, the transfers queue.

It writes one note per month, at most a page, answering three questions and no others:

1. **What changed this month that nobody planned for.**
2. **Which number is moving in the wrong direction**, and whether one month of it is a
   signal or a Tuesday.
3. **What it would do differently next month**, as one decision somebody could take.

🔴 It has no authority and takes no action. It is a reader. The value of a strategist who
cannot change anything is that its note is evidence about the screens: a month it could not
form a view on is a month the screens did not explain, and **that is a finding about the
product** rather than about the month.

### 🔴 The CFO, twice: after month 3 and after month 6

The heaviest agent in the run and the one launched least often.

It does what a CFO does on a first look: **tries to break the numbers.** It reads the ledger
screens, the invoice list, the payouts queue, the transfers queue and the financial model,
and it reports:

| What | Why it is asked |
|---|---|
| Does income minus expenses on our screens equal what the ledger says | Two places for one number is where a month goes missing |
| Which revenue is recognised that nobody has actually been paid for | A due invoice is not cash, and a forecast built on invoiced revenue is a forecast of a company that runs out of money |
| What the pots hold that is not ours | A sponsor's balance is a liability. A product that reads it as income is insolvent and cheerful |
| 🔴 Which of the model's inputs are still guesses | `07-FINANCIAL-MODEL.md` names four that no length of run can measure. A CFO who does not say so is signing off a number nobody measured |
| What one number, if it is wrong, breaks the plan | The session price. The run should say so independently |

🔴 **The month-3 pass and the month-6 pass are compared.** A number that moved between them
is worth more than either alone, and the second pass reads the first before it starts.

### 🔴 The CTO, and the dev log

Fixes nothing during the run. `00-START-HERE.md` rule 5 holds: **a defect is not fixed while
the simulation is running**, because a run that stops to fix its first defect finds one
defect.

What this agent does instead is keep **`docs/walkthrough-3/DEV-LOG.md`**, and it is the most
useful artefact the run produces after the money. One entry per defect, written at the moment
it was hit, in this shape and no other:

```
## D-<n> · <one line, in the words of the person who hit it>

Who       P3 Mostafa, booking his fourth session
Screen    /book/<therapist>, after pressing Confirm
Expected  The slot is taken and he gets a confirmation
Got       The slot is still open and nothing said anything
Shot      docs/walkthrough-3/m4/p3-mostafa/booking-silent.png
Row       availability_slots 8f3e… state=open, no session row
Blast     Any patient booking on a phone. Every one of them.
Fix later One line, what would catch this: a gate, a check, a test
```

🔴 `Blast` and `Fix later` are the two fields that make this a log rather than a list.
Without `Blast` every defect looks equally urgent; without `Fix later` the log is a
complaint. And the fix is **named, not made**.

## What the orchestrator reports upward, continuously

Not at the end. **After every agent action**, in one line:

```
  [wave 2] [C1-B] ok   T1 joined Nile Practice · seat 2/3 · own subscription cancelled · 14 patients followed
  [wave 2] [P4]   ok   enrolment refused, staff number not recognised · EXPECTED, captured
  [wave 2] [T4]   ok   invited by C1, accepted, STILL REFUSED at the gate · the point of T4
  [wave 2] [P3]   ??   claims a session happened, no session row found · re-tasking
  [wave 2] END         depth: P3 6/11 · P1 3/6 · P6 1/3 · spend $0.84 of $10 (8%)
  [wave 2] END         durations: 14 at 3m, 6 at 8m · both clusters alive
```

The main session reads this stream and intervenes when the orchestrator is drifting: taking
reports on trust, skipping verification to keep up, quietly dropping a scenario because it
was hard, or letting the depth ladder slide. **All four are the failure mode of a swarm**,
and all four look like progress.

## 🔴 Cost discipline, and it is the hardest constraint in the design

**The whole run has $10 of OpenAI credit and about $3.00 of planned spend**
(`00-START-HERE.md`). It must not stop halfway. That is not a lot of room, and it is easy to
spend it four times over on agents re-reading documents.

```
npm run spend -- --budget 10
```

**Run it at the end of every wave and report the number upward, in the wave summary line.**
It sums what the product actually spent, exits non-zero past the line, and warns at 70%. A
budget nothing checks is a number somebody read once.

- Agents get the **cheapest model that can do their job**. A patient booking a session does
  not need a frontier model.
- An agent's brief is its scenario row from `01-SEED.md` and nothing else. Do not paste this
  whole document into twenty-two agents.
- Screenshots are taken by the capture agent at checkpoints, **not by every agent
  continuously**. An agent takes one only when it hits something unexpected.
- If an agent has nothing to do in a wave, it is not woken.
- 🔴 **Sessions run 3 minutes, except `P3`'s eleven, which run 8.** Not fifty, and **not all
  the same length either.** The two clusters are what let `npm run physics` separate the
  fixed cost of a session from the variable cost of a minute, and `01-SEED.md` explains why
  a single length makes the whole financial model underivable. Flattening them to tidy the
  run is the one shortcut here that cannot be undone afterwards.
- 🔴 **The in-session copilot is capped at 4 messages**, which the seed already set on this
  branch. Do not raise it.

### What to do if the spend is running ahead

In this order, and say in the report which of them you did:

1. **Cut the radar strangers and the partner sessions** (4 sessions). They prove a path each
   and neither is on the depth ladder.
2. **Cut `P2` and `P4` to two sessions each.** They are the monthly tier and the exam only
   needs them as middle ground.
3. 🔴 **Never cut `P3`, and never shorten his sessions.** His eleven weekly 8-minute sessions
   are two things at once: the entire top of the copilot exam's ladder, and the **long
   cluster the cost model is fitted from.** Cutting him to save sixty cents throws away the
   most interesting question in the run AND makes the financial model underivable. If the
   budget is genuinely tight, cut short sessions, never long ones.

## 🔴 When an agent hits a wall: PAUSE, report, wait, resume

**An agent that hits a broken path must not finish, must not work around it, and must not be
restarted from scratch.** Restarting is the expensive failure: it spends the budget twice and
loses the state that made the bug reproducible.

### The protocol

1. **Stop where you are.** Do not retry, do not try a different route to the same goal, do not
   invent a workaround. A workaround makes the bug invisible, which is the one outcome worse
   than the bug.
2. **Write the finding** to `docs/walkthrough-3/BLOCKED.md`, appending, never overwriting:

```
## BLOCK-<n> · <one line>
Agent:      <who you are, e.g. T2 Yusuf>
Wave:       <1, 2 or 3>
At:         <the exact URL or command>
Expected:   <what should have happened>
Got:        <what did, verbatim, including the error>
Row:        <the database row that proves the state you were in>
Resume from: <the exact next action once it is fixed>
Blocks:     <what else cannot proceed until this is fixed>
```

3. **Tell the orchestrator and stop.** The orchestrator marks you `blocked`, not `done`, and
   does not launch your replacement.
4. **The orchestrator carries on with everything that does not depend on you.** One blocked
   agent is not a blocked run. It reports the block upward immediately, in full.
5. **The main session pastes the block to the founder and waits.** No guessing, no patching
   the product mid-run: rule 5 of `00-START-HERE.md` still holds and this is the mechanism
   that makes it survivable rather than fatal.
6. **On the fix, resume.** The agent is re-launched with `BLOCKED.md`'s `Resume from` line and
   the row id, and **continues from that action**. It does not re-register, re-verify or
   re-book anything it already did.

### 🔴 Why `Resume from` and `Row` are not optional

An agent that writes "the booking page broke" has produced a sentence. An agent that writes
"session `9f3c…` is `pending` and the pay button 500s; resume by retrying payment on that
session" has produced a resumable state. The difference is the whole point of pausing rather
than ending.

### The one exception

If the wall is **budget** rather than a defect, do not write a block. Stop, say so, and let
`npm run spend` be the evidence. A block file full of "ran out of money" entries buries the
real findings.

## What must never happen

| Never | Why |
|---|---|
| An agent writing to the database directly | Then the simulation tests the agent, not the product |
| A claim recorded without a row id | Then the report is fiction with screenshots attached |
| More than six agents awake | One dev server, one bill, one readable transcript |
| A wave aged before its capture | The frames would show the wrong dates |
| Fixing a defect mid-run | A run that stops at the first defect finds one defect |
| Skipping a scenario because it was hard | The hard ones are the ones nobody has ever run |
| Letting every patient end on three sessions | Then the copilot exam measures nothing |
