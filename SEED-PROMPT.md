# Six months of 24Therapy, simulated

> Paste this into a **fresh session**. It is a build, not an audit, and it needs
> a full context budget of its own.

## What you are making

A **branch database** holding six months of plausible operating history for
24Therapy, so that every principal can be logged into and every flow can be
screenshotted as it actually looks with real volume behind it. Then a financial
picture that answers what this business looks like at that scale.

Not fixtures. A **simulation**: events in time order, with people who cancel,
cards that fail, therapists who join clinics, patients who invite their own
therapist, and pots that run down.

## 🔴 Read this before you plan anything

### It runs against a Neon branch. Never production.

`scripts/demo.ts`, `seed.ts`, `settings.ts` and `shoot-room.ts` all call
`writesTo()`, which **refuses the production endpoint by name**. Do not work
around it. Create one Neon branch named `demo-6mo`, point `DATABASE_URL` at it,
and work there.

**Keep the project under ten Neon branches.** There are four today: `main`,
`sprint-1-settings`, `audit-2026-09-13`, `sprint-52-capture`. You may add one.
Delete it when the screenshots are taken.

### Three things the founder asked for do not exist yet

Do not fake them. Seed the world they will live in and say what is missing.

| Asked for | Reality | What to seed instead |
|---|---|---|
| Sponsors covering **10%**, 60%, 100% | **Partial coverage is not built.** `lib/billing/pot.ts` pays the whole session price or nothing. `coverage_bps` arrives in sprint 60 | Seed sponsors at **100% only**. Add a second sponsor whose pot is **empty** and one whose enrolment is **paused**, which are the two partial-ish states that DO exist |
| A clinic with 4 therapists **adding a fifth at a lower price** | **Seats are not built.** No `seats` column, no per-seat rate. Sprint 62 | Seed a clinic organisation with four clinicians in it and the billing as it is today. Note the gap in your report |
| Clinic **staff with custom roles** | Not built. Sprint 63. The founder already said to leave it out | Seed `clinic_managers`, which does exist, and record what a manager can and cannot see today |

### The platform has known live defects

Nine hostile audits finished on 2026-09-14 and their reports are in `audit/`.
Four blockers were fixed; roughly thirty findings are open, and **87 exported
safety functions have no caller**. You will hit some of them. When a flow breaks,
that is a **finding, not a blocker on your work**: write it down and carry on.
The founder explicitly wants to know what breaks.

## The shape of the six months

Aim for these totals. Round numbers are fine; internal consistency is not
optional.

| | Target |
|---|---|
| Clinicians | ~30. A mix of verified, pending verification, and one rejected |
| Clinics | 4 organisations. One with 4 clinicians, one where a clinician is also the manager, one with a manager who is not a clinician, one that applied and is still `held` |
| Patients | ~400 people, ~600 patient charts (a person seen by two clinicians has two) |
| Sessions | ~4,500 over 26 weeks, ramping from ~40 in week 1 to ~350 in week 26 |
| Sponsors | 2 live. One company, one university. Both with funded pots and real spend |
| Partner | 1, with an API key, a registered webhook, and delivery history |
| Languages | ~40% of everything in Arabic. Journals, notes and transcripts included |

## The states that must each exist and be loggable into

This is the list the founder wants to click through. **Every row needs a working
sign-in.**

### Patients

| State |
|---|
| Claimed record, 12 sessions, journals, homework, an assessment trend |
| **Unclaimed** record a clinician created, never signed in |
| Claimed **this week**, one session |
| Enrolled with the **company** sponsor, pot funded, sessions paid from it |
| Enrolled with the **university** sponsor |
| Enrolled and **paused** for an unanswered re-verification (C247) |
| Enrolled where the pot is **empty**, so they pay their own way |
| Two clinicians hold a **live grant** at the same time |
| A grant **expiring in under 24 hours** |
| A grant **already expired** |
| A grant the patient **revoked** |
| Found a clinician on the **radar** and never booked again |
| **Declined** recording, so there is no transcript and no note |
| **Withdrew** consent mid-session |
| A patient who **invited their own therapist** onto the platform because their employer covers it |
| Arabic-only, throughout |

### Clinicians

| State |
|---|
| Pay as you go, low volume |
| Practice plan, paying since month 2 |
| Clinic plan |
| **Subscribed in month 1, card failed in month 2, dropped back to PAYG** |
| **Cancelled**, running out the period they paid for |
| Verification **pending** |
| Verification **rejected**, with the reason shown |
| Verified, never went on the radar |
| High radar volume, held earnings, a payout **requested** and one **sent** |
| **Invited to a clinic and has not answered yet.** The founder wants to log in and see this exact screen |
| Joined a clinic, was on Practice, whose own plan is running out |
| Two clinicians who **share a patient** by grant, each with their own notes |
| One who uploaded a **photograph of paper notes** to a shared patient |
| Arabic-first |

### The rest

| Principal | States |
|---|---|
| Sponsor | Company: funded, spending, roster of ~60. University: funded, roster of ~120, one paused. One `held`, never approved |
| Clinic | The four above. Show what a manager sees and what they do not |
| Partner | Live key, webhook registered, deliveries attempted |
| Admin | A full audit log, a payout queue with items in every state, a support queue, verification queue, a settings history |

## Notes: more than one kind, on one patient

The founder asked for this specifically. On at least one shared patient,
produce: a full **SOAP note from a transcript**, a note the clinician wrote from
**memory with no recording**, a **partial** note where consent was withdrawn
part way, an **unapproved draft**, and an **uploaded photograph** of paper notes.
Then record what the second clinician with a grant can see of each.

## The financial picture

After seeding, produce `audit/10-unit-economics.md` answering, from the seeded
data and **not from arithmetic you do on paper**:

- Revenue by source: platform fees, AI fees, subscriptions, the radar cut
- Model spend from `ai_request_logs.cost_microcents`, by kind and per session
- Gross margin per session and per clinician per month
- The subscription mix and what the failed-card cohort cost
- Sponsor pot funding in, spend out, balance held. **This is somebody else's
  money on our balance sheet, so state it as a liability**
- Held clinician earnings, same reason
- The single number: **what does one clinician on Practice contribute a month**

Take the screenshots from `/admin/vault`, `/admin/usage` and `/admin/tv` rather
than computing it yourself. If a figure is not on a screen, that is a finding.

## Screenshots

`npm run screens` exists. Extend it. Every state in the tables above gets a
screenshot, named for the state, in a directory the founder can scroll. Arabic
screens as well as English.

## What to hand back

1. `audit/10-unit-economics.md`, as above
2. `audit/11-seed-manifest.md`: **every account, its email, its password, and
   the one sentence describing what the founder will see when they log in.**
   This is the deliverable they asked for by name
3. `audit/12-what-broke.md`: every flow that failed, with `file:line`. Expected
   to be long. It is the point
4. The screenshot directory
5. The Neon branch name and connection details

## House rules

- **Never use the em dash.** `verify:sprint24` fails the build on one
- Short tables, plain words, no ticket codes as prose
- Passwords: one obvious shared pattern, written down in the manifest
- Do not touch `main`'s data. Do not run `ship:content` against production
- Run `npm run verify:reachable`, `verify:principals`, `verify:claims` and
  `typecheck` before you hand anything back
