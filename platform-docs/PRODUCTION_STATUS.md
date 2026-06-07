# 24Therapy.ai — Production Status

**Last updated:** 2026-06-07  
**Estimated production readiness:** 68%

---

## ✅ Production Ready

- **Domain standardization** — All references use `24therapy.ai`
- **Database schema** — 15 migrations covering all entities
- **Backend auth** — JWT login, register, refresh, logout, password reset (NestJS)
- **Backend AI module** — Note generation, copilot, risk check, embeddings endpoints
- **Therapist portal auth** — Real JWT login (connects to backend)
- **Patient portal auth** — Real JWT login (connects to backend)
- **Admin portal auth** — Real JWT login with role validation
- **Pricing system** — Centralized API with DB-driven prices, fallback data
- **Marketing site** — Full-featured marketing site with all key pages
- **Navigation** — Clean SaaS nav with conversion-focused structure
- **Deployment configs** — Vercel configs for all 4 apps, Railway for backend
- **HIPAA headers** — Security headers on all apps
- **Monorepo structure** — pnpm workspaces + Turborepo

---

## 🚫 Blockers (Must Fix Before Launch)

1. **Email service** — `requestPasswordReset` logs token to console instead of sending email. Needs SendGrid integration in `auth.service.ts`.
2. **Backend API port mismatch** — `backend/.env.example` says port 3001 but frontend `.env.example` files point to `localhost:4000/api/v1`. Standardize to port 3001 or 3004.
3. **Missing signup page** (`/signup`) — CTAs link to `/signup` but route doesn't exist in `apps/web`. Must create.
4. **Missing forgot-password / reset-password routes** — Patient portal links to `/forgot-password` but route doesn't exist.
5. **Missing `/chat` route** — Hero links to `/chat` (anonymous AI) but route doesn't exist.
6. **Missing `/demo` route** — Multiple CTAs link to `/demo` but route doesn't exist.
7. **Missing `/login` route on web** — Navbar links to `/login` (mobile) but no route.
8. **Admin `X-Robots-Tag: noindex`** — Admin next.config.ts correctly noindexes; web app missing sitemap.xml.

---

## ⚠️ Missing Functionality

- **Email sending** — All transactional emails (welcome, reset, verification) are stubs
- **Video rooms** — Daily.co integration is env-var ready but not wired to session rooms
- **Stripe webhooks** — Billing endpoints exist but webhook handler needs testing
- **Therapist onboarding flow** — `/onboarding` page exists in therapist app but incomplete
- **Patient signup flow** — Patients must be invited; no self-service signup
- **Anonymous AI chat** — Hero shows chat UI but `/chat` route doesn't exist
- **Sitemap / robots.txt** — Not yet generated for web app

---

## 🔒 Security Concerns

- **JWT secret** — Example uses placeholder; production must use 32+ char secret
- **Admin portal** — Should enforce IP allowlist in production (env var exists)
- **MFA** — Backend has MFA field in DB but not enforced on auth flow
- **CORS** — Production CORS must list exact domains, not wildcards
- **PHI encryption** — `DATA_ENCRYPTION_KEY` must be set; no fallback check

---

## 🚀 Deployment Concerns

- **Backend port** — Mismatch between `PORT=3001` (backend) and `NEXT_PUBLIC_API_URL` defaults
- **Database migrations** — Must run all 15 migrations in sequence before first deploy
- **Redis required** — Backend expects Redis for sessions/queues; must provision before deploy
- **Missing `apps/web/public/` assets** — No `og-image.png` or favicon beyond default
- **Turbo cache** — `turbo.json` has no remote cache configured

---

## 📊 Readiness by Component

| Component | Status | Notes |
|-----------|--------|-------|
| Database schema | ✅ 95% | All 15 migrations complete |
| Backend API | ✅ 80% | Auth, AI, billing, patients, sessions all present |
| Therapist portal | ✅ 75% | Auth real, all dashboards present, onboarding incomplete |
| Patient portal | ✅ 70% | Auth real, missing signup and forgot-password |
| Admin portal | ✅ 80% | Auth real, all admin pages present |
| Marketing site | ✅ 65% | Missing /signup, /demo, /chat, /login routes |
| Email service | ❌ 10% | Stubs only — no real sending |
| Video rooms | ⚠️ 30% | Daily.co config ready, not wired |
| Billing / Stripe | ⚠️ 50% | Plans API done, webhooks untested |
| Deployment configs | ✅ 85% | Vercel + Railway configs present |
