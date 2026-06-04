# CLAUDE.md — 24Therapy.ai Persistent Project Memory
# Mental Health Operating System — AI Session Context File
# Last Updated: 2026-06-04 | Commit: cbbecaf

---

## Project Overview

**24Therapy.ai** is a full-stack Mental Health Operating System (MH-OS) — not just an AI scribe.

The platform serves as the complete operational infrastructure for mental health practices:
- AI-powered session documentation (scribe, notes, summaries)
- Longitudinal Patient Memory Layer (knowledge graphs, intelligence)
- Clinical Workflow Engine (automation, triggers, actions)
- Radar Matching System (patient-to-therapist AI matching)
- Multi-tenant Practice Management
- HIPAA-compliant telehealth infrastructure
- Enterprise / white-label ready
- Acquisition-ready architecture with full API, webhooks, EHR integrations

**GitHub Repository:** `https://github.com/omarahmedomarahmed/habiba.git`
**Branch:** `main`
**Stack:** Next.js 14 App Router + TypeScript + Tailwind CSS + NestJS + PostgreSQL + Redis + OpenAI

---

## Vision

24Therapy.ai empowers therapists by eliminating administrative burden, enabling better clinical outcomes, and connecting patients with care faster. The AI assists, never replaces, the therapist.

Primary revenue: SaaS subscriptions per therapist seat + AI usage overages + marketplace transaction fees.
Target: Solo therapists → Group practices → Clinics → Health systems → Enterprise.

---

## Current Tech Stack

| Layer | Technology |
|-------|-----------|
| Marketing Site | Next.js 14, TypeScript, Tailwind CSS |
| Therapist Portal | Next.js 14 App Router, TypeScript, Tailwind CSS, Zustand |
| Patient Portal | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Admin Portal | Next.js 14 App Router, TypeScript, Tailwind CSS |
| Backend API | NestJS, TypeScript, PostgreSQL (Drizzle ORM), Redis |
| AI | OpenAI GPT-4o, Whisper ASR, Anthropic Claude |
| Real-time | Socket.io (WebSocket gateway) |
| Payments | Stripe (subscriptions + one-time) |
| Email | Not yet configured (planned: Resend/SendGrid) |
| Storage | Not yet configured (planned: AWS S3 / Cloudflare R2) |
| Auth | JWT + Refresh tokens + MFA (TOTP, SMS) |
| Deployment | Vercel (frontends) + Railway/Render (backend) + Supabase/Neon (DB) |

---

## Monorepo Structure

```
/home/user/webapp/
├── apps/
│   ├── web/              # Marketing site — 24therapy.ai
│   ├── therapist/        # Therapist portal — app.24therapy.ai
│   ├── patient/          # Patient portal — my.24therapy.ai
│   └── admin/            # Admin portal — admin.24therapy.ai
├── backend/              # NestJS API — api.24therapy.ai
│   └── src/
│       ├── modules/      # 16 feature modules
│       ├── gateways/     # WebSocket gateway
│       ├── database/     # Drizzle ORM service
│       └── config/       # App configuration
├── packages/
│   └── types/            # Shared TypeScript types (@24therapy/types)
│       └── src/index.ts  # 1,860+ lines, full platform coverage
├── migrations/           # SQL migration files (001-014)
├── *.sql                 # Schema files (14 schema files at root)
├── part-*.md             # PRD documents (35 parts)
├── SETUP.md              # Deployment guide
├── CLAUDE.md             # THIS FILE — AI session memory
├── README.md             # Project overview
├── package.json          # Root monorepo config
├── pnpm-workspace.yaml   # PNPM workspaces
└── turbo.json            # Turborepo config
```

---

## Brand Tokens

```css
--primary: #0A2342      /* Deep navy */
--accent:  #2EC4B6      /* Teal */
--blue:    #1F5EFF      /* Bright blue */
--bg:      #F8FAFC      /* Off-white */
--text:    #0F172A      /* Slate 900 */
```

---

## Database Status

**14 SQL schema files** at repository root, fully designed:

| File | Schema Coverage |
|------|----------------|
| 001_core_schema.sql | Users, orgs, roles, auth |
| 002_therapists_schema.sql | Therapist profiles, credentials, availability |
| 003_patients_schema.sql | Patient demographics, contacts, insurance |
| 004_clinical_schema.sql | Diagnoses, medications, treatment plans |
| 005_medications_schema.sql | Medication database |
| 006_sessions_schema.sql | Sessions, prep, notes, transcripts |
| 007_ai_schema.sql | AI notes, transcripts, memory nodes |
| 008_assessments_schema.sql | Assessment templates, results, scoring |
| 009_radar_schema.sql | Radar requests, matching, queue |
| 010_billing_schema.sql | Subscriptions, invoices, claims, payments |
| 011_notifications_schema.sql | Notifications, preferences, delivery |
| 012_audit_compliance_schema.sql | Audit logs, compliance reports, data retention |
| 013_marketplace_schema.sql | Listings, reviews, search, bookings |
| 014_analytics_schema.sql | Analytics events, metrics, dashboards |

**Migration files**: `/migrations/` directory exists (content TBD)
**DB Provider**: Designed for PostgreSQL — Supabase or Neon recommended for production

---

## Backend Status (NestJS — `backend/src/`)

### Modules Present (16)

| Module | Controller | Service | DTOs | Status |
|--------|-----------|---------|------|--------|
| auth | ✅ | ✅ 298L | ✅ login/register | ⚠️ Needs more DTOs |
| users | ✅ | ✅ | ⚠️ Partial | ⚠️ Needs DTOs |
| therapists | ✅ | ✅ | ⚠️ Partial | ⚠️ Needs DTOs |
| patients | ✅ | ✅ | ⚠️ Partial | ⚠️ Needs DTOs |
| sessions | ✅ | ✅ 302L | ⚠️ Partial | ⚠️ Needs DTOs |
| memory | ✅ | ✅ 752L | ❌ None | 🔴 Needs DTOs |
| ai | ✅ | ✅ 380L | ❌ None | 🔴 Needs DTOs |
| radar | ✅ | ✅ 362L | ❌ None | 🔴 Needs DTOs |
| assessments | ✅ | ✅ | ❌ None | 🔴 Needs DTOs |
| billing | ✅ | ✅ 411L | ❌ None | 🔴 Needs DTOs |
| marketplace | ✅ | ✅ | ❌ None | 🔴 Needs DTOs |
| organizations | ✅ | ✅ | ❌ None | 🔴 Needs DTOs |
| workflows | ✅ | ✅ 494L | ❌ None | 🔴 Needs DTOs |
| notifications | ✅ | ✅ 477L | ❌ None | 🔴 Needs DTOs |
| analytics | ✅ | ✅ | ❌ None | 🔴 Needs DTOs |
| admin | ✅ | ✅ | ❌ None | 🔴 Needs DTOs |

### Other Backend Files
- `gateways/events.gateway.ts` — WebSocket real-time events
- `database/database.service.ts` — Drizzle ORM connection
- `config/app.config.ts` — Configuration service
- `main.ts` — App bootstrap

---

## Shared Types Status

**`packages/types/src/index.ts`** — 1,860+ lines, comprehensive coverage:

Domains covered: Core Auth, Organization, Therapist, Patient, Session, Transcript, Memory Layer (KnowledgeGraph, LongitudinalIntelligence, MemoryNode, AIContext), Assessment, Treatment Plans, AI Systems (CopilotSuggestion, RiskAlert, SafetyPlan), Radar Matching, Billing (Invoice, InsuranceClaim, Payment), Workflow Engine, Notifications, Referrals, Analytics, Compliance (AuditLog), EHR Integrations, Webhooks, Reporting, Patient UX (Mood, Journal, Homework), CRM, Group Sessions, White-Label, Enterprise.

---

## Marketing Website Status (`apps/web/`)

### Pages Present ✅
- `/` — Home (existing)
- `/about` — About page (existing)
- `/pricing` — Pricing (existing)
- `/ai-scribe` — AI Scribe feature page (existing)
- `/for-therapists` — Therapist landing (existing)
- `/find-therapist` — Patient matching / Radar (existing)
- `/therapists` — Therapist directory (built this session)
- `/therapists/[id]` — Therapist profile with booking (built this session)
- `/therapist-join` — Join as therapist (built this session)
- `/testimonials` — Success stories (built this session)
- `/enterprise` — Enterprise landing (existing)
- `/security` — Security & HIPAA (existing)
- `/blog` — Blog index (existing)
- `/blog/[slug]` — Blog article template (existing)

### Pages MISSING 🔴
- `/features` — Features hub overview
- `/features/teletherapy` — Teletherapy feature page
- `/features/analytics` — Analytics feature page
- `/contact` — Contact page
- `/careers` — Careers page
- `/privacy` — Privacy policy
- `/terms` — Terms of service
- `/docs` — Documentation hub

### Navbar Links (from `apps/web/components/layout/navbar.tsx`)
- Features dropdown: `/features`, `/ai-scribe`, `/ai-scribe#copilot`, `/ai-scribe#memory`, `/ai-scribe#risk`, `/features/teletherapy` ❌, `/features/analytics` ❌
- For Therapists: `/for-therapists`, `/for-therapists#practice`, `/for-therapists#enterprise`, `/therapist-join`
- Find Therapy: `/find-therapist`, `/therapists`, `/find-therapist#how`, `/find-therapist?urgency=now`
- Resources: `/blog`, `/testimonials`, `/enterprise`, `/security`, `/about`
- `/pricing`

---

## Therapist Portal Status (`apps/therapist/`)

### Pages Present ✅
- `/dashboard` — Main dashboard
- `/patients` — Patient list
- `/patients/[id]` — Patient profile
- `/patients/intake` — 6-step intake form (built previous session)
- `/sessions` — Session list
- `/sessions/new` — New session
- `/sessions/[id]/prepare` — Session prep
- `/sessions/[id]/room` — Live session room with AI copilot
- `/notes` — Notes list
- `/notes/[id]` — Note detail
- `/assessments` — Assessments
- `/treatment-plans` — Treatment plans
- `/clinical-tools` — Clinical reference tools
- `/referrals` — Referrals
- `/reports` — Reports generation
- `/risk-monitor` — AI risk monitoring
- `/radar` — Radar marketplace
- `/messages` — Secure messaging
- `/memory` — Memory layer viewer
- `/memory/graph` — Knowledge graph visualization
- `/ai-workspace` — AI workspace (474L — needs enhancement)
- `/crm` — CRM (therapist-level)
- `/analytics` — Analytics
- `/workflow` — Workflow automation
- `/billing` — Billing
- `/notifications` — Notification center (built previous session)
- `/settings` — Settings (517L — needs deep enhancement)
- `/onboarding` — Therapist onboarding

### Pages MISSING 🔴
- `/calendar` — Calendar / scheduling view
- `/settings` needs deep enhancement (6+ tabs)

---

## Patient Portal Status (`apps/patient/`)

### Pages Present ✅
- `/home` — Patient dashboard
- `/appointments` — Upcoming/past appointments
- `/sessions` — Session history
- `/mood` — Mood tracker
- `/journal` — Journal
- `/progress` — Progress page (557L — exists)
- `/assessments` — Assessments
- `/ai-companion` — AI companion chat
- `/messages` — Secure messaging
- `/resources` — Resources library
- `/reports` — My reports
- `/crisis` — Crisis support
- `/settings` — Settings

### Pages MISSING 🔴
- `/notifications` — Patient notifications
- `/billing` — Patient billing / invoices

---

## Admin Portal Status (`apps/admin/`)

### Pages Present ✅
- `/dashboard` — Admin dashboard
- `/organizations` — Org management (273L)
- `/practice-management` — Deep org management (built previous session)
- `/therapists` — Therapist management (281L)
- `/users` — User management
- `/crm` — CRM / sales pipeline (built previous session)
- `/billing` — Billing overview
- `/compliance` — Compliance
- `/ai-governance` — AI governance
- `/marketplace` — Marketplace management
- `/settings` — Global settings
- `/analytics` — Analytics (exists but needs expansion)

### Pages MISSING / INCOMPLETE 🔴
- `/analytics` — Needs deep expansion with MRR, churn, AI costs, cohorts

---

## Memory Layer Status

**Backend:** `backend/src/modules/memory/memory.service.ts` — 752 lines, fully built
- `getPatientMemory()` — retrieves with filters
- `buildKnowledgeGraph()` — SVG graph data
- `getLongitudinalIntelligence()` — full patient intelligence
- `buildAIContext()` — AI context assembly
- `extractMemoriesFromNote()` — AI memory extraction
- `createMemoryNode()`, `updateMemoryNode()`, `retractMemoryNode()`

**Frontend:** 
- `/memory` — Memory layer viewer ✅
- `/memory/graph` — Knowledge graph visualization ✅

**Missing:**
- Memory DTOs in backend
- Memory controller endpoints for all operations

---

## Workflow Engine Status

**Backend:** `backend/src/modules/workflows/workflows.service.ts` — 494 lines, built
**Frontend:** `/workflow` — Automation engine page ✅
**Missing:** Workflow DTOs, execution history endpoint

---

## Shared Types Status

`packages/types/src/index.ts` — 1,860+ lines — COMPLETE ✅

---

## Recent Commits (Latest First)

```
cbbecaf  feat(types): expand shared TypeScript types — full platform coverage
d3c7c5c  feat(marketplace): therapist profile page with booking modal
bcc6ffe  feat(admin): practice management page
537da9b  feat(admin): CRM sales pipeline + web navbar updates
b0858c4  feat(web-marketing): therapist directory, therapist-join, testimonials
bb2f612  feat(notifications): therapist notification center
9cf524f  feat(intake): 6-step patient intake form
673e1b4  fix(sidebar): risk-monitor nav item
9264966  feat(workflow): clinical workflow automation engine
8f43be3  feat(web-marketing): enterprise, security pages + blog updates
7d51b7f  feat(messages): secure messaging center
f2105a0  feat(risk-monitor): AI risk monitoring page
331602d  feat(analytics): therapist analytics page
d71f0f4  feat(patient-portal): crisis support page
9b5d852  feat(onboarding): therapist multi-step onboarding
653cb15  feat(memory,blog): knowledge graph + blog pages
e026945  feat(therapist): referrals, reports, clinical-tools
7cf7725  feat(patient-portal): resources page
7ef3d91  feat(patient-portal): settings + web navbar
5181908  feat(patient-portal): messages
9b91652  feat(patient-portal): assessments PHQ-9
```

---

## Known Issues / Gaps

1. **No `CLAUDE.md`** — was missing, now created
2. **Web pages 404**: `/features`, `/features/teletherapy`, `/features/analytics`, `/contact`, `/careers`, `/privacy`, `/terms`, `/docs`
3. **Patient portal missing**: `/notifications`, `/billing`
4. **Therapist portal missing**: `/calendar`
5. **Backend DTOs incomplete**: memory, ai, radar, assessments, billing, marketplace, workflows, notifications, analytics, admin modules have no DTOs
6. **SETUP.md**: Exists (347L) but needs expansion to full production guide
7. **Therapist settings**: 517L but needs expansion to full 6-tab settings
8. **Admin analytics**: Exists but minimal — needs deep expansion
9. **AI workspace**: 474L — functional but could be enhanced to full agent control center
10. **No `.env.example` files** — needed for deployment guide
11. **No CI/CD pipeline** in `.github/workflows/`
12. **No Docker configuration** at repo root

---

## Architecture Decisions

1. **Multi-tenant isolation**: Every DB query scoped by `organization_id` — strict tenant isolation
2. **AI never stores raw transcripts as PHI** — transcripts encrypted, patient data de-identified in AI prompts
3. **Memory Layer versioning**: All memory nodes have `version`, `status`, `times_observed` — longitudinal tracking
4. **Workflow engine**: Event-driven, trigger-condition-action pattern — extensible
5. **Radar**: Emergency-first design — max_wait_minutes enforced
6. **ESIGN Act compliance**: Electronic signatures captured with IP, user_agent, timestamp
7. **Audit logging**: Every PHI access logged — HIPAA requirement
8. **White-label ready**: Custom domain, CSS, colors, brand name per org

---

## Next Recommended Priorities

### Immediate (Next Session)
1. Build `/features`, `/features/teletherapy`, `/features/analytics` web pages
2. Build `/contact`, `/careers`, `/privacy`, `/terms` web pages
3. Build patient `/notifications` and `/billing` pages
4. Build therapist `/calendar` page
5. Deep expand therapist `/settings`
6. Expand backend DTOs for all modules
7. Expand SETUP.md to full production guide

### Medium Term
1. Build `.env.example` files for each app
2. Build Docker Compose configuration
3. Build GitHub Actions CI/CD pipeline
4. Add email service integration (Resend)
5. Add file storage service (S3 / R2)
6. Implement actual Stripe webhook handlers

### Long Term
1. EHR integration connectors (Epic FHIR, SimplePractice)
2. Real-time WebSocket integration in frontend
3. Mobile app (React Native)
4. FHIR R4 API compliance

---

## How to Continue This Session

For any new AI session reading this file:

1. Run `git pull origin main` to get latest code
2. Run `find apps -name "page.tsx" | sort` to see all pages
3. Run `find backend/src -name "*.ts" | sort` to see all backend files
4. Read this CLAUDE.md fully
5. Check the "Known Issues / Gaps" section above
6. Build in priority order from "Next Recommended Priorities"
7. After every file creation: `git add . && git commit -m "message" && git push origin main`

---

## Deployment URLs (Production Targets)

| App | URL |
|-----|-----|
| Marketing | https://24therapy.ai |
| Therapist Portal | https://app.24therapy.ai |
| Patient Portal | https://my.24therapy.ai |
| Admin Portal | https://admin.24therapy.ai |
| API | https://api.24therapy.ai |

---

*This file is maintained by AI sessions. Update after every major commit.*
