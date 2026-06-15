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
| **Last Updated** | 2026-06-15 (session 24 — admin approval, lock overlay UX, bank details, public profiles, Add-to-Calendar, patient join status WS) |

---

## Build Status (Verified 2026-06-13)

| Package | Build | Routes |
|---------|-------|--------|
| `@24therapy/api` | ✅ PASS | 24 modules, ~100 endpoints |
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
migrations/        → 16 ordered SQL files (001–016, consolidated)
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
| Patient journal | ✅ REAL | Full CRUD: list from `journalAPI.list()`, create/edit/delete wired; no more mock entries |
| Patient assessments | ✅ REAL | List from `assessmentsAPI.list()` (patient-scoped); submit wired; no mock ASSESSMENTS array |
| Patient homework | ✅ REAL | Mark Complete + Start buttons both wired to PATCH /workflows/tasks/:id/* |
| Patient progress | ✅ REAL | Loads from assessmentsAPI.list() + patientAPI.me() goals + moodTrend(30); no mock arrays |
| Patient mood | ✅ REAL | History from `patientAPI.moodTrend(30)`; weekly avgs computed; no MOOD_ENTRIES/AI_INSIGHTS mock |
| Patient dashboard | ✅ REAL | NEW home page: greeting, therapist card, upcoming session, mood stats from real APIs |
| Mobile bottom nav | ✅ REAL | md:hidden BottomNav in patient/therapist/admin portals; 5 tabs + More drawer; sidebars hidden on mobile |
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
| `migrations/` | 001–016 consolidated SQL files — complete schema from scratch, run in order |
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

## Commit History (Session 19)

| Hash | Message |
|------|---------|
| `74a93bc` | fix(railway): single-stage Dockerfile — eliminates cross-stage COPY failures |
| `3ed21d2` | fix(deploy): invoke tsc directly — bypass pnpm filter silent-exit bug |
| `56b6aef` | fix(deploy): correct compiled output path — dist/backend/src/main.js |
| `c25b9fe` | fix(billing): getPlans returns [] instead of 500 on DB error |
| `e70183e` | feat(migrations): consolidated schema files 001-010 (WIP) |
| `bb58251` | feat(migrations): complete consolidated schema 009-016 + seed data |

### Session 19 changes
- Railway deploy fully fixed: single-stage Dockerfile, direct TSC invocation, `rootDir: ".."` in tsconfig
- All 28 old migration files replaced with 16 clean consolidated files (001-016)
- `016_seed_data.sql`: all default data in one idempotent file
- SETUP_GUIDE.md: updated to 16-file migration table, removed manual extension setup step
- ops/DEPLOYMENT.md: updated migration reference

---

## Commit History (Session 18)

| Hash | Message |
|------|---------|
| `a1e5cae` | feat(phase-1): foundation hardening — migrations 022-024, 100 tests passing |
| `95c21bd` | feat(phase-2): API wiring — contact module, my-reports endpoint, onboarding + intake |
| `a7fbf53` | feat(phase-2e): feature flags DB + API, analytics URL fix |
| `3f1b603` | feat(phase-3a+4d): Sentry error monitoring + incident response docs |
| `f4f1611` | feat(phase-3e): AES-256-GCM message content encryption |
| `c84e0ad` | feat(phase-4fg): break-glass access + patient right-of-access endpoints |
| `4c849f2` | feat(phase-4e): data retention cron + policy doc |

## Commit History (Session 16)

| Hash | Message |
|------|---------|
| `c3776ad` | feat(session-16): patient portal production-readiness + mobile nav |

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

### Session 18 additions (complete)

**Phase 1 — Foundation Hardening**
- [x] migration 022: 8 missing FK indexes (organizations, messages, conversations, patient_medications, invoices, sessions, baa_records, assessment_results)
- [x] migration 023: rename pricing_audit_log.action → change_type (fixes silent INSERT failure from migrations 020+021)
- [x] migration 024: release_stale_notification_locks() + EVERY_10_MINUTES cron in notifications.service.ts
- [x] 54 new unit tests across 6 modules: billing, sessions, treatment-plans, referrals, reports, workflows (100 total / 11 suites)

**Phase 2 — Feature Completion**
- [x] GET /sessions/my-reports (patient role): signed session reports joined with sessions+therapists; placed before :id route
- [x] ContactModule (POST /contact, @Public()): MailService integration, class-validator DTOs; registered in app.module.ts
- [x] apps/web/contact/page.tsx: handleSubmit POSTs to /contact with loading/error states
- [x] apps/therapist/onboarding/page.tsx: goToNext() on ai_preferences→complete calls therapistsAPI.updateProfile() + updateAvailability()
- [x] apps/therapist/patients/intake/page.tsx: handleEnroll() calls patientsAPI.create() replacing 2500ms fake delay
- [x] migration 025: feature_flags table with 8 seeded flags; admin feature-flags page fixed (response unwrapping, PATCH endpoint)
- [x] admin lib/api.ts: analyticsOverview URL fixed (/analytics/platform/dashboard)

**Phase 3 — Infrastructure**
- [x] @sentry/node in backend; @sentry/nextjs in all 4 Next.js apps; sentry.client/server.config.ts + global-error.tsx in each
- [x] Sentry.init() in main.ts gated on SENTRY_DSN; beforeSend strips request.data (PHI protection)
- [x] scripts/backup-verify.js: monthly restore test comparing prod vs staging row counts for 7 tables
- [x] migration 027: encrypted BOOLEAN on messages table + partial index
- [x] messages.service.ts: AES-256-GCM encrypt on write, decrypt on read (MESSAGE_ENCRYPTION_KEY env); legacy plaintext rows transparent
- [x] scripts/encrypt-messages.js: one-time backfill for existing rows (batch 500, --dry-run flag)

**Phase 4 — HIPAA Compliance**
- [x] migration 028: break_glass_access table (HIPAA §164.312(a)(2)(ii))
- [x] POST /admin/break-glass + GET /admin/break-glass: emergency access logging
- [x] GET /patients/me/export: structured PHI export (HIPAA §164.524)
- [x] DELETE /patients/me: initiates erasure request workflow
- [x] DataLifecycleModule: 3 cron jobs (phi_access_log purge >6yr, erasure hard-delete >30d, monthly report)
- [x] ops/INCIDENT_RESPONSE.md: P0-P3 protocol, 5-phase response, HIPAA breach notification timeline
- [x] ops/BREACH_NOTIFICATION_TEMPLATE.md: pre-drafted letter, HHS OCR checklist, media template
- [x] docs/DATA_RETENTION_POLICY.md: retention schedule, automated vs manual procedures

### Session 16 additions (complete)
- [x] Patient dashboard home page (NEW): greeting, therapist name from patientAPI.me(), upcoming session, mood stats, quick-access grid
- [x] progress/page.tsx: all mock arrays removed; wired to real assessmentsAPI + patientAPI.me() goals + moodTrend
- [x] journal/page.tsx: JOURNAL_ENTRIES removed; live list from journalAPI.list(); Edit + Delete implemented
- [x] mood/page.tsx: MOOD_ENTRIES/WEEKLY_AVERAGES/AI_INSIGHTS removed; patientAPI.moodTrend(30); computed stats
- [x] assessments/page.tsx: ASSESSMENTS mock removed; assessmentsAPI.list() + patientAPI.me() for therapist name
- [x] homework/page.tsx: Start button wired to PATCH /workflows/tasks/:id/start
- [x] messages/page.tsx: phone/video buttons marked disabled with tooltip
- [x] Patient BottomNav: 5-tab mobile nav (Home/Sessions/Messages/Progress/More) + slide-up More drawer
- [x] Therapist BottomNav: 5-tab (Dashboard/Patients/Sessions/Messages/More); sidebar hidden on mobile
- [x] Admin BottomNav: dark navy 5-tab (Dashboard/Users/Orgs/Safety/More); sidebar hidden on mobile
- [x] All 3 portal layouts: pb-20 md:pb-0 on main, BottomNav imported and rendered
- [x] All 4 builds pass: patient + therapist + admin portals + NestJS API

### Remaining (true stretch goals)
- [ ] **Resolve GitHub billing** — unblock CI runners
- [ ] Prometheus/Grafana wiring (`infra/` scaffolded)
- [ ] /blog CMS connection
- [ ] Onboarding wizard step 7: remove card-required implication
- [ ] **Must before first real patient**: Sign BAAs (Railway, Vercel, OpenAI, Resend, Daily.co)
- [ ] **Must before first real patient**: Penetration test (CSP headers, external firm)
- [ ] **Must before first real patient**: Designate Security Officer (HIPAA admin safeguard)
- [ ] Replace admin analytics hardcoded charts (MRR_DATA, TOP_ORGS, AI_COSTS) with real endpoints
- [ ] Redis Bull queue for email + notifications (replace fire-and-forget)
- [ ] nestjs-pino structured logging + log drain (Logtail/Axiom)
- [ ] Session recording S3/R2 archive (migration 026, 7-year HIPAA retention)

### Session 24 additions (complete)
- [x] P0: backend therapist approval/reject/submit-review endpoints (PATCH :id/verify admin-guarded, PATCH me/submit-review, PATCH me/bank-details); sendTherapistApproved/Rejected emails via Resend
- [x] P0: admin api.ts fixed 'verified' → 'approved'; store.ts adds 'under_review' to verificationStatus union type
- [x] P1: admin therapists page — approved status badges, rejection modal with textarea, verification_status filter dropdown
- [x] P2: layout.tsx removes RESTRICTED_PATHS redirect; LockedPageOverlay.tsx created; applied to 7 restricted pages; dashboard application status card + submit-for-review; onboarding submit CTA
- [x] P3: settings profile tab — display_name, bio, specialty, languages, location, years_experience all editable; tag inputs for specializations/languages; slug auto-loads; save payload includes all fields
- [x] P4 + P10: migration 032 (bank_details JSONB + payout_method on therapists; method/notes/processed_at/processed_by on payout_requests); admin payouts page; GET/PATCH /billing/admin/payout-requests endpoints; admin sidebar link
- [x] R1: Settings wallet tab — ACH/Wire/SWIFT bank details form; save via therapistsAPI.updateBankDetails(); payout modal shows saved bank name + masked account
- [x] R2: find-therapist page — 3-col grid (lg:grid-cols-3), language filter, mock THERAPISTS data removed, real empty state, View Profile → /therapists/[id]
- [x] R2: /therapists/[id] — new Facebook-style public profile page (bio, specialties, languages, credentials, price, Book a Session CTA)
- [x] R2: GET /marketplace/therapist/:id — new public endpoint in marketplace.controller + marketplace.service
- [x] R3: booking confirmed page — Add to Google Calendar button with pre-filled event (date/time/join link)
- [x] R4: sessions.service.ts joinByToken() emits session.patient_joined via EventEmitter2; events.gateway.ts @OnEvent forwards as patient_join_status to therapist user socket; room page shows real-time status badge

### Session 23 additions (complete)
- [x] fix(build): wrap useSearchParams in Suspense in join/[token]/page.tsx, t/[slug]/confirmed/page.tsx, settings/page.tsx — resolves Vercel "build worker exited with code 1"
- [x] billing.service.ts _confirmBookingSession(): create Daily.co video room before INSERT so video_room_url is never NULL; fetch therapist email and fire sendTherapistBookingAlert()
- [x] mail.service.ts: add sendTherapistBookingAlert() with HTML template (patient name, date/time, earnings)
- [x] apps/web/app/chat/page.tsx: notFound() — route hidden from MVP, file preserved
- [x] apps/web/components/layout/navbar.tsx: remove "Try AI Free" → /chat buttons (desktop + mobile)
- [x] apps/web/components/sections/hero.tsx: replace interactive chat widget with static AI Scribe demo card (transcript + SOAP + copilot insight); hero copy now therapist-focused
- [x] apps/web/components/sections/cta.tsx: remove "Try AI Free" button + unused MessageSquare import
- [x] apps/web/app/find-therapist/page.tsx: Book Now → /t/${public_slug} with /signup fallback; public_slug field added to Therapist interface and API mapping
- [x] marketplace.service.ts: augment search results with therapists.public_slug via secondary query (returned as public_slug on each result)
- [x] settings/page.tsx: add "Availability" tab with weekly schedule UI (day toggles, time pickers, save via PUT /therapists/me/availability) + timezone selector
- [x] sessions.service.ts findAll() + findOne(): COALESCE patient_name from patient row → patient_name_guest → patient_email → 'Guest Patient' so Calendly bookings show meaningful names

### Session 22 additions (complete)
- [x] migration 031: session price gate columns, offline bill tracking, therapist_wallet, wallet_transactions, payout_requests, therapist_booking_offerings, booking_sessions tables; fixes session_fees alias columns + organizations.stripe_customer_id
- [x] BookingModule (booking.service.ts + booking.controller.ts + booking.module.ts): getPublicProfile, getAvailableSlots, createBookingCheckout, getBookingConfirmation, getMyOfferings/updateOfferings/getUpcomingBookings
- [x] billing.service.ts: createPatientSessionCheckout, createOfflineBillCheckout, createBookingCheckout, markOfflineSessionPaid, _creditTherapistWallet (idempotent, 85/15 split), getWalletSummary, requestPayout, useWalletForSubscription, _confirmBookingSession; webhook branches for patient_session_payment/offline_session_bill/patient_booking
- [x] billing.controller.ts: @Public patient-session/checkout + wallet + payout-request + pay-subscription endpoints
- [x] sessions.service.ts: session_price_cents in create(), getJoinInfo() with payment gate fields, initiatePatientPayment, sendOfflineBill, markOfflineCashPaid
- [x] sessions.controller.ts: POST join/:token/pay (@Public), POST :id/offline-bill/send, POST :id/offline-bill/mark-paid
- [x] therapists.service.ts: updatePublicSlug() with regex validation + 409 on duplicate
- [x] therapists.controller.ts: PATCH me/public-slug
- [x] mail.service.ts: sendBookingConfirmation, sendOfflinePaymentLink, sendPayoutRequestReceived
- [x] app.module.ts: BookingModule imported
- [x] middleware.ts: /t added to PUBLIC_PATHS
- [x] join/[token]/page.tsx: complete rewrite with payment gate phase-based state machine (loading → error → payment → mic → form → joining → session → waiting); therapist avatar + price display; ?paid=1 Stripe return handling
- [x] sessions/new/page.tsx: optional session price field for both online and offline modes; passes session_price_cents to create()
- [x] sessions/[id]/room/page.tsx: offline bill modal after in_person+priced session end (3 options: send Stripe link, mark cash paid, skip)
- [x] app/t/[slug]/page.tsx: public Calendly-like booking page (5-step: profile → duration → calendar → slots → form+pay); mobile-first dark-on-light
- [x] app/t/[slug]/confirmed/page.tsx: booking confirmation page with join link + copy button
- [x] settings/page.tsx: Booking Link section (slug input + preview + copy), Session Offerings (30/60min toggle+price), Wallet (balance + transactions + payout modal)
- [x] dashboard/page.tsx: mobile quick-action grid (New Session + Add Patient), Revenue stat hidden on mobile
- [x] sidebar.tsx: Booking Link added to ADVANCED section
- [x] BottomNav.tsx: Booking Link added to More drawer
- [x] lib/api.ts: bookingAPI, sessionsAPI.initiatePatientPayment/sendOfflineBill/markOfflineCashPaid, therapistsAPI.updateSlug, billingAPI.wallet/requestPayout/paySubscription

### Session 21 additions (complete)
- [x] migration 030: patient_id nullable in sessions/transcripts/transcript_segments/ai_session_notes; add patient_email, patient_name_guest, follow_up_recommendation, ai_insights, auto_generate_note to sessions
- [x] sessions.service: findOrCreateGuestPatient() private helper — auto-creates guest patient for offline sessions
- [x] sessions.service: create() handles modality='in_person', patient_name, patient_email, auto_start flag
- [x] sessions.service: updateStatus() fixed — null patient_id in transcript creation; guard timeline event; trigger autoGenerateSessionOutput on complete
- [x] sessions.service: shareReportWithPatient() — HIPAA-logged report sharing with email
- [x] sessions.controller: POST /sessions/:id/share-report
- [x] ai.service: autoGenerateSessionOutput() — full SOAP + key talking points + clinical observations + diagnosis + recommendations + follow_up on session end
- [x] ai.service: sessionChat() — session-specific AI chat with credit gating
- [x] ai.service: assistantChat() enhanced with session_id/patient_id context params
- [x] ai.service: null patient_id fixes — generateSOAPNote, generateSummary, detectRisk (LEFT JOIN), extractMemoriesAsync guard
- [x] ai.controller: POST /ai/sessions/:id/chat; assistantChat accepts session_id/patient_id
- [x] mail.service: sendSessionReport() — formatted patient report email via Resend
- [x] sessions/new/page.tsx: Online/Offline mode toggle — in-person starts immediately, auto-creates guest patient
- [x] notes/page.tsx: Fixed broken link line 279 → /notes/${note.id}
- [x] dashboard/page.tsx: Mobile FAB (fixed bottom-right, md:hidden) → /sessions/new
- [x] ai-workspace/page.tsx: Session/patient context pickers + uses assistantChat() with context
- [x] lib/api.ts: sessionsAPI.shareReport(), aiAPI.sessionChat(), aiAPI.assistantChat() with session_id/patient_id
- [x] COMPETITIVE_INTELLIGENCE.md, AUDIT_REPORT.md, DEV_HANDOVER.md: DELETED (outdated)
- [x] docs/PRODUCT_MVP.md: CREATED — definitive go-to-market product specification
- [x] CLAUDE.md: Updated with session 21 history

### Session 20 additions (complete)
- [x] Backend 500 fix: therapists.service tpa.deleted_at → tpa.ended_at
- [x] Backend 500 fix: sessions.service getTherapistUsage inline SQL (removed therapist_monthly_session_counts)
- [x] Backend 500 fix: billing.service getBillingSummary queries session_charges directly
- [x] Frontend 404 fix: aiAPI.aiChat → /ai/assistant/chat; radarAPI stats/requests → correct URLs
- [x] migration 029: join_token UUID + started_by_patient_at on sessions table
- [x] sessions.service: create() emits join_token; patient_id optional; LEFT JOIN patients
- [x] sessions.controller: GET/POST /sessions/join/:token (@Public), POST /sessions/:id/invite
- [x] mail.service: sendSessionInvite() for no-account-required email invites
- [x] sessions/new/page: Google Meet-style (create → join link → email chip invite)
- [x] app/join/[token]/page: public patient join page (mic perms, name/email, Daily.co iframe)
- [x] middleware: /join added to public paths
- [x] api.ts: sessionsAPI.invite(), joinInfo(), joinByToken() added
- [x] session room: share button copies join link; AI pause/resume (Brain button); OFF RECORD indicator
- [x] store: verificationStatus in UIStore
- [x] layout: verification_status check → redirect restricted paths; PendingApprovalBanner
- [x] dashboard: pending approval card with profile/billing CTAs
- [x] billing page: updated plan bullets (PAYG/Starter/Unlimited/Practice consistent matrix)
- [x] web pricing page: PLAN_FEATURES_MAP updated to match consistent feature matrix

<!-- Reviewed: 2026-06-14 — 24Therapy audit -->
