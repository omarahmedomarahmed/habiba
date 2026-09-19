# The swarm

**Handed to the orchestrator. The orchestrator owns the truth; the main session owns the
orchestrator.**

## The three tiers, and why they are different sizes

| Tier | Model | Count | Job |
|---|---|---|---|
| Main session | the best available | 1 | Checks the branch, opens the rail, launches the orchestrator, ages each wave, runs the exam, writes the report |
| Orchestrator | the best you can afford | 1 | Owns the wave clock. Wakes agents, sequences them, **verifies every claim against the database**, decides when a wave is complete |
| Agents | the cheapest that can do the job | 28, never more than 6 awake | 20 cast, 8 standing. Each one is one person doing what that person would do |

The asymmetry is the design. **Acting like a patient is cheap. Knowing whether the patient
actually booked is expensive**, because it means reading the database rather than reading a
report.

## Agents wake, work, and then wait

An agent is **not closed when its task ends.** It finishes its wave's work, reports, and stays
available to be woken with its context intact. Use `SendMessage` to the agent by name. A fresh
`Agent` call starts a stranger who has never met their own patients.

This matters more than it sounds. In wave 3, Layla revokes access from the therapist she chose
in wave 1. That is the same person making a decision about a relationship she formed three
months and two waves earlier, and an agent that was restarted has no idea who she is.

```
  wave 1: P1 wakes, finds T3 on the radar, has a session, claims her record, sleeps
  wave 2: P1 wakes briefly, has two more sessions, writes in her journal, sleeps
  wave 3: P1 wakes, revokes T3's access, and knows exactly why she is doing it
```

## Six awake at once, never more

Twenty eight agents at once is a thundering herd against one dev server, a bill nobody wants,
and a transcript nobody can read. **Six.** The orchestrator queues the rest.

Choose the six by dependency, not by number. A patient cannot book a therapist who is not on
the radar. A practice cannot invite a clinician before it is approved. **The ordering is the
orchestrator's real job**, and the order is:

```
  operator approves  →  therapist verifies  →  therapist goes on radar / publishes hours
                                                        ↓
  employer funds pot  →  staff enrol  →  patient books  →  session runs
                                                        ↓
                                    therapist approves note  →  patient rates  →  money settles
```

## How a wave runs

1. **Announce the wave** and the people in it, to the main session.
2. **Launch the first six**, in dependency order.
3. **Each agent reports in the three line shape** from `00-START-HERE.md`. Nothing else is
   accepted.
4. **Verify every `ROW` against the database.** Not a sample. Every one.
5. **An unverifiable claim is re tasked**, not recorded. If it fails twice it is a defect:
   write it down with the screenshot and move on.
6. When the wave's work is done, **the capture agent runs** (`05-CAPTURE.md`).
7. **Only then** the main session ages the wave (`06-AGEING.md`).
8. Report the wave complete, with the numbers, and wait for the main session to say go.

**A wave is not complete because every agent said it was done.** It is complete when the
database says so and the frames exist.

### And one extra gate on every wave

Before calling a wave complete, check the **depth ladder** in `01-THE-CAST.md` and report where
each patient stands against their target.

`P3` Mostafa is meant to finish with twenty sessions and twenty two journal entries. That will
not happen on its own: a cheap agent playing a patient does the thing it was asked once and
reports success. **The depth is driven, wave by wave, or the exam at the end has nothing to
measure.**

If a wave ends with every patient on three sessions, say so, and the main session decides
whether to run a catch up pass before ageing.

---

## 🔴 SIGNING IN, AND THE LIMIT THAT WOULD HAVE STOPPED WAVE 1

Sign-in is **twenty attempts per fifteen minutes**, and the limiter buckets by the caller's
/24 rather than by the account. That is the right shape for the public internet, where a
large NAT sharing a bucket is a documented and accepted cost.

**This swarm is twenty-eight agents behind one egress address.** Each signs in as their
person at the start of every wave, and again whenever `age` moves the clock past a session's
idle timeout. Twenty-eight against twenty is not close: the run would have stalled in wave 1,
every agent would have reported *"too many attempts"* as a defect in the product, and nobody
would have found the cause for hours.

It was found by the mini simulation, which exhausted the bucket in four runs of a three-flow
probe.

**The fix is in the product and it is narrow.** While `SIMULATION_RUNNING=1` — the same flag
that turns off indexing and paints the violet strip — every per-network limit is multiplied
by twenty-five. The platform-wide `global:` ceiling is **not**, because that is the one
number that would notice an actual attack. `npm run verify:limits` asserts both directions,
and the production default is unchanged the moment the flag comes off.

Two things follow for an agent:

- **A "too many attempts" message is still real.** It now means a loop, not a swarm. Stop and
  say so rather than waiting it out.
- **Do not sign in more than you need to.** A context that holds its cookie is a context that
  is not spending the budget, and the budget is now generous rather than infinite.

## The eight standing agents

These never sleep. They are awake for the whole run because their real world counterparts are.

**Every one of them works by clicking.** No standing agent writes SQL, calls a server action
directly, or runs a script that changes a row. They sign in on the sign in form and press the
buttons, exactly like rule 2. An agent that reached around the product cannot find the defect
it was launched to find, and five of the eight exist to be the first person ever to use a
screen.

### 🔴 AND EVERY QUEUE ACTION IS SIGNED IN AS THE PERSON WHOSE QUEUE IT IS

A standing agent is a job, not a person. **Seven real people hold those jobs**, they each have
an account, and the agent working a queue signs in as the one whose queue it is:

| The queue | Sign in as | Role |
|---|---|---|
| Transfers | `heba.example@example.com`, and `sara.example@example.com` for the one they collide on | `staff` |
| Verifications, and payouts | `hossam.example@example.com` | `staff` |
| Sponsors and their pot top-ups | `amal.example@example.com` | `staff` |
| Support, and the crisis numbers directory | `farida.example@example.com` | `staff` |
| Countries, taxonomy, content, prices, the settings | `nour.example@example.com` | `super_admin` |
| The board, the radar, benefits, errors, `/admin/actuals` | `sherif.example@example.com` | `super_admin` |

One password, `Simulation2026!`, and `12-THE-LOGINS.md` is generated from the same list.

**The reason is the audit log.** Six months of manual approvals all carrying one name is
evidence about one person, not about a company of seven, and the founder's question in month 7
is *who cleared this*. The product already writes the actor on every row; the run either gives
it seven names to write or throws that away.

🔴 **And it is how a permission gets tested.** `/admin/benefits`, `/admin/radar`,
`/admin/actuals`, the board and the error log are `super_admin` only. Heba opening one and
being redirected is a screenshot this run must produce, because a permission nobody was ever
refused by is a permission nobody has tested. Do it once, early, and capture it.

### 1 · Growth and operations

Plays the platform: the operator console, and the outbound motion that brings people in.

- Approves clinic and employer applications, on camera
- Works the verification queue as each therapist submits documents
- **Owns the `T4` rejection cycle end to end.** Thirteen steps, two rejections, a deletion, a
  practice invitation that changes nothing, and an approval. This agent writes the rejection
  reasons itself, in its own words, and **reads them back on `T4`'s screen** to prove they
  arrived verbatim
- Opens and closes countries, edits the taxonomy, answers a support ticket
- **Announces each new arrival to the orchestrator**, which is what triggers a new agent to be
  launched. Growth is an event, not a schedule: when this agent approves a practice, a practice
  agent wakes

### 2 · Money

Owns `03-THE-MONEY.md` end to end, for all six months. Read that document. It is long because
the money is the half of this product that cannot be checked by looking at a screen.

Its scope includes the **expense** side: at the end of each wave it reads `/admin/vault`'s
month table and reports income, model spend and what was left over, **from the screen rather
than from a query**. A month that lost money is reported as a month that lost money.

### 3 · Codes

Small, and it exists so twenty other agents do not each invent the same workaround.

Email and WhatsApp codes are **assumed delivered** (`00-START-HERE.md`). When any agent reaches
a "we have sent you a code" screen, it asks this agent for the code, gets it, and types it in.

It does two things and only two:

1. Reads the code the product actually generated, for that one person, right then.
2. **Records that the wrong code was tried first and refused**, once per agent.

It never creates a code, never marks one used, and never touches a row the form would have
touched. If a code cannot be found for somebody who was told one was sent, **that is a defect
and a serious one**, and it is reported rather than worked around.

### 4 · The payments operator, who is the busiest agent in the run

There is no processor behind the Egyptian rail. Nothing confirms a transfer except a person
looking at a bank statement, and **that person is this agent**. `04-THE-RAIL.md` is its
document.

It lives on `/admin/transfers` and does four things:

1. **Types the bank details in, once, in wave 1.** They are not seeded. Until it does, every
   payer in Egypt sees "not on the system yet", which is the correct screen and a terrible one
   to leave up.
2. **Moves each customer onto the Egyptian entity.** An enquiry lands on `us`, because which of
   our companies bills somebody is a decision made with paperwork in hand. Three companies on
   `/admin/sponsors`, the practices on `/admin/clinics`.
3. **Works the queue, by the minute.** Somebody is on a waiting screen for every row in it. The
   badge in the nav carries the count for that reason.
4. **Rejects one, with a reason in its own words** (`B3` in `01-THE-CAST.md`), and then watches
   the payer read that reason verbatim on their own screen. A rejection that arrives as
   "rejected" is a support ticket and a lost customer.

**It never confirms a payment it has not been shown evidence for.** Here the evidence is the
reference the payer typed and the receipt they uploaded. An agent that confirms everything that
arrives is not testing an operator, it is testing a rubber stamp, and the whole rail rests on
the difference.

### 5 · The Total View watcher, who does nothing else for six months

One agent, signed in as the operator, whose entire job is `/admin/tv`.

> *"I run the company by sitting back and watching TV."*

That is the joke the board exists to make true, and this agent is how the run finds out whether
it is. It does **not** act, approve anything, or work a queue. It watches, and once a week it:

1. **Refreshes every section** and notes how long the whole board takes to read.
2. **Screenshots the board whole**, to `docs/simulation-run/tv/week-NN.png`.
3. **Expands and collapses each of the nine sections**, so the frames show both states.
4. **Writes down the one number that changed most since last week**, and whether the board made
   that visible or whether it had to go looking.
5. **Follows one door.** Each week it picks a different section, clicks through to the page that
   manages it, and confirms that page agrees with the number the board showed.

Twenty six weekly frames, and the fifth item is the one that matters. **A board and a page that
disagree is the single most damaging defect this screen can have**, because the board is the one
a founder trusts without checking.

#### What this agent is really testing

Not the pixels. Three questions no other agent can answer:

| Question | Why nobody else can answer it |
|---|---|
| Can a founder see what happened this week **without opening anything else**? | Every other agent is inside one flow and cannot tell what is missing from the whole |
| Does a number on the board match the page behind it? | The two are read by different people at different times, so only somebody reading both notices |
| Is there a week where the board looked fine and something was wrong? | **The most valuable finding available.** A dashboard that stayed green through a bad week is worse than no dashboard |

At the end it writes **one page**: what it could see, what it could not, and what it would add.
A founder who has watched six months of this company through one screen is the only person
qualified to say what is missing from it.

### 6 · The business strategist, monthly

Wakes once per wave, after the money agent has closed the month. Reads **the operator's own
screens**, never the database: `/admin/tv`, `/admin/vault`, `/admin/financial-model`,
`/admin/numbers`, the radar board, the transfers queue.

One note per month, at most a page, answering three questions and no others:

1. **What changed this month that nobody planned for.**
2. **Which number is moving the wrong way**, and whether one month of it is a signal or a
   Tuesday.
3. **What it would do differently next month**, as one decision somebody could take.

It has no authority and takes no action. It is a reader. The value of a strategist who cannot
change anything is that its note is evidence about the screens: **a month it could not form a
view on is a month the screens did not explain**, and that is a finding about the product rather
than about the month.

### 7 · The CFO, twice: after month 3 and after month 6

The heaviest agent in the run and the one launched least often. It does what a CFO does on a
first look: **tries to break the numbers.** It reads the ledger screens, the invoice list, the
payouts queue, the transfers queue and the financial model, and reports:

| What | Why it is asked |
|---|---|
| Does income minus expenses on our screens equal what the ledger says | Two places for one number is where a month goes missing |
| Which revenue is recognised that nobody has actually paid | A due invoice is not cash, and a forecast built on invoiced revenue is a forecast of a company that runs out of money |
| What the pots hold that is not ours | A sponsor's balance is a liability. A product that reads it as income is insolvent and cheerful |
| Which of the plan's inputs are still guesses | `08-THE-NUMBERS.md` names four that no length of run can measure. A CFO who does not say so is signing off a number nobody measured |
| What one number, if it is wrong, breaks the plan | The session price. The run should reach that conclusion independently |

**The two passes are compared.** A number that moved between them is worth more than either
alone, and the second pass reads the first before it starts.

### 8 · The CTO, and the dev log

Fixes nothing during the run. Rule 5 holds: **a defect is not fixed while the simulation is
running**, because a run that stops to fix its first defect finds one defect.

What this agent does instead is keep **`docs/simulation-run/DEV-LOG.md`**, and it is the most
useful artefact the run produces after the money. One entry per defect, written at the moment it
was hit, in this shape and no other:

```
## D-<n> · <one line, in the words of the person who hit it>

Who       P3 Mostafa, booking his fourth session
Screen    /book/<therapist>, after pressing Confirm
Expected  The slot is taken and he gets a confirmation
Got       The slot is still open and nothing said anything
Shot      docs/simulation-run/m4/p3-mostafa/booking-silent.png
Row       availability_slots 8f3e… state=open, no session row
Blast     Any patient booking on a phone. Every one of them.
Fix later One line: the gate, check or test that would catch this
```

`Blast` and `Fix later` are the two fields that make this a log rather than a list. Without
`Blast` every defect looks equally urgent; without `Fix later` the log is a complaint. **And the
fix is named, not made.**

---

## The launch order, which is not alphabetical

| When | Who wakes | Why then |
|---|---|---|
| Before wave 1 | growth and operations, codes, **payments operator**, CTO, **Total View watcher** | The rail has to be open and the console has to work before anybody can do anything |
| Wave 1 | `T1` `T2` `T3` `T4`, `P1` `P2` | The product with nobody on it |
| End of every wave | capture, money, **strategist**, in that order | The strategist reads what the money agent just closed |
| Wave 2 | `C1` and its three people, `E1` and its HR admin, `P3` `P4` | Growth is an event: when the operator approves a practice, a practice agent wakes |
| Wave 3 | `E2` `E3` and their admins, `P5` `P6`, `D1` | Scale and the edge cases |
| After wave 3 | **CFO, first pass** | Three months of rows |
| Wave 4 | `T5`, and the four injected bugs | The month the bills come |
| Wave 5 | `T6`, `P7` | Churn, and a therapist for whom the plan is worse value |
| Wave 6 | **CFO, second pass** | Compared against the first, which it reads before it starts |

---

## What the orchestrator reports upward, continuously

Not at the end. **After every agent action**, in one line:

```
  [wave 2] [C1-B] ok   T1 joined Nile Practice · seat 2/3 · own subscription cancelled · 14 patients followed
  [wave 2] [P4]   ok   enrolment refused, staff number not recognised · EXPECTED, captured
  [wave 2] [T4]   ok   invited by C1, accepted, STILL REFUSED at the gate · the point of T4
  [wave 2] [P3]   ??   claims a session happened, no session row found · re-tasking
  [wave 2] END         depth: P3 6/20 · P1 3/11 · P6 1/3 · spend $0.84 of $10 (8%)
  [wave 2] END         durations: 14 at 3m, 6 at 8m · both clusters alive
```

The main session reads this stream and intervenes when the orchestrator drifts: taking reports
on trust, skipping verification to keep up, quietly dropping a scenario because it was hard, or
letting the depth ladder slide. **All four are the failure mode of a swarm, and all four look
like progress.**

---

## Cost discipline, and it is the hardest constraint in the design

**The run has $10 and about $4.80 of planned spend.** It must not stop halfway. That is not a
lot of room, and it is easy to spend it four times over on agents re reading documents.

```
npm run on:production -- spend -- --budget 10
```

**At the end of every wave, in the wave summary line.**

- Agents get the **cheapest model that can do their job.** A patient booking a session does not
  need a frontier model.
- An agent's brief is **its own row from `01-THE-CAST.md` and nothing else.** Do not paste this
  document into twenty agents.
- Screenshots are taken by the capture agent at checkpoints, **not by every agent
  continuously.** An agent takes one only when it hits something unexpected.
- If an agent has nothing to do in a wave, it is not woken.
- **Sessions run 3 minutes, except `P3`'s twenty, which run 8.** Not fifty, and not all the same
  length either. `00-START-HERE.md` has the arithmetic.
- **The in session copilot is capped at 4 messages**, which the seed already set. Do not raise
  it.

`01-THE-CAST.md` says what to cut first if the spend runs ahead, and what must never be cut.

---

## When an agent hits a wall: pause, report, wait, resume

**An agent that hits a broken path must not finish, must not work around it, and must not be
restarted from scratch.** Restarting is the expensive failure: it spends the budget twice and
loses the state that made the bug reproducible.

1. **Stop where you are.** Do not retry, do not try a different route to the same goal, do not
   invent a workaround. A workaround makes the bug invisible, which is the one outcome worse
   than the bug.
2. **Write the finding** to `docs/simulation-run/BLOCKED.md`, appending, never overwriting:

```
## BLOCK-<n> · <one line>
Agent:        <who you are, e.g. T2 Yassin>
Wave:         <1 to 6>
At:           <the exact URL or command>
Expected:     <what should have happened>
Got:          <what did, verbatim, including the error>
Row:          <the database row that proves the state you were in>
Resume from:  <the exact next action, once it is fixed>
Blocks:       <what else cannot proceed until then>
```

3. **Tell the orchestrator and stop.** It marks you `blocked`, not `done`, and does not launch
   your replacement.
4. **The orchestrator carries on with everything that does not depend on you.** One blocked
   agent is not a blocked run. It reports the block upward immediately, in full.
5. **The main session passes the block to the founder and waits.** No guessing, no patching the
   product mid run. Rule 5 still holds and this is the mechanism that makes it survivable rather
   than fatal.
6. **On the fix, resume.** The agent is re launched with the `Resume from` line and the row id,
   and **continues from that action.** It does not re register, re verify or re book anything it
   already did.

### Why `Resume from` and `Row` are not optional

An agent that writes "the booking page broke" has produced a sentence. An agent that writes
"session `9f3c…` is `pending` and the pay button 500s; resume by retrying payment on that
session" has produced a resumable state. The difference is the whole point of pausing rather
than ending.

### The one exception

If the wall is **budget** rather than a defect, do not write a block. Stop, say so, and let
`npm run on:production -- spend` be the evidence. A block file full of "ran out of money" entries buries the real
findings.

---

## What must never happen

| Never | Why |
|---|---|
| An agent writing to the database directly | Then the run tests the agent, not the product |
| A claim recorded without a row id | Then the report is fiction with screenshots attached |
| More than six agents awake | One dev server, one bill, one readable transcript |
| A wave aged before its capture | The frames would show the wrong dates and cannot be retaken |
| Fixing a defect mid run | A run that stops at the first defect finds one defect |
| Skipping a scenario because it was hard | The hard ones are the ones nobody has ever run |
| Letting every patient end on three sessions | Then the copilot exam measures nothing |
