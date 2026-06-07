# 24Therapy.ai — Setup & Deployment Guide

## 1. Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **PostgreSQL** ≥ 15 (with pgvector extension)
- **Redis** ≥ 7
- Stripe, SendGrid, OpenAI, Daily.co accounts

---

## 2. Account Setup

### Required Services

| Service | Purpose | URL |
|---------|---------|-----|
| OpenAI | AI notes, copilot, embeddings | platform.openai.com |
| Anthropic | Claude model fallback | console.anthropic.com |
| Stripe | Billing + Stripe Connect | dashboard.stripe.com |
| Daily.co | HIPAA video rooms | dashboard.daily.co |
| SendGrid | Transactional email | app.sendgrid.com |
| AWS S3 / Cloudflare R2 | File & recording storage | aws.amazon.com |
| Sentry | Error tracking | sentry.io |

### Optional Services

| Service | Purpose |
|---------|---------|
| PostHog | Product analytics |
| Segment | Event tracking |
| PlanetScale / Neon / Supabase | Managed PostgreSQL |
| Upstash | Managed Redis |

---

## 3. Local Development

### Install Dependencies

```bash
git clone https://github.com/your-org/24therapy.git
cd 24therapy
pnpm install
```

### Database Setup

```bash
# Start PostgreSQL + Redis locally
docker-compose up -d

# Run all migrations in order
for f in migrations/*.sql; do psql $DATABASE_URL -f "$f"; done
```

### Environment Variables

Copy and fill each app's `.env.example`:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/therapist/.env.example apps/therapist/.env.local
cp apps/patient/.env.example apps/patient/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp backend/.env.example backend/.env
```

### Run Development Servers

```bash
pnpm dev   # Starts all apps via Turborepo
```

| App | Port |
|-----|------|
| Marketing (web) | 3000 |
| Therapist portal | 3001 |
| Patient portal | 3002 |
| Admin portal | 3003 |
| Backend API | 3004 |

---

## 4. Complete Environment Variables

### Backend (`backend/.env`)

```env
NODE_ENV=development
PORT=3004
APP_URL=http://localhost:3004
FRONTEND_THERAPIST_URL=http://localhost:3001
FRONTEND_PATIENT_URL=http://localhost:3002
FRONTEND_ADMIN_URL=http://localhost:3003
FRONTEND_WEB_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/24therapy
DATABASE_SSL=false

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<min-32-char-secret>
JWT_REFRESH_SECRET=<min-32-char-secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
BCRYPT_SALT_ROUNDS=12

# AI
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4o
OPENAI_FAST_MODEL=gpt-4o-mini
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_DEFAULT_MODEL=claude-3-5-sonnet-20241022

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_CLIENT_ID=ca_...

# Email
SENDGRID_API_KEY=SG....
EMAIL_FROM=noreply@24therapy.ai
EMAIL_SUPPORT=support@24therapy.ai

# Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=24therapy-recordings
AWS_CLOUDFRONT_URL=https://cdn.24therapy.ai

# Video
DAILY_API_KEY=...
DAILY_DOMAIN=your-domain.daily.co

# HIPAA / Security
HIPAA_MODE=true
AUDIT_LOG_RETENTION_DAYS=2555
DATA_ENCRYPTION_KEY=<32-char-key>

# CORS
CORS_ORIGINS=https://24therapy.ai,https://app.24therapy.ai,https://my.24therapy.ai,https://admin.24therapy.ai
```

### Marketing Site (`apps/web/.env.local`)

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai
NEXT_PUBLIC_SITE_URL=https://24therapy.ai
NEXT_PUBLIC_THERAPIST_APP_URL=https://app.24therapy.ai
NEXT_PUBLIC_PATIENT_APP_URL=https://my.24therapy.ai
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_POSTHOG_KEY=phc_...
```

### Therapist Portal (`apps/therapist/.env.local`)

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai
NEXT_PUBLIC_WS_URL=wss://api.24therapy.ai
NEXT_PUBLIC_DAILY_DOMAIN=your-domain.daily.co
NEXT_PUBLIC_AI_COPILOT_ENABLED=true
NEXT_PUBLIC_HIPAA_MODE=true
NEXT_PUBLIC_MFA_REQUIRED=true
```

### Patient Portal (`apps/patient/.env.local`)

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai
NEXT_PUBLIC_WS_URL=wss://api.24therapy.ai
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Admin Portal (`apps/admin/.env.local`)

```env
NEXT_PUBLIC_API_URL=https://api.24therapy.ai
```

---

## 5. Deployment Architecture

```
                    ┌──────────────────────────────┐
                    │   Cloudflare / Vercel Edge    │
                    └──────────────┬───────────────┘
                                   │
         ┌─────────────────────────┼──────────────────────┐
         │                         │                        │
   ┌─────▼─────┐           ┌───────▼──────┐        ┌──────▼──────┐
   │ apps/web  │           │apps/therapist│        │ apps/patient │
   │Vercel CDN │           │  Vercel CDN  │        │  Vercel CDN  │
   │24therapy.ai│          │app.24therapy.│        │my.24therapy.ai│
   └───────────┘           └──────────────┘        └─────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │    api.24therapy.ai           │
                    │  NestJS (Railway / Render)    │
                    └──────────────┬───────────────┘
                                   │
               ┌───────────────────┼──────────────────────┐
         ┌─────▼─────┐     ┌───────▼──────┐       ┌───────▼──────┐
         │PostgreSQL │     │    Redis      │       │  AWS S3 / R2  │
         │(Neon/Supa)│     │  (Upstash)   │       │  (Recordings) │
         └───────────┘     └──────────────┘       └──────────────┘
```

---

## 6. Deployment Order

Deploy in this order to avoid dependency failures:

1. **Database** — Provision PostgreSQL, run all migrations
2. **Redis** — Provision Redis instance
3. **Backend API** — Deploy NestJS to Railway/Render, set all env vars
4. **Admin Portal** — Deploy to Vercel, verify API connection
5. **Therapist Portal** — Deploy to Vercel
6. **Patient Portal** — Deploy to Vercel
7. **Marketing Site** — Deploy to Vercel (last — depends on API for pricing)

---

## 7. Vercel Deployment (Frontend Apps)

For each app:

1. Connect GitHub repo to Vercel
2. Set **Root Directory** to `apps/web` (or therapist/patient/admin)
3. Set **Framework** to Next.js
4. Add all environment variables
5. Deploy
6. Add custom domain in Vercel dashboard

**Build command:** `pnpm build` (Turborepo handles filtering)

**Output directory:** `.next`

---

## 8. Railway / Render Deployment (Backend)

### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link project
railway login
railway link

# Set environment variables
railway variables set DATABASE_URL=... JWT_SECRET=... # etc.

# Deploy
railway up
```

Add custom domain: `api.24therapy.ai` → Railway service

### Stripe Webhook

After deploying backend, configure Stripe webhook:
- Endpoint: `https://api.24therapy.ai/billing/webhook`
- Events: `customer.subscription.*`, `invoice.*`, `payment_intent.*`

---

## 9. DNS Configuration

```
24therapy.ai           → Vercel (apps/web)
www.24therapy.ai       → Redirect to 24therapy.ai
app.24therapy.ai       → Vercel (apps/therapist)
my.24therapy.ai        → Vercel (apps/patient)
admin.24therapy.ai     → Vercel (apps/admin)
api.24therapy.ai       → Railway/Render (backend)
cdn.24therapy.ai       → Cloudflare R2 / AWS CloudFront
```

---

## 10. Health Checks

After deployment, verify:

```bash
curl https://api.24therapy.ai/health
curl https://api.24therapy.ai/health/db
curl https://api.24therapy.ai/health/redis
```

---

## 11. Contact

| Role | Email |
|------|-------|
| Engineering | engineering@24therapy.ai |
| Security / HIPAA | security@24therapy.ai |
| Compliance | compliance@24therapy.ai |
| Support | support@24therapy.ai |
