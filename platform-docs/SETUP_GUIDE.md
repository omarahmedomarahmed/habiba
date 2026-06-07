# 24Therapy.ai — Complete Production Deployment Guide

> **Last updated:** 2026-06-07  
> **Stack:** Next.js 15 (×4 apps) + NestJS 10 + PostgreSQL + Redis  
> **Monorepo:** pnpm workspaces + Turborepo

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Platform Map — What Lives Where](#2-platform-map)
3. [Prerequisites & Accounts to Create](#3-prerequisites)
4. [DNS & Subdomain Setup (Cloudflare)](#4-dns--subdomain-setup)
5. [PostgreSQL — Neon or Supabase](#5-postgresql)
6. [Redis — Upstash](#6-redis--upstash)
7. [Backend — Railway Deployment](#7-backend--railway)
8. [Frontend Apps — Vercel (4 Deployments)](#8-frontend--vercel)
9. [Email — Resend](#9-email--resend)
10. [Stripe — Payments](#10-stripe--payments)
11. [OpenAI — AI Services](#11-openai)
12. [Storage — Cloudflare R2 or AWS S3](#12-storage)
13. [Environment Variables Master Reference](#13-environment-variables)
14. [Database Migration](#14-database-migration)
15. [Post-Deploy Verification Checklist](#15-post-deploy-checklist)
16. [Monitoring & Alerts](#16-monitoring)

---

## 1. Architecture Overview

```
                         ┌──────────────────────────────────────────┐
                         │              24therapy.ai (DNS)           │
                         │         Managed by: Cloudflare           │
                         └──────────────────────────────────────────┘
                                           │
          ┌────────────────────────────────┼──────────────────────────────────┐
          │                                │                                  │
  ┌───────▼──────┐              ┌──────────▼──────┐              ┌────────────▼──────┐
  │  24therapy.ai│              │app.24therapy.ai  │              │ my.24therapy.ai   │
  │  Marketing   │              │Therapist Portal  │              │ Patient Portal    │
  │  @24therapy/ │              │@24therapy/       │              │ @24therapy/       │
  │  web         │              │therapist         │              │ patient           │
  │  Vercel #1   │              │Vercel #2         │              │ Vercel #3         │
  └──────────────┘              └──────────────────┘              └───────────────────┘
                                           │
  ┌──────────────┐              ┌──────────▼──────┐              ┌───────────────────┐
  │admin.24      │              │api.24therapy.ai  │              │ cdn.24therapy.ai  │
  │therapy.ai    │              │NestJS Backend    │              │ Cloudflare R2 /   │
  │Admin Portal  │              │Railway/Render    │              │ S3 (static assets)│
  │@24therapy/   │              │                  │              │                   │
  │admin         │              │   PostgreSQL      │              │                   │
  │Vercel #4     │              │   Redis          │              │                   │
  └──────────────┘              └──────────────────┘              └───────────────────┘
```

### Who uses which app?

| App | URL | Users | Platform |
|-----|-----|-------|----------|
| `@24therapy/web` | `24therapy.ai` | Public (marketing, anonymous AI, signup) | Vercel |
| `@24therapy/therapist` | `app.24therapy.ai` | Therapists, Org Admins | Vercel |
| `@24therapy/patient` | `my.24therapy.ai` | Patients | Vercel |
| `@24therapy/admin` | `admin.24therapy.ai` | Super Admins only | Vercel |
| `backend` | `api.24therapy.ai` | All apps (API) | Railway |

### Data by platform

| Platform | What data lives there |
|----------|----------------------|
| **Neon/Supabase** (PostgreSQL) | Users, sessions, clinical notes, billing, tokens, organizations |
| **Upstash** (Redis) | Rate limiting, session cache, Pub/Sub for real-time features |
| **Cloudflare R2 / S3** | Session recordings, uploaded documents, profile photos |
| **Railway** | NestJS process + env vars (no data at rest) |
| **Vercel** | Next.js builds + edge CDN (no PHI) |

---

## 2. Platform Map

### Multiple deployments from one GitHub repo

Yes — you will deploy **5 separate services** from the single monorepo at `github.com/omarahmedomarahmed/habiba`:

```
GitHub repo: omarahmedomarahmed/habiba
├── Vercel Project 1: "24therapy-web"      → root dir: apps/web
├── Vercel Project 2: "24therapy-therapist" → root dir: apps/therapist
├── Vercel Project 3: "24therapy-patient"   → root dir: apps/patient
├── Vercel Project 4: "24therapy-admin"     → root dir: apps/admin
└── Railway Service:  "24therapy-api"      → root dir: backend
```

Each Vercel project points to the **same repo** but a **different root directory** and has its own environment variables and custom domain.

---

## 3. Prerequisites

### Accounts to create (all have free tiers)

| Service | URL | Purpose | Free Tier |
|---------|-----|---------|-----------|
| **Vercel** | vercel.com | Frontend hosting (4 apps) | ✅ Hobby |
| **Railway** | railway.app | NestJS backend | $5 credit/mo |
| **Neon** | neon.tech | PostgreSQL | ✅ Free 0.5GB |
| **Upstash** | upstash.com | Redis | ✅ Free 10k req/day |
| **Resend** | resend.com | Transactional email | ✅ 3k emails/mo |
| **Cloudflare** | cloudflare.com | DNS + CDN + R2 storage | ✅ Free |
| **Stripe** | stripe.com | Payments | Test mode free |
| **OpenAI** | platform.openai.com | GPT-4o AI features | Pay-per-use |

---

## 4. DNS & Subdomain Setup

### Step 1 — Move domain to Cloudflare (if not already)

1. Go to **dash.cloudflare.com** → **Add a Site** → enter `24therapy.ai`
2. Select the **Free plan**
3. Cloudflare will scan your existing DNS records
4. Copy the **2 nameservers** Cloudflare gives you (e.g., `kai.ns.cloudflare.com`)
5. Go to your domain registrar (GoDaddy / Namecheap / Google Domains)
6. Replace nameservers with the Cloudflare ones
7. Wait 5–30 min for propagation

### Step 2 — Create DNS records for all subdomains

Go to **Cloudflare Dashboard → 24therapy.ai → DNS → Add Record**

Add these records:

| Type | Name | Value | Proxy | Purpose |
|------|------|-------|-------|---------|
| `CNAME` | `@` (or `24therapy.ai`) | `cname.vercel-dns.com` | ☁️ Proxied | Marketing site |
| `CNAME` | `app` | `cname.vercel-dns.com` | ☁️ Proxied | Therapist portal |
| `CNAME` | `my` | `cname.vercel-dns.com` | ☁️ Proxied | Patient portal |
| `CNAME` | `admin` | `cname.vercel-dns.com` | ☁️ Proxied | Admin portal |
| `CNAME` | `api` | `your-railway-app.railway.app` | ☁️ Proxied | Backend API |
| `CNAME` | `cdn` | `pub-xxxxxxxx.r2.dev` | ☁️ Proxied | File storage CDN |

> **Note:** Use `☁️ Proxied` (orange cloud) for ALL records — this enables DDoS protection, SSL, and hides your origin IPs.

### Step 3 — Force HTTPS in Cloudflare

1. **SSL/TLS** → **Overview** → Select **Full (strict)**
2. **SSL/TLS** → **Edge Certificates** → Enable **Always Use HTTPS**
3. **SSL/TLS** → **Edge Certificates** → Enable **HSTS** (max-age: 31536000, include subdomains: ✅)

---

## 5. PostgreSQL — Neon

### Why Neon?
- Serverless PostgreSQL with pgvector support (required for AI memory search)
- Autoscaling to zero (no idle cost)
- Free tier: 0.5GB storage, 191.9 compute hours/month

### Step-by-step

1. Go to **console.neon.tech** → **Create account** (GitHub login recommended)
2. Click **New Project**
   - Name: `24therapy-production`
   - Region: **US East (N. Virginia)** — closest to Railway's US region
   - PostgreSQL version: **16**
3. Click **Create Project**
4. You'll see your **Connection String** immediately:
   ```
   postgresql://username:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Copy the entire string — this is your `DATABASE_URL`

### Enable pgvector extension

In Neon's **SQL Editor** tab, run:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### Get your Neon credentials

From **Neon Dashboard → Connection Details**:
- `DATABASE_URL` → the full connection string above
- Keep it secret — never commit it

---

## 6. Redis — Upstash

### Why Upstash?
- Serverless Redis, pay-per-request
- Free tier: 10,000 requests/day, 256MB storage
- Built for edge/serverless deployments

### Step-by-step

1. Go to **console.upstash.com** → **Create account** (GitHub login)
2. Click **Create Database**
   - Name: `24therapy-redis`
   - Type: **Regional**
   - Region: **us-east-1** (match your Neon region)
   - Eviction: **noeviction** (for auth tokens) or **allkeys-lru** (for cache)
3. Click **Create**
4. From the database page, get:
   - `REDIS_URL` → shown as **REST URL** (format: `rediss://default:xxx@xxx.upstash.io:6379`)
   
> For NestJS with `ioredis`, use the **Redis URL** (not REST URL):
> Settings → **Redis Connect** → copy the `redis://...` URL

---

## 7. Backend — Railway

### Why Railway?
- NestJS runs as a persistent Node.js process (not serverless)
- Railway handles the process management, auto-deploys, and custom domains
- Free trial available; production ~$5–15/month for small workload

### Step-by-step

#### 7a. Create Railway project

1. Go to **railway.app** → **Login with GitHub**
2. Click **New Project** → **Deploy from GitHub repo**
3. Select `omarahmedomarahmed/habiba`
4. Click **Add service** → **GitHub Repo**

#### 7b. Configure the service

1. Click the new service → **Settings** tab
2. **Root Directory**: set to `backend`
3. **Build Command**: `pnpm install --frozen-lockfile && pnpm build`
4. **Start Command**: `node dist/main.js`
5. **Watch Paths**: `backend/**` (so only backend changes trigger redeploy)
6. **Health Check Path**: `/health`

#### 7c. Add environment variables

Click **Variables** tab → add each variable:

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...from Neon...
REDIS_URL=rediss://...from Upstash...
JWT_SECRET=<generate: openssl rand -base64 64>
JWT_REFRESH_SECRET=<generate: openssl rand -base64 64>
RESEND_API_KEY=re_...from Resend...
FROM_EMAIL=24Therapy <noreply@24therapy.ai>
APP_URL=https://24therapy.ai
PATIENT_APP_URL=https://my.24therapy.ai
THERAPIST_APP_URL=https://app.24therapy.ai
ADMIN_APP_URL=https://admin.24therapy.ai
CORS_ORIGINS=https://24therapy.ai,https://app.24therapy.ai,https://my.24therapy.ai,https://admin.24therapy.ai
OPENAI_API_KEY=sk-...from OpenAI...
STRIPE_SECRET_KEY=sk_live_...from Stripe...
STRIPE_WEBHOOK_SECRET=whsec_...from Stripe...
AWS_ACCESS_KEY_ID=...or Cloudflare R2...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET_NAME=24therapy-uploads
S3_REGION=us-east-1
PHI_ENCRYPTION_KEY=<generate: openssl rand -base64 32>
BCRYPT_ROUNDS=12
```

#### 7d. Add custom domain

1. Railway service → **Settings** → **Networking** → **Custom Domain**
2. Enter: `api.24therapy.ai`
3. Railway gives you a CNAME target — update your Cloudflare DNS record (already done in Step 4)
4. Wait for SSL to provision (2–5 min)

#### 7e. Get your Railway service URL

Before the custom domain is set, Railway gives you a URL like:
`https://24therapy-api-production.up.railway.app`

Use this as a fallback while DNS propagates.

---

## 8. Frontend — Vercel (4 Deployments)

You will create **4 separate Vercel projects**, all connected to the same GitHub repo but pointing to different `apps/` subdirectories.

### How to get Vercel API keys (if needed)

1. Go to **vercel.com** → **Settings** → **Tokens**
2. Click **Create Token** → name: `24therapy-deploy`
3. Copy the token (shown once)

### Deploy each app

#### 8a. Marketing Website (`24therapy.ai`)

1. **vercel.com** → **Add New Project** → **Import Git Repository**
2. Select `omarahmedomarahmed/habiba`
3. **Configure Project**:
   - **Project Name**: `24therapy-web`
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web` ← **critical**
   - **Build Command**: `cd ../.. && pnpm turbo build --filter=@24therapy/web`
   - **Output Directory**: `.next`
   - **Install Command**: `cd ../.. && pnpm install --frozen-lockfile`
4. **Environment Variables** (add before deploying):

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://24therapy.ai
NEXT_PUBLIC_THERAPIST_APP_URL=https://app.24therapy.ai
NEXT_PUBLIC_PATIENT_APP_URL=https://my.24therapy.ai
NEXT_PUBLIC_ADMIN_URL=https://admin.24therapy.ai
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/your-username/demo
```

5. Click **Deploy**
6. After deploy: **Settings** → **Domains** → Add `24therapy.ai` and `www.24therapy.ai`

#### 8b. Therapist Portal (`app.24therapy.ai`)

1. **New Project** → same repo → **Root Directory**: `apps/therapist`
2. **Project Name**: `24therapy-therapist`
3. Same build/install commands with `--filter=@24therapy/therapist`
4. **Environment Variables**:

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://app.24therapy.ai
NEXT_PUBLIC_WEB_URL=https://24therapy.ai
NEXT_PUBLIC_PATIENT_APP_URL=https://my.24therapy.ai
```

5. Deploy → Add domain: `app.24therapy.ai`

#### 8c. Patient Portal (`my.24therapy.ai`)

1. **New Project** → **Root Directory**: `apps/patient`
2. **Project Name**: `24therapy-patient`
3. Filter: `--filter=@24therapy/patient`
4. **Environment Variables**:

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://my.24therapy.ai
NEXT_PUBLIC_WEB_URL=https://24therapy.ai
```

5. Deploy → Add domain: `my.24therapy.ai`

#### 8d. Admin Portal (`admin.24therapy.ai`)

1. **New Project** → **Root Directory**: `apps/admin`
2. **Project Name**: `24therapy-admin`
3. Filter: `--filter=@24therapy/admin`
4. **Environment Variables**:

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://admin.24therapy.ai
NEXT_PUBLIC_WEB_URL=https://24therapy.ai
```

5. Deploy → Add domain: `admin.24therapy.ai`

### Vercel domain verification

For each custom domain, Vercel will ask you to add a **TXT record** for verification:
- Cloudflare DNS → **Add Record** → `TXT` → name: `_vercel` → value: `vc-domain-verify=...`
- Vercel auto-verifies within 2 min

---

## 9. Email — Resend

### Why Resend?
- Modern email API built for developers
- Free tier: 3,000 emails/month, 100/day
- Built-in email deliverability (SPF, DKIM, DMARC)
- Works with any sending domain

### Step-by-step

#### 9a. Create account & get API key

1. Go to **resend.com** → **Sign up** (GitHub recommended)
2. Dashboard → **API Keys** → **Create API Key**
   - Name: `24therapy-production`
   - Permission: **Full access** (or **Sending access** for security)
3. Copy the key: `re_xxxxxxxxxx`
4. This is your `RESEND_API_KEY`

#### 9b. Add your sending domain

1. Resend Dashboard → **Domains** → **Add Domain**
2. Enter: `24therapy.ai`
3. Resend gives you **3 DNS records** to add — go to Cloudflare:

| Type | Name | Value |
|------|------|-------|
| `MX` | `resend._domainkey` | (value from Resend) |
| `TXT` | `resend._domainkey` | `p=...` (DKIM key) |
| `TXT` | `@` | `v=spf1 include:amazonses.com ~all` |

4. Back in Resend → **Verify Domain** — should go green within 5 min
5. Set your **From address**: `noreply@24therapy.ai` or `24Therapy <noreply@24therapy.ai>`

#### 9c. Test

Use Resend's dashboard to send a test email or call:
```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_your_key' \
  -H 'Content-Type: application/json' \
  -d '{"from":"noreply@24therapy.ai","to":["test@example.com"],"subject":"Test","text":"Hello"}'
```

---

## 10. Stripe — Payments

### Step-by-step

#### 10a. Create account & get keys

1. Go to **dashboard.stripe.com** → **Sign up**
2. Complete account setup (business details required for live mode)
3. Dashboard → **Developers** → **API Keys**
4. Get two sets of keys:
   - **Test mode**: `pk_test_...` and `sk_test_...`
   - **Live mode**: `pk_live_...` and `sk_live_...`
5. Start with **test mode** until ready to accept real payments

#### 10b. Create products & prices

1. Stripe Dashboard → **Products** → **Add Product**
2. Create 3 products:

| Product | Price (monthly) | Price (annual) | Lookup key |
|---------|----------------|----------------|------------|
| Professional | $99/mo | $990/yr | `professional_monthly`, `professional_annual` |
| Practice | $299/mo | $2,990/yr | `practice_monthly`, `practice_annual` |
| Enterprise | Custom | Custom | Contact sales |

3. After creating, note each **Price ID** (format: `price_xxxxx`) — these go in the DB seed

#### 10c. Set up webhooks

1. Stripe Dashboard → **Developers** → **Webhooks** → **Add Endpoint**
2. Endpoint URL: `https://api.24therapy.ai/api/v1/billing/webhook`
3. Select events to listen:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Click **Add endpoint** → copy **Signing secret** (`whsec_...`)
5. This is your `STRIPE_WEBHOOK_SECRET`

#### 10d. Environment variables

```env
STRIPE_SECRET_KEY=sk_live_...        # or sk_test_... for testing
STRIPE_PUBLISHABLE_KEY=pk_live_...   # used in frontend if needed
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_PRO_MONTHLY=price_...
STRIPE_PRICE_ID_PRO_ANNUAL=price_...
STRIPE_PRICE_ID_PRACTICE_MONTHLY=price_...
STRIPE_PRICE_ID_PRACTICE_ANNUAL=price_...
```

---

## 11. OpenAI

### Step-by-step

#### 11a. Get API key

1. Go to **platform.openai.com** → **Sign up / Login**
2. **Settings** → **API Keys** → **Create new secret key**
   - Name: `24therapy-production`
3. Copy immediately — shown only once: `sk-proj-...`
4. This is your `OPENAI_API_KEY`

#### 11b. Set usage limits

1. **Settings** → **Billing** → **Usage limits**
2. Set a **monthly budget limit** (e.g., $200 to start)
3. Set a **soft limit** at $150 for email alert

#### 11c. Models used

| Task | Model | Estimated cost |
|------|-------|----------------|
| Clinical notes (SOAP/DAP/BIRP) | `gpt-4o` | ~$0.008/note |
| Copilot suggestions | `gpt-4o-mini` | ~$0.0002/req |
| Anonymous chat | `gpt-4o-mini` | ~$0.0001/msg |
| Embeddings (memory search) | `text-embedding-3-small` | ~$0.00002/1k tokens |
| Transcription | `whisper-1` | $0.006/minute |

---

## 12. Storage — Cloudflare R2

### Why R2?
- S3-compatible API (zero code change)
- **Free egress** (unlike AWS S3 which charges for downloads)
- Free tier: 10GB storage, 1M Class A operations/month

### Step-by-step

#### 12a. Create R2 bucket

1. Cloudflare Dashboard → **R2 Object Storage** → **Create Bucket**
2. Bucket name: `24therapy-uploads`
3. Location: **Automatic** (or `ENAM` for North America)
4. Click **Create Bucket**

#### 12b. Create API tokens

1. Cloudflare Dashboard → **R2** → **Manage R2 API Tokens** → **Create API Token**
2. Permissions: **Object Read & Write**
3. Specify bucket: `24therapy-uploads`
4. Click **Create API Token**
5. Copy:
   - **Access Key ID** → `AWS_ACCESS_KEY_ID`
   - **Secret Access Key** → `AWS_SECRET_ACCESS_KEY`
   - **Endpoint**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

#### 12c. Set up public CDN access

1. R2 Bucket → **Settings** → **Public Access** → **Enable** (for public files)
   - Or use **R2.dev** subdomain: `pub-xxx.r2.dev`
2. Add CNAME in Cloudflare DNS:
   - Type: `CNAME`, Name: `cdn`, Value: `pub-xxx.r2.dev`

#### 12d. CORS for R2 (needed for direct browser uploads)

1. R2 Bucket → **Settings** → **CORS** → **Add Rule**:
```json
[
  {
    "AllowedOrigins": ["https://24therapy.ai", "https://app.24therapy.ai"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

#### 12e. Environment variables

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_BUCKET_NAME=24therapy-uploads
S3_REGION=auto
CDN_URL=https://cdn.24therapy.ai
```

---

## 13. Environment Variables Master Reference

### Backend (Railway)

```env
# ─── Core ────────────────────────────────────────
NODE_ENV=production
PORT=4000

# ─── Database ────────────────────────────────────
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require

# ─── Redis ───────────────────────────────────────
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379

# ─── JWT Auth ────────────────────────────────────
# Generate with: openssl rand -base64 64
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# ─── CORS ────────────────────────────────────────
CORS_ORIGINS=https://24therapy.ai,https://app.24therapy.ai,https://my.24therapy.ai,https://admin.24therapy.ai

# ─── App URLs (used in emails) ───────────────────
APP_URL=https://24therapy.ai
PATIENT_APP_URL=https://my.24therapy.ai
THERAPIST_APP_URL=https://app.24therapy.ai
ADMIN_APP_URL=https://admin.24therapy.ai

# ─── Email (Resend) ──────────────────────────────
RESEND_API_KEY=re_xxx
FROM_EMAIL=24Therapy <noreply@24therapy.ai>

# ─── OpenAI ──────────────────────────────────────
OPENAI_API_KEY=sk-proj-xxx

# ─── Stripe ──────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_ID_PRO_MONTHLY=price_xxx
STRIPE_PRICE_ID_PRO_ANNUAL=price_xxx
STRIPE_PRICE_ID_PRACTICE_MONTHLY=price_xxx
STRIPE_PRICE_ID_PRACTICE_ANNUAL=price_xxx

# ─── File Storage (Cloudflare R2 / AWS S3) ───────
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_ENDPOINT_URL=https://xxx.r2.cloudflarestorage.com
S3_BUCKET_NAME=24therapy-uploads
S3_REGION=auto
CDN_URL=https://cdn.24therapy.ai

# ─── Security ────────────────────────────────────
# Generate with: openssl rand -base64 32
PHI_ENCRYPTION_KEY=
BCRYPT_ROUNDS=12

# ─── Optional: Twilio (SMS alerts) ──────────────
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_PHONE_NUMBER=
```

### Web app (Vercel — 24therapy.ai)

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://24therapy.ai
NEXT_PUBLIC_THERAPIST_APP_URL=https://app.24therapy.ai
NEXT_PUBLIC_PATIENT_APP_URL=https://my.24therapy.ai
NEXT_PUBLIC_ADMIN_URL=https://admin.24therapy.ai
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/your-username/demo
```

### Therapist app (Vercel — app.24therapy.ai)

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://app.24therapy.ai
NEXT_PUBLIC_WEB_URL=https://24therapy.ai
NEXT_PUBLIC_PATIENT_APP_URL=https://my.24therapy.ai
```

### Patient app (Vercel — my.24therapy.ai)

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://my.24therapy.ai
NEXT_PUBLIC_WEB_URL=https://24therapy.ai
```

### Admin app (Vercel — admin.24therapy.ai)

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai/api/v1
NEXT_PUBLIC_SITE_URL=https://admin.24therapy.ai
NEXT_PUBLIC_WEB_URL=https://24therapy.ai
```

---

## 14. Database Migration

Run migrations **after** Railway deploys the backend, **before** any traffic:

### Option A — Railway one-off command (recommended)

1. Railway Dashboard → your backend service → **Settings** → **Deploy** section
2. Use **Custom Start Command** temporarily: `node -e "require('./dist/scripts/migrate').migrate()" && node dist/main`
3. Or use Railway CLI:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Run migration in production environment
railway run node -e "require('./dist/scripts/migrate').migrate()"
```

### Option B — Direct DB migration from local machine

```bash
# Set your production DATABASE_URL locally (temporarily)
export DATABASE_URL="postgresql://...your neon connection string..."

# Run migrations from the repo root
cd /path/to/habiba
node scripts/migrate.js
```

### Migration order

The 15 SQL files in `/migrations/` run in sequence:
```
001_initial_schema.sql
002_organizations.sql
003_users_auth.sql
004_therapist_profiles.sql
005_patient_profiles.sql
006_sessions.sql
007_ai_system.sql
008_notifications.sql
009_marketplace.sql
010_billing_schema.sql
011_analytics.sql
012_admin_system.sql
013_workflows.sql
014_radar_system.sql
015_advanced_features.sql
```

---

## 15. Post-Deploy Checklist

Run these checks after all services are live:

### Backend API

```bash
# Health check
curl https://api.24therapy.ai/health
# Expected: {"status":"ok","service":"24therapy-api",...}

# Auth endpoint
curl -X POST https://api.24therapy.ai/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test1234!","first_name":"Test","last_name":"User","role":"therapist"}'

# Swagger docs (only in non-production — check locally)
# curl http://localhost:4000/api/docs
```

### Frontend apps

| Check | URL | Expected |
|-------|-----|----------|
| Marketing site loads | `https://24therapy.ai` | Homepage renders |
| Anonymous AI chat | `https://24therapy.ai/chat` | Chat interface loads |
| Pricing from API | `https://24therapy.ai/#pricing` | Plans render (not fallback) |
| Therapist login | `https://app.24therapy.ai/login` | Login form renders |
| Patient login | `https://my.24therapy.ai/login` | Login form renders |
| Admin login | `https://admin.24therapy.ai/login` | Login form renders |
| Therapist forgot PW | `https://app.24therapy.ai/forgot-password` | Form renders |
| Patient forgot PW | `https://my.24therapy.ai/forgot-password` | Form renders |

### Email delivery

1. Go to `https://24therapy.ai/signup` → create a test account
2. Check your inbox for the welcome email
3. Test forgot-password flow on `https://my.24therapy.ai/forgot-password`
4. Verify reset link in email works

### Database

```sql
-- Run in Neon SQL Editor
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
-- Should show 30+ tables
```

### SSL/HTTPS

```bash
# Check SSL for all domains
curl -I https://24therapy.ai | grep -i "strict-transport"
curl -I https://api.24therapy.ai/health | grep HTTP
```

---

## 16. Monitoring

### Recommended stack (all have free tiers)

| Tool | Purpose | Free tier |
|------|---------|-----------|
| **Railway Metrics** | CPU, memory, request count for backend | Built-in |
| **Vercel Analytics** | Page views, web vitals for all Next.js apps | 2,500 events/mo free |
| **Sentry** | Error tracking for all services | 5,000 errors/mo free |
| **Uptime Robot** | Uptime monitoring for all 5 endpoints | 50 monitors free |

### Uptime Robot setup (free)

1. **uptimerobot.com** → **Add New Monitor**
2. Add 5 monitors:
   - `https://24therapy.ai` (every 5 min)
   - `https://app.24therapy.ai/login` (every 5 min)
   - `https://my.24therapy.ai/login` (every 5 min)
   - `https://admin.24therapy.ai/login` (every 5 min)
   - `https://api.24therapy.ai/health` (every 5 min)
3. Alert email: your@email.com
4. Optional: Connect to Slack/Discord for real-time alerts

### Sentry (error tracking)

```bash
# Install in backend
cd backend && pnpm add @sentry/nestjs @sentry/profiling-node

# Install in each Next.js app
cd apps/web && pnpm add @sentry/nextjs
```

Add to each app's env:
```env
NEXT_PUBLIC_SENTRY_DSN=https://xxx@o123.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=xxx  # For source maps upload
```

---

## Quick Reference — All Keys Summary

| Key | Where to get it | Where it goes |
|-----|----------------|---------------|
| `DATABASE_URL` | Neon Console → Connection Details | Railway backend env |
| `REDIS_URL` | Upstash Console → Redis Connect | Railway backend env |
| `JWT_SECRET` | `openssl rand -base64 64` | Railway backend env |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 64` | Railway backend env |
| `PHI_ENCRYPTION_KEY` | `openssl rand -base64 32` | Railway backend env |
| `RESEND_API_KEY` | Resend Dashboard → API Keys | Railway backend env |
| `OPENAI_API_KEY` | OpenAI Dashboard → API Keys | Railway backend env |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API Keys | Railway backend env |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Signing secret | Railway backend env |
| `AWS_ACCESS_KEY_ID` | Cloudflare R2 → API Tokens | Railway backend env |
| `AWS_SECRET_ACCESS_KEY` | Cloudflare R2 → API Tokens | Railway backend env |
| `NEXT_PUBLIC_API_URL` | Set to `https://api.24therapy.ai/api/v1` | All 4 Vercel projects |
| `NEXT_PUBLIC_CALENDLY_URL` | Your Calendly account → Copy link | Vercel web project only |

---

## Deployment Order

**Always deploy in this order to avoid errors:**

```
1. Neon (create DB + run migrations)
      ↓
2. Upstash (create Redis instance)
      ↓
3. Resend (create account + verify domain)
      ↓
4. Stripe (create products + get webhook secret)
      ↓
5. OpenAI (get API key + set limits)
      ↓
6. Cloudflare R2 (create bucket + get keys)
      ↓
7. Railway (deploy backend with all env vars)
      ↓
8. Verify API health: GET https://api.24therapy.ai/health
      ↓
9. Vercel Web (24therapy.ai) — deploy + add domain
      ↓
10. Vercel Therapist (app.24therapy.ai) — deploy + add domain
      ↓
11. Vercel Patient (my.24therapy.ai) — deploy + add domain
      ↓
12. Vercel Admin (admin.24therapy.ai) — deploy + add domain
      ↓
13. Cloudflare DNS — add all CNAME records
      ↓
14. End-to-end test all flows
```

---

*For questions: deploy@24therapy.ai*  
*Crisis support: 988 Suicide & Crisis Lifeline*
