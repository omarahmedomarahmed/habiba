# 24Therapy.ai — AI-Native Mental Health Operating System

> The complete platform for AI-powered therapy: clinical documentation, patient matching, telehealth, and practice management.

**Website:** [24therapy.ai](https://24therapy.ai) | **API:** [api.24therapy.ai](https://api.24therapy.ai)

---

## Platform Overview

24Therapy.ai is a full-stack mental health platform built around AI-first clinical workflows.

| App | Domain | Purpose |
|-----|--------|---------|
| `apps/web` | `24therapy.ai` | Marketing website & patient discovery |
| `apps/therapist` | `app.24therapy.ai` | Therapist portal (AI scribe, copilot, patients) |
| `apps/patient` | `my.24therapy.ai` | Patient portal (sessions, AI companion, journal) |
| `apps/admin` | `admin.24therapy.ai` | Super-admin operations panel |
| `backend` | `api.24therapy.ai` | NestJS REST API + WebSockets |

---

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, Zustand
- **Backend:** NestJS, PostgreSQL (pgvector), Redis, WebSockets
- **AI:** OpenAI GPT-4o, Anthropic Claude, Whisper (transcription)
- **Video:** Daily.co WebRTC (HIPAA-compliant)
- **Billing:** Stripe Connect
- **Email:** SendGrid
- **Storage:** AWS S3 / Cloudflare R2
- **Monorepo:** pnpm workspaces + Turborepo

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Run all apps in development
pnpm dev

# Individual apps
pnpm --filter web dev       # Marketing site  → localhost:3000
pnpm --filter therapist dev # Therapist portal → localhost:3001
pnpm --filter patient dev   # Patient portal   → localhost:3002
pnpm --filter admin dev     # Admin portal     → localhost:3003
cd backend && npm run start:dev  # API          → localhost:3004
```

See [platform-docs/SETUP_GUIDE.md](platform-docs/SETUP_GUIDE.md) for full environment setup.

---

## Key Features

- **AI Scribe** — Real-time session transcription + SOAP/DAP/BIRP note generation
- **Clinical Copilot** — Live session guidance, risk detection, suggested interventions
- **Patient Memory** — Longitudinal AI knowledge graph across all sessions
- **Radar Matching** — Instant therapist-patient matching with urgency scoring
- **HIPAA Telehealth** — End-to-end encrypted video sessions via Daily.co
- **Practice Analytics** — Revenue, outcomes, burnout indicators
- **Assessments** — PHQ-9, GAD-7, PCL-5, and 20+ validated clinical tools
- **Enterprise / White Label** — SSO, custom domain, EHR integrations

---

## Repository Structure

```
/
├── apps/
│   ├── web/          # Marketing & discovery (Next.js)
│   ├── therapist/    # Therapist portal (Next.js)
│   ├── patient/      # Patient portal (Next.js)
│   └── admin/        # Admin operations (Next.js)
├── backend/          # NestJS API (REST + WebSockets)
├── packages/
│   └── types/        # Shared TypeScript types
├── migrations/       # PostgreSQL schema migrations (001–015)
├── platform-docs/    # Architecture, setup, audit docs
├── docker-compose.yml
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Database Migrations

Run migrations in order against your PostgreSQL instance:

```bash
psql $DATABASE_URL -f migrations/001_core_schema.sql
psql $DATABASE_URL -f migrations/002_therapists_schema.sql
# ... through migrations/015_pricing_management.sql
```

---

## Deployment

| Service | Platform | Domain |
|---------|----------|--------|
| Marketing | Vercel | `24therapy.ai` |
| Therapist Portal | Vercel | `app.24therapy.ai` |
| Patient Portal | Vercel | `my.24therapy.ai` |
| Admin Portal | Vercel | `admin.24therapy.ai` |
| API | Railway / Render | `api.24therapy.ai` |

---

## Compliance

- ✅ HIPAA compliant (BAA available on Practice+ plans)
- ✅ GDPR compliant (EU data residency option)
- ✅ SOC 2 Type II (in progress)
- ✅ End-to-end encryption for all PHI
- ✅ Full audit trail with 7-year retention

---

## Documentation

See [platform-docs/](platform-docs/) for:
- `SETUP_GUIDE.md` — Full environment setup, deployment architecture
- `PRODUCTION_STATUS.md` — Current production readiness status
- `AUDIT_REPORT.md` — Prior audit reports
- Architecture and design docs

---

## Crisis Support

This platform is not for emergencies. If you or someone you know is in crisis:
**Call or text 988** (Suicide & Crisis Lifeline, US)
