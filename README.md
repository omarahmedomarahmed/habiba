# 24Therapy Mental Health OS


> AI-powered mental health practice management platform — HIPAA-compliant, full-stack, production-ready.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15.3.8 (App Router), React 19, Tailwind CSS |
| Backend | NestJS 10, TypeScript |
| Database | PostgreSQL 16 + pgvector (Neon serverless) |
| AI | OpenAI GPT-4o (SOAP notes, copilot), Whisper (transcription), text-embedding-3-small (memory) |
| Real-time | Socket.io (crisis alerts, transcription, messages) |
| Video | Daily.co (iframe embed) |
| Email | Resend |
| Payments | Stripe |
| Monorepo | Turborepo + pnpm 9.15.4 |
| Deployment | Railway (API) + Vercel (4 Next.js apps) |

## Apps

| App | Port | Description |
|-----|------|-------------|
| `apps/web` | 3000 | Marketing site |
| `apps/therapist` | 3001 | Therapist portal |
| `apps/patient` | 3002 | Patient portal |
| `apps/admin` | 3003 | Admin portal |
| `backend` | 4000 | NestJS REST API |

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9.15.4 (`npm install -g pnpm@9.15.4`)
- PostgreSQL 16 (or Neon connection string)

### Setup
```bash
# Install dependencies
pnpm install

# Copy environment files
cp backend/.env.example backend/.env
cp apps/therapist/.env.example apps/therapist/.env.local
# (repeat for web, patient, admin)

# Run database migrations
DATABASE_URL=<your-pg-url> node scripts/migrate.js

# Seed initial super-admin
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD=yourpassword DATABASE_URL=<url> node scripts/seed.js

# Start all services (development)
pnpm dev
```

### Build all apps
```bash
pnpm build
```

## Environment Variables

### Backend (required)
```
DATABASE_URL=          # PostgreSQL connection string (Neon recommended)
JWT_SECRET=            # Min 32 chars
COOKIE_SECRET=         # Min 32 chars
OPENAI_API_KEY=        # sk-...
CORS_ORIGINS=          # Comma-separated allowed origins
```

### Backend (optional)
```
RESEND_API_KEY=        # Email (Resend)
STRIPE_SECRET_KEY=     # Payments
STRIPE_WEBHOOK_SECRET= # Stripe webhook signature verification — required for production payments
DAILY_API_KEY=         # Video rooms (Daily.co)
MESSAGE_ENCRYPTION_KEY=# 32-byte hex key for AES-256-GCM message encryption
REDIS_URL=             # Optional — not required for core functionality
SENTRY_DSN=            # Error monitoring
```

### Frontend (apps/web)
```
NEXT_PUBLIC_API_URL=           # Backend API base URL (e.g. https://habiba-production.up.railway.app/api/v1)
NEXT_PUBLIC_THERAPIST_APP_URL= # Therapist portal URL (e.g. https://therapist.24therapy.ai)
```

### Frontend (apps/therapist, apps/patient, apps/admin)
```
NEXT_PUBLIC_API_URL=           # Backend API base URL
```

## Database

Migrations are in `migrations/` (numbered 001–034). Run them in order:

```bash
node scripts/migrate.js
```

All 16 consolidated migrations (001–016) plus numbered patches (029–034) must be applied in order.
Migration 034 drops NOT NULL on `ai_session_notes.patient_id` (offline session support), adds `radar_requests.matched_at/matched_therapist_id`, and creates the `crm_leads` table.

## Architecture

```
backend/src/
  modules/
    auth/         # JWT auth, refresh tokens, guards, @Public() decorator
    sessions/     # Session lifecycle, join tokens, transcription trigger
    ai/           # GPT-4o SOAP notes, Whisper transcription, AI copilot, crisis detection
    marketplace/  # Therapist search (queries therapists table directly)
    therapists/   # Therapist profiles, availability, verification
    patients/     # Patient CRUD, mood, assessments
    billing/      # Stripe, plans, session fees, wallet
    radar/        # Real-time therapist matching
    crisis/       # Life-safety pipeline (HIPAA-compliant, no PHI in events)
    admin/        # Platform-wide admin dashboard
    crm/          # CRM leads pipeline (admin sales)
    ...
  database/       # DatabaseService (query/queryOne/transaction helpers)
  gateways/       # Socket.io WebSocket gateways
  common/         # PHI audit interceptor, guards
  config/         # env validation (throws on missing required vars)
```

## Key Design Decisions

- **@Public() decorator**: All routes protected by global `JwtAuthGuard` (APP_GUARD). Routes like `/sessions/join/:token` and `/marketplace/search` use `@Public()` to bypass auth.
- **No marketplace_listings required**: Marketplace search queries `therapists` table directly (approved status). Therapists appear automatically upon admin approval.
- **Session types**: Valid values are `standard|radar|group|phone|in_person|intake|follow_up` (NOT `individual`).
- **Migration columns**: Sessions table has optional columns from migrations 029-031. Backend uses try-catch fallback to base schema for production DBs that may not have run these migrations.
- **therapist_patient_assignments**: Uses `ended_at` (not `deleted_at`), has no `is_primary` column.
- **Audio transcription**: MediaRecorder MIME type is detected at runtime (`audio/webm;codecs=opus` → `audio/webm` → `audio/ogg` → `audio/mp4`) so Android Chrome mp4 audio is transcribed correctly.
- **Crisis safety**: Patient WebSocket events are ONLY `crisis_support` — never `crisis_alert`, never risk level.

## CI / Deployment

- **Railway**: Backend auto-deploys from `main`. Pre-deploy command runs `node scripts/migrate.js`.
- **Vercel**: All 4 Next.js apps deploy from `main`. Preview deployments on every branch push.
- **CI**: GitHub Actions (currently blocked by account billing issue — not a code problem).
