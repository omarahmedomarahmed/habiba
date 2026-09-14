# 24Therapy

**The clinical record layer above whatever a therapist already uses.** Not a scribe,
not an EHR. The layer that makes every session, held anywhere, part of one patient's
story that the patient owns and carries.

**One Next.js application. One deployment. One database.**

> **Status: development. Nothing has launched.** Production holds one administrator
> and no patient data. Every account that has ever existed here was synthetic.

---

## Who signs in, and what each one can never see

Six kinds of person authenticate today. A seventh is being built. The last
column is the product.

| Portal | Route group | Sees | Never sees |
|---|---|---|---|
| **Patient** | `app/(patient)` | Everything about their own care | Another person's anything. A transcript. A clinical note |
| **Therapist** | `app/(app)` | Their own caseload, in full | Another clinician's caseload. Who paid for a session |
| **Clinic** | `app/(clinic)` | Its therapists' schedules, usage and bills. Patient names and appointment times only | **Any clinical content at all** |
| **Sponsor** | `app/(sponsor)` | The pot, the enrolled roster, aggregate spend | Who booked, when, with whom, about what |
| **Partner** | `app/(partner)` | Keys, docs, webhooks, their own subjects | Content. A webhook carries an event and an id |
| **Admin** | `app/(admin)` | The operating picture | A join between a sponsor and a session, booking, date or name |
| **Clinic staff** *(sprint 63)* | `app/(clinic)` | Only what their role was granted, on the resources it was granted for | A record, a note, a transcript, a copilot, a risk alert. A patient's full surname |

### The seventh: clinic staff

A practice is not one person. A receptionist books, an office manager chases
bills, an assistant runs one therapist's calendar. Today all of that requires
the clinic admin's own login, which is the account that can buy seats and
invite clinicians.

Six things decide the shape of it, and all six are already ruled:

- **Its own table and its own auth session**, like `sponsor_users` and
  `partner_users`. Never a `users` row: `staff` and `manager` there are *our*
  back office and one mistake away from a clinical grant.
- **`clinic_admin`, plus up to two custom roles the admin names.** Not a
  permission matrix nobody maintains.
- **Capabilities are checked in the data layer, on the resource.** An assistant
  assigned to therapist A is refused therapist B's calendar on the same route,
  not shown a hidden button.
- **The capability vocabulary is a closed list in code.** An unknown capability
  is refused, never ignored, and a custom role is a strict subset of the
  admin's.
- **Only the admin buys a seat or invites a clinician.** Money and membership
  are never delegable.
- **Patient identity to staff is first name plus last initial, and the patient
  is told**, on their own record page and on the radar card. Every read is
  audited.

A human who is both a clinician and a clinic admin gets **two linked principal
rows**, and the cookie names which one is active. Switching is explicit and
audited. One session never carries both capability sets.

🔴 **A clinic IS an `organizations` row. A sponsor is NOT.** They look like one
problem and have opposite answers: a clinic employs clinicians and its patients sit
inside the tenancy `actor.organizationId` scopes, while a sponsor pays for care it
must never see. Do not share a table between them.

---

## What it does

| Flow | Where |
|---|---|
| A session, recorded in person or in our room, transcribed and written up | `app/(room)/sessions/[id]/room` |
| A session on Zoom, Meet or Teams, with a bot we dispatch | `lib/meetings/` |
| A patient claims their record and carries it to a new therapist | `lib/data/portability.ts` |
| A clinician asks the record about a patient, with citations that resolve | `lib/ai/case-copilot.ts` |
| A patient books a therapist who is available right now | `app/(public)/radar` |
| A company or university funds therapy and never learns who went | `lib/data/sponsor.ts` |
| A hospital connects its EHR and our chart appears inside it | `lib/ehr/` |
| A partner platform reads a record under a grant the patient gave | `lib/partner/` |

---

## The money

One session raises **two line items**, and only one is conditional.

| | Charged to | When |
|---|---|---|
| **Platform fee** | The therapist, or their clinic | **Every session.** Free, in person, and declined ones |
| **AI fee** | The therapist, or their clinic | **Only when the patient turned AI on** |

There are **two ways to pay, and joining is free either way.**

| | Costs | A session then costs |
|---|---|---|
| **Pay as you go** | nothing to be on | $1 + $3 with AI, $1 without |
| **Practice** | $99 a month | nothing |
| **Clinic** | $179 a month | nothing |

A monthly plan is **unlimited**: unlimited sessions, unlimited AI, and no
per-session fee at all. That is also a safety property and not only a price —
the AI fee is incurred by the therapist and switched on by the **patient**, so an
unlimited plan removes the last amount that could ride on a consent
conversation. Pay as you go keeps the split fee, which does the same job from the
other side (C209).

🔴 **A subscribed session still raises both invoice lines, at zero.** Not no
lines. A missing row is a gap; a zero is a fact, and every report keyed on line
kind keeps working without being told a plan exists.

🔴 **No amount of credit reaches a plan.** A subscription is bought, never
earned, and `tierForSpend` walks credit tiers only — the one-line filter that
stops any therapist who ever topped up a dollar from holding the $179 plan for
nothing.

Every figure above is a row in `platform_settings`, read at render time. Nothing
is typed into a page, a checkout or a test fixture.

**The patient never pays us.** They pay their therapist. A sponsored patient pays
nobody: a corporate pot stands in for their card and changes nothing downstream.

### Two currencies, and which one is not a display choice

**EGP in Egypt. USD everywhere else.** There is no third, and adding a country
does not add one. GBP and EUR countries are coming, and in them the price is
quoted in USD, paid in USD and paid out in USD.

| | Egypt | Everywhere else |
|---|---|---|
| Patient pays | **EGP**, through the Egyptian gateway | **USD**, through Stripe |
| Entity that collects | The Egyptian one | The US one |
| VAT | **14%, on top** | None. VAT is Egypt only |
| Clinician is paid | **Manually**, in EGP, by InstaPay or wallet | Stripe Connect, in USD |

🔴 **Collection follows the patient. Payout follows the clinician. They are
allowed to disagree.** An Egyptian patient seeing a British therapist pays EGP
into the Egyptian entity, and that therapist is paid USD out of the US entity
through Connect. A patient in Germany seeing an Egyptian therapist pays USD into
the US entity, and that therapist is paid manually in EGP. Both are cross-border
crossings, both mean **we are holding the money**, and both need an explicit
`entity_transfer` to settle. `isCrossBorder` counts them and §3c is the register.

🔴 **An Egyptian clinician is always on manual payouts**, whatever the row says,
because Stripe does not pay out to Egypt. Asking only "do they have a Connect
account" is a question about our database rather than about the world, and the
answer would have recorded money we hold as money we do not.

The rate is quoted once and frozen onto the transaction, so the receipt, the
refund and any later audit read the same number rather than each re-deriving it.

🔴 **The Egyptian rail is not live yet.** The company is being registered and the
gateway contract signed. Until then `collectionProblem` refuses an Egyptian card
payment in plain words and points at the free link, because a silent fallback to
Stripe would collect into the wrong entity, in the wrong currency, under the
wrong licence, and look like success from every screen.

---

## Rules the database enforces, not the application

A rule that lives in one function is a rule the second caller forgets. These are
constraints and triggers, provable by attempting the write.

| Rule | Where |
|---|---|
| A grant can only be held by a clinician whose verification is **approved** | trigger, `0060` |
| A journal or an assessment may be cited and **never concluded from** | `facts_journal_never_concludes` |
| A recorder joins only a meeting **we** provisioned | `session_sources_bot_only_if_ours` |
| One invoice per session, one line of each kind | `invoices_session_unique`, `invoice_lines_invoice_kind_unique` |
| A published instrument is **free to use** and, if translated, reviewed by a named person | `instruments_free_only`, `instruments_translation_reviewed` |
| `users.verification_status` is **derived**, never written by hand | trigger, `0083` |
| No column carries two foreign keys; no `SET NULL` contradicts a `CHECK` | audited in `scripts/_verify.ts` |

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, React 19 |
| Styling | Tailwind v4, tokens in `app/globals.css` |
| Database | Neon Postgres via Drizzle |
| Driver | `@neondatabase/serverless` |
| Auth | Opaque session tokens, httpOnly. Six principals, one router (`lib/routing.ts`) |
| AI | OpenAI. `gpt-4o-mini-transcribe`, `gpt-4o` |
| Video | Daily.co for our room; Recall.ai for external meetings |
| Email | Resend |
| Payments | Stripe (USD). An Egyptian gateway for EGP is contracted, not yet live |

**No WebSocket server and no separate API service.** The browser uploads an audio
chunk every eight seconds and the response carries new transcript text and any
crisis flag. That is the entire realtime layer, and live panels poll.

---

## Migrations: read this before you write one

🔴 **Nothing applies migrations on deploy.** Every migration is applied to
production **before** `main` moves, and every one is additive so the running
deployment survives the gap.

🔴 **`db:migrate` prints "Migrations applied" whether or not it did anything.**
Verify against `information_schema` every time. `scripts/migrate.ts` now refuses
before applying if the directory and the journal disagree, but the success line is
still not evidence.

🔴 **`drizzle-kit generate` without `--custom` cannot be used in this repository.**
`drizzle/meta/` holds only `0000_snapshot.json`; the chain was never built, so a
plain generate emits a migration recreating eighty-nine existing tables. Use
`--custom`, then **correct the generated `when`** to continue this journal's
sequence: drizzle applies a migration only when the previous ledger timestamp is
lower, and the generated value is a wall clock that lands behind our synthetic ones.

---

## Environment variables

### Required — the app refuses to boot in production without them

| Var | What it is |
|---|---|
| `DATABASE_URL` | Neon **pooled** connection string |
| `AUTH_SECRET` | Session cookie signing secret, 32 chars or more |
| `OPENAI_API_KEY` | Transcription and note generation |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhooks |
| `APP_URL` | Public origin, no trailing slash |

### Recommended — the feature degrades, the app still runs

| Var | What breaks without it |
|---|---|
| `DAILY_API_KEY` | Our room shows an honest "video is not configured" state. Audio and notes still work |
| `RECALL_API_KEY` | External meetings connect but no bot is dispatched |
| `STRIPE_SECRET_KEY` | No checkout. Nothing is charged |
| `RESEND_API_KEY` | No emails |
| `EMAIL_FROM` | Sender identity |
| `CRON_SECRET` | Scheduled jobs reject every request |
| `TOKEN_ENCRYPTION_KEY` | OAuth refresh tokens cannot be sealed, so meeting and EHR connections fail closed |

### Optional

| Var | Notes |
|---|---|
| `DATABASE_URL_DIRECT` | Non-pooled, for maintenance PgBouncer cannot carry |
| `DATABASE_SSL` | Tri-state. Leave unset unless running local Postgres without TLS |
| `SENTRY_DSN` | Disable session replay before enabling on a clinical app |
| `E2E_CHROMIUM` | Overrides browser resolution. `scripts/_browser.ts` resolves without it |

---

## Local development

```
npm install
cp .env.example .env.local     # fill in DATABASE_URL and AUTH_SECRET
npm run db:migrate             # then VERIFY against information_schema
npm run dev
```

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | The safety suite |
| `npm run test:e2e` | Playwright, **through `tests/run-e2e.sh`**, which resolves the browser and starts a server. Running the file directly fails for that reason alone |
| `npm run verify:claims` | 🔴 Reads every published sentence and refuses a promise about a person's response time or an absolute about how well anything performs. Needs no database |
| `npm run verify:sprintNN` | Per-sprint gates. Most need a **branch** database and refuse production by name |
| `npm run demo:seed` | Synthetic clinicians and invented people. **Refuses production by name** |
| `npm run ship:content` | Publishes CMS defaults **to production**, then re-runs the verifiers you name. The CMS is authored-content-wins, so a copy fix that has not been shipped is a copy fix nobody can read |
| `npm run screens` | Screenshots every screen |

---

## Scheduled jobs

| Job | Schedule | What |
|---|---|---|
| `/api/cron/crisis` | every 5 min | Re-delivers crisis alerts whose notification failed. The alert is written **before** anyone is notified |
| `/api/cron/billing` | every 30 min | Charges completed sessions with no charge row; drains partner webhooks; runs the enrolment re-verification cycle |
| `/api/cron/retention` | daily 03:00 | Deletes audit records older than six years and expired tokens |

---

## Safety invariants

These are the ones that end the company if they break.

1. **A patient never converses with a model**, and no model output reaches a patient
   without a named clinician approving that exact text. Enforced on the import graph.
2. **The crisis path never depends on money.** No credit, an unpaid invoice, a
   suspended account or an empty pot all leave it untouched.
3. **A journal may be quoted and never concluded from.** C123's alerting path is
   separate and unchanged: a journal is still scanned and a grant-holder still told.
4. **A note carries how it was made** — transcript, partial, or the clinician's own
   memory — on every surface it appears.
5. **Nothing about any record appears before a handle is proven.** Not a name, not a
   photo, not an initial.
6. **"24/7" describes the radar being open**, never that anybody will answer. No
   response-time promise appears anywhere.

---

## Documentation

| File | What |
|---|---|
| `PLAN.md` | The specification. §2 is every concern and its ruling; §6 is the standing rules |
| `HAZARDS.md` | Traps that have already caused defects here. Read once before your first commit |
| `docs/simulation/` | **The six-month simulation**, in six documents: the cast, the swarm, the money, the capture, and how six months of history is produced in one hour. Read with `docs/WALKTHROUGH-PROMPT.md`, which is the prompt that starts it |
| `docs/walkthrough-3/` | What that simulation produced: frames per person at month 0, 1, 3 and 6, the database in words at each, the money reconciliation, and the findings |
| `docs/walkthrough-archive/` | The written record of the two earlier walkthroughs. **Their frames were deleted on 2026-09-14**, and both video scripts are marked stale: they were written for a product that had one therapist and one patient in it |

---

## Layout

```
app/(public)     marketing, radar, developers, verify
app/(auth)       sign-in for clinicians and staff
app/(app)        the therapist portal
app/(patient)    the patient app
app/(clinic)     practices and hospitals
app/(sponsor)    companies and universities
app/(partner)    the developer portal
app/(admin)      the back office
app/(room)       the live session
lib/data/        every database read and write
lib/ai/          prompts, transcription, the copilot
lib/billing/     fees, credit, the ledger, payouts
lib/crisis/      scanning, levels, lines, alerts
drizzle/         migrations. Additive, applied before main moves
scripts/         verifiers, seeds, ratchets
```
