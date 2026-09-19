# Running the simulation on production, and keeping what it makes

The six month run happens on the **production deployment**, the **production Neon branch**,
the **real domain** and the **real keys**. Nothing about it is a rehearsal environment.

🔴 **And nothing is undone afterwards.** The six months of records stay on the production
database until a person decides to delete them. Every invented patient's file, every note,
every payment and every audit row is still there the next morning, and the month after, to be
signed into and read. That is the point of running it here.

| | |
| --- | --- |
| Deployment | `habiba`, production target, `main` |
| Domain | `https://24t.vercel.app`, public, 200 to anybody |
| Neon branch | `main` (`br-curly-dream-a6b0shlz`), endpoint `ep-wild-lake-a6tgm2r6` |
| Baseline | `evals/production-baseline.json`, 118 tables, 195 rows, recorded 2026-09-17 |
| Snapshot, if it is ever wanted back | `snap-old-sea-a60wgj3s`, taken 2026-09-17 after migration 0110 |

🔴 **Both of those describe 2026-09-17 and production has moved since, twice on purpose.**
Migration 0111 added `capital_contributions` and `other_costs`, and `simulate:seed` added the
payroll and the four applications. So `baseline -- check` now exits 1 with exactly five
deltas, which is the expected state and is written out in `SIMULATION-PROMPT.md`.

🔴 **And restoring that snapshot would undo 0111 as well as the seed**, because a Neon
restore takes the schema back with the rows. Anybody who restores it has to run
`npm run on:production -- db:migrate` afterwards and then check `information_schema` for the
two tables, because `db:migrate` prints success whatever happens (H1).

## Why production, and the correction that matters

A simulation on a preview deployment with a forked database is evidence about a
configuration nobody will ever run. The point of six months of invented trading is to find
out whether **the thing being launched** works, and that is the production deployment, on
its real domain, holding the real keys.

Two facts were offered as making this safe. **One of them was wrong**, and the error is
worth keeping written down because it is the shape of the mistakes this repository keeps
finding.

- ✅ **Production was empty.** 195 rows across 118 tables: one organisation, two users, no
  patients, no payments. Measured on 2026-09-17, before the seed and before 0111.
- ❌ **"Production is not publicly reachable."** This was read off Vercel's SSO setting,
  which protects everything `all_except_custom_domains`, and inferred rather than tested.
  `24t.vercel.app` is attached to the project and answers **200 to anybody**, no sign-in.
  `robots.txt` allows `/radar` and the radar page carries `index, follow` on purpose.

So during a run, nine invented clinicians with `DEMO-` licence numbers sit on a public,
crawlable page. That is the disclosure `scripts/demo.ts` warns about in its own header.

**A setting is not a test.** The fix below was built because the claim was checked.

## 🔴 The data stays, and that changes what the risks are

The earlier plan was snapshot, run, capture, restore. It is not the plan any more, because
a restore throws away the thing the run was for: six months of records somebody can sign
into and read, months later, as the therapist and as the patient and as the operator.

Three things follow, and all three are why the triple check in sprint 76.52 exists:

1. **A fixture left behind is permanent.** Nothing sweeps up afterwards. `writesTo()` used
   to read `I_MEAN_PRODUCTION` for all sixty-one of its callers, most of which are
   `verify-sprint*` files that plant an organisation and delete it in a `finally`. One
   `npm run gates` with the production connection string in `.env.local` would have written
   fabricated companies onto the founders' own board, and a `finally` that never runs leaves
   one there for ever. The door is shut now unless the caller asks for it, and three ask.
2. **There is exactly one way to point a command at production.** `npm run on:production`,
   with an allow-list. Anything not on it does not run, and the refusal says why.
3. **The snapshot is an escape hatch, not a step.** `snap-old-sea-a60wgj3s` is still
   there. It exists for the case where the user decides afterwards that they want the
   database back, and for nothing else.

## 🔴 The public half is real, and that is the point

The run is meant to walk the journeys a real patient walks, which means the links have to
work for somebody with no account and no Vercel login. They do:

    /                      200
    /pricing               200
    /join/<token>          200

That is what makes this worth doing on production, and it is also exactly why the
indexing has to be shut off while it happens.

## The order, and it matters

### 1 · Baseline

    npm run on:production -- baseline -- record snap-old-sea-a60wgj3s

Done: 118 tables, 195 rows. Every table read out of `pg_tables` at run time rather than
from a list somebody maintains.

It is not a restore point any more. It is the answer to *"what was here before the run"*,
which is the question somebody asks in month 7 when a number looks odd, and the only way to
tell an invented row from a real one afterwards is to know what the day before looked like.

### 2 · 🔴 `SIMULATION_RUNNING=1` on production

While it is set, `robots.txt` disallows everything and every page in the product carries a
violet strip naming the database it is on.

Both halves are live and tested: `curl https://24t.vercel.app/robots.txt` returns
`Disallow: /`, and the home page carries *"Everybody here is invented"* beside
`ep-wild-lake-a6tgm2r6-pooler`.

🔴 **It stays on after the run, not just during it.** The earlier version said to unset it
afterwards, which made sense when the data was going to be restored away. It is not. Sixty
invented patients and nine invented clinicians live on that database now, and the banner is
the only thing on the screen that says so to whoever opens it next. It comes off the day
the invented people are deleted, and not before.

### 3 · `RESEND_API_KEY` off, and what still gets recorded

🔴 **Nothing blocks.** `notify()` logs one line and returns `{ sent: false, reason }`, and
every caller shows the link on screen regardless: an invitation, a claim link and a join
link are all returned to the clinician whether or not a message went out. No flow waits on
delivery, no flow fails on it.

🔴 **And every attempt is written down**, which it was not until migration 0109. Each call
appends to `delivery_attempts`: the kind, whether a phone and an address existed, which
channels accepted it, and the reason nothing did. Not the body, because every kind is
already constrained to carry no clinical content.

That table is what makes the run's evidence about messaging worth anything. Without it,
"the patient was never told" and "we never tried" look identical afterwards, and with email
deliberately off that is sixty patients' worth of the product going unmeasured.

The consequence for the run: **no message reaches anybody by email.** Every link a patient
needs is passed on screen, which the product supports and which `11-THE-RECORD.md` walk `R9`
depends on. WhatsApp templates are mostly unapproved, so the same applies there.

### 4 · Seed, once. 🔴 IT HAS ALREADY RUN

    npm run on:production -- simulate:seed

Two founders and five support staff, all seven on the payroll from 2026-04-01 at $3,500 a
month and all seven able to sign in; four applications waiting for approval; and the copilot
quota set to 4 because the run has $10 of model credit.

It creates no therapist, no patient and no session. Those are people and people sign
themselves up, which is where two of the last three walkthroughs found their worst defects.

🔴 **It was run during the rehearsal, on purpose, and it found a bug in itself.** This is the
one command whose failure on production stops everything, and the only way to know it survives
there is to point it at it. `= ANY(<array>)` is expanded into a parameter list by this driver,
which Postgres reads as a tuple: the seed wrote seven people onto the payroll and then crashed
before creating a single login, leaving production with a wage bill and nobody who could work
a queue. Fixed, re-run, thirteen checks green, and `verify:cast` confirms all seven sign in.

🔴 **So do not run it again. It refuses**, exit 1, before it writes anything, because a second
run would make a second Nile Practice and nobody could tell the agents which one to use. Its
own advice, *"for a fresh start, make a new branch"*, is written for an empty database and
following it here would throw the seeded run away. `npm run on:production -- verify:cast` is
the command that answers what step 4 was asking: 7 of 26 sign in, 5 of 5 checks green.

### 5 · Run it, with real keys

Real OpenAI key, so the model spend is the real model spend and `/admin/usage/sessions`
reports real money. Real Daily key, so the rooms are real rooms. Real blob token, so
uploaded identity documents and transfer receipts are really stored. That is the whole
reason for running here.

Each wave ends with the clock moving:

    npm run on:production -- age -- --marker wave1 --start
    npm run on:production -- age -- --marker wave1 --days 30

`age` only touches rows created since the marker opened, which was proved against a copy of
production: a planted row moved thirty days and the founder's own session, login and
organisation stayed exactly where they were.

### 6 · 🔴 Capture as you go, not at the end

The evidence still has to exist outside the database, and the reason has changed rather
than gone away. It is no longer "a restore is about to destroy it": it is that a frame of a
screen at month 2 cannot be taken at month 6, because the screen has moved on. Every frame,
every figure off `/admin/usage/sessions`, the board, the money reconciliation, the copilot
exam, the edge ledger from `09-THE-EDGES.md` and the record ledger from `11-THE-RECORD.md`.
`05-CAPTURE.md` says what and when.

`npm run verify:synthetic` cannot be pointed at production and that is correct, not a gap:
it plants a real-looking person as a control before deleting it, and planting one on
production is the thing none of this is willing to do.

### 7 · Prove every person can be signed in as

    npm run on:production -- verify:cast -- --complete

Twenty six accounts, each one read back out of the database, each one's password
actually verified rather than assumed to work. This is the check that makes the run
readable in month 7, and it is the one that could not have been written by reading the
schema: an agent who signed somebody up with a password of their own invention leaves six
months of Mostafa's care behind a password nobody wrote down.

`docs/simulation/12-THE-LOGINS.md` is the list, generated from `scripts/_cast.ts`.

### 8 · Read the result

`/admin/actuals` is the six months in one table: what was earned and what was spent, month
by month, counted out of the ledger, `ai_request_logs` and the payroll, beside the payroll
itself. It is the measured half of `/admin/financial-model`, which is the forecast.

Read them side by side. Do not add them up.

### 9 · Rotate the keys

The keys were pasted into a chat and are shared. They get rotated the day the run ends,
which is a different act from deleting the data and does not touch it.

🔴 **THE BANK DETAILS STAY AS PLACEHOLDERS.**

Nobody in this run sends money anywhere. Sixty invented people declaring transfers against an
invented account produces exactly the same evidence about the rail as sixty invented people
declaring transfers against the real one, and the real account carries a risk the invented one
does not: a stranger who wanders onto a public site mid-run and actually sends money.

What the screen needs is to be FILLED, so the payment sheet renders an account instead of
"not set up yet" and the operator agent can walk it. It is. The real account goes in the
week before launch, which is a different day and a different decision.

## When the invented people are eventually deleted

That is a decision, taken on a day, by a person. When it comes:

    npm run on:production -- baseline -- check

118 tables, 195 rows, or it names the tables that differ. `rate_limits` and `error_events`
are reported separately and do not fail it: production is publicly reachable, so a crawler
bumps the first and any runtime error appends to the second, both without the simulation
having done anything.

🔴 **It compares ROWS, not tables**, and a table the baseline never heard of counts as zero on
the old side. So `capital_contributions` and `other_costs`, which migration 0111 added after
the baseline was recorded, pass silently while they are empty and are named the moment
somebody enters a capital contribution or a typed cost. That is the right behaviour and it is
worth knowing before it surprises somebody: this check cannot tell you the schema moved.

Restoring `snap-old-sea-a60wgj3s` is the other way to do it, and the faster one. Either way, `SIMULATION_RUNNING`
comes off only once the invented people are gone.

## Do we need our own domain?

Not for this. `24t.vercel.app` is public and serves every page a patient touches, so the
run can test the real journeys today.

It is worth having before launch, for reasons this run does not depend on: email
deliverability needs a verified sending domain, and `24t.vercel.app` is not a name to put
on a clinical product. Attaching one later changes `APP_URL` and nothing else.

## What the `simulation` branch is now for

It stays, with its boot guard and its violet strip. It is where the second pass and the
adjusted re-run happen without touching production again. Production is for the run that
has to be about the real thing.

🔴 **It is a git branch and a Neon database. It is NOT a Vercel deployment, on purpose.**

Every preview build of it failed. Nineteen preview builds across this branch and the working
branch burned **4.84 hours** of build time in one day and produced nothing: `out_of_memory`
during webpack, or `BUILD_EXCEEDED_MAXIMUM_TIME` at the 45 minute ceiling, four times. The
build is memory-bound on an 8 GB machine and this file's own hazard log said so before any of
it (see *"The production build is memory-bound"* in `HAZARDS.md`, where four PRODUCTION deploys
died the same way on 2026-09-16).

So the project now carries an **Ignored Build Step** that builds `main` and nothing else.
Pushing to `simulation` or to a working branch still updates git and still costs nothing.
`https://24t.vercel.app` is the only deployment, and the run happens there.
