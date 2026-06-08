# 24Therapy.ai — AI-Native Mental Health Platform

> Full-stack monorepo: marketing website, therapist portal, patient portal, admin panel, and NestJS API — all AI-first.

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](#)
[![NestJS](https://img.shields.io/badge/NestJS-10-red)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](#)
[![pnpm](https://img.shields.io/badge/pnpm-9-orange)](#)

---

## Table of Contents

1. [Platform Overview](#platform-overview)
2. [Repository Structure](#repository-structure)
3. [Tech Stack](#tech-stack)
4. [Quick Start (Local Dev)](#quick-start-local-dev)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [Key Features](#key-features)
8. [API Overview](#api-overview)
9. [Deployment](#deployment)
10. [Compliance](#compliance)
11. [Crisis Support](#crisis-support)

---

## Platform Overview

24Therapy.ai is a multi-tenant mental health platform built around AI-first clinical workflows. It ships as a Turborepo monorepo with five independently deployable services:

| App | Package Name | Dev Port | Production Domain | Purpose |
|-----|-------------|----------|-------------------|---------|
| `apps/web` | `@24therapy/web` | 3000 | `24therapy.ai` | Marketing site, anonymous AI chat, pricing, therapist discovery |
| `apps/therapist` | `@24therapy/therapist` | 3001 | `app.24therapy.ai` | Therapist portal — AI scribe, copilot, patient management |
| `apps/patient` | `@24therapy/patient` | 3002 | `my.24therapy.ai` | Patient portal — session booking, AI companion, journal |
| `apps/admin` | `@24therapy/admin` | 3003 | `admin.24therapy.ai` | Super-admin — organizations, billing ops, platform config |
| `backend/` | N/A (NestJS) | 4000 | `api.24therapy.ai` | REST API + WebSockets — all business logic and AI |

---

## Repository Structure

```
/
├── apps/
│   ├── web/                  # Marketing website (Next.js 15)
│   │   ├── app/              # App Router pages
│   │   ├── components/       # Shared UI components
│   │   │   ├── layout/       # Navbar, Footer
│   │   │   └── sections/     # Hero, Pricing, CTA, Features…
│   │   ├── lib/
│   │   │   ├── domains.ts    # Centralized URL/email constants
│   │   │   └── pricing-api.ts
│   │   └── vercel.json
│   │
│   ├── therapist/            # Therapist portal (Next.js 15)
│   │   ├── app/
│   │   │   ├── (auth)/       # Login, forgot/reset password
│   │   │   └── (dashboard)/  # Sessions, notes, patients, AI tools
│   │   ├── lib/domains.ts
│   │   └── vercel.json
│   │
│   ├── patient/              # Patient portal (Next.js 15)
│   │   ├── app/
│   │   │   ├── (auth)/       # Login, forgot/reset password
│   │   │   └── (dashboard)/  # Appointments, journal, AI chat
│   │   ├── lib/domains.ts
│   │   └── vercel.json
│   │
│   └── admin/                # Admin panel (Next.js 15)
│       ├── app/
│       │   ├── (auth)/       # Login, forgot/reset password
│       │   └── (dashboard)/  # Organizations, users, billing, settings
│       ├── lib/domains.ts
│       └── vercel.json
│
├── backend/                  # NestJS API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── ai/           # AI scribe, copilot, memory, anonymous chat
│   │   │   ├── auth/         # JWT auth, refresh tokens, password reset
│   │   │   ├── billing/      # Stripe subscriptions, plans, payouts
│   │   │   ├── sessions/     # Telehealth sessions + transcription
│   │   │   ├── patients/     # Patient CRUD + PHI management
│   │   │   ├── therapists/   # Therapist profiles + availability
│   │   │   ├── organizations/# Multi-tenant org management
│   │   │   ├── assessments/  # PHQ-9, GAD-7, PCL-5 + 20 more
│   │   │   ├── marketplace/  # Public therapist discovery
│   │   │   ├── memory/       # Patient memory knowledge graph
│   │   │   ├── radar/        # Therapist-patient matching
│   │   │   ├── notifications/# Email + in-app notifications
│   │   │   ├── analytics/    # Practice metrics + outcomes
│   │   │   ├── audit/        # HIPAA audit trail
│   │   │   ├── mail/         # Email via SMTP/Resend
│   │   │   └── users/        # User management
│   │   ├── database/         # Drizzle ORM + connection pool
│   │   └── gateways/         # WebSocket event gateway
│   ├── .env.example
│   └── railway.json
│
├── packages/
│   └── types/                # Shared TypeScript types (cross-app)
│
├── migrations/               # PostgreSQL migrations (001–015)
│   ├── 001_core_schema.sql
│   ├── 002_therapists_schema.sql
│   ├── 003_patients_schema.sql
│   ├── 004_clinical_schema.sql
│   ├── 005_medications_schema.sql
│   ├── 006_sessions_schema.sql
│   ├── 007_ai_schema.sql
│   ├── 008_assessments_schema.sql
│   ├── 009_radar_schema.sql
│   ├── 010_billing_schema.sql
│   ├── 011_notifications_schema.sql
│   ├── 012_audit_compliance_schema.sql
│   ├── 013_marketplace_schema.sql
│   ├── 014_analytics_schema.sql
│   └── 015_pricing_management.sql
│
├── platform-docs/            # Architecture & operational docs
├── docker-compose.yml        # Local Postgres + Redis
├── pnpm-workspace.yaml
├── turbo.json
└── DEPLOYMENT.md
```

---

## Tech Stack

### Frontend (all 4 Next.js apps)
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| State | Zustand |
| Forms | React Hook Form + Zod |
| UI | shadcn/ui + Radix primitives |
| Video | Daily.co WebRTC |

### Backend (NestJS API)
| Layer | Technology |
|-------|-----------|
| Framework | NestJS 10 |
| Language | TypeScript 5 |
| Database | PostgreSQL 16 + pgvector (Neon) |
| ORM | Drizzle ORM |
| Cache / Queue | Redis (Upstash) |
| Auth | JWT (access + refresh tokens) |
| Validation | class-validator + class-transformer |
| Docs | Swagger / OpenAPI |
| WebSockets | Socket.io |

### Infrastructure & Services
| Service | Provider |
|---------|---------|
| Frontend hosting | Vercel |
| Backend hosting | Railway |
| Database | Neon (PostgreSQL + pgvector) |
| Redis | Upstash |
| AI models | OpenAI (GPT-4o, GPT-4o-mini, Whisper, text-embedding-3) |
| Payments | Stripe + Stripe Connect |
| Email | SMTP via Resend |
| Video | Daily.co |
| Storage | AWS S3 / Cloudflare R2 |
| Monitoring | Sentry |

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm@9`)
- Docker Desktop (for local Postgres + Redis)
- Git

### 1 — Clone & Install

```bash
git clone https://github.com/omarahmedomarahmed/habiba.git 24therapy
cd 24therapy
pnpm install
```

### 2 — Start Local Infrastructure

```bash
docker compose up -d
# Starts: PostgreSQL on :5432, Redis on :6379
```

### 3 — Configure Environment

```bash
# Copy example files
cp apps/web/.env.example       apps/web/.env.local
cp apps/therapist/.env.example apps/therapist/.env.local
cp apps/patient/.env.example   apps/patient/.env.local
cp apps/admin/.env.example     apps/admin/.env.local
cp backend/.env.example        backend/.env
```

The defaults in `.env.example` files work out-of-the-box for local development with Docker.
You only need to add an `OPENAI_API_KEY` in `backend/.env` to enable AI features.

### 4 — Run Database Migrations

```bash
# Run all 15 migrations in order
for f in migrations/*.sql; do
  echo "Running $f..."
  psql postgresql://postgres:postgres@localhost:5432/24therapy -f "$f"
done
```

### 5 — Start Development Servers

```bash
# All apps + backend in parallel (uses Turborepo)
pnpm dev

# Or start individually:
pnpm --filter @24therapy/web       dev   # → http://localhost:3000
pnpm --filter @24therapy/therapist dev   # → http://localhost:3001
pnpm --filter @24therapy/patient   dev   # → http://localhost:3002
pnpm --filter @24therapy/admin     dev   # → http://localhost:3003
cd backend && npm run start:dev          # → http://localhost:4000
```

### 6 — Verify

- Marketing site: http://localhost:3000
- API health: http://localhost:4000/health
- Swagger docs: http://localhost:4000/api/v1/docs

---

## Environment Variables

Each app has its own `.env.example` with only the variables that code actually reads.

### `apps/web/.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_THERAPIST_APP_URL=http://localhost:3001
NEXT_PUBLIC_PATIENT_APP_URL=http://localhost:3002
NEXT_PUBLIC_ADMIN_APP_URL=http://localhost:3003
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/24therapy/demo
```

### `apps/therapist/.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_PATIENT_APP_URL=http://localhost:3002
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_DAILY_DOMAIN=your-daily-domain.daily.co   # Optional for video
```

### `apps/patient/.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3002
NEXT_PUBLIC_THERAPIST_APP_URL=http://localhost:3001
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_DAILY_DOMAIN=your-daily-domain.daily.co   # Optional for video
```

### `apps/admin/.env.local`
```bash
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3003
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### `backend/.env` — Required keys

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | 64-char random secret |
| `OPENAI_API_KEY` | ✅ | OpenAI API key (AI features) |
| `STRIPE_SECRET_KEY` | ✅ prod | Stripe secret key (billing) |
| `SMTP_HOST/USER/PASSWORD` | ✅ prod | Email delivery |
| `DAILY_API_KEY` | Optional | Video sessions |
| `SENTRY_DSN` | Optional | Error monitoring |

Full list in `backend/.env.example`.

---

## Database Setup

Migrations live in `migrations/` and must be run in numeric order against a PostgreSQL 16+ database with the `pgvector` extension enabled.

```bash
# Enable pgvector (Neon does this automatically; for self-hosted Postgres):
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run all migrations
for f in migrations/*.sql; do
  psql $DATABASE_URL -f "$f"
done
```

### Migration Summary

| File | What it creates |
|------|----------------|
| `001_core_schema.sql` | Users, organizations, roles, permissions |
| `002_therapists_schema.sql` | Therapist profiles, credentials, availability |
| `003_patients_schema.sql` | Patient profiles, insurance, PHI |
| `004_clinical_schema.sql` | Diagnoses, treatment plans, goals |
| `005_medications_schema.sql` | Medication tracking, prescriptions |
| `006_sessions_schema.sql` | Therapy sessions, transcripts |
| `007_ai_schema.sql` | SOAP notes, session summaries, memory vectors |
| `008_assessments_schema.sql` | PHQ-9, GAD-7, PCL-5, + 20 validated tools |
| `009_radar_schema.sql` | Therapist-patient matching scores |
| `010_billing_schema.sql` | Subscriptions, invoices, Stripe data |
| `011_notifications_schema.sql` | In-app + email notification queue |
| `012_audit_compliance_schema.sql` | HIPAA audit log (7-year retention) |
| `013_marketplace_schema.sql` | Public therapist profiles, reviews |
| `014_analytics_schema.sql` | Practice metrics, revenue, outcomes |
| `015_pricing_management.sql` | Subscription plans (DB-driven pricing) |

---

## Key Features

### AI Clinical Tools
- **AI Scribe** — Real-time session transcription (Whisper) + auto-generated SOAP/DAP/BIRP notes (GPT-4o)
- **Clinical Copilot** — Live session guidance, suggested questions, risk flagging
- **Patient Memory Graph** — Longitudinal pgvector-powered knowledge graph across all sessions
- **Risk Detection** — Automated PHQ-9/GAD-7 trend analysis + in-session crisis keyword detection

### Anonymous Free Trial
- Homepage and `/chat` page offer a live AI chat widget — no account required
- 5-message free trial limit → upgrade prompt to book a real therapist
- Endpoint: `POST /api/v1/ai/chat/anonymous` (no JWT, rate-limited: 10 req/min, 30 req/hour per IP)
- Crisis keywords always intercepted — returns 988 hotline information

### Telehealth
- HIPAA-compliant video sessions via Daily.co WebRTC
- Session notes, transcript, and AI summary all linked to the session record
- Copilot suggestions shown to therapist in real time during session

### Practice Management
- Multi-tenant organizations with role-based access (super-admin / org-admin / therapist / patient)
- Therapist availability calendar + patient appointment booking
- Revenue dashboard, payout tracking, Stripe Connect

### Assessments
- 20+ validated clinical instruments (PHQ-9, GAD-7, PCL-5, MDQ, CAGE, AUDIT, etc.)
- Automated scoring, trend graphs, EHR-ready export

### Marketplace & Matching
- Public therapist directory with specialty, language, insurance filters
- **Radar** — AI-powered urgency-aware matching: analyzes patient intake → ranks compatible therapists

---

## API Overview

Base URL: `https://api.24therapy.ai/api/v1`  
Docs: `https://api.24therapy.ai/api/v1/docs` (Swagger)  
Health: `https://api.24therapy.ai/health`

All endpoints require `Authorization: Bearer <access_token>` except:

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /auth/login` | None | Get access + refresh tokens |
| `POST /auth/register` | None | Create account |
| `POST /auth/forgot-password` | None | Request password reset email |
| `POST /auth/reset-password` | None | Reset password with token |
| `POST /auth/refresh` | None | Refresh access token |
| `GET /billing/plans` | None | Fetch subscription plans (DB-driven) |
| `GET /marketplace/therapists` | None | Browse public therapist directory |
| `POST /ai/chat/anonymous` | None | Anonymous AI chat (free trial widget) |
| `GET /health` | None | Platform health check |

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full step-by-step deployment guide.

### Quick Reference

| Service | Platform | Command |
|---------|----------|---------|
| `apps/web` | Vercel | Auto-deploy from `main` |
| `apps/therapist` | Vercel | Auto-deploy from `main` |
| `apps/patient` | Vercel | Auto-deploy from `main` |
| `apps/admin` | Vercel | Auto-deploy from `main` |
| `backend` | Railway | `npm run build && npm run start:prod` |

Each app has a `vercel.json` with correct `buildCommand` and `installCommand` for pnpm monorepo, plus env var configuration for the preview environment.

---

## Compliance

| Standard | Status | Notes |
|----------|--------|-------|
| HIPAA | ✅ Design-ready | BAA available on Practice+ plans; pgvector PHI isolated |
| GDPR | ✅ Design-ready | EU data residency option; right-to-deletion implemented |
| SOC 2 Type II | 🔄 In progress | Audit trail implemented (migration 012) |
| End-to-end encryption | ✅ | All PHI encrypted at rest (Neon) and in transit (TLS 1.3) |
| Audit trail | ✅ | 7-year retention per `audit_logs` table |

---

## Monorepo Commands

```bash
# Install all dependencies
pnpm install

# Dev — all apps in parallel
pnpm dev

# Build — all apps
pnpm build

# Build — single app
pnpm turbo build --filter=@24therapy/web

# Type-check — all packages
pnpm typecheck

# Lint — all packages
pnpm lint

# Add a dependency to a specific app
pnpm --filter @24therapy/web add <package>

# Add a shared dependency to packages/types
pnpm --filter @24therapy/types add <package>
```

---

## Crisis Support

This platform is not for emergencies.  
If you or someone you know is in crisis:

**📞 Call or text 988** — Suicide & Crisis Lifeline (US, free, 24/7)  
**🌐 [988lifeline.org](https://988lifeline.org)**  
**🆘 Emergency: call 911**
