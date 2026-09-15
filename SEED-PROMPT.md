# The simulation: where the prompt actually lives

> ⚠️ **This file used to hold a different design and it was wrong.** It described
> seeding six months of history with a script that ran twenty-six weekly ticks.
> That design was abandoned, for the reason it gave itself in its own first
> paragraph: a script that writes rows proves nothing, because nothing ever
> happened.

**The prompt to paste into a fresh session is `docs/WALKTHROUGH-PROMPT.md`.**

## What replaced it, and why

The run is a **simulation**, not a seed. Twenty-eight synthetic people sign
themselves up through the real forms and use the real product. Cheap agents act
as them; one expensive orchestrator sequences them and **verifies every claim
against the database rather than believing the agent that made it**. Between
waves a script ages the rows that wave created, so six months of history is
produced in one afternoon by real interactions.

`scripts/simulate-seed.ts` still exists and is still the only thing that writes
rows before the run, and it creates exactly three things: the operator, the
platform settings, and the four applications waiting in his queue. **No
therapist, no patient, no session.** Those are people, and people sign
themselves up. A cast seeded into existence never walks the sign-up flow, and
sign-up is where two of the last three walkthroughs found their worst defects.

## The ten documents

| | |
|---|---|
| `docs/WALKTHROUGH-PROMPT.md` | 🔴 **The thing to paste.** Keys, the branch, the steps |
| `docs/simulation/00-START-HERE.md` | The shape, the five rules, the order of work, the $10 budget |
| `docs/simulation/01-SEED.md` | The cast: 28 identities, six waves, one scenario each |
| `docs/simulation/02-ORCHESTRATION.md` | The swarm, the seven standing agents, and what to do at a wall |
| `docs/simulation/03-MONEY.md` | Income, expenses, and Egypt, which has no card rail |
| `docs/simulation/04-CAPTURE.md` | What is photographed, when, and where it goes |
| `docs/simulation/05-AGEING.md` | How six months happens in one afternoon |
| `docs/simulation/06-COPILOT-EXAM.md` | The test at the end |
| `docs/simulation/07-FINANCIAL-MODEL.md` | What the run feeds the forecast, and what it can never measure |
| `docs/simulation/08-THE-OFFER.md` | The commercial offer, and the invoice that decides everything |
| `docs/simulation/09-THE-RAIL.md` | 🔴 How money reaches us in Egypt: a transfer, and a person checking it |

## House rules, which have not changed

- **Never use the em dash.** `verify:sprint24` fails the build on one
- Short tables, plain words, no ticket codes as prose
- One shared password, written down where the run can find it
- **Nothing touches production.** The write scripts refuse it by name
- `npm run gates` passes before anything is handed back
