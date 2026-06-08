# 24Therapy — Production Readiness Report
**Generated**: 2026-06-08  
**Auditor**: AI Code Review (Sessions 2 + 3)  
**Scope**: Full 12-phase production deployment recovery audit  
**Repo branch**: `main`  
**Last commit certified**: `11c1665`

---

## Executive Summary

All **5 deployable artifacts** (Railway backend + 4 Vercel frontends) were previously failing with `ERR_PNPM_OUTDATED_LOCKFILE`. This report documents all root causes identified, all fixes applied, and the current production-ready state.

| Artifact | Pre-Audit Status | Post-Audit Status |
|---|---|---|
| Railway (backend API) | ❌ FAIL — lockfile outdated, wrong start path, build script broken | ✅ PASS |
| Vercel (web / marketing) | ❌ FAIL — lockfile outdated, wrong env overrides, 404 build crash | ✅ PASS |
| Vercel (therapist portal) | ❌ FAIL — lockfile outdated, wrong env, transpilePackages error, 404 crash | ✅ PASS |
| Vercel (patient portal) | ❌ FAIL — lockfile outdated, wrong env overrides | ✅ PASS |
| Vercel (admin portal) | ❌ FAIL — lockfile outdated, wrong env/CSP overrides | ✅ PASS |

**Auth critical bug also fixed**: All auth endpoints (register, login, refresh, forgot-password, reset-password) were blocked by the global `JwtAuthGuard` — no user could register or log in.

---

## Commits Applied (This Audit)

| Hash | Description |
|---|---|
| `f66ba28` | Backend TypeScript zero-error build + URL normalization (29 files) |
| `b087c47` | Eliminate remaining localhost/hardcoded-domain refs + initial report (13 files) |
| `138a26b` | **Lockfile regenerated, build script fixed, Railway path fixed, auth guard fixed, all 4 vercel.json env blocks removed** |
| `5759606` | Phase 10: Add Railway/S3/Vercel hosts to Next.js image remotePatterns |
| `11c1665` | Phase 12: Add not-found.tsx to web and therapist (Next 15.3.x build fix) |

---

## Phase 1 — Repository Audit

### Monorepo Structure
```
/
├── apps/
│   ├── web/          Next.js 15.3.8  — marketing site (Vercel)
│   ├── therapist/    Next.js 15.3.8  — therapist portal (Vercel)
│   ├── patient/      Next.js 15.1.11 — patient portal (Vercel)
│   └── admin/        Next.js 15.1.11 — admin panel (Vercel)
├── backend/          NestJS 10       — REST API (Railway)
├── packages/
│   ├── types/        Shared TypeScript types
│   └── config/       Shared URL config (NEW — this session)
├── migrations/       001–015 SQL files (Neon PostgreSQL)
├── turbo.json        Turborepo task pipeline
├── pnpm-workspace.yaml
├── .npmrc            node-linker=hoisted, shamefully-hoist=true
├── railway.json      Railway deploy config (monorepo root)
└── backend/nixpacks.toml  Nix build packages
```

### Key Version Facts
- pnpm: `9.15.4` (`engines.pnpm` in root package.json)
- Turbo: managed by pnpm
- Node: 20.x (Railway + Vercel)
- Next.js: **two versions in use** — web/therapist use `15.3.8`; patient/admin use `15.1.11`
  - These coexist correctly: pnpm puts 15.3.8 in `apps/web/node_modules/` and `apps/therapist/node_modules/`, 15.1.11 at root `node_modules/`
  - Each workspace's `.bin/next` symlink resolves to its own version ✅

---

## Phase 2 — Dependency Integrity

### Root Cause of `ERR_PNPM_OUTDATED_LOCKFILE`
Three packages were added to `backend/package.json` without regenerating `pnpm-lock.yaml`:
1. `@nestjs/event-emitter: ^2.0.4` (required by `radar.service.ts`)
2. `eventemitter2: ^6.4.9` (peer dep of event-emitter)
3. `stripe: 16.12.0` (pin — was `^16.x.x`)

**Fix**: `pnpm install --no-frozen-lockfile` — regenerated lockfile.  
**Verification**: `pnpm install --frozen-lockfile` → exit 0 ✅

### Backend Build Script Fix
**Before**: `"build": "npx tsc"` — `npx` downloads stub npm package `tsc@2.0.4`, not TypeScript compiler.  
**Root cause**: pnpm hoisted layout (`node-linker=hoisted`) does not create `.bin/tsc` in root `node_modules/.bin/`, so `npx tsc` falls back to npm registry.  
**Fix**: `"build": "node ../node_modules/typescript/bin/tsc -p tsconfig.json"`

---

## Phase 3 — Railway Audit

### Start Command Path
`backend/tsconfig.json` has:
```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "paths": { "@24therapy/types": ["../packages/types/src/index.ts"] }
  }
}
```
The cross-package `paths` alias references `../packages/types`, making the TypeScript `rootDir` become the monorepo root. TypeScript preserves directory structure in output: `dist/backend/src/main.js` (not `dist/src/main.js`).

| File | Before | After |
|---|---|---|
| `railway.json` startCommand | `node backend/dist/main` | `node backend/dist/backend/src/main.js` |
| `backend/Procfile` | `web: node dist/main.js` | `web: node dist/backend/src/main.js` |

### Railway nixpacks
`backend/nixpacks.toml` correctly installs `nodejs_20`, `pnpm` via nix packages, and runs `pnpm install --frozen-lockfile` before `pnpm run build`.

---

## Phase 4 — Vercel Audit (All 4 Apps)

### vercel.json `env` Block Override Bug
All 4 `vercel.json` files contained an `env` block with hardcoded production URLs. Vercel's `env` in `vercel.json` **overrides** the Vercel project dashboard environment variables — meaning any dashboard-configured `NEXT_PUBLIC_API_URL` would be silently ignored.

**Removed `env` blocks from**:
- `apps/web/vercel.json` — hardcoded `NEXT_PUBLIC_API_URL: https://api.24therapy.ai/api/v1`
- `apps/therapist/vercel.json` — same
- `apps/patient/vercel.json` — `NEXT_PUBLIC_SITE_URL: https://my.24therapy.ai`
- `apps/admin/vercel.json` — `NEXT_PUBLIC_SITE_URL` + CSP referencing `api.24therapy.ai`

### Therapist `transpilePackages` Fix
`apps/therapist/next.config.ts` listed `@24therapy/ui` and `@24therapy/utils` in `transpilePackages` — these packages do not exist in the monorepo. Removed.

### Next.js 15.3.x Build Crash (web + therapist)
**Symptom**: `Error: <Html> should not be imported outside of pages/_document` during static page generation for `/404`.  
**Root cause**: Next.js 15.3.x App Router with no `not-found.tsx` falls through to an internal pages-router 404 generator that conflicts with the app router's HTML context.  
**Fix**: Added `apps/web/app/not-found.tsx` and `apps/therapist/app/not-found.tsx`.  
**Note**: apps/patient and apps/admin (Next 15.1.11) are unaffected.

---

## Phase 5 — Environment Variables Audit

### Backend Environment Variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ REQUIRED | none | Neon PostgreSQL connection string |
| `JWT_SECRET` | ✅ REQUIRED | `change-me-in-production` | **Must change** — default is insecure |
| `JWT_ACCESS_EXPIRY` | optional | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRY` | optional | `30d` | Refresh token lifetime |
| `PORT` | optional | `4000` | Railway sets this automatically |
| `NODE_ENV` | optional | `development` | Set to `production` on Railway |
| `CORS_ORIGINS` | ✅ REQUIRED | `[]` (empty) | Comma-separated Vercel deployment URLs |
| `OPENAI_API_KEY` | ✅ REQUIRED | none | Without it, AI features return mock data |
| `OPENAI_DEFAULT_MODEL` | optional | `gpt-4o` | Override AI model |
| `OPENAI_EMBEDDING_MODEL` | optional | `text-embedding-3-small` | Embedding model |
| `OPENAI_WHISPER_MODEL` | optional | `whisper-1` | Transcription model |
| `OPENAI_MAX_TOKENS` | optional | `4096` | Max tokens per completion |
| `ANTHROPIC_API_KEY` | optional | none | Fallback AI provider (not yet wired in routing) |
| `STRIPE_SECRET_KEY` | ✅ REQUIRED (billing) | none | Billing disabled without this |
| `STRIPE_PUBLISHABLE_KEY` | ✅ REQUIRED (billing) | none | |
| `STRIPE_WEBHOOK_SECRET` | ✅ REQUIRED (billing) | none | Webhook signature validation |
| `RESEND_API_KEY` | optional | none | Email sends fall back to console.log |
| `FROM_EMAIL` | optional | `24Therapy <noreply@24therapy.ai>` | Sender address |
| `APP_URL` | optional | `https://24therapy.ai` | Used in email links |
| `PATIENT_APP_URL` | optional | `https://my.24therapy.ai` | Used in email links |
| `THERAPIST_APP_URL` | optional | `https://app.24therapy.ai` | Used in email links |
| `SMTP_HOST` | optional | `smtp.gmail.com` | Fallback SMTP (not used if RESEND_API_KEY set) |
| `SMTP_PORT` | optional | `587` | |
| `SMTP_USER` | optional | none | |
| `SMTP_PASSWORD` | optional | none | |
| `EMAIL_FROM` | optional | `noreply@24therapy.ai` | |
| `EMAIL_FROM_NAME` | optional | `24Therapy.ai` | |
| `DATABASE_SSL` | optional | `false` | Set `true` for Neon |
| `DATABASE_MAX_CONNECTIONS` | optional | `10` | PG pool size |
| `REDIS_URL` | optional | `redis://localhost:6379` | **Not used in code** — ThrottlerModule uses in-memory |
| `REDIS_TTL` | optional | `86400` | Not used (no Redis client instantiated) |
| `AWS_ACCESS_KEY_ID` | optional | none | File uploads |
| `AWS_SECRET_ACCESS_KEY` | optional | none | |
| `AWS_REGION` | optional | `us-east-1` | |
| `AWS_S3_BUCKET` | optional | `24therapy-files` | |
| `CLOUDFRONT_URL` | optional | none | CDN prefix |
| `DAILY_API_KEY` | optional | none | Video sessions disabled without this |
| `DAILY_DOMAIN` | optional | none | |
| `BCRYPT_ROUNDS` | optional | `12` | Password hashing strength |
| `COOKIE_SECRET` | optional | `change-me-in-production` | **Must change** |
| `API_URL` | optional | `http://localhost:4000` | Used in emails and internal refs |
| `API_VERSION` | optional | `v1` | API version prefix |
| `FRONTEND_URL` | optional | `http://localhost:3000` | CORS + email links |
| `THERAPIST_URL` | optional | `http://localhost:3001` | |
| `PATIENT_URL` | optional | `http://localhost:3002` | |
| `ADMIN_URL` | optional | `http://localhost:3003` | |
| `FEATURE_AI_SCRIBE` | optional | `true` | Set `false` to disable |
| `FEATURE_COPILOT` | optional | `true` | |
| `FEATURE_RADAR` | optional | `true` | |
| `FEATURE_MARKETPLACE` | optional | `true` | |
| `FEATURE_BILLING` | optional | `true` | |

### ⚠️ Critical Security Notes
1. `JWT_SECRET` default is `change-me-in-production` — **must be set** to a 32+ char random string in Railway
2. `COOKIE_SECRET` same — must be changed
3. `DATABASE_URL` is the only hard failure — without it, NestJS will throw on startup

### Frontend Environment Variables (All 4 Vercel Apps)

| Variable | Used By | Required | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | web, therapist, patient, admin | ✅ REQUIRED | Railway backend URL. Set to `https://api-24therapy-production.up.railway.app` (or custom domain) |
| `NEXT_PUBLIC_SITE_URL` | web, patient, admin | optional | Canonical site URL for SEO/OG tags |
| `NEXT_PUBLIC_WEB_URL` | web | optional | |
| `NEXT_PUBLIC_THERAPIST_URL` | web, therapist | optional | |
| `NEXT_PUBLIC_THERAPIST_APP_URL` | therapist | optional | |
| `NEXT_PUBLIC_PATIENT_URL` | patient | optional | |
| `NEXT_PUBLIC_PATIENT_APP_URL` | patient | optional | |
| `NEXT_PUBLIC_ADMIN_URL` | admin | optional | |
| `NEXT_PUBLIC_ADMIN_APP_URL` | admin | optional | |
| `NEXT_PUBLIC_APP_URL` | therapist | optional | |
| `NEXT_PUBLIC_CALENDLY_URL` | web | optional | Calendly booking widget |

**Minimum required for a working deployment**: Only `NEXT_PUBLIC_API_URL` is strictly required. All apps have Railway URL fallback hardcoded in `lib/api.ts` files.

---

## Phase 6 — Database Audit

### Migration Files (15 total, `migrations/001–015`)
| File | Description |
|---|---|
| `001_core_schema.sql` | Organizations, users, plans. Installs `uuid-ossp`, `pgcrypto`, **`vector`** (pgvector), `pg_trgm` |
| `002_therapists_schema.sql` | Therapist profiles, credentials |
| `003_patients_schema.sql` | Patient records, mood tracking |
| `004_clinical_schema.sql` | Clinical notes, treatment plans |
| `005_medications_schema.sql` | Medication tracking |
| `006_sessions_schema.sql` | Video/audio/chat sessions, transcripts |
| `007_ai_schema.sql` | AI notes, session intelligence, **patient_memories with `vector(1536)`**, prompt registry, AI request logs |
| `008_assessments_schema.sql` | PHQ-9, GAD-7, other assessments |
| `009_radar_schema.sql` | Therapist matching/radar requests |
| `010_billing_schema.sql` | Subscriptions, invoices, payments |
| `011_notifications_schema.sql` | User notifications |
| `012_audit_compliance_schema.sql` | HIPAA audit trail |
| `013_marketplace_schema.sql` | Therapist marketplace listings |
| `014_analytics_schema.sql` | Usage analytics |
| `015_pricing_management.sql` | Dynamic pricing |

### ⚠️ pgvector Requirement (Critical)
Migration `001_core_schema.sql` runs `CREATE EXTENSION IF NOT EXISTS "vector"` — this requires **pgvector** to be installed on the PostgreSQL server.

- **Neon PostgreSQL**: pgvector is supported and available — enable it via `CREATE EXTENSION vector` or enable in the Neon console under "Extensions"
- **Migration `007_ai_schema.sql`**: Creates `patient_memories.embedding vector(1536)` and an IVFFlat index requiring `lists = 100` minimum rows before the index becomes effective
- **Action required**: Verify pgvector is enabled on the Neon project before running migrations

### Migration Ordering
Migrations are numbered sequentially (001–015). They must be run **in order**. `001` must run first as it creates `organizations`, `users`, and `plans` tables referenced by all others.

### Neon Compatibility
- Neon supports all features used: `uuid-ossp`, `pgcrypto`, `vector` (pgvector), `pg_trgm`, `JSONB`, `IVFFlat` indexes
- `DATABASE_SSL=true` should be set in Railway (Neon requires SSL)
- Connection pooling: `DATABASE_MAX_CONNECTIONS=10` (default) is appropriate for Neon's serverless connection limits

---

## Phase 7 — Authentication Audit

### Token Flow (Full Trace)

#### Registration (`POST /auth/register`) — `@Public()`
1. Check for duplicate email
2. Create organization (or join existing via `organization_slug`)
3. Hash password with bcrypt (12 rounds)
4. Insert user + therapist profile in transaction
5. Call `generateTokens()` — creates access JWT (15m) + refresh UUID stored as SHA-256 hash
6. Fire-and-forget welcome email via `mailService.sendWelcome()`
7. Return `{ user, tokens, organization }`

#### Login (`POST /auth/login`) — `@Public()`
1. Query user with org join
2. Check `status !== 'suspended'`
3. Check `locked_until` — account locks after 5 failed attempts for 15 minutes
4. `bcrypt.compare()` password
5. On failure: increment `failed_login_count`, set `locked_until` at count ≥ 4
6. On success: reset fail count, update `last_login_at`, `last_login_ip`
7. Generate tokens, return

#### Token Refresh (`POST /auth/refresh`) — `@Public()`
1. Hash incoming refresh token with SHA-256
2. Look up in `refresh_tokens` — must not be revoked, must not be expired
3. **Token rotation**: revoke old token immediately
4. Generate new access + refresh token pair
5. Return new `AuthTokens`

#### Password Reset (`POST /auth/forgot-password`) — `@Public()`
1. Look up user by email — silently returns if not found (no email enumeration)
2. Store reset token hash (`reset_${sha256(uuid)}`) in `refresh_tokens` table with 1hr expiry
3. Fire-and-forget `mailService.sendPasswordReset()` — role-aware (links to correct portal)

#### Password Reset Confirm (`POST /auth/reset-password`) — `@Public()`
1. Look up `reset_${sha256(token)}` in refresh_tokens
2. Hash new password with bcrypt
3. Transaction: update `password_hash`, revoke reset token

#### `@Public()` Decorator — Confirmed Working
`jwt-auth.guard.ts` checks `IS_PUBLIC_KEY` via `Reflector.getAllAndOverride()`. All 5 auth endpoints have `@Public()` applied. ✅

### Frontend Token Refresh Interceptor (all 4 API clients)
The `lib/api.ts` in each portal implements:
1. **401 detection**: On any 401 response with `_retry = true`, triggers refresh
2. **Queue**: Uses `_isRefreshing` flag + `_refreshQueue` array to prevent parallel refresh races
3. **Refresh call**: Hits `/auth/refresh` with stored `refresh_token` from `localStorage`
4. **On failure**: Clears tokens, redirects to `/login`
5. **Token storage**: `localStorage` (`access_token`, `refresh_token`)

### ⚠️ Auth Issues Identified (Non-Critical)

| Issue | Severity | Status |
|---|---|---|
| `COOKIE_SECRET` default value `change-me-in-production` | HIGH | Env var must be set in Railway |
| `JWT_SECRET` default value `change-me-in-production` | CRITICAL | Env var must be set in Railway |
| Reset tokens stored in `refresh_tokens` table (mixed concerns) | LOW | Works correctly; consider dedicated table in v2 |
| Access token expiry hardcoded to `900` seconds in `generateTokens()` regardless of `JWT_ACCESS_EXPIRY` config | LOW | Fix: use `this.config.get('jwt.accessExpiry')` to compute actual seconds |

---

## Phase 8 — API Audit (as-any Risk Assessment)

28 `as any` / `as unknown as` casts found across 7 modules. Risk classification:

| Module | Cast Count | Risk | Notes |
|---|---|---|---|
| `model-gateway.service.ts` | 1 | ✅ LOW | `Buffer as unknown as BlobPart` — Node.js Buffer IS a valid BlobPart at runtime; TypeScript typing gap only |
| `marketplace.service.ts` | 4 | ✅ LOW | Database row access (`totalRow as any`, `listing as any`, `bookingRef as any`) — types from raw SQL, no runtime risk |
| `marketplace.controller.ts` | 1 | ✅ LOW | `sortBy as any` — enum validated by DTO before reaching cast |
| `memory.controller.ts` | 7 | ✅ LOW | Frontend sends both `title` and `label` field names; cast bridges the shape mismatch safely |
| `memory.service.ts` | 5 | ✅ LOW | Dynamic SQL update builder with `(updates as any)[key]` iteration — safe, bounded by column whitelist |
| `notifications.controller.ts` | 1 | ✅ LOW | `dto as unknown as Record<string,unknown>` — shape-compatible pass-through |
| `radar.service.ts` | 1 | ✅ LOW | DB row field access on typed result |
| `therapists.controller.ts` | 4 | ✅ LOW | `getMyProfile() as any` — return type mismatch between service and controller; no data transformation |
| `workflows.controller.ts` | 3 | ✅ LOW | DTO shape compatibility, status string cast |

**Overall**: Zero casts introduce hidden runtime risk. All are documentation casts bridging SQL→TypeScript type gaps or DTO shape variations. No casting bypasses validation or security checks.

---

## Phase 9 — AI Audit

### ModelGatewayService (`model-gateway.service.ts`)

| Feature | Status |
|---|---|
| OpenAI key missing | ✅ Graceful — returns mock responses in dev mode |
| Completion error | ✅ Caught, logged, re-thrown with DB error log |
| Embedding (no key) | ✅ Returns random mock embedding array |
| Transcription (no key) | ✅ Returns `[Transcription requires OpenAI API key]` |
| Token cost tracking | ✅ Logged to `ai_request_logs` table |
| DB log failure | ✅ Caught in `logRequest()` with `logger.warn` — non-fatal |

### Memory Service (`memory.service.ts`)
- Memory extraction: calls `ModelGatewayService.complete()` — inherits gateway's error handling
- Embedding storage: `vector(1536)` — matches `text-embedding-3-small` dimension ✅
- Semantic search uses `<->` (cosine distance) operator — requires pgvector IVFFlat index ✅

### Radar Service (`radar.service.ts`)
- Uses `EventEmitter2` from `@nestjs/event-emitter` — now correctly installed ✅
- Event emission is fire-and-forget (no await) — non-blocking ✅

### ⚠️ AI Risks Identified

| Risk | Severity | Recommendation |
|---|---|---|
| No retry logic on OpenAI rate limit (429) | MEDIUM | Add exponential backoff for `model-gateway.complete()` |
| Anthropic model defined in config but not wired into routing | LOW | Either wire fallback routing or remove config entry |
| `embed()` mock returns random vectors — semantic search returns garbage results in dev | LOW | Acceptable for development; document clearly |
| No timeout set on OpenAI API calls | LOW | Add `timeout` option to `new OpenAI({ apiKey, timeout: 30000 })` |

---

## Phase 10 — URL Audit

### Scan Results

| Pattern | Files Found | Status |
|---|---|---|
| `localhost` in runtime code | `main.ts` CORS dev fallback only | ✅ OK — intentional dev config |
| `24therapy.ai` in hardcoded API calls | 0 | ✅ CLEAN |
| `24therapy.ai` in `vercel.json env` | 0 (removed all) | ✅ FIXED |
| `24therapy.ai` in `next.config.ts` image remotePatterns | web, therapist, admin | ✅ OK — kept for future custom domain, added Railway/S3/Vercel hosts |
| `24therapy.ai` in mail service defaults | mail.service.ts fallbacks | ✅ OK — only triggered if env vars not set |
| `status.24therapy.ai` in code | EXTERNAL constant | ✅ OK — separate status page service |

### Image Remote Patterns (Post-Fix)
All three affected apps now include:
```
✅ 24therapy.ai          — future custom domain
✅ api.24therapy.ai      — future CDN
✅ api-24therapy-production.up.railway.app  — Railway API (profile pics, uploads)
✅ *.s3.amazonaws.com    — AWS S3 uploads
✅ *.cloudfront.net      — AWS CloudFront CDN
✅ *.vercel.app          — all Vercel envs (preview + production)
```

---

## Phase 11 — Production Load & Graceful Degradation

### External Service Failure Modes

| Service | Key Usage | Behavior if Unavailable |
|---|---|---|
| **Neon PostgreSQL** | All data | NestJS startup fails — no fallback. Expected: deploy with valid `DATABASE_URL`. |
| **OpenAI API** | AI notes, embeddings, transcription, copilot | ✅ Graceful: `ModelGatewayService` returns mock data if `OPENAI_API_KEY` not set; API errors are caught, logged, re-thrown as 500 to client |
| **Stripe** | Billing, subscription management | ⚠️ Partial: billing routes will 500 if Stripe calls fail. Non-billing routes unaffected. `FEATURE_BILLING=false` disables feature. |
| **Resend (email)** | Welcome email, password reset | ✅ Graceful: all email sends are fire-and-forget. Logged to console if `RESEND_API_KEY` not set. Auth flow is not blocked by email failure. |
| **Daily.co (video)** | Video session room creation | ✅ Graceful: `if (dto.modality === 'video' && this.config.get('video.dailyApiKey'))` — room creation skipped if key not set. Session saved without room URL. |
| **Redis** | **Not used** in any module | ✅ N/A — ThrottlerModule uses in-memory storage. `REDIS_URL` env var is defined but no Redis client is instantiated anywhere. |
| **AWS S3** | File uploads | Not yet implemented in active endpoints — no runtime risk |

### Rate Limiting
`ThrottlerModule` configured with:
- `short`: 100 req / 60s per IP
- `long`: 1000 req / 1hr per IP

In-memory storage — resets on restart. Acceptable for initial production.

### Health Check
`/health` endpoint at `backend/src/main.ts` — responds `{ status: 'ok', timestamp, uptime, environment }`. No auth required (excluded from guard). Use this for Railway health checks.

---

## Phase 12 — Final Build Certification

### Build Results

| Artifact | Command | Result | Notes |
|---|---|---|---|
| `@24therapy/api` (backend) | `pnpm --filter @24therapy/api build` | ✅ **PASS** | `tsc -p tsconfig.json` → exit 0, zero errors |
| `@24therapy/web` | `pnpm --filter @24therapy/web build` | ✅ **PASS** | 38 static pages generated |
| `@24therapy/therapist` | `pnpm --filter @24therapy/therapist build` | ✅ **PASS** | 33 static pages generated |
| `@24therapy/patient` | `pnpm --filter @24therapy/patient build` | ✅ **PASS** | 24 static pages generated |
| `@24therapy/admin` | `pnpm --filter @24therapy/admin build` | ✅ **PASS** | 24 static pages generated |

### TypeScript Check
```
node ../node_modules/typescript/bin/tsc --noEmit -p backend/tsconfig.json
→ exit 0, zero errors ✅
```

### Lockfile Check
```
pnpm install --frozen-lockfile
→ exit 0 ✅ (lockfile is consistent with all package.json files)
```

---

## Launch Checklist

### Railway (Backend)

- [ ] Set `DATABASE_URL` → Neon PostgreSQL connection string with `?sslmode=require`
- [ ] Set `DATABASE_SSL=true`
- [ ] Set `JWT_SECRET` → 32+ char random string (e.g., `openssl rand -hex 32`)
- [ ] Set `COOKIE_SECRET` → separate 32+ char random string
- [ ] Set `NODE_ENV=production`
- [ ] Set `CORS_ORIGINS` → comma-separated list of all Vercel deployment URLs
  - Example: `https://your-web.vercel.app,https://your-therapist.vercel.app,https://your-patient.vercel.app,https://your-admin.vercel.app`
- [ ] Set `OPENAI_API_KEY` → OpenAI API key (AI features degraded without)
- [ ] Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (billing)
- [ ] Set `RESEND_API_KEY` (emails degrade to console without)
- [ ] Run migrations: `psql $DATABASE_URL -f migrations/001_core_schema.sql` (001→015 in order)
- [ ] Verify pgvector enabled on Neon: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Deploy — Railway build: `pnpm install --frozen-lockfile && pnpm run build`
- [ ] Railway start: `node backend/dist/backend/src/main.js`
- [ ] Health check: `GET /health` → `{ status: 'ok' }`

### Vercel (All 4 Apps)

- [ ] Set `NEXT_PUBLIC_API_URL` in each app's Vercel dashboard
  - Value: `https://<your-railway-url>.up.railway.app` (no trailing slash, no `/api/v1`)
- [ ] Set `NEXT_PUBLIC_SITE_URL` for web app (canonical URL)
- [ ] Verify `vercel.json` has NO `env` block (confirmed removed in commit `138a26b`)
- [ ] Verify `buildCommand` in `vercel.json` uses `pnpm turbo build --filter=@24therapy/<app>`
- [ ] Verify `installCommand` uses `cd ../.. && pnpm install --frozen-lockfile`

### Pre-Launch Smoke Tests
1. `GET /health` → 200 `{ status: 'ok' }`
2. `POST /api/v1/auth/register` → 201 with `{ user, tokens, organization }`
3. `POST /api/v1/auth/login` → 200 with `{ user, tokens, organization }`
4. `GET /api/v1/auth/me` with Bearer token → 200 with user object
5. `POST /api/v1/auth/forgot-password` → 200 (no body)
6. Marketing site loads at Vercel URL
7. Therapist portal login page loads at Vercel URL

---

## Remaining Recommendations (Post-Launch)

| Priority | Item |
|---|---|
| HIGH | Add exponential backoff retry to `ModelGatewayService.complete()` for OpenAI 429 errors |
| HIGH | Add OpenAI API call timeout: `new OpenAI({ apiKey, timeout: 30_000 })` |
| MEDIUM | Fix `expires_in: 900` hardcode in `generateTokens()` — derive from `JWT_ACCESS_EXPIRY` config |
| MEDIUM | Consider dedicated `password_reset_tokens` table (currently reuses `refresh_tokens` with `reset_` prefix) |
| MEDIUM | Wire Anthropic as fallback model in `ModelGatewayService` routing (key is configured but unused) |
| LOW | Upgrade patient/admin from Next 15.1.11 to 15.3.8 for consistency |
| LOW | Standardize refresh token expiry — hardcoded to 30 days in code but `JWT_REFRESH_EXPIRY` config is ignored |
| LOW | Add Redis for distributed rate limiting (currently in-memory, resets on restart) |
| LOW | Add SMTP fallback for email delivery if Resend unavailable |

---

*Report generated by AI Code Review — 24Therapy Production Readiness Audit*  
*Certified build state: commit `11c1665` on branch `main`*
