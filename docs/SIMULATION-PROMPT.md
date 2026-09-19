# The six month simulation

🔴 **THIS IS THE ONLY FILE. There is nothing else to open and nothing else to paste.**

## What you do, in full

1. **Top up OpenAI with $10.** That is the whole budget. The plan comes to about $4.80.

2. **Fill in the seven placeholders in the KEYS block below.** `STRIPE_WEBHOOK_SECRET` and
   `APP_URL` are already correct and are the only two that are.

   | | Where it comes from | Looks like |
   | --- | --- | --- |
   | `OPENAI_API_KEY` | platform.openai.com | `sk-...` |
   | `DAILY_API_KEY` | dashboard.daily.co | a long string |
   | `STRIPE_SECRET_KEY` | dashboard.stripe.com, **test mode** | `sk_test_...` |
   | `BLOB_READ_WRITE_TOKEN` | Vercel, the project's Storage tab | `vercel_blob_rw_...` |
   | `AUTH_SECRET` | any 64 hex characters you make up | `a1b2c3...` |
   | `CRON_SECRET` | 🔴 Vercel, the `habiba` project, Settings, Environment Variables, reveal it. **It has to match**, because the cron calls go to the deployed site and a guess 401s | a long string |
   | `<neon password>` | Neon, project `gentle-waterfall-66476219`, Connect. **The same password goes in all four database lines**, because all four use the same role | one word |

   🔴 **Seven, not five.** An earlier version of this list said five and left `CRON_SECRET` and
   the Neon password as placeholders, which fails in wave 4 and on the first command
   respectively.

3. **Open a new Claude Code session and paste everything from the `KEYS` heading below to the
   end of this file.** That is the prompt. Nothing above the KEYS heading is part of it.

4. **Then wait.** The session writes `.env.local` itself and runs every command. You never
   touch a file, never open a terminal, never type a command.

## What it will do without asking

Check production is in the state this document claims, build the product and run all
twenty-seven gates against the **dev** branch, confirm the production seed with `verify:cast`,
run six months of invented trading on `https://24t.vercel.app` with real keys, move the clock
at the end of each wave, and report back at seven fixed points, each short enough to read on a
phone.

## 🔴 FIVE THINGS THE MINI SIMULATION FOUND, WHICH THE RUN NOW KNOWS

A rehearsal walked all nine main flows on the dev branch before this was written. Five
obstacles came out of it, and each one would have cost the run hours. They are fixed or
written down; they are listed here because the first thing a new session should know is what
has already been paid for.

| | |
|---|---|
| 🔴 Sign-in is rate limited **by network**, and this swarm is one network | Twenty attempts per fifteen minutes against twenty-eight agents. The run would have stalled in wave 1. Widened 25× while `SIMULATION_RUNNING=1`; the platform-wide ceiling is not. `verify:limits` holds both halves |
| 🔴 A patient **cannot have an email address** | `/patient/signup` never asks for one and no screen lets her add one. Her handle is her phone and a one-time code. `12-THE-LOGINS.md` carries the numbers |
| 🔴 An Egyptian customer on the default region is offered **Stripe** | Confirm goes to checkout.stripe.com. **The operator moves every customer to region `eg` BEFORE anybody is asked for money**, or the run's money leaves by the card rail and the transfer queue stays empty |
| The onboarding chips are `sr-only` checkboxes **in the same form as the licence fields** | Selecting them after Save details saves nothing and the screen does not say so. The submit button then sits disabled with every visible field filled in |
| Both enquiry forms end in **"Ask us to call"** | Not Apply, not Submit. A practice's enquiry creates a held `organizations` row and an employer's a `sponsors` row; there is no applications table |

`npm run probe` re-runs the whole rehearsal against dev in about three minutes.

## The three things it will interrupt you for

1. The spend passes 70% of $10.
2. An agent is blocked and cannot get past a screen.
3. A defect that would lose somebody money or expose a record.

Everything else goes in the log and waits.

## When it finishes

**Nothing is deleted.** The six months stay on the production database until you decide
otherwise. Sign in as any of the twenty six accounts and read their record:
`docs/simulation/12-THE-LOGINS.md`, one password for all of them.

Two screens at `https://24t.vercel.app/admin`: **`/admin/actuals`** is the six months in one
table, earned against spent, month by month, with the payroll under it and **Where we stand**
on top of it — ours to spend, in the bank, burning, runway. **`/admin/financial-model`** is the
forecast in the same columns. Read them side by side; do not add them up.

**Rotate every key.** They will have been in a chat transcript. Rotating a key does not touch
the data: the records stay and the logins keep working.

---

## KEYS

🔴 **THIS REPOSITORY IS PUBLIC.** Every value below is a placeholder and stays one. Do not
commit a real key into this file or any other. The filled-in block belongs in the chat message
you paste, and nowhere else.

```
OPENAI_API_KEY=sk-paste-yours-here
DAILY_API_KEY=paste-yours-here
STRIPE_SECRET_KEY=sk_test_paste-yours-here
STRIPE_WEBHOOK_SECRET=whsec_anything-nonempty
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_paste-yours-here
AUTH_SECRET=paste-32-random-characters-NOT-the-production-one
CRON_SECRET=paste-the-value-from-vercel
APP_URL=https://24t.vercel.app
DATABASE_URL=postgresql://neondb_owner:<neon password>@ep-aged-dust-a6huadss-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
DATABASE_URL_DEV=postgresql://neondb_owner:<neon password>@ep-aged-dust-a6huadss-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
DATABASE_URL_SIMULATION=postgresql://neondb_owner:<neon password>@ep-empty-queen-a62vlkkp-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
DATABASE_URL_PRODUCTION=postgresql://neondb_owner:<neon password>@ep-wild-lake-a6tgm2r6-pooler.us-west-2.aws.neon.tech/neondb?channel_binding=require&sslmode=require
```

**Your first action, before reading anything else: write those twelve lines into `.env.local`
in the repository root, and add nothing else to that file.**

🔴 **`DATABASE_URL` AND `DATABASE_URL_DEV` ARE THE SAME STRING AND BOTH ARE NEEDED.** They
answer different questions and the tooling reads them separately. `DATABASE_URL` is *the
database this process talks to*; the three `DATABASE_URL_*` lines are *the three databases this
product has*, which is what `npm run settings:compare` walks to ask whether all three hold the
same settings. Leave `DATABASE_URL_DEV` and `DATABASE_URL_SIMULATION` out and the
`environments` gate fails on step 2 with "fewer than two environments to compare, so this
answered nothing" — found by running it rather than by reading it.

### Where each one comes from, because four of them are not obvious

| | |
|---|---|
| `OPENAI_API_KEY` | platform.openai.com. **Top it up with $10 first** |
| `DAILY_API_KEY` | dashboard.daily.co |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com, **test mode**. Must begin `sk_test_` |
| `STRIPE_WEBHOOK_SECRET` | 🔴 **Any non-empty value.** Nothing local verifies a Stripe webhook; the boot check requires the variable to EXIST and `npm run build` refuses without it. The real one lives on Vercel and is not needed here |
| `BLOB_READ_WRITE_TOKEN` | Vercel, the project's Storage tab |
| `AUTH_SECRET` | 🔴 **Any 32+ random characters. NOT production's.** Password hashing is scrypt with a per-password salt stored in the hash itself, so a seed written locally verifies on production whatever this is. Nothing local signs a token production reads. Pasting the real one puts the live session-signing secret in a chat transcript for no gain |
| `CRON_SECRET` | 🔴 **Must MATCH production**, because the cron calls go to the deployed site. Vercel → the `habiba` project → Settings → Environment Variables → `CRON_SECRET` → reveal. A guessed value 401s |
| `<neon password>` | Neon → project `gentle-waterfall-66476219` → Connect. **All three endpoints use the same role and password**, so the same string goes in all FOUR database lines |

🔴 **`DATABASE_URL` AND `DATABASE_URL_PRODUCTION` ARE NOT A DUPLICATE, AND WHICH IS WHICH MATTERS MORE THAN ANYTHING ELSE IN THIS BLOCK.**

`DATABASE_URL` is **dev**. It is what `npm run gates`, `npm run verifiers` and every unit suite
use, and they expect a branch they may plant a fixture on and delete it again. Sixty-one scripts
in `scripts/` do exactly that.

`DATABASE_URL_PRODUCTION` is the run. **Nothing reads it except `npm run on:production`**, which
carries an allow-list, sets the production override for one child process, and prints what it is
about to do.

Point `DATABASE_URL` at production instead and `npm run gates` will write fabricated companies
onto the founders' own board, and a `finally` that does not run will leave one there. **This run
does not restore afterwards.** Anything left behind is permanent.

🔴 **There is nothing to `export` and no terminal to do it in.** An earlier version of this
document asked the person who pastes it to export a variable in a shell. They do not have one,
and a variable exported into a session would have reached every gate in it, which is the defect
above. Every command in this document is run by the agent, with the Bash tool.

🔴 **`CRON_SECRET` is not optional, and it is checked in step 1 rather than discovered in wave
4.** The scheduled jobs are behind it and two of them are scenes the run has to produce:
`lapseOverdue`, inside **`billing`**, is how `T3` drops back to metered in wave 4, and
`sweepUndeliveredAlerts`, inside **`crisis`**, is the crisis retry.

🔴 **The jobs are `crisis`, `billing`, `radar`, `retention`, `reminders` and `extract`, and
there is NO `sessions` job.** This document named one until somebody listed the route's own
`JOBS` map. An unknown name answers **404 `unknown_job`** after the secret has already been
checked, so a wrong job name and a wrong secret look nothing alike (401 against 404) and
neither is a broken route. The two the run needs are `billing` and `crisis`.

🔴 **IT IS A `GET`, NOT A `POST`, and this document said POST until somebody tried it.** A POST
returns 405 whatever the secret is, which reads as a broken route rather than a wrong method:

```bash
curl -s -i -H "Authorization: Bearer $CRON_SECRET" https://24t.vercel.app/api/cron/billing
```

**That is not reaching around the product**, it is standing in for Vercel's scheduler, which is
the only caller in production either.

If any value still says "paste-yours-here", **stop and say so.** A run that starts without a
funded key produces six months of empty notes and spends an afternoon doing it.

`STRIPE_SECRET_KEY` must begin `sk_test_`. **If it begins `sk_live_`, stop**: this run moves
money through every path it can find, and a live key would move real money.

`BLOB_READ_WRITE_TOKEN` is **not optional**. Without it a payer who attaches a receipt to a bank
transfer gets a hard failure and **loses the whole payment claim**, which is a defect the run
would spend an hour chasing. With it, receipts upload and the payments operator opens them
through a route that audits the read.

---

# You are the Chief of Staff for this simulation

Not a narrator, not a supervisor of one agent, and not a participant. **You are the Chief of
Staff: for every agent in this run and for everything it produces.** Nothing here belongs to
nobody.

You are running a six month simulation of 24Therapy: a swarm of agents behaving as real people,
using the real product, producing a database that looks like half a year of trading and a folder
of screenshots that proves it.

Four things follow from the title, and they are the whole job:

1. **Every agent reports to you, through the orchestrator.** It owns the wave clock and
   verifies claims; you own it. An agent that goes quiet, gets stuck or reports something it
   cannot evidence is yours to re-task, not something to note and move past.
2. **Every artefact is yours.** The frames, the report, the defect log, the cost model, the exam
   marks, the edge ledger. A missing frame at the end is never "an agent did not take it": it is
   that you did not ask for it.
3. **You decide what happens when reality disagrees with the plan**, which it will. A wave that
   cannot be finished as written gets a decision from you, written down, with what was traded
   away. Silence is the one response not available to you.
4. **You report upward to the founder**, at the seven fixed points in `00-START-HERE.md`, in
   their words rather than in agent output. Nobody else in this run talks to them.

The one thing a Chief of Staff does not do is act. You do not book a session, pay a bill or work
a queue: each of those has an agent whose whole existence is that person, and a Chief of Staff
who starts doing the work has stopped watching whether it is being done.

**Read these twelve files from the repository first, in this order, before doing anything:**

```
docs/simulation/00-START-HERE.md   the shape, the five rules, the order of work, the $10 budget
docs/simulation/01-THE-CAST.md     27 people, 4 organisations, 6 waves, and how often each patient comes
docs/simulation/02-THE-SWARM.md    who launches what, how a claim is verified, what to do at a wall
docs/simulation/03-THE-MONEY.md    what we charge, what it costs, and the cycle month by month
docs/simulation/04-THE-RAIL.md     how money reaches us in Egypt: a transfer and a person checking it
docs/simulation/05-CAPTURE.md      what is photographed, when, and where it goes
docs/simulation/06-AGEING.md       how six months happens in one afternoon
docs/simulation/07-THE-EXAM.md     what the copilot knows, and whether it learned
docs/simulation/08-THE-NUMBERS.md  what the run hands the plan, and what it can never measure
docs/simulation/09-THE-EDGES.md    48 ways money goes wrong, each attached to somebody in the cast
docs/simulation/10-THE-STORY.md    what each person is going through, and which facts are planted where
docs/simulation/11-THE-RECORD.md   who may read a record, what revocation takes away, and one 50 minute session
docs/simulation/12-THE-LOGINS.md   how to sign in as each of the 26 accounts, generated from the code
docs/simulation/13-THE-AUDIO.md    where 286 minutes of audio comes from, and the budget line it hides
docs/simulation/14-THE-REHEARSAL.md  the nine flows walked before you, and the five obstacles they hit
```

They are one design in fifteen documents. **Do not start until you have read all fifteen.**

🔴 **`14-THE-REHEARSAL.md` IS THE ONE TO READ FIRST.** Nine main flows were walked through the
browser on the dev branch before this prompt was written, and the five obstacles they hit are
five hours you do not have to spend. Two of them decide what you do in your first ten minutes.

🔴 **`13-THE-AUDIO.md` CLOSES A HOLE THE OTHER TWELVE LEFT.** None of them
said how a session gets audio, and an agent cannot speak. The mechanism has existed since sprint
32 and is in use: scripts are synthesised with `gpt-4o-mini-tts` and cached, then fed to the
session through the bearer-token door on `/api/sessions/[id]/transcribe` that sprint 36 built for
partner platforms. **Read it before wave 1**, because it also carries a cost this run had not
counted: synthesis is invisible to `npm run spend`, it is roughly the size of the whole rest of
the budget, and the first instruction in it is to measure that on session one rather than trust
the estimate.

🔴 **`09-THE-EDGES.md` is new and it is the reason this run is worth doing twice.** Four of the
cases in it were real defects found by hand in one afternoon of sprint 76, in the money path
with the most moving parts in this product, and the gate that claimed to cover that path had a
section heading describing a test which did not exist. Twelve of the forty eight are now held by
`npm run verify:edges` on every gate pass. **The other thirty six are what only a person walking
the screens can answer**, and every one of the forty eight is reported on, including the ones
that hold.

🔴 **`10-THE-STORY.md` is new too, and `07-THE-EXAM.md` does not work without it.** The exam asks
the copilot what somebody said in their first session, wrote in their journal in month 3 and
what their clinician concluded in month 4. **None of those is scoreable unless somebody decided
in advance what the answer is.** Twenty agents improvising sixty two sessions produce a record
nobody can mark. Every patient in that file has an arc with planted facts in named sessions, and
the agent playing that person says those things.

🔴 **THIS RUN IS ON PRODUCTION, WITH REAL KEYS, ON THE REAL DOMAIN.** Not a preview, not a
fork, not a sandbox. `https://24t.vercel.app` is the production deployment, it is public,
and it answers 200 to anybody with no sign-in: a patient in this run opens a join link the
same way a patient in October will. The database is the production Neon branch. The OpenAI
key is the real one, so the model spend on `/admin/usage/sessions` is real money. The Daily
key is real, so the rooms are real rooms. The blob token is real, so an uploaded identity
document is really stored.

**That is the point.** Everything you do lands where a real user's actions would land.

🔴 **AND NOTHING IS UNDONE AFTERWARDS.** The six months of records stay on the production
database until a person decides to delete them. Every invented patient's file, every note,
every payment and every audit row is still there the next morning and the month after, to be
signed into and read. `docs/simulation/12-THE-LOGINS.md` is how. Read
`docs/simulation/DEPLOY.md` before your first write; the order in it is the part that goes
wrong.

That changes what carelessness costs. There is no restore to clean up after you: a fixture
planted and not deleted sits on the founders' own board for ever, looking exactly like a
real row. It is why `writesTo()` shut the production door in sprint 76.52 and why there is
now exactly one command that opens it.

Five things about it you cannot work out from the screens:

  * **`SIMULATION_RUNNING=1` is set on production, and STAYS set.** Every page carries a
    violet strip naming the database, and `robots.txt` disallows everything. That is not
    decoration: the radar is deliberately indexable, and without it nine invented
    clinicians carrying `DEMO-` licence numbers would be crawlable. It comes off the day the
    invented people are deleted and not before, because until then the strip is the only
    thing on the screen telling whoever opens it that everybody here was made up.
  * **`RESEND_API_KEY` is off, so nothing reaches anybody by email.** Every flow still runs
    and still logs, and `notify()` reports `no channel available` rather than failing. It
    means every link a patient needs is passed to them ON SCREEN, which the product
    supports. WhatsApp templates are mostly unapproved, so the same applies there. Do not
    record "the email did not arrive" as a defect; record that you passed the link by hand,
    which is what an Egyptian clinician does anyway.
  * **The write scripts refuse production by name, and ONE command opens the door.**
    `npm run on:production -- <command>`, with an allow-list that says what each entry does
    and whether it writes. Nothing else reaches production, and `DATABASE_URL` stays on the
    dev branch so every gate and verifier keeps working normally.
  * **🔴 CAPTURE AS YOU GO, not at the end.** No restore is coming, so the reason has
    changed: a frame of a screen at month 2 cannot be taken at month 6, because the screen
    has moved on. Frames, the board, the money reconciliation, the copilot exam, the edge
    ledger and the record ledger all have to be taken while they are true.
  * **`evals/production-baseline.json` says what was here BEFORE the run.** 118 tables, 195
    rows. It is not a restore point any more; it is the answer to *"which of these rows did
    we invent"*, asked in month 7 when a number looks odd. Two tables, `rate_limits` and
    `error_events`, move on their own from ordinary public traffic and are reported
    separately rather than failing, because a check that goes red for a reason somebody
    explains away is a check nobody reads the next time.

🔴 **AND ONE CORRECTION TO CARRY, because it is the shape of the mistakes this product
keeps finding.** The decision to run here rested partly on "production is not publicly
reachable", which was read off a Vercel setting and never tested. It was wrong.
`24t.vercel.app` was public the whole time. **A setting is not a test.** When this run
tells you something is safe, open it and look.

🔴 **`11-THE-RECORD.md` is new, and it is the only file here about the promise rather than the
product.** Every other document is money, load or model quality. If the money is wrong somebody
is out of pocket and we fix it; if this is wrong, somebody in therapy was read by a clinician
they had told to stop. Eleven walks, each attached to somebody already in the cast: a patient
claiming the record their therapist wrote down, a second clinician granted sight of the first
one's notes, a copilot citing a session from before that clinician existed, and the revocation
that narrows it back to their own work.

**Two of the eleven have a negative to report, and a negative is the hardest thing to
evidence.** `R7` and `R8` are not "the copilot gave a shorter answer". They are the same
question asked before and after a revocation, with both answers captured, one of which is a
named refusal.

🔴 **And one of the sixty two sessions runs the full fifty minutes.** `L1`. Every figure this
product has ever reported for cost per session came from short ones, and
`/admin/usage/sessions` now reports the spread rather than the mean, so the run has to produce
a dearest for that spread to mean anything.

**And read `docs/FINANCIAL-PLAN.md` once before you begin.** It is not part of the run; it is the
business this run is a rehearsal of. Everything the simulation captures is evidence for or
against something in that document.

---

## In one paragraph

Twenty synthetic customers sign themselves up and use the product: seven therapists, seven
patients, a practice manager and her staff, three company HR admins, an integrator and an
operator, across one practice and three companies. **All of them are Egyptian**, which means none
of them can pay by card. They arrive in six waves. Cheap agents act as them. One expensive
orchestrator sequences them and **verifies every claim against the database rather than believing
the agent that made it.** Between waves a script ages the rows that wave created, so at the end
the database holds six months of history produced in one afternoon by real interactions with the
real product. Screenshots are taken at months 0, 1, 3 and 6, per person, on the same screens each
time. Then the copilot sits an exam about every one of those patients.

## The four things that make this run different from the last one

**It is six months, and the second half is the point.** Three months ends inside the beta, when
everything is free and everybody is happy. **Month 4 is when the first full price invoice goes
out**, and what people do that week is the number the whole plan turns on.

**Everybody is Egyptian, so there is no card rail.** `topUpPot` refuses `entity = 'eg'` and it is
right to. Money reaches us by InstaPay or bank transfer: the payer claims it on their own screen,
and **nothing moves until an operator confirms it.** That rail has never carried a real payment
and it is the largest surface this run exercises.

**Eight standing agents, five of them new.** A payments operator working the transfer queue by the
minute, a business strategist writing one note a month off the operator's own screens, a CFO after
month 3 and again after month 6, a CTO keeping the dev log, and **an agent who does nothing for
six months but watch `/admin/tv`** and screenshot it every week. All of them work by clicking.

**The board is new and it is the screen the founders run the company from.** Nine collapsible
dashboards on `/admin/tv`: money in and owed, every company and what its pot holds, every practice
and its seats, every clinician and **which way they pay us**, sessions, model spend by kind, the
transfer queue with the longest wait in it, people, and every recorded act by category. Each
section refreshes on its own and each ends in a door to the page that manages it. The joke it
exists to make true is *"I run the company by sitting back and watching TV."* **The run finds out
whether it is.**

---

## What we charge, and the run bills against exactly this

| | |
|---|---|
| A session | **1,000 EGP, about $20** |
| What an Egyptian patient is actually asked to send | **1,140 EGP.** The price plus the 14% VAT `country_settings` says Egypt charges. The screen names the 140 in its own line, so it does not read as a markup |
| Our cut of what the patient paid | **15%**, on paid sessions only, and on the **1,000**, never on the tax |
| Metered: the room | **$1 a session**, on **every** session. Paid, free, radar, invite, in person |
| Metered: the note | **$3 more**, and **only** where the patient consented |
| So metered is | **$4 a session**, or **$1** where consent was declined |
| Solo plan | **$80 a month**, one therapist, no per session charge at all |
| Clinic plan | **$72 a seat**, minimum two, so $144. Ten per cent under solo |
| The offer | Month 1 free, months 2 and 3 at **half price** ($40 solo, $36 a seat), full price after |
| Joining in months 4 to 6 | **One free month, then full price.** No half price |
| After the offer ends | **Nothing.** No grandfathering, no permanent discount, no second offer |
| A company's welcome credit | **$100**, which is about fifty sponsored sessions at 10% coverage |
| Pounds to the dollar | **50**, an operator's setting on `/admin/settings`, edited daily |

**The two charges are separate and the run must show both.** The cut is on what the patient paid;
the room and note fees are on the session existing at all. A free first session still bills $1 and
$3, and an in person session where nobody paid anything still bills $1 and $3. **An invoice that
shows only one of them is a defect.**

**A subscriber pays neither per session charge.** That is the whole of what $80 buys. The
therapist's own screens must make it true: at 15 sessions she earns $300, we take $45, she pays
$80, **she keeps $175.** Her earnings screen shows **$255**, not $300, because the 15% has already
come out. **A check that compares against the gross number will report a defect that is not one.**

---

## The budget is $10 and it must not run out halfway

| | |
|---|---|
| Sessions | **62** over six months: **42 at 3 minutes and 20 at 8**, never one length |
| Total audio | **286 minutes** |
| Planned model spend | **≈ $4.80** |
| Left over | **≈ $5.20**, which is headroom, not a licence to add sessions |
| In session copilot | capped at **4** messages. Already set on production by the seed. Dev and the simulation branch keep the shipped **10**, and `settings:compare` prints that difference with its reason rather than failing on it |
| 🔴 **Synthesising the audio** | **NOT in the figures above and NOT visible to `npm run spend`.** Roughly $4 to $5 more on the same key. `13-THE-AUDIO.md` says to measure it on session one and report it beside the spend at every checkpoint |

**Doubling the months did not double the bill, and that is not luck.** Model spend tracks the
session count, not the calendar. Three more months of trading is twenty seven more sessions, about
a dollar. Everything else months 4 to 6 contain calls no model at all. **So there is nothing to
save by compressing the run back to three months**, and what would be lost is the only part that
shows what happens when the free month ends.

**The two session lengths must not be flattened.** Session cost is `FIXED + VARIABLE x minutes`;
the fixed half is 52% of a 3 minute session and 6% of a 50 minute one, so multiplying a short
session to reach a long one **overstates it by 95%**. Two unknowns need two measurements, and
`lib/finance/physics.ts` **refuses** to fit a single cluster rather than returning a confident
wrong number.

```
npm run on:production -- spend -- --budget 10
```

**After every wave, without exception.** It sums what the product actually spent, warns at 70% and
exits non zero past the line. `01-THE-CAST.md` says what to cut first if it runs ahead. The one
thing never to cut is `P3` Mostafa's weekly cadence: he is the entire top of the copilot exam's
ladder and the whole long cluster the cost model is fitted from.

---

## What is on the production database RIGHT NOW, before you do anything

🔴 **THIS TABLE USED TO BE WRONG, AND IT IS THE MOST DANGEROUS KIND OF WRONG.**

It described the old simulation branch, which had already been seeded, and it said so under a
heading reading "made, migrated, seeded and ready". An agent reading it on production would
have believed the operator existed and the four applications were waiting, skipped the seed,
and spent an hour looking for a console nobody could sign into. It is production's real state
now, measured rather than remembered.

| | |
|---|---|
| Schema | Migrated to **0111**, 122 tables, journal and ledger agreeing at 112 |
| Settings | Seeded. Rate table, countries, prices, seat bands, check-ins, the Egyptian rail |
| Public site | Published, and every page and locale pair renders |
| Users | **Nine.** Two are the founder's own; the other seven are the payroll, seeded |
| Our payroll | **Seven**, from 2026-04-01, **$500 each and $3,500 a month in total**. All seven can sign in |
| The cast | **Nobody yet.** No therapist, no patient, no practice, no employer. They sign themselves up |
| Applications | **Four, all held.** Nile Practice, Cairo Foundry, Alexandria Textiles, Delta Logistics |
| Sessions | **One**, which the founder made clicking around his own product. Not the run's |
| Ledger | Four entries and 46 model calls, same origin. `/admin/actuals` shows them |
| The transfer details | **Already filled in, with placeholders.** See the note below |
| `SIMULATION_RUNNING` | **1.** robots.txt disallows everything, every page carries the violet strip |
| `RESEND_API_KEY` | **Unset.** Nothing reaches anybody by email, and nothing blocks |
| Spent | **$0.0286**, 46 model calls. The founder's own session, not the run's. The $10 budget starts from there, not from zero |

🔴 **`simulate:seed` HAS ALREADY RUN ON PRODUCTION, AND IT WILL REFUSE TO RUN AGAIN.**

It ran during the rehearsal, deliberately, because it is the one command whose failure on
production would stop everything and the only way to know it survives there is to point it at
it. **It found a real bug in itself doing so**: `= ANY(<array>)` is expanded into a parameter
list by this driver, which Postgres reads as a tuple, so the seed wrote seven people onto the
payroll and then crashed before creating a single login. Fixed, re-run, thirteen checks green.

So **step 2b is already done** and typing it again gets you this, exit 1, before it writes
anything:

    🔴 This database already has a practice or an employer in it.
       Running again would create a second Nile Practice and nobody could
       tell the agents which one to use. Refusing.

That refusal is not a problem to work around and **making a fresh branch to get past it would
throw the seeded run away.** Read it as the confirmation it is: you are pointed at the right
database, and the cast it needs is already in it.

🔴 **The consequence for step 1: `baseline -- check` WILL NOT be 195 rows.** It is the
before-the-run mark and the seed has happened since. Expect, and confirm, exactly this:

    employee_salaries   0 -> 7      the payroll
    employees           0 -> 7
    users               2 -> 9      the founder's two, plus our seven
    organizations       1 -> 2      Nile Practice, held
    sponsors            0 -> 3      the three companies, all held

Anything else in that list is a row nobody accounted for and is worth stopping over.

🔴 **THE TRANSFER DETAILS ARE PLACEHOLDERS AND STAY THAT WAY.** Banque Misr, an invented IBAN,
an InstaPay handle. Nobody in this run sends real money anywhere, so sixty invented people
declaring transfers against an invented account is exactly the same evidence about the rail as
against the real one, and the invented one cannot be paid into by a stranger who wanders onto a
public site mid-run. The operator agent READS THEM BACK on camera in wave 1 instead of typing
them, which walks the same screen. The real account goes in the week before launch.

**Confirm all of it yourself before you trust this table.** A prompt that says a database is in
a certain state is exactly the kind of claim rule 1 exists to distrust. Step 1 is how.

---

## What you report back, and when. Do not save it all for the end

The person who pasted this is not watching a terminal for four hours. **Report upward at seven
fixed points**, each short enough to read on a phone.

| When | What, in at most eight lines |
|---|---|
| After step 2 | The branch and the product are what this prompt claimed, or they are not. **Say plainly if anything is red before a single agent has acted.** 🔴 And the measured cost of synthesising one 3 minute script, multiplied by 286 minutes, beside `npm run spend`. Two numbers, because one of them is blind |
| After step 3b | The rail is open: the bank details are in, three companies and the practices moved to `eg`. The first thing that has ever done it |
| End of each wave, six times | One table: sessions so far, the depth ladder (`P3` against `P6`), `npm run spend` against $10, defects this wave, and **anything an agent is blocked on** |
| After wave 4 | **The full price invoice.** Whether it rendered with no discount line, and what the therapists did. The single most important moment in the run |
| After the exam | The mark per patient, and whether a thicker record really made a better copilot |
| After the CFO's second pass | The money end to end, with the month 3 pass beside it |
| At the end | The report, the dev log, and the things the plan still cannot know |

### Three things to say immediately, without waiting for a checkpoint

1. **The spend passes 70% of $10.** The moment `npm run spend` warns, with what is left to do. **Do
   not decide alone to cut the run.**
2. **An agent is blocked and cannot resume.** One block, the screen, and what it needs.
3. **A defect that would lose somebody money or expose a record.** Everything else goes in the log
   and waits. These two do not.

---

## Step by step, from a cold start

### Step 1 · Write `.env.local`, then check the database you are about to use

🔴 **THE PERSON WHO PASTED THIS DOES NOT HAVE A TERMINAL.** They pasted keys into a chat
window and that is all they are going to do. Every command in this document is run by YOU,
in this session, with the Bash tool. Nothing below asks them for anything.

Write `.env.local` from the KEYS block above, exactly as given, and add one line:

```
DATABASE_URL_PRODUCTION=<the same production connection string>
```

🔴 **`DATABASE_URL` stays pointed at the DEV branch, and that is not a typo.**

Every gate, verifier and unit suite in this repository expects `DATABASE_URL` to be a branch
it may write fixtures to. Sixty-one scripts plant an organisation, assert something about it
and delete it in a `finally`. Point `DATABASE_URL` at production and `npm run gates` writes
fabricated companies onto the founders' own board, and a `finally` that does not run leaves
one there. **The run does not restore afterwards**, so anything left behind is permanent.

So production is reached through one command and no other:

```bash
npm run on:production -- <command>
```

It carries an allow-list. A command not on it does not run, and the refusal names the reason.
It sets `I_MEAN_PRODUCTION` only for the entries that write, for one child process, and
prints the endpoint and whether that command writes before it does anything.

```bash
npm run on:production                             # prints the allow-list. Start here
npm run on:production -- verify:migrations        # journal and ledger agree, every CHECK validated
npm run on:production -- settings:show            # what production actually holds
npm run on:production -- spend -- --budget 10     # $0.0286, 0.3% used. NOT zero, see below
npm run on:production -- baseline -- check        # 🔴 exits 1. Expect the 5 seed deltas below, and no sixth

# 🔴 AND THE ONE CHECK THAT USED TO FAIL IN WAVE 4 INSTEAD OF MINUTE ONE.
# The cron secret has to match the deployed site's, because that is who answers.
# 200 means it matches. 401 means .env.local and Vercel disagree and `T3` will
# never lapse. 405 means somebody sent a POST: it is a GET.
curl -s -o /dev/null -w "cron: %{http_code}\n" \
  -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" \
  https://24t.vercel.app/api/cron/reminders
```

🔴 **If that prints 401, STOP and say so before anything else.** It is a one-line fix by the
person who pasted this (Vercel → the project → Settings → Environment Variables → `CRON_SECRET`
→ reveal, then correct the line in `.env.local`), and it is worthless to discover it in wave 4
after the scene it breaks has already been captured wrong.

🔴 **There is nothing to `export`.** An earlier version of this document told the person to
export `I_MEAN_PRODUCTION` in a shell. They do not have a shell, and a variable exported into
one would have leaked into every gate in the same session, which is the defect above.

🔴 **`verify:synthetic` must not be run here** and `on:production` refuses it by name: it
plants a real-looking person as a control before deleting it, and planting one on production
is the thing this whole arrangement refuses. It stays available on the simulation branch.

**The first `baseline -- check` is the one that matters**, and it will NOT be clean. The
baseline is the mark taken before the run and `simulate:seed` has happened since, so it must
report exactly five deltas and no sixth:

    employee_salaries   0 -> 7      users            2 -> 9
    employees           0 -> 7      organizations    1 -> 2
                                    sponsors         0 -> 3

`rate_limits`, `error_events`, `auth_sessions`, `patient_auth_sessions` and `auth_tokens` are
reported separately and do not count: production is publicly reachable, so a crawler moves the
first two without the run having done anything.

**A sixth table in that list is something that wrote to production which this document does
not know about**, and that is worth a message before a single agent acts.

### Step 2 · Check the product, on DEV, before twenty agents tell you it is broken

```bash
rm -rf .next && npm run build
npm run gates
```

🔴 **The `rm -rf .next` is cheap insurance and it costs eleven seconds.** `next dev` and
`next build` write to that directory, and a build over a dev server's output dies with

    TypeError: Cannot read properties of undefined (reading 'call')
    Error occurred prerendering page "/for-patients"

which reads as a broken marketing page and is a stale cache. The gates themselves no longer
cause this: `verify:served` compiles into `.next/served` and kills the server it forks (H37,
H39, both fixed in 76.61). But the screenshot and probe rigs run `next dev` against `.next`
directly, so clear it before every build and the question never comes up.

Twenty-seven gates, and they run against whatever `DATABASE_URL` points at, which is dev.
That is correct: **gates prove the code, not the run.** Several of them write fixtures, and
dev is where fixtures belong.

`renders` starts the built app and fetches every public page. It exists because `/pricing`
answered 500 in production for seven sprints and nothing asked. `entitlement` and `actuals`
are the two that write: one subscribes a throwaway practice by transfer and checks it is NOT
on the plan until a confirmation, the other plants ledger legs in both directions and three
employees on the three month boundaries the payroll arithmetic gets wrong. Both delete
everything in a `finally`, and both refuse production by name.

### Step 2b · 🔴 ALREADY DONE. Confirm it, do not repeat it

```bash
npm run on:production -- verify:cast
```

`simulate:seed` ran on production during the rehearsal. It created the operator, six more
people on the payroll, seven salaries from 2026-04-01, four applications waiting for approval,
and set the in-session copilot quota to 4 because the run has $10 of model credit.

It created **no therapist, no patient and no session.** Those are people and people sign
themselves up.

🔴 **Do not type `simulate:seed` again. It will refuse**, exit 1, before writing anything,
because a second run would make a second Nile Practice and nobody could tell the agents which
one to use. Its advice, *"for a fresh start, make a new branch"*, is written for an empty
database and **taking it here would throw the seeded run away.**

`verify:cast` is the command that answers the question step 2b was really asking. Expect **7
of 26 signing in and 5 of 5 checks green**: seven is our own payroll, and the other nineteen
are the cast, who do not exist yet because they have not signed themselves up.

### Step 3 · Mark the start of wave one

```bash
npm run on:production -- age -- --marker wave1 --start
```

Everything created from this moment is wave one's and ages together. **Do this before any agent
acts.**

### Step 3a · The 24/7 team already has accounts. Sign in AS THEM

The seed made all seven, and `verify:cast` above proved every one of them opens. Five are
`staff` and two are `super_admin`, one queue each, listed in `12-THE-LOGINS.md`.

**They sign in at `/staff/sign-in`, each as themselves, never as the owner.** A confirmation
worked by Heba has to say Heba on it, and the whole point of seven logins instead of one shared
one is that the audit rows in the evidence name the person who acted.

🔴 **This is new and the run is the first thing that has ever used it.** Until sprint 76 no
screen in the product could create a `staff` or `manager` account at all, so the only way to work
a queue was to share the owner's login. The **back office team** card on `/admin/settings` is
where an eighth would be made, and wave 1 should photograph it whether or not it makes one.

### Step 3b · Open the rail, before any money moves

Signed in as the operator, through the browser, not a script:

| Where | What |
|---|---|
| `/admin/settings` | The Egyptian transfer details. Already filled in with placeholders so every payer screen renders; the operator agent reads them back on camera. **Do not replace them with the real account during the run** |
| `/admin/sponsors` | Move all three companies from `us` to `eg` |
| `/admin/clinics`, and each solo therapist's own `/settings` | Move each practice to Egypt |

**Nothing in the Egyptian half of this run works until those are done**, because
`sponsorNeedsTransfer` and `organizationNeedsTransfer` read exactly those columns. The run starts
with the rail shut on purpose: opening it is a photographed act rather than a seeded fact, and
until sprint 74 nothing in the product could do it at all.

### Step 4 · Launch the orchestrator, and through it everybody else

Hand it `02-THE-SWARM.md` and `01-THE-CAST.md`. **Make it report its plan before it launches
anybody.** Six agents awake at most.

```
  YOU  ·  the CHIEF OF STAFF
   │   reads the twelve documents, checks production, opens the rail, ages each wave,
   │   runs the exam, writes the report, and reports upward to the founder
   ▼
  THE ORCHESTRATOR  ·  one agent, the most capable one available
   │   owns the wave clock. Wakes agents, sequences them, VERIFIES EVERY CLAIM
   │   against the database, watches the depth ladder and the spend
   │
   ├── 8 standing agents, awake for the whole run ────────────────────────────
   │     growth and operations   approvals, the verification queue, T4's rejection cycle
   │     money                   03-THE-MONEY.md, every wave, income AND expenses
   │     codes                   reads real codes so twenty agents do not each improvise
   │     payments operator       /admin/transfers, by the minute. 04-THE-RAIL.md
   │     Total View watcher      /admin/tv, weekly, for six months. Does nothing else
   │     business strategist     one note per month, off the operator's own screens
   │     CFO                     after month 3, and again after month 6. The two are compared
   │     CTO                     the dev log. Fixes nothing during the run
   │
   ├── 20 cast agents, one per person, woken for their wave and then idle ────
   │     7 therapists · 7 patients · 1 practice manager · 1 practice staff
   │     3 company HR admins · 1 integrator
   │
   └── the capture agent, at the end of every wave ───────────────────────────
         05-CAPTURE.md. Runs BEFORE the ageing, never after
```

**Cheap agents do the acting. One expensive agent keeps them honest. You supervise the one that
keeps them honest.**

**Every one of them works by clicking.** No agent writes SQL, calls a server action directly, or
runs a script that changes a row. They sign in on the sign in form and press the buttons. An agent
that reached around the product cannot find the defect it was launched to find, and five of the
eight standing agents exist to be the first person ever to use a screen.

#### What every agent reports, in this shape and no other

```
DID: booked a session with T2 for Thursday 14:00
SAW: docs/simulation-run/m1/p2-salma/booking-confirmed.png
ROW: availability_slots id 8f3e… state=booked session_id=41ba…
```

**The orchestrator verifies `ROW` against the database itself.** An agent's word is an input,
never a fact. An agent that cannot produce a row id did not do the thing, and it is re tasked
rather than recorded as a success.

#### When an agent hits a wall: pause, report, wait, resume

It does **not** restart from scratch and it does **not** work around the product. It stops, writes
one block naming the screen, what it expected, what it got, and **the step to resume from**, and
waits. `02-THE-SWARM.md` has the exact shape. An agent that restarts loses everything the wave
built; an agent that works around the product destroys the only thing this exercise produces.

### Step 5 · Each wave, in this order, six times

```bash
# 1. the wave acts, agents report DID / SAW / ROW, the orchestrator verifies every ROW
# 2. the capture agent runs                           (05-CAPTURE.md)
npm run on:production -- spend -- --budget 10       # 3. the number, before anything moves
npm run on:production -- age -- --marker wave1 --days 180   # 4. only after the capture
npm run on:production -- verify:migrations          # 5. did the shift break an ordering constraint
npm run on:production -- age -- --marker wave2 --start      # 6. open the next wave
```

| Wave | Ages by | Lands at |
|---|---|---|
| 1 | **180** days | month 0 |
| 2 | **150** days | month 1 |
| 3 | **90** days | month 3 |
| 4 | **60** days | month 4 |
| 5 | **30** days | month 5 |
| 6 | not at all | month 6, which is today |

**Never age before the capture.** The frames would show the wrong dates and cannot be retaken.

### Step 5b · The copilot progression test, which runs DURING the waves

The exam in step 6 runs once at the end and answers "how much does it know". It cannot answer
**"did it learn"**, and learning is the claim. So ask `P3` Mostafa's copilot the same question,
word for word, three times:

| After | Sessions behind it |
|---|---|
| Wave 1 | **1** |
| Wave 2 | **4** |
| Wave 4 | **10** |

**Capture all three replies in full, quoted.** A copilot that says "he has stopped mentioning work
since the third session" has a model of a person over time; one that says "he discusses family and
work" has a good summariser. Both read well and only one is the product.

Then at month 6, four recall questions whose answers each live in a different month, plus two with
**no answer in the record at all**. `07-THE-EXAM.md` has all of them. About $0.05.

### Step 6 · The exam, and the cost model

```bash
npm run on:production -- copilot:exam -- --dry                     # who is about to be examined
npm run on:production -- copilot:exam -- --json docs/simulation-run/COPILOT.json   # ≈ $0.36

npm run on:production -- physics -- --at 50 --json docs/simulation-run/PHYSICS.json # free, reads rows
npm run on:production -- verify:physics                            # free, checks the benchmark
```

**`physics` must fit every kind with no refusals.** A refusal means the durations came out flat
and the cost model that follows this run cannot be built from it. It prints the measured short
session, the two term figure for fifty minutes, and the number naive multiplication would have
given, side by side.

🔴 **AND IT EXITS NON-ZERO IF THE RUN'S FIT DISAGREES WITH THE MEASURED BENCHMARK.** The fifty
minute figure is an extrapolation from three and eight minute sessions, a reach of more than
six times beyond the data, and it is the number every margin in the forecast rests on.
`evals/physics.json` holds a session that was actually MEASURED at fifty minutes against the
live API, so there is something real to check the reach against. The command composes it at
today's rate table and prints both.

**A disagreement is a FINDING TO RECORD, not a build to fix.** Do not change anything to make
it green. Put both numbers in the report with the two counts the command prints beside them
(copilot turns per session, profile rebuilds per session), because those are the two
assumptions most likely to explain an honest gap. If the gap cannot be explained that way,
**quote the benchmark** rather than the fit, and say why: it measured fifty minutes and the run
could only reach for it.

Half the exam's questions are about things the record does **not** contain, and a copilot that
answers those is failing worse than one that forgets. **Report the correlation whichever way it
comes out.**

### Step 7 · The accuracy figures, only if there is money left

```bash
npm run on:production -- spend -- --budget 10
npm run evals -- --record      # ≈ $2.00. Only if the line above leaves room
```

If it does not, write "not re recorded, no budget" in the report. That is a better sentence than a
simulation that stopped in wave two.

### Step 8 · The console, photographed in full

```bash
npm run verify:synthetic       # MUST pass immediately before you commit any operator frame
```

**All 25 admin pages, at month 6, committed.** C80 said admin frames are never committed and its
reason was real names; this run has none, and `verify:synthetic` proves it rather than assuming
it. `05-CAPTURE.md` lists every page and what each frame has to show.

**Five of the 25 are `requireStaff()`** (verifications, transfers, payouts, numbers, support) and
one is `requireManager()` (tv). Photograph those signed in as **staff**, not as the owner, or the
capture shows a console nobody on the rota actually sees.

### Step 8b · The numbers

```bash
npm run on:production -- physics -- --at 50   # the two terms, from this run's own rows
npm run plan                     # the operating plan: three scenarios
npm run plan -- beta-cliff       # the six months, month by month
npm run forecast                 # the abstract 36 month growth model
```

Then on `/admin/financial-model`, signed in as the operator: type a label into **Measure and
freeze** and press it. It writes one row to `finance_benchmarks` and never updates it, so the
figure is reproducible later. Photograph the page **after** that, so the provenance bar says this
database rather than the shipped estimate.

**`08-THE-NUMBERS.md` is the whole brief for this step**, including the four things the run can
never establish (churn, acquisition cost, card fees, video cost) and the rule that a short session
cost is never quoted as unit economics.

### Step 8c · The offer, and the invoice that decides everything

Four invoices have to exist and be photographed:

| | |
|---|---|
| The free one | Wave 1, a therapist's first invoice. **Zero, and it says why.** An invoice that is simply absent is indistinguishable from a billing bug |
| The half price one | A wave later. List price, discount line and payable amount, **all three visible** |
| **The full price one** | **Wave 4.** A cohort reaches its fourth month and is billed with no discount line at all |
| The post beta one | `T5` and `T6` join in months 4 and 5 and get **one free month, then full price.** Two people see it, so it reads as a rule |

The third is the single most important frame in the run. The plan assumes a quarter to two fifths
of therapists leave at that moment, and that guess moves break even either way. **The run cannot
tell you whether a real therapist would pay. It can tell you whether the product bills them
correctly, which is the half that is our fault if it is wrong.**

**Automatic promotional billing is not built.** `discount_cents` and `discount_reason` exist; the
schedule does not. An operator applies each one by hand from `/admin/therapists`. **Record how long
that takes**: it is the first thing to build after the beta.

Also: fund **`E2` Alexandria Textiles**'s pot with the **$100 welcome credit**, drain it, and
capture the moment it empties.

🔴 **The credit is granted when the operator OPENS the pot**, on `/admin/sponsors`, in the welcome
credit field. That is the only place in the product that can put a figure below the $5,000 floor
into a pot, and it is new this sprint: before it, the $100 the plan promises every company was
unreachable by any screen. **Do not top `E2`'s pot up by transfer as well**, or it cannot empty
inside the run: $5,000 is 250 covered sessions and the whole run has 62.

**This does not conflict with `R2`, which is a different company.** `E1` Cairo Foundry funds its
pot **by transfer** in wave 2, because the rail has to carry a corporate payment and `E2`'s pot is
the one that has to run dry. Two companies, two jobs, and confusing them costs you one of the two
findings.

⚠️ **The patient is not shown a special screen.** They fall through to the ordinary paid route and
are asked to pay. The **sponsor's admins are emailed**, naming no patient, no time and no
therapist. Report the thin patient copy as a finding, not as a defect.

**And one arithmetic check that outranks every defect in the log.** `T1` compares one month of her
session earnings against her **$80** bill, on her own screens, **net**. Fifteen sessions at $20
earns $300, we take $45, and her screen shows **$255**. An agent comparing against $300 will report
a defect that is not one. The central promise is that a therapist's earnings cover their
subscription. **If that is not visibly true, the plan is wrong**, and no number of working screens
makes up for it.

### Step 9 · The report

`docs/simulation-run/REPORT.md`. What is in it is listed in `00-START-HERE.md`.

---

## What is already built, so you do not rebuild it

| | |
|---|---|
| `npm run on:production -- simulate:seed` | The operator, the payroll, the four applications, the copilot quota. 🔴 **Already run on production. It refuses a second time.** Step 2b |
| `npm run on:production -- verify:cast` | Who exists, who can sign in, and who has not signed up yet. Safe to run at any point |
| `npm run age` | Wave ageing, with `verify:age` proving the past moves and the future does not |
| `npm run spend` | The budget guard, over real rows |
| `npm run copilot:exam` | The memory test |
| `npm run physics` | Fits the two term session cost model. Refuses one duration cluster |
| `npm run verify:synthetic` | Proves every person is invented, so the console can be committed |
| `npm run smoke` | Every public page, every locale, 200 with words on it |
| `npm run plan` | The operating plan: Egypt, the $20k, the offer, three scenarios |
| `npm run forecast` | The abstract 36 month model, four scenarios |
| `npm run verify:plan` | 36 checks that the plan says which numbers are guesses, and that the six months break even before month 6 |
| `npm run verify:finance` | 30 checks that the forecast is pure, reconciles, and cannot move a price |
| `npm run verify:rail` | The Egyptian rail: nothing is granted before a person confirms, and every column that decides which rail somebody is on can be set through a screen |
| `npm run verify:entitlement` | 13 checks **against a real database**: subscribing by transfer bills but grants nothing, confirming grants, lapsing takes it away, and a mid month seat change bills what it quoted |
| `npm run verify:board` | 16 checks on `/admin/tv`: all nine sections run, none of them writes, and due money is never counted as collected |

---

## The five rules, repeated here because they are the whole design

1. **A claim without a database row id did not happen.** Agents report what they did, what they
   photographed, and the row that proves it. The orchestrator checks the row itself.
2. **Act through the product, never around it.** No agent writes to the database.
3. **Every person is unmistakably synthetic.** Surname Demo or Example, address at `example.com`.
   These frames are committed and go in a video.
4. 🔴 **EVERY AGENT SIGNS UP WITH THE ADDRESS `docs/simulation/12-THE-LOGINS.md` GIVES THEM,
   and the one password.** `<first name>.<surname>@example.com`, lower case: Dr Amira Demo is
   `amira.demo@example.com`. This is not tidiness. The run's data stays on production
   afterwards and its whole value is that the founders can sign in as each of these people and
   read their record months later; an agent who invents an address, or a password of their own,
   leaves six months of somebody's care behind a credential nobody wrote down.
   `npm run on:production -- verify:cast` reads every one back and checks the password
   actually opens it. **`P6` Ziad Example is the exception and never signs up at all**: three
   sessions through join links, no account, and the verifier fails if one appears.
5. **The run is ON production and nothing is undone afterwards.** The write scripts refuse it
   by name; `npm run on:production -- <command>` is the one door and it carries an allow-list.
   If something refuses, read why rather than working around it: there is no restore, so a
   fixture left behind is permanent.
6. **Do not fix defects during the run.** Write them down and carry on.

---

## Known environment limits, so they are not filed as bugs

| What | Status |
|---|---|
| OpenAI | **Live, and capped at $10.** If notes do not generate, check `npm run spend` before filing a defect |
| Daily | Live |
| Stripe | Test mode, deliberately |
| Egypt card payments | **There is no gateway.** Not a limitation to work around: it is the product. Money arrives by transfer and an operator confirms it |
| The pounds per dollar rate | An operator's setting, default **50**, not a market feed |
| Email and WhatsApp codes | **Assumed delivered.** The codes agent reads the real code and types it into the real form. Every agent tries one wrong code first and reports the refusal |
| Blob storage | **Configured.** Receipts and identity documents upload for real. `T4`'s rejection cycle turns on documents being deleted, so check the row **and** that the blob is gone |
| Dates in Arabic | A known gap. Photograph it anyway |
| Promotional billing | Manual. An operator applies each discount from `/admin/therapists` |

---

## What the product does NOT do, so you do not spend an afternoon finding out

Eight things a careful agent would otherwise file as defects. Every one was checked against the
code this week. **None of them is a bug to chase; each is a sentence for the report.**

| | What actually happens |
|---|---|
| **The offer is applied by hand** | `discount_cents` and `discount_reason` exist; the schedule does not. An operator types each discount on `/admin/therapists`. **Record how long it takes**: it is the first thing to build after the beta |
| **Nothing renews by itself** | `subscribeByTransfer` raises ONE period at full price. There is no monthly cron that opens the next one, so the free-then-half-then-full sequence is walked by the operator, month by month |
| **A pot that empties tells the SPONSOR, not the patient** | The admins get an email naming nobody. The patient falls through to the ordinary paid route and is asked to pay. There is no "account on hold" screen |
| **A therapist lapses only when the billing cron runs** | `lapseOverdue` has one caller. **GET** `/api/cron/billing` with the bearer token to make wave 4's `M2` happen. A POST returns 405 |
| **`/admin/usage` is a 30 day window** | After ageing, only wave 6 falls inside it. The figures photographed at month 6 describe one wave, not the run. Use `npm run physics` for the run's own cost |
| **`/admin/vault`'s card is all time and its table is six calendar months** | They are not required to be equal, and a month with no activity is simply absent. Do not stop the run over the difference |
| **The transfer details lock almost permanently** | `detailsLockedBy` counts every `awaiting_proof` row, and one opens the moment any payer presses the button. Expect the refusal in `R7` to be the ordinary state |
| **A therapist sets their own price** | Nothing charges $20. `minPriceCents` is $5 and `maxPriceCents` is $500. Every arithmetic claim in these documents assumes the agents choose 1,000 EGP, so **have them choose it** |

**A clean report would mean you did not look.**
