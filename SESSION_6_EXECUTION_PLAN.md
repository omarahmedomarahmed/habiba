# SESSION 6 EXECUTION PLAN
> Created: 2026-06-06 | Agent: AI Lead Engineer
> Goal: Transform 24Therapy.ai from "mostly functional prototype" to "fully operational production-ready platform"

---

## 1. VERIFIED CURRENT STATE

### Repository State
- **Branch**: `main`
- **Last Commit**: `00d512c` — feat(pricing): centralized pricing management system
- **Build Status**: All 4 Next.js apps pass build (last verified 2026-06-04, commit `7150495`)
- **Working Tree**: Clean (no uncommitted changes at session start)

### Authentication State (CRITICAL GAP)
| Portal | Auth Method | Status |
|--------|-------------|--------|
| Admin | `useAdminAuth` Zustand + demo bypass (`admin@24therapy.com`/`admin`) | ❌ FAKE — no real JWT |
| Therapist | `useAuthStore` Zustand + `authAPI.login()` → calls backend BUT stores in localStorage without validation | ⚠️ PARTIAL — API call exists but no token refresh, no role check |
| Patient | `useAuthStore` Zustand + **`await new Promise(r => setTimeout(r, 800)); router.push('/home')`** | ❌ COMPLETELY FAKE — pure timeout |

**Root Cause**: Backend `/auth/login` returns `{ user, tokens: { access_token, refresh_token, expires_in, token_type } }` but:
- Therapist portal expects `res.access_token` (flat), gets `res.tokens.access_token` (nested)
- Patient portal never calls backend at all
- Admin portal has hardcoded demo bypass with no real API path

### Mock Data State (52 pages with MOCK_* arrays)
**Therapist Portal** (18 pages):
- dashboard, patients, patients/[id], sessions, sessions/new, sessions/[id]/prepare, sessions/[id]/room
- notes, notes/[id], ai-workspace, assessments, billing, messages, notifications
- radar, referrals, reports, risk-monitor, treatment-plans

**Patient Portal** (5 pages):
- sessions, billing, ai-companion, notifications, (home dashboard)

**Admin Portal** (10 pages):
- dashboard, organizations, users, therapists, practice-management, billing, crm
- (pricing now done ✅)

### Backend API State
- All 16 modules have controllers + services
- Auth returns: `{ success, data: { user, tokens, organization }, meta }`
- `tokens.access_token` = JWT (15min expiry)
- `tokens.refresh_token` = UUID (30 days, rotated on use)
- WebSocket gateway exists at `backend/src/gateways/events.gateway.ts`

### Infrastructure State
- `apps/admin/lib/api.ts` — Uses wrong base URL (`http://localhost:3001`, should be `http://localhost:4000/api/v1`)
- `apps/therapist/lib/api.ts` — Correct URL (`http://localhost:4000/api/v1`)
- `apps/patient/lib/` — No api.ts exists (patient never had one)
- No shared auth middleware/interceptor for token refresh across portals

### Missing Pages
- `/signup` (web) — link broken
- `/demo` (web) — link broken
- `/press` (web) — 404
- `/status` (web) — 404
- `/gdpr` (web) — 404
- `/changelog` (web) — 404

---

## 2. BLOCKERS

### Blocker 1: No Running Backend (DEVELOPMENT ONLY)
**Impact**: Cannot test real auth during development
**Workaround**: Implement real auth client code; graceful fallback to demo mode when API unreachable
**Resolution**: Code must work when `NEXT_PUBLIC_API_URL` points to live backend

### Blocker 2: Admin API URL Wrong
**File**: `apps/admin/lib/api.ts`
**Current**: `http://localhost:3001`
**Required**: `http://localhost:4000/api/v1`
**Fix**: Update immediately in Phase 1

### Blocker 3: Backend Auth Response Shape Mismatch
**Backend returns**: `{ success: true, data: { user, tokens: { access_token, refresh_token, expires_in } } }`
**Therapist expects**: `res.access_token` (looks at top-level)
**Fix**: Update all portals to use `res.data.tokens.access_token` pattern

### Blocker 4: Patient Portal Has No API Client
**Fix**: Create `apps/patient/lib/api.ts` with full API client

### Blocker 5: No Token Refresh Logic Anywhere
**Fix**: Create refresh interceptor; on 401, refresh tokens and retry

---

## 3. IMPLEMENTATION PLAN

### Phase 1: Real Authentication (PRIORITY 1 — DO FIRST)

#### 1.1 Fix Admin API Client
- File: `apps/admin/lib/api.ts`
- Fix base URL to `http://localhost:4000/api/v1`
- Add Authorization header injection from store
- Add proper error handling

#### 1.2 Create Shared Auth Utilities
- Create `apps/admin/lib/auth.ts` — token management, refresh logic
- Create `apps/therapist/lib/auth.ts` — token management, refresh logic
- Create `apps/patient/lib/api.ts` — full API client
- Create `apps/patient/lib/auth.ts` — token management

#### 1.3 Fix Admin Login (Replace Demo Bypass)
- File: `apps/admin/app/(auth)/login/page.tsx`
- Remove hardcoded `admin@24therapy.com` / `admin` bypass
- Call real `POST /auth/login` endpoint
- Validate `role in ['super_admin', 'admin']`
- Store tokens in localStorage + Zustand
- Handle MFA challenge (show MFA field on 401 with MFA flag)

#### 1.4 Fix Admin Auth Store
- File: `apps/admin/lib/store.ts`
- Add `accessToken`, `refreshToken`, `expiresAt` fields
- Add `refreshTokens()` action
- Add token persistence to localStorage

#### 1.5 Fix Admin Dashboard Layout
- File: `apps/admin/app/(dashboard)/layout.tsx`
- Add token expiry check on mount
- Add auto-refresh on 401 errors

#### 1.6 Fix Therapist Login
- File: `apps/therapist/app/(auth)/login/page.tsx`
- Fix response mapping: `res.data.tokens.access_token`
- Store both tokens properly

#### 1.7 Fix Patient Login (Replace Fake Timeout)
- File: `apps/patient/app/(auth)/login/page.tsx`
- Replace `setTimeout` with real API call
- Create patient API client
- Add role validation (`role === 'patient'`)

#### 1.8 Add Auth Guard to Patient Dashboard
- File: `apps/patient/app/(dashboard)/layout.tsx`
- Add `isAuthenticated` check (currently missing)
- Add redirect to `/login` if not authenticated

#### 1.9 Create Token Refresh Interceptor
- All portals: check token expiry before requests
- On 401, attempt refresh and retry
- On refresh failure, clear auth and redirect to login

#### 1.10 Session Timeout
- 30 min idle timeout
- 4 hour absolute timeout
- Warning modal at 5 min before expiry

---

### Phase 2: Replace Mock Data with Real APIs

#### 2.1 Admin Portal
**dashboard/page.tsx** — Replace `PLATFORM_STATS` with `GET /analytics/overview`
**organizations/page.tsx** — Replace mock orgs with `GET /organizations`
**users/page.tsx** — Replace mock users with `GET /users`
**therapists/page.tsx** — Replace mock therapists with `GET /therapists`
**practice-management/page.tsx** — Replace mock data
**billing/page.tsx** — Replace mock with `GET /billing/invoices` + `GET /billing/subscription`
**crm/page.tsx** — Replace mock with `GET /patients` (CRM view)

#### 2.2 Therapist Portal (Priority order)
**dashboard/page.tsx** — `GET /sessions/dashboard`, `GET /patients?limit=5`
**patients/page.tsx** — `GET /patients` with search/filter/pagination
**patients/[id]/page.tsx** — `GET /patients/:id`, memories, assessments, goals
**sessions/page.tsx** — `GET /sessions` with filters
**sessions/[id]/room/page.tsx** — Real Daily.co video + AI copilot + live transcript
**notes/page.tsx** — `GET /sessions?has_notes=true`
**ai-workspace/page.tsx** — Real `POST /ai/chat` calls
**assessments/page.tsx** — `GET /assessments/templates`, `GET /assessments/results/:patientId`
**billing/page.tsx** — `GET /billing/invoices`, `GET /billing/subscription`
**messages/page.tsx** — WebSocket messaging
**notifications/page.tsx** — `GET /notifications`
**radar/page.tsx** — `GET /radar` (risk alerts)
**referrals/page.tsx** — `GET /referrals`
**reports/page.tsx** — `GET /analytics/overview`
**risk-monitor/page.tsx** — `GET /radar/alerts`
**treatment-plans/page.tsx** — `GET /treatment-plans`

#### 2.3 Patient Portal
**home/page.tsx** — `GET /sessions/dashboard`, `GET /patients/me`
**sessions/page.tsx** — `GET /sessions?patient_id=me`
**billing/page.tsx** — `GET /billing/invoices`, `GET /billing/subscription`
**ai-companion/page.tsx** — `POST /ai/chat` (patient context)
**notifications/page.tsx** — `GET /notifications`

---

### Phase 3: AI Systems Connection

#### 3.1 AI Workspace (Therapist)
- Connect `POST /ai/chat` with session context
- Inject patient history from memory service
- Show real GPT-4o responses

#### 3.2 AI Copilot (Session Room)
- Connect `GET /ai/sessions/:id/copilot` for suggestions
- Real-time suggestion updates during session

#### 3.3 AI Notes Generation
- Connect `POST /ai/sessions/:id/notes/generate`
- SOAP, DAP, BIRP note types
- Note approval workflow

#### 3.4 Patient AI Companion
- Connect `POST /ai/chat` with patient role + patient context
- Session history injection

#### 3.5 Memory System
- Connect `POST /ai/patients/:id/memory/search`
- Memory timeline display
- Knowledge graph with real pgvector data

---

### Phase 4: Live Transcription

#### 4.1 Whisper Integration
- Backend already has AI service
- Create `POST /ai/sessions/:id/transcribe` endpoint
- Frontend: capture audio chunks, send to backend
- Real-time transcript stream via WebSocket

#### 4.2 Transcript Persistence
- Save transcript segments to DB during session
- `GET /sessions/:id/transcript` for retrieval
- Export as PDF/text
- Search within transcripts

---

### Phase 5: Real-time Communication

#### 5.1 WebSocket Setup
- Backend: `events.gateway.ts` already exists
- Frontend: Connect Socket.io client to all portals

#### 5.2 Therapist-Patient Messaging
- Real message sending/receiving
- Therapist messages page: real Socket.io
- Patient messages page: real Socket.io

#### 5.3 Marketing Site Chat
- Guest mode anonymous sessions
- AI-powered responses via `/ai/chat`
- Lead capture form
- Chat-to-signup conversion flow

---

### Phase 6: Therapy Platform Operations

#### 6.1 Appointments
- `POST /sessions` — create appointment
- `PATCH /sessions/:id/status` — cancel/reschedule
- Calendar integration

#### 6.2 Assessments
- PHQ-9 scoring engine (score 0-27, severity buckets)
- GAD-7 scoring engine (score 0-21)
- Send assessment to patient
- View results with trend chart

#### 6.3 Treatment Plans
- Full CRUD via treatment plans API
- Goals with progress tracking
- Milestone system

#### 6.4 Radar Matching
- Connect radar module
- Therapist-patient match algorithm
- Acceptance/rejection workflow

#### 6.5 Notifications
- Email: via backend notification service
- SMS: via Twilio (backend ready)
- In-app: WebSocket events

---

### Phase 7: Admin Operations (Make All Actions Real)

All admin actions currently update local Zustand state only:
- Organization approve/suspend → `PATCH /organizations/:id`
- User suspend/activate → `PATCH /users/:id/status`
- Therapist approve/reject → `PATCH /therapists/:id/verification`
- Feature flag toggle → `PATCH /feature-flags/:id`
- Plan management → Already done ✅ (Session 5)

---

### Phase 8: Production Hardening

#### 8.1 Security
- RBAC: Enforce `role` from JWT on frontend routes
- Rate limiting: Already in backend (helmet + throttler)
- Session timeout: 30min idle / 4hr absolute
- MFA foundation: TOTP setup flow

#### 8.2 HIPAA
- PHI encryption service: AES-256-GCM for sensitive fields
- Audit logging: every PHI access logged
- Secure storage: no PHI in localStorage

#### 8.3 Monitoring
- Health check endpoints: `GET /health`
- Error reporting: Sentry integration
- Structured logging: already in NestJS

#### 8.4 Dockerfiles
- `apps/web/Dockerfile` — Next.js standalone build
- `apps/therapist/Dockerfile`
- `apps/patient/Dockerfile`
- `apps/admin/Dockerfile`
- `backend/Dockerfile` — NestJS build

---

### Phase 9: Missing Pages

Create with matching design system:
- `/signup` — Registration flow (therapist + patient paths)
- `/demo` — Demo booking (Calendly embed)
- `/press` — Press kit, media coverage
- `/status` — System status (operational/degraded/outage)
- `/gdpr` — GDPR compliance center, data rights, DPA
- `/changelog` — Product changelog (versioned releases)

---

### Phase 10: Documentation

Update all audit documents to reflect completed state.
Create `PRODUCTION_READINESS_REPORT.md` with:
- Completed feature list
- Remaining blockers
- Environment requirements
- Deployment checklist
- Architecture summary

---

## 4. ESTIMATED COMPLETION ORDER

| Phase | Estimated Time | Files Changed |
|-------|---------------|---------------|
| Phase 1: Auth | ~2-3 hours | 12 files |
| Phase 2: Mock → API | ~4-6 hours | 30+ files |
| Phase 3: AI Systems | ~2-3 hours | 10 files |
| Phase 4: Transcription | ~1-2 hours | 5 files |
| Phase 5: WebSocket | ~2-3 hours | 8 files |
| Phase 6: Platform Ops | ~2-3 hours | 10 files |
| Phase 7: Admin Ops | ~1-2 hours | 8 files |
| Phase 8: Hardening | ~2-3 hours | 15 files |
| Phase 9: Pages | ~1-2 hours | 6 new files |
| Phase 10: Docs | ~1 hour | 5 files |

**Total Estimated**: 18-27 hours of implementation

---

## 5. COMMIT STRATEGY

- Commit after EACH portal auth fix (3 commits for Phase 1)
- Commit after EACH portal's mock data replacement (3 commits for Phase 2)
- Commit after EACH AI system connected (Phase 3)
- Commit after Phase 4, 5, 6, 7, 8 each complete
- Commit after Phase 9 all pages done (1 commit)
- Final commit: docs + reports

Maximum uncommitted time: 30 minutes.

---

## 6. KEY FILES TO MODIFY (Phase 1 — Immediate)

### Admin Portal
| File | Change |
|------|--------|
| `apps/admin/lib/api.ts` | Fix base URL, add auth header injection, add refresh logic |
| `apps/admin/lib/store.ts` | Add token fields, refreshTokens action |
| `apps/admin/app/(auth)/login/page.tsx` | Remove demo bypass, real API call |
| `apps/admin/app/(dashboard)/layout.tsx` | Add token expiry check |

### Therapist Portal
| File | Change |
|------|--------|
| `apps/therapist/app/(auth)/login/page.tsx` | Fix response mapping `res.data.tokens.access_token` |
| `apps/therapist/lib/api.ts` | Add token refresh interceptor |
| `apps/therapist/lib/store.ts` | Already has `refreshToken` field — just fix usage |

### Patient Portal
| File | Change |
|------|--------|
| `apps/patient/app/(auth)/login/page.tsx` | Replace `setTimeout` with real API |
| `apps/patient/app/(dashboard)/layout.tsx` | Add auth guard |
| `apps/patient/lib/api.ts` | CREATE — full API client |
| `apps/patient/lib/store.ts` | Add refreshToken field |

---

## 7. CRITICAL CONSTRAINTS

1. **No breaking the pricing system** — `apps/*/lib/pricing-api.ts` must remain untouched
2. **No hardcoded credentials** in any production code — demo bypass must be env-gated or removed
3. **Graceful fallback** — when backend is down, show clear error (not fake data)
4. **HIPAA compliance** — no PHI in localStorage; use httpOnly cookies for tokens where possible
5. **Build must pass** — every commit must produce a buildable codebase

---

## 8. SESSION 6 PROGRESS TRACKING

See `SESSION_6_PROGRESS.md` for live milestone updates.
