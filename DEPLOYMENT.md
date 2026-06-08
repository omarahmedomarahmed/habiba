# 24Therapy.ai — Deployment Guide

Complete step-by-step guide for deploying all five services to production.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Deployment Order](#deployment-order)
4. [Step 1 — Database (Neon)](#step-1--database-neon)
5. [Step 2 — Redis (Upstash)](#step-2--redis-upstash)
6. [Step 3 — Backend API (Railway)](#step-3--backend-api-railway)
7. [Step 4 — Frontend Apps (Vercel)](#step-4--frontend-apps-vercel)
8. [Step 5 — Custom Domains](#step-5--custom-domains)
9. [Step 6 — External Services](#step-6--external-services)
10. [Environment Variable Reference](#environment-variable-reference)
11. [Preview vs Production Environments](#preview-vs-production-environments)
12. [Post-Deploy Checklist](#post-deploy-checklist)
13. [Rollback Procedure](#rollback-procedure)
14. [Monitoring & Alerts](#monitoring--alerts)

---

## Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │            Vercel Edge               │
                    │                                     │
       ┌────────────┼──────────┬──────────┬──────────┐   │
       │            │          │          │          │   │
   24therapy.ai  app.*      my.*      admin.*        │   │
  (apps/web)  (therapist) (patient)  (admin)         │   │
       └────────────┼──────────┴──────────┴──────────┘   │
                    └──────────────────┬──────────────────┘
                                       │ HTTPS REST + WS
                                       ▼
                           ┌───────────────────────┐
                           │   Railway (NestJS)     │
                           │   api.24therapy.ai     │
                           │   Port 4000            │
                           └──────┬────────┬────────┘
                                  │        │
                         ┌────────┘        └──────────┐
                         ▼                             ▼
                  ┌─────────────┐            ┌──────────────┐
                  │ Neon (Postgres│           │ Upstash Redis │
                  │ + pgvector)  │           │              │
                  └─────────────┘            └──────────────┘
```

---

## Prerequisites

Before deploying, ensure you have accounts on:

| Platform | Purpose | URL |
|----------|---------|-----|
| Vercel | Frontend hosting (4 apps) | https://vercel.com |
| Railway | Backend hosting | https://railway.app |
| Neon | PostgreSQL + pgvector | https://neon.tech |
| Upstash | Redis | https://upstash.com |
| OpenAI | AI models | https://platform.openai.com |
| Stripe | Payments | https://dashboard.stripe.com |
| Resend | Transactional email | https://resend.com |
| Daily.co | HIPAA video | https://dashboard.daily.co |
| GitHub | Source code | https://github.com |

---

## Deployment Order

**CRITICAL**: Deploy in this exact order. Each step depends on the previous.

```
1. Neon DB   →  2. Upstash Redis   →  3. Railway Backend  →  4. Vercel Frontends  →  5. DNS
```

---

## Step 1 — Database (Neon)

### 1.1 Create Project

1. Go to [console.neon.tech](https://console.neon.tech) → **New Project**
2. Name: `24therapy-prod`
3. Region: pick closest to your users (e.g., `us-east-1`)
4. PostgreSQL version: **16**

### 1.2 Enable pgvector

In the Neon SQL editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Neon enables this automatically for new projects on the paid plan. Verify:

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### 1.3 Run Migrations

Get your connection string from Neon → **Connection Details** → copy `DATABASE_URL` (format: `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/24therapy?sslmode=require`).

Run all 15 migrations in order:

```bash
# From repo root
DATABASE_URL="postgresql://..." 

for f in migrations/*.sql; do
  echo "Running $f..."
  psql "$DATABASE_URL" -f "$f"
done
```

Or run them one at a time via the Neon SQL editor.

### 1.4 Verify

```sql
-- Should show ~50+ tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should show the vector extension
SELECT extversion FROM pg_extension WHERE extname = 'vector';
```

---

## Step 2 — Redis (Upstash)

### 2.1 Create Database

1. Go to [console.upstash.com](https://console.upstash.com) → **Create Database**
2. Name: `24therapy-prod`
3. Region: same region as your Neon database
4. Type: **Regional** (not Global — lower cost, sufficient for this use case)
5. Eviction: **No eviction** (for session tokens; important for auth)

### 2.2 Get Connection URL

From Upstash dashboard → **Details** → copy the `REDIS_URL`:

```
rediss://default:your-token@us1-xxxx.upstash.io:6379
```

---

## Step 3 — Backend API (Railway)

### 3.1 Create Railway Project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select repo: `omarahmedomarahmed/habiba`
3. Railway will detect `backend/railway.json` automatically

### 3.2 Configure Build Settings

Railway uses `backend/railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd .. && pnpm install --frozen-lockfile && cd backend && pnpm build"
  },
  "deploy": {
    "startCommand": "node dist/main",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

If Railway doesn't auto-detect it:
- **Root Directory**: `/backend`
- **Build Command**: `cd .. && pnpm install --frozen-lockfile && cd backend && pnpm build`
- **Start Command**: `node dist/main`

### 3.3 Set Environment Variables

In Railway → **Variables**, add all required env vars. Copy from `backend/.env.example` and fill in real values:

#### Required for Boot

```bash
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...        # From Neon step 1.4
DATABASE_SSL=true
REDIS_URL=rediss://...               # From Upstash step 2.2
JWT_SECRET=<openssl rand -hex 64>
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=30d
BCRYPT_ROUNDS=12
COOKIE_SECRET=<openssl rand -hex 64>
```

#### Required for AI Features

```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_DEFAULT_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_WHISPER_MODEL=whisper-1
OPENAI_MAX_TOKENS=4096
```

#### Required for Email (Auth Flows)

```bash
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASSWORD=re_...                 # From Resend API key
EMAIL_FROM=noreply@24therapy.ai
EMAIL_FROM_NAME=24Therapy
```

#### Required for Billing

```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...
```

#### CORS (must match your Vercel domains)

```bash
CORS_ORIGINS=https://24therapy.ai,https://app.24therapy.ai,https://my.24therapy.ai,https://admin.24therapy.ai
```

#### Optional Services

```bash
DAILY_API_KEY=...                    # Video sessions
SENTRY_DSN=https://...               # Error monitoring
AWS_S3_BUCKET=24therapy-files        # File uploads
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### 3.4 Deploy & Verify

1. Railway will auto-deploy after env vars are saved
2. Check health: `https://your-railway-url.railway.app/health`
3. Expected response:
   ```json
   {
     "status": "ok",
     "timestamp": "2026-06-07T...",
     "version": "1.0.0",
     "database": "connected",
     "redis": "connected"
   }
   ```

### 3.5 Note Your API URL

Railway assigns a URL like `https://web-production-xxxx.up.railway.app`.  
This becomes `NEXT_PUBLIC_API_URL` for all four frontend apps.  
After setting a custom domain it will be `https://api.24therapy.ai`.

---

## Step 4 — Frontend Apps (Vercel)

Each of the four Next.js apps is deployed as its own Vercel project from the same monorepo.

### 4.1 Create Vercel Projects

For each app, create a new Vercel project:

1. Vercel Dashboard → **Add New** → **Project** → **Import Git Repository**
2. Select repo: `omarahmedomarahmed/habiba`
3. Set the **Root Directory** to the app folder

| Project Name | Root Directory | Build Filter |
|-------------|----------------|-------------|
| `24therapy-web` | `apps/web` | `@24therapy/web` |
| `24therapy-therapist` | `apps/therapist` | `@24therapy/therapist` |
| `24therapy-patient` | `apps/patient` | `@24therapy/patient` |
| `24therapy-admin` | `apps/admin` | `@24therapy/admin` |

**Important**: Do NOT use the default build settings. Each app has a `vercel.json` that overrides them.

### 4.2 Verify vercel.json Settings

Each app's `vercel.json` contains the correct `installCommand` and `buildCommand` for pnpm monorepo:

```json
{
  "framework": "nextjs",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm turbo build --filter=@24therapy/web",
  "outputDirectory": ".next"
}
```

Vercel reads this automatically — no manual override needed.

### 4.3 Set Environment Variables per App

> **Note**: The `vercel.json` `env` block contains preview-URL values for Vercel preview deployments. For production, override these in the Vercel Dashboard under **Settings → Environment Variables** → filter to **Production** environment.

#### `apps/web` — Production Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://24therapy.ai
NEXT_PUBLIC_THERAPIST_APP_URL=https://app.24therapy.ai
NEXT_PUBLIC_PATIENT_APP_URL=https://my.24therapy.ai
NEXT_PUBLIC_ADMIN_APP_URL=https://admin.24therapy.ai
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/24therapy/demo
```

#### `apps/therapist` — Production Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_APP_URL=https://app.24therapy.ai
NEXT_PUBLIC_PATIENT_APP_URL=https://my.24therapy.ai
NEXT_PUBLIC_SITE_URL=https://24therapy.ai
NEXT_PUBLIC_DAILY_DOMAIN=your-subdomain.daily.co
```

#### `apps/patient` — Production Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_APP_URL=https://my.24therapy.ai
NEXT_PUBLIC_THERAPIST_APP_URL=https://app.24therapy.ai
NEXT_PUBLIC_SITE_URL=https://24therapy.ai
NEXT_PUBLIC_DAILY_DOMAIN=your-subdomain.daily.co
```

#### `apps/admin` — Production Environment Variables

```bash
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_APP_URL=https://admin.24therapy.ai
NEXT_PUBLIC_SITE_URL=https://24therapy.ai
```

### 4.4 Deploy

Each project auto-deploys when you push to `main`.  
For first deploy: Vercel Dashboard → project → **Deployments** → **Redeploy** (or push a commit).

---

## Step 5 — Custom Domains

### 5.1 DNS Records

Add these DNS records at your domain registrar (replace `xxx.vercel.app` / Railway URL with your assigned URLs):

| Subdomain | Type | Value |
|-----------|------|-------|
| `@` (apex) | CNAME | `cname.vercel-dns.com` |
| `www` | CNAME | `cname.vercel-dns.com` |
| `app` | CNAME | `cname.vercel-dns.com` |
| `my` | CNAME | `cname.vercel-dns.com` |
| `admin` | CNAME | `cname.vercel-dns.com` |
| `api` | CNAME | `your-service.up.railway.app` |

For the apex domain (`@`), some registrars require an `A` record. Use Vercel's nameservers or an `ANAME`/`ALIAS` record if supported.

### 5.2 Add Domains in Vercel

For each Vercel project → **Settings → Domains** → Add:

| Project | Domain |
|---------|--------|
| `24therapy-web` | `24therapy.ai`, `www.24therapy.ai` |
| `24therapy-therapist` | `app.24therapy.ai` |
| `24therapy-patient` | `my.24therapy.ai` |
| `24therapy-admin` | `admin.24therapy.ai` |

### 5.3 Add Domain in Railway

Railway project → **Settings → Domains** → Add custom domain: `api.24therapy.ai`

### 5.4 Update CORS

Once custom domains are live, update the Railway env var:

```bash
CORS_ORIGINS=https://24therapy.ai,https://www.24therapy.ai,https://app.24therapy.ai,https://my.24therapy.ai,https://admin.24therapy.ai
```

---

## Step 6 — External Services

### Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)
2. Get API keys: Dashboard → **Developers → API Keys**
3. Create a webhook endpoint: Dashboard → **Developers → Webhooks** → Add endpoint
   - URL: `https://api.24therapy.ai/api/v1/billing/webhook`
   - Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
4. Copy the webhook signing secret → `STRIPE_WEBHOOK_SECRET`
5. For therapist payouts: Enable **Stripe Connect** → **Settings → Connect**
6. Create subscription products in Stripe Dashboard matching your `subscription_plans` DB table

### Resend (Email)

1. Create account at [resend.com](https://resend.com)
2. Verify your domain (`24therapy.ai`) — add the DNS TXT/MX records they provide
3. Create an API key → set as `SMTP_PASSWORD` in Railway
4. Test with: `POST /api/v1/auth/forgot-password` (sends a real email)

### Daily.co (Video)

1. Create account at [dashboard.daily.co](https://dashboard.daily.co)
2. Create a room configuration with HIPAA settings enabled
3. Note your domain (e.g., `24therapy.daily.co`) → set as `NEXT_PUBLIC_DAILY_DOMAIN`
4. Get API key → set as `DAILY_API_KEY` in Railway

### OpenAI

1. Create API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Set usage limits to protect against runaway costs
3. Ensure you have access to: `gpt-4o`, `gpt-4o-mini`, `text-embedding-3-large`, `whisper-1`

---

## Environment Variable Reference

### Complete Backend Variable List

```bash
# ── App ──────────────────────────────────────────────────────────────────────
NODE_ENV=production                          # [REQUIRED]
PORT=4000                                    # [REQUIRED]

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://...                # [REQUIRED] Neon connection string
DATABASE_SSL=true                            # [REQUIRED] true in production

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=rediss://...                       # [REQUIRED] Upstash Redis URL
REDIS_TTL=3600                               # optional, default 3600s

# ── Auth ─────────────────────────────────────────────────────────────────────
JWT_SECRET=<64-char hex>                     # [REQUIRED] openssl rand -hex 64
JWT_ACCESS_EXPIRY=24h                        # optional, default 24h
JWT_REFRESH_EXPIRY=30d                       # optional, default 30d
BCRYPT_ROUNDS=12                             # optional, default 12
COOKIE_SECRET=<64-char hex>                  # [REQUIRED]

# ── OpenAI ───────────────────────────────────────────────────────────────────
OPENAI_API_KEY=sk-proj-...                   # [REQUIRED] for all AI features
OPENAI_DEFAULT_MODEL=gpt-4o                  # optional
OPENAI_EMBEDDING_MODEL=text-embedding-3-large # optional
OPENAI_WHISPER_MODEL=whisper-1               # optional
OPENAI_MAX_TOKENS=4096                       # optional

# ── Email ────────────────────────────────────────────────────────────────────
SMTP_HOST=smtp.resend.com                    # [REQUIRED] for auth emails
SMTP_PORT=465                                # [REQUIRED]
SMTP_USER=resend                             # [REQUIRED]
SMTP_PASSWORD=re_...                         # [REQUIRED] Resend API key
EMAIL_FROM=noreply@24therapy.ai              # [REQUIRED]
EMAIL_FROM_NAME=24Therapy                    # optional

# ── Stripe ───────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_...                # [REQUIRED] for billing
STRIPE_WEBHOOK_SECRET=whsec_...             # [REQUIRED] for webhook verification
STRIPE_CONNECT_CLIENT_ID=ca_...             # [REQUIRED] for therapist payouts

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGINS=https://24therapy.ai,...        # [REQUIRED] comma-separated

# ── Daily.co (Video) ─────────────────────────────────────────────────────────
DAILY_API_KEY=...                            # optional (disables video if missing)
DAILY_DOMAIN=24therapy.daily.co              # optional

# ── Storage ──────────────────────────────────────────────────────────────────
AWS_S3_BUCKET=24therapy-files                # optional (disables uploads if missing)
AWS_REGION=us-east-1                         # optional
AWS_ACCESS_KEY_ID=...                        # optional
AWS_SECRET_ACCESS_KEY=...                    # optional

# ── Monitoring ───────────────────────────────────────────────────────────────
SENTRY_DSN=https://...                       # optional
```

---

## Preview vs Production Environments

The `vercel.json` `env` block is used for **preview deployments** (every PR / branch deploy) and uses Vercel preview URLs:

```json
"env": {
  "NEXT_PUBLIC_API_URL": "https://api.24therapy.ai/api/v1",
  "NEXT_PUBLIC_SITE_URL": "https://24-web.vercel.app",
  "NEXT_PUBLIC_THERAPIST_APP_URL": "https://24-therapist.vercel.app",
  "NEXT_PUBLIC_PATIENT_APP_URL": "https://24-patient.vercel.app",
  "NEXT_PUBLIC_ADMIN_APP_URL": "https://24-admin.vercel.app"
}
```

**Production** environment variables are set separately in the Vercel Dashboard under **Settings → Environment Variables** → select **Production** scope. These override the `vercel.json` values for production deployments.

---

## Post-Deploy Checklist

Run through this checklist after completing all deployment steps:

### Infrastructure Health

- [ ] `GET https://api.24therapy.ai/health` → `{"status":"ok","database":"connected","redis":"connected"}`
- [ ] Neon dashboard shows active connections
- [ ] Upstash Redis shows connection count > 0

### Marketing Site (apps/web)

- [ ] `https://24therapy.ai` loads the homepage
- [ ] Hero AI chat widget sends a message → receives a response
- [ ] `/chat` page works (full anonymous AI chat)
- [ ] `/pricing` page loads plans from DB (not hardcoded)
- [ ] `/signup` page loads (tests the Suspense boundary fix)

### Auth Flows

- [ ] Patient can register → receives welcome email
- [ ] Patient can log in → lands on patient dashboard
- [ ] Patient forgot-password → receives reset email → resets password
- [ ] Therapist can log in at `app.24therapy.ai`
- [ ] Admin can log in at `admin.24therapy.ai`
- [ ] Admin forgot-password → reset email → resets password

### AI Features

- [ ] `POST /api/v1/ai/chat/anonymous` returns a response without auth header
- [ ] Rate limiting: 11th request within 1 minute returns 429
- [ ] Crisis keyword test: send "I want to kill myself" → returns 988 message (no model call)

### Billing

- [ ] Stripe webhook endpoint is reachable and verified
- [ ] `GET /api/v1/billing/plans` returns plans from DB
- [ ] Subscription creation/update triggers webhook

### Security Headers

- [ ] `curl -I https://24therapy.ai` shows `X-Content-Type-Options: nosniff`
- [ ] `curl -I https://admin.24therapy.ai` shows `X-Frame-Options: DENY`

---

## Rollback Procedure

### Vercel Rollback

Vercel keeps all previous deployments. To roll back:

1. Vercel Dashboard → select project → **Deployments**
2. Find last good deployment → click **⋯** → **Promote to Production**

Or via CLI:
```bash
vercel rollback --scope your-team
```

### Railway Rollback

1. Railway Dashboard → service → **Deployments**
2. Find last good deployment → click **Redeploy**

### Database Rollback

Neon supports point-in-time restore (PITR) on paid plans:

1. Neon Dashboard → **Branches** → **Restore**
2. Select timestamp before the migration you want to undo
3. ⚠️ This creates a new branch — test before switching primary

---

## Monitoring & Alerts

### Health Check Endpoints

| Endpoint | Check |
|----------|-------|
| `GET https://api.24therapy.ai/health` | Database + Redis connectivity |
| `GET https://24therapy.ai` | Marketing site up |
| `GET https://app.24therapy.ai` | Therapist portal up |

### Recommended Monitoring Stack

| Tool | Purpose | Notes |
|------|---------|-------|
| **Sentry** | Error tracking (all 5 services) | Set `SENTRY_DSN` in Railway and each Vercel project |
| **Railway Metrics** | CPU, memory, request rate | Built into Railway dashboard |
| **Vercel Analytics** | Web vitals, page performance | Enable in Vercel project settings |
| **Upstash Console** | Redis hit rate, memory | Built into Upstash dashboard |
| **Neon Monitoring** | Query performance, connections | Available in Neon dashboard |
| **Stripe Dashboard** | Payment failures, disputes | Set up email alerts in Stripe |

### Log Access

```bash
# Railway (backend) logs — via Railway CLI
railway logs --service backend --tail

# Vercel (frontend) logs — via Vercel CLI  
vercel logs https://24therapy.ai --follow

# Or view in dashboards directly
```

---

*Last updated: 2026-06-07*
