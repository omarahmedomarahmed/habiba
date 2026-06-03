# CLAUDE.md — 24Therapy.ai Platform Intelligence

Complete platform understanding and actionable execution plan for building the 24Therapy.ai AI-native Mental Health Operating System.

**Source:** 15,245-line Master PRD (README.md) + 30 docs/ files covering every part

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
| Mobile (Patient) | React Native |
| Mobile (Therapist) | React Native |

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

### Core Technology Choices

| Layer | Technology | Why |
|-------|------------|-----|
| Primary DB | PostgreSQL | Relational, HIPAA-friendly, pgvector |
| Cache | Redis | Session management, caching, queues |
| Vector DB | pgvector (→ Qdrant/Pinecone at scale) | Memory + semantic search |
| Event Bus | Apache Kafka / NATS | Event-driven microservices |
| Storage | AWS S3 + Cloudflare R2 | Recordings, files, reports |
| Video | WebRTC (Daily.co or LiveKit) | Teletherapy sessions |
| AI Models | Model Gateway → OpenAI/Anthropic/Custom | Abstracted, switchable |
| Container | Kubernetes (EKS) | Scale 100 → 100K sessions |
| CDN | Cloudflare | Edge, DDoS, WAF |
| CI/CD | GitHub Actions | Automated deploy pipeline |
| IaC | Terraform | Reproducible infrastructure |
| Monitoring | Prometheus + Grafana + Sentry | Full observability |

---

## 4. Database Architecture (Summary)

See `docs/part-25-vol1-database-core.md` and `docs/part-25-vol2-database-sessions-ai.md` for full schema.

### 17 Schema Groups

```
auth · organizations · users · patients · therapists
sessions · transcripts · reports · assessments · medications
billing · marketplace · notifications · audit · ai · analytics · integrations
```

### Critical Tables (Priority Order)

1. `organizations` — Multi-tenant root
2. `users` — All users across roles
3. `therapists` — Clinical profiles
4. `patients` — Most important entity
5. `sessions` — Session lifecycle
6. `transcripts` + `transcript_segments` — Raw clinical data
7. `ai_session_notes` — SOAP/DAP/BIRP outputs
8. `patient_memory` — The moat (with pgvector embeddings)
9. `session_intelligence` — Structured themes/signals
10. `assessment_results` — PHQ-9, GAD-7, etc.
11. `risk_assessments` — Safety monitoring
12. `audit_logs` — Immutable, append-only

---

## 5. AI Architecture (Build This Carefully)

### The Right Architecture (NOT the shortcut)

**Wrong:**
```
App → OpenAI → Output
```

**Right:**
```
Request → Intent Detection → Memory Retrieval → Context Construction → Agent → Output
```

### 10 AI Agents

| Agent | Purpose |
|-------|---------|
| 1. Session Scribe | Transcription, speaker labeling, realtime |
| 2. Clinical Memory | Extract, update, relate memories |
| 3. Assessment | Interpret scores, track trends |
| 4. Treatment Planning | Goals, milestones, progress |
| 5. Medication Intelligence | History, adherence, reminders |
| 6. Risk Monitoring | Risk language detection, escalation |
| 7. Patient Companion | Consumer-facing support AI |
| 8. Therapist Copilot | Session support, suggestions |
| 9. Marketplace | Matching, routing, optimization |
| 10. Executive Intelligence | Business analytics (internal) |

### Model Gateway (Critical)

Never build directly against one model provider. Build a Model Gateway that:
- Routes to right model per task type
- Provides fallbacks
- Tracks costs per request
- Supports A/B testing of models
- Allows instant model swapping

### Prompt Registry (Not in Code)

All prompts versioned in database:
- `SOAP_NOTE_V12`
- `SESSION_SUMMARY_V5`
- `MEMORY_EXTRACTION_V8`

Never hardcode prompts. Every change tracked. Rollback possible.

### Context Construction Engine (Most Critical)

Before ANY generation:
```json
{
  "patient_summary": "...",
  "recent_sessions": "...",
  "current_goals": "...",
  "assessments": "...",
  "medications": "...",
  "risk_flags": "..."
}
```

Poor context = poor output. This is where most AI failures happen.

### Vector Memory (The Moat)

`patient_memory` table uses `pgvector` with 1536-dimension embeddings.

Every memory has:
- `embedding vector(1536)` — semantic search
- `confidence_score` — AI confidence
- `status` — therapist review status
- `source_session_id` — traceability
- `memory_type` — categorized (symptom/goal/relationship/etc.)

This is the platform's primary competitive moat.

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

---

## 7. Design System (Exact Values)

### Colors

| Token | Hex |
|-------|-----|
| Primary (Deep Trust Navy) | `#0A2342` |
| Secondary (Intelligent Blue) | `#1F5EFF` |
| Accent (Success Cyan) | `#24C8DB` |
| Success | `#16A34A` |
| Warning | `#F59E0B` |
| Error | `#DC2626` |
| Background | `#F8FAFC` |
| Card | `#FFFFFF` |
| Text Dark | `#0F172A` |
| Text Secondary | `#64748B` |

### Typography
- Font: **Inter** (Google Fonts)
- Scale: 12 · 14 · 16 · 18 · 24 · 36 · 48 · 64

### Spacing
- Base: 8px grid
- Scale: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128

### Border Radius
- Small: 8px | Medium: 12px | Large: 16px | Premium: 24px

### Icons: **Lucide Icons** (only)

### Component Library: **ShadCN/UI** on top of Tailwind

---

## 8. Session Room Architecture

The most technically complex screen.

### Layout (4-Column)
```
[Session Header — therapist name, patient name, timer, controls]
┌─────────────────┬──────────────────┬────────────────────────┐
│  LIVE           │  VIDEO           │  AI COPILOT            │
│  TRANSCRIPT     │  WINDOW          │  ─────────────         │
│  ─────────────  │  (WebRTC)        │  Conversation Summary  │
│  [Therapist]:   │                  │  Suggested Questions   │
│  [Patient]:     │                  │  Themes Detected       │
│  ...            │                  │  Memory Mentions       │
│                 │                  │  Risk Reminders        │
├─────────────────┤                  ├────────────────────────┤
│  NOTES PAD      │                  │  PATIENT CONTEXT       │
│  (editable)     │                  │  (readonly during)     │
└─────────────────┴──────────────────┴────────────────────────┘
```

### Session Pipeline

```
WebRTC Audio
 ↓ Chunked to ASR (every 3s)
 ↓ Transcript segment created
 ↓ Speaker labeled
 ↓ Published to WebSocket
 ↓ Copilot Agent processes
 ↓ Suggestions streamed to panel
 ↓ Memory Agent extracts
```

---

## 9. Critical Implementation Priorities

### Phase 1 MVP (Build First)

In this exact order:

1. **Auth system** — Login, JWT, org scoping
2. **Patient CRUD** — Create, view, update patients
3. **Session management** — Schedule, start, end sessions
4. **Audio → Transcript** — WebRTC audio + Whisper ASR
5. **AI Note Generation** — Transcript → SOAP note (GPT-4)
6. **Note Review UI** — View, edit, approve notes
7. **Basic Therapist Dashboard** — KPIs, patient list, upcoming sessions

### Phase 2 (Add Intelligence)

8. **Therapist Copilot** — Live suggestions during session
9. **Assessment tools** — PHQ-9, GAD-7, ASRS
10. **Patient Memory** — Extract + store memories from sessions
11. **Patient Timeline** — Visual history of events
12. **Report generation** — One-click clinical reports

### Phase 3 (Marketplace + Growth)

13. **Therapist marketplace** — Public directory
14. **Patient booking flow** — Search → book → session
15. **Radar instant matching** — Real-time therapist matching
16. **Practice management** — Multi-therapist accounts
17. **Billing system** — Subscriptions + marketplace fees

---

## 10. Compliance Requirements (Non-Negotiable)

### HIPAA (All production data)
- PHI encrypted at rest (AES-256)
- PHI encrypted in transit (TLS 1.3)
- Audit logs (immutable, 7-year retention)
- Role-based access controls
- Breach notification procedures
- Business Associate Agreements (BAAs) with all vendors

### GDPR (For EU/UK users)
- Data residency controls
- Right to erasure (soft delete + data portability)
- Consent management with versioning
- DPO (Data Protection Officer) designation

### Audit Logs (Critical)
- Every data access logged
- Every change logged with old/new values
- Append-only (no UPDATE/DELETE ever)
- Include: user_id, IP, action, resource, timestamp

### Medical AI Safety
- AI never independently diagnoses
- All AI outputs marked as "suggestions for professional review"
- Therapist approval required before notes are finalized
- Crisis detection triggers human review workflows

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
  };
}
```

### Multi-Tenant Scoping
Every query must be scoped by `organization_id`:
```sql
WHERE organization_id = $1 AND deleted_at IS NULL
```

Never allow cross-org data access.

### Soft Deletes
Never hard delete clinical data:
```sql
UPDATE patients SET deleted_at = NOW() WHERE id = $1;
```

### Event Publishing
After every significant action, publish to event bus:
```typescript
await eventBus.publish('session.completed', {
  sessionId, patientId, therapistId, orgId
});
```

---

## 12. Revenue Model

| Stream | Mechanism |
|--------|-----------|
| SaaS Starter | Free or pay-as-you-go |
| Professional | ~$99/month per therapist |
| Practice | Per-seat pricing (team plans) |
| Enterprise | $2K–$20K/month custom |
| Marketplace Commission | 15–25% of session fees |
| Radar Fee | Per-instant-session platform fee |
| API Usage | Token/request-based pricing |
| White Label | Platform licensing |

**North Star:** Clinical Hours Processed
**Primary SaaS metric:** MRR / ARR per organization
**Unit economics:** $99/month at 70–85% gross margin

---

## 13. Expansion Strategy

| Phase | Market | Timeline |
|-------|--------|----------|
| 1 | Egypt | Launch |
| 2 | UAE, Saudi Arabia, Jordan | 6–18 months |
| 3 | UK, Australia | 18–30 months |
| 4 | Europe | 30–48 months |
| 5 | United States | 36–60 months |
| 6 | Global | 5+ years |

**Why Egypt first:** Founder network, underserved market, lower CAC, proof of concept.

---

## 14. The Competitive Moat (6 Layers)

| Layer | Description |
|-------|-------------|
| 1. Clinical Memory | Longitudinal structured mental health intelligence |
| 2. Data Flywheel | More sessions → better AI → more therapists |
| 3. Network Effects | Marketplace liquidity (therapists need patients need therapists) |
| 4. Switching Cost | Patient history, memories, treatment plans — can't migrate easily |
| 5. Workflow Lock-In | Therapists build daily habits around the tools |
| 6. Proprietary Data | First platform with structured mental health behavioral data at scale |

---

## 15. File Structure (Recommended)

```
/
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
│   ├── ai-scribe-service/      # NestJS
│   ├── memory-service/         # NestJS
│   ├── transcript-service/     # NestJS
│   └── ...                     # Other microservices
├── packages/
│   ├── ui/                     # Shared ShadCN components
│   ├── types/                  # Shared TypeScript types
│   ├── utils/                  # Shared utilities
│   └── config/                 # Shared config (ESLint, TSConfig)
├── migrations/                 # SQL migration files
│   ├── 001_core_schema.sql
│   ├── 002_therapists_schema.sql
│   └── ...
├── docs/                       # This PRD divided into 30+ files
│   ├── part-01-executive-summary.md
│   ├── part-02-information-architecture.md
│   └── ...
├── README.md                   # Master 15,245-line PRD
└── CLAUDE.md                   # This file
```

---

## 16. Immediate Next Steps (Execution Plan)

### Week 1–2: Repository & Infrastructure Setup
- [ ] Create monorepo (Turborepo)
- [ ] Set up Next.js apps (web, patient, therapist, admin)
- [ ] Set up NestJS services scaffold
- [ ] Configure PostgreSQL + Redis (local Docker)
- [ ] Run all SQL migrations
- [ ] Set up pgvector extension
- [ ] Configure Tailwind + ShadCN component library
- [ ] Set up GitHub Actions CI pipeline

### Week 3–4: Auth + Core Data
- [ ] Implement JWT auth (auth-service)
- [ ] Multi-tenant org scoping middleware
- [ ] User + role management
- [ ] Patient CRUD endpoints
- [ ] Therapist profile endpoints
- [ ] Audit logging middleware

### Month 2: Session + AI Scribe
- [ ] Session lifecycle (create/start/end)
- [ ] WebRTC integration (Daily.co or LiveKit)
- [ ] Audio chunking to ASR (OpenAI Whisper)
- [ ] Transcript segment storage
- [ ] SOAP note generation (GPT-4 via Model Gateway)
- [ ] Note review/edit/approve UI

### Month 3: Copilot + Memory
- [ ] Live copilot suggestions (streaming)
- [ ] Memory extraction pipeline
- [ ] pgvector embedding generation
- [ ] Memory search UI
- [ ] Patient timeline UI

### Month 4: Marketplace + Radar
- [ ] Therapist public profiles
- [ ] Marketplace search + filters
- [ ] Patient booking flow
- [ ] Radar matching algorithm
- [ ] Payment processing (Stripe)

### Month 5–6: Practice + Admin + Launch
- [ ] Multi-therapist practice accounts
- [ ] Basic admin portal
- [ ] Compliance controls
- [ ] Egypt launch preparation
- [ ] Beta therapist onboarding (50 therapists)

---

## 17. Important Engineering Decisions

### DO
- ✅ Build Model Gateway — never tie to one AI provider
- ✅ Store prompts in database with versions (Prompt Registry)
- ✅ Build events pipeline from day 1 (Kafka/NATS)
- ✅ Use pgvector for memory — upgrade to Qdrant/Pinecone at scale
- ✅ Implement audit logging middleware for ALL data mutations
- ✅ Soft deletes everywhere — never hard delete clinical data
- ✅ Always scope queries by organization_id
- ✅ Build context construction engine before any AI generation
- ✅ Use design tokens (CSS variables) from day 1 for white labeling
- ✅ Implement RBAC from the very first user table

### DON'T
- ❌ Don't hardcode prompts in application code
- ❌ Don't call OpenAI directly without a gateway/wrapper
- ❌ Don't skip audit logs — these are legally required
- ❌ Don't build AI that makes clinical decisions — suggestions only
- ❌ Don't skip the context construction step before generation
- ❌ Don't build screens before entities (database-first design)
- ❌ Don't use a single monolith — build service-oriented from day 1
- ❌ Don't forget encryption at rest for all PHI fields

---

## 18. Documentation Index

All 30 documentation files are in the `/docs` directory:

| File | Contents |
|------|----------|
| part-01-executive-summary.md | Vision, market, 12 systems, branding |
| part-02-information-architecture.md | Website, workflows, AI chat, radar |
| part-03-platform-architecture-database.md | Tech stack, microservices, schema overview |
| part-04-ai-architecture-experiences.md | 7 agents, therapist/patient experience |
| part-05-admin-platform-compliance.md | Admin CRM, compliance, security |
| part-06-ux-design-system.md | UX principles, tokens, portal screens |
| part-08-enterprise-engineering-infrastructure.md | 18 services, realtime pipeline, HIPAA/GDPR |
| part-11-screen-ui-specification.md | Screen-by-screen UI spec |
| part-14-interoperability-integrations.md | APIs, webhooks, SDKs, FHIR/HL7 |
| part-15-company-building-blueprint.md | MVP, hiring, budget, fundraising |
| part-17-commercial-strategy-revenue.md | 8 revenue streams, pricing, ARR roadmap |
| part-22-vol1-design-system.md | Brand, colors, typography, components |
| part-23-ai-architecture-vol2.md | 10 agents, Model Gateway, RAG, prompts |
| part-25-vol1-database-core.md | Organizations, users, therapists, patients |
| part-25-vol2-database-sessions-ai.md | Sessions, AI notes, memory, billing |
| part-26-vol1-ai-scribe-copilot.md | Scribe engine, copilot, memory moat |
| part-26-vol2-patient-ai-crisis-radar.md | Patient AI, crisis detection, radar |
| part-27-vol1-website-marketing.md | Brand, homepage, conversion funnels |
| part-27-vol2-pricing-marketplace-seo.md | Pricing, marketplace, SEO, growth |
| part-28-therapist-dashboard-ux.md | Dashboard UX spec (partial) |
| part-29-enterprise-whitelabel.md | Enterprise features, SSO, white label |
| part-30-api-specification.md | API endpoints, auth, SDKs |
| part-31-infrastructure-devops.md | AWS, K8s, CI/CD, DR |
| part-32-gtm-playbooks.md | Egypt launch, acquisition, growth loops |
| part-33-investor-deck.md | VC narrative, TAM, financials, exits |
| part-34-acquisition-readiness.md | Build for acquisition from day 1 |
| part-35-product-roadmap.md | 10-year product evolution |

### SQL Migration Files (in /migrations)

| File | Tables |
|------|--------|
| 001_core_schema.sql | organizations, organization_settings, extensions |
| 002_therapists_schema.sql | therapists, credentials, specializations |
| 003_patients_schema.sql | patients, profiles, contacts, consents, files, timeline |
| 004_clinical_schema.sql | goals, life events, relationships, risk assessments, treatment plans |
| 005_medications_schema.sql | medications, patient_medications, history |
| 006_sessions_schema.sql | sessions, participants, notes, recordings, transcripts |
| 007_ai_schema.sql | ai_notes, summaries, intelligence, memory, prompt_registry, logs |
| 008_assessments_schema.sql | assessment_templates, results |
| 009_radar_schema.sql | radar_requests, matches, sessions |
| 010_billing_schema.sql | subscriptions, transactions, session_fees, payouts |
| 011_notifications_schema.sql | notifications, preferences |
| 012_audit_compliance_schema.sql | audit_logs, consents, security_incidents |
| 013_marketplace_schema.sql | marketplace, reviews, ratings |
| 014_analytics_schema.sql | events, metrics, ai_cost_tracking |

---

## 19. The North Star

Every session processed makes the platform smarter.  
Every therapist onboarded strengthens the network.  
Every patient journey builds the intelligence layer.  

> **If 24Therapy becomes the trusted system of record for mental health workflows, everything else becomes easier to build on top.**

The moat is not the product. The moat is the **accumulated clinical intelligence** that makes the product irreplaceable.

Build the infrastructure first. Build the intelligence second. Build the network third. The product follows from all three.
