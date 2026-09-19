# What was hit before you, and what it cost

**Read this once, before anything else. Then do not come back to it.**

Every other document in this folder says what is true. This one says what people ran into
getting there, and it is the only file here allowed to talk about the past. That split is
deliberate: an instruction that opens with a correction makes you carry somebody else's mistake
before you can act on anything, and `npm run verify:runbook` fails if archaeology leaks into any
other file.

Nothing below is a task. It is all paid for.

---

## The five the rehearsal walked into

Nine main flows were walked through a browser on the dev branch before this run existed.
Thirty-three steps, thirty-two of them clean. `14-THE-REHEARSAL.md` is the report; these are the
five that would have cost you hours.

### 1 · Sign-in is rate limited by NETWORK, and this swarm is one network

Twenty attempts per fifteen minutes, bucketed by the caller's /24. Right for the public internet.
**Twenty-eight agents behind one egress address is not close to it.**

The run would have stalled in wave 1 with every agent reporting *"too many attempts"* as a defect
in the product. Four runs of a three-flow probe exhausted the bucket, which is how it was found.

**Fixed in the product.** While `SIMULATION_RUNNING=1`, every per-network limit is multiplied by
twenty-five. The platform-wide `global:` ceiling is not, because that is the one number that
would notice a real attack. `npm run verify:limits` holds both halves.

### 2 · A patient cannot have an email address

`/patient/signup` asks for a first name, a phone, a time zone and an optional password. It never
asks for an email, and nothing anywhere else lets her add one.

Left alone, `verify:cast --complete` would have reported **seven people missing** at the end of
six months, which reads as an agent that never finished a wave and is actually the product
working as built.

**The run is corrected** — patients are phone numbers, `12-THE-LOGINS.md` carries them — **and
the product gap is on the build list rather than papered over.**

### 3 · An Egyptian customer on the default region is offered Stripe

`organizations.region` defaults to `us`, and on `us` the Confirm button goes to
checkout.stripe.com. Correct for a US customer, impossible in Cairo.

This is why moving every customer to region `eg` is a numbered step and not tidying. Miss it and
the run's money leaves by the card rail, the transfer queue stays empty, and the evidence about
the half of this product that is new is a Stripe page nobody in the launch market can pay.

### 4 · The onboarding chips are in the same form as the licence fields

Languages and specialties are `sr-only` checkboxes inside a label. Click the label, not the
input — and select them **before** pressing Save details, because they are part of the same form
and selecting them afterwards saves nothing. The screen gives no sign of it: the submit button
simply stays disabled with every visible field filled in.

Nine clinicians walk this.

### 5 · Both enquiry forms end in "Ask us to call"

Not Apply, not Submit. And there is no applications table: a practice's enquiry creates a **held
`organizations` row** and an employer's a **`sponsors` row**, with the state on the row itself.

### Four smaller ones from the same walk

| | |
|---|---|
| The country select is by **code**, and its labels carry a flag emoji | Selecting the visible label `Egypt` matches nothing, and the form then reports Country and Regulator missing |
| An upload takes about **2.3 seconds** to reach its column | Submit stays disabled until all four arrive |
| The plan card somebody is **already on** is disabled | "Pay as you go" is marked Yours and refuses a click |
| The submit button is React's, so it reads disabled **until hydration** | A check taken at that instant measures the server's HTML |

---

## What the documents themselves got wrong, and why you will not see it

A full read of all thirty-six markdown files on 2026-09-19 found that the runbook had rotted
under the product:

- **41 commands pointed at the wrong database.** The command that starts the wave clock,
  written without the `on:production` prefix, ages dev. The six month clock would never have
  started and nothing would have said so.
- **A governing rule contradicted the run.** `00-START-HERE.md` rule 4 read *"Nothing runs
  against production, ever"*, eighty lines after the same file said the run is on production.
- **Two more denials of the same kind.** The ageing document said its script refuses production,
  when the code allows it; the capture document told the run to type a command the production
  door refuses by name.
- **Every count disagreed with something.** Gates 11 against 27. Documents "twelve" against
  fifteen listed against sixteen on disk. Edges 48 against thirty. Walks eleven against twelve.
  Two steps both numbered 15.

**`npm run verify:runbook` is the answer, and it derives every expectation from the code**: the
gate count from the gate list, the production-only commands from the allow-list itself, the cron
jobs from the route's own map, the edge count by counting the rows in the file that defines them.
A checker holding its own copy of a number stops matching the day somebody tunes the real one.

---

## The money that was wasted, so it is not wasted twice

**Nineteen preview builds in one day, 4.84 hours of build time, for nothing.** Sixteen errored
and three were cancelled; four ran the full 45 minutes before hitting
`BUILD_EXCEEDED_MAXIMUM_TIME`. Billed $0.52, $2.42 at list price.

The cause was pushing one commit to three branches. Only `main` needs to build. This build is
memory-bound — see *"The production build is memory-bound"* in `HAZARDS.md`, where four
**production** deploys died the same way on 2026-09-16 — so production survives on a warm cache
in about two minutes and a preview branch does a full compile and dies.

**The project now carries an Ignored Build Step that builds `main` and nothing else.** A push to
any other branch goes CANCELED in about four seconds. That is the fix working. Do not turn it
off.

---

## The seed already ran, and it refuses to run again

`simulate:seed` ran on production during the rehearsal, deliberately, because it is the one
command whose failure there would stop everything and the only way to know it survives is to
point it at it.

**It found a real bug in itself doing so.** `= ANY(<array>)` is expanded into a parameter list by
this driver, which Postgres reads as a tuple, so it wrote seven people onto the payroll and then
crashed before creating a single login. Fixed, re-run, thirteen checks green.

So a second run answers, exit 1, before writing anything:

    🔴 This database already has a practice or an employer in it.
       Running again would create a second Nile Practice and nobody could
       tell the agents which one to use. Refusing.

**Its advice — make a fresh branch — is written for an empty database and would throw the seeded
run away.** `02-THE-SWARM.md` says what to run instead.

---

## Two rigs that fight each other

`next dev` and `next build` both write to `.next`, and whichever ran last leaves it wrong for the
other. A build over a dev server's output dies while prerendering `/for-patients` with
`TypeError: Cannot read properties of undefined (reading 'call')`, which reads as a broken
marketing page and is a stale cache.

The gates no longer cause it: `verify:served` compiles into `.next/served` and kills the
`next-server` its dev server forks, which used to survive the gate and keep recompiling with the
port already released. But the screenshot and probe rigs run `next dev` against `.next` directly,
so **`rm -rf .next` before any build** and the question never arises.

---

## 🔴 When you find the next one, write it down

Everything above is here because somebody hit it and wrote it down instead of working around it.

**Product and tooling hazards go in `HAZARDS.md`, at the bottom of the table, with the next H
number.** One row: what the trap is, and the rule that avoids it. That file is read by every
session that touches this repository, and it is the reason most of this run's obstacles were
already known before wave 1.

**Defects in the product go in `docs/simulation-run/DEV-LOG.md`** in the shape `02-THE-SWARM.md`
gives, and they are not fixed during the run.

The difference: a hazard is a property of the code or the tooling that will catch the next person
too. A defect is something the product does wrong to a user. Both get written at the moment they
are hit, because the version written a week later is a summary and the useful part is the detail.
