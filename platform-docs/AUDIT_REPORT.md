# AUDIT_REPORT.md — 24Therapy.ai Platform Audit
> Generated: 2026-06-06 | Auditor: AI Lead Engineer (Session 5)
> Source of Truth: Repository code only — no prior session summaries trusted

---

## 1. APPLICATIONS OVERVIEW

### Architecture
```
apps/
  web/          → Marketing site         (Next.js 15.3.3)  32 routes
  therapist/    → Therapist portal        (Next.js 15.3.3)  34 routes
  patient/      → Patient portal          (Next.js 15.1.0)  21 routes
  admin/        → Super admin portal      (Next.js 15.1.0)  19 routes
backend/        → NestJS API              (16 modules)
packages/
  types/        → @24therapy/types        (1,860+ line shared TS types)
```

---

## 2. MARKETING WEBSITE (`apps/web`)

### Existing Routes
| Route | File | Status |
|-------|------|--------|
| `/` | `app/page.tsx` | ✅ Exists |
| `/about` | `app/about/page.tsx` | ✅ Exists |
| `/pricing` | `app/pricing/page.tsx` | ⚠️ HARDCODED prices |
| `/blog` | `app/blog/page.tsx` | ✅ Exists |
| `/blog/[slug]` | `app/blog/[slug]/page.tsx` | ✅ Exists |
| `/careers` | `app/careers/page.tsx` | ✅ Exists |
| `/contact` | `app/contact/page.tsx` | ✅ Exists |
| `/docs` | `app/docs/page.tsx` | ✅ Exists |
| `/enterprise` | `app/enterprise/page.tsx` | ✅ Exists |
| `/features` | `app/features/page.tsx` | ✅ Exists |
| `/features/ai-copilot` | `app/features/ai-copilot/page.tsx` | ✅ Exists |
| `/features/ai-workspace` | `app/features/ai-workspace/page.tsx` | ✅ Exists |
| `/features/analytics` | `app/features/analytics/page.tsx` | ✅ Exists |
| `/features/integrations` | `app/features/integrations/page.tsx` | ✅ Exists |
| `/features/memory-layer` | `app/features/memory-layer/page.tsx` | ✅ Exists |
| `/features/teletherapy` | `app/features/teletherapy/page.tsx` | ✅ Exists |
| `/features/use-cases` | `app/features/use-cases/page.tsx` | ✅ Exists |
| `/features/workflow-engine` | `app/features/workflow-engine/page.tsx` | ✅ Exists |
| `/find-therapist` | `app/find-therapist/page.tsx` | ✅ Exists |
| `/for-therapists` | `app/for-therapists/page.tsx` | ✅ Exists |
| `/hipaa` | `app/hipaa/page.tsx` | ✅ Exists |
| `/privacy` | `app/privacy/page.tsx` | ✅ Exists |
| `/security` | `app/security/page.tsx` | ✅ Exists |
| `/terms` | `app/terms/page.tsx` | ✅ Exists |
| `/testimonials` | `app/testimonials/page.tsx` | ✅ Exists |
| `/therapist-join` | `app/therapist-join/page.tsx` | ✅ Exists |
| `/therapists` | `app/therapists/page.tsx` | ✅ Exists |
| `/therapists/[id]` | `app/therapists/[id]/page.tsx` | ✅ Exists |
| `/ai-scribe` | `app/ai-scribe/page.tsx` | ✅ Exists |
| `/press` | — | ❌ MISSING |
| `/status` | — | ❌ MISSING |
| `/gdpr` | — | ❌ MISSING |

### Pricing Page Critical Issue
- **All plan prices HARDCODED** in `apps/web/app/pricing/page.tsx` as static arrays (PLANS, ADD_ONS)
- Prices: Starter $79/mo, Professional $149/mo, Practice $399/mo
- **MISMATCH with database**: `010_billing_schema.sql` has professional=$99, practice=$299
- No API calls to backend for plan data
- Feature lists, limits, billing cycles all hardcoded

### Components
- `components/layout/navbar.tsx` — ✅ global nav
- `components/layout/footer.tsx` — ✅ global footer
- `lib/` — utility functions

---

## 3. THERAPIST PORTAL (`apps/therapist`)

### Existing Routes
| Route | File | Status |
|-------|------|--------|
| `/login` | `app/(auth)/login/page.tsx` | ✅ Exists |
| `/onboarding` | `app/onboarding/page.tsx` | ✅ Exists |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | ⚠️ MOCK DATA |
| `/patients` | `app/(dashboard)/patients/page.tsx` | ⚠️ MOCK DATA |
| `/patients/[id]` | `app/(dashboard)/patients/[id]/page.tsx` | ⚠️ MOCK DATA |
| `/patients/intake` | `app/(dashboard)/patients/intake/page.tsx` | ✅ Exists |
| `/sessions` | `app/(dashboard)/sessions/page.tsx` | ⚠️ MOCK DATA |
| `/sessions/new` | `app/(dashboard)/sessions/new/page.tsx` | ⚠️ MOCK DATA |
| `/sessions/[id]/prepare` | `app/(dashboard)/sessions/[id]/prepare/page.tsx` | ⚠️ MOCK DATA |
| `/sessions/[id]/room` | `app/(dashboard)/sessions/[id]/room/page.tsx` | ⚠️ MOCK DATA |
| `/notes` | `app/(dashboard)/notes/page.tsx` | ⚠️ MOCK DATA |
| `/notes/[id]` | `app/(dashboard)/notes/[id]/page.tsx` | ⚠️ MOCK DATA |
| `/ai-workspace` | `app/(dashboard)/ai-workspace/page.tsx` | ⚠️ MOCK DATA |
| `/assessments` | `app/(dashboard)/assessments/page.tsx` | ⚠️ MOCK DATA |
| `/calendar` | `app/(dashboard)/calendar/page.tsx` | ✅ Exists |
| `/billing` | `app/(dashboard)/billing/page.tsx` | ⚠️ MOCK DATA |
| `/messages` | `app/(dashboard)/messages/page.tsx` | ⚠️ MOCK DATA |
| `/notifications` | `app/(dashboard)/notifications/page.tsx` | ⚠️ MOCK DATA |
| `/settings` | `app/(dashboard)/settings/page.tsx` | ✅ Exists |
| `/team` | `app/(dashboard)/team/page.tsx` | ✅ Exists |
| `/audit-logs` | `app/(dashboard)/audit-logs/page.tsx` | ✅ Exists |
| `/analytics` | `app/(dashboard)/analytics/page.tsx` | ✅ Exists |
| `/clinical-tools` | `app/(dashboard)/clinical-tools/page.tsx` | ✅ Exists |
| `/crm` | `app/(dashboard)/crm/page.tsx` | ✅ Exists |
| `/memory` | `app/(dashboard)/memory/page.tsx` | ✅ Exists |
| `/memory/graph` | `app/(dashboard)/memory/graph/page.tsx` | ✅ Exists |
| `/radar` | `app/(dashboard)/radar/page.tsx` | ⚠️ MOCK DATA |
| `/referrals` | `app/(dashboard)/referrals/page.tsx` | ⚠️ MOCK DATA |
| `/reports` | `app/(dashboard)/reports/page.tsx` | ⚠️ MOCK DATA |
| `/risk-monitor` | `app/(dashboard)/risk-monitor/page.tsx` | ⚠️ MOCK DATA |
| `/treatment-plans` | `app/(dashboard)/treatment-plans/page.tsx` | ⚠️ MOCK DATA |
| `/workflow` | `app/(dashboard)/workflow/page.tsx` | ✅ Exists |

### Mock Data Found In
- dashboard, patients, sessions, notes, ai-workspace, assessments, billing, messages, notifications, patients/[id], sessions/[id]/prepare, sessions/[id]/room, sessions/new, radar, referrals, reports, risk-monitor, treatment-plans

### Authentication
- Zustand `useAuthStore` — client-side only, no real JWT validation
- Auth guard in layout.tsx redirects to `/login` if not authenticated
- **No real API auth call** — mock login sets Zustand state

### Billing Issue
- `apps/therapist/app/(dashboard)/billing/page.tsx` — ALL MOCK DATA (MOCK_TRANSACTIONS array)
- No connection to backend billing API
- Prices hardcoded in transaction records

---

## 4. PATIENT PORTAL (`apps/patient`)

### Existing Routes
| Route | File | Status |
|-------|------|--------|
| `/` | `app/page.tsx` | ✅ Exists |
| `/login` | `app/(auth)/login/page.tsx` | ✅ Exists |
| `/home` (dashboard) | `app/(dashboard)/home/page.tsx` | ✅ Exists |
| `/sessions` | `app/(dashboard)/sessions/page.tsx` | ⚠️ MOCK DATA |
| `/appointments` | `app/(dashboard)/appointments/page.tsx` | ✅ Exists |
| `/messages` | `app/(dashboard)/messages/page.tsx` | ✅ Exists |
| `/assessments` | `app/(dashboard)/assessments/page.tsx` | ✅ Exists |
| `/resources` | `app/(dashboard)/resources/page.tsx` | ✅ Exists |
| `/billing` | `app/(dashboard)/billing/page.tsx` | ⚠️ MOCK DATA |
| `/homework` | `app/(dashboard)/homework/page.tsx` | ✅ Exists |
| `/profile` | `app/(dashboard)/profile/page.tsx` | ✅ Exists |
| `/ai-companion` | `app/(dashboard)/ai-companion/page.tsx` | ⚠️ MOCK DATA |
| `/crisis` | `app/(dashboard)/crisis/page.tsx` | ✅ Exists |
| `/journal` | `app/(dashboard)/journal/page.tsx` | ✅ Exists |
| `/mood` | `app/(dashboard)/mood/page.tsx` | ✅ Exists |
| `/notifications` | `app/(dashboard)/notifications/page.tsx` | ⚠️ MOCK DATA |
| `/progress` | `app/(dashboard)/progress/page.tsx` | ✅ Exists |
| `/reports` | `app/(dashboard)/reports/page.tsx` | ✅ Exists |
| `/settings` | `app/(dashboard)/settings/page.tsx` | ✅ Exists |

### Billing Issue
- `apps/patient/app/(dashboard)/billing/page.tsx` — ALL MOCK DATA (MOCK_INVOICES array)
- Hardcoded insurance amounts, prices, provider names

---

## 5. ADMIN PORTAL (`apps/admin`)

### Existing Routes
| Route | File | Status |
|-------|------|--------|
| `/` | `app/page.tsx` | Redirects to /dashboard |
| `/login` | `app/(auth)/login/page.tsx` | ✅ Exists |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | ⚠️ MOCK DATA |
| `/organizations` | `app/(dashboard)/organizations/page.tsx` | ⚠️ MOCK DATA |
| `/users` | `app/(dashboard)/users/page.tsx` | ⚠️ MOCK DATA |
| `/therapists` | `app/(dashboard)/therapists/page.tsx` | ⚠️ MOCK DATA |
| `/practice-management` | `app/(dashboard)/practice-management/page.tsx` | ⚠️ MOCK DATA |
| `/compliance` | `app/(dashboard)/compliance/page.tsx` | ✅ Exists |
| `/ai-governance` | `app/(dashboard)/ai-governance/page.tsx` | ✅ Exists |
| `/billing` | `app/(dashboard)/billing/page.tsx` | ⚠️ MOCK DATA |
| `/marketplace` | `app/(dashboard)/marketplace/page.tsx` | ✅ Exists |
| `/analytics` | `app/(dashboard)/analytics/page.tsx` | ✅ Exists |
| `/crm` | `app/(dashboard)/crm/page.tsx` | ⚠️ MOCK DATA |
| `/support-tools` | `app/(dashboard)/support-tools/page.tsx` | ✅ Exists |
| `/feature-flags` | `app/(dashboard)/feature-flags/page.tsx` | ✅ Exists |
| `/ai-costs` | `app/(dashboard)/ai-costs/page.tsx` | ✅ Exists |
| `/audit-logs` | `app/(dashboard)/audit-logs/page.tsx` | ✅ Exists |
| `/settings` | `app/(dashboard)/settings/page.tsx` | ✅ Exists |
| **`/pricing`** | — | ❌ **MISSING — CRITICAL** |

### Admin Billing Issue
- `apps/admin/app/(dashboard)/billing/page.tsx` — PLAN_PRICING array HARDCODED
- Plans: Starter=$59, Pro=$149, Growth=$599, Enterprise=null
- **TRIPLE MISMATCH**: web pricing ($79/$149/$399), admin billing ($59/$149/$599), DB schema ($99/$299)
- No Pricing Management CRUD interface exists

---

## 6. BACKEND API (`backend/`)

### Module Status
| Module | Controller | Service | DTOs | Status |
|--------|-----------|---------|------|--------|
| `auth` | ✅ | ✅ | ✅ | Complete |
| `users` | ✅ | ✅ | ✅ | Complete |
| `therapists` | ✅ | ✅ | ✅ | Complete |
| `patients` | ✅ | ✅ | ✅ | Complete |
| `sessions` | ✅ | ✅ | ✅ | Complete |
| `memory` | ✅ | ✅ | ✅ | Complete |
| `ai` | ✅ | ✅ | ✅ | Complete |
| `radar` | ✅ | ✅ | ❌ No DTOs | Partial |
| `assessments` | ✅ | ✅ | ✅ | Complete |
| `billing` | ✅ | ✅ | ✅ | Complete |
| `marketplace` | ✅ | ✅ | ❌ No DTOs | Partial |
| `organizations` | ✅ | ✅ | ✅ | Complete |
| `workflows` | ✅ | ✅ | ✅ | Complete |
| `notifications` | ✅ | ✅ | ✅ | Complete |
| `analytics` | ✅ | ✅ | ✅ | Complete |
| `admin` | ✅ | ✅ | ✅ | Complete |
| **`pricing`** | ❌ | ❌ | ❌ | **MISSING** |

### Billing Service
- `billing.service.ts` — Real Stripe integration (not mock)
- `getPlans()` — Queries `subscription_plans` table
- `createCheckoutSession()` — Real Stripe checkout
- `handleWebhook()` — Real Stripe webhook handling
- ⚠️ No admin endpoint for creating/updating/deleting plans

### Missing Backend Functionality
- No dedicated Pricing Management admin endpoints (create plan, update plan, toggle active, reorder)
- No plan management CRUD separate from billing module
- `radar` module missing DTOs
- `marketplace` module missing DTOs

### Database
- 14 SQL schema files (001-014)
- `subscription_plans` table exists with seed data
- pgvector enabled for memory/embedding storage
- Redis configured for caching/sessions
- All foreign keys properly defined

---

## 7. INFRASTRUCTURE

### Build Configuration
| File | Status |
|------|--------|
| `pnpm-lock.yaml` | ✅ lockfileVersion 9.0 |
| `.npmrc` | ✅ shamefully-hoist, node-linker=hoisted |
| `.gitignore` | ✅ Exists |
| `vercel.json` (root) | ✅ installCommand override |
| `apps/web/vercel.json` | ✅ Per-app build config |
| `apps/therapist/vercel.json` | ✅ Per-app build config |
| `apps/patient/vercel.json` | ✅ Per-app build config |
| `apps/admin/vercel.json` | ✅ Per-app build config |
| `docker-compose.yml` | ✅ Full stack |
| `infra/ci/ci.yml` | ✅ In infra/ (not .github/) |

### Environment Variables
| App | File | Status |
|-----|------|--------|
| `apps/web` | `.env.example` | ✅ Analytics, CMS, Calendly |
| `apps/therapist` | `.env.example` | ✅ JWT, video, AI |
| `apps/patient` | `.env.example` | ✅ JWT, payments, crisis |
| `apps/admin` | `.env.example` | ✅ IP allowlist, impersonation |
| `backend` | `.env.example` | ✅ Comprehensive |

### Deployment Readiness
- Vercel: ✅ All 4 apps configured for Vercel monorepo deployment
- Docker: ✅ docker-compose.yml with postgres, redis, all services
- Database migrations: ✅ 14 SQL files ready
- Seed data: ✅ subscription_plans seeded in 010_billing_schema.sql

---

## 8. KEY ISSUES FOUND

### CRITICAL — Pricing Inconsistency (3 sources, 3 different prices)
| Plan | DB Schema | Web Pricing Page | Admin Billing Page |
|------|-----------|-----------------|-------------------|
| Starter/Free | $0 (free tier) | $79/mo | $59/mo |
| Professional | $99/mo | $149/mo | $149/mo |
| Practice | $299/mo | $399/mo | $599/mo |
| Enterprise | Custom | Custom | Custom |

No centralized pricing management. Three independent hardcoded sources.

### HIGH — No Admin Pricing CRUD
- Admin cannot add/edit/delete plans from the portal
- No `/admin/pricing` page exists
- No backend API endpoints for plan management by admins

### HIGH — All Portals Use Mock Data
- Therapist portal: 15+ pages with hardcoded mock arrays
- Patient portal: 5+ pages with hardcoded mock arrays
- Admin portal: 10+ pages with hardcoded mock arrays

### MEDIUM — Authentication Not Connected to Real Backend
- All portals use Zustand client-side auth only
- No real JWT token exchange with backend
- No session persistence across refreshes

### MEDIUM — Missing Backend DTOs
- `radar` module: No DTOs (RiskAlert, SafetyPlan, CrisisProtocol)
- `marketplace` module: No DTOs (Integration, AppListing, InstallRequest)
