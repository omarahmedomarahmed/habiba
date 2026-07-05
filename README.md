# 24Therapy — AI-Powered Mental Health OS (MVP)

An AI platform for licensed therapists: record a session on your phone, walk away with a
full SOAP note, clinical insights, and a shareable patient report — without writing a word.

**The product spec is [`docs/PRODUCT_MVP.md`](docs/PRODUCT_MVP.md). This README is the
operations manual: architecture, environment variables, database setup, and deployment.**

---

## MVP Scope — what is deployed

The MVP has **two access levels**:

| App | Who | Port (dev) | Deploy |
|-----|-----|------------|--------|
| `apps/therapist` | Licensed therapists (primary user, phone-first) | 3001 | Vercel |
| `apps/admin` | Platform super-admins | 3003 | Vercel |
| `backend` | NestJS REST API + WebSockets | 4000 | Railway |

Also in the monorepo but **not part of the MVP deployment**:

- `apps/web` — marketing site (optional to deploy; signup funnel works against the same API)
- `apps/patient` — patient portal (**out of MVP scope** — patients join sessions via email
  link with no account, per the MVP spec; do not deploy)

### Feature map (therapist portal)

Dashboard · Sessions (online / in-person / phone, join links, live transcript, AI copilot,
crisis alerts, OFF RECORD) · Patients (no accounts required) · Notes (SOAP review/approve,
share report by email) · Treatment Plans · AI Workspace (7 modes, credit-metered on PAYG) ·
Analytics (Basic / Full) · Radar Matching · Risk Monitor · Billing · Settings

### Plan feature matrix (enforced server-side)

The single source of truth is `backend/src/modules/billing/plan-features.ts`
(mirrored in `apps/therapist/lib/tiers.ts`; exposed as `GET /billing/my-features`):

| Feature | PAYG | Starter $59/mo | Unlimited $99/mo | Practice $249/mo |
|---------|------|---------|-----------|----------|
| Sessions | $6/session (first free) | 20/mo + rollover | Unlimited | Unlimited |
| AI transcription / SOAP / Copilot | ✓ | ✓ | ✓ | ✓ |
| AI chat messages | 5/session | Unlimited | Unlimited | Unlimited |
| Recordings | — | ✓ | ✓ | ✓ |
| Radar matching | — | ✓ | ✓ | ✓ |
| HIPAA BAA | — | ✓ | ✓ | ✓ |
| Analytics | Basic | Basic | Full | Full |
| Treatment plans | ✓ | ✓ | ✓ | ✓ |
| Multi-location / white-label / EHR / dedicated support | — | — | — | ✓ |

Plan keys in the database: `pay_per_session` · `starter` · `pro` · `practice` (+ legacy `enterprise`).

---

## Architecture

```
apps/therapist     Next.js 15  → therapist portal (mobile-first, bottom-nav on phones)
apps/admin         Next.js 15  → super-admin portal
apps/web           Next.js 15  → marketing site (not required for MVP)
apps/patient       Next.js 15  → OUT OF MVP (kept for future)
backend            NestJS 10   → REST API /api/v1 + Socket.io gateways
packages/types     shared TS types      packages/config  shared URL constants
migrations/        001–012 fresh MVP schema (see below)
scripts/           migrate.js (runs on every deploy), seed.js (org + super-admin)
```

Backend modules (MVP-only): auth, users, organizations, therapists, patients, sessions,
ai, crisis, notes, treatment-plans, radar, billing, analytics, notifications, admin,
mail, contact, data-lifecycle.

---

## Database — fresh setup (Neon)

The schema was rewritten from scratch for the MVP: **12 ordered SQL files** in
`migrations/` (001_extensions → 012_seed). They create ~55 tables — exactly what the
backend queries, nothing else — and are verified to apply cleanly on a blank
PostgreSQL 16 database with the `vector` extension (Neon has pgvector built in).

### Creating the new database

1. Create a new Neon project → copy the **pooled connection string**.
2. Nothing else to prepare — migration `001_extensions.sql` enables
   `uuid-ossp`, `pgcrypto`, and `vector` itself.

### Migrations run automatically on deploy

`railway.json` → `"preDeployCommand": "node scripts/migrate.js --auto-baseline"` runs
before every backend deploy: advisory-locked, checksummed, ordered, idempotent.
The Vercel apps never touch the database — they only need `NEXT_PUBLIC_API_URL`.

Manual commands (local or one-off):

```bash
DATABASE_URL=postgres://… node scripts/migrate.js           # apply pending
DATABASE_URL=postgres://… node scripts/migrate.js --status  # show state
DATABASE_URL=postgres://… \
  SEED_ORG_NAME="24Therapy" \
  SEED_ADMIN_EMAIL="you@example.com" \
  SEED_ADMIN_PASSWORD="…strong…" node scripts/seed.js        # org + super-admin (idempotent)
```

---

## Admin accounts (create / change password in Neon)

Admins are just rows in the `users` table with `role = 'super_admin'`. Passwords are
bcrypt hashes (cost 12) in `password_hash` — never plaintext.

**Create an admin from the Neon SQL Editor** (Neon dashboard → your project → **SQL Editor**),
paste and Run:

```sql
INSERT INTO users (
  id, organization_id, email, password_hash,
  first_name, last_name, role, status, email_verified_at
)
VALUES (
  uuid_generate_v4(),
  (SELECT id FROM organizations ORDER BY created_at LIMIT 1),
  'you@example.com',
  '$2a$12$replace_with_a_real_bcrypt_hash',      -- see "generating a hash" below
  'First', 'Last', 'super_admin', 'active', NOW()
)
ON CONFLICT (organization_id, email) WHERE deleted_at IS NULL
DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'super_admin', status = 'active';
```

Add **more admins** by running the same block again with a different email. The
`ON CONFLICT … DO UPDATE` makes it safe to re-run: same email → password reset, new email → new admin.

**Change a password** — run the same statement (or just the update) with a fresh hash:

```sql
UPDATE users SET password_hash = '$2a$12$new_hash_here'
WHERE email = 'you@example.com';
```

**Generating a bcrypt hash** (any one):
- `node -e "console.log(require('bcryptjs').hashSync(process.argv[1],12))" 'YourPassword'`
  (run from the repo root — `bcryptjs` is already installed)
- or set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` and run `node scripts/seed.js` — it hashes
  for you and upserts the admin.

> Neon has no "users" UI — admin accounts live in the `users` **table**, edited via the SQL Editor.
> The `organizations` subquery attaches the admin to your first org (the one `seed.js` created).

---

## Environment variables

### Backend (Railway → Variables)

**Required in production** (boot fails without them — `backend/src/config/env.validation.ts`):

| Var | What / where to get it |
|-----|------------------------|
| `DATABASE_URL` | New Neon pooled connection string |
| `OPENAI_API_KEY` | OpenAI (GPT-4o notes/copilot + Whisper transcription) |
| `JWT_SECRET` | ≥32 random chars — `openssl rand -hex 32` |
| `COOKIE_SECRET` | ≥32 random chars — `openssl rand -hex 32` |
| `CORS_ORIGINS` | Exact origins, comma-separated: `https://app.24therapy.ai,https://admin.24therapy.ai` |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard → Webhooks → signing secret |

**Strongly recommended:**

| Var | What |
|-----|------|
| `DAILY_API_KEY` | **Required for online video sessions.** Without it the room shows an honest "video not set up" state — audio transcription still works, but no video call. Get it at dashboard.daily.co → Developers. |
| `STRIPE_SECRET_KEY` | Stripe payments (subscriptions + $6 PAYG session bills) |
| `RESEND_API_KEY` | Transactional email (invites, reports, bills) |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | Sender identity |
| `SENTRY_DSN` | Error monitoring (PHI is stripped before send) |
| `THERAPIST_APP_URL` | e.g. `https://app.24therapy.ai` (used in join links + emails) |
| `NODE_ENV` | `production` |

Optional: `REDIS_URL` (never required), `ANTHROPIC_API_KEY`, `PORT` (default 4000),
`JWT_ACCESS_EXPIRY` (default `15m` — access-token lifetime; refresh is automatic).

> **Online sessions need `DAILY_API_KEY`.** The therapist room embeds the Daily.co call in an
> iframe (its own camera/mic/screen-share controls). If the video area is blank, the key is
> missing or the room failed to create — check the backend logs for "Failed to create Daily.co room".

### Frontends (Vercel → each project's Environment Variables)

| App | Var | Value |
|-----|-----|-------|
| therapist / admin / web | `NEXT_PUBLIC_API_URL` | `https://<railway-backend-domain>/api/v1` |

### Stripe webhook

Point the Stripe webhook to `https://<backend>/api/v1/billing/webhook`
(events: `checkout.session.completed`, `invoice.payment_succeeded`,
`invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`).

---

## Local development

```bash
pnpm install
# database (any Postgres 16 with pgvector)
DATABASE_URL=postgres://localhost/24therapy node scripts/migrate.js
DATABASE_URL=… SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… node scripts/seed.js

# backend
cd backend && ../node_modules/.bin/tsc && DATABASE_URL=… JWT_SECRET=… COOKIE_SECRET=… \
  OPENAI_API_KEY=… CORS_ORIGINS=http://localhost:3001,http://localhost:3003 \
  node dist/backend/src/main.js

# apps
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 pnpm --filter @24therapy/therapist dev
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 pnpm --filter @24therapy/admin dev

# tests
cd backend && ../node_modules/.bin/jest --no-coverage
```

---

## Security invariants (never regress)

1. **No PHI in logs** — no transcript/message content in logger calls.
2. **Crisis patient copy** — patients only ever receive a supportive `crisis_support`
   message; never risk level or indicators.
3. **Production boot guard** — `validateEnv()` refuses to start with missing/weak secrets.
4. **No CORS wildcard** in production.
5. **Redis stays optional.**
6. All PHI route access is written to `phi_access_log` (HIPAA §164.312);
   break-glass access is recorded; JWT idle timeout 30 min / absolute 4 h.

---

## Mobile

The therapist portal is built phone-first: 5-tab bottom navigation on mobile, all core
flows (new session → room → note review → share) usable one-handed. The recommended path
to a native app is to wrap this portal with Capacitor (or rebuild screens in Expo reusing
`apps/therapist/lib/api.ts`) — the backend needs no changes for mobile.
