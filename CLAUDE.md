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
| **Stack** | Next.js 15 · NestJS · PostgreSQL + pgvector · Redis · TypeScript |
| **Monorepo** | Turbo + PNPM 9 workspaces |
| **Last Commit** | `00d512c` — feat(pricing): centralized pricing management system |
| **Last Updated** | 2026-06-06 (session 5 — Pricing Audit & Standardization) |

---

## Architecture Overview

```
apps/
  web/           → Marketing site         (24therapy.ai)       port 3000
  therapist/     → Therapist portal        (app.24therapy.ai)   port 3001
  patient/       → Patient portal          (my.24therapy.ai)    port 3002
  admin/         → Super admin portal      (admin.24therapy.ai) port 3003
backend/         → NestJS API              (api.24therapy.ai)   port 3001 (backend)
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
| Package Manager | pnpm 9.15.4 | lockfileVersion 9.0 in pnpm-lock.yaml |
| ESLint | FlatCompat + @eslint/eslintrc | Required for next/core-web-vitals in ESLint 9 flat config |
| PostCSS | tailwindcss:{} + autoprefixer:{} | Tailwind v3 syntax (NOT @tailwindcss/postcss which is v4) |

---

## Deployment Configuration (Critical)

### pnpm + Vercel Setup

The repo now has all required files for Vercel to detect pnpm@9.x correctly:

| File | Purpose |
|------|---------|
| `pnpm-lock.yaml` | **PRIMARY** — Vercel reads lockfileVersion:'9.0' to activate pnpm 9 via Corepack |
| `.npmrc` | `shamefully-hoist=true`, `node-linker=hoisted`, `auto-install-peers=true` |
| `packageManager: "pnpm@9.15.4"` | In root package.json — explicit version declaration |
| `vercel.json` (root) | `installCommand: "pnpm install --frozen-lockfile"` |
| `apps/*/vercel.json` | Per-app: `installCommand: "cd ../.. && pnpm install --frozen-lockfile"` + `buildCommand` |

### Per-App Vercel Projects

| App | Root Directory | Vercel Project Name | Domain |
|-----|---------------|---------------------|--------|
| `apps/web` | `apps/web` | `24therapy-web` | `24therapy.ai` |
| `apps/therapist` | `apps/therapist` | `24therapy-therapist` | `app.24therapy.ai` |
| `apps/patient` | `apps/patient` | `24therapy-patient` | `my.24therapy.ai` |
| `apps/admin` | `apps/admin` | `24therapy-admin` | `admin.24therapy.ai` |

### ESLint Config Pattern (all 4 apps)

```js
// apps/*/eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: __dirname });
const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  { rules: {
    "react/no-unescaped-entities": "off",  // prose JSX with quotes/apostrophes OK
    "react/display-name": "off",           // anonymous components OK
  }},
];
export default eslintConfig;
```

---

## Build Status — All Apps

> Last validated: 2026-06-04 (commit `7150495`)

| App | Build | Routes | Notes |
|-----|-------|--------|-------|
| `@24therapy/web` | ✅ PASS | 32 routes | Next.js 15.3.3 |
| `@24therapy/therapist` | ✅ PASS | 28 routes | Next.js 15.3.3 |
| `@24therapy/patient` | ✅ PASS | 17 routes | Next.js 15.1.0 |
| `@24therapy/admin` | ✅ PASS | 17 routes | Next.js 15.1.0 |

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
| `/blog/[slug]` | ✅ Fixed async params | `7150495` |
| `/therapists` | ✅ Fixed import conflict | `7150495` |
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
| `/billing` | ✅ Fixed (stale setNotifications ref removed) | `7150495` |
| `/homework` | ✅ Complete | `f467147` |
| `/profile` | ✅ Complete | `f467147` |
| Sidebar | ✅ Updated with homework + profile | `f467147` |

---

## Page Status — Therapist Portal (`apps/therapist`)

| Route | Status | Commit |
|-------|--------|--------|
| `/login` | ✅ Fixed (removed stale eslint-disable) | `7150495` |
| `/dashboard` | ✅ Complete | prior |
| `/patients` | ✅ Complete | prior |
| `/sessions` | ✅ Complete | prior |
| `/notes` | ✅ Complete | prior |
| `/assessments` | ✅ Complete | prior |
| `/calendar` | ✅ Fixed (<a> → <Link>, added import) | `7150495` |
| `/messages` | ✅ Complete | prior |
| `/billing` | ✅ Complete | prior |
| `/notifications` | ✅ Fixed (MarkAsUnread → MailOpen) | `7150495` |
| `/settings` | ✅ Fixed (Toggle removed, Record<> casts fixed) | `7150495` |
| `/team` | ✅ Complete | `a871cef` |
| `/audit-logs` | ✅ Complete | `a871cef` |
| `/onboarding` | ✅ Fixed (Network icon added to import) | `7150495` |
| Sidebar | ✅ Updated with team + audit-logs + COMPLIANCE section | `a871cef` |

---

## Page Status — Admin Portal (`apps/admin`)

| Route | Status | Commit |
|-------|--------|--------|
| `/login` | ✅ Complete | prior |
| `/dashboard` | ✅ Complete | prior |
| `/organizations` | ✅ Complete | prior |
| `/users` | ✅ Fixed (removed invalid title prop from CheckCircle) | `7150495` |
| `/therapists` | ✅ Complete | prior |
| `/practice-management` | ✅ Complete | prior |
| `/compliance` | ✅ Complete | prior |
| `/ai-governance` | ✅ Complete | prior |
| `/billing` | ✅ Updated (removed hardcoded plans, redirects to /pricing) | `00d512c` |
| `/pricing` | ✅ **NEW** — Full CRUD pricing management | `00d512c` |
| `/marketplace` | ✅ Complete | prior |
| `/analytics` | ✅ Complete (5-tab deep) | `a871cef` |
| `/crm` | ✅ Complete | prior |
| `/support-tools` | ✅ Complete | `a871cef` |
| `/feature-flags` | ✅ Complete | `a871cef` |
| `/ai-costs` | ✅ Complete | `a871cef` |
| `/audit-logs` | ✅ Complete | `a871cef` |
| `/settings` | ✅ Fixed (Webhook icon import conflict removed) | `7150495` |
| Admin Sidebar | ✅ Updated with TOOLS section + Pricing Management | `00d512c` |

---

## Backend Module Status (`backend/src/modules/`)

| Module | Controller | Service | DTOs | Swagger |
|--------|-----------|---------|------|---------|
| `auth` | ✅ | ✅ | ✅ | ✅ |
| `users` | ✅ | ✅ | ✅ | ✅ |
| `therapists` | ✅ | ✅ | ✅ | ✅ |
| `patients` | ✅ | ✅ | ✅ | ✅ |
| `sessions` | ✅ | ✅ | ✅ | ✅ |
| `memory` | ✅ | ✅ | ✅ | ✅ |
| `ai` | ✅ | ✅ | ✅ | ✅ |
| `radar` | ✅ | ✅ | ⚠️ Pending | ⚠️ Pending |
| `assessments` | ✅ | ✅ | ✅ | ✅ |
| `billing` | ✅ | ✅ | ✅ | ✅ |
| `marketplace` | ✅ | ✅ | ⚠️ Pending | ⚠️ Pending |
| `organizations` | ✅ | ✅ | ✅ | ✅ |
| `workflows` | ✅ | ✅ | ✅ | ✅ |
| `notifications` | ✅ | ✅ | ✅ | ✅ |
| `analytics` | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ |

---

## Infrastructure Status

| File | Status | Notes |
|------|--------|-------|
| `pnpm-lock.yaml` | ✅ Created | lockfileVersion:'9.0' — PRIMARY Vercel fix |
| `.npmrc` | ✅ Created | shamefully-hoist, node-linker=hoisted |
| `.gitignore` | ✅ Created | Was entirely absent before session 4 |
| `vercel.json` (root) | ✅ Created | installCommand override |
| `apps/web/vercel.json` | ✅ Created | buildCommand: pnpm --filter @24therapy/web build |
| `apps/therapist/vercel.json` | ✅ Created | buildCommand: pnpm --filter @24therapy/therapist build |
| `apps/patient/vercel.json` | ✅ Created | buildCommand: pnpm --filter @24therapy/patient build |
| `apps/admin/vercel.json` | ✅ Created | buildCommand: pnpm --filter @24therapy/admin build |
| `docker-compose.yml` | ✅ Created | Full stack: postgres, redis, all 5 services; debug + monitoring profiles |
| `apps/web/.env.example` | ✅ Created | Analytics, CMS, Calendly, SEO vars |
| `apps/therapist/.env.example` | ✅ Created | JWT, video, AI flags, HIPAA vars |
| `apps/patient/.env.example` | ✅ Created | JWT, payments, crisis resources |
| `apps/admin/.env.example` | ✅ Created | IP allowlist, impersonation flags |
| `backend/.env.example` | ✅ Existed | Already comprehensive |
| `infra/ci/ci.yml` | ✅ Created | 7-job pipeline (in infra/ not .github/ — GitHub App lacks workflows permission) |
| `SETUP.md` | ✅ Expanded | 868 → 1,179 lines; added Vercel monorepo guide, domain arch, deployment troubleshooting |
| `CLAUDE.md` | ✅ This file | Updated session 4 |

---

## Commit History

| Hash | Message | Key Changes |
|------|---------|-------------|
| `00d512c` | feat(pricing): centralized pricing management system | 11 files, +3629 lines — session 5 |
| `b597672` | docs: comprehensive platform audit | AUDIT_REPORT, PRODUCTION_GAP_ANALYSIS, FEATURE_MATRIX |
| `0260e68` | Merge pull request #1 (React Server Components CVE) | Security patch |
| `fe0b495` | fix: move CI file from .github/workflows/ to infra/ci/ | Remove workflow file (no perms) |
| `7150495` | fix(deploy): resolve all Vercel build failures | 41 files, PRIMARY deployment fix |
| `b647564` | feat: infrastructure, backend DTOs, env examples, CI/CD | 9 DTO files, docker-compose, SETUP.md |
| `a871cef` | feat: complete therapist + admin portals | 10 files, +3058 lines |
| `f467147` | feat: marketing pages, patient homework+profile | ~12 files |

---

## Deployment Audit Session (2026-06-04) — Summary

### Problem
Vercel deployments failing with `ERR_PNPM_UNSUPPORTED_ENGINE`:
Vercel used bundled pnpm@6.35.1 instead of required pnpm@9.x.

### Root Cause Chain
1. **`pnpm-lock.yaml` missing** (PRIMARY) → Vercel can't read lockfileVersion → falls back to pnpm 6
2. **No `.npmrc`** → missing hoisting config for Vercel/Next.js compatibility
3. **No `vercel.json` files** → Vercel doesn't know buildCommand/installCommand overrides
4. **`@radix-ui/react-badge`** in `apps/web` → package doesn't exist on npm (404)
5. **All 4 postcss configs** using `@tailwindcss/postcss` (Tailwind v4 API) with Tailwind v3 installed
6. **All 4 eslint configs** using broken flat config (missing FlatCompat + wrong import)
7. **`apps/web/app/blog/[slug]/page.tsx`** using sync params (Next.js 14 pattern)
8. **13 additional TypeScript/import errors** across all 4 apps (see files fixed above)

### Fixes Applied
- Created `pnpm-lock.yaml` (333KB, lockfileVersion:'9.0') — THE fix
- Created `.npmrc`, `.gitignore`, root `vercel.json`, 4× per-app `vercel.json`
- Fixed all 4 `postcss.config.mjs` → Tailwind v3 syntax
- Fixed all 4 `eslint.config.mjs` → FlatCompat pattern + `react/no-unescaped-entities: off`
- Fixed 13 TypeScript/import errors across apps (icon conflicts, undefined vars, type casts)
- Added `@eslint/eslintrc ^3.2.0` to all 4 app devDependencies

### Validation Result
All 4 apps build successfully: web (32 routes), therapist (28), patient (17), admin (17).

---

## Session 5 Summary (2026-06-06 — Pricing Audit & Standardization)

### What Was Audited
- Full codebase audit from scratch (3 audit documents created)
- AUDIT_REPORT.md: All 5 apps + backend + infrastructure
- PRODUCTION_GAP_ANALYSIS.md: Build failures, security, deployment blockers
- FEATURE_MATRIX.md: 117 features scored (18 complete, 52 mock, 22 missing)

### Critical Issue Found & Fixed
**Three conflicting pricing sources** → now ONE source of truth:
| Location | Old (hardcoded) | New (dynamic) |
|----------|----------------|---------------|
| `apps/web/pricing` | Starter $79, Pro $149, Practice $399 | Fetches from `/billing/plans` API |
| `apps/admin/billing` | Starter $59, Pro $149, Growth $599 | Removed, redirects to /pricing mgmt |
| `010_billing_schema.sql` | Professional $99, Practice $299 | Canonical DB source |

### What Was Built (commit `00d512c`)
1. **Backend**: 8 new admin plan management endpoints
2. **Admin Portal**: New `/pricing` management page (full CRUD)
3. **Shared API client**: `pricing-api.ts` in all 4 apps
4. **Web pricing page**: Now dynamic Server Component (fetches API, graceful fallback)
5. **Database migration**: `015_pricing_management.sql` (adds admin metadata columns)
6. **Admin sidebar**: Pricing Management added to BUSINESS section

### Architecture: Pricing Data Flow
```
Database (subscription_plans)
    ↓
Backend GET /billing/plans (public, no auth)
Backend GET /billing/admin/plans (admin, JWT required)
    ↓
apps/*/lib/pricing-api.ts (shared fetch client, 5-min cache)
    ↓
apps/web/pricing    → Server Component, fetches at render time
apps/admin/pricing  → Client Component, admin CRUD
apps/therapist/billing → (TODO: upgrade section)
apps/patient/billing   → (TODO: plan display)
```

---

## Remaining Work — Priority Ordered

### Priority 1 — Authentication (CRITICAL)
- [ ] Connect all login pages to real backend JWT (`/auth/login`)
- [ ] Implement token refresh (`/auth/refresh`)
- [ ] Replace Zustand-only auth with real JWT flow
- [ ] Session timeout enforcement (30 min idle, 4 hr absolute)
- [ ] Registration/signup pages (missing from all portals)
- [ ] Password reset flow

### Priority 2 — Replace Mock Data with Real APIs
- [ ] Therapist dashboard → real patient/session counts from API
- [ ] Patient list → real `/patients` API with pagination
- [ ] Sessions list → real `/sessions` API
- [ ] Notes → real session notes from API
- [ ] AI workspace → real `/ai` API calls
- [ ] Messages → real WebSocket messaging
- [ ] Notifications → real notification events
- [ ] Therapist billing → real invoice data from `/billing/invoices`
- [ ] Patient billing → real invoice data from API

### Priority 3 — AI Systems Connection
- [ ] Connect AI workspace to backend `ai.service.ts`
- [ ] Real session transcription via Whisper
- [ ] AI Copilot with real GPT-4o context injection
- [ ] Memory engine: trigger updates from session completion
- [ ] Risk detection: connect risk-monitor to radar service

### Priority 4 — Backend Completeness
- [ ] `radar` module DTOs — RiskAlert, SafetyPlan, CrisisProtocol DTOs
- [ ] `marketplace` module DTOs — Integration, AppListing, InstallRequest DTOs
- [ ] `ValidationPipe` global config in `backend/src/main.ts`
- [ ] Add `@ApiResponse` decorators to remaining controllers

### Priority 5 — Web App Pages (Lower Priority)
- [ ] `/press` — press kit, media coverage, brand assets
- [ ] `/status` — system status page
- [ ] `/gdpr` — GDPR compliance center
- [ ] `/changelog` — product changelog
- [ ] `/demo` — demo booking page (currently broken link)
- [ ] `/signup` — registration page (currently broken link)

### Priority 6 — Testing
- [ ] Backend unit tests for memory service
- [ ] Backend unit tests for billing service (Stripe webhook handling)
- [ ] E2E tests for auth flows

### Priority 7 — DevOps
- [ ] Dockerfiles for each app (Next.js multi-stage builds)
- [ ] `infra/prometheus.yml` — Prometheus config
- [ ] `infra/grafana/` — Grafana dashboard provisioning
- [ ] Move CI back to `.github/workflows/` once GitHub App has workflows permission

---

## Reusable Patterns

### Admin Page Pattern
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

### DTO Pattern (NestJS)
```typescript
// 1. Enums at top
// 2. Query DTOs (for GET endpoints)
// 3. Create DTOs (for POST endpoints)
// 4. Update DTOs (all fields optional, same as Create but IsOptional)
// 5. Use @ApiProperty on everything for Swagger
// 6. Use class-validator decorators: @IsString, @IsEnum, @IsUUID, @IsOptional
```

### Lucide Icon Debugging
```bash
# Icon doesn't exist in lucide-react?
node -e "const lr = require('lucide-react'); console.log(Object.keys(lr).filter(k => k.toLowerCase().includes('SEARCH')))"
# Browse: https://lucide.dev/icons/
```

### Next.js 15 Dynamic Route Params
```tsx
// Server component (async):
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
// Client component: use useParams() hook — params prop pattern doesn't apply
```

---

## PRICING ARCHITECTURE (Critical — Do Not Break)

### Single Source of Truth Rule
**ALL pricing data MUST come from the database `subscription_plans` table.**

| NEVER DO THIS | ALWAYS DO THIS |
|--------------|----------------|
| Hardcode prices in TSX files | Fetch from `GET /billing/plans` |
| Add static plan arrays to pages | Use `fetchPublicPlans()` from `pricing-api.ts` |
| Create separate pricing constants | Edit plans via `/admin/pricing` |

### Price Data Flow
```
Admin edits plan via /admin/pricing
  → PUT /billing/admin/plans/:id
  → PostgreSQL subscription_plans table
  → GET /billing/plans (public, 5-min ISR cache)
  → apps/web/app/pricing/page.tsx (Server Component)
```

### Key Pricing Files
| File | Purpose |
|------|---------|
| `apps/*/lib/pricing-api.ts` | Shared API client (in all 4 apps) |
| `apps/admin/app/(dashboard)/pricing/page.tsx` | Admin CRUD interface |
| `backend/src/modules/billing/billing.service.ts` | Plan management methods |
| `backend/src/modules/billing/billing.controller.ts` | `/billing/admin/plans/*` endpoints |
| `migrations/015_pricing_management.sql` | Schema extensions for admin metadata |

---

## Important File Locations

| File | Purpose |
|------|---------|
| `packages/types/src/index.ts` | 1,860+ line shared types — check before adding new types |
| `apps/admin/components/layout/admin-sidebar.tsx` | Admin nav — sections: PLATFORM, COMPLIANCE, BUSINESS, TOOLS, SYSTEM |
| `apps/therapist/components/layout/sidebar.tsx` | Therapist nav — sections: PATIENT CARE, PRACTICE, COMPLIANCE |
| `apps/patient/components/layout/patient-sidebar.tsx` | Patient nav — includes homework + profile |
| `apps/web/app/layout.tsx` | Global layout — wraps ALL web pages with Navbar + Footer |
| `backend/src/modules/auth/guards/jwt-auth.guard.ts` | JWT guard used on all protected routes |
| `pnpm-lock.yaml` | MUST be kept committed — regenerate after adding deps |
| `.npmrc` | Hoisting config — MUST stay committed for Vercel |

---

## HIPAA Requirements (Technical)

- **PHI** = any patient-identifiable information in session notes, assessments, records
- **Audit logging**: every PHI access, modification, export must be logged with actor, target, IP, outcome
- **Encryption**: PHI fields encrypted at rest using `DATA_ENCRYPTION_KEY` (AES-256-GCM)
- **Access control**: minimum necessary — therapists only see their own patients
- **Session timeout**: 4 hours max (configurable); idle timeout 30 min
- **MFA**: required for all org_admin and above roles
- **Retention**: audit logs retained 6 years per HIPAA §164.312(b)
