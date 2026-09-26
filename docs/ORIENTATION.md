# What 24Therapy is, what it promises, and where every answer lives

**Written for a model arriving with a goal.** `README.md` routes you by that goal in one
table. This is the substance behind it: what this product is for, what it claims, what it
values, what it refuses, and which file answers which question.

🔴 **This file is a claim, like every other `.md` here.** It was written by a session that
had read a few dozen files out of 1,158. The code is the evidence. Where this and the code
disagree, the code is right and this file is a defect.

---

## 1 · The one sentence

**The clinical record layer above whatever a therapist already uses.** Not a scribe, not an
EHR. The layer that makes every session, held anywhere, part of one patient's story that the
patient owns and carries.

Launching in Egypt at `24therapy.app`. One Next.js application, one deployment, one database.

---

## 2 · The five people, and the wall between them

Six sign-in doors, six different cookies, six genuinely separate principals. A therapist's
session cannot become a patient's, and that is enforced by different tables rather than by a
role column.

| Who | Door | What the product is, to them |
|---|---|---|
| **Patient** | `/patient/login` | Their sessions, their record, their journal, what they agreed to try, and a crisis button that never depends on money |
| **Therapist** | `/login` | A caseload, a video room, a note written from what was actually said, and a copilot that cites the sentence it came from |
| **Clinic** | `/clinic/sign-in` | Seats, one bill for the practice, earnings per clinician, and no clinical content at all |
| **Company** | `/sponsor/sign-in` | A funded pot that pays a share of staff sessions, and no way to learn who used it |
| **Us** | `/staff/sign-in` | The verification queue, the transfer queue, payouts, the board, the ledger |

A partner portal at `/partner/sign-in` exists for EHR integration and is the least finished
surface in the product.

**The "never sees" column in `README.md` is the product.** Read it before anything else you
plan to build or judge.

---

## 3 · The three things that make this unusual

Each is load-bearing, and each explains decisions that look strange without it.

### There is no card processor in Egypt

Every payment is a bank transfer a human checks. No webhook confirms it, no chargeback
reverses it, no processor reconciles it. The row in `manual_payments` is the only record that
anybody verified anything, and two of the seven salaries in the plan exist to work that queue.

This is why `lib/billing/manual.ts` is as careful as it is, why an operator confirming twice
must move money once, and why a rejected transfer being a dead end is a real defect rather
than a rough edge.

### The employer must never learn who is in therapy

The company portal has no query that could return a patient name, a session time or an
attendance list. The pot balance an employer sees is a **published** figure that only updates
once five sessions have passed, so it cannot be differenced to work out that somebody went
this week.

This is the constraint the whole design is subordinate to. A patient name appearing anywhere
in that portal is the one finding that stops a test run dead.

### The patient owns the record, not the clinician

Clinical summaries are append-only and versioned. Correcting one means writing version n+1,
enforced by a database trigger rather than by convention. A record follows the person between
practices, and every version stays under its author's name. Consent to read is granted per
clinician and revocable, and revoking it stops the copilot on the next question rather than
at the end of the episode.

---

## 4 · What we promise, in 25 statements

`docs/VALUE-STATEMENTS.md` is the list, five per audience, generated from
`scripts/_value-statements.ts`. **Every one of them is a claim this product already makes on
a page a stranger can read.** Nothing in it is new marketing, and that constraint is the
point: a test plan written against invented promises proves a product nobody was sold.

`docs/PROVE-IT.md` is how they are tested: eight personas, five seeded database positions,
cross-referenced so one person's step depends on another's. `verify:prove` fails if a promise
is never walked.

**If you are here to judge whether this product is honest, those two files are the job.**

---

## 5 · Two claims we are forbidden from making

`lib/content/honesty.ts` refuses both at `savePage`, and `verify:sprint28` scans the published
rows as well, because the code being right has never been the same as the database serving the
right thing.

**That paid sessions cover our fee.** Fifteen per cent of a $20 session is $3 against a $4
fee. It is arithmetically false and it writes itself into a pricing page because it *sounds*
like the deal. What is true is netting: what you owe comes out of what you earn before it
reaches your account.

**Any forecast of what a clinician will earn.** "Get booked" describes what the radar does.
"Earn up to", "pays for itself", "fill your calendar" are predictions about somebody else's
business, and a clinician who moves practice on the strength of one has been misled by us
rather than by the market.

🔴 **If you are auditing us, the useful question is not whether these two are enforced. It is
which third claim we should be refusing and are not.**

---

## 6 · The money, in one table

Full argument and every assumption in `docs/FINANCIAL-PLAN.md`, where each number is labelled
**MEASURED**, **DECIDED** or **GUESS**. The split is 2 measured, 20 decided, 12 guessed, and
both measured numbers are terms of the AI cost.

| | USD |
|---|---|
| Patient pays the therapist | $20 |
| Our cut, on paid sessions only | $3.00 (15%) |
| The room, on every session | $1.00 |
| The note, where consent was given | $3.00 |
| Solo therapist, unlimited | $80/month |
| Clinic seat, minimum two | $72/seat |
| Company or university | $0, they fund a pot |

Break-even between metered and unlimited is **exactly 20 sessions**, which is why the
subscription is $80 and not $100: at $100 it was 25 sessions while the same plan forecasts a
typical therapist doing 20, so we would have been selling a subscription to the people for
whom it was the worse deal.

**The raise is $20,000**, six months, burn starting at $6,647/month and turning positive in
month 5. Payroll is $3,500/month across seven people. A company gets $100 of welcome credit,
which is real cash leaving rather than a discount.

---

## 7 · What this codebase believes about checking things

You will find **39 gates** and **107 `verify:` scripts**, and they are unusual enough to
explain. The two lists overlap: `npm run verifiers` derives its own list at runtime as every
`verify:` script no gate already runs, so no number here can go stale against it.

> **A checker reports on something ADJACENT to what it claims to check, and the report reads
> the same either way. A green line meaning "clean" and a green line meaning "I looked at
> nothing" are the same green line.**

`docs/TRAPS.md` holds six traps, each with enforcement in `verify:traps`, and the gate fails
if the document describes a trap nothing enforces. They were each walked into more than once
before being written down.

The question to ask of any check: **if the thing I am checking were completely broken, would
this line go red?** If you cannot answer yes, it needs a control before anything else.

🔴 **18 of the 106 `scripts/verify-*.ts` files have no control**, so 18 cannot be shown to
fail, and that number may only go down. It is measured by
`grep -LE "control|CONTROL" scripts/verify-*.ts | wc -l`, which finds the word rather than the
thing, so treat it as a floor and re-measure rather than quoting it.

---

## 8 · Where every answer lives

| Question | File |
|---|---|
| What does the product promise? | `docs/VALUE-STATEMENTS.md` |
| How is a promise proved? | `docs/PROVE-IT.md` |
| What was ruled, and why? | `PLAN.md` §2 |
| What are the standing rules? | `PLAN.md` §6 |
| What has already caused a defect? | `HAZARDS.md` |
| What has already fooled a checker? | `docs/TRAPS.md` |
| Every state a person can be stuck in | `docs/LIFECYCLES.md` |
| Every page and control, and whether it is wired | `docs/INVENTORY.md` |
| What the money does | `docs/FINANCIAL-PLAN.md`, `lib/billing/`, `lib/finance/` |
| Who is on production right now | `docs/DEMO-LOGINS.md` (event cast) or `docs/DEMO-CAST.md` (everyday cast), whichever was seeded last |
| Which Neon branch is what | `docs/NEON-BRANCHES.md` |
| What the video room really talks to | `docs/DAILY-HOSTS.md` |
| What is published for the domain | `docs/EMAIL-DNS.md` |
| The phases and what is open | `docs/THE-PLAN.md` |
| What the redesign has to fix | `docs/THE-REDESIGN.md` |
| What the identity is, and how it was briefed | `docs/BRAND.md`, `docs/LOGO-BRIEF.md` |
| External state in no file: Neon, Vercel, DNS | `docs/TAKEOVER.md` §5 |
| The one-month simulation on the live site | `docs/simulation/` |

---

## 9 · What is NOT true, and would be easy to assume

Read this before you conclude anything about maturity.

- **Nothing has launched.** Every account that has ever existed here was synthetic.
- **The one-month simulation is written, not yet run.** `docs/simulation/` is the plan;
  `docs/simulation-run/` appears when it runs.
- **Nobody has read this repository.** Not the session that wrote this file, not any earlier
  one. The open task list therefore describes the defects that were *found*, not the ones that
  exist.
- **Four open defects would hurt a real person**, listed in `docs/THE-PLAN.md` as Phase 0. One
  of them is an unconsented clinical recording.
- **The design is being replaced wholesale**, not improved. Task 174, briefed in
  `docs/TAKEOVER.md` §10.

---

## 10 · The rules a visiting model has to obey

- **This repository is public.** No real secret in any committed file, ever.
- **`npm run seed:demo` deletes people.** Snapshot `br-nameless-dust-a6ae5e4r` is the undo.
- **Nothing reaches production except `npm run on:production -- <command>`** and its
  allow-list. `.env.local` stays pointed at dev.
- **`npm run gates` takes 25 minutes.** Run the narrow check instead;
  `docs/TAKEOVER.md` §7 is the table.
- **No em dash or en dash anywhere a person reads**, including a console line.
- **Every invented person is at `example.com`.** Five real inboxes are named in
  `scripts/_demo-cast.ts` and nothing else may receive mail.
- **The founder is not technical.** Explain in plain words, say what to click, never imply a
  deadline that does not exist, and when something is broken say so plainly.
