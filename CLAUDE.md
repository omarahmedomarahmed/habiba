# CLAUDE.md — 24Therapy.ai Persistent Project Memory
# Mental Health Operating System — AI Session Context File
# Last Updated: 2026-06-04 | Latest Commit: f467147

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

## Brand Tokens

```css
--primary: #0A2342      /* Deep navy */
--accent:  #2EC4B6      /* Teal */
--blue:    #1F5EFF      /* Bright blue */
--bg:      #F8FAFC      /* Off-white */
--text:    #0F172A      /* Slate 900 */
```

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
├── SETUP.md              # Deployment guide (347 lines — needs expansion)
├── CLAUDE.md             # THIS FILE — AI session memory
├── README.md             # Project overview
├── package.json          # Root monorepo config
├── pnpm-workspace.yaml   # PNPM workspaces
└── turbo.json            # Turborepo config
```

---

## Database Status

**14 SQL schema files** at repository root, fully designed:
- users, organizations, therapists, patients, sessions, transcripts
- memory_nodes, memory_edges, knowledge_graphs
- assessments, treatment_plans, clinical_notes
- workflows, workflow_runs, notifications
- billing (subscriptions, invoices, payments)
- marketplace, referrals, radar_scores
- ai_usage_metrics, audit_logs

---

## Backend Module Status (16 Modules)

| Module | Controller | Service | DTOs | Swagger | Validation | Audit |
|--------|-----------|---------|------|---------|------------|-------|
| auth | ✅ | ✅ | partial | partial | partial | ❌ |
| users | ✅ | ✅ | partial | partial | partial | ❌ |
| therapists | ✅ | ✅ | partial | partial | partial | ❌ |
| patients | ✅ | ✅ | partial | partial | partial | ❌ |
| sessions | ✅ | ✅ | partial | partial | partial | ❌ |
| **memory** | ✅ | ✅ (752L) | ❌ | ❌ | ❌ | ❌ |
| **ai** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **radar** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **assessments** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **billing** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **marketplace** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **organizations** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **workflows** | ✅ | ✅ (494L) | ❌ | ❌ | ❌ | ❌ |
| **notifications** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **analytics** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **admin** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Critical gap: 11 modules need DTOs, Swagger decorators, class-validator, and audit logging**

---

## Marketing Website Status (`apps/web`)

| Page | Route | Status |
|------|-------|--------|
| Home | `/` | ✅ Complete |
| About | `/about` | ✅ Complete |
| Pricing | `/pricing` | ✅ Complete |
| Features Hub | `/features` | ✅ Complete |
| AI Copilot | `/features/ai-copilot` | ✅ NEW — Complete |
| AI Workspace | `/features/ai-workspace` | ✅ NEW — Complete |
| Memory Layer | `/features/memory-layer` | ✅ NEW — Complete |
| Workflow Engine | `/features/workflow-engine` | ✅ NEW — Complete |
| Use Cases | `/features/use-cases` | ✅ NEW — Complete |
| Integrations | `/features/integrations` | ✅ NEW — Complete |
| Teletherapy | `/features/teletherapy` | ✅ Complete |
| Analytics | `/features/analytics` | ✅ Complete |
| AI Scribe | `/ai-scribe` | ✅ Complete |
| HIPAA | `/hipaa` | ✅ NEW — Complete |
| Security | `/security` | ✅ Complete |
| Privacy | `/privacy` | ✅ Complete |
| Terms | `/terms` | ✅ Complete |
| Contact | `/contact` | ✅ Complete |
| Careers | `/careers` | ✅ Complete |
| Docs | `/docs` | ✅ Complete |
| Blog | `/blog` | ✅ Complete |
| Enterprise | `/enterprise` | ✅ Complete |
| Find Therapist | `/find-therapist` | ✅ Complete |
| For Therapists | `/for-therapists` | ✅ Complete |
| Therapist Join | `/therapist-join` | ✅ Complete |
| Therapist Directory | `/therapists` | ✅ Complete |
| Therapist Profile | `/therapists/[id]` | ✅ Complete |
| Testimonials | `/testimonials` | ✅ Complete |
| Global Footer | component | ✅ NEW — Updated |
| Global Layout (Navbar+Footer) | layout.tsx | ✅ NEW — Fixed |

**Missing web pages (lower priority):**
- `/blog/[slug]` dynamic page (template exists, no CMS)
- `/press` — press/media page
- `/status` — system status page
- `/gdpr` — GDPR-specific page

---

## Patient Portal Status (`apps/patient`)

| Page | Route | Status |
|------|-------|--------|
| Home/Dashboard | `/home` | ✅ Complete |
| Appointments | `/appointments` | ✅ Complete |
| Sessions | `/sessions` | ✅ Complete |
| Reports | `/reports` | ✅ Complete |
| Mood Tracker | `/mood` | ✅ Complete |
| Journal | `/journal` | ✅ Complete |
| Progress | `/progress` | ✅ Complete |
| Assessments | `/assessments` | ✅ Complete |
| AI Companion | `/ai-companion` | ✅ Complete |
| Messages | `/messages` | ✅ Complete |
| Resources | `/resources` | ✅ Complete |
| Crisis Support | `/crisis` | ✅ Complete |
| Notifications | `/notifications` | ✅ Complete |
| Billing | `/billing` | ✅ Complete |
| Homework | `/homework` | ✅ NEW — Complete |
| Profile | `/profile` | ✅ NEW — Complete |
| Settings | `/settings` | ✅ Complete |
| Login | `/login` | ✅ Complete |

**All patient portal pages complete ✅**

---

## Therapist Portal Status (`apps/therapist`)

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/dashboard` | ✅ Complete |
| Patients | `/patients` | ✅ Complete |
| Patient Profile | `/patients/[id]` | ✅ Complete |
| Patient Intake | `/patients/intake` | ✅ Complete |
| Sessions | `/sessions` | ✅ Complete |
| Session Room | `/sessions/[id]/room` | ✅ Complete |
| Session Prepare | `/sessions/[id]/prepare` | ✅ Complete |
| New Session | `/sessions/new` | ✅ Complete |
| Calendar | `/calendar` | ✅ Complete |
| Notes | `/notes` | ✅ Complete |
| Note Detail | `/notes/[id]` | ✅ Complete |
| Assessments | `/assessments` | ✅ Complete |
| Treatment Plans | `/treatment-plans` | ✅ Complete |
| Clinical Tools | `/clinical-tools` | ✅ Complete |
| Memory Layer | `/memory` | ✅ Complete |
| Memory Graph | `/memory/graph` | ✅ Complete |
| AI Workspace | `/ai-workspace` | ✅ Complete |
| Risk Monitor | `/risk-monitor` | ✅ Complete |
| Radar | `/radar` | ✅ Complete |
| CRM | `/crm` | ✅ Complete |
| Referrals | `/referrals` | ✅ Complete |
| Workflow | `/workflow` | ✅ Complete |
| Analytics | `/analytics` | ✅ Complete |
| Billing | `/billing` | ✅ Complete |
| Reports | `/reports` | ✅ Complete |
| Messages | `/messages` | ✅ Complete |
| Notifications | `/notifications` | ✅ Complete |
| Settings | `/settings` | ✅ DEEP — 6 tabs complete |
| Onboarding | `/onboarding` | ✅ Complete |
| **Team Management** | `/team` | ❌ NOT YET BUILT |
| **Audit Logs** | `/audit-logs` | ❌ NOT YET BUILT |

---

## Admin Portal Status (`apps/admin`)

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/dashboard` | ✅ Complete |
| Organizations | `/organizations` | ✅ Complete |
| Practice Management | `/practice-management` | ✅ Complete |
| Therapists | `/therapists` | ✅ Complete |
| Users | `/users` | ✅ Complete |
| CRM | `/crm` | ✅ Complete (Sales Pipeline) |
| Marketplace | `/marketplace` | ✅ Complete |
| Billing | `/billing` | ✅ Complete |
| Compliance | `/compliance` | ✅ Complete |
| AI Governance | `/ai-governance` | ✅ Complete |
| Settings | `/settings` | ✅ Complete |
| **Analytics** | `/analytics` | ⚠️ EXISTS but MINIMAL — needs deep expansion |
| **Support Tools** | `/support-tools` | ❌ NOT YET BUILT |
| **Feature Flags** | `/feature-flags` | ❌ NOT YET BUILT |
| **AI Costs** | `/ai-costs` | ❌ NOT YET BUILT |
| **Audit Logs** | `/audit-logs` | ❌ NOT YET BUILT |

---

## Recent Commits Log

| Hash | Date | Description |
|------|------|-------------|
| f467147 | 2026-06-04 | feat(platform): 8 web feature pages, patient homework+profile, global footer+layout |
| 7c0a3a8 | 2026-06-04 | feat(therapist): deep settings — 6 tabs: profile, practice, AI, notifications, security, billing |
| 8ad7fbf | 2026-06-04 | feat(therapist): full calendar — month/week/day/list views |
| 1bc498e | 2026-06-04 | feat(patient): notifications page, billing page with insurance tracker |
| 269f0af | 2026-06-04 | feat(web): 8 marketing pages — features, contact, careers, privacy, terms, docs |
| f27e178 | 2026-06-04 | docs(claude): create persistent AI session memory file |
| cbbecaf | 2026-06-04 | feat(types): expand shared TypeScript types to 1,860+ lines |
| d3c7c5c | 2026-06-04 | feat(marketplace): therapist profile page |
| bcc6ffe | 2026-06-04 | feat(admin): practice management page |
| 537da9b | 2026-06-04 | feat(admin): CRM sales pipeline |

---

## Architecture Decisions

1. **No CMS yet** — Blog uses static mock data. CMS integration (Contentful/Sanity) planned for post-MVP.
2. **Web layout now includes Navbar+Footer globally** — Individual pages no longer need to import these.
3. **Shared types at `@24therapy/types`** — All apps import from this package. 1,860+ lines covering all domains.
4. **Drizzle ORM** — Not Prisma. Schema files are raw SQL (14 files at root).
5. **Patient portal uses Zustand `useAuthStore`** — Not Next-Auth.
6. **Therapist settings uses ToggleSwitch + SectionCard reusable patterns** — Reuse in other settings pages.
7. **Memory Layer = KnowledgeGraph of MemoryNode records** — 21 node types, semantic edges, timestamped.
8. **All 4 apps are separate Next.js projects** — Not a single app with sub-routes.

---

## Known Issues / Technical Debt

1. **Backend DTOs missing** — 11 modules have no `class-validator` DTOs or `@ApiProperty` Swagger decorators
2. **No audit logging** — Backend modules don't log PHI access to audit trail
3. **No email service** — Notifications use stub service; Resend/SendGrid not configured
4. **No file storage** — Document uploads not wired to S3/R2
5. **No real WebSocket** — Gateway exists but frontends use polling in some places
6. **Web layout duplication** — `page.tsx` (home) still imports Footer directly — should be removed since layout now handles it
7. **No CI/CD** — No `.github/workflows/` pipeline exists
8. **No Docker Compose** — No `docker-compose.yml` at root
9. **SETUP.md** — Only 347 lines, needs full production deployment guide
10. **No `.env.example` files** — Each app/backend needs these

---

## Remaining Work — Priority Order

### 🔴 HIGH PRIORITY (Next Session)

#### Therapist Portal
- [ ] `/team` — Team management page (invite therapists, roles, permissions, capacity)
- [ ] `/audit-logs` — Audit log viewer (access logs, PHI access, note changes)

#### Admin Portal
- [ ] `/analytics` — Deep analytics (MRR, ARR, churn, AI costs, clinical outcomes, cohorts)
- [ ] `/support-tools` — Support ticket system, user impersonation, account actions
- [ ] `/feature-flags` — Feature flag management UI per org/therapist
- [ ] `/audit-logs` — Platform-wide audit log viewer
- [ ] `/ai-costs` — AI usage cost dashboard (tokens, sessions, per-org costs)

#### Backend DTOs (Critical for Production)
All 11 modules need:
```typescript
// Example pattern needed in each module:
export class CreatePatientDto {
  @IsString() @IsNotEmpty() @ApiProperty()
  first_name: string;
  // ... all fields with class-validator + @ApiProperty
}
```
Modules: memory, ai, radar, assessments, billing, marketplace, organizations, workflows, notifications, analytics, admin

### 🟡 MEDIUM PRIORITY

#### Infrastructure
- [ ] `docker-compose.yml` — Full stack local dev (postgres, redis, all apps, backend)
- [ ] `.env.example` files — For each app (`apps/web`, `apps/therapist`, `apps/patient`, `apps/admin`, `backend`)
- [ ] `.github/workflows/ci.yml` — TypeScript check + lint + build on PR
- [ ] SETUP.md expansion — Full production deployment guide (Docker, AWS, Vercel, Railway, Render, Supabase)

#### Web Marketing
- [ ] `/press` — Press/media page
- [ ] `/status` — System status page
- [ ] `/gdpr` — GDPR-specific compliance page
- [ ] Fix home `page.tsx` — Remove duplicate Footer import (now handled by layout.tsx)

### 🟢 LOW PRIORITY (Polish)
- [ ] Blog CMS integration (Contentful/Sanity)
- [ ] Real WebSocket wiring to frontend components
- [ ] Email service (Resend) integration
- [ ] File storage (S3/R2) integration
- [ ] Payment webhook handlers (Stripe)

---

## Deployment Status

| Component | Status | URL |
|-----------|--------|-----|
| Marketing Site | Not deployed | https://24therapy.ai |
| Therapist Portal | Not deployed | https://app.24therapy.ai |
| Patient Portal | Not deployed | https://my.24therapy.ai |
| Admin Portal | Not deployed | https://admin.24therapy.ai |
| Backend API | Not deployed | https://api.24therapy.ai |
| Database | Not provisioned | Supabase/Neon planned |
| Redis | Not provisioned | Upstash planned |

---

## Session History

| Session | Date | Major Accomplishments |
|---------|------|----------------------|
| Session 1 | 2026-06-04 | Initial build — all 4 portals, backend 16 modules, types, marketplace, admin CRM, notifications |
| Session 2 | 2026-06-04 | CLAUDE.md, types expansion, 8 web pages, patient billing+notifications, therapist calendar |
| Session 3 | 2026-06-04 | Therapist settings (6 tabs), 8 more web feature pages, HIPAA page, patient homework+profile, footer |

---

## Next Recommended Priorities

A new AI session should immediately:

1. **Build `/team` page** in therapist portal — invite modal, role management, capacity tracking, seat management
2. **Build `/audit-logs` page** in therapist portal — paginated log table, filter by action/patient/date
3. **Expand admin `/analytics`** — MRR charts, churn, AI costs, clinical outcome aggregates
4. **Build 4 missing admin pages** — support-tools, feature-flags, ai-costs, audit-logs
5. **Backend DTOs** — Start with `memory` and `workflows` modules (highest business value), then billing, assessments
6. **Create `docker-compose.yml`** — postgres + redis + all 5 services
7. **Expand SETUP.md** — Full production deployment guide
8. **Fix home page** — Remove duplicate Footer import from `apps/web/app/page.tsx`

---

*This file is maintained as persistent AI session memory. Update after every commit batch.*
*Any AI session reading this file should have full project context within 5 minutes.*
