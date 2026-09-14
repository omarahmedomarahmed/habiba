# The six-month simulation — the prompt for a fresh session

Paste everything below the line into a new session. Nothing above it is part of the prompt.

**Before you paste it:**

1. Put a funded `OPENAI_API_KEY` and `DAILY_API_KEY` in `.env.local`. The simulation runs the
   real AI and real video; without credit it produces six months of empty notes.
2. Keep `STRIPE_SECRET_KEY` on **test** keys.
3. Have a **fresh, empty Neon branch** ready and its connection string to hand.

---

You are running a six-month simulation of 24Therapy: a swarm of agents behaving as real
people, using the real product, producing a database that looks like six months of trading
and a folder of screenshots that proves it.

**Read these six files from the repository first, in this order, before doing anything:**

```
docs/simulation/00-START-HERE.md    the shape, the five binding rules, the order of work
docs/simulation/01-SEED.md          the exact cast: 31 identities, 4 waves, one scenario each
docs/simulation/02-ORCHESTRATION.md the swarm: who launches what, how claims are verified
docs/simulation/03-MONEY.md         the full money cycle including Egypt, which has no card rail
docs/simulation/04-CAPTURE.md       what is photographed, where it goes, the video scripts
docs/simulation/05-AGEING.md        how six months happens in one hour
```

They are one design in six documents. **Do not start until you have read all six**, because
each one assumes the others and the most expensive mistake available is launching thirty
agents against a database that was not prepared.

## In one paragraph

Thirty-one synthetic people sign themselves up and use the product: five therapists, eight
patients, a practice, three employers, an integrator and an operator. They arrive in four
waves. Cheap agents act as them. One expensive orchestrator sequences them, makes them wait
for each other, and **verifies every claim against the database rather than believing the
agent that made it**. Between waves, a script ages the rows that wave created, so at the end
the database holds six months of history that was produced in one hour by real interactions
with the real product. Screenshots are taken at month 0, 1, 3 and 6, per person, on the same
screens each time, so you can watch one therapist's earnings screen grow up.

## The three things you must build before anybody acts

Neither of the first two exists yet. Build them, prove them, then launch.

| # | What | Specified in | Its own gate |
|---|---|---|---|
| 1 | `scripts/age.ts` | `05-AGEING.md` | Age a row with one past and one future timestamp. The past one moved, the future one did not |
| 2 | `scripts/simulate-seed.ts` | `01-SEED.md` | Every seeded identity can actually sign in. Prove it by signing in, not by counting rows |
| 3 | The simulation branch, migrated | below | `npm run verify:migrations` passes against it, checked against `information_schema` |

```
# a fresh, empty branch. Never the production one, never the capture one.
export DATABASE_URL='<the new simulation branch>'
npm run db:migrate
npm run verify:migrations        # the migrator prints success either way; this one reads the catalogue
npm run settings:seed
npm run ship:content
node --import tsx --conditions=react-server scripts/simulate-seed.ts
```

## Then, before the swarm: the number you were asked for

```
npm run evals -- --record
```

The accuracy figures in `evals/baseline.json` were recorded on a smaller case set, before
the account ran out of credit, and the file says so about itself. **You now have credit.
Re-record them and report the real numbers**, including any that got worse. A figure that
went down and is reported is worth more than one that went up and was not measured.

## What you report at the end

1. **The measured AI accuracy**, per suite, against the previous figures.
2. **The money**, reconciled: collected, held, paid out, our share, VAT, per employer pot.
   The books balance or you say by how much they do not.
3. **Every defect a person hit**, with the screenshot and who hit it.
4. **A verdict per screen**: finished, thin, unstyled.
5. **Four rewritten video scripts**, built only from frames that exist.
6. **What you could not simulate and why.**

## The five rules, repeated here because they are the whole design

1. **A claim without a database row id did not happen.** Agents report what they did, what
   they photographed, and the row that proves it. The orchestrator checks the row itself.
2. **Act through the product, never around it.** No agent writes to the database. An agent
   that cannot finish a flow through the UI has found the thing this exercise exists to find.
3. **Every person is unmistakably synthetic.** Surname Demo or Example, address at
   `example.com`. These frames are committed and go in a video.
4. **Never production.** The write scripts refuse it by name. If one refuses, read why.
5. **Do not fix defects during the run.** Write them down and carry on. A run that stops at
   the first defect finds one defect.

## Known environment limits, so they are not filed as bugs

| What | Status |
|---|---|
| OpenAI, Daily | **Live and funded.** If notes do not generate, that is a defect, not an environment gap |
| Stripe | Test mode, deliberately |
| Egypt card payments | **There is no gateway and the product refuses honestly.** That refusal is correct behaviour and is captured, not worked around. See `03-MONEY.md` |
| WhatsApp codes | Templates unapproved. Email and password are the walkable paths |
| Blob storage | Not configured. Document upload is not simulated |
| Dates in Arabic | A known gap. Photograph it anyway |

**A clean report would mean you did not look.**
