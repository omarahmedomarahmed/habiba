# FEATURE_MATRIX.md — 24Therapy.ai
> Generated: 2026-06-06 | Session 5
> Status codes: COMPLETE | PARTIAL | MOCK | BROKEN | MISSING

---

## Legend
| Status | Meaning |
|--------|---------|
| ✅ COMPLETE | Fully implemented, connected, functional |
| ⚠️ PARTIAL | Exists but incomplete, has gaps |
| 🎭 MOCK | UI exists but uses hardcoded/fake data |
| 🔴 BROKEN | Code exists but throws errors or doesn't work |
| ❌ MISSING | Not implemented at all |

---

## AUTHENTICATION & ACCESS

| Feature | Status | Notes |
|---------|--------|-------|
| Therapist Login | 🎭 MOCK | UI exists, Zustand only, no real JWT |
| Patient Login | 🎭 MOCK | UI exists, Zustand only, no real JWT |
| Admin Login | 🎭 MOCK | UI exists, useAdminAuth Zustand, no real JWT |
| Registration/Signup | ❌ MISSING | No signup pages in any portal |
| Password Reset | ❌ MISSING | No forgot password flow |
| Email Verification | ❌ MISSING | Backend has verifyEmail but no UI |
| MFA/2FA | ❌ MISSING | Settings UI exists, not implemented |
| Session Timeout | ❌ MISSING | Zustand persist = no expiry |
| Token Refresh | ❌ MISSING | Backend has refresh endpoint, not used |
| Backend Auth API | ✅ COMPLETE | NestJS auth module fully implemented |
| JWT Strategy | ✅ COMPLETE | backend/src/modules/auth/ |
| Roles Guard | ⚠️ PARTIAL | Exists but not applied to all routes |

---

## ORGANIZATIONS

| Feature | Status | Notes |
|---------|--------|-------|
| Org List (Admin) | 🎭 MOCK | UI exists, hardcoded orgs |
| Org Create | 🎭 MOCK | Modal exists, no API call |
| Org Edit | 🎭 MOCK | Form exists, no API call |
| Org Delete | 🎭 MOCK | Button exists, no API call |
| Org Settings | 🎭 MOCK | Backend service complete |
| Org Subscriptions | ⚠️ PARTIAL | Backend complete, UI disconnected |
| Backend Orgs API | ✅ COMPLETE | Full CRUD in backend |

---

## THERAPIST PROFILES

| Feature | Status | Notes |
|---------|--------|-------|
| Therapist List | 🎭 MOCK | Admin portal hardcoded |
| Therapist Profile Page | 🎭 MOCK | `/therapists/[id]` mock data |
| Therapist Onboarding | ⚠️ PARTIAL | Multi-step UI exists, not connected |
| Profile Settings | ⚠️ PARTIAL | 6-tab settings UI, saves to Zustand only |
| License Verification | ❌ MISSING | Not implemented |
| Background Check | ❌ MISSING | Not implemented |
| Backend Therapists API | ✅ COMPLETE | Full CRUD in backend |

---

## PATIENT PROFILES

| Feature | Status | Notes |
|---------|--------|-------|
| Patient List (Therapist) | 🎭 MOCK | Hardcoded patient array |
| Patient Profile (Therapist) | 🎭 MOCK | Detailed mock patient data |
| Patient Intake Form | ⚠️ PARTIAL | UI exists, not saving to backend |
| Patient Self-Profile | ⚠️ PARTIAL | UI exists, Zustand state only |
| Clinical History | 🎭 MOCK | Hardcoded in patient detail view |
| Backend Patients API | ✅ COMPLETE | Full CRUD in backend |

---

## SESSIONS

| Feature | Status | Notes |
|---------|--------|-------|
| Session List | 🎭 MOCK | Hardcoded session arrays |
| Session Scheduling | 🎭 MOCK | New session modal, no API |
| Session Calendar | ⚠️ PARTIAL | Calendar UI complete, no real events |
| Session Preparation | 🎭 MOCK | Prep notes, no real data |
| Session Room (Video) | ⚠️ PARTIAL | Daily.co UI structure, not configured |
| Session Recording | ❌ MISSING | Not implemented |
| Session History | 🎭 MOCK | Hardcoded list |
| Backend Sessions API | ✅ COMPLETE | Full CRUD in backend |

---

## BOOKING & SCHEDULING

| Feature | Status | Notes |
|---------|--------|-------|
| Appointment Booking | ⚠️ PARTIAL | Patient portal UI exists, no backend |
| Therapist Availability | 🎭 MOCK | Calendar shows mock slots |
| Appointment Reminders | 🎭 MOCK | Notification UI, no real delivery |
| Cancellation Flow | ❌ MISSING | Not implemented |
| Rescheduling | ❌ MISSING | Not implemented |
| Waiting List | ❌ MISSING | Not implemented |

---

## TELETHERAPY / VIDEO

| Feature | Status | Notes |
|---------|--------|-------|
| Video Room UI | ⚠️ PARTIAL | Room page exists at `/sessions/[id]/room` |
| Daily.co Integration | 🔴 BROKEN | Config exists, not connected |
| Audio/Video Controls | ⚠️ PARTIAL | UI buttons, no WebRTC |
| Screen Sharing | ❌ MISSING | Not implemented |
| Recording | ❌ MISSING | Not implemented |
| Zoom Integration | ❌ MISSING | Future roadmap |
| Teams Integration | ❌ MISSING | Future roadmap |

---

## AI COPILOT

| Feature | Status | Notes |
|---------|--------|-------|
| AI Workspace UI | 🎭 MOCK | Full UI, mock AI responses |
| Real-time Suggestions | 🎭 MOCK | Hardcoded suggestion arrays |
| Session Context | ❌ MISSING | No real context injection |
| Patient Context | ❌ MISSING | No memory retrieval in UI |
| Risk Recommendations | 🎭 MOCK | Static risk alerts |
| Backend AI Service | ✅ COMPLETE | GPT-4o, model-gateway, context-builder |
| Model Router | ✅ COMPLETE | backend/src/modules/ai/model-gateway.service.ts |

---

## AI NOTES / SCRIBE

| Feature | Status | Notes |
|---------|--------|-------|
| Note List | 🎭 MOCK | `/notes` page with mock notes |
| Note Detail/Editor | 🎭 MOCK | `/notes/[id]` with mock content |
| AI Note Generation | 🎭 MOCK | Generate button, no real AI call |
| SOAP Format | 🎭 MOCK | Format selector exists |
| DAP Format | 🎭 MOCK | Format selector exists |
| BIRP Format | 🎭 MOCK | Format selector exists |
| Note Templates | 🎭 MOCK | Template selector, no real templates |
| Backend Notes API | ✅ COMPLETE | Part of sessions module |

---

## LIVE TRANSCRIPTION

| Feature | Status | Notes |
|---------|--------|-------|
| Session Transcription UI | ⚠️ PARTIAL | UI in session room page |
| Real-time Transcript Stream | ❌ MISSING | No WebSocket transcript stream |
| Whisper Integration | ❌ MISSING | Backend AI service has it, not connected |
| Transcript Persistence | ❌ MISSING | No transcript storage endpoint |
| Transcript Search | ❌ MISSING | Not implemented |
| Transcript Export | ❌ MISSING | Not implemented |

---

## ASSESSMENTS

| Feature | Status | Notes |
|---------|--------|-------|
| Assessment Library | 🎭 MOCK | Mock tool list in therapist portal |
| PHQ-9 | 🎭 MOCK | Listed, not functional form |
| GAD-7 | 🎭 MOCK | Listed, not functional form |
| Custom Assessments | ❌ MISSING | Not implemented |
| Assessment Results | 🎭 MOCK | Mock result data |
| Scoring Engine | ❌ MISSING | Backend has schema, no service |
| Backend Assessments API | ✅ COMPLETE | Full module in backend |

---

## TREATMENT PLANS

| Feature | Status | Notes |
|---------|--------|-------|
| Treatment Plan List | 🎭 MOCK | Mock plan array |
| Plan Builder | 🎭 MOCK | UI exists, no backend save |
| Goal Tracking | 🎭 MOCK | Mock progress data |
| Intervention Library | ❌ MISSING | Not implemented |
| Plan Sharing | ❌ MISSING | Not implemented |

---

## MESSAGING

| Feature | Status | Notes |
|---------|--------|-------|
| Message List | 🎭 MOCK | Conversation list, mock |
| Message Thread | 🎭 MOCK | Mock message history |
| Real-time Messaging | ❌ MISSING | WebSocket gateway exists, not connected |
| File Attachments | ❌ MISSING | Not implemented |
| Backend WebSocket | ⚠️ PARTIAL | events.gateway.ts exists |

---

## NOTIFICATIONS

| Feature | Status | Notes |
|---------|--------|-------|
| Notification List | 🎭 MOCK | Mock notification arrays |
| Email Notifications | ❌ MISSING | Backend has module, not configured |
| SMS Notifications | ❌ MISSING | Not implemented |
| Push Notifications | ❌ MISSING | Not implemented |
| In-app Notifications | 🎭 MOCK | UI bell icon, static count |
| Backend Notifications API | ✅ COMPLETE | Full module in backend |

---

## BILLING & PAYMENTS

| Feature | Status | Notes |
|---------|--------|-------|
| Pricing Page (Web) | 🎭 MOCK | Hardcoded prices — 3 sources conflict |
| Plan Selection | 🎭 MOCK | Links to /signup, no real Stripe |
| Stripe Checkout | ⚠️ PARTIAL | Backend service complete, frontend disconnected |
| Subscription Management | 🎭 MOCK | Admin billing page, hardcoded |
| Invoice List | 🎭 MOCK | Mock invoice arrays in all portals |
| Payment History | 🎭 MOCK | Hardcoded transactions |
| Stripe Webhooks | ✅ COMPLETE | Backend handles Stripe events |
| Admin Pricing CRUD | ❌ MISSING | No management interface |
| Plan Management API | ⚠️ PARTIAL | getPlans() exists, no CRUD |
| Therapist Payouts | ⚠️ PARTIAL | Backend has getPayouts(), UI missing |
| Insurance Billing | 🎭 MOCK | Mock insurance amounts |

---

## ANALYTICS

| Feature | Status | Notes |
|---------|--------|-------|
| Admin Analytics | ⚠️ PARTIAL | 5-tab UI, mock chart data |
| Therapist Analytics | ⚠️ PARTIAL | UI exists, mock data |
| Practice Analytics | 🎭 MOCK | Mock stats |
| Revenue Analytics | 🎭 MOCK | Admin billing page, mock MRR |
| Patient Outcomes | 🎭 MOCK | Mock progress data |
| Backend Analytics API | ✅ COMPLETE | Full module in backend |

---

## RADAR MATCHING

| Feature | Status | Notes |
|---------|--------|-------|
| Radar Queue (Therapist) | 🎭 MOCK | Mock patient requests |
| Patient Matching | 🎭 MOCK | Mock match score data |
| Accept/Decline Flow | 🎭 MOCK | Buttons exist, no API call |
| Matching Algorithm | ⚠️ PARTIAL | Backend radar.service.ts exists |
| Backend Radar API | ⚠️ PARTIAL | Controller + service, no DTOs |

---

## MARKETPLACE

| Feature | Status | Notes |
|---------|--------|-------|
| App Marketplace | ⚠️ PARTIAL | Admin UI, static listing |
| App Installation | 🎭 MOCK | Install button, no real flow |
| Integration Config | ❌ MISSING | Not implemented |
| Backend Marketplace API | ⚠️ PARTIAL | Controller + service, no DTOs |

---

## AI SYSTEMS (Advanced)

| Feature | Status | Notes |
|---------|--------|-------|
| AI Gateway | ✅ COMPLETE | backend/src/modules/ai/model-gateway.service.ts |
| Model Router | ✅ COMPLETE | GPT-4o, Claude routing logic |
| Context Builder | ✅ COMPLETE | backend/src/modules/ai/context-builder.service.ts |
| Memory Layer | ⚠️ PARTIAL | Backend complete, frontend disconnected |
| Knowledge Graph | 🎭 MOCK | Memory graph page UI, no real data |
| Longitudinal Intelligence | ❌ MISSING | Schema exists, service not implemented |
| Risk Detection | 🎭 MOCK | Risk monitor UI, mock alerts |
| Workflow Engine | ⚠️ PARTIAL | Backend module complete, frontend UI only |
| Automation Engine | ❌ MISSING | Not implemented |
| Memory Graph UI | 🎭 MOCK | Visual graph with mock nodes |

---

## ADMIN PORTAL (Specific)

| Feature | Status | Notes |
|---------|--------|-------|
| Admin Dashboard | 🎭 MOCK | Platform stats, all hardcoded |
| Organization Mgmt | 🎭 MOCK | CRUD UI, no API calls |
| User Management | 🎭 MOCK | Table with mock users |
| Therapist Verification | 🎭 MOCK | Approve/reject buttons, no API |
| Compliance Dashboard | ⚠️ PARTIAL | UI complete, mock audit data |
| AI Governance | ⚠️ PARTIAL | UI complete, mock model data |
| Billing Management | 🎭 MOCK | Mock revenue, hardcoded plans |
| **Pricing Management** | ❌ MISSING | No CRUD for subscription plans |
| Feature Flags | ⚠️ PARTIAL | Toggle UI, saves to state only |
| AI Costs Monitor | 🎭 MOCK | Mock cost data |
| Audit Logs | 🎭 MOCK | Mock log entries |
| Support Tools | ⚠️ PARTIAL | UI complete, some actions mock |
| CRM & Sales | 🎭 MOCK | Mock pipeline data |
| Analytics (5-tab) | 🎭 MOCK | Charts with mock data |

---

## KNOWLEDGE GRAPH

| Feature | Status | Notes |
|---------|--------|-------|
| Graph Visualization | 🎭 MOCK | Visual node graph, hardcoded |
| Entity Extraction | ❌ MISSING | Not implemented in service |
| Relationship Mapping | ❌ MISSING | Backend memory.service.ts partial |
| Timeline View | 🎭 MOCK | Mock clinical timeline |
| Semantic Search | ❌ MISSING | pgvector ready, endpoint missing |

---

## MEMORY ENGINE

| Feature | Status | Notes |
|---------|--------|-------|
| Memory Storage | ⚠️ PARTIAL | Backend memory module complete |
| Memory Retrieval | ⚠️ PARTIAL | API endpoint exists |
| Embedding Generation | ⚠️ PARTIAL | text-embedding-3-large configured |
| Memory UI | 🎭 MOCK | Memory list page, mock entries |
| Auto Memory Update | ❌ MISSING | Not triggered from session events |

---

## MARKETING WEBSITE AI CHAT

| Feature | Status | Notes |
|---------|--------|-------|
| Public AI Chat Widget | ❌ MISSING | Not implemented |
| Anonymous Chat | ❌ MISSING | Not implemented |
| Chat History | ❌ MISSING | Not implemented |
| Account Migration | ❌ MISSING | Not implemented |
| Chat → Signup Flow | ❌ MISSING | Not implemented |

---

## SUMMARY COUNTS

| Status | Count |
|--------|-------|
| ✅ COMPLETE | 18 |
| ⚠️ PARTIAL | 24 |
| 🎭 MOCK | 52 |
| 🔴 BROKEN | 1 |
| ❌ MISSING | 22 |
| **TOTAL** | **117** |

### Priority for Production
1. Pricing standardization (this session)
2. Auth connection to backend
3. Replace mock data with API calls
4. AI features (core product value)
5. Real-time features (transcription, messaging, video)
