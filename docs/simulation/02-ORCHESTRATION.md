# The swarm

**Handed to the orchestrator. The orchestrator owns the truth; the main session owns the
orchestrator.**

## The three tiers, and why they are different sizes

| Tier | Model | Count | Job |
|---|---|---|---|
| Main session | Opus 5 | 1 | Prepares the branch, builds the two scripts, launches the orchestrator, checks on it, writes the report |
| Orchestrator | the best you can afford | 1 | Owns the wave clock. Wakes agents, sequences them, **verifies every claim against the database**, decides when a wave is complete |
| Agents | Haiku or Sonnet | 31, never more than 6 awake | Each one is one person, doing what that person would do |

The asymmetry is the design. **Acting like a patient is cheap. Knowing whether the patient
actually booked is expensive**, and it is expensive because it means reading the database
rather than reading a report.

## Agents wake, work, and then wait

An agent is **not closed when its task ends.** It finishes its wave's work, reports, and
then stays available for the orchestrator to wake with its context intact. Use
`SendMessage` to the agent by name; a fresh `Agent` call starts a stranger who has never
met their own patients.

This matters more than it sounds. At month 6, Layla must revoke access from the therapist
she chose at month 0. That is the same person making a decision about a relationship she
formed five months and four waves earlier, and an agent that was restarted has no idea who
he is.

```
  wave 1: P1 wakes, finds T3 on the radar, has a session, claims her record, sleeps
  wave 2: P1 stays asleep
  wave 3: P1 wakes, has two more sessions with T3, writes in her journal, sleeps
  wave 4: P1 wakes, revokes T3's access, and knows exactly why she is doing it
```

## Six awake at once, never more

Thirty-one agents at once is a thundering herd against one dev server, a bill nobody wants,
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

## The two standing agents

These two never sleep. They are awake for the whole simulation because their real-world
counterparts are.

### The growth and operations agent

Plays the platform: the operator console, and the outbound motion that brings people in.

- Approves clinic and employer applications, on camera
- Works the verification queue as each therapist submits documents
- Opens and closes countries, edits the taxonomy, answers a support ticket
- **Announces each new arrival to the orchestrator**, which is what triggers a new agent to
  be launched. Growth is an event, not a schedule: when this agent approves a clinic, a
  clinic agent wakes.

### The money agent

Owns `03-MONEY.md` end to end, for all six months. Read that document; it is long because
the money is the half of this product that cannot be checked by looking at a screen.

## What the orchestrator reports upward, continuously

Not at the end. **After every agent action**, in one line:

```
  [wave 2] [C1-B] ok   T1 joined Nile Practice · seat 2/3 · own subscription cancelled · 14 patients followed
  [wave 2] [P5]   FAIL enrolment refused, staff number not recognised — EXPECTED, captured
  [wave 2] [P6]   ??   claims a session happened, no session row found — re-tasking
```

The main session reads this stream and intervenes when the orchestrator is drifting: taking
reports on trust, skipping verification to keep up, or quietly dropping a scenario because
it was hard. **All three are the failure mode of a swarm**, and all three look like progress.

## Cost discipline

- Agents get the **cheapest model that can do their job**. A patient booking a session does
  not need a frontier model.
- An agent's brief is its scenario row from `01-SEED.md` and nothing else. Do not paste this
  whole document into thirty-one agents.
- Screenshots are taken by the capture agent at checkpoints, **not by every agent
  continuously**. An agent takes one only when it hits something unexpected.
- If an agent has nothing to do in a wave, it is not woken.

## What must never happen

| Never | Why |
|---|---|
| An agent writing to the database directly | Then the simulation tests the agent, not the product |
| A claim recorded without a row id | Then the report is fiction with screenshots attached |
| More than six agents awake | One dev server, one bill, one readable transcript |
| A wave aged before its capture | The frames would show the wrong dates |
| Fixing a defect mid-run | A run that stops at the first defect finds one defect |
| Skipping a scenario because it was hard | The hard ones are the ones nobody has ever run |
