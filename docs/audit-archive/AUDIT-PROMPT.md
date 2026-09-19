# 24Therapy platform audit — the hostile brief

> Paste this into a fresh session, or hand one section of it to one agent. It is
> written to be adversarial on purpose. Nothing in this document is a request
> for reassurance.

## What this product is

An AI clinical-documentation and on-demand-therapy platform, live at
**24t.vercel.app**. Next.js 15 App Router, React 19, server actions, Drizzle
ORM over Neon Postgres, deployed on Vercel. Two legal entities: a US one and an
Egyptian one. Two languages, English and Arabic, both written from scratch
rather than translated.

**Six authenticated principals today**, each with its own portal, its own auth
session table and its own guard:

| Principal | Guard | Portal |
|---|---|---|
| patient | `requirePatient` | `app/(patient)` |
| clinician | `requireUser`, `requireVerified` | `app/(app)` |
| admin / back office | `requireRole`, `requireStaff`, `requireManager` | `app/(admin)` |
| clinic | `requireClinic`, `requireClinicAdmin` | `app/(clinic)` |
| sponsor (company or university) | `requireSponsor`, `requireSponsorAdmin` | `app/(sponsor)` |
| partner (API integrator) | `requirePartner`, `requirePartnerAdmin` | `app/(partner)` |

**A seventh is planned** in sprint 63: **clinic staff**, a management principal
that must never reach clinical data.

## Your job

Find what is wrong. Not what is good, not what is impressive, not what could be
improved later. **What is wrong now, and what will be wrong after the planned
sprints ship.**

You are not here to be reassuring. A clean report from you is worth nothing to
anybody: three previous audits each found live defects that forty-two verifiers
and five hundred tests could not see, including a patient who could not sign out
of their own medical record and a published pricing claim about a button that
did not exist. Assume there are more.

## The two questions that matter

For every surface you look at:

1. **Can somebody see something that is not theirs?** A patient's name, a
   session time, a note, a transcript, a diagnosis, a risk alert, an employer's
   roster, a therapist's earnings, another company's existence.
2. **Does the screen tell the truth about what will happen?** A button that
   says one thing and does another, a price that is not what is charged, a
   promise about a person's availability, a claim about a detector's accuracy.

## Rules for your findings

**Every finding needs all five of these or it is not a finding:**

| Field | What it must contain |
|---|---|
| **What** | One sentence naming the defect, not the area |
| **Where** | `file:line`. If you cannot point at a line, say so and mark it as a hypothesis |
| **Who is harmed** | A named principal, and what they lose |
| **Severity** | `blocker` stops a launch · `major` changes a design · `minor` is worth writing down |
| **Already known?** | Search `PLAN.md` §2 for a matching concern C1 to C366. If one exists, say whether the RULING is wrong, whether the ruling was never built, or whether this is genuinely new |

**Things that are not findings, and will be ignored:**

- "Consider adding tests." Which test, for which defect?
- "This could be refactored." Not unless it produces a defect.
- "Error handling could be improved." Which error, reaching which user, saying what?
- Anything you have not read the code for. A guess presented as a finding
  poisons the whole report.
- A restatement of a concern already ruled on, without saying why the ruling is
  wrong.

**Two things this repository has learned the hard way, which apply to you:**

- **A check that passes by measuring the wrong thing is the most common defect
  here.** Thirteen occurrences are logged. When you see a guard, a rail or a
  verifier, ask what it would do against a deliberate offender, not whether it
  looks right.
- **An absence proves nothing without a control.** "No leak found" is exactly
  what a search that read nothing also reports. Say what you searched and what
  you would have found if the defect existed.

## House style for your output

- Short tables. Never walls of text.
- Plain words. Never a ticket code used as prose.
- **Never use the em dash.** This is a hard house rule.
- Say "I could not determine" rather than guessing. An honest gap is worth more
  than a confident invention.

## Where to write

Append your findings to the file named in your brief, under `audit/`. One file
per auditor. Do not edit any other file. **Do not write code. Do not run any
script that writes to a database.** You are reading.

## What to read first, and what to skip

`PLAN.md` is 4,400 lines. Do not read all of it. Read:

| Section | Why |
|---|---|
| §2 CONCERNS, the last 80 rows (C287 onward) | The newest rulings, which are the least battle-tested |
| §3 THE MODEL, §3b IDENTITY, §3c MONEY | The product's actual rules |
| §3e CORPORATE, §3f THE SIX PORTALS | Who sees what |
| §6 STANDING RULES | What has already been decided, so you do not re-litigate it |
| Sprints 58 to 64 | What is about to be built. Attack the plan, not just the code |
| `HAZARDS.md` | All 34 entries. This is where the traps are written down |
| `README.md` | The product as it is described to a new contributor |

Useful commands, all read-only:

```bash
npm run verify:reachable     # every action, route and page has a surface
npm run verify:principals    # every clinical read is made by a declared principal
npm run verify:claims        # every published sentence, against the product
npm run typecheck
```

Do **not** run `npm run db:seed`, `demo:seed`, `settings.ts`, `republish.ts` or
any `verify:sprintNN` that writes. Several refuse the production endpoint by
name; do not work around that.

## What is about to change, and why it matters to you

Seven sprints are specified in `PLAN.md` and only the first is built. Audit the
**plan** as hostilely as the code, because a defect found in a specification
costs a paragraph and the same defect found after the sprint costs a migration.

| Sprint | What it adds | The thing most likely to be wrong |
|---|---|---|
| 58 ✅ built | `verify:reachable`, `verify:principals` | Does the gate actually fire? Plant an offender |
| 59 | Country, currency, entity, the renewal obligation, FX | VAT computed from a self-declared country; a held balance with no entity; currency arbitrage |
| 60 | The employer coverage percentage, 0 to 100 in 5% steps | A percentage read at settlement instead of frozen at booking; the therapist learning who paid |
| 61 | Sponsor domain proof, the public banner, HR verification | Domain guessing enumerating our customers; provisional enrolment spending real money |
| 62 | Clinic seats, retroactive per-seat pricing | The +$91 cliff at the third seat; proration; a clinic paying for a month a therapist already owns |
| 63 | **Clinic staff, the seventh principal** | A management principal reaching clinical data; a custom role granting a capability its creator lacks; one human holding two principals in one session |
| 64 | The Egyptian rail | Blocked on a licensed entity and a gateway contract. Audit the design, not the vendor |

## The invariants. Try to break each one

These are the rules the product is built on. For each, your job is to find the
path that violates it, or to say honestly what you tried and could not break.

| # | Invariant |
|---|---|
| 1 | A therapist can **never** delete a patient or a session |
| 2 | A reset clears therapist messages and **never** in-session notes |
| 3 | There is **no admin impersonation**, anywhere |
| 4 | A rating's author is **never** revealed |
| 5 | A patient **never** sees a transcript or a clinical note |
| 6 | Nothing unclaimed is **ever** shared |
| 7 | Only an admin sends patient data anywhere, audited, with the clinician notified |
| 8 | A sponsor can **never** reach a session, a date, a therapist or a name joined to any of them |
| 9 | The platform fee is charged on **every** session; the AI fee only on consent |
| 10 | A clinic **never** reaches a record, a note, a transcript, a copilot or a risk alert |
| 11 | The copilot reads the record as of `startedAt` and nothing after it |
| 12 | A journal may be cited and **never** concluded from |
| 13 | 24Therapy creates the meeting, or there is no external meeting |
| 14 | No published sentence promises how fast a person will answer |

## Say what you could not check

End your file with a section called **"What I could not verify"**, naming what
you would have needed. A gap you name is a gap somebody can close. A gap you
paper over is the next audit's finding.
