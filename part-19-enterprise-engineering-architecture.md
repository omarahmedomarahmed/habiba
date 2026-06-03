# 24Therapy.ai — Part 19: Enterprise Engineering Architecture, AI Infrastructure, Realtime Systems, Security Framework, Scalability Strategy & Acquisition-Grade Technical Blueprint

## ENGINEERING PHILOSOPHY

Most startups make one of two mistakes:

**Mistake 1 — Over-engineer:** Build for 100 million users before acquiring 10.

**Mistake 2 — Under-engineer:** Create technical debt that prevents scaling.

24Therapy should follow: **Build Simple → Scale Intelligently → Architect Correctly**

The system must:
- Launch quickly (weeks, not months)
- Scale globally (from 100 to 100,000 sessions/day)
- Remain maintainable (monorepo, clean services)
- Remain compliant (HIPAA/GDPR from day 1)
- Support future acquisitions (documented, auditable)
- Support white-label deployments (multi-tenant design)
- Support APIs (developer platform)
- Support enterprise customers (SSO, SLA, compliance)

---

## HIGH LEVEL SYSTEM ARCHITECTURE

```
Frontend Layer (Next.js / React Native)
  ↓
API Gateway (rate limiting, auth, routing)
  ↓
Core Services Layer (NestJS microservices)
  ↓
AI Orchestration Layer (FastAPI agents)
  ↓
Data Layer (PostgreSQL + pgvector + Redis + S3)
  ↓
Infrastructure Layer (AWS EKS + Cloudflare)
```

---

## SYSTEM DOMAINS

| Domain | Components |
|--------|-----------|
| **Public Platform** | Website, marketing pages, SEO, resources |
| **Therapist Platform** | Dashboard, patients, sessions, reports, memory, analytics |
| **Patient Platform** | AI chat, sessions, reports, profile, appointments |
| **Admin Platform** | Operations, billing, support, analytics, CRM |
| **AI Platform** | Transcription, documentation, memory, search, reasoning, matching |
| **Developer Platform** | API, SDK, webhooks, sandbox, documentation |

---

## TECHNOLOGY STACK (Complete)

### Frontend

| App | Tech | Notes |
|-----|------|-------|
| Public Website | Next.js 14 + TypeScript + Tailwind | SSR for SEO |
| Therapist Portal | Next.js 14 + TypeScript + ShadCN | App Router |
| Patient Portal | Next.js 14 + TypeScript + ShadCN | App Router |
| Admin Portal | Next.js 14 + TypeScript + ShadCN | App Router |
| Developer Portal | Next.js 14 + TypeScript | Docs + sandbox |
| Mobile (Patient) | React Native + Expo | iOS + Android |
| Mobile (Therapist) | React Native + Expo | iOS + Android |

**State Management:** Zustand (initially) → Redux Toolkit (when needed)

**Mobile Strategy:** Phase 1 = Responsive Web, Phase 2 = Native Mobile (React Native)

### Backend

| Service | Tech | Responsibility |
|---------|------|---------------|
| API Gateway | NestJS + Express | Auth, rate limiting, routing |
| Business Logic Services | NestJS | Users, billing, sessions, patients |
| AI Services | FastAPI (Python) | Transcription, memory, inference |

**Recommended approach:** Hybrid architecture. NestJS for business logic + FastAPI for AI-heavy services.

### Database Layer

| Database | Purpose |
|---------|---------|
| PostgreSQL | Primary relational database |
| pgvector extension | Vector embeddings for memory search |
| Redis | Caching, sessions, real-time events, queues |
| Amazon S3 / Cloudflare R2 | File storage (recordings, reports, exports) |

### Event Bus

| Phase | Technology |
|-------|-----------|
| Phase 1 (MVP) | Redis Streams or RabbitMQ |
| Phase 2 (Scale) | Apache Kafka or NATS |

**Purpose:** Loose coupling between services, event-driven processing

**Key events:** SessionStarted | SessionEnded | TranscriptUpdated | ReportGenerated | MedicationUpdated | RadarAccepted

### Video & Audio

| Purpose | Technology |
|---------|-----------|
| WebRTC sessions | Daily.co or LiveKit |
| Audio processing | Chunked stream → ASR pipeline |
| Storage | Encrypted S3 |

### AI Models

| Task | Model |
|------|-------|
| Transcription | OpenAI Whisper (primary) |
| Documentation | GPT-4o / Claude Sonnet |
| Memory extraction | GPT-4o |
| Classification | GPT-3.5 / Claude Haiku |
| Embeddings | text-embedding-3-large |
| Vector search | pgvector (→ Qdrant at scale) |

---

## API GATEWAY (Single Entry Point)

**Responsibilities:**
- JWT authentication validation
- API key validation (developer platform)
- Rate limiting (per org, per user, per endpoint)
- Request routing to microservices
- Request/response logging
- Security headers
- CORS management

---

## DATABASE DESIGN PRINCIPLES

### Why PostgreSQL

Healthcare data is **inherently relational**. PostgreSQL benefits:
- ACID compliance (critical for clinical data)
- Mature and battle-tested
- Enterprise-friendly (AWS RDS, Aurora)
- pgvector extension (vector search)
- JSONB support (flexible metadata)
- Row-level security (multi-tenant isolation)

### Vector Search (pgvector)

```sql
-- Memory retrieval example
SELECT memory_text, confidence_score
FROM patient_memories
WHERE patient_id = $1
ORDER BY embedding <=> $2  -- cosine similarity
LIMIT 10;
```

Upgrade path: pgvector → Qdrant/Pinecone at scale (>10M vectors)

### Object Storage Structure

```
s3://24therapy-[env]/
  recordings/
    [org_id]/[session_id]/recording.mp4
  transcripts/
    [org_id]/[session_id]/transcript.json
  reports/
    [org_id]/[patient_id]/[report_id].pdf
  patient-files/
    [org_id]/[patient_id]/[file_id]/filename
```

---

## MICROSERVICES STRATEGY

**Do NOT start with microservices.**

**Start with:** Modular Monolith (single codebase, modular structure)

**Benefits of starting modular:**
- Fast development velocity
- Easier debugging
- Shared database (simpler initially)
- Lower infrastructure cost

**When to split:** When specific services need independent scaling or when team size demands it (>10 engineers per service area)

### Future Service Decomposition

| Service | Responsibility |
|---------|---------------|
| user-service | Authentication, roles, permissions |
| patient-service | Patient CRUD, profiles, files |
| session-service | Session lifecycle, recordings |
| transcript-service | ASR pipeline, transcript storage |
| ai-scribe-service | Note generation, summaries |
| memory-service | Memory extraction, retrieval, consolidation |
| copilot-service | Real-time suggestions during sessions |
| assessment-service | Assessments, scoring, trends |
| report-service | Report generation, export |
| billing-service | Subscriptions, payments, payouts |
| notification-service | Email, SMS, push, in-app |
| marketplace-service | Directory, search, reviews |
| radar-service | Instant matching algorithm |
| analytics-service | Events, metrics, dashboards |
| audit-service | Immutable audit logs, compliance |

---

## REALTIME TRANSCRIPTION SYSTEM

One of the most technically important systems.

### Workflow

```
Browser Microphone
  ↓ Audio chunk (every 3 seconds)
  ↓ Encrypted transmission
  ↓ Speech Recognition Service (Whisper)
  ↓ Transcript segment created
  ↓ Speaker labeled
  ↓ Published to WebSocket
  ↓ Copilot Agent processes
  ↓ Live suggestions streamed to panel
  ↓ Memory Agent extracts asynchronously
```

**Latency goal:** 1–3 seconds from speech to text display

### Audio Pipeline

```
Capture → Compress → Encrypt → Transmit → Process → Store → Analyze
```

### Transcription Provider Abstraction

Never depend on one provider:

```typescript
interface TranscriptionProvider {
  transcribe(audioChunk: Buffer, options: TranscriptionOptions): Promise<TranscriptSegment[]>;
}

class WhisperProvider implements TranscriptionProvider { ... }
class AssemblyAIProvider implements TranscriptionProvider { ... }
class AzureSpeechProvider implements TranscriptionProvider { ... }
```

**Benefits:** Switch vendors | Reduce cost | Improve quality | Increase reliability

---

## LIVE SESSION ENGINE

**Supported modalities:** Video | Voice-only | Chat | Screen sharing (future)

**Recommended providers:** Daily.co (simpler) or LiveKit (self-hosted option)

### Session Recording System

Every session creates:
1. Recording file (encrypted in S3)
2. Transcript (segments in PostgreSQL)
3. AI Summary (stored in ai_session_notes)
4. Memory Updates (patient_memories updated)
5. Clinical Report (ai_session_notes)
6. Audit Log (audit_logs append-only)

---

## AI ORCHESTRATION LAYER

One of the most valuable systems.

### Input Processing

```
Audio / Text / Documents
  ↓ Intent Detection
  ↓ Task Classification
  ↓ Memory Retrieval (RAG)
  ↓ Context Construction
  ↓ Agent Routing
  ↓ Generation
  ↓ Quality Validation
  ↓ Output
```

### Context Construction (Critical)

Before ANY generation request:

```typescript
const context = {
  patientSummary: await getPatientSummary(patientId),
  recentSessions: await getRecentSessions(patientId, 3),
  activeGoals: await getActiveGoals(patientId),
  assessments: await getLatestAssessments(patientId),
  medications: await getActiveMedications(patientId),
  riskFlags: await getRiskFlags(patientId),
  therapistPreferences: await getTherapistPreferences(therapistId),
  relevantMemories: await searchMemories(patientId, sessionContext, 10)
};
```

---

## SECURITY ARCHITECTURE

**Principle:** Security by design. Not security later. **Security now.**

### Data Encryption

| Layer | Standard |
|-------|---------|
| At Rest (database) | AES-256 |
| At Rest (files/recordings) | AES-256 (S3 server-side) |
| In Transit (API) | TLS 1.3 |
| Sensitive fields | Column-level encryption (pgcrypto) |
| Future: Session recordings | End-to-end encryption option |

### Sensitive Field Encryption

Encrypt at column level:
- `patients.date_of_birth`
- `patients.phone`
- `users.phone`
- All file contents (S3 encryption)

### Role-Based Access Control (RBAC)

Every API endpoint validated:
1. JWT valid
2. Organization membership confirmed
3. Role has required permission
4. Resource belongs to same organization

### Multi-Tenant Isolation

All queries scoped:
```sql
WHERE organization_id = $org_id AND deleted_at IS NULL
```

Row-Level Security (RLS) in PostgreSQL as additional safety layer.

### Audit Logging Middleware

```typescript
// Applied to ALL mutations
app.use(auditMiddleware({
  log: (action, resource, oldValue, newValue) => {
    auditService.log({
      userId: req.user.id,
      organizationId: req.user.orgId,
      action,
      resourceType: resource.type,
      resourceId: resource.id,
      oldValue: sanitize(oldValue),
      newValue: sanitize(newValue),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  }
}));
```

---

## BACKUP STRATEGY

| Frequency | Retention |
|-----------|----------|
| Daily | 30 days |
| Weekly | 12 weeks |
| Monthly | 12 months |
| Yearly | 7 years (HIPAA requirement) |

**Geo-redundant:** Primary + cross-region backup

**Recovery time objective (RTO):** < 4 hours  
**Recovery point objective (RPO):** < 1 hour

---

## MONITORING STACK

| Layer | Tool |
|-------|------|
| Application monitoring | Datadog or New Relic |
| Error tracking | Sentry |
| Infrastructure | Prometheus + Grafana |
| Uptime | Better Uptime |
| Product analytics | PostHog |
| Log aggregation | Datadog Logs or ELK Stack |

**Monitor:** Errors | Latency | Infrastructure | AI usage costs | Service availability

---

## CI/CD PIPELINE

```
Code Push
  ↓ Build (TypeScript compile)
  ↓ Unit Tests
  ↓ Integration Tests
  ↓ Security Scan (SAST/DAST)
  ↓ Docker Build
  ↓ Push to Registry
  ↓ Deploy to Staging
  ↓ E2E Tests
  ↓ Approval Gate
  ↓ Deploy to Production
  ↓ Health Check
  ↓ Monitor
```

**Tools:** GitHub Actions | Docker | Kubernetes (EKS) | Terraform (IaC)

---

## TESTING STRATEGY

| Type | Tool | Coverage Target |
|------|------|----------------|
| Unit Tests | Jest | 80%+ |
| Integration Tests | Supertest + Jest | Critical paths |
| E2E Tests | Playwright | Main user journeys |
| Load Tests | k6 | Before major releases |
| Security Tests | OWASP ZAP | Quarterly |

---

## PERFORMANCE TARGETS

| Action | Target |
|--------|--------|
| Dashboard load | < 2 seconds |
| Patient search | < 1 second |
| Transcript update display | 1–3 seconds |
| AI report generation | < 30 seconds |
| Radar match | < 60 seconds |
| File upload | Streaming progress |

---

## GLOBAL DEPLOYMENT STRATEGY

| Phase | Infrastructure |
|-------|--------------|
| Phase 1 (MVP) | Single region (Egypt/EU for MENA) |
| Phase 2 (GCC) | Add Middle East region |
| Phase 3 (Europe) | EU region (GDPR data residency) |
| Phase 4 (US) | US East + US West (HIPAA) |
| Phase 5 (Global) | Multi-region active-active |

---

## ACQUISITION-GRADE REQUIREMENTS

A future acquirer should be able to evaluate:

| Area | Requirement |
|------|------------|
| Codebase | Clean, documented, typed (TypeScript) |
| Documentation | README, API docs, architecture diagrams |
| Infrastructure | Terraform IaC, reproducible environments |
| Security | SOC 2 Type II, HIPAA audit reports |
| Compliance | GDPR compliance documentation |
| Data Models | ERD diagrams, schema documentation |
| APIs | OpenAPI 3.0 specifications |
| DevOps | Automated CI/CD, runbooks |
| Scalability | Load test results, capacity planning |

**Every system documented. Every service monitored. Every API versioned. Every permission auditable. Every workflow reproducible.**

---

## THE TRUE TECHNICAL MOAT

The moat is NOT: Transcription | Note-taking | Reports

**The moat becomes:**
- Patient Memory (pgvector embeddings × years of sessions)
- Clinical Intelligence (structured patterns from millions of sessions)
- Knowledge Graphs (causal relationships across patient histories)
- Workflow Data (therapist preference models)
- Outcome Data (treatment effectiveness at scale)
- Therapist Network Effects (matching quality improves with scale)

**These become exponentially harder to replicate over time. That is the technical moat.**
