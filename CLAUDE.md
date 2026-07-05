# CLAUDE.md — 24Therapy MVP — AI Session State

> Read this file at the START of every session. Update it at the END of every session.
> Documentation lives in exactly two files: `README.md` (ops manual: env vars, DB, deploy)
> and `docs/PRODUCT_MVP.md` (product spec). Do not create other .md files.

## Project Identity

| Field | Value |
|-------|-------|
| **Project** | 24Therapy — AI Mental Health OS (MVP) |
| **Repo** | https://github.com/omarahmedomarahmed/habiba |
| **Stack** | Next.js 15 · NestJS 10 · PostgreSQL 16 + pgvector (Neon) · TypeScript · Turborepo + pnpm |
| **Last Updated** | 2026-07-05 (session 30 — MVP-scope rebuild: apps stripped to PRODUCT_MVP.md, fresh 12-file schema, plan gating) |

## MVP shape (session 30 rebuild)

- **Two access levels**: `apps/therapist` (3001) + `apps/admin` (3003) + `backend` (4000).
  `apps/web` = optional marketing; `apps/patient` = OUT of MVP (not deployed, kept in repo).
- **Backend modules (18)**: auth, users, organizations, therapists, patients, sessions, ai,
  crisis, notes, treatment-plans, radar, billing, analytics, notifications, admin, mail,
  contact, data-lifecycle. Removed: marketplace, assessments, memory(graph), workflows,
  messages, referrals, reports, booking, crm — plus wallet/payout/patient-payment code in
  billing/sessions/therapists/mail.
- **Plan gating** (docs/PRODUCT_MVP.md matrix): single source of truth
  `backend/src/modules/billing/plan-features.ts` + `GET /billing/my-features`;
  frontend mirror `apps/therapist/lib/tiers.ts`. Enforced server-side:
  Radar = Starter+ (403 UPGRADE_REQUIRED), recordings flag = Starter+ (forced false in
  sessions.create), full analytics `/analytics/outcomes` = Unlimited+ for therapist role,
  AI chat = 5 credits/session on PAYG (402), PAYG $6/session first-free + Starter 20/mo
  quota with rollover (billing.service).
- **Therapist routes**: dashboard, sessions(+new/[id]/room), patients(+new/[id]), notes,
  treatment-plans, ai-workspace, analytics (outcomes/patients tabs tier-gated), radar,
  risk-monitor, billing, notifications, settings, onboarding, join/[token], auth.
- **Admin routes**: dashboard, therapists, credentials, users, organizations,
  subscriptions, billing, pricing, crisis, audit-logs, settings, auth.

## Database (fresh — old Neon DB deleted by owner)

- `migrations/001–012` rewritten from scratch (extensions → core → therapists → patients →
  sessions → clinical → ai → billing → radar → notifications → platform → seed).
  Verified end-to-end on blank Postgres 16 + pgvector: migrate → seed → boot → login →
  register → create session all pass. Auto-runs on deploy via railway.json
  `preDeployCommand: node scripts/migrate.js --auto-baseline`.
- `scripts/seed.js` fixed to match fresh schema (org insert, users partial unique index).
- Table renames vs old code: `audit_log` (was audit_logs mismatch), ai usage unified on
  `ai_request_logs`, analytics rewired: billing_transactions→session_charges,
  patient_assessments→assessment_results, platform_events created.

## Verified (2026-07-05)

- Backend `tsc` ✅, jest ✅ (7 suites / 65 tests), boots against fresh DB ✅.
- Smoke-tested API: login, register, /billing/plans, /billing/my-features, radar 403 on
  PAYG, in-person session create with guest patient + join_token ✅.
- `@24therapy/therapist` build ✅ · `@24therapy/admin` build ✅.

## Security invariants (NEVER regress)

1. No PHI in logs. 2. Crisis: patients get only supportive `crisis_support` copy — never
risk level. 3. `validateEnv()` boot guard (DATABASE_URL, OPENAI_API_KEY, CORS_ORIGINS,
JWT_SECRET, COOKIE_SECRET, STRIPE_WEBHOOK_SECRET). 4. No CORS wildcard in prod.
5. Redis optional. 6. phi_access_log on all PHI routes; break-glass logged.

## Known follow-ups

- `apps/web` still calls removed endpoints on some pages (marketplace search on
  find-therapist/hero → empty-state fallback; public assessments submit → 404;
  /t/[slug] booking links → dead). Web is out of MVP deploy set; clean up before
  deploying it.
- `apps/patient` compiles but its backend endpoints (messages/workflows/assessments)
  are gone — do not deploy.
- GitHub Actions CI blocked by account billing (pre-existing); Vercel is the build gate.
- Before first real patient: BAAs (Railway/Vercel/OpenAI/Resend/Daily), pen test,
  designate Security Officer.
