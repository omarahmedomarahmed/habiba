# Deployment Guide — 24Therapy Mental Health OS

## Architecture at a glance

| Service | Platform | URL pattern |
|---------|----------|-------------|
| `backend` (NestJS) | Railway | `api.24therapy.ai` |
| `apps/web` (marketing) | Vercel | `24therapy.ai` |
| `apps/therapist` | Vercel | `app.24therapy.ai` |
| `apps/patient` | Vercel | `my.24therapy.ai` |
| `apps/admin` | Vercel | `admin.24therapy.ai` |
| PostgreSQL + pgvector | **Neon** (https://neon.tech) | external connection string |

---

## Prerequisites

- Node 20 (`.nvmrc` pins it)
- pnpm 9.15.4 (`packageManager` in `package.json`)
- Railway CLI (`npm i -g @railway/cli`) for backend deploys
- Vercel CLI (`npm i -g vercel`) for frontend deploys
- **Neon account** (https://neon.tech) — PostgreSQL 16 + pgvector, serverless, free tier available

---

## First-time setup

### 1. Clone and install

```bash
git clone https://github.com/omarahmedomarahmed/habiba.git
cd habiba
corepack enable
pnpm install
```

### 2. Database

```bash
# Run all migrations (001–028) — paste your Neon connection string
DATABASE_URL=postgres://... node scripts/migrate.js

# Seed super-admin (run once)
DATABASE_URL=postgres://... \
SEED_ADMIN_EMAIL=admin@yourpractice.com \
SEED_ADMIN_PASSWORD=$(openssl rand -hex 16) \
node scripts/seed.js
```

### 3. Backend (Railway)

Set these variables in Railway → Variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon connection string (`postgresql://...@...neon.tech/...?sslmode=require`) |
| `DATABASE_SSL` | `true` (required for Neon) |
| `JWT_SECRET` | `openssl rand -hex 64` (min 32 chars) |
| `COOKIE_SECRET` | `openssl rand -hex 64` (min 32 chars, different from JWT_SECRET) |
| `OPENAI_API_KEY` | OpenAI API key |
| `CORS_ORIGINS` | Comma-separated allowed origins, e.g. `https://app.24therapy.ai,https://admin.24therapy.ai,https://my.24therapy.ai` |
| `NODE_ENV` | `production` |
| `DAILY_API_KEY` | Daily.co API key (for video rooms) |
| `RESEND_API_KEY` | Resend API key (transactional email) |
| `FROM_EMAIL` | Sender address for transactional email |
| `MESSAGE_ENCRYPTION_KEY` | `openssl rand -hex 32` — AES-256-GCM encryption for messages at rest |
| `SENTRY_DSN` | (optional) Sentry DSN for error monitoring |

Deploy:
```bash
railway up
```

`railway.json` runs `node scripts/migrate.js` before each deploy (`preDeployCommand`).

### 4. Frontend apps (Vercel)

Each app in `apps/` has its own `vercel.json`. Set per-project in Vercel:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.24therapy.ai/api/v1` |

Deploy all:
```bash
vercel --cwd apps/web --prod
vercel --cwd apps/therapist --prod
vercel --cwd apps/patient --prod
vercel --cwd apps/admin --prod
```

---

## Migrations

```bash
# Check status
DATABASE_URL=... node scripts/migrate.js --status

# Dry-run (print pending without running)
DATABASE_URL=... node scripts/migrate.js --dry-run

# Apply all pending
DATABASE_URL=... node scripts/migrate.js

# Baseline (mark existing DB as up-to-date without running SQL)
DATABASE_URL=... node scripts/migrate.js --baseline
```

The runner uses `pg_advisory_lock(24107)` — concurrent runs abort safely.
Each migration runs in a transaction; a failure rolls back and exits.

---

## Environment variable reference

### Backend (all required in production)

| Variable | Default (dev) | Notes |
|----------|---------------|-------|
| `DATABASE_URL` | — | **Required** — Neon connection string |
| `DATABASE_SSL` | `false` (dev) | Set `true` for Neon in production |
| `NODE_ENV` | `development` | Set `production` on Railway |
| `JWT_SECRET` | `dev-only-secret-change-me` | **Required** — min 32 chars |
| `COOKIE_SECRET` | `dev-only-cookie-secret` | **Required** — min 32 chars |
| `JWT_ACCESS_EXPIRY` | `15m` | |
| `JWT_REFRESH_EXPIRY` | `30d` | |
| `OPENAI_API_KEY` | — | **Required** in production |
| `CORS_ORIGINS` | (localhost + staging) | **Required** in production — crashes without it |
| `MESSAGE_ENCRYPTION_KEY` | — | Recommended — 32 hex bytes (`openssl rand -hex 32`) |
| `SENTRY_DSN` | — | Optional — error monitoring |
| `REDIS_URL` | — | Optional — not required; app works without it |
| `DAILY_API_KEY` | — | Video sessions |
| `RESEND_API_KEY` | — | Transactional email |
| `FROM_EMAIL` | `noreply@24therapy.ai` | |
| `STAGING_DATABASE_URL` | — | Optional — for `scripts/backup-verify.js` |
| `PORT` | `4000` | |

### Frontend (all apps)

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | Full base URL incl `/api/v1`, e.g. `https://api.24therapy.ai/api/v1` |

---

## Build commands

```bash
# Build backend only
pnpm --filter @24therapy/api build

# Build specific frontend
pnpm --filter @24therapy/web build

# Build everything
pnpm build
```

All Next.js apps use `output: 'standalone'` — suitable for Docker or Railway.

---

## Health check

```
GET /health → 200 { status: 'ok', timestamp: '...' }
```

Railway is configured with `healthcheckPath: /health`, timeout 120 s.

---

## Private beta checklist

- [ ] BAAs signed with all beta customers
- [ ] `CORS_ORIGINS` set to exact beta portal URLs (no wildcards)
- [ ] `SEED_ADMIN_PASSWORD` rotated after seeding
- [ ] Daily.co webhook secret set
- [ ] Resend sending domain verified (Resend dashboard → Domains)
- [ ] Neon database backup confirmed (Neon dashboard → Backups)
- [ ] Error monitoring configured (`SENTRY_DSN` set in Railway)
- [ ] `MESSAGE_ENCRYPTION_KEY` set and `scripts/encrypt-messages.js` run for existing rows

<!-- Reviewed: 2026-06-13 — 24Therapy audit -->
