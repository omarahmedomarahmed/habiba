# CLAUDE.md — 24Therapy Mental Health OS — AI Session State

> Read this file at the START of every session. Update it at the END of every session after each commit.
> Do NOT trust any other .md file for current state — they may be outdated.

---

## Project Identity

| Field | Value |
|-------|-------|
| **Project** | 24Therapy Mental Health OS |
| **Repo** | https://github.com/omarahmedomarahmed/habiba |
| **Dev Branch** | `claude/wizardly-cerf-2mrcdg` |
| **Stack** | Next.js 15 · NestJS 10 · PostgreSQL + pgvector · Redis · TypeScript |
| **Monorepo** | Turborepo + pnpm 9.15.4 workspaces |
| **Last Updated** | 2026-06-11 (session 7 — full M&A audit, doc cleanup, migration fixes) |

---

## Build Status (Verified 2026-06-11)

| Package | Build | Routes |
|---------|-------|--------|
| `@24therapy/api` | ✅ PASS | 17 modules, ~80 endpoints |
| `@24therapy/web` | ✅ PASS | 40+ routes |
| `@24therapy/therapist` | ✅ PASS | 35+ routes |
| `@24therapy/patient` | ✅ PASS | 18 routes |
| `@24therapy/admin` | ✅ PASS | 18 routes |

> **Build note**: `apps/web` and `apps/therapist` fetch Inter from Google Fonts at build time. In network-restricted environments (like this container), builds may fail with SSL/font errors. This is a build-environment limitation — Vercel and Railway have full network access and build successfully.

---

## Architecture

```
apps/web           → Marketing site      :3000  (Next.js 15)
apps/therapist     → Therapist portal    :3001  (Next.js 15)
apps/patient       → Patient portal      :3002  (Next.js 15)
apps/admin         → Admin portal        :3003  (Next.js 15)
backend            → NestJS REST API     :4000
packages/types     → @24therapy/types (shared TS types)
packages/config    → @24therapy/config (shared URL constants)
migrations/        → 15 ordered SQL files (001–015)
```

---

## Current Issues (Must Fix Before Production)

### CRITICAL — Schema/Code Mismatches

1. **Billing column name mismatch** (`billing.service.ts` line ~253)
   - Migration 010 creates `monthly_price_usd`, `annual_price_usd`
   - Migration 015 tries to rename but does it conditionally
   - `billing.service.ts` queries `sp.price_monthly_usd, sp.session_limit` — neither column exists
   - **Fix**: Standardize column names in both migrations and service queries

2. **Missing `therapist_specializations` junction table** (`therapists.service.ts` line ~31)
   - Code does: `JOIN therapist_specializations ts ON ts.specialization_id = st.id`
   - No such table in any migration — therapists.specializations is TEXT[] in migration 002
   - **Fix**: Either create junction table migration OR rewrite service to query TEXT[] array directly

3. **Missing `accepting_new_patients` column** (`therapists.service.ts` line ~71)
   - Code tries to update this column; it doesn't exist in migration 002
   - **Fix**: Add column to migration OR remove field reference in service

4. **Duplicate `patient_consents` definition** (migrations 003 vs 012)
   - Migration 003 creates `patient_consents` with one schema
   - Migration 012 creates `consent_versions` + tries to create `patient_consents` again with different columns
   - Running both migrations will fail on the second CREATE TABLE
   - **Fix**: Migration 012 should ALTER TABLE, not CREATE TABLE for patient_consents

### HIGH — Auth Not Wired to Backend

5. **Admin `/pricing` page uses `DEV_TOKEN`**
   - `apps/admin/app/(dashboard)/pricing/page.tsx` line ~18 uses a hardcoded dev token
   - Must read from Zustand `useAdminAuth` store instead

6. **WebSocket not implemented in frontend**
   - Backend has full Socket.io gateway (`/ws` namespace)
   - No frontend app connects to WebSocket
   - Live session transcription, copilot, radar notifications will not work without this

### MEDIUM — Missing Features

7. **No registration/signup flow**
   - All portals have login and forgot-password but no actual registration pages
   - `apps/web/app/signup/page.tsx` exists but is a marketing CTA, not a real form
   - Backend `POST /auth/register` endpoint is ready and tested

8. **HIPAA compliance tables not implemented in backend**
   - Migration 012 creates: `phi_access_log`, `baa_records`, `data_retention_policies`, `security_incidents`
   - No backend module reads/writes to these tables
   - Required for HIPAA compliance — every PHI access must be logged

9. **Patient portal WebSocket for real-time messaging**
   - Messages page exists and calls API but no real-time push

---

## What Is Real vs Mock

| Feature | Status | Notes |
|---------|--------|-------|
| Auth / JWT login | ✅ REAL | All portals call `/auth/login` with token refresh |
| Patient CRUD | ✅ REAL | Full API client in therapist app |
| Sessions CRUD | ✅ REAL | Full API client in therapist app |
| Billing plans | ✅ REAL | Web pricing page fetches `/billing/plans` |
| Analytics dashboards | ⚠️ PARTIAL | API exists; admin UI has fallback mock stats |
| AI note generation | ✅ REAL | Backend calls OpenAI GPT-4o |
| AI copilot | ✅ REAL | Backend endpoint wired; frontend UI exists |
| Real-time WebSocket | ❌ MISSING | Backend gateway ready; no frontend client |
| Registration flow | ❌ MISSING | Backend ready; no frontend form |
| HIPAA audit log | ❌ MISSING | Schema exists; no backend writes |
| Daily.co video | ❌ MISSING | Config present; no session room integration |
| Radar matching | ✅ REAL | Backend complete; patient can request |

---

## Key File Locations

| File | Purpose |
|------|---------|
| `backend/src/main.ts` | Entry point, port 4000, global guards, Swagger |
| `backend/src/app.module.ts` | All 17 modules imported, global JWT guard |
| `backend/src/database/database.service.ts` | `query()`, `queryOne()`, `transaction()` |
| `backend/src/modules/auth/guards/jwt-auth.guard.ts` | JWT guard, @Public() support |
| `backend/src/modules/auth/guards/roles.guard.ts` | Role hierarchy enforcement |
| `packages/types/src/index.ts` | All shared TypeScript types (~1,860 lines) |
| `apps/*/lib/api.ts` | Per-app API clients with token refresh |
| `apps/*/lib/store.ts` | Zustand auth + UI stores |
| `migrations/` | 001–015 SQL files, run in order |
| `pnpm-lock.yaml` | MUST stay committed — Vercel reads lockfileVersion |
| `.npmrc` | `shamefully-hoist=true` — MUST stay committed |

---

## Coding Patterns

### Admin Page Pattern
```tsx
'use client';
import { useState, useEffect } from 'react';
import { adminAPI } from '@/lib/api';
// 1. Interfaces at top
// 2. useEffect → fetch from adminAPI
// 3. Stat cards (4 across top)
// 4. Filter bar (search + selects)
// 5. Table/list with pagination
```

### Backend Service Pattern
```typescript
// All services receive orgId from req.user.organization_id
// All queries use: this.db.buildOrgFilter(orgId, 'table_alias')
// All pagination uses: this.db.buildPaginationClause(limit, cursor, orderBy)
// Transactions: await this.db.transaction(async (client) => { ... })
```

### DTO Pattern (NestJS)
```typescript
// 1. Enums at top (re-export from @24therapy/types if shared)
// 2. Query DTOs (GET params)
// 3. Create DTOs (POST body, @IsString, @IsEnum, @ApiProperty)
// 4. Update DTOs (same fields, all @IsOptional)
```

### Next.js 15 Dynamic Routes
```tsx
// Server component:
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
// Client component: use useParams() hook
```

---

## Deployment Targets

| Service | Platform | Config File |
|---------|----------|-------------|
| `backend` | Railway | `railway.json` |
| `apps/web` | Vercel | `apps/web/vercel.json` |
| `apps/therapist` | Vercel | `apps/therapist/vercel.json` |
| `apps/patient` | Vercel | `apps/patient/vercel.json` |
| `apps/admin` | Vercel | `apps/admin/vercel.json` |

---

## Commit History (Recent)

| Hash | Message |
|------|---------|
| `f638a30` | Change restartPolicyMaxRetries from 0 to 3 |
| `1ad07c4` | docs(claude): update session state — session 6 complete |
| `dc119f1` | fix(deploy): improve Railway startup — better missing-env error |
| `bc6a113` | feat: Phase 2-9 complete — DI fix, animations, integrations audit |
| `b087c47` | fix: eliminate all localhost/hardcoded-domain refs |
| `f66ba28` | fix: backend TypeScript zero-error build |
| `7150495` | fix(deploy): resolve all Vercel build failures |

---

## Priority Work Queue (Next Engineer)

### P0 — Blockers for Production Launch
- [ ] Fix 4 schema/code mismatches (billing columns, therapist_specializations, accepting_new_patients, patient_consents)
- [ ] Fix admin pricing page DEV_TOKEN → real auth token
- [ ] Build registration/signup pages (backend ready, frontend missing)
- [ ] Implement HIPAA phi_access_log writes on all PHI queries

### P1 — Core Feature Completion
- [ ] Frontend WebSocket client (Socket.io) for real-time copilot + notifications
- [ ] Daily.co video integration in session room (`/sessions/[id]/room`)
- [ ] Token refresh edge case: handle concurrent refresh requests (queue mechanism partially done)

### P2 — Quality & Compliance
- [ ] Tighten TypeScript: set `noImplicitAny: true` in backend tsconfig
- [ ] Add `@ApiResponse` decorators to all controllers for Swagger completeness
- [ ] Write radar + marketplace module DTOs (both marked ⚠️ Pending)
- [ ] E2E tests for auth flows (Playwright recommended)

### P3 — Nice to Have
- [ ] `/press`, `/status`, `/gdpr` marketing pages
- [ ] Dockerfiles per app (Next.js multi-stage)
- [ ] Prometheus + Grafana dashboards (infra/ scaffolded)
- [ ] Move CI back to `.github/workflows/` when GitHub App has workflows permission
