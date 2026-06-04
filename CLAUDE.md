# CLAUDE.md — 24Therapy Mental Health OS — Persistent AI Session Memory

> **PURPOSE**: This file is the authoritative session state for AI coding assistants.
> Read this file at the START of every session. Update it at the END of every session
> (after each commit). Never skip updating this file.

---

## Project Identity

| Field | Value |
|-------|-------|
| **Project** | 24Therapy Mental Health OS |
| **Repo** | https://github.com/omarahmedomarahmed/habiba |
| **Branch** | `main` |
| **Stack** | Next.js 14 · NestJS · PostgreSQL + pgvector · Redis · TypeScript |
| **Monorepo** | Turbo + PNPM workspaces |
| **Last Commit** | `a871cef` — feat: complete therapist + admin portals with full page suite |
| **Last Updated** | 2025-01-15 (session 3) |

---

## Architecture Overview

```
apps/
  web/           → Marketing site         (24therapy.com)       port 3004
  therapist/     → Therapist portal        (app.24therapy.com)   port 3000
  patient/       → Patient portal          (my.24therapy.com)    port 3002
  admin/         → Super admin portal      (admin.24therapy.com) port 3003
backend/         → NestJS API              (api.24therapy.com)   port 3001
packages/
  types/         → @24therapy/types — 1,860+ line shared TS types
```

---

## Brand Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Navy | `#0A2342` | Primary backgrounds, headings |
| Teal | `#2EC4B6` | Accent, CTA, active states |
| Blue | `#1F5EFF` | Links, interactive elements |
| Red (Admin) | gradient `red-500 → orange-500` | Admin portal accent |

---

## Key Technology Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| State Management | Zustand (`useAuthStore`, `useUIStore`, `useAdminAuth`) | Lightweight, no boilerplate |
| Icons | Lucide React | Consistent icon set across all apps |
| Forms | React `useState` + inline validation | Simpler than react-hook-form for current scope |
| Backend DTOs | class-validator + @nestjs/swagger @ApiProperty | Validation + Swagger auto-docs |
| AI Models | GPT-4o (scribe/copilot), Whisper (transcription), text-embedding-3-large (memory) | Best-in-class for clinical use |
| Vector DB | pgvector extension on PostgreSQL | Avoids separate vector DB service |
| Video | Daily.co | HIPAA-compliant WebRTC |

---

## Page Status — Marketing Website (`apps/web`)

| Route | Status | Commit |
|-------|--------|--------|
| `/` | ✅ Complete | `a871cef` (fixed duplicate Navbar/Footer) |
| `/pricing` | ✅ Complete | prior |
| `/about` | ✅ Complete | prior |
| `/hipaa` | ✅ Complete | `f467147` |
| `/features/use-cases` | ✅ Complete | `f467147` |
| `/features/integrations` | ✅ Complete | `f467147` |
| `/features/memory-layer` | ✅ Complete | `f467147` |
| `/features/workflow-engine` | ✅ Complete | `f467147` |
| `/features/ai-copilot` | ✅ Complete | `f467147` |
| `/features/ai-workspace` | ✅ Complete | `f467147` |
| `/features/ai-scribe` | ✅ Complete | prior |
| `/features/risk-radar` | ✅ Complete | prior |
| `/blog` | ✅ Complete | prior |
| `/press` | ❌ Not created | low priority |
| `/status` | ❌ Not created | low priority |
| `/gdpr` | ❌ Not created | low priority |
| `layout.tsx` | ✅ Global Navbar + Footer | `f467147` |

---

## Page Status — Patient Portal (`apps/patient`)

| Route | Status | Commit |
|-------|--------|--------|
| `/login` | ✅ Complete | prior |
| `/dashboard` | ✅ Complete | prior |
| `/sessions` | ✅ Complete | prior |
| `/messages` | ✅ Complete | prior |
| `/assessments` | ✅ Complete | prior |
| `/resources` | ✅ Complete | prior |
| `/billing` | ✅ Complete | prior |
| `/homework` | ✅ Complete | `f467147` |
| `/profile` | ✅ Complete | `f467147` |
| Sidebar | ✅ Updated with homework + profile | `f467147` |

---

## Page Status — Therapist Portal (`apps/therapist`)

| Route | Status | Commit |
|-------|--------|--------|
| `/login` | ✅ Complete | prior |
| `/dashboard` | ✅ Complete | prior |
| `/patients` | ✅ Complete | prior |
| `/sessions` | ✅ Complete | prior |
| `/notes` | ✅ Complete | prior |
| `/assessments` | ✅ Complete | prior |
| `/calendar` | ✅ Complete | `8ad7fbf` |
| `/messages` | ✅ Complete | prior |
| `/billing` | ✅ Complete | prior |
| `/settings` | ✅ Complete (6-tab deep) | `7c0a3a8` |
| `/team` | ✅ Complete | `a871cef` |
| `/audit-logs` | ✅ Complete | `a871cef` |
| Sidebar | ✅ Updated with team + audit-logs + COMPLIANCE section | `a871cef` |

---

## Page Status — Admin Portal (`apps/admin`)

| Route | Status | Commit |
|-------|--------|--------|
| `/login` | ✅ Complete | prior |
| `/dashboard` | ✅ Complete | prior |
| `/organizations` | ✅ Complete | prior |
| `/users` | ✅ Complete | prior |
| `/therapists` | ✅ Complete | prior |
| `/practice-management` | ✅ Complete | prior |
| `/compliance` | ✅ Complete | prior |
| `/ai-governance` | ✅ Complete | prior |
| `/billing` | ✅ Complete | prior |
| `/marketplace` | ✅ Complete | prior |
| `/analytics` | ✅ Complete (5-tab deep: Revenue, Clinical, AI Perf, Growth, Cohorts) | `a871cef` |
| `/crm` | ✅ Complete | prior |
| `/support-tools` | ✅ Complete (3-tab: tickets, impersonation, account actions) | `a871cef` |
| `/feature-flags` | ✅ Complete (boolean/percentage/variant flags, per-org overrides) | `a871cef` |
| `/ai-costs` | ✅ Complete (model breakdown, per-org table, spend trend) | `a871cef` |
| `/audit-logs` | ✅ Complete (platform-wide, 15 events, 13 categories, expandable rows) | `a871cef` |
| `/settings` | ✅ Complete | prior |
| Admin Sidebar | ✅ Updated with TOOLS section (support-tools, feature-flags, ai-costs, audit-logs) | `a871cef` |

---

## Backend Module Status (`backend/src/modules/`)

| Module | Controller | Service | DTOs | Swagger |
|--------|-----------|---------|------|---------|
| `auth` | ✅ | ✅ | ✅ | ✅ |
| `users` | ✅ | ✅ | ✅ | ✅ |
| `therapists` | ✅ | ✅ | ✅ | ✅ |
| `patients` | ✅ | ✅ | ✅ | ✅ |
| `sessions` | ✅ | ✅ | ✅ | ✅ |
| `memory` | ✅ | ✅ | ✅ Added | ✅ Added |
| `ai` | ✅ | ✅ | ✅ Added | ✅ Added |
| `radar` | ✅ | ✅ | ⚠️ Pending | ⚠️ Pending |
| `assessments` | ✅ | ✅ | ✅ Added | ✅ Added |
| `billing` | ✅ | ✅ | ✅ Added | ✅ Added |
| `marketplace` | ✅ | ✅ | ⚠️ Pending | ⚠️ Pending |
| `organizations` | ✅ | ✅ | ✅ Added | ✅ Added |
| `workflows` | ✅ | ✅ | ✅ Added | ✅ Added |
| `notifications` | ✅ | ✅ | ✅ Added | ✅ Added |
| `analytics` | ✅ | ✅ | ✅ Added | ✅ Added |
| `admin` | ✅ | ✅ | ✅ Added | ✅ Added |

---

## Infrastructure Status

| File | Status | Notes |
|------|--------|-------|
| `docker-compose.yml` | ✅ Created | Full stack: postgres, redis, all 5 services; debug + monitoring profiles |
| `apps/web/.env.example` | ✅ Created | Analytics, CMS, Calendly, SEO vars |
| `apps/therapist/.env.example` | ✅ Created | JWT, video, AI flags, HIPAA vars |
| `apps/patient/.env.example` | ✅ Created | JWT, payments, crisis resources |
| `apps/admin/.env.example` | ✅ Created | IP allowlist, impersonation flags |
| `backend/.env.example` | ✅ Existed | Already comprehensive |
| `.github/workflows/ci.yml` | ✅ Created | 7-job pipeline: setup, typecheck, lint, build (matrix), backend-build, security, gate |
| `SETUP.md` | ✅ Expanded | 347 → 868 lines; added Docker, GitHub Actions, prod phases, HIPAA checklist, scaling |

---

## Commit History (This Session)

| Hash | Message | Files |
|------|---------|-------|
| `a871cef` | feat: complete therapist + admin portals with full page suite | 10 files, +3058 lines |
| `f467147` | feat: marketing pages, patient portal homework+profile, web layout | ~12 files |
| `7c0a3a8` | feat(therapist): deep 6-tab settings page | settings page |
| `8ad7fbf` | feat(therapist): full calendar page | calendar page |
| `fe39646` | docs(claude): update persistent AI session memory | CLAUDE.md |

---

## Remaining Work — Priority Ordered

### Priority 1 — Backend Completeness
- [ ] `radar` module DTOs — RiskAlert, SafetyPlan, CrisisProtocol DTOs
- [ ] `marketplace` module DTOs — Integration, AppListing, InstallRequest DTOs
- [ ] Wire DTOs into controllers (currently controllers use validated DTO types but services still accept `any` — add explicit typing in services)
- [ ] `ValidationPipe` global config in `main.ts` — ensure class-validator runs on all endpoints

### Priority 2 — Backend Swagger Setup
- [ ] Verify `main.ts` has `SwaggerModule.setup('api/docs', app, document)` configured
- [ ] Add `@ApiResponse` decorators to remaining controllers (ai, assessments, billing, organizations)

### Priority 3 — Web App Pages (Lower Priority)
- [ ] `/press` — press kit, media coverage, brand assets
- [ ] `/status` — system status page (can use Statuspage.io embed)
- [ ] `/gdpr` — GDPR compliance center (similar pattern to `/hipaa`)
- [ ] `/changelog` — product changelog

### Priority 4 — Testing
- [ ] Backend unit tests for memory service (AI extraction logic)
- [ ] Backend unit tests for billing service (Stripe webhook handling)
- [ ] E2E tests for auth flows across all 4 apps

### Priority 5 — DevOps
- [ ] Dockerfiles for each app (Next.js multi-stage builds)
- [ ] `infra/prometheus.yml` — Prometheus config for monitoring profile
- [ ] `infra/grafana/` — Grafana dashboard provisioning files
- [ ] `scripts/db/init.sql` — Docker init script referenced in docker-compose

---

## Reusable Patterns

### Admin Page Pattern (for reference)
```tsx
'use client';
import { useState } from 'react';
// 1. Define interfaces at top
// 2. Mock data array
// 3. Helper maps (colors, labels, icons)
// 4. Small components (StatCard, Row, Badge)
// 5. Main page with filter state + useMemo for filtered data
// 6. Stat cards (4-5 across top)
// 7. Filter bar (search + selects)
// 8. Table with expandable rows
// 9. Pagination
```

### Therapist Page Pattern
```tsx
'use client';
// Same as admin but with teal/navy brand colors instead of red/orange
// Uses therapist-specific sidebar (not admin sidebar)
```

### DTO Pattern (NestJS)
```typescript
// 1. Enums at top
// 2. Query DTOs (for GET endpoints)
// 3. Create DTOs (for POST endpoints)  
// 4. Update DTOs (all fields optional, same as Create but IsOptional)
// 5. Use @ApiProperty on everything for Swagger
// 6. Use class-validator decorators: @IsString, @IsEnum, @IsUUID, @IsOptional
```

---

## Important File Locations

| File | Purpose |
|------|---------|
| `packages/types/src/index.ts` | 1,860+ line shared types — check before adding new types |
| `apps/admin/components/layout/admin-sidebar.tsx` | Admin nav — 4 sections: PLATFORM, COMPLIANCE & SAFETY, BUSINESS, TOOLS, SYSTEM |
| `apps/therapist/components/layout/sidebar.tsx` | Therapist nav — sections: PATIENT CARE, PRACTICE, COMPLIANCE |
| `apps/patient/components/layout/patient-sidebar.tsx` | Patient nav — includes homework + profile |
| `apps/web/app/layout.tsx` | Global layout — wraps ALL web pages with `<Navbar />` + `<Footer />` |
| `backend/src/modules/auth/guards/jwt-auth.guard.ts` | JWT guard used on all protected routes |
| `backend/src/modules/auth/decorators/current-user.decorator.ts` | `@CurrentUser()` decorator |

---

## HIPAA Requirements (Technical)

- **PHI** = any patient-identifiable information in session notes, assessments, records
- **Audit logging**: every PHI access, modification, export must be logged with actor, target, IP, outcome
- **Encryption**: PHI fields encrypted at rest using `DATA_ENCRYPTION_KEY` (AES-256-GCM)
- **Access control**: minimum necessary — therapists only see their own patients
- **Session timeout**: 4 hours max (configurable); idle timeout 30 min
- **MFA**: required for all org_admin and above roles
- **Retention**: audit logs retained 6 years per HIPAA §164.312(b)

---

## Session Notes (What Was Just Built)

**Session 3 (current) — 2025-01-15:**

Built and committed (`a871cef`):
1. `apps/admin/app/(dashboard)/audit-logs/page.tsx` — Platform-wide audit log viewer
   - 15 mock events across 13 categories, 5 severity levels
   - Expandable rows with IP, user agent, geo, metadata, session/log IDs
   - Filters: search, category, severity, outcome, org, actor-role
   - Compliance footer: retention schedule, high-risk event types, certifications
   
2. `apps/admin/components/layout/admin-sidebar.tsx` — Added TOOLS section
   - support-tools (Wrench), feature-flags (ToggleLeft), ai-costs (DollarSign), audit-logs (FileSearch)

3. `apps/web/app/page.tsx` — Removed duplicate `<Navbar />` + `<Footer />` (now in layout.tsx)

Also created (infrastructure batch, not yet committed):
- `apps/web/.env.example`
- `apps/therapist/.env.example`
- `apps/patient/.env.example`
- `apps/admin/.env.example`
- `docker-compose.yml` (root)
- `.github/workflows/ci.yml`
- `backend/src/modules/memory/dto/memory.dto.ts`
- `backend/src/modules/workflows/dto/workflows.dto.ts`
- `backend/src/modules/ai/dto/ai.dto.ts`
- `backend/src/modules/assessments/dto/assessments.dto.ts`
- `backend/src/modules/notifications/dto/notifications.dto.ts`
- `backend/src/modules/organizations/dto/organizations.dto.ts`
- `backend/src/modules/billing/dto/billing.dto.ts`
- `backend/src/modules/analytics/dto/analytics.dto.ts`
- `backend/src/modules/admin/dto/admin.dto.ts`
- `SETUP.md` expanded (347 → 868 lines)
- `CLAUDE.md` (this file) updated
