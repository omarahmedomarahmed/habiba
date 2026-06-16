# 24Therapy Platform Architecture

Last updated: 2026-06-16 | Branch: main

## Overview

24Therapy is a HIPAA-compliant mental health SaaS platform. Four Next.js 15 portals + one NestJS 10 API in a Turborepo monorepo.

## Authentication Flow

1. All NestJS routes are protected by `JwtAuthGuard` (APP_GUARD in app.module.ts)
2. `JwtAuthGuard` checks for `@Public()` decorator via Reflector — if present, skips JWT validation
3. JWT payload: `{ sub: userId, org: organizationId, role }`
4. `JwtStrategy.validate()` calls `getUserIdentity()` which returns a user object with both snake_case (`organization_id`) and camelCase (`organizationId`, `userId`, `therapistId`, `patientId`) properties
5. **Never** add `@UseGuards(AuthGuard('jwt'))` at controller class level — use `@Public()` for opt-out instead

## User Roles & Organization Model

Each user belongs to exactly one organization. Therapists create their own solo org during registration (unless `organization_slug` is provided). Super admins have a separate HQ org.

| Role | Portal | Organization |
|------|--------|-------------|
| `super_admin` | Admin :3003 | HQ org (seeded) |
| `therapist` | Therapist :3001 | Solo or group practice org |
| `patient` | Patient :3002 | Patient's linked org |

Admin `GET /therapists` skips org filter for `super_admin` and `admin` roles.

## Session Lifecycle

```
create() → status: 'scheduled'
    ↓ therapist clicks Start
updateStatus('in_progress') → creates transcript row
    ↓ browser sends 5s audio chunks
POST /ai/sessions/:id/transcribe → Whisper → transcript_segments
    ↓ therapist clicks End
updateStatus('completed') → billing hook → autoGenerateSessionOutput()
    ↓
AI generates SOAP note → ai_session_notes table
```

## Session Join Token Flow (public / unauthenticated)

```
POST /sessions → returns join_token (UUID)
Therapist shares link: /join/<token>
Patient hits GET /sessions/join/:token (@Public) → gets session info + payment status
Patient hits POST /sessions/join/:token (@Public) → joins session
```

## Marketplace / Find Therapist

- `GET /marketplace/search` (`@Public`) queries `therapists` table directly
- Filter: `verification_status = 'approved' AND deleted_at IS NULL`
- No `marketplace_listings` row required
- Therapists appear immediately after admin approval via `PATCH /therapists/:id/verify`

## Transcription Pipeline

```
Browser: MediaRecorder API → 5s webm chunks
→ POST /api/v1/ai/sessions/:id/transcribe (JWT required, therapist only)
→ ai.service.transcribeAudio()
→ model-gateway.transcribe(buffer)
→ openai.audio.transcriptions.create({ file: await toFile(buffer, ...) })
→ addTranscriptSegment() → transcript_segments table
→ WebSocket crisis keyword scan (no PHI in events)
```

Note: `toFile()` from the `openai` package must be used (not browser `File` constructor) for Node.js compatibility.

## Key Database Tables

| Table | Notes |
|-------|-------|
| `organizations` | One per therapist/group, or platform HQ |
| `users` | All roles; `organization_id` FK |
| `therapists` | `verification_status` CHECK: pending/under_review/approved/rejected/suspended |
| `patients` | `primary_therapist_id` FK to therapists |
| `sessions` | `session_type` CHECK: standard/radar/group/phone/in_person/intake/follow_up |
| `sessions` | `patient_id` NULLABLE (migration 030) — supports offline/guest sessions |
| `transcripts` | One per session, created when session starts |
| `transcript_segments` | Audio chunks from Whisper, FK to transcripts |
| `therapist_patient_assignments` | Uses `ended_at` not `deleted_at`; no `is_primary` column |
| `therapist_availability` | Uses `is_active` not `is_available`; `timezone NOT NULL` |
| `therapist_availability_exceptions` | Uses `exception_date` not `date` |
| `session_fees` | Uses `gross_amount` not `amount` |
| `radar_requests` | Uses `urgency`, `preferred_session_type`, `budget_per_session`, `preferred_gender` |
| `radar_broadcasts` | Has `response`/`responded_at`, NOT `status` column |
| `phi_access_log` | HIPAA audit log (6-year retention via DataLifecycleModule) |

## Migrations

Run in order: 001 → 016 (consolidated) then 029, 030, 031, 032, 033

```bash
node scripts/migrate.js  # runs all pending migrations using pg_advisory_lock
```

## HIPAA Security Invariants

1. **No PHI in logs**: Never log transcript text, message body, or patient name in Logger calls
2. **Crisis events**: Patients receive only `crisis_support` WebSocket event (never `crisis_alert`, never risk level)
3. **Boot guard**: `validateEnv()` in `config/env.validation.ts` throws on missing `DATABASE_URL`, `OPENAI_API_KEY`, `CORS_ORIGINS`, short `JWT_SECRET`/`COOKIE_SECRET`
4. **CORS**: `buildCorsOriginFn()` in `config/cors.ts` — no wildcard in production
5. **Message encryption**: AES-256-GCM via `MESSAGE_ENCRYPTION_KEY` env var (migration 027)
6. **PHI audit**: `PhiAuditInterceptor` (APP_INTERCEPTOR) logs all PHI route access to `phi_access_log`

## API Client Pattern (Frontend)

Each portal has `apps/*/lib/api.ts` with typed fetch wrappers:
- `apiFetch(path, options)` — adds Bearer token, handles 401 → token refresh → retry
- All API URLs relative to `getApiUrl()` from `apps/*/lib/env.ts`
- Admin portal calls backend at `NEXT_PUBLIC_API_URL/api/v1/admin/*`

## Known Production Column Gaps

Some production deployments may not have run migrations 029-031. The sessions service handles this with try-catch:
```typescript
try {
  // Query with migration-030 columns (patient_name_guest, patient_email, etc.)
} catch (err) {
  if (err?.code !== '42703') throw err; // 42703 = "column does not exist"
  // Fallback to base schema query
}
```
