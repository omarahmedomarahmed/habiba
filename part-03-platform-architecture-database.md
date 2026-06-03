# 24Therapy.ai — Part 3: Platform Architecture, Database Schema, Multi-Tenant Infrastructure, Security & API Ecosystem

---

## Core Technology Philosophy

24Therapy.ai must be built from day one as:
- Multi-tenant
- Enterprise-ready
- HIPAA-ready
- GDPR-ready
- API-first
- AI-native
- Acquisition-ready
- Globally scalable

**Not a SaaS application. Built as infrastructure.**

Future consumers via APIs:
- Therapists, clinics, practices, universities, hospitals, telehealth companies, insurance companies, healthcare AI companies

---

## High-Level System Architecture

```
Client Applications
        ↓
   API Gateway
        ↓
Authentication Layer
        ↓
 Permission Engine
        ↓
Business Logic Layer
        ↓
  AI Services Layer
        ↓
 Data Services Layer
        ↓
    Storage Layer
        ↓
   Analytics Layer
        ↓
  Monitoring Layer
```

---

## Frontend Applications

- Public Website
- Patient Portal
- Therapist Portal
- Practice Portal
- Admin Portal
- Super Admin Portal
- Developer Portal
- Mobile App (iOS + Android)
- Tablet App
- Future Desktop App

---

## Backend Microservices

| Service | Responsibility |
|---------|---------------|
| Auth Service | Authentication, JWT, sessions |
| User Service | User management |
| Patient Service | Patient records |
| Session Service | Session lifecycle |
| Calendar Service | Scheduling |
| Video Service | WebRTC, recordings |
| Transcript Service | Live transcription |
| AI Service | AI orchestration |
| Billing Service | Subscriptions, payments |
| Notification Service | Email, SMS, push |
| Analytics Service | Usage analytics |
| Medication Service | Medication tracking |
| Assessment Service | Assessment management |
| Radar Service | Matching engine |
| Reporting Service | Document generation |
| Developer API Service | Public APIs |
| Audit Service | Compliance logging |
| Compliance Service | HIPAA/GDPR |

---

## Recommended Technology Stack

### Frontend
- Next.js + TypeScript + Tailwind + ShadCN
- React Query + WebSockets

### Backend
- Node.js + NestJS + TypeScript
- GraphQL + REST + gRPC (internal services)

### Database
- **PostgreSQL** — Primary source of truth

### Search
- OpenSearch or Elasticsearch

### Caching
- Redis

### Object Storage
- AWS S3 / Cloudflare R2

### Realtime
- WebSockets + WebRTC + Redis Streams

### AI Infrastructure
- OpenAI · Anthropic · Open Source Models · Custom Fine-Tuned Models

### Observability
- OpenTelemetry · Grafana · Prometheus · Datadog

### Deployment
- AWS (multi-region) · Kubernetes · Terraform · Cloudflare

---

## Multi-Tenant Model

Every customer exists inside an **Organization**:

| Type | Example |
|------|---------|
| Single Therapist | 1 therapist |
| Small Practice | 5 therapists + 2 assistants |
| Clinic | 50 therapists + 20 staff |
| Enterprise | 1000+ users |

---

## Core Database Schema

### organizations
```sql
id, name, slug, type, subscription_plan,
created_at, updated_at, status, settings, billing_profile
```

### users
```sql
id, organization_id, email, password_hash, role,
first_name, last_name, phone, avatar, status,
last_login, created_at, updated_at
```

### roles
```sql
id, organization_id, name, permissions
```

### permissions
```sql
id, key, description
```

---

## Patient Tables

### patients
```sql
id, organization_id, assigned_therapist_id,
first_name, last_name, birth_date, gender,
phone, email, address, emergency_contact,
status, created_at, updated_at
```

### patient_profiles
```sql
id, patient_id, occupation, education,
relationship_status, children, living_situation, notes
```

### patient_history
```sql
id, patient_id, history_type, description,
created_by, created_at
```

### patient_files
```sql
id, patient_id, file_name, file_type,
storage_url, uploaded_by, created_at
```

---

## Mental Health Tables

### diagnoses
```sql
id, patient_id, diagnosis_code, diagnosis_name,
severity, status, diagnosed_at, notes
```

### symptoms
```sql
id, patient_id, symptom_name, severity, frequency, notes
```

### risk_assessments
```sql
id, patient_id, risk_level, self_harm_risk,
suicide_risk, violence_risk, substance_risk,
notes, review_date
```

---

## Medication System

### medications
```sql
id, patient_id, name, dosage, frequency,
prescriber, start_date, end_date, active, notes
```

### medication_events
```sql
id, medication_id, event_type, details, created_at
```

### medication_side_effects
```sql
id, patient_id, medication_id, effect, severity, notes
```

---

## Session Tables

### sessions
```sql
id, organization_id, patient_id, therapist_id,
session_type, session_status, scheduled_at,
started_at, ended_at, duration, price,
recording_enabled, created_at
```

### session_participants
```sql
id, session_id, user_id, role
```

### session_notes
```sql
id, session_id, author_id, note_content,
visibility, created_at
```

### session_transcripts
```sql
id, session_id, transcript_text, storage_url,
version, created_at
```

### transcript_segments
```sql
id, session_id, speaker, start_time, end_time,
text, confidence_score
```

---

## AI Scribe Tables

### ai_session_summaries
```sql
id, session_id, summary, generated_at
```

### ai_progress_notes
```sql
id, session_id, content, generated_at
```

### ai_dap_notes
```sql
id, session_id, content, generated_at
```

### ai_birp_notes
```sql
id, session_id, content, generated_at
```

### ai_soap_notes
```sql
id, session_id, content, generated_at
```

### ai_clinical_observations
```sql
id, session_id, observation, confidence, generated_at
```

---

## AI Memory Layer

One of the most valuable assets.

### patient_memory
```sql
id, patient_id, memory_type, memory_key,
memory_value, importance_score, created_at, updated_at
```

Memory examples:
- Recurring anxiety triggers
- Relationship conflicts
- Medication issues
- Sleep patterns
- Trauma events
- Major life events
- Treatment goals
- Behavior patterns

---

## Treatment Plan Tables

### treatment_plans
```sql
id, patient_id, title, description, status, created_at
```

### treatment_goals
```sql
id, plan_id, goal, target_date, progress, status
```

### treatment_tasks
```sql
id, plan_id, task, assigned_to, due_date, status
```

---

## Assessments

### assessment_templates
```sql
id, name, description, category
```

### assessment_results
```sql
id, patient_id, assessment_id, score, results, completed_at
```

**Supported:** PHQ-9 · GAD-7 · PCL-5 · AUDIT · Custom Assessments

---

## Radar System

### radar_requests
```sql
id, patient_id, anonymous_id, urgency, status,
language, country, requested_at
```

### radar_matches
```sql
id, request_id, therapist_id, status, response_time
```

### radar_sessions
```sql
id, match_id, session_id, created_at
```

---

## Notification System

### notifications
```sql
id, user_id, type, title, body, status, created_at
```

**Channels:** Email · SMS · Push · In-App · WhatsApp (future)

---

## Billing System

### subscriptions
```sql
id, organization_id, plan, status, billing_cycle, renewal_date
```

### transactions
```sql
id, organization_id, amount, currency, status, provider, reference
```

### session_fees
```sql
id, session_id, platform_fee, therapist_fee, net_amount
```

---

## API Platform

24Therapy should **expose** APIs, not just use them.

### API Categories
- Patients API · Sessions API · Reports API · Transcript API
- Radar API · AI Scribe API · AI Notes API · Scheduling API
- Billing API · Assessment API · Therapist API · Organization API · Analytics API

### Example Endpoints
```
POST /api/v1/sessions          → Create session
GET  /api/v1/patients          → Return patient records
POST /api/v1/transcribe        → Upload audio, return transcript
POST /api/v1/ai-summary        → Generate clinical summary
```

---

## SDK Strategy

- JavaScript SDK · TypeScript SDK · Python SDK
- Mobile SDK · Flutter SDK · React Native SDK

**Vision:** Any telehealth company can add "Powered by 24Therapy AI Scribe" with one integration.

---

## Audit Logging

### audit_logs
```sql
id, organization_id, user_id, action, resource,
resource_id, ip_address, timestamp, metadata
```

**Examples:** Viewed patient · Exported report · Deleted note · Created session · Changed medication · Downloaded transcript

**Nothing happens without logging.**

---

## Future Acquisition Strategy

Build platform as infrastructure. Potential acquirers care about:
- Patient network · Therapist network · AI infrastructure
- Mental health datasets · Clinical workflows · APIs
- Integrations · Enterprise adoption · Revenue · Recurring subscriptions

> **The goal is not to build a feature. The goal is to build the infrastructure layer for mental healthcare globally.**
