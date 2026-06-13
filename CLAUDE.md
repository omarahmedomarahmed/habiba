# CLAUDE.md — 24Therapy Mental Health OS — AI Session State

> Read this file at the START of every session. Update it at the END of every session after each commit.
> Do NOT trust any other .md file for current state — they may be outdated.

---

## Project Identity

| Field | Value |
|-------|-------|
| **Project** | 24Therapy Mental Health OS |
| **Repo** | https://github.com/omarahmedomarahmed/habiba |
| **Dev Branch** | `claude/magical-cori-9vbw6k` |
| **Stack** | Next.js 15 · NestJS 10 · PostgreSQL + pgvector · Redis · TypeScript |
| **Monorepo** | Turborepo + pnpm 9.15.4 workspaces |
| **Last Updated** | 2026-06-13 (session 15 — portal production-readiness + chat/pricing revamp complete) |

---

## Build Status (Verified 2026-06-13)

| Package | Build | Routes |
|---------|-------|--------|
| `@24therapy/api` | ✅ PASS | 20 modules, ~95 endpoints |
| `@24therapy/web` | ✅ PASS | 40+ routes |
| `@24therapy/therapist` | ✅ PASS | 40+ routes |
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
| Memory page | ✅ REAL | Loads from `patientsAPI.memories()` per selected patient; hardcoded seeds removed |
| Calendar | ✅ REAL | Loads from `sessionsAPI.list()` by date range; New Session → /sessions/new?date= |
| Patient mood tracker | ✅ REAL | Saves to `patientAPI.addMoodEntry()` |
| Patient journal | ✅ REAL | Saves to `journalAPI.create()` (`/notes?note_type=journal`) |
| Patient assessments | ✅ REAL | Submits answers to `assessmentsAPI.submit()`; /assessments/new assign flow wired |
| Patient homework | ✅ REAL | Mark Complete calls `PATCH /workflows/tasks/:id/complete` |
| Patient progress | ✅ REAL | Loads from assessmentsAPI + patientAPI.me() goals |
| Find therapist | ✅ REAL | Fetches from `GET /marketplace/search` with static fallback |
| Org suspension | ✅ REAL | Admin `suspendOrg()`/`activateOrg()` wired to backend |
| User impersonation | ✅ REAL | `impersonateUser()` opens portal with token |
| Daily.co video | ✅ REAL | Session room iframe from video_room_url |
| Patient messages | ✅ REAL | API calls + real-time via Socket.io new_message events; + patient picker modal |
| Radar matching | ✅ REAL | Backend complete; patient can request |
| Proactive AI companion | ✅ REAL | 5 cron-scheduled message types in ai-companion.service.ts |
| Treatment plans | ✅ REAL | Full CRUD via `GET/POST/PATCH /treatment-plans` + goals sub-resource |
| Referrals | ✅ REAL | Full CRUD via `GET/POST/PATCH /referrals`, POST /:id/send |
| Reports | ✅ REAL | Generate/sign/send via `GET/POST /reports` on session_reports table |
| Audit logs | ✅ REAL | `GET /organizations/me/audit-logs` queries phi_access_log; portal page wired |
| Clinical tools | ✅ REAL | /clinical-tools/[slug] runner with live PHQ-9/GAD-7 questionnaires |
| Team page | ✅ REAL | Loads from `therapistsAPI.list()` |
| AI workspace | ✅ REAL | Wired to `POST /ai/assistant/chat` with mode field |
| Guest chat (/chat) | ✅ REAL | Dark UI, starter templates, containerRef scroll (no page scroll) |
| Pricing page | ✅ REAL | Per-plan hero metrics, ✓/✗ feature lists, savings strip; price field normalized |

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
| `backend/src/app.module.ts` | All 20 modules imported, global JWT guard |
| `backend/src/modules/ai/prompts.ts` | Centralized AI prompts — GUEST_CHAT_PROMPT, THERAPIST_ASSISTANT_PROMPT, WORKSPACE_MODE_PROMPTS |
| `backend/src/modules/treatment-plans/` | Full treatment plan CRUD + goals sub-resource |
| `backend/src/modules/referrals/` | Referral lifecycle (draft→sent→accepted) on `referrals` table |
| `backend/src/modules/reports/` | Session report generate/sign/send on `session_reports` table |
| `backend/src/config/env.validation.ts` | Production boot guard — validates required env vars |
| `backend/src/config/cors.ts` | `buildCorsOriginFn()` — no wildcard CORS |
| `backend/src/database/database.service.ts` | `query()`, `queryOne()`, `transaction()` |
| `backend/src/modules/crisis/crisis.service.ts` | Life-safety crisis pipeline |
| `backend/jest.config.js` | Jest config for ts-jest |
| `apps/*/lib/env.ts` | `getApiUrl()` / `getBaseUrl()` — centralized env helpers |
| `apps/*/lib/api.ts` | Per-app API clients with token refresh |
| `apps/*/lib/store.ts` | Zustand auth + UI stores (sets `tt_auth` cookie) |
| `apps/*/middleware.ts` | Edge auth redirect using `tt_auth=1` cookie |
| `migrations/` | 001–019 SQL files, run in order |
| `apps/web/components/product/ProductPageLayout.tsx` | Reusable product page template (hero, stats, features grid, CTA) |
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

## Commit History (Session 15)

| Hash | Message |
|------|---------|
| `1545039` | fix(P0): therapist identity + route order + API client paths |
| `629c957` | feat(P1): real session lifecycle — persisted start/end, billing surfacing, session detail page |
| `3badacc` | feat(P2): notes backend module + note creation flow |
| `3af1f26` | fix(P3): messages/memory/ai-workspace no longer render behind the sidebar |
| `1673fb7` | feat(PW): workflow/referrals tables + real homework pipeline |
| `ffbc961` | feat(P4-P7): dead buttons wired, new backend modules, chat/pricing revamp |
| `0ed38db` | feat(P4-P7 cont): messages new-convo modal, settings cancel sub, pricing revamp, treatment-plans/new |
| `8698ce0` | feat(P4-P7): audit-logs wired to real endpoint + pricing plan keys |
| `09eee01` | fix(P4): ai-workspace endpoint and layout cleanup |
| `be091c4` | fix(P4): calendar dead modal removed + pricing plan display refinements |

## Commit History (Session 14)

| Hash | Message |
|------|---------|
| `87181b8` | feat(P1-P2-P4): monetization engine — migration 020, billing loop, AI assistant |
| `c3da625` | feat(P3-P5): portal billing UX + AI assistant page + marketing restyle |
| `b25c175` | feat(P6-P7): docs article route + trial-language sweep |

## Commit History (Session 13)

| Hash | Message |
|------|---------|
| `a6e8009` | feat(P2): product template + clickable feature cards + 4 new feature pages |
| `8b1380a` | feat(P3): find-therapist 2-col grid + wire Book buttons to signup flow |
| `3e31322` | feat(P4): EHR integration docs pages + /docs in nav & footer |
| `1f4b47c` | feat(P5): chat rebuild — 10-msg limit, workflow chips, context param, dedupe backend |
| `b950123` | feat(P6): 5-tier pricing — Free/Starter/Professional/Practice/Enterprise |
| `d491003` | feat(P7): nav + footer content pass — add 4 new product pages |

## Commit History (Session 12)

| Hash | Message |
|------|---------|
| `5eba215` | fix(ci): switch to pnpm/action-setup@v3, no-frozen-lockfile (CI blocked by billing — see note below) |
| `c2c7c00` | chore: update pnpm-lock.yaml for @playwright/test devDep |
| `81eb8ab` | feat(E2E): Playwright test suite — auth flows + crisis safety assertions |
| `df46c60` | fix: therapist room page syntax error + admin CSV exports + CI workflow |

## Commit History (Session 11)

| Hash | Message |
|------|---------|
| `8c83aa4` | feat(P9): launch docs — deployment guide, runbook, HIPAA checklist, CLAUDE.md |
| `7289111` | feat(P8): backend test suite — 46 tests across 5 suites |
| `7000a41` | chore(P7): delete stale root-level SQL files (superseded by migrations/) |
| `ae21db1` | feat(P7): deploy machinery — migrate runner, seed, standalone output, next/font |
| `9dc6546` | feat(P6): eradicate mock PHI — real API + empty states in all portals |
| `70e5423` | feat(P5+D7): security hardening — env validation, CORS, cookie middleware |

---

## GitHub Actions CI — Known Issue

**All CI jobs currently fail instantly** with: _"The job was not started because your account is locked due to a billing issue."_

This is a GitHub account billing problem — **not a code or workflow issue**. The `.github/workflows/ci.yml` YAML is syntactically correct and the workflow logic is sound. Once billing is resolved, CI will run normally.

**Effective build gate in the meantime: Vercel** — all 4 Next.js preview deployments are ✅ Ready on every push.

---

## Priority Work Queue (Next Engineer)

### All P0–P9 complete ✅
### All marketing revamp P1–P7 complete ✅ (Session 13)
### Monetization engine + content sweep complete ✅ (Session 14)

### Session 14 additions (complete)
- [x] migration 020: billing engine tables (session_charges, therapist_session_quota, ai_assistant_credits), plan prices locked, free_trial deactivated
- [x] billing.service.ts: PAYG loop, Starter rollover, onSessionCompleted, reconciler cron, Stripe checkout, admin mark-paid
- [x] sessions.service.ts: PAYG pending-bill gate, billing hook on completion (forwardRef circular dep resolved)
- [x] AI assistant: backend (assistantChat, credit gating), therapist portal page (/assistant)
- [x] Therapist portal billing UX: dashboard banner, settings billing+usage tab, sessions/new 402 handling
- [x] app/docs/[slug]/page.tsx: inline markdown renderer serving 6 priority articles
- [x] Trial-language sweep: all "14-Day Free Trial" / "Start Free Trial" → "Get Started Free" / "First Session Free"
- [x] scrollIntoView fix in ai-workspace → containerRef.scrollTop pattern

### Session 15 additions (complete)
- [x] P0: sessions.controller route order fixed, user.therapistId across 6 controllers, API client paths corrected
- [x] P1: session room start/end persisted to DB; billing outcome polling modal; session detail /sessions/:id page
- [x] P2: notes backend module (GET/POST/PATCH/DELETE/finalize); notes/new 3-step creation page
- [x] P3: messages/memory/ai-workspace layout overflow fixed (no more sidebar overlap)
- [x] PW: migration 021 (clinical_workflows, workflow_tasks, referrals tables); homework pipeline end-to-end
- [x] P4 backend: treatment-plans module, referrals module, reports module, audit-logs endpoint
- [x] P4 frontend: clinical-tools buttons wired, /clinical-tools/[slug] runner, /assessments/new, /treatment-plans/new, memory real data, team real data, calendar nav, messages + modal, settings cancel sub
- [x] P5: backend/src/modules/ai/prompts.ts — centralized prompts registry
- [x] P6: /chat dark UI, starter templates, containerRef scroll fix; hero.tsx reply parse fix
- [x] P7: pricing per-plan hero metrics, ✓/✗ feature lists, savings strip, price field normalization

### Remaining (true stretch goals)
- [ ] **Resolve GitHub billing** — unblock CI runners
- [ ] Prometheus/Grafana wiring (`infra/` scaffolded)
- [ ] /blog CMS connection
- [ ] P8 jest test suite updates for new modules (treatment-plans, referrals, reports)
- [ ] Onboarding wizard step 7: remove card-required implication
- [ ] Formal BAAs before accepting real PHI (see `docs/HIPAA_CHECKLIST.md`)
