# 24Therapy

AI clinical documentation for therapists. Start a session on your phone, and the SOAP
note, summary and follow-up are written for you by the time you say goodbye.

**One Next.js application. One deployment. One database.**

---

## What this is

| Surface | Path | Who |
|---|---|---|
| Public site | `/`, `/features`, `/pricing`, `/privacy`, … | Anyone. Content is CMS-backed and edited in the admin console. |
| Clinician portal | `/dashboard`, `/sessions`, `/patients`, `/notes`, `/billing`, `/settings` | Signed-in therapists, phone-first |
| Live session room | `/sessions/[id]/room` | The clinician, full-screen |
| Patient join | `/join/[token]` | The patient. No account, no password, no app. |
| Admin console | `/admin` | Super admins |

The core loop is: **New session → type a first name → Start → End → review → Approve & send.**
Four screens, roughly eight taps, from a brand-new account to a signed note in a
patient's inbox.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19 | Server components for reads, server actions for writes |
| Styling | Tailwind v4 | Tokens defined once in `app/globals.css` |
| Database | Neon Postgres via Drizzle | Typed schema — the old codebase's single largest bug class was column-name drift against hand-written SQL |
| Driver | `@neondatabase/serverless` (WebSocket pool) | Real transactions, and Neon's proxy absorbs serverless connection fan-out |
| Auth | Opaque session tokens in an httpOnly cookie | Revocable on the next request; nothing readable by script |
| AI | OpenAI — `gpt-4o-mini-transcribe`, `gpt-4o` | One transcription call per chunk, one JSON call per note |
| Video | Daily.co, private rooms + per-participant tokens | The room URL alone is never a credential |
| Email | Resend | Password resets, join links, patient summaries |
| Payments | Stripe | Two plans, idempotent webhooks |

There is **no WebSocket server and no separate API service**. The browser already uploads
an audio chunk every eight seconds, so the response to that upload carries new transcript
text and any crisis flag. That is the entire realtime layer.

---

## Environment variables

17 in total. Set these in **Vercel → Project → Settings → Environment Variables**.

### Required — the app refuses to boot in production without them

| Var | What it is | Where to get it |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** connection string | Neon dashboard → Connection string (the one containing `-pooler`) |
| `AUTH_SECRET` | Session cookie signing secret, ≥32 chars | `openssl rand -hex 32` |
| `OPENAI_API_KEY` | Transcription + note generation | platform.openai.com → API keys |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe webhooks | Stripe → Developers → Webhooks → signing secret |
| `APP_URL` | Public origin, no trailing slash | e.g. `https://24therapy.ai` |

### Strongly recommended — the feature degrades without them, the app still runs

| Var | What breaks without it |
|---|---|
| `DAILY_API_KEY` | Video sessions show an honest "video not configured" state. Audio and notes still work. |
| `STRIPE_SECRET_KEY` | No checkout. Sessions still record and notes are still written; nothing is charged. |
| `RESEND_API_KEY` | No emails: no patient summaries, no join links, no password resets. |
| `EMAIL_FROM` | Sender identity, e.g. `24Therapy <noreply@24therapy.ai>` |
| `CRON_SECRET` | Scheduled jobs reject every request. Set it to any long random string; Vercel Cron sends it automatically. |

### Optional

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL_DIRECT` | falls back to `DATABASE_URL` | Non-pooled connection for maintenance that PgBouncer cannot carry |
| `DATABASE_SSL` | on in production, off locally | Tri-state. Leave unset unless you are running local Postgres without TLS. |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | — | Error reporting. Disable session replay before enabling on a clinical app. |

### Seed-script only (never needed in Vercel)

`SEED_ADMIN_EMAIL` · `SEED_ADMIN_PASSWORD` · `SEED_TEST_EMAIL` · `SEED_TEST_PASSWORD` ·
`SEED_ORG_NAME` · `SEED_ORG_SLUG`

---

## First deploy

```bash
# 1. Point DATABASE_URL at the Neon project, then:
npm ci
npm run db:migrate        # creates all 16 tables
npm run db:seed           # organisation + super admin + published public pages
```

`db:seed` needs `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` set, or it skips admin
creation and only publishes the public pages. It is idempotent — safe on every deploy —
and it will **not** overwrite CMS pages an admin has edited.

### Creating the admin account

```bash
DATABASE_URL='postgres://…' \
SEED_ADMIN_EMAIL='you@yourdomain.com' \
SEED_ADMIN_PASSWORD='a-long-password-you-choose' \
npm run db:seed
```

Re-running with the same email resets that admin's password. Re-running with a different
email adds a second admin. Passwords are scrypt hashes; nothing is ever stored in plain
text.

### Creating the test therapist and test patient

```bash
DATABASE_URL='postgres://…' npm run db:seed -- --demo
```

Adds, on top of the above:

| Thing | Value |
|---|---|
| Test therapist | `test@24therapy.ai` / `TestTherapist2026!` |
| Test patient | Test Patient, attached to that therapist |
| Demo session | One completed session with a 12-segment transcript and an approved SOAP note |

Override with `SEED_TEST_EMAIL` and `SEED_TEST_PASSWORD`. The demo data is behind a flag
deliberately, so a production deploy running `db:seed` never quietly creates a login whose
password is written down in this file.

---

## Local development

```bash
cp .env.example .env.local   # then fill in DATABASE_URL and AUTH_SECRET
npm ci
npm run db:migrate
npm run db:seed -- --demo
npm run dev
```

```bash
npm run typecheck   # tsc --noEmit
npm test            # safety + auth + billing invariants
npm run build       # production build
```

`npm test` runs with `--conditions=react-server` so that `server-only` modules resolve to
their no-op build outside a React Server Component context.

---

## Scheduled jobs

Declared in `vercel.json`, authenticated with `CRON_SECRET`:

| Job | Schedule | What it does |
|---|---|---|
| `/api/cron/crisis` | every 5 min | Re-delivers crisis alerts whose notification failed. Alerts are written to the database **before** anyone is notified, so this is what makes them survive a delivery failure. |
| `/api/cron/billing` | every 30 min | Charges completed sessions that produced no charge row |
| `/api/cron/retention` | daily 03:00 | Deletes audit records older than six years and expired sessions |

---

## Security invariants

These are enforced in code and covered by `tests/safety.test.ts`. Do not regress them.

1. **No PHI in logs.** `lib/logger.ts` truncates every UUID it sees and takes no free text
   beyond a fixed message. Crisis alerts log an indicator *count*, never the words.
2. **Patients never see a risk level.** `patientFacingCrisisMessage()` returns support and
   a helpline. There is no patient-facing component that accepts a risk level as a prop.
3. **Boot guard.** `lib/env.ts` refuses to start in production without the required
   variables, and rejects a short or placeholder `AUTH_SECRET`.
4. **Roles are an allowlist over a closed union**, never a numeric hierarchy. An
   unrecognised role is denied.
5. **Middleware is not the authorisation boundary.** It only redirects. Every page, action
   and route handler calls `requireUser()` / `requireRole()` itself.
6. **Every clinical read and write is audited** through `lib/audit.ts`, awaited, and
   allowed to throw. An audit insert that fails silently is worse than none, because you
   plan around it.
7. **Org scoping lives in the data layer** (`lib/data/*`), taken from the authenticated
   actor and never from a request parameter.
8. **No CMS field is ever rendered as HTML.** Content is structured blocks; the renderer
   has no `dangerouslySetInnerHTML`.

## Before your first real patient

- Sign BAAs: Vercel (Pro + HIPAA add-on), Neon (Scale plan), OpenAI, Resend, Daily, and
  Sentry if enabled.
- Confirm consent-to-record wording with counsel and put it in `/terms`.
- Review `/privacy`, `/terms` and `/hipaa` — they ship as honest starting points, not as
  legal advice.
- Turn off Sentry session replay. It would record therapy screens.

---

## Layout

```
app/
  (public)/      marketing + legal, CMS-backed, statically rendered
  (auth)/        sign in, sign up, password reset
  (app)/         clinician portal
  (room)/        the live session room, full-bleed
  (admin)/       admin console + CMS editor
  join/[token]/  the patient surface
  api/           transcribe, session state, Stripe webhook, cron
components/
  clinical/      TranscriptPanel, NoteCard, RiskBanner — pure presentational
  demo/          the public-site live hero and its synthetic fixtures
lib/
  ai/            transcription, note generation, crisis detection
  data/          the only place clinical data is read or written
  auth/          sessions, guards, password hashing
  billing/       plans, charges, Stripe
```

`components/clinical/*` take props and fetch nothing. That is what lets the marketing site
render the real transcript panel and the real note card with fixture data — and what makes
it structurally impossible for a public page to reach a real chart through them.
