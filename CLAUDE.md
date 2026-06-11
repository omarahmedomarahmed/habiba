# CLAUDE.md — 24Therapy Mental Health OS — AI Session State

> Read this file at the START of every session. Update it at the END of every session after each commit.
> Do NOT trust any other .md file for current state — they may be outdated.

---

## Project Identity

| Field | Value |
|-------|-------|
| **Project** | 24Therapy Mental Health OS |
| **Repo** | https://github.com/omarahmedomarahmed/habiba |
| **Dev Branch** | `claude/zealous-gauss-j9boso` |
| **Stack** | Next.js 15 · NestJS 10 · PostgreSQL + pgvector · Redis · TypeScript |
| **Monorepo** | Turborepo + pnpm 9.15.4 workspaces |
| **Last Updated** | 2026-06-11 (session 11 — P5–P9 complete, platform production-ready) |

---

## Build Status (Verified 2026-06-11)

| Package | Build | Routes |
|---------|-------|--------|
| `@24therapy/api` | ✅ PASS | 17 modules, ~80 endpoints |
| `@24therapy/web` | ✅ PASS | 40+ routes |
| `@24therapy/therapist` | ✅ PASS | 35+ routes |
| `@24therapy/patient` | ✅ PASS | 18 routes |
| `@24therapy/admin` | ✅ PASS | 18 routes |

> **Build note**: All apps use `next/font` (no Google Fonts external fetch). `output: 'standalone'` on all 4 Next.js apps.

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
scripts/           → migrate.js, seed.js
ops/               → DEPLOYMENT.md, RUNBOOK.md
docs/              → HIPAA_CHECKLIST.md
```

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
| Daily.co video | ✅ REAL | Session room iframe from video_room_url |
| Patient messages | ✅ REAL | API calls + real-time via Socket.io new_message events |
| Radar matching | ✅ REAL | Backend complete; patient can request |
| Proactive AI companion | ✅ REAL | 5 cron-scheduled message types in ai-companion.service.ts |

---

## Security Invariants (NEVER regress)

1. **No PHI in logs** — no transcript/message content in console/logger calls.
2. **Crisis patient copy** — patients receive ONLY `crisis_support` event with supportive text. Never `crisis_alert`, never risk level, never indicators.
3. **Production boot guard** — `validateEnv()` throws on missing `DATABASE_URL`, `OPENAI_API_KEY`, `CORS_ORIGINS`, or weak/short `JWT_SECRET`/`COOKIE_SECRET`.
4. **No CORS wildcard** — `buildCorsOriginFn()` uses exact origin list in production.
5. **Redis is optional** — `REDIS_URL` not required; do not add Redis as a hard dependency.

---

## Key File Locations

| File | Purpose |
|------|---------|
| `backend/src/main.ts` | Entry point, port 4000, global guards, Swagger |
| `backend/src/app.module.ts` | All 17 modules imported, global JWT guard |
| `backend/src/config/env.validation.ts` | Production boot guard — validates required env vars |
| `backend/src/config/cors.ts` | `buildCorsOriginFn()` — no wildcard CORS |
| `backend/src/database/database.service.ts` | `query()`, `queryOne()`, `transaction()` |
| `backend/src/modules/crisis/crisis.service.ts` | Life-safety crisis pipeline |
| `backend/jest.config.js` | Jest config for ts-jest |
| `apps/*/lib/env.ts` | `getApiUrl()` / `getBaseUrl()` — centralized env helpers |
| `apps/*/lib/api.ts` | Per-app API clients with token refresh |
| `apps/*/lib/store.ts` | Zustand auth + UI stores (sets `tt_auth` cookie) |
| `apps/*/middleware.ts` | Edge auth redirect using `tt_auth=1` cookie |
| `migrations/` | 001–015 SQL files, run in order |
| `scripts/migrate.js` | Migration runner (pg_advisory_lock, checksums, --dry-run) |
| `scripts/seed.js` | Idempotent org+super-admin seeder (SEED_* env vars) |
| `ops/DEPLOYMENT.md` | Deploy guide for Railway + Vercel |
| `ops/RUNBOOK.md` | Incident runbook, crisis alert debugging, SQL snippets |
| `docs/HIPAA_CHECKLIST.md` | HIPAA safeguards checklist |
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

### Test Pattern (NestJS unit tests)
```typescript
// 1. makeDb() helper returns jest.Mocked<DatabaseService> with per-test overrides
// 2. Build module with Test.createTestingModule + useValue mocks
// 3. No real DB, no network — pure unit tests
// 4. Run with: /home/user/habiba/node_modules/.bin/jest --no-coverage
```

---

## Deployment Targets

| Service | Platform | Config File |
|---------|----------|-------------|
| `backend` | Railway | `railway.json` (preDeployCommand: migrate) |
| `apps/web` | Vercel | `apps/web/vercel.json` |
| `apps/therapist` | Vercel | `apps/therapist/vercel.json` |
| `apps/patient` | Vercel | `apps/patient/vercel.json` |
| `apps/admin` | Vercel | `apps/admin/vercel.json` |

---

## Commit History (Session 11)

| Hash | Message |
|------|---------|
| `7289111` | feat(P8): backend test suite — 46 tests across 5 suites |
| `7000a41` | chore(P7): delete stale root-level SQL files (superseded by migrations/) |
| `ae21db1` | feat(P7): deploy machinery — migrate runner, seed, standalone output, next/font |
| `9dc6546` | feat(P6): eradicate mock PHI — real API + empty states in all portals |
| `70e5423` | feat(P5+D7): security hardening — env validation, CORS, cookie middleware |

---

## Priority Work Queue (Next Engineer)

### All P0–P3 complete ✅

### Remaining (true stretch goals)
- [ ] E2E Playwright tests (auth flows, crisis flow)
- [ ] Prometheus/Grafana wiring (`infra/` scaffolded)
- [ ] Admin export buttons (CSV download)
- [ ] /blog CMS connection
- [ ] Formal BAAs before accepting real PHI (see `docs/HIPAA_CHECKLIST.md`)
