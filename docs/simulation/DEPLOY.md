# The simulation, deployed

The six month run happens on its own git branch, deployed on its own URL, against its
own database. After it ends you sign into that URL as any member of the cast and read
six months of their record.

| | |
| --- | --- |
| Git branch | `simulation` |
| Neon branch | `simulation-q1` (`br-fragrant-bonus-a6ngfs07`) |
| Endpoint | `ep-empty-queen-a62vlkkp` |
| Vercel project | `habiba`, as a branch preview |

## Why a branch and not a second project

The simulation is only evidence if it runs on the product. A second Vercel project is a
second place for environment variables to drift, and the first thing to drift is the one
that matters: a simulation running last month's prices produces a P&L about a business
nobody is launching, and every figure in it is internally consistent.

A branch of the same project shares everything except the database, which is the one
thing that must differ.

## The one thing that has to be typed by hand

A connection string cannot be committed, so exactly one value is set in the Vercel
dashboard, and everything else follows from it.

**Vercel → habiba → Settings → Environment Variables → Add**

| Field | Value |
| --- | --- |
| Key | `DATABASE_URL` |
| Environments | Preview only |
| Branch | `simulation` |
| Value | the `simulation-q1` pooled connection string |

Add `APP_URL` the same way once the preview URL exists, so join links in messages point
at the simulation rather than at production.

## 🔴 What happens if that is forgotten

Nothing quiet. `lib/env.ts` refuses to start when the branch and the database disagree,
in both directions:

- the `simulation` branch on any other database refuses, because a run that invents
  hundreds of clinics, patients, sessions and payments would put all of it on a real
  board, and the deploy would be green while it happened
- any other branch on the simulation database refuses, because serving invented people
  as customers makes every figure a founder reads a figure about a company that does
  not exist

The check is on the **endpoint**, not on the variable's name. A variable is a label
somebody typed; the endpoint is where the bytes go. `tests/safety.test.ts` holds both
directions and the case that matters most in practice: a laptop, with no branch name at
all, is unaffected.

## Running it

1. `git checkout simulation && git merge main` so the branch is the product as it stands.
2. Push. Vercel builds a preview.
3. Point the simulation's own scripts at `DATABASE_URL_SIMULATION` and run it.
4. When it ends, open the preview URL and sign in as anybody in `docs/simulation/10-THE-STORY.md`.

The seeded passwords are in the story file. Every person in it is invented, with a
surname of Demo or Example and an address at `example.com`, which is the rule the whole
simulation is written under.
