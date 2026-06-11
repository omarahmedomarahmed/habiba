# 24Therapy — Setup & Deployment Guide

> Complete step-by-step guide for local development, staging, and production deployment.
> Last verified: 2026-06-11

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Environment Variables Reference](#environment-variables-reference)
4. [Database Setup & Migrations](#database-setup--migrations)
5. [Deploy Backend to Railway](#deploy-backend-to-railway)
6. [Deploy Frontend Apps to Vercel](#deploy-frontend-apps-to-vercel)
7. [Domain Configuration](#domain-configuration)
8. [Production Checklist](#production-checklist)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20.x | https://nodejs.org or `nvm install 20` |
| pnpm | 9.15.4 | `npm install -g pnpm@9.15.4` |
| Docker | latest | https://docs.docker.com/get-docker/ |
| Git | 2.x+ | system |
| psql | 14+ | `brew install postgresql` / apt |

---

## Local Development

### 1. Clone the repository

```bash
git clone https://github.com/omarahmedomarahmed/habiba.git
cd habiba
```

### 2. Install all dependencies

```bash
pnpm install
# pnpm-lock.yaml is committed — this is deterministic
```

### 3. Start local infrastructure (Docker)

```bash
# Start PostgreSQL and Redis only
docker-compose up -d postgres redis

# OR start the full stack (all apps + services)
docker-compose up -d
```

Default Docker services:
- PostgreSQL: `localhost:5432` (user: `postgres`, pass: `postgres`, db: `therapy_db`)
- Redis: `localhost:6379`

### 4. Set up environment variables

```bash
# Backend
cp backend/.env.example backend/.env.local
# Edit backend/.env.local with your values

# Each frontend app
cp apps/web/.env.example apps/web/.env.local
cp apps/therapist/.env.example apps/therapist/.env.local
cp apps/patient/.env.example apps/patient/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Minimum backend `.env.local` for local dev:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/therapy_db
DATABASE_SSL=false
JWT_SECRET=local-dev-secret-change-in-production-must-be-64-chars-minimum
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
NODE_ENV=development
PORT=4000
```

### 5. Run database migrations

```bash
# Set your local DATABASE_URL
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/therapy_db

# Run all migrations in order
for f in migrations/0*.sql; do
  echo "Running $f..."
  psql $DATABASE_URL -f "$f"
done
```

Or run individually:
```bash
psql $DATABASE_URL -f migrations/001_core_schema.sql
psql $DATABASE_URL -f migrations/002_therapists_schema.sql
psql $DATABASE_URL -f migrations/003_patients_schema.sql
psql $DATABASE_URL -f migrations/004_clinical_schema.sql
psql $DATABASE_URL -f migrations/005_medications_schema.sql
psql $DATABASE_URL -f migrations/006_sessions_schema.sql
psql $DATABASE_URL -f migrations/007_ai_schema.sql
psql $DATABASE_URL -f migrations/008_assessments_schema.sql
psql $DATABASE_URL -f migrations/009_radar_schema.sql
psql $DATABASE_URL -f migrations/010_billing_schema.sql
psql $DATABASE_URL -f migrations/011_notifications_schema.sql
psql $DATABASE_URL -f migrations/012_audit_compliance_schema.sql
psql $DATABASE_URL -f migrations/013_marketplace_schema.sql
psql $DATABASE_URL -f migrations/014_analytics_schema.sql
psql $DATABASE_URL -f migrations/015_pricing_management.sql
```

> ⚠️ **Known Issue**: Migrations 003 and 012 both reference `patient_consents` with conflicting schemas. If you hit a duplicate table error on migration 012, skip the `CREATE TABLE patient_consents` block in 012 — this needs a fix (tracked in DEV_HANDOVER.md).

### 6. Start development servers

```bash
# All apps concurrently (recommended)
pnpm dev

# Individual apps
pnpm --filter=@24therapy/api dev         # http://localhost:4000
pnpm --filter=@24therapy/web dev         # http://localhost:3000
pnpm --filter=@24therapy/therapist dev   # http://localhost:3001
pnpm --filter=@24therapy/patient dev     # http://localhost:3002
pnpm --filter=@24therapy/admin dev       # http://localhost:3003
```

API documentation (dev only): http://localhost:4000/api/docs

---

## Environment Variables Reference

### Backend (`backend/.env.local`)

```env
# ── Core ─────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=4000

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
DATABASE_SSL=true
DATABASE_MAX_CONNECTIONS=10

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://default:password@host:6379

# ── Authentication ────────────────────────────────────────────────────────────
JWT_SECRET=<minimum 64 random characters>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d
BCRYPT_ROUNDS=12
COOKIE_SECRET=<random string>

# ── AI ───────────────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...   # Optional — Anthropic Claude backup

# ── Payments ─────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── Email ────────────────────────────────────────────────────────────────────
RESEND_API_KEY=re_...
FROM_EMAIL=24Therapy <noreply@24therapy.ai>

# ── AWS S3 ───────────────────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=24therapy-uploads
AWS_CLOUDFRONT_URL=https://cdn.24therapy.ai

# ── Video (Daily.co) ─────────────────────────────────────────────────────────
DAILY_API_KEY=...
DAILY_DOMAIN=24therapy.daily.co

# ── App URLs ─────────────────────────────────────────────────────────────────
APP_URL=https://24therapy.ai
THERAPIST_APP_URL=https://app.24therapy.ai
PATIENT_APP_URL=https://my.24therapy.ai
ADMIN_APP_URL=https://admin.24therapy.ai
API_URL=https://api.24therapy.ai

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGINS=https://24therapy.ai,https://app.24therapy.ai,https://my.24therapy.ai,https://admin.24therapy.ai

# ── Feature Flags ────────────────────────────────────────────────────────────
AI_SCRIBE_ENABLED=true
COPILOT_ENABLED=true
RADAR_ENABLED=true
MARKETPLACE_ENABLED=true
BILLING_ENABLED=true
```

### Frontend Apps (`apps/*/. env.local`)

All frontend apps share this pattern:

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_WEB_URL=https://24therapy.ai
NEXT_PUBLIC_THERAPIST_URL=https://app.24therapy.ai
NEXT_PUBLIC_PATIENT_URL=https://my.24therapy.ai
NEXT_PUBLIC_ADMIN_URL=https://admin.24therapy.ai
```

Additional for `apps/web`:
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

Additional for `apps/therapist`:
```env
NEXT_PUBLIC_DAILY_DOMAIN=24therapy.daily.co
```

---

## Database Setup & Migrations

### Recommended: Neon (serverless PostgreSQL)

1. Create account at https://neon.tech
2. Create project `24therapy-production`
3. Enable the pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```
4. Copy the connection string to `DATABASE_URL`
5. Run migrations (see above)

### Alternative: Railway PostgreSQL

1. In Railway project → Add Service → PostgreSQL
2. Copy `DATABASE_URL` from service variables
3. Run migrations via Railway CLI or external psql client

### Migration Order (must be sequential)

```
001 → core tables (users, organizations, accounts)
002 → therapist profiles, specializations, availability
003 → patient profiles, contacts, consents
004 → clinical data, diagnoses, treatment history
005 → medications, prescriptions
006 → sessions, transcripts, notes
007 → AI memory, embeddings, prompts
008 → assessments, scoring, templates
009 → radar (crisis matching), risk alerts
010 → billing, subscriptions, invoices (Stripe)
011 → notifications, preferences, channels
012 → audit logs, HIPAA compliance, BAA records
013 → marketplace, therapist directory, search
014 → analytics events, dashboards, metrics
015 → pricing management (admin-editable plans)
```

---

## Deploy Backend to Railway

### First Deploy

1. Go to https://railway.app → New Project → Deploy from GitHub
2. Select the `habiba` repository
3. Railway will detect `railway.json` at root — confirms NestJS setup
4. Set the following environment variables in Railway Variables tab:

**Required (backend will crash without these):**
```
DATABASE_URL        postgresql://...?sslmode=require
DATABASE_SSL        true
JWT_SECRET          <64+ char random string>
OPENAI_API_KEY      sk-...
NODE_ENV            production
```

**Required for full functionality:**
```
STRIPE_SECRET_KEY       sk_live_...
STRIPE_WEBHOOK_SECRET   whsec_...
RESEND_API_KEY          re_...
REDIS_URL               redis://...
AWS_ACCESS_KEY_ID       ...
AWS_SECRET_ACCESS_KEY   ...
AWS_S3_BUCKET           24therapy-uploads
DAILY_API_KEY           ...
CORS_ORIGINS            https://24therapy.ai,https://app.24therapy.ai,...
```

5. Trigger deploy — Railway will run `npm run build && npm run start:prod`
6. Verify: `curl https://your-service.railway.app/health` → `{"status":"ok",...}`

### Custom Domain

In Railway project → Settings → Networking → Add Custom Domain:
- `api.24therapy.ai` → CNAME your-service.railway.app

### railway.json Reference

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node dist/main",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3,
    "healthcheckPath": "/health",
    "healthcheckTimeout": 120
  }
}
```

---

## Deploy Frontend Apps to Vercel

Each Next.js app is a **separate Vercel project** pointing at the same repository.

### Setup per app (repeat for all 4)

1. Go to https://vercel.com → New Project → Import from GitHub (`habiba`)
2. Set **Root Directory** to the app folder:
   - `apps/web` for the marketing site
   - `apps/therapist` for the therapist portal
   - `apps/patient` for the patient portal
   - `apps/admin` for the admin portal
3. Vercel will auto-detect `vercel.json` in the app folder
4. Add environment variables (see above)
5. Deploy

### Install Command (auto from vercel.json)
```
cd ../.. && pnpm install --frozen-lockfile
```

### Build Command (auto from vercel.json)
```
cd ../.. && pnpm turbo build --filter=@24therapy/<app-name>
```

### Environment Variables in Vercel

For each app project, set at minimum:
```
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_WEB_URL=https://24therapy.ai
NEXT_PUBLIC_THERAPIST_URL=https://app.24therapy.ai
NEXT_PUBLIC_PATIENT_URL=https://my.24therapy.ai
NEXT_PUBLIC_ADMIN_URL=https://admin.24therapy.ai
```

### Custom Domains in Vercel

| Project | Domain |
|---------|--------|
| `24therapy-web` | `24therapy.ai` |
| `24therapy-therapist` | `app.24therapy.ai` |
| `24therapy-patient` | `my.24therapy.ai` |
| `24therapy-admin` | `admin.24therapy.ai` |

---

## Domain Configuration

### DNS Records (add to your DNS provider)

```
# Marketing site
A     24therapy.ai           76.76.21.21   (Vercel IP)
CNAME www.24therapy.ai       cname.vercel-dns.com

# App subdomains
CNAME app.24therapy.ai       cname.vercel-dns.com
CNAME my.24therapy.ai        cname.vercel-dns.com
CNAME admin.24therapy.ai     cname.vercel-dns.com

# API (Railway)
CNAME api.24therapy.ai       your-service.railway.app

# CDN (CloudFront / S3)
CNAME cdn.24therapy.ai       your-cloudfront-dist.cloudfront.net
```

---

## Production Checklist

### Security
- [ ] `JWT_SECRET` is 64+ random characters (use `openssl rand -hex 32`)
- [ ] `COOKIE_SECRET` set and rotated from defaults
- [ ] `NODE_ENV=production` in Railway
- [ ] Stripe using live keys (`sk_live_`, `pk_live_`)
- [ ] CORS_ORIGINS contains only your actual domains (no wildcards)
- [ ] Admin portal has IP allowlist configured (if required)
- [ ] MFA enforced for `super_admin` and `admin` roles

### Database
- [ ] pgvector extension enabled
- [ ] All 15 migrations run in order
- [ ] Backup policy configured (daily minimum)
- [ ] Connection pooling max set (`DATABASE_MAX_CONNECTIONS=10`)
- [ ] SSL required (`DATABASE_SSL=true`, `?sslmode=require` in URL)

### Frontend
- [ ] `NEXT_PUBLIC_API_URL` set in all 4 Vercel projects (no localhost)
- [ ] All custom domains verified and SSL active in Vercel
- [ ] Admin portal robots.txt returns `noindex, nofollow` (already in next.config.ts)

### Backend
- [ ] Health check responds: `GET /health → 200`
- [ ] Swagger disabled in production (`NODE_ENV=production` disables `/api/docs`)
- [ ] Rate limiting active (100/min, 1000/hour — configured in app.module.ts)
- [ ] Stripe webhook endpoint registered: `POST /billing/webhooks/stripe`

### AI/Integrations
- [ ] OpenAI API key has sufficient credits and rate limits
- [ ] Daily.co account verified for HIPAA BAA
- [ ] Resend verified sender domain
- [ ] AWS S3 bucket policy: private, CORS configured for API domain

---

## Troubleshooting

### Backend won't start on Railway

1. Check Railway logs for missing env var messages — the backend logs each missing variable by name
2. Minimum required: `DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`
3. If DB connection fails, verify `?sslmode=require` is in the URL and `DATABASE_SSL=true`

### Vercel build fails: `pnpm: command not found`

- Ensure `pnpm-lock.yaml` is committed (Vercel reads lockfileVersion to activate pnpm 9)
- Ensure `packageManager: "pnpm@9.15.4"` is in root `package.json`

### Vercel build fails: `ERR_PNPM_UNSUPPORTED_ENGINE`

- Node version mismatch — set Node.js version to `20.x` in Vercel project settings

### Font build error: `Failed to fetch Inter from Google Fonts`

- This only happens in network-restricted environments (not Vercel/Railway)
- Vercel has full network access — build will succeed in production
- For local CI: set `NEXT_PUBLIC_FONT_HOST` or use `--no-lint` flag

### `relation does not exist` on therapist endpoints

- Missing `therapist_specializations` junction table
- Workaround: run the SQL patch in DEV_HANDOVER.md (section: Schema Fixes)

### Login works but API calls return 401

- Check that token refresh logic is active in the app's `lib/api.ts`
- Tokens expire in 15 minutes — the API client should auto-refresh via `/auth/refresh`
- Check browser localStorage for `access_token` / `refresh_token` keys

### Docker compose postgres fails

```bash
docker-compose down -v   # remove volumes
docker-compose up -d postgres redis
```
