# README.md — 24Therapy.ai Platform Intelligence

Complete platform understanding and actionable execution plan for building the 24Therapy.ai AI-native Mental Health Operating System.

**IMPORTANT FOR BUILDING AI:** Read this file FIRST, then read the numbered part files in sequence. The SQL migration files are ready to run. Build the platform in the exact order described in Section 16.

---

## 1. What This Platform Is

**24Therapy.ai** is an AI-native Mental Health Operating System.

It is NOT:
- A simple telehealth app
- An AI note-taking tool
- A meditation app

It IS:
- The operating system for modern mental healthcare
- Infrastructure layer for behavioral health
- A two-sided marketplace with AI at the core
- A clinical intelligence platform that compounds in value over time

**The Long Game:** The company starts as an AI Scribe, grows into a Therapist Copilot, becomes a Mental Health OS, and ultimately evolves into a **Behavioral Health Intelligence Platform** — possibly the infrastructure standard for global mental healthcare.

**The Moat Is NOT the AI.** The moat is:
1. Longitudinal patient memory (pgvector embeddings × years of sessions)
2. Knowledge graph (causal patient understanding)
3. Workflow intelligence (therapist preference learning)
4. Network effects (marketplace liquidity)
5. Outcome data (treatment effectiveness at scale)

---

## 2. The 12 Core Systems

| # | System | Description |
|---|--------|-------------|
| 1 | Public Website | Marketing + conversion + AI chat |
| 2 | Patient Platform | AI companion, booking, session history, progress |
| 3 | Therapist Platform | Dashboard, scribe, copilot, patient management |
| 4 | AI Scribe Engine | Realtime transcription + clinical note generation |
| 5 | Clinical Copilot | Live AI suggestions during sessions |
| 6 | Knowledge Engine | Clinical knowledge base + RAG |
| 7 | Radar Network | Instant therapist matching |
| 8 | Telehealth Infrastructure | WebRTC video/audio sessions |
| 9 | Practice Management | Multi-therapist, billing, scheduling |
| 10 | Admin Platform | CRM, compliance, analytics, operations |
| 11 | Developer Platform | Public API, SDKs, webhooks, marketplace |
| 12 | Data Intelligence Layer | Analytics, outcomes, AI training signals |

---

## 3. Technology Stack (Build This Exactly)

### Frontend Applications

| App | Tech |
|-----|------|
| Public Website | Next.js 14 + TypeScript + Tailwind + ShadCN |
| Patient Portal | Next.js 14 + TypeScript + Tailwind + ShadCN |
| Therapist Portal | Next.js 14 + TypeScript + Tailwind + ShadCN |
| Admin Portal | Next.js 14 + TypeScript + Tailwind + ShadCN |
| Developer Portal | Next.js 14 + TypeScript + Tailwind |
| Mobile (Patient) | React Native + Expo |
| Mobile (Therapist) | React Native + Expo |

### Backend Services (18 Microservices)

| Service | Responsibility |
|---------|----------------|
| api-gateway | Rate limiting, auth, routing |
| auth-service | JWT, OAuth, SSO, MFA |
| user-service | Users, orgs, roles, permissions |
| patient-service | Patient CRUD, profiles, files |
| therapist-service | Therapist profiles, credentials |
| session-service | Session lifecycle management |
| transcript-service | Audio processing, ASR pipeline |
| ai-scribe-service | Note generation, summaries |
| memory-service | Patient memory extraction + retrieval |
| copilot-service | Realtime suggestions during sessions |
| assessment-service | Assessments, scoring, trends |
| report-service | Report generation + export |
| radar-service | Instant matching algorithm |
| billing-service | Subscriptions, payments, payouts |
| notification-service | Email, SMS, in-app, push |
| marketplace-service | Directory, search, reviews |
| analytics-service | Events, metrics, dashboards |
| audit-service | Immutable audit logs, compliance |

**NOTE:** Start with a **Modular Monolith**. Extract into microservices when team and scale demand it (>10 engineers or >10K sessions/day per service).

### Core Technology Choices

| Layer | Technology | Why |
|-------|------------|-----|
| Primary DB | PostgreSQL | Relational, HIPAA-friendly, pgvector |
| Cache | Redis | Session management, caching, queues |
| Vector DB | pgvector (→ Qdrant/Pinecone at scale) | Memory + semantic search |
| Event Bus | Redis Streams → Kafka at scale | Event-driven microservices |
| Storage | AWS S3 + Cloudflare R2 | Recordings, files, reports |
| Video | WebRTC (Daily.co or LiveKit) | Teletherapy sessions |
| AI Models | Model Gateway → OpenAI/Anthropic/Custom | Abstracted, switchable |
| Container | Kubernetes (EKS) | Scale 100 → 100K sessions |
| CDN | Cloudflare | Edge, DDoS, WAF |
| CI/CD | GitHub Actions | Automated deploy pipeline |
| IaC | Terraform | Reproducible infrastructure |
| Monitoring | Prometheus + Grafana + Sentry | Full observability |
| Product Analytics | PostHog | Activation, retention, funnels |

---

## 4. Database Architecture (Complete)

### 14 SQL Migration Files (Run in Order)

```bash
psql -d your_db -f 001_core_schema.sql
psql -d your_db -f 002_therapists_schema.sql
psql -d your_db -f 003_patients_schema.sql
psql -d your_db -f 004_clinical_schema.sql
psql -d your_db -f 005_medications_schema.sql
psql -d your_db -f 006_sessions_schema.sql
psql -d your_db -f 007_ai_schema.sql
psql -d your_db -f 008_assessments_schema.sql
psql -d your_db -f 009_radar_schema.sql
psql -d your_db -f 010_billing_schema.sql
psql -d your_db -f 011_notifications_schema.sql
psql -d your_db -f 012_audit_compliance_schema.sql
psql -d your_db -f 013_marketplace_schema.sql
psql -d your_db -f 014_analytics_schema.sql
```

### Required PostgreSQL Extensions (Run First)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### 17 Schema Groups

```
auth · organizations · users · patients · therapists
sessions · transcripts · reports · assessments · medications
billing · marketplace · notifications · audit · ai · analytics · integrations
```

### Critical Tables (Priority Order)

1. `organizations` — Multi-tenant root (001)
2. `users` + `user_roles` — All users across roles (001)
3. `therapists` — Clinical profiles (002)
4. `patients` — Most important entity (003)
5. `sessions` — Session lifecycle (006)
6. `transcripts` + `transcript_segments` — Raw clinical data (006)
7. `ai_session_notes` — SOAP/DAP/BIRP outputs (007)
8. `patient_memories` — The moat (with pgvector embeddings) (007)
9. `session_intelligence` — Structured themes/signals (007)
10. `assessment_results` — PHQ-9, GAD-7, etc. (008)
11. `risk_assessments` — Safety monitoring (004)
12. `audit_logs` — Immutable, append-only (012)
13. `marketplace_listings` — Public therapist profiles (013)
14. `subscriptions` — Billing state (010)
15. `radar_requests` + `radar_matches` — Instant matching (009)

### SQL Migration Files — What Each Contains

| File | Key Tables |
|------|-----------|
| 001_core_schema.sql | organizations, organization_settings, extensions, UUID setup |
| 002_therapists_schema.sql | therapists, credentials, specializations, availability |
| 003_patients_schema.sql | patients, demographics, consents, contacts, files, imports |
| 004_clinical_schema.sql | diagnoses, symptoms, goals, life events, relationships, risk_assessments |
| 005_medications_schema.sql | medications, patient_medications, medication_history, allergies |
| 006_sessions_schema.sql | sessions, participants, notes, recordings, transcripts, segments |
| 007_ai_schema.sql | ai_session_notes, ai_summaries, ai_intelligence, patient_memories (with VECTOR), memory_links, patient_timeline, prompt_registry, ai_usage_logs |
| 008_assessments_schema.sql | assessment_templates (PHQ-9/GAD-7/PCL-5 seeded), assessment_questions, assessment_results, assessment_answers, assessment_trends, assessment_schedules |
| 009_radar_schema.sql | radar_requests, radar_broadcasts, radar_matches, radar_sessions, radar_therapist_settings, radar_analytics, match scoring function |
| 010_billing_schema.sql | subscription_plans (seeded), subscriptions, invoices, payments, session_fees, payouts, usage_records, coupons |
| 011_notifications_schema.sql | notification_templates (seeded), notifications, notification_preferences, email_delivery_log, push_devices, notification_queue, conversations, messages |
| 012_audit_compliance_schema.sql | audit_logs (append-only + RLS), consent_versions (seeded), patient_consents, data_subject_requests (GDPR), security_incidents, data_retention_policies, phi_access_log, baa_records (seeded), compliance_checklist (seeded) |
| 013_marketplace_schema.sql | marketplace_listings, marketplace_reviews, review_votes, marketplace_searches, marketplace_bookmarks, marketplace_categories (seeded), marketplace_analytics, search_marketplace() function |
| 014_analytics_schema.sql | analytics_events (partitioned), ai_cost_tracking (partitioned), daily_metrics, platform_daily_metrics, therapist_performance_metrics, patient_outcome_metrics, practice_health_metrics, ai_model_metrics, funnel_events |

---

## 5. AI Architecture (Build This Carefully)

### The Right Architecture (NOT the shortcut)

**Wrong:**
```
App → OpenAI → Output
```

**Right:**
```
Request → Intent Detection → Memory Retrieval (RAG) → Context Construction → Agent → Quality Check → Output
```

### 10 AI Agents

| Agent | Purpose | Tier |
|-------|---------|------|
| 1. Session Scribe | Transcription, speaker labeling, realtime | MVP |
| 2. Session Intelligence | Topic extraction, session understanding | MVP |
| 3. Clinical Documentation | SOAP/DAP/BIRP note generation | MVP |
| 4. Clinical Memory | Extract, update, relate, consolidate memories | Phase 2 |
| 5. Patient Timeline | Chronological life event tracking | Phase 2 |
| 6. Assessment Agent | Score, trend, visualize assessments | Phase 2 |
| 7. Risk Awareness | Safety language detection, flag for review | MVP |
| 8. Therapist Copilot | Live session suggestions | Phase 2 |
| 9. Treatment Planning | Goals, milestones, progress suggestions | Phase 2 |
| 10. Radar Matching | Patient-therapist instant matching | Phase 3 |

### Model Gateway (Critical — Build Before Any AI Features)

Never build directly against one model provider. Build a Model Gateway that:
- Routes to right model per task type
- Provides fallbacks (OpenAI down → Anthropic)
- Tracks costs per request (stored in ai_cost_tracking)
- Supports A/B testing of models
- Allows instant model swapping

### Prompt Registry (Store in DB, NEVER in Code)

All prompts versioned in `prompt_registry` table:
- `SOAP_NOTE_V12`
- `SESSION_SUMMARY_V5`
- `MEMORY_EXTRACTION_V8`
- `RISK_DETECTION_V3`

Every change tracked. Rollback possible. A/B test against each other.

### Context Construction Engine (Most Critical System)

Before ANY generation, construct full context:
```json
{
  "patient_summary": "38-year-old female, depression + anxiety, 18 months treatment",
  "recent_sessions": "[last 3 session summaries]",
  "current_goals": "[active treatment goals and progress %]",
  "assessments": "PHQ-9: 14 (moderate), GAD-7: 12 (moderate)",
  "medications": "Sertraline 50mg since Jan 2024",
  "risk_flags": "No current risk flags",
  "therapist_preferences": "Prefers SOAP format, CBT framework",
  "relevant_memories": "[top 10 memories via pgvector semantic search]"
}
```

**Poor context = poor output. This is where most AI failures happen.**

### Vector Memory (The Moat — Build Carefully)

`patient_memories` table uses `pgvector` with 1536-dimension embeddings.

```sql
-- Semantic memory retrieval
SELECT memory_text, confidence_score, category
FROM patient_memories
WHERE patient_id = $1
ORDER BY embedding <=> $2  -- cosine similarity
LIMIT 10;
```

Every memory has:
- `embedding vector(1536)` — semantic search
- `confidence_score` — AI confidence
- `importance_score` — clinical weight
- `status` — therapist review status
- `source_session_id` — traceability

**This is the platform's primary competitive moat. Build it right from day 1.**

---

## 6. User Roles & Permissions

| Role | Access |
|------|--------|
| super_admin | Everything across all organizations |
| admin | Full org access |
| manager | Practice manager |
| therapist | Own patients + sessions |
| assistant | Administrative (no clinical) |
| billing | Finance only |
| support | Read-only support |
| patient | Own portal only |

Implement **RBAC** from day 1. **ABAC** for enterprise.

Every API endpoint must:
1. Validate JWT
2. Confirm organization membership
3. Check role permissions
4. Scope query by `organization_id`

---

## 7. Design System (Exact Values)

### Colors

| Token | Hex | Usage |
|-------|-----|-------|
| Primary (Deep Trust Navy) | `#0A2342` | Primary actions, headers |
| Secondary (Intelligent Blue) | `#1F5EFF` | Links, interactive elements |
| Accent (Success Cyan) | `#24C8DB` | Highlights, AI indicators |
| Success | `#16A34A` | Positive states |
| Warning | `#F59E0B` | Alerts, attention |
| Error | `#DC2626` | Errors, risk indicators |
| Background | `#F8FAFC` | Page background |
| Card | `#FFFFFF` | Card surfaces |
| Text Dark | `#0F172A` | Primary text |
| Text Secondary | `#64748B` | Secondary text |

### Typography
- Font: **Inter** (Google Fonts)
- Scale: 12 · 14 · 16 · 18 · 24 · 36 · 48 · 64

### Spacing
- Base: 8px grid
- Scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128

### Border Radius
- Small: 8px | Medium: 12px | Large: 16px | Premium: 24px

### Icons: **Lucide Icons** (only)

### Component Library: **ShadCN/UI** on top of Tailwind CSS

---

## 8. Session Room Architecture (Most Complex Screen)

### Layout (3-Panel)
```
[Session Header — therapist name, patient name, timer, controls]
┌─────────────────┬──────────────────┬────────────────────────┐
│  LIVE           │  VIDEO           │  AI COPILOT            │
│  TRANSCRIPT     │  WINDOW          │  ─────────────         │
│  ─────────────  │  (WebRTC)        │  Session Summary       │
│  [Therapist]:   │                  │  Suggested Questions   │
│  [Patient]:     │                  │  Memory Mentions       │
│  ...            │                  │  Risk Indicators       │
│                 │                  │  Patient Context       │
├─────────────────┤                  ├────────────────────────┤
│  NOTES PAD      │                  │  QUICK ACTIONS         │
│  (editable)     │                  │  [Bookmark] [Flag]     │
└─────────────────┴──────────────────┴────────────────────────┘
```

### Session Pipeline (Realtime)
```
Browser Microphone
  ↓ Audio chunk (every 3 seconds)
  ↓ Encrypted to Speech Service (Whisper)
  ↓ transcript_segment created
  ↓ Speaker labeled (therapist/patient)
  ↓ Published to WebSocket
  ↓ Live transcript panel updates
  ↓ Copilot Agent processes context
  ↓ Suggestions streamed to copilot panel
  ↓ Memory Agent queues background extraction
```

**Latency goal:** 1–3 seconds speech-to-text display.

---

## 9. Critical Implementation Priorities

### Phase 1 MVP (Build This First — In This Exact Order)

1. **Auth system** — Login, JWT, org scoping, MFA
2. **Patient CRUD** — Create, view, update patients
3. **Session management** — Schedule, start, end sessions
4. **Audio → Transcript** — WebRTC audio + Whisper ASR
5. **AI Note Generation** — Transcript → SOAP note (GPT-4o)
6. **Note Review UI** — View, edit, approve notes
7. **Basic Therapist Dashboard** — KPIs, patient list, upcoming sessions

**MVP Success metrics:** Documentation time saved | Sessions processed | Weekly active therapists | Retention | MRR

**Critical question:** Would therapists be upset if the product disappeared?

### Phase 2 (Add Intelligence)

8. **Therapist Copilot** — Live suggestions during session
9. **Assessment tools** — PHQ-9, GAD-7, ASRS, PCL-5
10. **Patient Memory** — Extract + store memories (pgvector)
11. **Patient Timeline** — Visual history of events
12. **Report generation** — One-click clinical reports

### Phase 3 (Marketplace + Growth)

13. **Therapist marketplace** — Public directory + profiles
14. **Patient booking flow** — Search → book → session
15. **Radar instant matching** — Real-time therapist matching
16. **Practice management** — Multi-therapist accounts
17. **Billing system** — Subscriptions + marketplace fees

### Phase 4 (Enterprise + Infrastructure)

18. **API Platform** — Public API + SDKs + webhooks
19. **White label** — Multi-org branding
20. **Enterprise SSO** — SAML, OIDC
21. **Advanced analytics** — Practice intelligence dashboards
22. **Research platform** — Anonymized aggregate insights

---

## 10. Compliance Requirements (Non-Negotiable)

### HIPAA (All production data)
- PHI encrypted at rest (AES-256)
- PHI encrypted in transit (TLS 1.3)
- Audit logs (immutable, 7-year retention) — `audit_logs` table append-only
- Role-based access controls — RBAC from day 1
- Breach notification procedures — documented in `security_incidents`
- Business Associate Agreements (BAAs) with ALL vendors — tracked in `baa_records`
- PHI access logging — `phi_access_log` table

### GDPR (For EU/UK users)
- Data residency controls (EU region deployment)
- Right to erasure — `data_subject_requests` table
- Right to access — export functionality
- Consent management — `consent_versions` + `patient_consents`
- DPO designation documented

### Medical AI Safety (Non-Negotiable)
- AI **never** independently diagnoses
- All AI outputs marked as "drafts for professional review"
- Therapist approval required before notes are finalized
- Crisis detection triggers human review workflows
- AI must always disclose it is an AI system when patient-facing

### Audit Log Rules
- Every data access logged in `phi_access_log`
- Every change logged in `audit_logs` with old/new values
- Append-only (NO UPDATE/DELETE ever on audit_logs)
- Include: user_id, IP, action, resource, timestamp, organization_id

---

## 11. Key API Patterns

### Standard Response Shape
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    status: number;
  };
  meta: {
    request_id: string;
    timestamp: string;
    version: string;
  };
}
```

### Multi-Tenant Scoping (EVERY Query)
```sql
-- Every query must be scoped by organization_id
WHERE organization_id = $org_id AND deleted_at IS NULL
```

Never allow cross-org data access. Implement as middleware.

### Soft Deletes (Never Hard Delete Clinical Data)
```sql
UPDATE patients SET deleted_at = NOW() WHERE id = $1;
-- NEVER: DELETE FROM patients WHERE id = $1;
```

### Event Publishing (After Every Significant Action)
```typescript
await eventBus.publish('session.completed', {
  sessionId, patientId, therapistId, orgId, timestamp: new Date()
});
```

### Pagination Standard
```typescript
// All list endpoints use cursor-based pagination
GET /api/patients?cursor=uuid&limit=20&direction=next
```

---

## 12. Revenue Model

| Stream | Mechanism | Notes |
|--------|-----------|-------|
| SaaS Free | $0/month — up to 10 sessions | Acquisition channel |
| Professional | ~$99/month per therapist | Primary SaaS revenue |
| Practice | Per-seat pricing ($299+/month) | Team plans |
| Enterprise | $2K–$20K/month custom | Hospital/university |
| Marketplace Commission | 15–25% of session fees | Transaction-based |
| Radar Fee | Platform fee per instant session | Premium transaction |
| API Usage | Token/request-based pricing | Developer platform |
| White Label | Platform licensing per org | Enterprise |

**North Star Metric:** Clinical Hours Processed
**Primary SaaS metric:** MRR / ARR per organization
**Unit economics target:** $99/month at 70–85% gross margin

---

## 13. Geographic Expansion Strategy

| Phase | Market | Timeline | Focus |
|-------|--------|----------|-------|
| 1 | Egypt | Launch (Now) | Arabic-first, therapist acquisition |
| 2 | UAE, Saudi Arabia, Jordan | 6–18 months | GCC expansion |
| 3 | UK, Australia | 18–30 months | English-speaking non-US |
| 4 | Europe | 30–48 months | GDPR-compliant |
| 5 | United States | 36–60 months | HIPAA-mature market |
| 6 | Global | 5+ years | Everywhere |

**Why Egypt first:** Founder network, underserved market, lower CAC, fragmented systems, proof of concept.

---

## 14. The Competitive Moat (6 Layers)

| Layer | Description | Build Priority |
|-------|-------------|---------------|
| 1. Clinical Memory | Longitudinal structured mental health intelligence | Phase 2 |
| 2. Data Flywheel | More sessions → better AI → more therapists | Automatic |
| 3. Network Effects | Marketplace liquidity (therapists need patients need therapists) | Phase 3 |
| 4. Switching Cost | Patient history, memories, treatment plans — can't migrate easily | Grows over time |
| 5. Workflow Lock-In | Therapists build daily habits around the tools | Phase 1+2 |
| 6. Proprietary Data | First platform with structured mental health behavioral data at scale | Long-term |

---

## 15. File Structure (Recommended Monorepo)

```
24therapy/
├── apps/
│   ├── web/                    # Public website (Next.js)
│   ├── patient/                # Patient portal (Next.js)
│   ├── therapist/              # Therapist portal (Next.js)
│   ├── admin/                  # Admin portal (Next.js)
│   └── mobile/                 # React Native
├── services/
│   ├── api-gateway/            # NestJS
│   ├── auth-service/           # NestJS
│   ├── patient-service/        # NestJS
│   ├── session-service/        # NestJS
│   ├── ai-scribe-service/      # NestJS + Python
│   ├── memory-service/         # FastAPI (Python)
│   ├── transcript-service/     # FastAPI (Python)
│   ├── billing-service/        # NestJS
│   ├── notification-service/   # NestJS
│   ├── marketplace-service/    # NestJS
│   ├── radar-service/          # NestJS + Python
│   └── analytics-service/      # NestJS
├── packages/
│   ├── ui/                     # Shared ShadCN components
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Shared utilities
│   └── config/                 # Shared config (ESLint, TSConfig)
├── migrations/                 # SQL migration files (001–014)
├── docs/                       # All PRD part files
│   ├── part-01-executive-summary.md
│   ├── part-02-information-architecture.md
│   ├── part-03-platform-architecture-database.md
│   ├── part-04-ai-architecture-experiences.md
│   ├── part-05-admin-platform-compliance.md
│   ├── part-06-ux-design-system.md
│   ├── part-07-ai-core-intelligence-engine.md        ← NEW
│   ├── part-08-enterprise-engineering-infrastructure.md
│   ├── part-09-brand-marketing-engine.md             ← NEW
│   ├── part-10-user-lifecycle-workflows.md           ← NEW
│   ├── part-11-screen-ui-specification.md
│   ├── part-12-enterprise-database-architecture.md   ← NEW
│   ├── part-13-ai-architecture-agents.md             ← NEW
│   ├── part-14-interoperability-integrations.md
│   ├── part-15-company-building-blueprint.md
│   ├── part-16-clinical-intelligence-layer.md        ← NEW
│   ├── part-17-commercial-strategy-revenue.md
│   ├── part-18-brand-strategy-marketing.md           ← NEW
│   ├── part-19-enterprise-engineering-architecture.md← NEW
│   ├── part-20-ai-architecture-clinical-intelligence.md ← NEW
│   ├── part-21-database-architecture-vol1-vol2.md    ← NEW
│   ├── part-22-vol1-design-system.md
│   ├── part-23-ai-architecture-vol2.md
│   ├── part-25-vol1-database-core.md
│   ├── part-25-vol2-database-sessions-ai.md
│   ├── part-26-vol1-ai-scribe-copilot.md
│   ├── part-26-vol2-patient-ai-crisis-radar.md
│   ├── part-27-vol1-website-marketing.md
│   ├── part-27-vol2-pricing-marketplace-seo.md
│   ├── part-28-therapist-dashboard-ux.md
│   ├── part-29-enterprise-whitelabel.md
│   ├── part-30-api-specification.md
│   ├── part-31-infrastructure-devops.md
│   ├── part-32-gtm-playbooks.md
│   ├── part-33-investor-deck.md
│   ├── part-34-acquisition-readiness.md
│   └── part-35-product-roadmap.md
└── Readme.md                   # This file
```

---

## 16. Immediate Next Steps (Complete Execution Plan)

### Week 1–2: Repository & Infrastructure Setup
- [ ] Initialize monorepo (Turborepo + pnpm workspaces)
- [ ] Set up Next.js apps (web, patient, therapist, admin)
- [ ] Set up NestJS API gateway scaffold
- [ ] Configure PostgreSQL + Redis (Docker Compose local)
- [ ] Run all 14 SQL migrations in order
- [ ] Install pgvector extension and verify vector operations
- [ ] Configure Tailwind + ShadCN component library
- [ ] Set up GitHub Actions CI pipeline
- [ ] Configure environment variables structure (.env.example)

### Week 3–4: Auth + Core Data
- [ ] Implement JWT auth (auth-service)
- [ ] Multi-tenant org scoping middleware (organization_id on every request)
- [ ] User + role management (RBAC)
- [ ] Patient CRUD endpoints
- [ ] Therapist profile endpoints
- [ ] Audit logging middleware (EVERY mutation)

### Month 2: Session + AI Scribe (MVP Core)
- [ ] Session lifecycle (create/start/end state machine)
- [ ] WebRTC integration (Daily.co or LiveKit)
- [ ] Audio chunking to ASR (OpenAI Whisper via Model Gateway)
- [ ] Transcript segment storage (transcript_segments table)
- [ ] Context Construction Engine (retrieve patient context before generation)
- [ ] SOAP note generation (GPT-4o via Model Gateway)
- [ ] Prompt Registry integration (store prompts in prompt_registry)
- [ ] Note review/edit/approve UI
- [ ] AI usage cost tracking (ai_cost_tracking table)

### Month 3: Copilot + Memory
- [ ] Live copilot suggestions (WebSocket streaming to session panel)
- [ ] Memory extraction pipeline (post-session async)
- [ ] pgvector embedding generation (text-embedding-3-large)
- [ ] Memory search UI (natural language queries)
- [ ] Patient timeline UI (chronological events)
- [ ] Risk detection agent (flag concerning language for therapist review)

### Month 4: Marketplace + Radar
- [ ] Therapist public profiles (marketplace_listings)
- [ ] Marketplace search + filters (search_marketplace() function)
- [ ] Patient booking flow (appointments table)
- [ ] Radar matching algorithm (calculate_radar_match_score() function)
- [ ] Payment processing (Stripe integration with session_fees)
- [ ] Review system (post-session reviews)

### Month 5–6: Practice + Admin + Launch
- [ ] Multi-therapist practice accounts
- [ ] Basic admin portal
- [ ] Compliance controls (consent management, audit dashboard)
- [ ] Analytics dashboards (daily_metrics, practice_health_metrics)
- [ ] Egypt launch preparation
- [ ] Beta therapist onboarding (50 therapists)
- [ ] Billing activation (subscriptions, invoices, payouts)

---

## 17. Important Engineering Decisions

### DO
- ✅ Build Model Gateway — never tie to one AI provider
- ✅ Store prompts in database with versions (Prompt Registry)
- ✅ Build events pipeline from day 1 (Redis Streams → Kafka)
- ✅ Use pgvector for memory — upgrade to Qdrant/Pinecone at scale
- ✅ Implement audit logging middleware for ALL data mutations
- ✅ Soft deletes everywhere — never hard delete clinical data
- ✅ Always scope queries by organization_id
- ✅ Build context construction engine before any AI generation
- ✅ Use design tokens (CSS variables) from day 1 for white labeling
- ✅ Implement RBAC from the very first user table
- ✅ Track AI costs per request in ai_cost_tracking
- ✅ Use UUIDs everywhere (never integer IDs)
- ✅ Implement row-level security (RLS) on sensitive tables
- ✅ Start with modular monolith, extract services as needed
- ✅ Partition transcript_segments and analytics_events by date

### DON'T
- ❌ Don't hardcode prompts in application code
- ❌ Don't call OpenAI directly without a gateway/wrapper
- ❌ Don't skip audit logs — these are legally required
- ❌ Don't build AI that makes clinical decisions — suggestions only
- ❌ Don't skip the context construction step before generation
- ❌ Don't build screens before entities (database-first design)
- ❌ Don't use integer IDs — use UUIDs everywhere
- ❌ Don't forget encryption at rest for all PHI fields
- ❌ Don't build AI patient features without clear "I am an AI" disclaimers
- ❌ Don't allow cross-organization data access under any circumstances
- ❌ Don't UPDATE or DELETE from audit_logs — append only

---

## 18. Complete Documentation Index

### All Part Files (40 files covering entire platform)

| File | Contents |
|------|----------|
| part-01-executive-summary.md | Vision, market, 12 systems, branding |
| part-02-information-architecture.md | Website, workflows, AI chat, radar |
| part-03-platform-architecture-database.md | Tech stack, microservices, schema overview |
| part-04-ai-architecture-experiences.md | 7 agents, therapist/patient experience |
| part-05-admin-platform-compliance.md | Admin CRM, compliance, security |
| part-06-ux-design-system.md | UX principles, tokens, portal screens |
| **part-07-ai-core-intelligence-engine.md** | 5 intelligence layers, knowledge graph, memory, outcome tracking, moat |
| part-08-enterprise-engineering-infrastructure.md | 18 services, realtime pipeline, HIPAA/GDPR |
| **part-09-brand-marketing-engine.md** | Brand strategy, website, acquisition funnels, marketplace flywheel, VC narrative |
| **part-10-user-lifecycle-workflows.md** | User types, state machines, notifications, permissions, automations |
| part-11-screen-ui-specification.md | Screen-by-screen UI spec |
| **part-12-enterprise-database-architecture.md** | Complete ERD, all table schemas, relationships |
| **part-13-ai-architecture-agents.md** | 10 agents, memory engine, knowledge graph, model routing, prompt management |
| part-14-interoperability-integrations.md | APIs, webhooks, SDKs, FHIR/HL7 |
| part-15-company-building-blueprint.md | MVP, hiring, budget, fundraising |
| **part-16-clinical-intelligence-layer.md** | Clinical intelligence, data flywheel, 10-year vision, research platform |
| part-17-commercial-strategy-revenue.md | 8 revenue streams, pricing, ARR roadmap |
| **part-18-brand-strategy-marketing.md** | Category creation, messaging, website architecture, SEO, sales funnels |
| **part-19-enterprise-engineering-architecture.md** | Frontend/backend architecture, security, CI/CD, performance, acquisition-grade |
| **part-20-ai-architecture-clinical-intelligence.md** | AI layers, agents deep dive, memory architecture, RAG, multi-model strategy |
| **part-21-database-architecture-vol1-vol2.md** | Complete PostgreSQL schema with full SQL, vol1 + vol2 |
| part-22-vol1-design-system.md | Brand, colors, typography, components |
| part-23-ai-architecture-vol2.md | 10 agents, Model Gateway, RAG, prompts |
| part-25-vol1-database-core.md | Organizations, users, therapists, patients |
| part-25-vol2-database-sessions-ai.md | Sessions, AI notes, memory, billing |
| part-26-vol1-ai-scribe-copilot.md | Scribe engine, copilot, memory moat |
| part-26-vol2-patient-ai-crisis-radar.md | Patient AI, crisis detection, radar |
| part-27-vol1-website-marketing.md | Brand, homepage, conversion funnels |
| part-27-vol2-pricing-marketplace-seo.md | Pricing, marketplace, SEO, growth |
| part-28-therapist-dashboard-ux.md | Dashboard UX spec |
| part-29-enterprise-whitelabel.md | Enterprise features, SSO, white label |
| part-30-api-specification.md | API endpoints, auth, SDKs |
| part-31-infrastructure-devops.md | AWS, K8s, CI/CD, DR |
| part-32-gtm-playbooks.md | Egypt launch, acquisition, growth loops |
| part-33-investor-deck.md | VC narrative, TAM, financials, exits |
| part-34-acquisition-readiness.md | Build for acquisition from day 1 |
| part-35-product-roadmap.md | 10-year product evolution |

**Bold = new files created from missing parts.md**

### SQL Migration Files (Complete — Ready to Run)

| File | Tables | Status |
|------|--------|--------|
| 001_core_schema.sql | organizations, organization_settings, extensions | ✅ Ready |
| 002_therapists_schema.sql | therapists, credentials, specializations | ✅ Ready |
| 003_patients_schema.sql | patients, profiles, contacts, consents, files, timeline | ✅ Ready |
| 004_clinical_schema.sql | goals, life events, relationships, risk assessments, treatment plans | ✅ Ready |
| 005_medications_schema.sql | medications, patient_medications, history | ✅ Ready |
| 006_sessions_schema.sql | sessions, participants, notes, recordings, transcripts | ✅ Ready |
| 007_ai_schema.sql | ai_notes, summaries, intelligence, memory (pgvector), prompt_registry, logs | ✅ Ready |
| 008_assessments_schema.sql | assessment_templates (PHQ-9/GAD-7 seeded), results, answers, trends | ✅ NEW |
| 009_radar_schema.sql | radar_requests, broadcasts, matches, sessions, match scoring function | ✅ NEW |
| 010_billing_schema.sql | subscription_plans (seeded), subscriptions, invoices, payments, payouts | ✅ NEW |
| 011_notifications_schema.sql | templates (seeded), notifications, preferences, queue, messages | ✅ NEW |
| 012_audit_compliance_schema.sql | audit_logs (append-only+RLS), consents, GDPR, BAAs, HIPAA checklist | ✅ NEW |
| 013_marketplace_schema.sql | marketplace_listings, reviews, categories (seeded), search function | ✅ NEW |
| 014_analytics_schema.sql | events (partitioned), ai_cost_tracking, daily_metrics, performance metrics | ✅ NEW |

---

## 19. The North Star

Every session processed makes the platform smarter.
Every therapist onboarded strengthens the network.
Every patient journey builds the intelligence layer.

> **If 24Therapy becomes the trusted system of record for mental health workflows, everything else becomes easier to build on top.**

The moat is not the product. The moat is the **accumulated clinical intelligence** that makes the product irreplaceable.

**Build the infrastructure first. Build the intelligence second. Build the network third. The product follows from all three.**

---

## 20. For the AI Building This Platform

**You have everything you need:**

1. **40 documentation files** — Every part of the product specified
2. **14 SQL migration files** — Ready to run, fully complete
3. **This readme.md** — Complete context, execution plan, decisions

**Start here:**
1. Run all 14 SQL migrations in order
2. Build auth + patient CRUD
3. Build session lifecycle
4. Build WebRTC + Whisper transcription
5. Build the Model Gateway (before any AI feature)
6. Build context construction engine
7. Build SOAP note generation
8. Build memory extraction + pgvector search

**The hardest thing to get right:** The Context Construction Engine (Section 5). Poor context = poor AI output. Build this before building any AI generation features.

**The most important thing to preserve:** The `audit_logs` table is append-only. Never add UPDATE or DELETE on it. This is a legal requirement.

**The biggest technical differentiator:** The `patient_memories` table with pgvector embeddings. This is the moat. Build the memory extraction pipeline carefully.
