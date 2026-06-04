# 24Therapy Mental Health OS — Setup & Deployment Guide

## Overview

24Therapy is a full-stack monorepo built with:
- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: NestJS + TypeScript + PostgreSQL + Redis
- **AI**: OpenAI GPT-4o + Anthropic Claude + Whisper
- **Infrastructure**: Vercel (frontends) + Railway/Render (backend) + Supabase/Neon (database)

---

## Repository Structure

```
24therapy/
├── apps/
│   ├── web/          # Marketing website (24therapy.com)
│   ├── therapist/    # Therapist portal (app.24therapy.com)
│   ├── patient/      # Patient portal (my.24therapy.com)
│   └── admin/        # Admin portal (admin.24therapy.com)
├── backend/          # NestJS API (api.24therapy.com)
├── packages/
│   └── types/        # Shared TypeScript types
├── migrations/       # Database migration files
└── .github/          # CI/CD workflows
```

---

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Redis 7+
- Git

---

## Quick Start (Development)

### 1. Clone the repository

```bash
git clone https://github.com/your-org/24therapy.git
cd 24therapy
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your values

# Therapist Portal
cp apps/therapist/.env.example apps/therapist/.env.local

# Patient Portal
cp apps/patient/.env.example apps/patient/.env.local

# Admin Portal
cp apps/admin/.env.example apps/admin/.env.local

# Web
cp apps/web/.env.example apps/web/.env.local
```

### 4. Set up database

```bash
# Start PostgreSQL locally
# Create database
psql -U postgres -c "CREATE DATABASE 24therapy;"

# Run migrations (in order)
psql -U postgres -d 24therapy -f 001_core_schema.sql
psql -U postgres -d 24therapy -f 002_therapists_schema.sql
psql -U postgres -d 24therapy -f 003_patients_schema.sql
psql -U postgres -d 24therapy -f 004_clinical_schema.sql
psql -U postgres -d 24therapy -f 005_medications_schema.sql
psql -U postgres -d 24therapy -f 006_sessions_schema.sql
psql -U postgres -d 24therapy -f 007_ai_schema.sql
psql -U postgres -d 24therapy -f 008_assessments_schema.sql
psql -U postgres -d 24therapy -f 009_radar_schema.sql
psql -U postgres -d 24therapy -f 010_billing_schema.sql
psql -U postgres -d 24therapy -f 011_notifications_schema.sql
psql -U postgres -d 24therapy -f 012_audit_compliance_schema.sql
psql -U postgres -d 24therapy -f 013_marketplace_schema.sql
psql -U postgres -d 24therapy -f 014_analytics_schema.sql
```

### 5. Enable pgvector extension (for AI Memory)

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### 6. Start development servers

```bash
# Option A: Start all at once
pnpm dev

# Option B: Start individually
pnpm --filter @24therapy/backend dev       # Port 3001
pnpm --filter @24therapy/therapist dev     # Port 3000
pnpm --filter @24therapy/patient dev       # Port 3002
pnpm --filter @24therapy/admin dev         # Port 3003
pnpm --filter @24therapy/web dev           # Port 3004
```

### 7. Demo Access

| App | URL | Demo Login |
|-----|-----|-----------|
| Therapist Portal | http://localhost:3000 | therapist@demo.com / demo |
| Patient Portal | http://localhost:3002 | patient@demo.com / demo |
| Admin Portal | http://localhost:3003 | admin@24therapy.com / admin |
| Web | http://localhost:3004 | N/A |
| Backend API | http://localhost:3001 | N/A |

---

## Production Deployment

### Frontend Apps — Vercel

Each frontend app deploys independently to Vercel.

#### Therapist Portal

1. Import `apps/therapist` to Vercel
2. Set framework: Next.js
3. Set root directory: `apps/therapist`
4. Add environment variables:
   - `NEXT_PUBLIC_API_URL` = `https://api.24therapy.com`
   - `NEXT_PUBLIC_APP_ENV` = `production`
   - `NEXT_PUBLIC_DAILY_API_KEY` = your Daily.co key
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = your Stripe key

#### Patient Portal

1. Import `apps/patient` to Vercel
2. Same setup as Therapist Portal

#### Admin Portal

1. Import `apps/admin` to Vercel
2. Add `X-Robots-Tag: noindex` header (included in vercel.json)
3. Restrict access by IP if needed

#### Marketing Website

1. Import `apps/web` to Vercel
2. Configure custom domain `24therapy.com`

---

### Backend — Railway / Render

#### Option A: Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway new
railway up
```

#### Option B: Render

1. Create a new Web Service
2. Connect GitHub repo
3. Set start command: `pnpm --filter @24therapy/backend start:prod`
4. Set build command: `pnpm install && pnpm --filter @24therapy/backend build`
5. Add all environment variables from `backend/.env.example`

#### Option C: AWS ECS / Fly.io

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @24therapy/backend build
EXPOSE 3001
CMD ["pnpm", "--filter", "@24therapy/backend", "start:prod"]
```

---

### Database — Supabase / Neon

#### Supabase (Recommended)

1. Create a new Supabase project
2. Go to Settings → Database → Connection string
3. Run all SQL migration files via Supabase SQL editor
4. Enable pgvector: `CREATE EXTENSION vector;`
5. Set `DATABASE_URL` in backend .env

#### Neon (Alternative)

1. Create a new Neon project
2. Enable pgvector extension
3. Run migrations via Neon console
4. Set `DATABASE_URL` in backend .env

---

### Redis — Upstash / Redis Cloud

#### Upstash (Recommended for serverless)

1. Create an Upstash Redis database
2. Copy the `REDIS_URL` to backend .env

---

## Domain Configuration

| App | Domain | Vercel Project |
|-----|--------|---------------|
| Marketing | 24therapy.com | 24therapy-web |
| Therapist | app.24therapy.com | 24therapy-therapist |
| Patient | my.24therapy.com | 24therapy-patient |
| Admin | admin.24therapy.com | 24therapy-admin |
| API | api.24therapy.com | Railway/Render |

---

## Key Services Required

| Service | Purpose | Required |
|---------|---------|---------|
| OpenAI | AI notes, transcription, embeddings | Yes |
| Anthropic | Alternative AI model | Optional |
| Stripe | Billing and payments | Yes |
| SendGrid | Email delivery | Yes |
| Twilio | SMS notifications | Optional |
| Daily.co | Video sessions | Yes |
| AWS S3 / R2 | File and recording storage | Yes |
| Sentry | Error monitoring | Recommended |
| PostHog | Product analytics | Recommended |

---

## Security Checklist

- [ ] All .env values set (no defaults)
- [ ] JWT_SECRET is a cryptographically random 64+ char string
- [ ] DATABASE_URL uses SSL in production (`?sslmode=require`)
- [ ] CORS_ORIGINS limited to your actual domains
- [ ] Admin portal restricted by IP allowlist
- [ ] Stripe webhooks configured and verified
- [ ] HIPAA BAAs signed with cloud providers
- [ ] Encryption keys rotated from defaults
- [ ] MFA enabled for all admin accounts
- [ ] Audit logging verified working
- [ ] Rate limiting configured
- [ ] Redis password set

---

## AI System Architecture

```
Therapist/Patient Action
         ↓
   API Gateway (NestJS)
         ↓
  Permission Engine
  (Tenant Isolation)
         ↓
  AI Service Layer
    ├── Context Builder
    │   ├── Patient Memory Retrieval (pgvector RAG)
    │   ├── Session History Retrieval
    │   └── Permission-Scoped Context
    ├── Model Gateway
    │   ├── GPT-4o (notes, summaries)
    │   ├── Claude 3.5 (clinical reasoning)
    │   ├── Whisper (transcription)
    │   └── text-embedding-3-large (memory)
    └── Safety Layer
        ├── PHI Redaction
        ├── Crisis Detection
        └── Tenant Isolation Enforcement
```

---

## Database Extensions Required

```sql
-- Must be enabled BEFORE running migrations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- AI Memory
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- Full-text search
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- Encryption
```

---

## Monorepo Commands

```bash
# Install all dependencies
pnpm install

# Build all apps
pnpm build

# Start all in development
pnpm dev

# Run linting across all apps
pnpm lint

# Build specific app
pnpm --filter @24therapy/therapist build

# Add package to specific app
pnpm --filter @24therapy/therapist add lucide-react

# Add shared package
pnpm --filter @24therapy/types add -D typescript
```

---

## Support

- Technical: engineering@24therapy.com
- Compliance: compliance@24therapy.com
- Security: security@24therapy.com

---

## Docker Compose (Full Local Stack)

The `docker-compose.yml` at the repo root runs the full stack — all 5 services plus PostgreSQL and Redis.

### Start full stack

```bash
# 1. Copy all env files
cp backend/.env.example backend/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/therapist/.env.example apps/therapist/.env.local
cp apps/patient/.env.example apps/patient/.env.local
cp apps/admin/.env.example apps/admin/.env.local

# 2. Edit backend/.env with real API keys (OpenAI, Stripe, SendGrid)

# 3. Start everything
docker-compose up -d

# 4. Check status
docker-compose ps
docker-compose logs backend --tail=50
```

### Service URLs (Docker)

| Service | URL |
|---------|-----|
| Therapist Portal | http://localhost:3000 |
| Patient Portal | http://localhost:3002 |
| Admin Portal | http://localhost:3003 |
| Marketing Web | http://localhost:3004 |
| Backend API | http://localhost:3001 |
| API Swagger | http://localhost:3001/api/docs |

### Debug services

```bash
# Start with debug tools (Adminer, Mailhog, Redis Commander)
docker-compose --profile debug up -d

# Adminer (DB UI)     → http://localhost:8080
# Redis Commander     → http://localhost:8081
# Mailhog (email)     → http://localhost:8025
```

### Monitoring stack

```bash
# Start Prometheus + Grafana
docker-compose --profile monitoring up -d

# Prometheus → http://localhost:9090
# Grafana    → http://localhost:3500 (admin / admin)
```

---

## GitHub Actions CI/CD

The `.github/workflows/ci.yml` pipeline runs on every push and PR:

| Job | Trigger | What it does |
|-----|---------|-------------|
| `setup` | All pushes | Install + cache pnpm dependencies |
| `typecheck` | After setup | `tsc --noEmit` on all 5 workspaces |
| `lint` | After setup | ESLint on all workspaces |
| `build` | After typecheck+lint | `next build` for all 4 frontend apps (matrix) |
| `backend-build` | After setup | NestJS compile + unit tests with live Postgres+Redis |
| `security` | After setup | `pnpm audit` + Gitleaks secrets scan |
| `ci-success` | After all | Gate job — fails if any critical job failed |

### Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `GITLEAKS_LICENSE` | Your Gitleaks license key (for secrets scanning) |

No deployment secrets are needed unless you add a deployment job.

### Branch Protection Rules (Recommended)

In **Settings → Branches → main**:
- ✅ Require status checks: `typecheck`, `build`, `backend-build`
- ✅ Require branches to be up to date before merging
- ✅ Require pull request reviews: 1 approver
- ✅ Dismiss stale reviews on push

---

## Production Deployment — Step by Step

### Phase 1: Infrastructure

#### 1.1 — Database (Supabase)

```bash
# Create project at supabase.com
# In SQL Editor, run:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

# Run migrations in order:
# 001_core_schema.sql → 014_analytics_schema.sql
```

Copy the connection string (Pooler → Transaction mode for serverless, or Session mode for Railway):
```
DATABASE_URL=postgresql://user:pass@host:5432/postgres?sslmode=require
```

#### 1.2 — Redis (Upstash)

1. Create database at [upstash.com](https://upstash.com) — select region closest to backend
2. Enable TLS
3. Copy Redis URL: `rediss://default:password@hostname.upstash.io:6379`

#### 1.3 — Storage (AWS S3 or Cloudflare R2)

**AWS S3:**
```bash
# Create bucket
aws s3 mb s3://24therapy-recordings --region us-east-1
aws s3 mb s3://24therapy-attachments --region us-east-1

# Apply HIPAA-compliant bucket policy (no public access)
aws s3api put-public-access-block \
  --bucket 24therapy-recordings \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable server-side encryption
aws s3api put-bucket-encryption \
  --bucket 24therapy-recordings \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
```

**Cloudflare R2 (cheaper, no egress fees):**
```bash
# Create bucket in Cloudflare Dashboard
# Generate R2 API tokens
# Configure CORS for your frontend domains
```

---

### Phase 2: Backend Deployment

#### Option A: Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Create project (run from repo root)
railway new 24therapy-backend

# Link to backend directory
cd backend
railway link

# Set environment variables (or use Railway dashboard)
railway variables set \
  NODE_ENV=production \
  DATABASE_URL="postgresql://..." \
  REDIS_URL="rediss://..." \
  JWT_SECRET="$(openssl rand -hex 64)" \
  JWT_REFRESH_SECRET="$(openssl rand -hex 64)" \
  OPENAI_API_KEY="sk-..." \
  STRIPE_SECRET_KEY="sk_live_..."

# Deploy
railway up

# Set custom domain
railway domain 24therapy-backend.up.railway.app
# Add CNAME: api.24therapy.com → 24therapy-backend.up.railway.app
```

#### Option B: Render

1. Create a **Web Service** at [render.com](https://render.com)
2. Connect GitHub repo
3. **Build Command**: `pnpm install --frozen-lockfile && pnpm --filter @24therapy/backend build`
4. **Start Command**: `pnpm --filter @24therapy/backend start:prod`
5. Set **Root Directory**: (blank — runs from repo root)
6. Set **Plan**: Standard ($25/mo minimum for production)
7. Add all environment variables from `backend/.env.example`
8. Add custom domain: `api.24therapy.com`

#### Option C: AWS ECS (Enterprise)

```bash
# Build and push Docker image
docker build -t 24therapy-backend ./backend
docker tag 24therapy-backend:latest 123456789.dkr.ecr.us-east-1.amazonaws.com/24therapy-backend:latest
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/24therapy-backend:latest

# Deploy via ECS Fargate (see infra/ecs/ for task definitions)
aws ecs update-service \
  --cluster 24therapy-prod \
  --service backend \
  --force-new-deployment
```

---

### Phase 3: Frontend Deployment (Vercel)

Each app deploys independently as a separate Vercel project.

#### Step-by-step for each app:

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the GitHub repository
3. Set **Framework**: Next.js
4. Set **Root Directory**: `apps/web` (or `apps/therapist`, etc.)
5. Add **Environment Variables** from the corresponding `.env.example`
6. Click **Deploy**

#### Vercel project settings per app:

| App | Root Dir | Domain | Team Access |
|-----|----------|--------|-------------|
| Marketing | `apps/web` | `24therapy.com` | Public |
| Therapist | `apps/therapist` | `app.24therapy.com` | Team only |
| Patient | `apps/patient` | `my.24therapy.com` | Team only |
| Admin | `apps/admin` | `admin.24therapy.com` | IP restricted |

#### Monorepo Turbo caching on Vercel:

```json
// vercel.json (at repo root)
{
  "buildCommand": "pnpm turbo build --filter={YOUR_APP}...",
  "installCommand": "pnpm install --frozen-lockfile"
}
```

---

### Phase 4: Third-Party Service Setup

#### Stripe Configuration

```bash
# 1. Create products and prices in Stripe Dashboard
# Starter Monthly, Pro Monthly, Growth Monthly, Enterprise

# 2. Configure webhooks
# Endpoint: https://api.24therapy.com/billing/webhook
# Events: checkout.session.completed, customer.subscription.updated,
#         customer.subscription.deleted, invoice.payment_failed

# 3. Enable Stripe Connect (for marketplace/provider payouts)
# Dashboard → Connect → Settings → Enable

# 4. Test with Stripe CLI
stripe listen --forward-to localhost:3001/billing/webhook
```

#### Daily.co Video Setup

```bash
# 1. Create account at daily.co
# 2. Create a domain: your-practice.daily.co
# 3. Enable recording (for session audio → Whisper transcription)
# 4. Configure HIPAA settings (Dashboard → Security → HIPAA)
# 5. Set API key in backend .env: DAILY_API_KEY=...
```

#### SendGrid Email Setup

```bash
# 1. Create account at sendgrid.com
# 2. Verify sender identity (domain authentication)
# 3. Create API key with Mail Send permissions
# 4. Configure dynamic templates:
#    - session_reminder
#    - homework_assigned
#    - assessment_assigned
#    - weekly_progress_report
#    - crisis_alert
# 5. Add DKIM/SPF records to DNS
```

---

### Phase 5: HIPAA Compliance Checklist

Before going live with real patient data, complete:

**Organizational**
- [ ] Sign HIPAA Business Associate Agreements (BAAs) with:
  - [ ] AWS or Cloudflare (storage)
  - [ ] OpenAI (via ChatGPT Enterprise / API HIPAA BAA)
  - [ ] Twilio
  - [ ] SendGrid / Twilio SendGrid
  - [ ] Daily.co
  - [ ] Supabase (they have a HIPAA BAA)
  - [ ] Vercel Enterprise (for frontend hosting)
- [ ] Complete HIPAA Security Risk Assessment (SRA)
- [ ] Implement HIPAA Workforce Training for all staff
- [ ] Draft Breach Notification Procedures

**Technical**
- [ ] All data encrypted at rest (AES-256)
- [ ] All data encrypted in transit (TLS 1.3)
- [ ] PHI never stored in logs
- [ ] Minimum Necessary Access enforced (RBAC)
- [ ] Session timeout: 4 hours max (8 hours for clinical contexts)
- [ ] MFA required for all workforce members
- [ ] Audit logging active (6-year retention)
- [ ] Automatic session termination on inactivity
- [ ] IP allowlist for admin portal

**Verification**
- [ ] Run `GET /compliance/hipaa-check` against production API
- [ ] Verify audit logs are writing to persistent storage
- [ ] Test encryption by attempting to read DB directly (should be ciphertext)
- [ ] Verify no PHI appears in Sentry error reports
- [ ] Penetration test by qualified firm (annually)

---

## Production Environment Variables — Complete Reference

### Backend (Critical)

| Variable | Description | Required |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string with `?sslmode=require` | ✅ |
| `REDIS_URL` | Redis URL with TLS (`rediss://`) | ✅ |
| `JWT_SECRET` | 64+ char random string — **never reuse** | ✅ |
| `JWT_REFRESH_SECRET` | 64+ char random string — **different from JWT_SECRET** | ✅ |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o + Whisper | ✅ |
| `STRIPE_SECRET_KEY` | Stripe live secret key | ✅ |
| `STRIPE_WEBHOOK_SECRET` | From Stripe webhook dashboard | ✅ |
| `SENDGRID_API_KEY` | For transactional email | ✅ |
| `DATA_ENCRYPTION_KEY` | 32-char key for PHI field encryption | ✅ |
| `DAILY_API_KEY` | For video session room creation | ✅ |
| `AWS_S3_BUCKET` | For recordings and file uploads | ✅ |

### Generate Secure Secrets

```bash
# JWT secrets
openssl rand -hex 64

# Encryption key (must be exactly 32 chars)
openssl rand -hex 16

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Performance Tuning

### PostgreSQL

```sql
-- Indexes for common queries (run after migrations)
CREATE INDEX CONCURRENTLY idx_sessions_org_date
  ON sessions(organization_id, scheduled_at DESC);

CREATE INDEX CONCURRENTLY idx_memory_nodes_patient_type
  ON memory_nodes(patient_id, node_type, status);

CREATE INDEX CONCURRENTLY idx_audit_logs_org_created
  ON audit_logs(organization_id, created_at DESC);

-- pgvector index for fast similarity search
CREATE INDEX CONCURRENTLY idx_memory_embeddings_ivfflat
  ON memory_embeddings USING ivfflat(embedding vector_cosine_ops)
  WITH (lists = 100);
```

### Redis Configuration

```bash
# In production, set these in Redis config or via env:
maxmemory 2gb
maxmemory-policy allkeys-lru
appendonly yes
```

### Backend (NestJS) — Cluster Mode

```bash
# In production, run 2+ workers using PM2
pm2 start dist/main.js -i max --name "24therapy-backend"
pm2 save
pm2 startup
```

---

## Scaling Guide

### Traffic Tiers

| Monthly Sessions | Architecture |
|-----------------|-------------|
| < 1,000 | Single Railway/Render instance, Supabase free tier |
| 1,000–10,000 | 2x backend replicas, Supabase Pro, Upstash paid |
| 10,000–100,000 | AWS ECS (3+ tasks), RDS Aurora, ElastiCache |
| 100,000+ | Kubernetes, read replicas, CDN caching, Kafka for events |

### Key Bottlenecks

1. **AI API calls** — implement caching for repeated context building (Redis TTL: 5 min)
2. **pgvector similarity search** — tune IVFFLAT `probes` parameter, add connection pooling via PgBouncer
3. **Session transcription** — queue Whisper jobs via Redis + BullMQ, async processing
4. **Audit logging** — write-behind pattern; buffer to Redis, flush to DB in batches

---

## Troubleshooting

### Common Issues

#### Backend won't start

```bash
# Check database connection
psql $DATABASE_URL -c "SELECT 1"

# Check Redis
redis-cli -u $REDIS_URL ping

# Check if pgvector is installed
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector'"
```

#### JWT auth errors

```bash
# Ensure JWT_SECRET is the same across all backend instances
# Check that clock skew between services is < 5 minutes
# Verify tokens aren't being stored across environment resets
```

#### AI features not working

```bash
# Test OpenAI key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check AI cost budget hasn't been exceeded
# AI_MONTHLY_BUDGET_USD limit will block new requests when exceeded
```

#### Build fails on Vercel

```bash
# Common fix: set NEXT_PUBLIC_API_URL before build
# In Vercel dashboard → Settings → Environment Variables
# Add NEXT_PUBLIC_API_URL = https://api.24therapy.com
```

#### Docker containers not communicating

```bash
# All services must be on the same Docker network (therapy_net)
# Use service names not localhost: postgres, redis, backend
# Check: docker network inspect 24therapy_therapy_net
```

---

## Health Checks

```bash
# Backend health
curl https://api.24therapy.com/health

# Database connectivity
curl https://api.24therapy.com/health/db

# Redis connectivity
curl https://api.24therapy.com/health/redis

# AI service connectivity
curl https://api.24therapy.com/health/ai
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "ai": "healthy"
  },
  "uptime": 3600,
  "timestamp": "2025-01-15T14:00:00Z"
}
```

---

## Contacts & SLAs

| Team | Email | Response SLA |
|------|-------|-------------|
| Engineering | engineering@24therapy.com | 24h |
| Compliance / HIPAA | compliance@24therapy.com | 4h |
| Security Incidents | security@24therapy.com | 1h |
| Customer Support | support@24therapy.com | 8h |

---

## Vercel Monorepo Deployment — Complete Guide

> **For non-technical founders:** This section explains exactly how to deploy all 4 web apps to Vercel in ~30 minutes. You will create 4 separate Vercel projects — one per app. Each gets its own URL, environment variables, and deployment pipeline.

### Why 4 separate Vercel projects?

Each app serves a completely different audience:

| App | Who uses it | URL |
|-----|-------------|-----|
| `apps/web` | General public (marketing) | `24therapy.com` |
| `apps/therapist` | Licensed therapists only | `app.24therapy.com` |
| `apps/patient` | Patients only | `my.24therapy.com` |
| `apps/admin` | Internal team only | `admin.24therapy.com` |

Separate projects means separate deploys — a therapist portal release never touches the marketing site.

---

### Step-by-Step: Deploy Each App to Vercel

#### Before you start

1. Make sure the repo is on GitHub (it is — `github.com/omarahmedomarahmed/habiba`)
2. Create a free account at [vercel.com](https://vercel.com)
3. Install Vercel CLI (optional but useful): `npm install -g vercel`

---

#### Deploy `apps/web` (Marketing Website)

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"** → select `omarahmedomarahmed/habiba`
3. Under **"Configure Project"**:
   - **Project Name**: `24therapy-web`
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `apps/web`  ← **CRITICAL — must set this**
   - Leave Build & Output Settings as default (vercel.json handles it)
4. Under **"Environment Variables"**, add:
   ```
   NEXT_PUBLIC_API_URL = https://api.24therapy.com
   NEXT_PUBLIC_APP_ENV = production
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
   NEXT_PUBLIC_POSTHOG_KEY = phc_...
   ```
5. Click **Deploy**
6. After deploy, go to **Settings → Domains** → add `24therapy.com` and `www.24therapy.com`

---

#### Deploy `apps/therapist` (Therapist Portal)

1. Go to [vercel.com/new](https://vercel.com/new) again
2. Import same GitHub repo
3. **Root Directory**: `apps/therapist`
4. **Project Name**: `24therapy-therapist`
5. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL = https://api.24therapy.com
   NEXT_PUBLIC_APP_ENV = production
   NEXT_PUBLIC_DAILY_API_KEY = your_daily_key
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
   NEXT_PUBLIC_SENTRY_DSN = https://...@sentry.io/...
   ```
6. Deploy → add domain `app.24therapy.com`

---

#### Deploy `apps/patient` (Patient Portal)

1. Import same repo
2. **Root Directory**: `apps/patient`
3. **Project Name**: `24therapy-patient`
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL = https://api.24therapy.com
   NEXT_PUBLIC_APP_ENV = production
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_...
   NEXT_PUBLIC_DAILY_API_KEY = your_daily_key
   ```
5. Deploy → add domain `my.24therapy.com`

---

#### Deploy `apps/admin` (Admin Portal)

1. Import same repo
2. **Root Directory**: `apps/admin`
3. **Project Name**: `24therapy-admin`
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL = https://api.24therapy.com
   NEXT_PUBLIC_APP_ENV = production
   NEXT_PUBLIC_ADMIN_SECRET = your_admin_secret
   ```
5. Deploy → add domain `admin.24therapy.com`
6. **Security**: Go to Settings → Password Protection → Enable (or use Vercel Access policies to restrict by IP)

---

### How Vercel Knows How to Build Each App

Each `apps/*/vercel.json` tells Vercel exactly what to run:

```json
// apps/web/vercel.json
{
  "framework": "nextjs",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "buildCommand": "cd ../.. && pnpm --filter @24therapy/web build",
  "outputDirectory": ".next"
}
```

The `cd ../..` moves up to the monorepo root before running pnpm — this is required so pnpm can resolve all workspace packages correctly.

---

### Vercel + pnpm — How It Works

Vercel detects the correct pnpm version via two mechanisms (both now in place):

1. **`pnpm-lock.yaml`** at repo root — Vercel reads `lockfileVersion: '9.0'` and activates pnpm 9 via Corepack
2. **`packageManager: "pnpm@9.15.4"`** in root `package.json` — explicit version declaration

Without `pnpm-lock.yaml`, Vercel falls back to its bundled pnpm v6.35.1, which fails the `engines: { pnpm: ">=9.x" }` check.

---

### Domain Architecture

```
24therapy.com               → apps/web        (marketing, SEO-optimised)
  └── www.24therapy.com     → redirect to apex

app.24therapy.com           → apps/therapist  (HIPAA-scoped, therapist auth)
my.24therapy.com            → apps/patient    (HIPAA-scoped, patient auth)
admin.24therapy.com         → apps/admin      (internal, IP-restricted, noindex)

api.24therapy.com           → NestJS backend  (Railway / Render / AWS ECS)
docs.24therapy.com          → API docs        (optional, Swagger UI)
```

#### Future path-based approach (optional)

If you ever want everything under one domain (simpler SSL, single Vercel project):

```
24therapy.com/              → marketing
24therapy.com/app/*         → therapist portal (Next.js rewrites)
24therapy.com/my/*          → patient portal (Next.js rewrites)
```

This requires a reverse proxy (Vercel Edge Middleware or Nginx) to route by path prefix. The current subdomain approach is simpler and preferred for HIPAA separation.

#### DNS Records to create

In your DNS provider (Cloudflare recommended for proxy + DDoS protection):

```
A     @               → Vercel IP (from Vercel Dashboard → Domain settings)
CNAME www             → cname.vercel-dns.com
CNAME app             → cname.vercel-dns.com
CNAME my              → cname.vercel-dns.com
CNAME admin           → cname.vercel-dns.com
CNAME api             → your-railway-app.up.railway.app
```

---

### Automatic Deploy on Push

Once GitHub is connected to Vercel:
- Every push to `main` → triggers a production deploy of all 4 apps simultaneously
- Every push to a feature branch → creates a preview URL (e.g. `24therapy-web-git-feat-my-branch.vercel.app`)
- Preview URLs are posted as GitHub PR comments automatically

To disable auto-deploy for a specific app (e.g. admin — you may want manual deploys only):
- Vercel project → Settings → Git → Production Branch → disable automatic deployments

---

## Deployment Troubleshooting

### ERR_PNPM_UNSUPPORTED_ENGINE

**Symptom:** Vercel build fails with `ERR_PNPM_UNSUPPORTED_ENGINE` — pnpm@6.35.1 used instead of 9.x.

**Root cause:** `pnpm-lock.yaml` was missing. Vercel cannot activate the correct pnpm version via Corepack without it.

**Fix (already applied):**
1. `pnpm-lock.yaml` — now committed at repo root (`lockfileVersion: '9.0'`)
2. `.npmrc` — `shamefully-hoist=true`, `node-linker=hoisted`
3. `packageManager: "pnpm@9.15.4"` in root `package.json`

If this error recurs after adding new packages, regenerate the lockfile:
```bash
pnpm install --no-frozen-lockfile
git add pnpm-lock.yaml
git commit -m "chore: update pnpm-lock.yaml"
git push
```

---

### Build Error: react/no-unescaped-entities

**Symptom:** `Error: \`'\` can be escaped with \`&apos;\`` in JSX.

**Root cause:** Next.js ESLint config flags literal apostrophes/quotes in JSX.

**Fix (already applied):** `"react/no-unescaped-entities": "off"` in all 4 `eslint.config.mjs` files.

This is safe — the rule is a code style preference, not a functional issue.

---

### Build Error: Module has no exported member

**Symptom:** `Type error: Module '"lucide-react"' has no exported member 'XYZ'`

**Cause:** Icon name doesn't exist in the installed version of lucide-react.

**Fix:**
```bash
# Find the correct icon name
node -e "const lr = require('lucide-react'); console.log(Object.keys(lr).filter(k => k.toLowerCase().includes('search_term')))"

# Or browse: https://lucide.dev/icons/
```

---

### Build Error: Import declaration conflicts with local declaration

**Symptom:** `Import declaration conflicts with local declaration of 'ComponentName'`

**Cause:** Importing a name from lucide-react that's also defined as a local function/component in the same file.

**Fix:** Remove the icon from the lucide import statement. The local function takes precedence.

---

### Build Error: Next.js 15 async params

**Symptom:** `Type error: params.slug is not a string` or component renders wrong on dynamic routes.

**Cause:** Next.js 15 changed dynamic route `params` to be a `Promise`.

**Fix:**
```tsx
// Before (Next.js 14)
export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params;
}

// After (Next.js 15)
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
}

// Or for client components — use useParams() hook instead:
"use client";
import { useParams } from "next/navigation";
export default function Page() {
  const { slug } = useParams();
}
```

---

### Build Error: @tailwindcss/postcss not found

**Symptom:** `Cannot find module '@tailwindcss/postcss'`

**Cause:** `@tailwindcss/postcss` is a Tailwind v4 package. The repo uses Tailwind v3.

**Fix (already applied):** Use `tailwindcss: {}` + `autoprefixer: {}` in `postcss.config.mjs`:
```js
// postcss.config.mjs — correct for Tailwind v3
const config = {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
export default config;
```

---

### Vercel: Build succeeds locally but fails on Vercel

**Common causes and fixes:**

| Symptom | Fix |
|---------|-----|
| `Cannot find module '@/components/...'` | Check `paths` in `tsconfig.json` — `"@/*": ["./*"]` |
| `NEXT_PUBLIC_*` variables are undefined | Add them in Vercel project Settings → Environment Variables |
| `pnpm install` installs wrong versions | Commit and push `pnpm-lock.yaml` |
| TypeScript errors only on Vercel | Vercel runs `tsc --noEmit` — fix the TS errors locally first |
| Build times out | Add `TURBO_TOKEN` + `TURBO_TEAM` env vars to enable remote caching |

---

### Re-deploying after env variable changes

Changing environment variables in Vercel does **not** automatically re-deploy. You must trigger a new deploy:
- Vercel dashboard → Deployments → click **"Redeploy"** on the latest deployment
- Or push a new commit (even an empty one): `git commit --allow-empty -m "chore: trigger redeploy" && git push`

