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
| **Last Updated** | 2026-06-11 (session 9 — all admin pages wired, Daily.co video, proactive AI companion, safety plan, therapist join form) |

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

### MEDIUM — Remaining Items

1. **Patient messages page** — mock chat UI, no real-time WebSocket push yet
2. **Proactive AI companion** (`ai-companion.service.ts`) — designed but not yet built (cron check-ins)
3. **Daily.co video integration** — config present but session room still shows mock video placeholder
4. **Admin compliance/audit logs pages** — pages exist but not wired to `phi_access_log` / `audit_logs` endpoints

### LOW — Polish
5. `/press`, `/status`, `/gdpr` marketing pages missing
6. Dockerfiles per app not yet created
7. E2E tests (Playwright) not yet written

---

## What Is Real vs Mock

| Feature | Status | Notes |
|---------|--------|-------|
| Auth / JWT login | ✅ REAL | All portals call `/auth/login` with token refresh |
| Patient CRUD | ✅ REAL | Full API client in therapist + patient apps |
| Sessions CRUD | ✅ REAL | Full API client in all portals |
| Billing plans | ✅ REAL | Web pricing page fetches `/billing/plans` |
| Analytics dashboards | ✅ REAL | Therapist analytics loads from `/analytics/therapist/dashboard` |
| AI note generation | ✅ REAL | Backend calls OpenAI GPT-4o |
| AI copilot | ✅ REAL | Backend endpoint wired; frontend shows real suggestions |
| Real-time WebSocket | ✅ REAL | Crisis alerts + emotional context via Socket.io |
| Registration flow | ✅ REAL | `apps/web/app/signup/SignupForm.tsx` calls `POST /auth/register` |
| HIPAA audit log | ✅ REAL | `PhiAuditInterceptor` logs all PHI route access to `phi_access_log` |
| Live transcription | ✅ REAL | Browser MediaRecorder → Whisper → session transcript |
| Emotional AI | ✅ REAL | GPT-4o-mini every 5 segments → copilot panel emotional state card |
| Crisis detection | ✅ REAL | Keyword scan → GPT-4o risk → WebSocket crisis modal |
| Memory page | ✅ REAL | Loads from `patientsAPI.memories()` per selected patient |
| Calendar | ✅ REAL | Loads from `sessionsAPI.list()` by date range |
| Patient mood tracker | ✅ REAL | Saves to `patientAPI.addMoodEntry()` |
| Patient journal | ✅ REAL | Saves to `journalAPI.create()` (`/notes?note_type=journal`) |
| Patient assessments | ✅ REAL | Submits answers to `assessmentsAPI.submit()` |
| Patient homework | ✅ REAL | Mark Complete calls `PATCH /workflows/tasks/:id/complete` |
| Patient progress | ✅ REAL | Loads from assessmentsAPI + patientAPI.me() goals |
| Find therapist | ✅ REAL | Fetches from `GET /marketplace/search` with static fallback |
| Org suspension | ✅ REAL | Admin `suspendOrg()`/`activateOrg()` wired to backend |
| User impersonation | ✅ REAL | `impersonateUser()` opens portal with token |
| Daily.co video | ❌ MISSING | Config present; no session room integration |
| Patient messages | ⚠️ PARTIAL | API calls exist; no real-time WebSocket push |
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
| `67eda3c` | feat: wire crisis safety plan persistence and therapist join form |
| `7600530` | feat: wire feature flags, AI governance, support tools, Daily.co video |
| `f444154` | feat: wire admin audit/compliance, patient messages, AI companion |
| `c7997ca` | feat: wire patient progress, homework mark-complete to real API |
| `1675017` | feat: Phase 3 — live audio transcription via Whisper |
| `c7d0c18` | feat: Phase 2b — emotional AI layer end-to-end |
| `03d2f35` | feat: Phase 6-8 — admin god mode, marketplace search, HIPAA PHI audit |
| `577bc72` | feat: wire session prepare, journal, patient settings to real API |
| `08dc04f` | feat: wire notes, memory, patient assessments to real API |
| `6885eee` | feat(therapist): wire analytics, calendar, settings to real API |
| `d19728c` | feat: Phase 1 — crisis system end-to-end |
| `2e3b4c2` | fix: Phase 0 — schema fixes + admin DEV_TOKEN |

---

## Priority Work Queue (Next Engineer)

### P0 — Production Blockers (all resolved ✅)
- [x] Fix 4 schema/code mismatches (migration 016 created)
- [x] Fix admin pricing page DEV_TOKEN → real auth token
- [x] Registration/signup form wired to `POST /auth/register`
- [x] HIPAA `phi_access_log` writes via global `PhiAuditInterceptor`

### P1 — Core Feature Completion (all resolved ✅)
- [x] Daily.co video: session room renders iframe from video_room_url
- [x] Patient messages: real-time via Socket.io new_message events
- [x] Proactive AI companion: 5 cron-scheduled message types
- [x] Admin compliance/audit-log/feature-flags/AI-governance/support-tools all wired
- [x] Crisis safety plan: saves/loads from backend, shares with therapist
- [x] Therapist join form: submits to /auth/register

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
