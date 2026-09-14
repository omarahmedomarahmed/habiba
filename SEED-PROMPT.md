# Six months of 24Therapy, grown week by week

> Paste this into a **fresh session**, after sprints 59 to 63 are built. It is a
> simulation, not a fixture file, and it needs a full context budget of its own.

## The one rule that changes everything

**Do not seed the end state. Grow it.**

A seed script that inserts 4,500 sessions in a loop produces a database that
looks right and proves nothing: every row is created in the same second, by the
same code path, with no state ever passing through the application. Nothing is
discovered, because nothing ever happened.

This instead runs **26 weekly ticks**. Each tick:

1. Advances the clock to that week
2. Brings in the few new people that week brings
3. **Makes the existing people act**, through the real functions, not raw inserts
4. Records what happened, what broke, and who complained

A flow that cannot survive being run is a flow that does not work. That is the
point of doing it this way.

## 🔴 Before you plan anything

### One Neon branch, never production

`demo.ts`, `seed.ts`, `settings.ts` and `shoot-room.ts` all call `writesTo()`,
which **refuses the production endpoint by name**. Do not work around it. Create
one branch, `demo-6mo`, point `DATABASE_URL` at it, work there, delete it when
the screenshots are taken. **Keep the project under ten branches.**

### Use the real code paths

Where a function exists, call it. `payFromPot`, `chargeForSession`,
`recordConsent`, `requestPayout`, `grant`, `claim`, `subscribeTo`. Raw inserts
are for the few things with no function behind them, and every one you do by
hand goes in the report as a gap.

### Clock

Everything is dated relative to a `START` six months before today. Sessions,
notes, journals, invoices, audit rows, verifications. A record whose
`created_at` is today is not six months of history, it is a screenshot of a lie.

## The story, week by week

This is the shape. Numbers are a target, not a contract, but the **order** is
the whole design: each phase exists because the one before it created the
conditions for it.

### Weeks 1 to 4 · One company, and the therapists its people already had

The founding motion, and it is not "therapists sign up".

- **One company** signs up as a sponsor. Domain proved, pot funded, joining code
  issued. Roster about 40 people.
- Its employees enrol. Several of them **already have a therapist** and invite
  that person onto the platform, because their employer now covers it. That is
  the first acquisition channel and it must be the first thing seeded.
- **About 10 clinicians** arrive that way. Most verify. **One is rejected**, with
  a reason, and stays rejected for the whole six months.
- Sessions start small: 30 to 60 a week, almost all sponsored, almost all PAYG.
- **Nobody is on a plan yet.** Every clinician is paying per session and some of
  them start noticing what that costs.

### Weeks 5 to 9 · Records arrive, and the radar starts

- Clinicians begin **uploading their existing caseloads** as unclaimed records.
  Two to three hundred people, most of whom never sign in. A handful claim.
- The **Crisis Radar** goes live for a few clinicians. First non-sponsored
  patients arrive through it, paying by card.
- **First upgrades.** Three or four clinicians move to Practice in week 6 or 7,
  after a month of per-session bills.
- First **grant** between two clinicians sharing a patient.
- First **payout request** from a clinician with held earnings.

### Weeks 10 to 14 · The second sponsor, and the first churn

- **A university** signs up. Bigger roster, about 120 students, different
  rhythm: heavy at term start, quiet in reading week.
- **The first cancellations.** Two clinicians cancel Practice and run out the
  period they paid for. One of them comes back in week 20.
- **A card fails in month 2.** That clinician's plan lapses at period end and
  they drop back to PAYG, which is the exact cohort the founder asked to see.
- First **enrolment paused** for an unanswered re-verification.
- The company's pot **runs low**. Somebody tops it up late, and there is a gap
  of a few days where sponsored patients pay their own way.

### Weeks 15 to 19 · Clinics

- **A clinic forms.** A clinician who has been on Practice since week 6 upgrades
  and becomes the clinic admin, then invites three colleagues. Two accept, one
  **never answers** and is still sitting on the invite at week 26. The founder
  wants to log in as that person.
- **A second clinic** is created admin-first: a manager who is not a clinician
  applies, is approved, and invites clinicians who already have accounts.
- **A third clinic** applies and is still `held` at week 26.
- One clinic reaches **five seats** and the rate drops. Seed the before and the
  after so the invoice shows the step.
- A clinician **leaves** a clinic in week 18. The clinic keeps the books and
  loses the live views.

### Weeks 20 to 26 · Volume, and everything that goes wrong at volume

- Sessions climb to 300 or so a week. About 30 clinicians, four clinics, two
  sponsors, one partner integration live with webhook deliveries.
- **A sponsor lowers its coverage percentage** (sprint 60). Sessions already
  booked keep the old figure; new bookings take the new one. Seed both sides of
  that boundary, and a session **rescheduled across it** that must keep its
  frozen number.
- A **refund**, a **chargeback**, a **no-show** on a pot-funded session.
- A **withdrawn consent** mid-session, and a session where consent was
  **declined** from the start.
- A **crisis alert** that fires, and one the classifier misses, so the
  difference is visible.
- A patient **revokes a grant** while the second clinician still holds it.
- A clinician **dies or goes dormant** and their caseload has no active
  clinician, which C272 says raises an admin alert.

## What each tick must record

Keep a running log, and hand it back as `audit/13-timeline.md`. One row per
notable event, with the week, the actor, and what happened.

Three columns matter more than the rest:

| Column | Why |
|---|---|
| **What broke** | The flow that failed, with `file:line`. This is the deliverable |
| **Who complained** | Write it as a support ticket, in the person's own words, and put it in the real support queue so the founder can read it as an admin |
| **What it cost** | Every event that moved money names the ledger entries it raised |

The support tickets are not decoration. A bug found in week 9 that is still
there in week 26 is a different fact from one fixed in week 10, and the queue is
where that becomes visible.

## The states that must exist at week 26, and be loggable into

Every row needs a working sign-in. The founder will click through all of them.

### Patients

Claimed with a year of history · unclaimed, never signed in · claimed this week
· company-sponsored · university-sponsored · **paused** for re-verification ·
sponsored but the pot is empty · **two clinicians hold a live grant at once** ·
a grant **expiring inside 24 hours** · a grant **already expired** · a grant the
patient **revoked** · found somebody on the radar once and never returned ·
**declined** recording, so no transcript and no note · **withdrew** mid-session ·
**invited their own therapist** in week 2 · Arabic throughout.

### Clinicians

PAYG, low volume · Practice since week 6 · Clinic plan · **subscribed week 4,
card failed week 9, dropped to PAYG** · cancelled and running out the period ·
verification **pending** · verification **rejected** with the reason · verified
but never went on the radar · high radar volume with held earnings, one payout
requested and one sent · **invited to a clinic in week 16 and has still not
answered** · joined a clinic while their own plan had two weeks left · two who
**share a patient** and each keep their own notes · one who uploaded a
**photograph of paper notes** · Arabic-first.

### The rest

| Principal | States at week 26 |
|---|---|
| Sponsor | Company: funded, spent, topped up late once, coverage lowered in week 22. University: funded, term-shaped usage, one paused enrolment. One `held`, never approved |
| Clinic | Four, as above: clinician-led, admin-led, five-seat, and `held` |
| Partner | Live key, registered webhook, successful and failed deliveries |
| Admin | Six months of audit log, payout queue with every state, support queue with the tickets from the timeline, verification queue, settings history |

## Notes: more than one kind, on one patient

On at least one shared patient produce all five: a full **SOAP note from a
transcript**, a note written **from memory with no recording**, a **partial**
note where consent was withdrawn part way, an **unapproved draft**, and an
**uploaded photograph** of paper notes. Then record exactly what the second
clinician with a grant can see of each.

## The financial picture

`audit/10-unit-economics.md`, read off the admin screens rather than computed on
paper. If a figure is not on a screen, that is a finding.

- Revenue by source: platform fees, AI fees, subscriptions, the radar cut
- Model spend from `ai_request_logs.cost_microcents`, by kind and per session
- Gross margin per session, and per clinician per month
- Subscription mix, and what the failed-card cohort cost
- **Sponsor pot balances and held clinician earnings, stated as liabilities**,
  because both are somebody else's money on our balance sheet
- The single number: **what does one clinician on Practice contribute a month**
- The curve: revenue by week for 26 weeks, so the shape is visible and not just
  the endpoint

## What to hand back

1. `audit/10-unit-economics.md`
2. `audit/11-seed-manifest.md`: **every account, its email, its password, and one
   sentence on what the founder sees when they log in**
3. `audit/12-what-broke.md`: every failure, with `file:line`. Expected to be
   long. It is the point
4. `audit/13-timeline.md`: the week-by-week log, including the support tickets
5. Screenshots of every state above, English and Arabic, in a directory that can
   be scrolled
6. The branch name and connection details

## House rules

- **Never use the em dash.** `verify:sprint24` fails the build on one
- Short tables, plain words, no ticket codes as prose
- One obvious shared password pattern, written down in the manifest
- Nothing touches production. `ship:content` is not run
- `verify:reachable`, `verify:principals`, `verify:claims` and `typecheck` all
  run before you hand anything back
