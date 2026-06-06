# PRODUCTION_GAP_ANALYSIS.md — 24Therapy.ai
> Generated: 2026-06-06 | Session 5

---

## BUILD STATUS

### Verified from CLAUDE.md (commit `7150495`)
| App | Build | Routes |
|-----|-------|--------|
| `@24therapy/web` | ✅ PASS | 32 routes |
| `@24therapy/therapist` | ✅ PASS | 28 routes |
| `@24therapy/patient` | ✅ PASS | 17 routes |
| `@24therapy/admin` | ✅ PASS | 17 routes |
| `backend` | ⚠️ NOT VERIFIED | NestJS — needs `pnpm --filter backend build` |

---

## CRITICAL GAPS

### 1. PRICING INCONSISTENCY — BLOCKING
**Severity**: CRITICAL  
**Impact**: Revenue, customer trust, legal

Three independent sources with conflicting prices:
- `010_billing_schema.sql`: professional=$99, practice=$299
- `apps/web/app/pricing/page.tsx`: starter=$79, professional=$149, practice=$399
- `apps/admin/app/(dashboard)/billing/page.tsx`: starter=$59, pro=$149, growth=$599

**Resolution Required**:
- Create single source of truth in database (`subscription_plans` table)
- Admin portal CRUD to manage plans
- All pricing pages must fetch from backend API
- No hardcoded prices anywhere

### 2. NO ADMIN PRICING MANAGEMENT — BLOCKING
**Severity**: CRITICAL  
**Impact**: Admins cannot change pricing without code deployment

- No `/admin/pricing` page
- No backend admin endpoints for plan CRUD
- No ability to toggle plans active/inactive
- No ability to set featured plans
- No ability to manage promotions or trial periods

### 3. AUTHENTICATION NOT CONNECTED — HIGH
**Severity**: HIGH  
**Impact**: No real user authentication, security risk

All 4 portals use Zustand client-side state only:
- Login forms call mock setState, not backend API
- No JWT token from backend
- No token refresh
- No session timeout
- Refresh page → still "logged in" (Zustand localStorage persist)

Backend auth module (`/auth/login`, `/auth/register`) exists but not connected.

### 4. ALL DASHBOARDS SHOW MOCK DATA — HIGH
**Severity**: HIGH  
**Impact**: Cannot demonstrate to customers, cannot operate in production

Verified mock data files:
- `apps/therapist/app/(dashboard)/dashboard/page.tsx` — PLATFORM_STATS mock
- `apps/therapist/app/(dashboard)/patients/page.tsx` — MOCK patient array
- `apps/therapist/app/(dashboard)/sessions/page.tsx` — MOCK sessions
- `apps/therapist/app/(dashboard)/billing/page.tsx` — MOCK_TRANSACTIONS
- `apps/patient/app/(dashboard)/billing/page.tsx` — MOCK_INVOICES
- `apps/admin/app/(dashboard)/dashboard/page.tsx` — PLATFORM_STATS mock
- `apps/admin/app/(dashboard)/billing/page.tsx` — PLAN_PRICING hardcoded

### 5. MISSING BACKEND DTOs — MEDIUM
**Severity**: MEDIUM  
**Impact**: Incomplete API validation, missing Swagger docs

- `radar` module: No DTOs file
- `marketplace` module: No DTOs file

### 6. NO REAL AI FUNCTIONALITY — HIGH
**Severity**: HIGH  
**Impact**: Core product value proposition not functional

- `apps/therapist/app/(dashboard)/ai-workspace/page.tsx` — Mock AI responses
- No real OpenAI API calls from frontend
- Backend `ai.service.ts` exists with real model-gateway but not connected to frontend
- Session transcription: UI exists but no real Whisper integration
- AI Copilot: UI exists but responses are hardcoded

---

## MISSING ENVIRONMENT VARIABLES (Production)

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql://...       # Required
REDIS_URL=redis://...               # Required
JWT_SECRET=...                      # Required (min 32 chars)
JWT_REFRESH_SECRET=...              # Required
OPENAI_API_KEY=sk-...               # Required for AI features
STRIPE_SECRET_KEY=sk_live_...       # Required for billing
STRIPE_WEBHOOK_SECRET=whsec_...     # Required for webhooks
DAILY_API_KEY=...                   # Required for video sessions
DATA_ENCRYPTION_KEY=...             # Required for HIPAA PHI encryption
```

### Frontend Apps
```
NEXT_PUBLIC_API_URL=https://api.24therapy.ai   # All 4 apps need this
NEXT_PUBLIC_DAILY_DOMAIN=...                   # Therapist app
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_... # Patient app
```

---

## SECURITY ISSUES

### HIPAA Concerns
1. **PHI in mock data**: Patient names, session details, diagnoses in hardcoded arrays (acceptable for dev, not for prod)
2. **No real audit logging**: Audit log pages exist (UI) but not connected to real audit trail
3. **No PHI encryption at rest**: `DATA_ENCRYPTION_KEY` env var defined but encryption not implemented in services
4. **No real RBAC**: JWT guard exists but roles guard not applied to all sensitive routes
5. **Session timeout not enforced**: Zustand persist means no actual session expiry

### Authentication Concerns
1. **No real MFA**: UI for MFA exists in settings but not implemented
2. **No IP allowlist**: Admin env example has `ADMIN_IP_ALLOWLIST` but not enforced
3. **No rate limiting**: `ThrottleGuard` not configured in main.ts
4. **Password validation**: Backend has class-validator but frontend forms lack strength requirements UI

---

## DEPLOYMENT BLOCKERS

### Immediate Blockers
1. Missing `.env` files (all apps and backend) — requires real service credentials
2. Database not provisioned — needs PostgreSQL with pgvector extension
3. Redis not provisioned
4. Stripe not configured (no live keys)
5. OpenAI not configured (no API key)
6. Daily.co not configured (no domain/API key)

### Infrastructure Gaps
1. No Dockerfiles for individual apps (only docker-compose.yml)
2. No Prometheus/Grafana config in `infra/`
3. CI in `infra/ci/` not `.github/workflows/` (GitHub App lacks permissions)
4. No SSL/TLS termination config
5. No CDN configuration

### Database Gaps
1. No migration runner configured (`scripts/migrate.js` referenced but may not exist)
2. No seed runner for initial admin user
3. pgvector extension must be enabled manually

---

## RUNTIME FAILURES (Expected)

If deployed today without fixes:
1. All login pages → store fake JWT → appear to work but no real auth
2. All dashboard pages → show mock data (looks functional but fake)
3. Pricing page → shows hardcoded prices (may differ from actual Stripe prices)
4. AI workspace → mock responses, no real AI
5. Session room → Daily.co not configured → video fails
6. Billing/checkout → Stripe not configured → payment fails
7. Notifications → mock, no real email/SMS delivery

---

## RECOMMENDED FIX ORDER

### Phase 1 — Pricing (This Session)
1. ✅ Backend: Admin plan management endpoints
2. ✅ Admin portal: `/pricing` CRUD management page
3. ✅ Frontend: All pricing pages fetch from API
4. ✅ Unify plan data to single database source

### Phase 2 — Authentication
1. Connect login forms to backend JWT auth
2. Implement token refresh
3. Session timeout enforcement
4. Real MFA implementation

### Phase 3 — Data APIs
1. Replace mock data with real API calls
2. Implement proper loading states
3. Error handling for API failures
4. Pagination for data tables

### Phase 4 — AI Systems
1. Connect AI workspace to backend AI service
2. Real session transcription via Whisper
3. AI Copilot with real context
4. Memory engine population

### Phase 5 — Production Hardening
1. Rate limiting
2. PHI encryption
3. Real audit logging
4. Monitoring and alerting
