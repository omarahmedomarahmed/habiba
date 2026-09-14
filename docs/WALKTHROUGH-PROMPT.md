# The three-month simulation: the prompt for a fresh session

Paste everything below the line into a new session. Nothing above it is part of the prompt.

**Before you paste it:**

1. Put a funded `OPENAI_API_KEY` and `DAILY_API_KEY` in `.env.local`. The simulation runs the
   real AI and real video; without credit it produces three months of empty notes.
   **Budget about $25 on OpenAI.** The arithmetic is in `docs/simulation/00-START-HERE.md`;
   the run itself is estimated at $14 and the rest is room for a second eval record.
2. Keep `STRIPE_SECRET_KEY` on **test** keys.
3. The branch is already made, empty and migrated. Its string is in the prompt below.

---

You are running a three-month simulation of 24Therapy: a swarm of agents behaving as real
people, using the real product, producing a database that looks like a quarter of trading
and a folder of screenshots that proves it.

**Read these seven files from the repository first, in this order, before doing anything:**

```
docs/simulation/00-START-HERE.md    the shape, the five binding rules, the order of work, the cost
docs/simulation/01-SEED.md          the exact cast: 22 identities, 3 waves, one scenario each
docs/simulation/02-ORCHESTRATION.md the swarm: who launches what, how claims are verified
docs/simulation/03-MONEY.md         income, expenses, and Egypt, which has no card rail
docs/simulation/04-CAPTURE.md       what is photographed, where it goes, the video scripts
docs/simulation/05-AGEING.md        how three months happens in one hour
docs/simulation/06-COPILOT-EXAM.md  the test at the end: what the copilot really knows
```

They are one design in seven documents. **Do not start until you have read all seven**,
because each one assumes the others and the most expensive mistake available is launching
twenty agents against a database that was not prepared.

## In one paragraph

Twenty-two synthetic people sign themselves up and use the product: five therapists, six
patients, a practice, three employers, an integrator and an operator. They arrive in three
waves. Cheap agents act as them. One expensive orchestrator sequences them, makes them wait
for each other, and **verifies every claim against the database rather than believing the
agent that made it**. Between waves, a script ages the rows that wave created, so at the end
the database holds three months of history that was produced in one hour by real
interactions with the real product. Screenshots are taken at month 0, 1 and 3, per person,
on the same screens each time, so you can watch one therapist's earnings screen grow up.
Then the copilot sits an exam about every one of those patients.

## The database branch, already made and already migrated

```
postgresql://neondb_owner:npg_nBpWM0F5DVLc@ep-empty-queen-a62vlkkp-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

It was created fresh, emptied to zero tables, migrated from migration 0000 to 0100, and
`npm run verify:migrations` passes against it: **101 in the journal, 101 in the ledger, 112
tables, 249 foreign keys, every CHECK validated.** It contains no rows of any kind.

**Confirm that yourself before you trust this paragraph.** A prompt that says a database is
ready is exactly the kind of claim rule 1 exists to distrust.

## The two things you must build before anybody acts

Neither exists yet. Build them, prove them, then launch.

| # | What | Specified in | Its own gate |
|---|---|---|---|
| 1 | `scripts/age.ts` | `05-AGEING.md` | Age a row with one past and one future timestamp. The past one moved, the future one did not |
| 2 | `scripts/simulate-seed.ts` | `01-SEED.md` | Every seeded identity can actually sign in. Prove it by signing in, not by counting rows |

```
export DATABASE_URL='<the string above>'
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

Budget about **$2** for one full record.

## And after the swarm: the exam

```
npm run copilot:exam -- --dry
npm run copilot:exam -- --json docs/walkthrough-3/COPILOT.json
```

`06-COPILOT-EXAM.md` is the whole method. In short: it builds questions about each patient
out of that patient's own rows, asks the copilot, and marks the answers with a blind grader.
Half the questions are about things the record does **not** contain, and a copilot that
answers those is failing worse than one that forgets.

The claim under test is that the patient with the thickest record has the best copilot.
**Report the correlation whichever way it comes out.**

## What you report at the end

1. **The measured AI accuracy**, per suite, against the previous figures.
2. **The money**, reconciled, and **read off the operator's own screens**: income split
   between subscriptions and session fees, model spend as the expense against it, what was
   left over each month, collected, held, paid out, VAT, per employer pot. The books balance
   or you say by how much they do not.
3. **The copilot exam**: the mark per patient, whether the claim held, every invention
   quoted, and the deep patient's handover beside the thin patient's.
4. **Every defect a person hit**, with the screenshot and who hit it.
5. **A verdict per screen**: finished, thin, unstyled.
6. **Five rewritten video scripts**, built only from frames that exist.
7. **What you actually spent**, against the $14 estimate, and why it differed.
8. **What you could not simulate and why.**

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

## Three things this run has that the last one did not

| | |
|---|---|
| 🔴 **The rejection cycle** | A therapist rejected twice, his documents deleted, locked out, invited by a practice, **still refused**, and finally approved after reapplying. Thirteen steps in `01-SEED.md`. Built this sprint (C351), never exercised |
| 🔴 **Expenses beside income** | `/admin/vault` prints subscriptions, session fees, income, model spend and what was left over, per month. Until C349 the chart and the card on that page disagreed about what income meant |
| 🔴 **Egypt's crisis line** | `lib/crisis/line.ts` now holds 105, with the instruction to press 1 for Arabic and then 1 for mental health. Photograph it in Arabic, as Layla. That button has been empty in the first market since the product opened |

## Known environment limits, so they are not filed as bugs

| What | Status |
|---|---|
| OpenAI, Daily | **Live and funded.** If notes do not generate, that is a defect, not an environment gap |
| Stripe | Test mode, deliberately |
| Egypt card payments | **There is no gateway and the product refuses honestly.** That refusal is correct behaviour and is captured, not worked around. See `03-MONEY.md` |
| Email and WhatsApp codes | 🔴 **Assumed delivered.** The codes agent reads the real code and types it into the real form. Every agent tries one wrong code first and reports the refusal. See `00-START-HERE.md` |
| Blob storage | Not configured. **Document upload is simulated only as far as the form goes**, which matters for `T4`: his rejection cycle turns on documents being deleted, so record what the row says rather than what storage did |
| Dates in Arabic | A known gap. Photograph it anyway |

**A clean report would mean you did not look.**
