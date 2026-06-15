# TECHNICAL AUDIT REPORT — 24Therapy Mental Health OS
### Prepared for: Sequoia Capital · General Catalyst · a16z · Accel · Bessemer · Insight Partners
### Audit Date: 2026-06-15
### Methodology: Code-first. Documentation used only for orientation — every claim verified against repository.

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Phase 0 — Repository Forensics](#2-phase-0--repository-forensics)
3. [Phase 1 — System Inventory](#3-phase-1--system-inventory)
4. [Phase 2 — Session History Reconstruction](#4-phase-2--session-history-reconstruction)
5. [Phase 3 — Feature Completion Matrix](#5-phase-3--feature-completion-matrix)
6. [Phase 4 — Frontend Audit](#6-phase-4--frontend-audit)
7. [Phase 5 — Backend Audit](#7-phase-5--backend-audit)
8. [Phase 6 — Database Audit](#8-phase-6--database-audit)
9. [Phase 7 — API Catalog](#9-phase-7--api-catalog)
10. [Phase 8 — Security Audit](#10-phase-8--security-audit)
11. [Phase 9 — HIPAA / Healthcare Compliance Audit](#11-phase-9--hipaa--healthcare-compliance-audit)
12. [Phase 10 — AI Audit](#12-phase-10--ai-audit)
13. [Phase 11 — DevOps Audit](#13-phase-11--devops-audit)
14. [Phase 12 — Environment Variables Audit](#14-phase-12--environment-variables-audit)
15. [Phase 13 — Deployment Readiness](#15-phase-13--deployment-readiness)
16. [Phase 14 — Technical Debt Top 100](#16-phase-14--technical-debt-top-100)
17. [Phase 15 — Acquisition Readiness](#17-phase-15--acquisition-readiness)

---

## 1. EXECUTIVE SUMMARY

### What 24Therapy Is

24Therapy Mental Health OS is an AI-native, multi-tenant SaaS platform for mental health practices. It comprises four separately deployed Next.js 15 applications (marketing website, therapist portal, patient portal, admin portal) backed by a single NestJS 10 REST API, PostgreSQL 16 with pgvector, optional Redis, and Socket.io WebSockets. The platform targets independent therapists and group practices, providing AI-assisted session documentation (SOAP/DAP/BIRP notes via GPT-4o), live transcription (Whisper), a patient engagement app, a therapist marketplace ("find a therapist"), an instant-match engine ("Radar"), and a Stripe-based billing system.

### What Works Today (Verified Against Code)

| Area | Status |
|------|--------|
| Authentication / JWT / refresh tokens | ✅ Fully implemented |
| Multi-tenant org isolation (backend) | ✅ Implemented, one gap noted |
| Session CRUD + lifecycle | ✅ Fully implemented |
| AI note generation (SOAP/DAP/BIRP) | ✅ Implemented — OpenAI GPT-4o |
| Live transcription (Whisper) | ✅ Implemented |
| Crisis keyword detection + alerts | ✅ Implemented, life-safety gap noted |
| Patient portal (12 pages) | ✅ Fully wired to real APIs |
| Therapist portal (40+ pages) | ✅ Majority wired, minor stubs remain |
| Marketplace / find-therapist | ✅ Real search endpoint |
| Public booking (Calendly-like) | ✅ Fully implemented |
| Radar instant matching | ✅ Backend complete; frontend wired |
| Stripe billing (subscriptions, PAYG) | ⚠️ Implemented with CRITICAL price bug |
| Therapist wallet + payouts | ✅ Implemented |
| WebSocket real-time (messages, crisis, copilot) | ✅ Fully implemented |
| AES-256-GCM message encryption | ⚠️ Implemented with plaintext fallback risk |
| HIPAA PHI audit logging | ✅ Implemented |
| Admin portal | ⚠️ Majority real; analytics page is entirely mock data |
| CI/CD | ❌ GitHub Actions broken (billing lock) |
| Monitoring / Observability | ⚠️ Sentry wired; Prometheus scaffolded but unconnected |

### What Is Broken or Missing (Verified)

1. **CRITICAL SECURITY**: `/api/v1/billing/patient-session/checkout` accepts `price_cents` from the client body without server-side validation — an attacker can pay $0.01 for any session. Evidence: `billing.controller.ts` line accepting `body.price_cents` directly.

2. **CRITICAL SECURITY**: Hardcoded fake API key `sk_live_24therapy_abc123xyz` rendered in the therapist Settings UI (`apps/therapist/app/(dashboard)/settings/page.tsx` line 378, 1070) — suggests an API key feature is stubbed.

3. **ADMIN ANALYTICS: ENTIRELY MOCK DATA**: `apps/admin/app/(dashboard)/analytics/page.tsx` contains hardcoded arrays `MRR_DATA`, `SESSION_DATA`, `AI_DATA`, `TOP_ORGS`, `PLAN_DIST`, `CLINICAL_METRICS`, `AI_COSTS` — all displayed as production dashboards. No API integration exists for this page.

4. **CI IS DEAD**: GitHub Actions fails instantly on every push: _"The job was not started because your account is locked due to a billing issue."_ There is no active automated test gate.

5. **MIGRATION GAP**: Migrations 017–028 referenced in documentation do not exist as individual files. Features added in those sessions (break_glass_access, message encryption flag, feature_flags) were consolidated into files 001–016. Any existing database that ran old migrations may face checksum conflicts.

6. **BAAs NOT SIGNED**: CLAUDE.md explicitly states "Must before first real patient: Sign BAAs (Railway, Vercel, OpenAI, Resend, Daily.co)." PHI is flowing to OpenAI (session transcripts, patient context) without a confirmed BAA.

7. **NO PENETRATION TEST COMPLETED**: CLAUDE.md marks this as "Must before first real patient."

8. **MONITORING GAP**: Prometheus/Grafana infrastructure is scaffolded (`infra/` directory) but not connected. No alerting, no SLO dashboards.

### Scores

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Frontend** | 72 / 100 | 4 apps built, most pages wired; admin analytics 100% mock; hardcoded API key stub |
| **Backend** | 74 / 100 | 27 modules, ~120 endpoints; strong architecture; CRITICAL billing bug |
| **Database** | 76 / 100 | Rich schema, good indexes, partitioning; migration numbering gap |
| **Security** | 42 / 100 | CRITICAL price manipulation; hardcoded secret; no rate-limit on payment endpoints; plaintext fallback |
| **DevOps** | 52 / 100 | Railway + Vercel deploys exist; CI dead; no monitoring |
| **HIPAA Compliance** | 48 / 100 | Good foundations (audit log, encryption); BAAs unsigned; OpenAI PHI unprotected |
| **Payments** | 38 / 100 | CRITICAL price bypass; Stripe integration otherwise solid |
| **AI** | 67 / 100 | GPT-4o + Whisper wired; cost tracking; no PHI de-identification |
| **Overall Platform** | **58 / 100** | Impressive scope for stage; not production-safe until 4 critical issues resolved |

### One-Page Investor Summary

24Therapy has accomplished something genuinely difficult: a full AI-native mental health SaaS platform in a single monorepo with 27 backend modules, 128 frontend pages across 4 apps, a complete PostgreSQL schema with 60+ tables, real-time WebSockets, Stripe billing, OpenAI integration, and a coherent HIPAA compliance foundation — all in under 24 development sessions.

The platform is demo-ready and investor-presentable. It is **not production-safe** today due to four issues that must be remediated before onboarding real patients: (1) a CRITICAL billing price-manipulation bug that allows a patient to override the session price in the HTTP request body; (2) a hardcoded placeholder API key rendered in the UI; (3) unsigned Business Associate Agreements with OpenAI, Railway, Vercel, Resend, and Daily.co — making current PHI handling a potential HIPAA violation; and (4) broken CI that provides zero automated regression protection.

These are solvable problems, none requiring architectural changes. The underlying architecture is well-structured, the database schema is thorough, and the team has demonstrated rapid velocity. Fix the four blockers, complete BAAs, add rate-limiting, and this platform can safely onboard its first cohort.

**Estimated remediation to production-safe**: 3–5 weeks of focused engineering.

---

## 2. PHASE 0 — REPOSITORY FORENSICS

### Repository Identity

| Field | Value |
|-------|-------|
| Remote | `omarahmedomarahmed/habiba` |
| Default branch | `main` |
| Active dev branch | `claude/friendly-ritchie-jaaxsw` (current audit session) |
| Previous dev branch | `claude/magical-cori-9vbw6k` (sessions 14–24) |
| Total commits (main) | ~60 commits |
| Git initialized | Unknown exact date; earliest commit in visible log is session 11 era |

### Commit Timeline Reconstruction

```
[Session 11] feat(P9): deployment guide, runbook, HIPAA checklist, CLAUDE.md
[Session 11] feat(P8): backend test suite — 46 tests
[Session 11] feat(P7): deploy machinery — migrate runner, seed, standalone output
[Session 11] feat(P6): eradicate mock PHI — real API + empty states
[Session 11] feat(P5+D7): security hardening — env validation, CORS, cookie middleware
[Session 12] feat(E2E): Playwright test suite — auth flows + crisis safety
[Session 12] fix(ci): switch to pnpm/action-setup@v3 [CI STILL BROKEN - billing]
[Session 13] feat(P2-P7): product pages, find-therapist, docs, pricing 5-tier
[Session 14] feat(P1-P7): monetization engine, billing loop, AI assistant, marketing
[Session 15] fix(P0): therapist identity + route order + API client paths (P0 bugs)
[Session 15] feat(P1-P7): session lifecycle, notes, messages, treatment plans, referrals
[Session 16] feat(session-16): patient portal production-readiness + mobile nav
[Session 18] feat(phase-1..4): foundation hardening, HIPAA, Sentry, encryption, 100 tests
[Session 19] fix(railway): Dockerfile single-stage, migration consolidation (001–016)
[Session 20] feat(session-20): join links, Google Meet-style sessions, backend 500 fixes
[Session 21] feat(session-21): offline sessions, auto-AI output, patient reports
[Session 22] feat(session-22): session monetization, Calendly booking, therapist wallet
[Session 23] fix(build): Suspense wrappers, availability tab, booking flow
[Session 24] feat(session-24): admin approval, bank details, public profiles, Add-to-Calendar
```

### Branch Strategy

The project uses a single-developer model with a new Claude session branch for each development push:
- All PRs merge from a `claude/...` branch into `main`
- 29 merged PRs visible in history
- No feature branches, no long-lived development branches
- No branch protection rules visible from history

**Risk**: No peer review process. Every commit from an AI assistant goes directly to production-bound `main` after a single merge.

### Notable Pivots Identified in Git History

1. **Session 19 migration consolidation**: 28 old patched migration files were deleted and replaced with 16 clean consolidated files. This is a one-way operation that complicates any existing database upgrades.

2. **Billing architecture added in sessions 14 and 22**: The billing engine was built in two distinct phases — basic subscription billing first, then PAYG + therapist wallet + public booking.

3. **Session 15 critical P0 fixes**: The commit message explicitly says "therapist identity + route order + API client paths" — suggesting the system was shipped broken before session 15 patched fundamental routing errors.

4. **`genspark_ai_developer` contributor**: PR #12 includes a fix by `genspark_ai_developer` branch (`fix(patient): resolve apiFetch import error breaking Vercel build`) — indicating at least one third-party AI developer contributed to this codebase.

### Documentation vs. Code Discrepancies

| Documentation Claim | Code Reality |
|--------------------|-|
| "Admin analytics loads from real endpoints" (CLAUDE.md What Is Real) | ❌ `analytics/page.tsx` contains 7 hardcoded mock arrays — no API call found |
| "Memory page: hardcoded seeds removed" | ✅ Verified — real API calls present |
| "Patient journal: full CRUD wired" | ✅ Verified |
| "100 tests passing" (session 18) | UNKNOWN — CI broken; cannot verify current test pass rate |
| "All 4 builds pass" (session 16) | UNKNOWN — Vercel builds claimed passing; cannot verify from repo alone |
| "REAL: Admin analytics loads from /analytics/platform/dashboard" | ❌ False — page uses hardcoded arrays; endpoint exists in backend but page does not call it |

---

## 3. PHASE 1 — SYSTEM INVENTORY

### 3.1 Repository Structure

```
habiba/
├── .github/workflows/ci.yml          # CI pipeline (CURRENTLY BROKEN)
├── apps/
│   ├── web/                           # Marketing site       :3000  (Next.js 15)
│   ├── therapist/                     # Therapist portal     :3001  (Next.js 15)
│   ├── patient/                       # Patient portal       :3002  (Next.js 15)
│   └── admin/                         # Admin portal         :3003  (Next.js 15)
├── backend/                           # NestJS REST API      :4000
│   └── src/
│       ├── app.module.ts              # 27 modules registered
│       ├── main.ts                    # Bootstrap, Sentry, Helmet, CORS
│       ├── config/                    # env.validation, cors, app.config
│       ├── common/                    # PHI audit interceptor, decorators
│       ├── database/                  # pg pool, query/transaction helpers
│       ├── gateways/                  # Socket.io WebSocket gateway
│       └── modules/                   # 27 feature modules
├── docs/                              # HIPAA checklist, product docs
├── e2e/                               # Playwright tests (auth, crisis)
├── infra/                             # Prometheus/Grafana (scaffolded, unwired)
├── migrations/                        # 20 SQL files (001–016, 029–032)
├── ops/                               # DEPLOYMENT.md, RUNBOOK.md, INCIDENT_RESPONSE.md
├── packages/
│   ├── config/                        # @24therapy/config — shared URL constants
│   ├── fonts/                         # Local font files
│   └── types/                         # @24therapy/types — shared TypeScript types
├── scripts/
│   ├── migrate.js                     # Migration runner with advisory lock
│   ├── seed.js                        # Idempotent org+admin seeder
│   ├── backup-verify.js               # Monthly backup restore verification
│   └── encrypt-messages.js            # One-time AES-256-GCM backfill
├── docker-compose.yml                 # Full local dev stack
├── playwright.config.ts               # E2E config
├── turbo.json                         # Turborepo pipeline
├── pnpm-workspace.yaml                # pnpm workspaces
└── package.json                       # Root scripts, Node 20, pnpm 9.15.4
```

### 3.2 Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend framework | Next.js | 15.x | App router, server components |
| Backend framework | NestJS | 10.3 | Modular, DI, decorators |
| Language | TypeScript | 5.x | Strict mode |
| Database | PostgreSQL | 16 + pgvector | Neon serverless (production) |
| Caching | Redis | 7 (optional) | Rate limiting, TTL cache |
| ORM / Query builder | Raw pg + DatabaseService | — | No Drizzle/Prisma in actual queries |
| Auth | Passport.js + JWT | — | Access 15m / Refresh 30d |
| Real-time | Socket.io | — | 5 rooms per session |
| AI | OpenAI GPT-4o, GPT-4o-mini, Whisper | — | Via `openai` SDK |
| AI (registered) | Anthropic Claude | claude-sonnet-4-6 | Registered in model registry; no active call found |
| Payments | Stripe | 16.12.0 | Subscriptions + PAYG + Checkout |
| Email | Resend | — | HTTP API fetch, not nodemailer |
| Video | Daily.co | — | iframe embed via `video_room_url` |
| Storage | AWS S3 + CloudFront | — | Wired; no active upload route found for recordings |
| Error monitoring | Sentry | @sentry/node + @sentry/nextjs | PHI scrubbing configured |
| Monorepo | Turborepo + pnpm workspaces | turbo v2, pnpm 9.15.4 | |
| Containerization | Docker (multi-stage) | Node 20 Alpine | All 5 services Dockerized |
| CI/CD | GitHub Actions + Railway + Vercel | — | CI BROKEN; Railway/Vercel operational |

---

## 4. PHASE 2 — SESSION HISTORY RECONSTRUCTION

Each session's claimed vs. actual completion, verified against git diff and file inspection.

| Session | Claimed | Verified Complete | Verified Partial | Verified Incomplete |
|---------|---------|-------------------|-----------------|---------------------|
| **11** | Deploy machinery, test suite, HIPAA hardening | ✅ migrate.js, seed.js, standalone output, 46 backend tests | — | Prometheus unwired |
| **12** | Playwright E2E, CI fix | ✅ E2E files exist, ci.yml exists | — | ❌ CI still broken (billing) |
| **13** | Marketing revamp, product pages, pricing | ✅ All pages present | — | — |
| **14** | Monetization engine, billing loop, AI assistant | ✅ billing.service.ts, assistant page | — | — |
| **15** | P0 fixes, session lifecycle, notes, treatment plans, referrals | ✅ All modules present | — | — |
| **16** | Patient portal, mobile nav | ✅ Patient pages wired, BottomNav present | — | — |
| **18** | HIPAA hardening, 100 tests, break-glass, encryption | ✅ break_glass_access in schema, AES-256-GCM in messages.service | ⚠️ Tests unverifiable (CI broken) | ⚠️ Migrations 022–028 consolidated not as numbered files |
| **19** | Dockerfile fix, migration consolidation | ✅ Single-stage Dockerfile, 001–016 present | — | — |
| **20** | Join links, Google Meet-style, backend 500 fixes | ✅ join_token in schema (029), public join page exists | — | — |
| **21** | Offline sessions, auto-AI, patient reports | ✅ nullable patient_id (030), autoGenerateSessionOutput in ai.service | — | — |
| **22** | Wallet, Calendly booking, therapist public profiles | ✅ wallet tables (031), /t/[slug] booking page, booking.service | — | — |
| **23** | Suspense fix, availability tab, booking flow | ✅ Suspense wrappers in 3 pages, availability tab in settings | — | — |
| **24** | Admin approval, bank details, public profiles, calendar | ✅ 032 migration, bank_details JSONB on therapists, LockedPageOverlay | ⚠️ Hardcoded API key in settings | ❌ Admin analytics still mock |

### Critical Session 18 Discrepancy

Documentation claims "migrations 022–024" were created. **These files do not exist in `migrations/`**. The features they were meant to introduce (FK indexes, pricing_audit_log rename, notification lock release) appear to have been consolidated into files 001–016 during session 19's migration rewrite. However, the `release_stale_notification_locks()` function IS present in 009_messaging.sql — verified. The `break_glass_access` table IS present in 015_workflows.sql — verified. The `encrypted` boolean on messages IS present in 009_messaging.sql — verified.

**Conclusion**: Functionality claimed in sessions 18 and earlier was consolidated and is present in the final schema. The migration numbering in CLAUDE.md is documentation drift from the consolidation event.

---

## 5. PHASE 3 — FEATURE COMPLETION MATRIX

| Feature | Frontend Complete | Backend Complete | DB Complete | Prod Ready | Notes |
|---------|:-:|:-:|:-:|:-:|-------|
| **Auth / JWT login** | ✅ | ✅ | ✅ | ✅ | All 4 portals; refresh working |
| **Therapist registration** | ✅ | ✅ | ✅ | ✅ | Creates org + therapist in transaction |
| **Therapist verification workflow** | ✅ | ✅ | ✅ | ✅ | Submit → admin approve/reject → email |
| **Patient management (CRUD)** | ✅ | ✅ | ✅ | ✅ | Full lifecycle |
| **Session scheduling** | ✅ | ✅ | ✅ | ✅ | |
| **Session room (video)** | ✅ | ✅ | ✅ | ✅ | Daily.co iframe; requires DAILY_API_KEY |
| **Live transcription** | ✅ | ✅ | ✅ | ✅ | Whisper; browser MediaRecorder |
| **AI note generation (SOAP/DAP/BIRP)** | ✅ | ✅ | ✅ | ✅ | GPT-4o; requires OPENAI_API_KEY |
| **AI copilot** | ✅ | ✅ | ✅ | ✅ | Real-time suggestions in session |
| **AI session summary** | ✅ | ✅ | ✅ | ✅ | |
| **Crisis detection + alerts** | ✅ | ✅ | ✅ | ⚠️ | Fire-and-forget; no retry on alert failure |
| **Patient memory / knowledge graph** | ✅ | ✅ | ✅ | ✅ | pgvector semantic search |
| **Clinical assessments (PHQ-9, GAD-7, etc.)** | ✅ | ✅ | ✅ | ✅ | 7 templates seeded |
| **Treatment plans** | ✅ | ✅ | ✅ | ✅ | CBT/DBT/EMDR protocols built in |
| **Clinical workflows** | ✅ | ✅ | ✅ | ✅ | 6 templates; homework pipeline |
| **Referrals** | ✅ | ✅ | ✅ | ✅ | Draft → send lifecycle |
| **Session reports** | ✅ | ✅ | ✅ | ✅ | Generate / sign / send to patient |
| **Patient portal — home** | ✅ | ✅ | ✅ | ✅ | Real APIs |
| **Patient mood tracker** | ✅ | ✅ | ✅ | ✅ | |
| **Patient journal** | ✅ | ✅ | ✅ | ✅ | Full CRUD |
| **Patient assessments** | ✅ | ✅ | ✅ | ✅ | |
| **Patient homework** | ✅ | ✅ | ✅ | ✅ | Start/Complete wired |
| **Patient progress page** | ✅ | ✅ | ✅ | ✅ | |
| **Patient messages** | ✅ | ✅ | ✅ | ✅ | Real-time via WebSocket |
| **Billing — subscriptions** | ✅ | ✅ | ✅ | ⚠️ | Stripe integration; session quota logic; no active Stripe keys confirmed |
| **Billing — PAYG ($6/session)** | ✅ | ✅ | ✅ | ❌ | CRITICAL price-bypass bug |
| **Patient session payment** | ✅ | ✅ | ✅ | ❌ | CRITICAL: client controls price |
| **Therapist wallet** | ✅ | ✅ | ✅ | ✅ | 85/15 split; payout requests |
| **Admin payout processing** | ✅ | ✅ | ✅ | ✅ | Mark processed + bank details |
| **Stripe webhooks** | — | ✅ | ✅ | ⚠️ | Signature validated; empty-string fallback risk |
| **Public therapist booking** | ✅ | ✅ | ✅ | ✅ | /t/[slug] Calendly-like flow |
| **Radar instant matching** | ✅ | ✅ | ✅ | ✅ | ML scoring; broadcast; accept/decline |
| **Marketplace / find therapist** | ✅ | ✅ | ✅ | ✅ | Full-text search; therapist public profiles |
| **Messaging (therapist ↔ patient)** | ✅ | ✅ | ✅ | ✅ | AES-256-GCM encryption (if key set) |
| **Admin dashboard** | ✅ | ✅ | ✅ | ⚠️ | Stats real; system health hardcoded |
| **Admin analytics** | ❌ MOCK | ✅ | ✅ | ❌ | Frontend uses 7 hardcoded arrays; no API call |
| **Admin org management** | ✅ | ✅ | ✅ | ✅ | Suspend/activate wired |
| **Admin user management** | ✅ | ✅ | ✅ | ✅ | Impersonate, suspend |
| **Admin therapist approvals** | ✅ | ✅ | ✅ | ✅ | Approve/reject with email |
| **Admin feature flags** | ✅ | ✅ | ✅ | ✅ | DB-driven feature flags |
| **Admin break-glass access** | ✅ | ✅ | ✅ | ⚠️ | Log-only; no 2FA gate |
| **PHI audit log** | ✅ | ✅ | ✅ | ✅ | Interceptor on all PHI routes |
| **Data retention / erasure** | ✅ | ✅ | ✅ | ✅ | Cron jobs; 30-day hold |
| **HIPAA patient data export** | ✅ | ✅ | ✅ | ✅ | GET /patients/me/export |
| **Contact form** | ✅ | ✅ | ✅ | ✅ | POSTs to /contact |
| **AI workspace (practice assistant)** | ✅ | ✅ | ✅ | ✅ | GPT-4o-mini chat |
| **Guest AI chat (/chat)** | ❌ HIDDEN | ✅ | — | N/A | notFound() — intentionally hidden |
| **Email notifications (Resend)** | — | ✅ | ✅ | ⚠️ | Requires RESEND_API_KEY; falls back to console.log |
| **Push notifications** | ✅ schema | ⚠️ | ✅ | ❌ | Device registry exists; no FCM/APNs call found |
| **Session recording (storage)** | ⚠️ | ⚠️ | ✅ | ❌ | Table and schema exist; no S3 upload route found |
| **Sentry error monitoring** | ✅ | ✅ | — | ✅ | All 5 apps wired; PHI scrubbing |
| **Blog CMS** | ❌ | ❌ | — | ❌ | Route exists, no CMS connected |
| **E2E tests** | ✅ | — | — | ⚠️ | Tests exist; CI broken; cannot run |
| **Backend unit tests** | — | ✅ | — | ⚠️ | ~100 tests claimed; CI broken |
| **CI/CD pipeline** | — | — | — | ❌ | GitHub Actions locked (billing) |
| **Prometheus / Grafana** | — | ❌ | — | ❌ | Scaffolded in `infra/`; not connected |

---

## 6. PHASE 4 — FRONTEND AUDIT

### 6.1 apps/web (Marketing Site — Port 3000)

**Route inventory (41 pages verified):**

| Route | Status | Notes |
|-------|--------|-------|
| `/` | ✅ Working | Hero, features sections |
| `/about` | ✅ Working | Static content |
| `/pricing` | ✅ Working | Fetches `/billing/plans`; has hardcoded fallback notice |
| `/find-therapist` | ✅ Working | Calls `GET /marketplace/search` |
| `/therapists/[id]` | ✅ Working | Calls `GET /marketplace/therapist/:id` |
| `/for-therapists` | ✅ Working | Static marketing |
| `/enterprise` | ✅ Working | Static |
| `/contact` | ✅ Working | Posts to `/contact` |
| `/features/*` (10 pages) | ✅ Working | Static content |
| `/docs/[slug]` | ✅ Working | Inline markdown renderer |
| `/docs/integrations/[id]` | ✅ Working | |
| `/blog/[slug]` | ⚠️ Stub | No CMS connected; no content fetch |
| `/login` | ✅ Working | Redirects to therapist/patient login |
| `/signup` | ✅ Working | Calls `POST /auth/register` |
| `/chat` | ❌ Hidden | Returns `notFound()` — intentionally removed from MVP |
| `/hipaa`, `/gdpr`, `/security` | ✅ Working | Static compliance pages |
| `/status` | ⚠️ Static | No real status API wired |
| `/press`, `/careers`, `/testimonials` | ✅ Working | Static |

**Security headers (vercel.json):**
- `X-Content-Type-Options: nosniff` ✅
- `X-Frame-Options: SAMEORIGIN` ⚠️ (Should be DENY for health app pages)
- `Referrer-Policy: strict-origin-when-cross-origin` ✅
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` ✅
- Missing: `Strict-Transport-Security`, `Content-Security-Policy`

**No authentication required.** No persistent state. Sentry integrated.

---

### 6.2 apps/therapist (Therapist Portal — Port 3001)

**Route inventory (44 pages verified):**

| Route | Status | Notes |
|-------|--------|-------|
| `/login`, `/forgot-password`, `/reset-password` | ✅ | Auth flows |
| `/onboarding` | ✅ | 7-step profile completion; submits to API on final step |
| `/dashboard` | ✅ | Real stats from `sessionsAPI.dashboardStats()` |
| `/patients` | ✅ | Real list from `patientsAPI.list()` |
| `/patients/[id]` | ✅ | Full profile; diagnoses, goals, timeline |
| `/patients/new` | ✅ | Create patient form |
| `/patients/intake` | ✅ | Calls `patientsAPI.create()` |
| `/sessions` | ✅ | Calendar + list view |
| `/sessions/new` | ✅ | Online/offline toggle; price field |
| `/sessions/[id]` | ✅ | Session detail page |
| `/sessions/[id]/prepare` | ✅ | Pre-session prep with AI suggestions |
| `/sessions/[id]/room` | ✅ | Live session room; transcript; copilot; crisis modal |
| `/notes` | ✅ | List with search/filter |
| `/notes/new` | ✅ | 3-step creation |
| `/notes/[id]` | ✅ | View/edit/finalize |
| `/ai-workspace` | ✅ | Practice assistant chat |
| `/assistant` | ✅ | AI assistant with session/patient context pickers |
| `/analytics` | ✅ | Calls `analyticsAPI.dashboard()` |
| `/calendar` | ✅ | Month/week view; new session → /sessions/new?date= |
| `/memory` | ✅ | Knowledge graph; list from `memoriesAPI` |
| `/memory/graph` | ✅ | Visual graph |
| `/messages` | ✅ | Conversations + real-time via Socket.io |
| `/billing` | ⚠️ | Plan cards hardcoded (`PLANS` array); usage from real API |
| `/settings` | ⚠️ | Profile, availability, booking, wallet tabs all wired; **API key tab has hardcoded fake key** |
| `/treatment-plans` | ✅ | List from `treatmentPlansAPI.list()` |
| `/treatment-plans/new` | ✅ | Create with protocol selection |
| `/referrals` | ✅ | Full CRUD |
| `/reports` | ✅ | Generate/sign/send pipeline |
| `/clinical-tools` | ✅ | Tool browser |
| `/clinical-tools/[slug]` | ✅ | PHQ-9/GAD-7 live runner |
| `/assessments` | ✅ | List, score, trend |
| `/assessments/new` | ✅ | Template selection + send to patient |
| `/team` | ✅ | Real from `therapistsAPI.list()` |
| `/audit-logs` | ✅ | Real from `organizationsAPI.auditLogs()` |
| `/radar` | ✅ | Incoming requests; accept/decline |
| `/risk-monitor` | ✅ | Active risk assessments |
| `/workflow` | ✅ | Clinical workflows list |
| `/crm` | ⚠️ | Present but relies on notifications.conversations; minimal |
| `/notifications` | ✅ | Real notifications |
| `/t/[slug]` | ✅ | Public booking page (5-step) |
| `/t/[slug]/confirmed` | ✅ | Booking confirmation + Add-to-Calendar |
| `/join/[token]` | ✅ | Patient join page (public) |

**State management (Zustand stores):**
- `useAuthStore` — user, tokens, expiry ✅
- `useUIStore` — sidebar, active selections, notification count, verificationStatus ✅
- `useSessionRoomStore` — live session state, transcript, copilot, risk alerts ✅

**Authentication pattern:** localStorage `access_token` + `refresh_token`; `tt_auth=1` cookie for middleware; 15m access / 30d refresh; automatic silent refresh on 401.

**Verification-gating:** 7 pages wrapped in `LockedPageOverlay` for unverified therapists (sessions, patients, billing, notes, analytics, etc.) — correctly restricts unverified users.

**Identified issues:**
1. `apps/therapist/app/(dashboard)/settings/page.tsx:378` — `navigator.clipboard.writeText("sk_live_24therapy_abc123xyz")` — hardcoded fake API key. Line 1070 shows `sk_live_••••••••••••••••••••abc123` in the UI.
2. `apps/therapist/app/(dashboard)/billing/page.tsx:13–78` — `PLANS` array hardcoded with prices; should pull from `/billing/plans`.
3. Phone and video buttons in messages marked `disabled` — dead features exposed in UI without clear messaging.

---

### 6.3 apps/patient (Patient Portal — Port 3002)

**Route inventory (20 pages verified):**

| Route | Status | Notes |
|-------|--------|-------|
| `/login`, `/forgot-password`, `/reset-password` | ✅ | |
| `/home` | ✅ | Greeting, therapist card, upcoming session, mood stats — all real API |
| `/appointments` | ✅ | Past/upcoming sessions from `sessionsAPI.list()` |
| `/sessions` | ✅ | Session list |
| `/mood` | ✅ | moodTrend(30) — no mock data |
| `/journal` | ✅ | Full CRUD — journalAPI |
| `/assessments` | ✅ | Real list; submit wired |
| `/homework` | ✅ | Start/Complete wired to PATCH endpoints |
| `/progress` | ✅ | assessmentsAPI + patientAPI.me() goals + moodTrend |
| `/messages` | ✅ | Real-time via Socket.io |
| `/ai-companion` | ✅ | aiAPI.chat() |
| `/resources` | ⚠️ | Static content; no CMS |
| `/crisis` | ✅ | Crisis resources page with 988 hotline |
| `/billing` | ✅ | Invoices from billingAPI |
| `/profile` | ✅ | patientAPI.me() + update |
| `/notifications` | ✅ | Real notifications |
| `/reports` | ✅ | sessionsAPI.myReports() — signed reports |

**Patient portal is the most production-ready of the four apps.** All pages consume real APIs. No hardcoded mock data found.

---

### 6.4 apps/admin (Admin Portal — Port 3003)

**Route inventory (23 pages verified):**

| Route | Status | Notes |
|-------|--------|-------|
| `/login` | ✅ | MFA code field included |
| `/dashboard` | ⚠️ | Stats real; system health section all hardcoded "operational" |
| `/analytics` | ❌ MOCK | Entirely hardcoded: MRR_DATA, TOP_ORGS, AI_COSTS, CLINICAL_METRICS |
| `/organizations` | ✅ | Real: suspend/activate wired |
| `/users` | ✅ | Real: suspend, impersonate, export CSV |
| `/therapists` | ✅ | Real: approve/reject with modal |
| `/billing` | ✅ | Real invoices/subscriptions |
| `/payouts` | ✅ | Real payout requests; process with notes |
| `/crisis` | ✅ | Real alerts; acknowledge wired |
| `/audit-logs` | ✅ | Real PHI access log |
| `/compliance` | ✅ | BAA records, checklist |
| `/feature-flags` | ✅ | Toggle feature flags |
| `/marketplace` | ✅ | Approve/reject listings |
| `/ai-costs` | ⚠️ | Partial — AI cost data from analyticsAPI; some sections stub |
| `/ai-governance` | ⚠️ | Stub — no backend governance endpoint found |
| `/support-tools` | ⚠️ | Partial |
| `/practice-management` | ⚠️ | Partial |
| `/crm` | ✅ | Real: leads, pipeline from crmAPI (via notificationsAPI) |
| `/pricing` | ✅ | Real plan management |
| `/settings` | ✅ | Org settings |

**X-Robots-Tag: noindex, nofollow** — correctly prevents search engine indexing of admin portal. ✅

**Identified issues:**
1. `analytics/page.tsx` — 7 hardcoded arrays. This is the platform's primary analytics surface and shows entirely fabricated data. No call to `GET /analytics/platform/dashboard` exists in this file despite the backend endpoint being implemented.
2. `dashboard/page.tsx` lines 326–341 — System health shows all services as "operational" from a static array. No health check API called.

---

### 6.5 Cross-App Issues

| Issue | Severity | Affected Apps |
|-------|----------|---------------|
| Hardcoded API key `sk_live_24therapy_abc123xyz` | Critical | Therapist |
| Admin analytics 100% mock data | High | Admin |
| System health hardcoded "operational" | High | Admin |
| Blog CMS not connected | Medium | Web |
| Billing plan cards hardcoded (prices) | Medium | Therapist |
| Push notifications device registry exists; FCM/APNs not wired | Medium | All |
| Session recording S3 upload endpoint not found | Medium | Therapist |
| Status page (/status) not connected to real health check | Low | Web |
| 20+ silent catch blocks (`catch { /* non-critical */ }`) | Low | All |

---

## 7. PHASE 5 — BACKEND AUDIT

### 7.1 Architecture Overview

```
main.ts
  └── AppModule
        ├── ConfigModule (global)
        ├── ThrottlerModule [100/min, 1000/hr]
        ├── EventEmitterModule (wildcard)
        ├── ScheduleModule
        ├── DatabaseModule (global)
        ├── AuthModule → JwtAuthGuard (APP_GUARD, global)
        ├── 25 feature modules
        ├── GatewaysModule (Socket.io)
        └── APP_INTERCEPTOR → PhiAuditInterceptor
```

**Global security posture:** Default-deny authentication (all routes require JWT unless `@Public()` decorator used). This is the correct approach for healthcare.

**API prefix:** `/api/v1` on all routes except `/health`.

### 7.2 Module-by-Module Review

#### AuthModule
**File evidence:** `backend/src/modules/auth/`

Endpoints:
- `POST /auth/register` — Creates org + user + therapist in transaction. Validates unique email. Sends welcome email.
- `POST /auth/login` — bcrypt compare (cost 12), account lockout after 5 failures (15min), logs IP.
- `POST /auth/refresh` — Validates refresh token hash; issues new access token.
- `POST /auth/logout` — Revokes refresh token.
- `GET /auth/me` — Returns current user.
- `POST /auth/forgot-password` — Time-limited reset token.
- `POST /auth/reset-password` — Validates token; hashes new password.

Status: ✅ Production-quality implementation. Account lockout, secure token rotation, bcrypt properly configured.

**Gap:** Password reset token is sent via email (Resend). If `RESEND_API_KEY` is not set, the email falls back to `console.log` — the token is logged to stdout, which in Railway would be visible in production logs. This is a PHI/security risk.

#### SessionsModule
**File evidence:** `backend/src/modules/sessions/sessions.service.ts`, `sessions.controller.ts`

Key observations:
- Route order critical: `dashboard`, `usage`, `my-reports`, `join/:token` all precede `/:id` to avoid param capture — ✅ correctly ordered.
- `create()` enforces plan quota: free_trial (1 session), pay_per_session (no cap but charges), starter (monthly quota), pro/practice (unlimited).
- `updateStatus()` fires billing hook `onSessionCompleted()` on status → `completed`.
- Crisis keyword scanning integrated inline in `addTranscriptSegment()` — fire-and-forget `.catch()`.
- `getJoinInfo()` is `@Public()` — leaks therapist name, avatar, session price to anyone with a UUID join token.

Status: ✅ Solid implementation. Fire-and-forget crisis detection is a life-safety gap.

#### BillingModule
**File evidence:** `backend/src/modules/billing/billing.controller.ts`, `billing.service.ts`

**CRITICAL FINDING — Price Manipulation:**
```typescript
// billing.controller.ts
@Public()
@Post("patient-session/checkout")
createPatientSessionCheckout(
  @Body() body: {
    session_id: string;
    join_token: string;
    patient_email: string;
    price_cents: number;   // ← CLIENT CONTROLLED
    therapist_id: string
  }
) {
  return this.billingService.createPatientSessionCheckout(
    body.session_id, body.therapist_id, body.price_cents,  // ← PASSED DIRECTLY
    body.patient_email, body.join_token,
  ).then(url => ({ checkout_url: url }));
}
```

An attacker sends `price_cents: 1` and gets a Stripe checkout URL for $0.01 for any session. Server does not validate against `sessions.session_price_cents`. **This must be fixed before accepting real payments.**

Webhook handler: `constructEvent()` used correctly with `rawBody`. Stripe signature validated. ✅
Idempotency: UPDATE-based writes (not INSERT); Stripe payment_intent checked for duplicate credit. ✅
Wallet: 85/15 split on session completion; `_creditTherapistWallet()` is idempotent via conflict check. ✅

#### AIModule
**File evidence:** `backend/src/modules/ai/ai.service.ts`, `ai.controller.ts`, `model-gateway.service.ts`

Model routing:
- SOAP/DAP/BIRP notes → GPT-4o
- Summaries → GPT-4o
- Copilot → GPT-4o-mini
- Chat → GPT-4o-mini
- Transcription → whisper-1

Cost tracking: All AI calls logged to `ai_request_logs` with token count and cost. ✅
Fallback: `model-gateway.service.ts` returns mock responses if OpenAI unavailable — appropriate for dev, acceptable for demo, risky for production (silent failures).
PHI in prompts: `contextBuilder.buildSessionContext()` includes patient name, diagnoses, medications, session history — all sent to OpenAI. **No de-identification layer.** BAA required.

Public endpoint: `POST /ai/chat/anonymous` — 10-message limit per session, crisis keyword detection, no PHI stored. ✅

#### CrisisModule
**File evidence:** `backend/src/modules/crisis/crisis.service.ts`

- 25+ crisis keywords scanned in transcript
- Creates `risk_assessments` row on keyword match
- Emits `ai.risk_detected` → WebSocket → therapist UI
- Patient receives only `crisis_support` event (no risk level, no keywords) ✅ — correct PHI isolation
- AI refinement async (GPT-4o for deeper risk scoring)
- Duplicate suppression: skips re-alert within 10 minutes of elevated+ alert ✅
- **Gap:** `handleKeywordHit()` called with `.catch()` — failure silently lost. No retry, no persistence of failed alerts.

#### MessagesModule
**File evidence:** `backend/src/modules/messages/messages.service.ts`

AES-256-GCM encryption implementation:
```typescript
const ENC_KEY = process.env.MESSAGE_ENCRYPTION_KEY
  ? Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY, 'hex')
  : null;

function encryptContent(plaintext) {
  if (!ENC_KEY) return { ciphertext: plaintext, encrypted: false }; // ← PLAINTEXT!
```

If `MESSAGE_ENCRYPTION_KEY` is not set (it is NOT in the required env validation), messages are stored in plaintext. This is a HIPAA risk — patient-therapist messages are PHI.

#### BookingModule
**File evidence:** `backend/src/modules/booking/booking.service.ts`

- Public profile: `GET /booking/t/:slug` — No auth ✅
- Available slots: computed from `therapist_availability` minus existing sessions ✅
- Checkout: Creates Stripe session → sends confirmation email ✅
- Daily.co room: Created before INSERT so `video_room_url` is never NULL ✅

Minor: Slot interval hardcoded to 30 minutes; no config option.

#### DataLifecycleModule
**File evidence:** `backend/src/modules/data-lifecycle/data-lifecycle.service.ts`

- `0 3 * * *` — Purge `phi_access_log` rows older than 6 years
- `0 4 * * *` — Hard-delete patients with `erasure_requested` > 30 days (cascades)
- `0 5 1 * *` — Monthly retention report (logged)

Status: ✅ Correctly implemented per HIPAA §164.530(j).

### 7.3 WebSocket Gateway

**File evidence:** `backend/src/gateways/events.gateway.ts`

Room architecture:
```
user:{userId}          — All authenticated users join on connect
staff:{orgId}          — Therapists + admins (crisis alerts land here)
session:{sessionId}    — Active session participants
therapists:{orgId}     — Radar broadcasts
```

PHI isolation: Patients never join `staff:` rooms. Crisis alerts (`crisis_alert`) go to `staff:` + specific therapist user room. Patients receive only `crisis_support`. ✅

**Gap:** No heartbeat / ping-pong mechanism visible. Socket disconnects without explicit `leave_session` will leave stale room memberships until next connection.

### 7.4 Rate Limiting

Global ThrottlerModule: 100 req/min, 1000 req/hr on all routes.

**Issue:** `@SkipThrottle()` or per-route `@Throttle()` overrides not found on any public payment or auth endpoint. The global throttler applies to authenticated sessions via cookie/JWT identification — but for `@Public()` endpoints (login, join, checkout), throttling is by IP. A distributed attacker can bypass per-IP limits.

Specific high-risk unthrottled public endpoints:
- `POST /auth/login` — Password brute force
- `POST /auth/register` — Spam account creation
- `GET /sessions/join/:token` — Token enumeration
- `POST /sessions/join/:token/pay` — Payment initiation spam
- `POST /billing/patient-session/checkout` — Price manipulation + spam

---

## 8. PHASE 6 — DATABASE AUDIT

### 8.1 Schema Overview

| Category | Tables | Key Features |
|----------|--------|-------------|
| Core | organizations, users, refresh_tokens, SSO | Multi-tenant foundation |
| Therapists | therapists, credentials, availability, specializations | Verification workflow |
| Patients | patients, profiles, consents, contacts, mood, journal, goals | Full patient lifecycle |
| Medications | medications, patient_medications, adherence_logs | Formulary + tracking |
| Sessions | sessions, transcripts, segments, recordings, reports | Full session lifecycle |
| Clinical | diagnoses, risk_assessments, treatment_plans, assessments | Clinical data |
| AI | ai_session_notes, patient_memory (pgvector), prompt_registry, ai_request_logs | AI-native design |
| Messaging | conversations, messages (encrypted), notifications, push_devices | Communications |
| Billing | subscription_plans, subscriptions, session_charges, invoices, therapist_wallet, payout_requests | Full billing engine |
| Marketplace | marketplace_listings, reviews, bookmarks, analytics | Therapist directory |
| Analytics | analytics_events (partitioned), ai_cost_tracking (partitioned), daily_metrics | Time-series analytics |
| Compliance | audit_logs (RLS), phi_access_log, break_glass_access, baa_records | HIPAA foundations |
| Radar | radar_requests, radar_broadcasts, radar_matches, radar_sessions | Instant matching |
| Workflows | clinical_workflows, workflow_tasks, referrals, feature_flags | Automation |
| Monetization | therapist_wallet, wallet_transactions, payout_requests, booking_sessions | Session payments |

**Total tables:** ~65 tables across 20 migration files.

### 8.2 Migration Architecture

**Migration numbering gap:**
```
Present:   001–016, 029–032  (20 files)
Missing:   017–028            (12 files — consolidated into 001–016 in session 19)
```

The `scripts/migrate.js` runner tracks applied migrations by filename in `schema_migrations` table. A database that ran the original 017–028 files (pre-session 19 consolidation) will:
1. Have checksums in `schema_migrations` for files that no longer exist
2. May conflict with `auto-baseline` if checksums don't match

The `--auto-baseline` flag in `railway.json`'s preDeployCommand handles this for new deployments, but any existing database requires manual migration verification.

**Evidence:** `scripts/migrate.js` line handling `--auto-baseline`: updates mismatched checksums instead of crashing (commit `49cc019`). ✅ This was patched.

### 8.3 Index Quality Assessment

**Excellent:**
- GIN indexes on array columns (`therapist.specializations[]`, `therapist.languages[]`, `patient.tags[]`)
- GIN full-text search on `transcript_segments.text` — critical for session search
- IVFFlat cosine index on `patient_memory.embedding (vector 1536)` — correct for pgvector semantic search
- Partial indexes: `idx_sessions_no_patient` (WHERE patient_id IS NULL), `idx_marketplace_published`, `idx_notification_queue_runnable`
- Composite time-series indexes: `(organization_id, created_at DESC)` on audit logs, events

**Missing:**
- `sessions.therapist_id + scheduled_at` composite (common query: "get today's sessions for therapist")
- `conversations.patient_id` — messaging queries by patient
- `ai_session_notes.session_id` — note lookup by session (exists but check FK index)
- `phi_access_log.user_id + created_at` — audit queries are commonly time-bounded per user

### 8.4 Schema Quality Issues

**Good patterns:**
- Soft deletes via `deleted_at` with partial unique indexes (email unique where deleted_at IS NULL) ✅
- `updated_at` triggers on all mutable tables ✅
- Foreign keys with appropriate cascade/restrict behavior ✅
- `id UUID DEFAULT gen_random_uuid()` primary keys throughout ✅
- JSONB for flexible schema parts (settings, metadata, structured_content) ✅
- Range-partitioned tables for high-volume analytics ✅
- Append-only audit_logs with RLS preventing UPDATE/DELETE ✅

**Issues:**
- `buildOrgFilter()` in `database.service.ts` uses string interpolation: `return \`${prefix}organization_id = '${organizationId}'\`` — potential SQL injection if organizationId is not validated upstream (comes from JWT payload, so low risk but non-standard)
- `analytics_events` partitions only cover 2025–2027 — manual partition creation required after 2027-01-01
- `ai_cost_tracking` same limitation
- `audit_logs` has no partition or archival strategy — will grow unbounded (PHI access logging on every request)

### 8.5 Multi-Tenancy Implementation

**Pattern:** All tables have `organization_id` column. Services receive `orgId` from `req.user.organization_id` (JWT-extracted). Queries use `buildOrgFilter()` helper.

**Verification:** Reviewed 8 service files — all add `organization_id = $N` to WHERE clauses on multi-tenant resources. ✅

**Gap:** `marketplace_listings` and `booking/t/:slug` routes are intentionally public — no org filter. This is correct by design but means therapist data (name, bio, specialties, price) is publicly discoverable without authentication.

### 8.6 pgvector Usage

- Extension: `CREATE EXTENSION IF NOT EXISTS vector` in `001_extensions.sql` ✅
- Embedding dimension: 1536 (matches `text-embedding-3-small`) ✅
- Index type: `IVFFlat` with `cosine` operator class ✅
- Lists: 100 (default; appropriate for table sizes under ~1M rows)

**Limitation:** IVFFlat index requires retraining (`VACUUM ANALYZE`) as the table grows. No automated maintenance job found.

---

## 9. PHASE 7 — API CATALOG

### Complete Endpoint Inventory

**Auth** (7 endpoints)
| Method | Route | Auth | Status |
|--------|-------|------|--------|
| POST | `/auth/register` | Public | ✅ |
| POST | `/auth/login` | Public | ✅ |
| POST | `/auth/refresh` | Public | ✅ |
| POST | `/auth/logout` | JWT | ✅ |
| GET | `/auth/me` | JWT | ✅ |
| POST | `/auth/forgot-password` | Public | ✅ |
| POST | `/auth/reset-password` | Public | ✅ |

**Sessions** (14 endpoints)
| Method | Route | Auth | Status |
|--------|-------|------|--------|
| GET | `/sessions/dashboard` | JWT+Therapist | ✅ |
| GET | `/sessions` | JWT | ✅ |
| GET | `/sessions/usage` | JWT+Therapist | ✅ |
| GET | `/sessions/my-reports` | JWT+Patient | ✅ |
| GET | `/sessions/join/:token` | **Public** | ✅ |
| POST | `/sessions/join/:token` | **Public** | ✅ |
| POST | `/sessions/join/:token/pay` | **Public** | ✅ |
| GET | `/sessions/:id` | JWT | ✅ |
| POST | `/sessions` | JWT+Therapist | ✅ |
| PATCH | `/sessions/:id/status` | JWT | ✅ |
| GET | `/sessions/:id/transcript` | JWT | ✅ |
| POST | `/sessions/:id/transcript/segments` | JWT | ✅ |
| GET | `/sessions/:id/note` | JWT | ✅ |
| POST | `/sessions/:id/share-report` | JWT+Therapist | ✅ |
| POST | `/sessions/:id/offline-bill/send` | JWT+Therapist | ✅ |
| POST | `/sessions/:id/offline-bill/mark-paid` | JWT+Therapist | ✅ |
| POST | `/sessions/:id/invite` | JWT+Therapist | ✅ |

**Billing** (21 endpoints)
| Method | Route | Auth | Status |
|--------|-------|------|--------|
| GET | `/billing/plans` | **Public** | ✅ |
| GET | `/billing/plans/:id` | **Public** | ✅ |
| POST | `/billing/patient-session/checkout` | **Public** | ❌ CRITICAL BUG |
| GET | `/billing/subscription` | JWT | ✅ |
| POST | `/billing/checkout` | JWT | ✅ |
| POST | `/billing/cancel` | JWT | ✅ |
| GET | `/billing/invoices` | JWT | ✅ |
| GET | `/billing/summary` | JWT | ✅ |
| GET | `/billing/usage/me` | JWT+Therapist | ✅ |
| POST | `/billing/charges/:id/checkout` | JWT | ✅ |
| POST | `/billing/subscribe` | JWT | ✅ |
| POST | `/billing/wallet/payout-request` | JWT+Therapist | ✅ |
| GET | `/billing/wallet` | JWT+Therapist | ✅ |
| POST | `/billing/wallet/pay-subscription` | JWT+Therapist | ✅ |
| GET | `/billing/admin/plans` | JWT+SuperAdmin | ✅ |
| POST | `/billing/admin/plans` | JWT+SuperAdmin | ✅ |
| PUT | `/billing/admin/plans/:id` | JWT+SuperAdmin | ✅ |
| PATCH | `/billing/admin/plans/:id/toggle` | JWT+SuperAdmin | ✅ |
| POST | `/billing/admin/charges/:id/mark-paid` | JWT+Admin | ✅ |
| GET | `/billing/admin/payout-requests` | JWT+Admin | ✅ |
| PATCH | `/billing/admin/payout-requests/:id/process` | JWT+Admin | ✅ |
| POST | `/billing/webhook` | **Public** | ✅ (Stripe sig) |

**AI** (11 endpoints)
| Method | Route | Auth | Status |
|--------|-------|------|--------|
| POST | `/ai/sessions/:id/notes/generate` | JWT+Therapist | ✅ |
| POST | `/ai/sessions/:id/summary` | JWT+Therapist | ✅ |
| GET | `/ai/sessions/:id/copilot` | JWT+Therapist | ✅ |
| POST | `/ai/sessions/:id/risk-check` | JWT+Therapist | ✅ |
| PATCH | `/ai/notes/:id/approve` | JWT+Therapist | ✅ |
| POST | `/ai/patients/:id/memory/search` | JWT+Therapist | ✅ |
| POST | `/ai/sessions/:id/transcribe` | JWT+Therapist | ✅ |
| POST | `/ai/sessions/:id/chat` | JWT | ✅ |
| POST | `/ai/assistant/chat` | JWT+Therapist | ✅ |
| GET | `/ai/assistant/credits` | JWT+Therapist | ✅ |
| POST | `/ai/chat/anonymous` | **Public** | ✅ |

**Therapists** (12 endpoints), **Patients** (15 endpoints), **Notes** (6), **Assessments** (9), **Memory** (10), **Treatment Plans** (7), **Referrals** (4), **Reports** (4), **Organizations** (5), **Admin** (26), **Analytics** (10), **Notifications** (16), **Workflows** (15), **Radar** (7), **Booking** (7), **Marketplace** (4), **Crisis** (3), **Contact** (1), **Messages** (6), **Data-lifecycle** (0 HTTP)

**Total HTTP endpoints: ~200**

### Orphaned / Inconsistent Endpoints

| Issue | Detail |
|-------|--------|
| `GET /analytics/platform/dashboard` exists but admin analytics page doesn't call it | Frontend using mock data |
| `GET /admin/ai/governance` exists but no clear frontend consumption found | Partial |
| Push device endpoints (`/notifications/push-devices`) exist; no FCM/APNs integration in backend | Dead ends |
| `POST /ai/chat/anonymous` exists; `/chat` page returns `notFound()` | Orphaned backend |
| Break-glass endpoint logs access but no downstream enforcement visible | Partial implementation |

---

## 10. PHASE 8 — SECURITY AUDIT

### 10.1 Critical Findings

#### CRITICAL-1: Client-Controlled Payment Price
**File:** `backend/src/modules/billing/billing.controller.ts`
**Severity:** Critical
**CVSS:** 9.1 (Network, Low complexity, No privileges required, No user interaction)

```typescript
@Public()
@Post("patient-session/checkout")
createPatientSessionCheckout(@Body() body: {
  price_cents: number;  // ← Client-provided, passed directly to Stripe
  ...
}) { ... }
```

**Attack:** `POST /api/v1/billing/patient-session/checkout` with `price_cents: 1` creates a Stripe checkout for $0.01 for any session.
**Fix:** Fetch `session.session_price_cents` from DB using `session_id` + `join_token`; validate; reject if client price doesn't match.

#### CRITICAL-2: Hardcoded API Key in Production UI
**File:** `apps/therapist/app/(dashboard)/settings/page.tsx:378`
**Severity:** Critical (data integrity)

```typescript
navigator.clipboard.writeText("sk_live_24therapy_abc123xyz");
```

This is a placeholder/stub API key feature that was never implemented. The key is fake, but its presence signals incomplete implementation and could confuse users into thinking their API key is `sk_live_24therapy_abc123xyz`.

**Fix:** Either implement real API key generation (CRUD endpoint + hashed storage) or remove the API Keys UI tab entirely.

### 10.2 High-Severity Findings

#### HIGH-1: No Rate Limiting on Payment and Auth Endpoints
**Affected routes:** `/auth/login`, `/auth/register`, `/sessions/join/:token`, `/sessions/join/:token/pay`, `/billing/patient-session/checkout`

Global ThrottlerModule is configured (100/min) but `@Public()` routes may not be effectively throttled per-user since there's no user identity. Per-IP throttling depends on `X-Forwarded-For` being correctly forwarded by Railway/reverse proxy.

**Fix:** Add explicit `@Throttle({ short: { ttl: 60000, limit: 5 } })` on auth and payment endpoints.

#### HIGH-2: Message Encryption Plaintext Fallback
**File:** `backend/src/modules/messages/messages.service.ts`

If `MESSAGE_ENCRYPTION_KEY` is absent from environment, messages are stored in plaintext. `MESSAGE_ENCRYPTION_KEY` is NOT in the required production env validation in `env.validation.ts` — it will not block startup if missing.

**Risk:** PHI (therapist-patient messages) stored unencrypted in production database.
**Fix:** Add `MESSAGE_ENCRYPTION_KEY` to `validateEnv()` required fields; throw on missing in production.

#### HIGH-3: PHI Transmitted to OpenAI Without Confirmed BAA
**File:** `backend/src/modules/ai/context-builder.service.ts`

`buildSessionContext()` assembles patient name, diagnoses, medications, session history, and current transcript — all PHI — and sends it to OpenAI's API.

HIPAA requires a signed Business Associate Agreement with any entity that processes PHI. OpenAI offers a BAA under its enterprise tier. CLAUDE.md confirms: "Must before first real patient: Sign BAAs (OpenAI)."

**Current status:** No code evidence of BAA; per documentation, unsigned.

#### HIGH-4: Crisis Alert Fire-and-Forget
**File:** `backend/src/modules/sessions/sessions.service.ts`

```typescript
this.crisisService.handleKeywordHit(...).catch((err) => {
  this.logger.error(`[CRISIS SCAN] handleKeywordHit failed: ${err?.message}`);
});
```

If the crisis service fails (DB error, OOM), the alert is lost. No retry, no queue, no dead-letter. For a life-safety system, this is a material risk.

**Fix:** Use a durable queue (BullMQ/Redis) or at minimum save the keyword-match synchronously before attempting the async alert pipeline.

### 10.3 Medium-Severity Findings

#### MEDIUM-1: Stripe Webhook Empty-String Secret
**File:** `billing.service.ts`
```typescript
const webhookSecret = this.config.get("stripe.webhookSecret");
event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret || "");
```
If `STRIPE_WEBHOOK_SECRET` is not set, `webhookSecret` is `""`. Stripe's `constructEvent` will reject signatures when the secret is empty — but only at runtime. Add explicit throw if secret is unset in production.

#### MEDIUM-2: `buildOrgFilter()` String Interpolation
**File:** `backend/src/database/database.service.ts`
```typescript
buildOrgFilter(organizationId: string, alias = ''): string {
  const prefix = alias ? `${alias}.` : '';
  return `${prefix}organization_id = '${organizationId}'`;
}
```
`organizationId` comes from JWT payload, which is controlled at token issuance — low direct injection risk. However, the pattern violates parameterized query best practices and creates a maintenance hazard.

#### MEDIUM-3: Break-Glass Access Log-Only
**File:** `backend/src/modules/admin/admin.controller.ts`

The `/admin/break-glass` endpoint logs emergency access but imposes no enforcement barrier. A rogue admin can access any patient data without triggering a second-factor check or approval flow.

#### MEDIUM-4: Password Reset Token in Console Log (Dev)
If `RESEND_API_KEY` not set, password reset token logs to stdout. In Railway, stdout is the log stream — potentially visible to anyone with Railway access.

### 10.4 Security Strengths

| Strength | Evidence |
|----------|---------|
| Default-deny JWT guard | `APP_GUARD: JwtAuthGuard` in app.module.ts |
| Account lockout | 5 failures → 15-minute lock in auth.service.ts |
| bcrypt cost 12 | `BCRYPT_ROUNDS` default 12 in env config |
| Production env validation | `validateEnv()` rejects weak secrets (<32 chars) |
| CORS strict whitelist | `buildCorsOriginFn()` — no wildcard in production |
| Stripe webhook signature | `stripe.webhooks.constructEvent()` correctly used |
| PHI audit logging | `PhiAuditInterceptor` on all PHI routes |
| Sentry PHI scrubbing | `beforeSend: delete event.request.data` |
| Refresh token rotation | Hashed storage + revocation on use |
| AES-256-GCM message encryption | Correct IV generation per message |
| Audit log append-only | RLS policy blocking UPDATE/DELETE on audit_logs |
| Patient receives no risk data | `crisis_support` event has zero clinical detail |
| X-Frame-Options: DENY | On therapist, patient, admin portals |

### 10.5 Security Score Summary

| Category | Score | Key Issues |
|----------|-------|-----------|
| Authentication | 82/100 | Strong; minor token leakage in dev |
| Authorization | 78/100 | Good RBAC; org isolation mostly correct |
| Data protection | 55/100 | Encryption fallback risk; OpenAI BAA missing |
| Input validation | 60/100 | CRITICAL price bypass; mostly good elsewhere |
| Rate limiting | 45/100 | Global throttler; no specific limits on high-risk endpoints |
| API security | 70/100 | Good guard structure; Stripe webhook correct |
| Infrastructure | 65/100 | Helmet, CORS, HSTS on some apps |
| **Overall** | **65/100** | CRITICAL bug drops score significantly |

---

## 11. PHASE 9 — HIPAA / HEALTHCARE COMPLIANCE AUDIT

### 11.1 Technical Safeguards (§164.312)

| Requirement | Implementation | Status |
|-------------|---------------|--------|
| **Access Control (§164.312(a))** | JWT + RBAC + org scoping | ✅ |
| **Unique User Identification** | UUID per user, email unique per org | ✅ |
| **Emergency Access (§164.312(a)(2)(ii))** | `break_glass_access` table + endpoint | ⚠️ Log-only, no enforcement |
| **Automatic Logoff** | 15-minute access token expiry | ✅ |
| **Encryption at Rest** | Messages AES-256-GCM (if key set); DB at rest depends on Neon | ⚠️ Conditional |
| **Encryption in Transit** | HTTPS (Vercel/Railway TLS) + WSS | ✅ |
| **Audit Controls (§164.312(b))** | `phi_access_log` + `audit_logs` | ✅ |
| **Integrity (§164.312(c))** | Data validation, DB constraints | ✅ |
| **Authentication (§164.312(d))** | JWT + bcrypt + MFA schema | ✅ |
| **Transmission Security (§164.312(e))** | TLS on all channels | ✅ |

### 11.2 Administrative Safeguards (§164.308)

| Requirement | Status | Notes |
|-------------|--------|-------|
| **Security Officer Designated** | ❌ Not done | CLAUDE.md: "Must before first real patient" |
| **Risk Analysis** | ⚠️ Partial | Audit report exists; no formal Risk Analysis document |
| **Sanctions Policy** | ❌ Not found | No policy document |
| **Workforce Training** | ❌ Not found | No training records/modules |
| **BAAs Signed** | ❌ None | Railway, Vercel, OpenAI, Resend, Daily.co all unsigned |
| **Incident Response Plan** | ✅ | `ops/INCIDENT_RESPONSE.md` — comprehensive |
| **Contingency Plan** | ⚠️ Partial | Backup verify script; no tested DR procedure |
| **Business Continuity** | ❌ Not documented | Relies on Railway/Neon SLAs |

### 11.3 Physical Safeguards (§164.310)

Hosted on Railway (backend) and Vercel (frontends) and Neon (database) — these providers must sign BAAs. Physical security is delegated to cloud providers, which is acceptable if BAAs are in place.

### 11.4 PHI Data Flow Analysis

```
Patient browser
  → HTTPS
    → Vercel Edge (Next.js)
      → Railway API (NestJS) ← JWT auth
        → Neon PostgreSQL ← PHI at rest (encryption depends on Neon config)
        → OpenAI API ← PHI (transcripts, patient context) ← NO BAA CONFIRMED
        → Resend (email) ← PHI (session invites, reports) ← NO BAA CONFIRMED
        → Daily.co (video) ← Audio/Video PHI ← NO BAA CONFIRMED
        → AWS S3 ← Recording storage ← NO BAA (recordings not implemented yet)
```

### 11.5 Data Retention Implementation

**HIPAA §164.530(j) requires 6-year retention for policy documentation.**

Cron jobs in `data-lifecycle.service.ts`:
- PHI access logs purged after 6 years ✅
- Patient erasure requests hard-deleted after 30-day hold ✅
- Monthly retention report logged ✅

Schema: `data_retention_policies` table allows per-org configuration ✅

**Gap:** No evidence of encrypted backup with 6-year retention for session recordings (schema exists in `session_recordings` but S3 upload route not found).

### 11.6 HIPAA Compliance Score

| Domain | Score | Blockers |
|--------|-------|---------|
| Technical Safeguards | 68/100 | Encryption conditional; break-glass enforcement missing |
| Administrative Safeguards | 25/100 | No BAAs, no Security Officer, no workforce training |
| Physical Safeguards | 70/100 | Cloud-hosted; BAAs needed from providers |
| Patient Rights | 80/100 | Export and erasure endpoints implemented |
| Breach Notification | 75/100 | Template exists; 60-day deadline tracked |
| **Overall HIPAA Score** | **48/100** | **Platform CANNOT legally handle real patient PHI without BAAs** |

---

## 12. PHASE 10 — AI AUDIT

### 12.1 AI Architecture

```
┌─────────────────────────────────────┐
│         ModelGatewayService          │
│  Routes requests to appropriate model│
│  Tracks cost, latency, tokens        │
│  Falls back to mock if unavailable   │
└───────────┬─────────────────────────┘
            │
    ┌───────▼────────────────────────┐
    │       AIService                │
    │  generateSOAPNote()            │
    │  generateSummary()             │
    │  getCopilotSuggestions()       │
    │  detectRisk()                  │
    │  transcribeAudio()             │
    │  semanticMemorySearch()        │
    │  sessionChat()                 │
    │  assistantChat()               │
    └───────┬────────────────────────┘
            │
    ┌───────▼────────────────────────┐
    │    ContextBuilderService       │
    │  Builds rich patient context   │
    │  Formats for prompt injection  │
    │  Includes PHI                  │
    └────────────────────────────────┘
```

### 12.2 Model Usage

| Task | Model | Cost (per OpenAI pricing) |
|------|-------|--------------------------|
| SOAP/DAP/BIRP note generation | gpt-4o | $5/$15 per 1M tokens |
| Session summary | gpt-4o | $5/$15 per 1M tokens |
| Live copilot suggestions | gpt-4o-mini | $0.15/$0.60 per 1M tokens |
| Chat (assistant, session) | gpt-4o-mini | $0.15/$0.60 per 1M tokens |
| Risk assessment | gpt-4o | $5/$15 per 1M tokens |
| Memory extraction | gpt-4o (inferred) | $5/$15 per 1M tokens |
| Transcription | whisper-1 | $0.006/minute |
| Embeddings (memory search) | text-embedding-3-small | $0.02 per 1M tokens |
| (Registered but inactive) | claude-sonnet-4-6 | — |

**Cost per session (estimated at 50-minute session):**
- Whisper transcription: ~$0.30
- SOAP note: ~$0.15 (1,500 tokens input, 500 output)
- Copilot (5 requests): ~$0.01
- Memory extraction: ~$0.05
- **Total AI cost per session: ~$0.51**

At PAYG pricing of $6/session with 85/15 split: therapist earns $5.10, platform earns $0.90. AI cost of $0.51 consumes **57% of platform margin**. This is not sustainable at scale without pricing adjustment.

### 12.3 Prompt Management

Prompt registry table (`prompt_registry`) stores versioned prompts with:
- Template with variable interpolation
- Output schema definition
- Performance metrics
- A/B test group support

5 prompts registered in seed data: SOAP_NOTE_V1, SESSION_SUMMARY_V1, MEMORY_EXTRACTION_V1, RISK_ASSESSMENT_V1, COPILOT_SUGGESTIONS_V1.

**Gap:** `backend/src/modules/ai/prompts.ts` exists as a centralized prompt registry in code — but it's unclear if the DB-based registry (`prompt_registry` table) or the code-based registry takes precedence. Two prompt management systems create confusion.

### 12.4 AI Safety

| Concern | Implementation | Status |
|---------|---------------|--------|
| PHI in AI prompts | Patient name, diagnoses, history sent to OpenAI | ⚠️ BAA needed |
| Prompt injection via user content | Transcript segments inserted into prompts | ⚠️ No sanitization |
| Crisis detection accuracy | Keyword list (25+) + GPT-4o refinement | ✅ Layered approach |
| AI note accuracy | Therapist review + approval step before finalization | ✅ |
| Hallucination risk | Notes marked draft until therapist approves | ✅ |
| AI credit gating | `ai_assistant_credits` table; balance checked | ✅ |
| Cost runaway | Per-request cost logging; no hard spending cap found | ⚠️ |
| Fallback on OpenAI outage | Mock responses returned | ⚠️ Silent failure |

### 12.5 Transcription Pipeline

Browser MediaRecorder → audio chunks → `POST /ai/sessions/:id/transcribe` → Whisper API → segments stored → crisis scan → copilot suggestions.

**Gap:** Audio chunks are sent directly to Whisper without intermediate storage. If the upload fails mid-session, segments are lost. No resume/retry mechanism found.

### 12.6 AI Audit Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| Capability | 85/100 | GPT-4o for notes; Whisper transcription; memory; crisis detection |
| Safety | 60/100 | Human-in-loop approval; BAA gap; no cost cap |
| Cost management | 55/100 | Per-request logging; economics challenging at PAYG pricing |
| Reliability | 60/100 | Silent mock fallback; no retry on transcript loss |
| PHI Protection | 35/100 | PHI sent to OpenAI; no de-identification |
| **Overall** | **60/100** | Strong capability; compliance and reliability gaps |

---

## 13. PHASE 11 — DEVOPS AUDIT

### 13.1 Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      PRODUCTION                          │
│                                                         │
│  Vercel                    Railway                      │
│  ├── apps/web  :3000      ├── backend :4000             │
│  ├── apps/therapist :3001 │     ├── Pre-deploy: migrate  │
│  ├── apps/patient :3002   │     └── Health: /health      │
│  └── apps/admin :3003     │                             │
│                           Neon PostgreSQL (pg 16 + vec) │
│                           Redis (optional, no Upstash)  │
└─────────────────────────────────────────────────────────┘
```

### 13.2 CI/CD Pipeline

**GitHub Actions (`ci.yml`):**
- Backend: Jest unit tests on PostgreSQL service container
- Type check: All 4 Next.js apps + backend
- Builds: Parallel matrix across all 4 apps
- Security audit: `pnpm audit --audit-level=high`
- Gate: All jobs must pass

**Current state:** ❌ BROKEN. Every job fails instantly:
> "The job was not started because your account is locked due to a billing issue."

This means:
1. No automated testing on any push since the billing lock began
2. No type checking gate
3. No build validation
4. No security audit

**Effective test gate:** Vercel preview deployments (type checking happens during Next.js build).

### 13.3 Docker Configuration

**Backend Dockerfile (single-stage, Node 20 Alpine):**
```dockerfile
# Build assertion in Dockerfile:
test -f /app/backend/dist/backend/src/main.js
```
Build fails explicitly if compiled output is missing. ✅

**Next.js Dockerfiles (3-stage: base, build, runner):**
- All use `output: 'standalone'` ✅
- Soft-fail on `public/` directory copy (some apps don't have one) ✅

**docker-compose.yml includes:**
- PostgreSQL 16 + pgvector ✅
- Redis 7 ✅
- Optional: Redis Commander, Adminer, Mailhog (dev tools) ✅
- Optional: Prometheus, Grafana (scaffolded but config files not found) ⚠️

### 13.4 Deployment Process

**Railway (backend):**
- Auto-deploy on push to `main`
- Pre-deploy: `node scripts/migrate.js --auto-baseline` (runs migrations before startup)
- Start: `node backend/dist/backend/src/main.js`
- Health check: `GET /health` with 120s timeout
- Restart: ON_FAILURE, max 3 retries

**Risk:** Migration failures will block deployment. `--auto-baseline` flag mitigates checksum conflicts but may mask genuine schema drift.

**Vercel (frontends):**
- Auto-deploy on push to `main`
- Per-project deployments (not monorepo deployment)
- Build: `pnpm turbo build --filter=@24therapy/<app>`
- Preview deployments on every PR ✅

### 13.5 Monitoring

| Tool | Status | Notes |
|------|--------|-------|
| Sentry | ✅ Configured | All 5 apps; PHI scrubbing; requires `SENTRY_DSN` |
| Railway logs | ✅ Available | 72-hour retention noted in runbook |
| Prometheus | ❌ Not wired | `infra/` scaffolded but no metrics exported from NestJS |
| Grafana | ❌ Not wired | No dashboards configured |
| Alerting | ❌ None | No PagerDuty, no on-call rotation |
| Uptime monitoring | ❌ None | No external ping/uptime checker found |

### 13.6 Secrets Management

| Secret | Location | Risk |
|--------|----------|------|
| `JWT_SECRET` | Railway env var | Rotation invalidates all sessions |
| `COOKIE_SECRET` | Railway env var | Same |
| `STRIPE_SECRET_KEY` | Railway env var | ✅ |
| `OPENAI_API_KEY` | Railway env var | ✅ |
| `MESSAGE_ENCRYPTION_KEY` | Railway env var (optional) | ⚠️ Not required → plaintext fallback |
| `RESEND_API_KEY` | Railway env var (optional) | ⚠️ Not required → console.log fallback |
| `DAILY_API_KEY` | Railway env var (optional) | ⚠️ Video broken if missing |

No secrets vault (HashiCorp Vault, AWS Secrets Manager) used. Railway's environment variables are the sole secrets store — adequate for early stage.

### 13.7 Backup and Disaster Recovery

| Aspect | Status | Notes |
|--------|--------|-------|
| Database backup | Neon-managed | Neon provides continuous WAL and daily snapshots |
| Backup verification | ✅ Script exists | `scripts/backup-verify.js` monthly row count comparison |
| Tested restore | ❌ Not confirmed | Script exists; no evidence of successful test |
| RTO (Recovery Time Objective) | Unknown | Not documented |
| RPO (Recovery Point Objective) | ~1 day | Neon daily snapshots |
| Session recording archive | ❌ Not implemented | Schema exists; S3 upload not found |

### 13.8 DevOps Score

| Dimension | Score | Key Issues |
|-----------|-------|-----------|
| CI/CD | 20/100 | CI broken; no automated gate |
| Containerization | 80/100 | All services Dockerized; well structured |
| Deployment | 72/100 | Railway + Vercel automated; migration pre-deploy |
| Monitoring | 30/100 | Sentry only; no metrics, no alerting |
| Secrets management | 65/100 | Railway env vars; no vault |
| Backup/DR | 50/100 | Neon-managed; no tested restore |
| **Overall** | **52/100** | CI gap and monitoring gap are material risks |

---

## 14. PHASE 12 — ENVIRONMENT VARIABLES AUDIT

### 14.1 Complete Variable Inventory

| Variable | Required (prod) | Used | Default | Security Level | Risk if Missing |
|----------|:-:|:-:|---------|----------------|-----------------|
| `DATABASE_URL` | ✅ | ✅ | — | Critical | App won't start |
| `DATABASE_SSL` | — | ✅ | true in prod | Low | Unencrypted DB conn |
| `DATABASE_MAX_CONNECTIONS` | — | ✅ | 10 | Low | Performance |
| `JWT_SECRET` | ✅ | ✅ | — | Critical | App won't start (<32 chars) |
| `COOKIE_SECRET` | ✅ | ✅ | — | Critical | App won't start (<32 chars) |
| `OPENAI_API_KEY` | ✅ | ✅ | — | Critical | AI features unavailable |
| `CORS_ORIGINS` | ✅ | ✅ | — | Critical | App won't start in prod |
| `NODE_ENV` | — | ✅ | development | Low | Dev behavior in prod |
| `PORT` | — | ✅ | 4000 | Low | Wrong port |
| `REDIS_URL` | — | ✅ | localhost:6379 | Medium | Rate limiting degraded |
| `STRIPE_SECRET_KEY` | — | ✅ | — | High | Billing broken |
| `STRIPE_PUBLISHABLE_KEY` | — | ✅ | — | Medium | Checkout broken |
| `STRIPE_WEBHOOK_SECRET` | — | ✅ | — | High | Webhooks unverified |
| `RESEND_API_KEY` | — | ✅ | — | Medium | Email → console.log |
| `FROM_EMAIL` | — | ✅ | noreply@24therapy.ai | Low | |
| `DAILY_API_KEY` | — | ✅ | — | High | Video sessions broken |
| `DAILY_DOMAIN` | — | ✅ | — | Medium | |
| `MESSAGE_ENCRYPTION_KEY` | — | ✅ | — | **CRITICAL** | PHI messages in plaintext |
| `SENTRY_DSN` | — | ✅ | — | Medium | No error tracking |
| `AWS_ACCESS_KEY_ID` | — | ✅ | — | High | File uploads broken |
| `AWS_SECRET_ACCESS_KEY` | — | ✅ | — | High | File uploads broken |
| `AWS_REGION` | — | ✅ | us-east-1 | Low | |
| `AWS_S3_BUCKET` | — | ✅ | 24therapy-files | Low | |
| `CLOUDFRONT_URL` | — | ✅ | — | Low | |
| `BCRYPT_ROUNDS` | — | ✅ | 12 | Low | |
| `JWT_ACCESS_EXPIRY` | — | ✅ | 15m | Low | |
| `JWT_REFRESH_EXPIRY` | — | ✅ | 30d | Low | |
| `ANTHROPIC_API_KEY` | — | Registered | — | Low | No active Anthropic calls found |
| `FRONTEND_URL` | — | ✅ | localhost:3000 | Low | Wrong redirect URLs |
| `THERAPIST_URL` | — | ✅ | localhost:3001 | Low | |
| `THERAPIST_APP_URL` | — | ✅ | localhost:3001 | Low | Duplicate of above |
| `PATIENT_URL` | — | ✅ | localhost:3002 | Low | |
| `ADMIN_URL` | — | ✅ | localhost:3003 | Low | |
| `FEATURE_AI_SCRIBE` | — | ✅ | enabled | Low | |
| `FEATURE_COPILOT` | — | ✅ | enabled | Low | |
| `FEATURE_RADAR` | — | ✅ | enabled | Low | |
| `FEATURE_BILLING` | — | ✅ | enabled | Low | |
| `FEATURE_MARKETPLACE` | — | ✅ | false | Low | |
| `STAGING_DATABASE_URL` | — | ✅ | — | Medium | Backup verify fails |
| `ADMIN_EMAIL` | — | ✅ | — | Low | Payout alerts not sent |

### 14.2 Frontend Environment Variables

All 4 Next.js apps use `NEXT_PUBLIC_` prefix for client-exposed variables:

| Variable | Purpose | All Apps |
|----------|---------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | ✅ All |
| `NEXT_PUBLIC_WEB_URL` | Marketing site URL | ✅ All |
| `NEXT_PUBLIC_THERAPIST_URL` | Therapist portal URL | ✅ All |
| `NEXT_PUBLIC_PATIENT_URL` | Patient portal URL | ✅ All |
| `NEXT_PUBLIC_ADMIN_URL` | Admin portal URL | ✅ All |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side error tracking | ✅ All |
| `NEXT_PUBLIC_CALENDLY_URL` | Demo booking link (web only) | Web only |

**Note:** `NEXT_PUBLIC_` variables are embedded at build time and visible in browser. No secrets exposed via this mechanism — all are public URLs. ✅

### 14.3 Missing Required Variables (Production Blockers)

These variables have no server-side enforcement but will silently break production features:

```env
# MUST add to Railway before go-live:
MESSAGE_ENCRYPTION_KEY=<openssl rand -hex 32>    # PHI messages unencrypted without this
STRIPE_WEBHOOK_SECRET=<from Stripe dashboard>    # Webhooks unverified without this
DAILY_API_KEY=<from Daily.co dashboard>          # Video sessions fail without this
RESEND_API_KEY=<from Resend dashboard>           # Emails log to stdout without this
```

---

## 15. PHASE 13 — DEPLOYMENT READINESS

### 15.1 Can This Be Deployed Today?

| Question | Answer | Evidence |
|----------|--------|---------|
| Can backend deploy to Railway? | ✅ Yes | Dockerfile + railway.json present |
| Can frontends deploy to Vercel? | ✅ Yes | vercel.json in all 4 apps |
| Can migrations run? | ✅ Yes | migrate.js with auto-baseline |
| Can it support real users? | ⚠️ Limited | CRITICAL billing bug blocks real payments |
| Can payments be accepted? | ❌ NO | Price bypass vulnerability |
| Can sessions run? | ✅ Yes | Requires DAILY_API_KEY |
| Can notes generate? | ✅ Yes | Requires OPENAI_API_KEY |
| Can therapists onboard? | ✅ Yes | Verification workflow complete |
| Can patients join? | ✅ Yes | Join token flow complete |
| Can admins manage? | ✅ Yes | Admin portal functional |
| Can Stripe process payments? | ❌ NO | CRITICAL price bug; must fix first |
| Can AI workflows function? | ✅ Yes | Requires OPENAI_API_KEY |
| Can infrastructure survive load? | ⚠️ Unknown | No load test; Neon connection pooling; no Redis required |
| Is it HIPAA compliant? | ❌ NO | BAAs unsigned |

### 15.2 Production Readiness Scores

| Dimension | Score | Blockers |
|-----------|-------|---------|
| **Frontend** | 72 / 100 | Admin analytics mock; hardcoded API key; system health fake |
| **Backend** | 74 / 100 | CRITICAL billing price bug |
| **Database** | 76 / 100 | Migration numbering gap; no partition extension plan |
| **Security** | 42 / 100 | CRITICAL price bypass; hardcoded key; no rate limits on payment endpoints |
| **DevOps** | 52 / 100 | CI dead; no monitoring/alerting; no load testing |
| **Compliance** | 48 / 100 | BAAs unsigned; no Security Officer; no staff training |
| **Payments** | 38 / 100 | CRITICAL price bypass must be fixed before any real transaction |
| **AI** | 67 / 100 | Strong capability; PHI to OpenAI without BAA |
| **Overall Platform** | **58 / 100** | Demo-ready; not production-safe |

### 15.3 Blockers by Priority

**Must fix before accepting any real money (P0):**
1. Validate `price_cents` server-side in `/billing/patient-session/checkout`

**Must fix before onboarding real patients (P0-HIPAA):**
2. Sign BAAs: OpenAI, Railway, Vercel, Resend, Daily.co
3. Add `MESSAGE_ENCRYPTION_KEY` to required production env validation
4. Designate Security Officer

**Must fix before GA (P1):**
5. Wire admin analytics page to real API (`GET /analytics/platform/dashboard`)
6. Replace hardcoded API key with real implementation or remove
7. Add rate limiting on auth and payment endpoints
8. Fix/restore CI pipeline (GitHub billing)
9. Connect Prometheus + Grafana or equivalent monitoring

**Should fix before Series A diligence (P2):**
10. Add 2FA enforcement on break-glass access
11. Complete pentest
12. Add per-IP rate limiting on join token endpoint
13. Enforce `MESSAGE_ENCRYPTION_KEY` required
14. Wire real system health checks in admin dashboard
15. Document and test DR procedure

---

## 16. PHASE 14 — TECHNICAL DEBT TOP 100

### Critical (Fix Before Go-Live)

| # | Item | Estimated Effort |
|---|------|-----------------|
| 1 | Server-side price validation in patient session checkout | 2 hours |
| 2 | Remove/replace hardcoded `sk_live_24therapy_abc123xyz` in settings.tsx | 1 day (if implementing real API keys) |
| 3 | Sign BAAs with all 5 vendors | 1–2 weeks (legal/vendor process) |
| 4 | Add `MESSAGE_ENCRYPTION_KEY` to `validateEnv()` required fields | 1 hour |
| 5 | Add `@Throttle()` to auth endpoints (login, register, forgot-password) | 2 hours |
| 6 | Add `@Throttle()` to public payment and join endpoints | 2 hours |
| 7 | Fix crisis alert to use durable queue instead of fire-and-forget | 3 days |
| 8 | Fix GitHub Actions billing — restore CI | 1 hour (account action) |
| 9 | Designate Security Officer | Organizational |
| 10 | Wire admin analytics to `GET /analytics/platform/dashboard` | 1 day |

### High Priority

| # | Item | Estimated Effort |
|---|------|-----------------|
| 11 | Replace system health hardcoded array with real health endpoint | 1 day |
| 12 | Add 2FA / approval requirement for break-glass access | 3 days |
| 13 | Add `STRIPE_WEBHOOK_SECRET` to required env validation | 1 hour |
| 14 | Replace string interpolation in `buildOrgFilter()` with parameterized binding | 2 hours |
| 15 | Add partition extension plan for `analytics_events` (2027+) | 1 day |
| 16 | Add `phi_access_log` partitioning (high write volume) | 2 days |
| 17 | Wire push notification FCM/APNs integration | 1 week |
| 18 | Implement session recording S3 upload pipeline | 1 week |
| 19 | Add OpenAI PHI de-identification layer (or use OpenAI API through BAA tier) | 1 week |
| 20 | Resolve password reset token console.log fallback in dev | 2 hours |
| 21 | Add Redis Bull queue for email delivery (replace fire-and-forget) | 3 days |
| 22 | Add cost cap / spend alert on OpenAI usage | 1 day |
| 23 | Implement Prometheus metrics in NestJS (`prom-client`) | 3 days |
| 24 | Connect Grafana dashboards | 2 days |
| 25 | Add external uptime monitoring (Pingdom, Better Uptime) | 1 hour |
| 26 | Add PagerDuty / on-call rotation | 1 day |
| 27 | Add missing composite index: `(sessions.therapist_id, sessions.scheduled_at)` | 1 hour |
| 28 | Add missing index: `conversations.patient_id` | 30 minutes |
| 29 | Test and document DB restore from Neon backup | 1 day |
| 30 | Replace hardcoded billing plan cards in therapist billing page | 4 hours |

### Medium Priority

| # | Item | Estimated Effort |
|---|------|-----------------|
| 31 | Connect blog CMS (Contentful / Sanity) to `/blog/[slug]` | 3 days |
| 32 | Wire status page to real health API | 1 day |
| 33 | Add IVFFlat index maintenance job for pgvector | 2 hours |
| 34 | Add retry logic to audio chunk transcription | 1 day |
| 35 | Deduplicate `THERAPIST_URL` / `THERAPIST_APP_URL` env vars | 1 hour |
| 36 | Add formal Risk Analysis document (HIPAA §164.308(a)(1)) | 1 week |
| 37 | Create workforce training materials | 2 weeks |
| 38 | Create sanctions policy documentation | 2 days |
| 39 | Add business continuity plan | 1 week |
| 40 | Remove `ANTHROPIC_API_KEY` env var if no Anthropic calls exist | 30 minutes |
| 41 | Clarify which prompt system is authoritative (code vs DB registry) | 1 day |
| 42 | Add prompt injection sanitization for transcript content in AI prompts | 2 days |
| 43 | Add cost-per-session tracking UI in admin analytics | 3 days |
| 44 | Fix WebSocket heartbeat / ping-pong to handle stale rooms | 1 day |
| 45 | Add `audit_logs` archival strategy (currently unbounded) | 2 days |
| 46 | Document RTO/RPO targets | 1 day |
| 47 | Add `Strict-Transport-Security` header to web app | 1 hour |
| 48 | Change web app `X-Frame-Options` from SAMEORIGIN to DENY | 30 minutes |
| 49 | Add `Content-Security-Policy` headers | 2 days |
| 50 | Implement MFA enforcement (schema exists; not enforced in auth flow) | 3 days |
| 51 | Add rate limiting on `/ai/chat/anonymous` endpoint | 2 hours |
| 52 | Resolve silent error swallowing in treatment-plans.service (`.catch(() => [])`) | 1 day |
| 53 | Resolve silent error swallowing in referrals.service | 1 day |
| 54 | Add pagination to WebSocket room member tracking | 2 days |
| 55 | Add session recording 7-year HIPAA retention policy | 1 week |
| 56 | Add `DAILY_API_KEY` to required env validation | 30 minutes |
| 57 | Add `RESEND_API_KEY` to required env validation | 30 minutes |
| 58 | Implement real CRM module (currently routes through notifications) | 2 weeks |
| 59 | Add API key feature (generate/revoke) or remove UI tab | 3 days |
| 60 | Add phone/video direct-call integration in patient messages | 2 weeks |

### Low Priority / Improvements

| # | Item | Estimated Effort |
|---|------|-----------------|
| 61–80 | Replace 20 `catch { /* non-critical */ }` blocks with proper error telemetry | 2 days total |
| 81 | Migrate from `nodemailer` references in package.json to Resend SDK | 1 day |
| 82 | Add drizzle-orm migrations instead of raw SQL (long-term) | 2 weeks |
| 83 | Add GraphQL or tRPC for frontend type safety (long-term) | 1 month |
| 84 | Add input validation on assessment answer values | 1 day |
| 85 | Add cursor-based pagination to all list endpoints | 1 week |
| 86 | Add Redis caching for frequently-read data (marketplace, billing plans) | 3 days |
| 87 | Add structured logging (nestjs-pino) | 2 days |
| 88 | Add log drain (Logtail / Axiom) | 1 day |
| 89 | Implement group therapy session type | 2 weeks |
| 90 | Add patient insurance verification integration | 1 month |
| 91 | Add Calendly API integration (currently custom booking) | 2 weeks |
| 92 | Add EHR integrations (Epic, Cerner) as documented in feature pages | 1 month+ |
| 93 | Add SMS notifications (Twilio) | 1 week |
| 94 | Add mobile app (React Native) for patient portal | 2 months |
| 95 | Add AI session-to-session continuity (memory carry-forward) | 2 weeks |
| 96 | Implement Redis Bull queue for notification delivery | 1 week |
| 97 | Add CAPTCHA to public auth endpoints | 1 day |
| 98 | Add geographic data residency options (EU, Canada) | 1 month |
| 99 | Add session video recording with 7-year encrypted archive | 2 weeks |
| 100 | Complete Playwright E2E test coverage (currently ~10 tests) | 2 weeks |

---

## 17. PHASE 15 — ACQUISITION READINESS

### 17.1 What Would Concern an Acquirer

| Concern | Severity | Impact on Valuation |
|---------|----------|---------------------|
| **CRITICAL billing price bypass** | Blocker | Immediate fix required pre-close |
| **BAAs unsigned** — PHI handling potentially illegal | Blocker | Cannot operate in healthcare without resolution |
| **CI broken** — no automated test gate for 20+ sessions | High | Signals engineering discipline risk |
| **Admin analytics entirely fake data** | High | Due diligence will catch this |
| **AI cost margin (57% per PAYG session)** | High | Unit economics scrutiny |
| **No Security Officer designated** | Medium | HIPAA admin safeguard requirement |
| **No pentest completed** | Medium | Standard healthcare due diligence requirement |
| **Prometheus/monitoring not connected** | Medium | Operational maturity concern |
| **Single developer model (AI-generated code)** | Medium | Bus factor; maintainability questions |
| **Migration history rewrite (017–028 gap)** | Low | DB operations complexity |
| **No load testing** | Low | Unknown scale ceiling |

### 17.2 What Would Impress an Acquirer

| Strength | Impact |
|----------|--------|
| **Scope**: 27 backend modules, 128 pages, 65+ DB tables in ~24 sessions | Exceptional velocity |
| **Architecture quality**: NestJS with proper DI, multi-tenant org isolation, event-driven design | Strong foundation |
| **Database schema depth**: pgvector, partitioning, RLS, GIN indexes, deferred FKs | Enterprise-grade |
| **AI integration breadth**: Notes, summaries, copilot, memory, crisis, transcription | Unique clinical AI depth |
| **HIPAA foundations**: PHI audit log, break-glass, data retention crons, encryption infrastructure | Compliance-ready skeleton |
| **Incident response documentation**: Full P0-P3 playbook, breach notification templates | Operational maturity |
| **Complete deployment automation**: Railway + Vercel + migrate.js pre-deploy | DevOps sophistication |
| **Session monetization**: Wallet, PAYG, subscriptions, Calendly-style booking, 85/15 split | Revenue model clarity |
| **Radar matching engine**: PostgreSQL-based scoring function with weighted factors | Defensible feature |
| **Patient memory / knowledge graph**: 20+ node types, pgvector semantic search | Differentiated clinical AI |

### 17.3 Engineering Maturity Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Code quality** | 70/100 | Consistent patterns; some silent error swallowing |
| **Test coverage** | 35/100 | ~100 unit tests claimed; CI broken; E2E minimal |
| **Documentation** | 65/100 | Good ops docs; CLAUDE.md is detailed; code comments minimal |
| **Security practices** | 45/100 | Good foundations; CRITICAL bug undermines score |
| **Observability** | 30/100 | Sentry only; no metrics/tracing |
| **Scalability** | 60/100 | Stateless API; pg partitioning; no load test |
| **Maintainability** | 60/100 | Good modularity; single contributor; AI-generated |
| **Velocity** | 95/100 | 24 sessions → production-grade platform is remarkable |
| **Overall Engineering Maturity** | **57/100** | Early-stage startup; above average for stage |

### 17.4 Product Maturity Assessment

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Core workflow** (sessions, notes) | 88/100 | Very strong |
| **Patient engagement** | 82/100 | All patient features wired |
| **Billing / monetization** | 55/100 | Architecture strong; CRITICAL bug; economics tight |
| **Marketplace / discovery** | 75/100 | Real search; booking flow complete |
| **Admin / ops** | 62/100 | Analytics fake; management features real |
| **AI capabilities** | 78/100 | Depth impressive; PHI compliance concern |
| **Mobile experience** | 65/100 | Bottom nav present; not a native app |
| **Overall Product Maturity** | **72/100** | Investable for seed/Series A with known gaps |

### 17.5 Estimated Remediation Costs

| Phase | Scope | Timeline | Engineering Cost |
|-------|-------|----------|-----------------|
| **Phase 1 — Legal blockers** | BAAs, Security Officer | 2–4 weeks | Legal + $0 engineering |
| **Phase 2 — Security fixes** | Price bug, rate limits, encryption enforcement | 1 week | 1 engineer |
| **Phase 3 — Compliance fixes** | Break-glass 2FA, staff training, risk analysis | 2–3 weeks | 1 engineer + legal |
| **Phase 4 — Analytics** | Wire admin analytics to real API | 1 week | 1 engineer |
| **Phase 5 — Observability** | Prometheus, Grafana, alerting | 2 weeks | 1 engineer |
| **Phase 6 — CI restoration** | GitHub billing, full test suite | 1 week | 1 engineer |
| **Total to production-safe** | | **6–10 weeks** | **~$40K–$80K** |

### 17.6 Valuation Considerations

**Positive factors:**
- Rare combination of clinical depth + AI-native architecture in a single codebase
- Complete end-to-end platform (not just a feature)
- Revenue model with clear unit economics path (subscription blended margin ~80% at scale)
- HIPAA compliance infrastructure significantly de-risks healthcare go-to-market
- Booking + marketplace creates two-sided network effect opportunity

**Negative factors:**
- CRITICAL security bug in payment flow
- BAAs unsigned — technically operating illegally in healthcare if any real PHI processed
- Admin analytics showing fake data suggests potential investor presentation risk
- Single-contributor (AI) codebase raises long-term maintainability questions
- No actual patient or therapist users confirmed — pre-revenue
- AI unit economics require pricing adjustment ($6 PAYG gives $0.90 platform share before AI cost)

**Comparables:** TherapyNotes, SimplePractice, Headway — all valued at $1B+ but with years of real revenue. 24Therapy is a seed-stage asset with an impressive technical foundation that requires 6–10 weeks of hardening before it can handle real users.

**Recommended pre-money valuation range (seed):** $3M–$8M depending on founder track record, market timing, and speed to resolve blockers. The technical foundation justifies a premium for this stage; the security and compliance gaps create downward pressure.

---

## APPENDIX A — Files Audited

All conclusions in this report are derived from direct code inspection. The following files were read and analyzed:

**Backend:**
- `backend/src/main.ts`, `app.module.ts`
- `backend/src/config/env.validation.ts`, `cors.ts`, `app.config.ts`
- `backend/src/database/database.service.ts`
- `backend/src/common/interceptors/phi-audit.interceptor.ts`
- `backend/src/gateways/events.gateway.ts`
- All 27 `*/module.ts`, `*/controller.ts`, `*/service.ts` files
- `backend/src/modules/ai/model-gateway.service.ts`, `context-builder.service.ts`, `prompts.ts`

**Database:**
- All 20 migration files (`001_extensions.sql` through `032_admin_payouts_bank_details.sql`)
- `scripts/migrate.js`, `scripts/seed.js`

**Frontend:**
- `apps/*/lib/api.ts` (all 4 apps)
- `apps/*/lib/store.ts` (all 4 apps)
- `apps/*/middleware.ts` (all 4 apps)
- `apps/*/next.config.ts` (all 4 apps)
- `apps/admin/app/(dashboard)/analytics/page.tsx` — confirmed mock data
- `apps/admin/app/(dashboard)/dashboard/page.tsx` — confirmed hardcoded health
- `apps/therapist/app/(dashboard)/settings/page.tsx` — confirmed hardcoded API key
- `apps/therapist/app/(dashboard)/billing/page.tsx` — confirmed hardcoded plans
- `apps/therapist/app/(dashboard)/sessions/[id]/room/page.tsx`
- `apps/patient/app/(dashboard)/home/page.tsx`
- `apps/web/app/pricing/page.tsx`

**Infrastructure:**
- `.github/workflows/ci.yml`
- `docker-compose.yml`
- `backend/Dockerfile`
- `apps/*/Dockerfile` (all 4 apps)
- `apps/*/vercel.json` (all 4 apps)
- `railway.json`, `turbo.json`, `pnpm-workspace.yaml`
- `ops/DEPLOYMENT.md`, `ops/RUNBOOK.md`, `ops/INCIDENT_RESPONSE.md`
- `ops/BREACH_NOTIFICATION_TEMPLATE.md`
- `e2e/auth.spec.ts`, `e2e/crisis.spec.ts`, `e2e/helpers/mock-api.ts`
- `playwright.config.ts`, `backend/jest.config.js`

---

## APPENDIX B — Critical Fixes Code Reference

### Fix 1: Server-Side Price Validation (CRITICAL)
**File:** `backend/src/modules/billing/billing.controller.ts`

**Current (broken):**
```typescript
createPatientSessionCheckout(@Body() body: { price_cents: number; session_id: string; join_token: string; ... }) {
  return this.billingService.createPatientSessionCheckout(
    body.session_id, body.therapist_id, body.price_cents, ...
  );
}
```

**Required fix:** Ignore `body.price_cents`; fetch from DB:
```typescript
// In billing.service.ts createPatientSessionCheckout():
const session = await this.db.queryOne(
  `SELECT session_price_cents FROM sessions WHERE id = $1 AND join_token = $2`,
  [sessionId, joinToken]
);
if (!session) throw new NotFoundException('Session not found');
const priceToCharge = session.session_price_cents; // use DB value, not client
```

### Fix 2: Encrypt Messages Enforcement (HIGH)
**File:** `backend/src/config/env.validation.ts`

Add to required production fields:
```typescript
if (!process.env.MESSAGE_ENCRYPTION_KEY && process.env.NODE_ENV === 'production') {
  throw new Error('MESSAGE_ENCRYPTION_KEY is required in production');
}
```

### Fix 3: Rate Limiting on Auth Routes (HIGH)
**File:** `backend/src/modules/auth/auth.controller.ts`

```typescript
import { Throttle } from '@nestjs/throttler';

@Post('login')
@Public()
@Throttle({ short: { ttl: 60000, limit: 5 }, long: { ttl: 3600000, limit: 20 } })
async login(@Body() dto: LoginDto) { ... }
```

---

*Report generated: 2026-06-15*
*Methodology: Code-first. All claims verified against repository files. Documentation used for orientation only.*
*Repository: omarahmedomarahmed/habiba*
*Branch audited: claude/friendly-ritchie-jaaxsw*
