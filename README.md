# 24Therapy Mental Health OS

> **Enterprise-grade mental health platform** — AI-powered therapy sessions, clinical workflow automation, crisis detection, and multi-tenant practice management.

[![Build](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/omarahmedomarahmed/habiba)
[![Node](https://img.shields.io/badge/node-20.x-green)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-9.15.4-orange)](https://pnpm.io)
[![License](https://img.shields.io/badge/license-proprietary-red)](LICENSE)

---

## Platform Overview

24Therapy is a full-stack, HIPAA-compliant mental health operating system connecting therapists, patients, and practice administrators. It integrates AI clinical tools (scribe, copilot, risk radar), real-time session infrastructure, Stripe billing, and an extensible workflow engine — all within a multi-tenant monorepo.

### Applications

| App | Domain | Port | Purpose |
|-----|--------|------|---------|
| `apps/web` | 24therapy.ai | 3000 | Public marketing & therapist directory |
| `apps/therapist` | app.24therapy.ai | 3001 | Therapist clinical dashboard |
| `apps/patient` | my.24therapy.ai | 3002 | Patient self-service portal |
| `apps/admin` | admin.24therapy.ai | 3003 | Super-admin platform management |
| `backend` | api.24therapy.ai | 4000 | NestJS REST API |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS 3, Framer Motion |
| **Backend** | NestJS 10, TypeScript, Drizzle ORM (raw pg queries) |
| **Database** | PostgreSQL 16 + pgvector extension |
| **Cache** | Redis |
| **Auth** | JWT (15min access / 30d refresh), Passport.js, bcrypt |
| **AI** | OpenAI GPT-4o (notes/copilot), Whisper (transcription), text-embedding-3-large |
| **Payments** | Stripe (subscriptions, invoices, webhooks) |
| **Video** | Daily.co (HIPAA-compliant WebRTC) |
| **Email** | Resend |
| **Storage** | AWS S3 + CloudFront |
| **Real-time** | Socket.io WebSocket gateway |
| **Monorepo** | Turborepo + pnpm 9 workspaces |
| **Deployment** | Vercel (frontends) + Railway (backend) |

---

## Repository Structure

```
24therapy/
├── apps/
│   ├── web/           # Marketing site — Next.js 15
│   ├── therapist/     # Therapist portal — Next.js 15
│   ├── patient/       # Patient portal — Next.js 15
│   └── admin/         # Admin portal — Next.js 15
├── backend/
│   └── src/
│       ├── app.module.ts
│       ├── main.ts
│       ├── config/         # Environment config loader
│       ├── database/       # PostgreSQL pool + DatabaseService
│       ├── gateways/       # Socket.io WebSocket gateway
│       └── modules/        # 20 feature modules (see below)
├── packages/
│   ├── types/             # @24therapy/types — shared TypeScript types
│   └── config/            # @24therapy/config — shared URL constants
├── migrations/            # 21 ordered SQL migration files
├── infra/
│   └── ci/                # CI/CD pipeline config
├── turbo.json
├── pnpm-lock.yaml         # MUST stay committed (Vercel reads this)
├── .npmrc                 # Hoisting config for Vercel compatibility
└── docker-compose.yml     # Full local stack (postgres, redis, all services)
```

---

## Backend Modules

| Module | Endpoints | Description |
|--------|-----------|-------------|
| `auth` | POST /auth/register, /login, /refresh, /logout, GET /me | JWT auth, token rotation |
| `users` | CRUD /users | User profiles and role management |
| `organizations` | GET/PATCH /organizations/me | Multi-tenant org management |
| `therapists` | GET/PATCH /therapists/me, stats, availability | Therapist profiles |
| `patients` | CRUD /patients, mood, timeline | Patient management |
| `sessions` | CRUD /sessions, transcript, notes | Session lifecycle |
| `ai` | POST /ai/sessions/:id/notes, summary, copilot | GPT-4o clinical AI |
| `radar` | POST /radar/requests, accept/decline | Instant therapist matching |
| `billing` | GET /billing/plans, admin CRUD | Stripe subscription management |
| `assessments` | CRUD /assessments | PHQ-9, GAD-7, PCL-5, custom |
| `memory` | GET/POST /memory/patient/:id | Patient knowledge graph |
| `workflows` | CRUD /workflows, tasks | Clinical workflow automation |
| `notifications` | CRUD /notifications, preferences | Multi-channel alerts |
| `analytics` | POST /analytics/events, dashboards | Platform & org analytics |
| `marketplace` | GET /marketplace/search | Public therapist directory |
| `admin` | GET /admin/dashboard, orgs, users | Super-admin operations |
| `mail` | Internal service | Resend email delivery |
| `notes` | CRUD /notes | Clinical session notes (SOAP/DAP/BIRP) |
| `treatment-plans` | CRUD /treatment-plans | Patient treatment plans + goals |
| `referrals` | CRUD /referrals | Patient referral lifecycle |

---

## Quick Start (Local Development)

### Prerequisites

- Node.js 20.x
- pnpm 9.15.4 (`npm install -g pnpm@9.15.4`)
- Docker & Docker Compose
- PostgreSQL client (optional, for migrations)

### 1. Clone & Install

```bash
git clone https://github.com/omarahmedomarahmed/habiba.git
cd habiba
pnpm install
```

### 2. Start Infrastructure

```bash
docker-compose up -d postgres redis
```

### 3. Run Migrations

```bash
# Using psql directly
psql $DATABASE_URL -f migrations/001_core_schema.sql
psql $DATABASE_URL -f migrations/002_therapists_schema.sql
# ... continue through 015_pricing_management.sql in order
```

### 4. Configure Environment

```bash
cp backend/.env.example backend/.env.local
# Fill in: DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, STRIPE_SECRET_KEY, RESEND_API_KEY
```

### 5. Start Development

```bash
pnpm dev          # All apps + backend concurrently via Turbo
# OR per app:
pnpm --filter=@24therapy/api dev         # Backend on :4000
pnpm --filter=@24therapy/web dev         # Web on :3000
pnpm --filter=@24therapy/therapist dev   # Therapist on :3001
pnpm --filter=@24therapy/patient dev     # Patient on :3002
pnpm --filter=@24therapy/admin dev       # Admin on :3003
```

---

## Environment Variables

See `SETUP_GUIDE.md` for the full breakdown. Minimum required for backend:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/24therapy
DATABASE_SSL=false
JWT_SECRET=<64-char random string>
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_test_...
RESEND_API_KEY=re_...
```

---

## Build

```bash
pnpm build                              # All packages
pnpm --filter=@24therapy/api build      # Backend only
pnpm --filter=@24therapy/web build      # Web only
```

All 5 packages build successfully (verified 2026-06-13).

---

## Brand Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Navy | `#0A2342` | Primary backgrounds, headings |
| Teal | `#2EC4B6` | Accent, CTA, active states |
| Blue | `#1F5EFF` | Links, interactive elements |
| Red/Orange | gradient | Admin portal accent only |

---

## Key Architectural Decisions

- **Multi-tenancy**: every resource scoped to `organization_id` — enforced at service layer
- **Raw SQL**: Drizzle ORM used for connection pooling; queries are parameterized raw SQL (`$1, $2`) — no ORM-generated queries
- **Global JWT guard**: all routes protected by default; use `@Public()` to opt out
- **Role hierarchy**: `super_admin > admin > manager > therapist > assistant > billing > support > patient`
- **Pricing source of truth**: PostgreSQL `subscription_plans` table, surfaced via `GET /billing/plans` — never hardcode prices in frontend
- **Font loading**: All apps use `next/font` with a self-hosted Inter woff2 from `packages/fonts/` — no external Google Fonts fetch required at build time

---

## Deployment

See `SETUP_GUIDE.md` for full Vercel + Railway deployment steps.

---

## Documentation

| File | Purpose |
|------|---------|
| `README.md` | This file — platform overview |
| `CLAUDE.md` | AI assistant session state — read first in every session |
| `SETUP_GUIDE.md` | Step-by-step deployment guide (Vercel + Railway) |
| `DEV_HANDOVER.md` | Engineering handover log — what's done, what's next |
| `AUDIT_REPORT.md` | Full-repo audit (session 17) — file inventory + blueprint |
| `COMPETITIVE_INTELLIGENCE.md` | Market research, competitor analysis, pitch deck |

<!-- Reviewed: 2026-06-13 — 24Therapy audit -->
