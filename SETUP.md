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
