# 24Therapy.ai — Part 12: Complete Enterprise Database Architecture, Data Model, Relationships, AI Memory Infrastructure, Clinical Records System & Multi-Tenant Platform Schema

## DATABASE PHILOSOPHY

The database is not merely storage. **It is the foundation of the company.**

Most startups fail because they design databases around screens. 24Therapy must design its database around:
- Patient journeys
- Clinical workflows
- AI memory
- Multi-tenancy
- Compliance
- Future acquisitions
- API-first architecture

---

## DATABASE REQUIREMENTS

Must support:
- Millions of patients
- Millions of sessions
- Billions of transcript entries
- Multi-country deployment
- HIPAA compliance
- GDPR compliance
- Enterprise organizations
- White-label deployments
- API integrations
- AI memory systems

---

## DATABASE ARCHITECTURE

**Primary Database:** PostgreSQL

**Why PostgreSQL:**
- ACID compliance
- Healthcare-grade reliability
- Strong ecosystem
- JSON support
- Partitioning & replication
- Vector support (pgvector)

### Database Layers

| Layer | Purpose |
|-------|---------|
| Layer 1 | Transactional Data |
| Layer 2 | Analytics Data Warehouse |
| Layer 3 | AI Memory Store |
| Layer 4 | Vector Knowledge Layer |
| Layer 5 | Audit Archive |

---

## MULTI-TENANT MODEL

Every record belongs to:
```
Organization
  └── Practice
        └── Therapist
              └── Patient
                    └── Session
```

No cross-tenant leakage possible.

---

## CORE TABLES

### organizations
Stores practices, clinics, hospitals.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID PK | Primary identifier |
| name | VARCHAR | Display name |
| legal_name | VARCHAR | Legal entity name |
| organization_type | ENUM | solo/practice/clinic/hospital/university/enterprise/white_label |
| slug | VARCHAR UNIQUE | URL identifier |
| logo_url | TEXT | Brand logo |
| website | TEXT | Organization website |
| primary_email | VARCHAR | Main contact email |
| primary_phone | VARCHAR | Main phone |
| country | VARCHAR | Country of operation |
| timezone | VARCHAR | Default timezone |
| currency | VARCHAR | Billing currency |
| subscription_plan | ENUM | free/professional/practice/enterprise |
| status | ENUM | active/inactive/suspended |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | Soft delete |

**Indexes:** slug, subscription_plan, status

### organization_settings
Stores per-organization configuration.

| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| brand_color | VARCHAR |
| secondary_color | VARCHAR |
| logo_url | TEXT |
| favicon_url | TEXT |
| default_language | VARCHAR |
| default_timezone | VARCHAR |
| default_session_duration | INTEGER |
| allow_anonymous_sessions | BOOLEAN |
| enable_radar | BOOLEAN |
| enable_marketplace | BOOLEAN |
| enable_medication_module | BOOLEAN |
| enable_ai_memory | BOOLEAN |
| enable_api_access | BOOLEAN |
| enable_white_label | BOOLEAN |
| created_at | TIMESTAMP |
| updated_at | TIMESTAMP |

---

## USERS

### users
Master authentication table.

| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| email | VARCHAR UNIQUE |
| phone | VARCHAR |
| password_hash | TEXT |
| auth_provider | ENUM | local/google/microsoft |
| email_verified | BOOLEAN |
| phone_verified | BOOLEAN |
| mfa_enabled | BOOLEAN |
| status | ENUM | active/inactive/suspended/pending/deleted |
| last_login_at | TIMESTAMP |
| created_at | TIMESTAMP |
| updated_at | TIMESTAMP |

### user_profiles
| Field | Type |
|-------|------|
| user_id | UUID FK |
| first_name | VARCHAR |
| last_name | VARCHAR |
| avatar_url | TEXT |
| date_of_birth | DATE |
| gender | VARCHAR |
| language | VARCHAR |
| timezone | VARCHAR |
| bio | TEXT |

### roles
| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| name | VARCHAR |
| description | TEXT |
| is_system | BOOLEAN |
| created_at | TIMESTAMP |

**System roles:** patient | therapist | assistant | manager | admin | super_admin | billing | support

### permissions
| Field | Type |
|-------|------|
| id | UUID PK |
| key | VARCHAR UNIQUE |
| description | TEXT |
| category | VARCHAR |

**Examples:** view_patient | edit_patient | delete_patient | view_session | export_reports | manage_billing | manage_team | manage_settings | view_recordings | view_transcripts

### role_permissions
```sql
role_id UUID FK → roles
permission_id UUID FK → permissions
```

### user_roles
```sql
user_id UUID FK → users
role_id UUID FK → roles
organization_id UUID FK → organizations
```

Supports multiple roles per user.

---

## PATIENT SYSTEM

### patients
One of the largest tables.

| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| primary_therapist_id | UUID FK |
| external_reference | VARCHAR |
| first_name | VARCHAR |
| last_name | VARCHAR |
| date_of_birth | DATE |
| gender | VARCHAR |
| email | VARCHAR |
| phone | VARCHAR |
| address | TEXT |
| city | VARCHAR |
| country | VARCHAR |
| language | VARCHAR |
| status | ENUM | active/inactive/archived/transferred |
| created_at | TIMESTAMP |
| updated_at | TIMESTAMP |
| deleted_at | TIMESTAMP |

### patient_emergency_contacts
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| name | VARCHAR |
| relationship | VARCHAR |
| phone | VARCHAR |
| email | VARCHAR |
| notes | TEXT |

### patient_tags
| Field | Type |
|-------|------|
| patient_id | UUID FK |
| tag | VARCHAR |

**Examples:** ADHD | Anxiety | PTSD | High Risk | VIP | Student | Executive | Referral

### patient_relationships
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| related_person_name | VARCHAR |
| relationship_type | VARCHAR |
| notes | TEXT |

**Relationship types:** Mother | Father | Spouse | Partner | Child | Friend

---

## PATIENT HEALTH SYSTEM

### diagnoses
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| icd_code | VARCHAR |
| name | VARCHAR |
| status | ENUM | active/resolved/in_remission |
| diagnosed_date | DATE |
| resolved_date | DATE |
| notes | TEXT |

### symptoms
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| name | VARCHAR |
| severity | INTEGER | 1-10 scale |
| frequency | VARCHAR |
| status | ENUM | active/resolved |
| created_at | TIMESTAMP |

### medications
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| name | VARCHAR |
| dosage | VARCHAR |
| frequency | VARCHAR |
| prescribed_by | VARCHAR |
| start_date | DATE |
| end_date | DATE |
| is_active | BOOLEAN |
| notes | TEXT |

### medication_history
Tracks every medication change.

| Field | Type |
|-------|------|
| id | UUID PK |
| medication_id | UUID FK |
| old_value | JSONB |
| new_value | JSONB |
| changed_by | UUID FK |
| changed_at | TIMESTAMP |

### allergies
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| allergy | VARCHAR |
| severity | ENUM | mild/moderate/severe |
| notes | TEXT |

### treatment_plans
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| therapist_id | UUID FK |
| title | VARCHAR |
| description | TEXT |
| status | ENUM | active/completed/paused |
| start_date | DATE |
| end_date | DATE |
| created_at | TIMESTAMP |

### treatment_goals
| Field | Type |
|-------|------|
| id | UUID PK |
| plan_id | UUID FK |
| title | VARCHAR |
| description | TEXT |
| target_date | DATE |
| status | ENUM | pending/active/completed |
| progress_percent | INTEGER |

---

## SESSIONS

### sessions
Most critical table.

| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| patient_id | UUID FK |
| therapist_id | UUID FK |
| appointment_id | UUID FK |
| session_type | ENUM | therapy/consultation/intake/follow_up/crisis/group/family/couples/assessment/medication_review |
| session_mode | ENUM | video/audio/chat/in_person |
| status | ENUM | draft/scheduled/confirmed/waiting/live/completed/processed/signed/archived/cancelled/no_show |
| scheduled_at | TIMESTAMP |
| started_at | TIMESTAMP |
| ended_at | TIMESTAMP |
| duration_minutes | INTEGER |
| recording_enabled | BOOLEAN |
| transcription_enabled | BOOLEAN |
| ai_assistance_enabled | BOOLEAN |
| radar_id | UUID FK |
| created_at | TIMESTAMP |
| updated_at | TIMESTAMP |

### session_participants
| Field | Type |
|-------|------|
| id | UUID PK |
| session_id | UUID FK |
| user_id | UUID FK |
| role | ENUM | therapist/patient/observer/supervisor |
| joined_at | TIMESTAMP |
| left_at | TIMESTAMP |

### session_notes
| Field | Type |
|-------|------|
| id | UUID PK |
| session_id | UUID FK |
| therapist_id | UUID FK |
| content | TEXT |
| version | INTEGER |
| approved | BOOLEAN |
| approved_at | TIMESTAMP |
| created_at | TIMESTAMP |

### session_recordings
| Field | Type |
|-------|------|
| id | UUID PK |
| session_id | UUID FK |
| recording_url | TEXT |
| duration_seconds | INTEGER |
| file_size_bytes | BIGINT |
| storage_location | VARCHAR |
| encrypted | BOOLEAN |
| created_at | TIMESTAMP |

---

## TRANSCRIPT SYSTEM

### transcripts
| Field | Type |
|-------|------|
| id | UUID PK |
| session_id | UUID FK |
| language | VARCHAR |
| status | ENUM | processing/completed/failed |
| created_at | TIMESTAMP |

### transcript_segments
Largest table in platform.

| Field | Type |
|-------|------|
| id | UUID PK |
| transcript_id | UUID FK |
| speaker | VARCHAR |
| speaker_type | ENUM | patient/therapist/ai/assistant |
| text | TEXT |
| timestamp_start | FLOAT |
| timestamp_end | FLOAT |
| confidence | FLOAT |
| created_at | TIMESTAMP |

### transcript_bookmarks
| Field | Type |
|-------|------|
| id | UUID PK |
| session_id | UUID FK |
| timestamp | FLOAT |
| label | VARCHAR |
| notes | TEXT |

### transcript_tags
| Field | Type |
|-------|------|
| id | UUID PK |
| segment_id | UUID FK |
| tag | VARCHAR |
| confidence | FLOAT |

**Tag examples:** Anxiety | Trauma | Medication | Family | Sleep | Depression

---

## AI MEMORY SYSTEM (The Future Moat)

### patient_memories
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| category | ENUM | identity/clinical/behavioral/goals/relationships/events/preferences |
| memory_text | TEXT |
| embedding | VECTOR(1536) |
| importance_score | FLOAT |
| confidence_score | FLOAT |
| clinical_relevance_score | FLOAT |
| recency_score | FLOAT |
| source_session_id | UUID FK |
| status | ENUM | active/archived/reviewed |
| created_at | TIMESTAMP |
| updated_at | TIMESTAMP |

### memory_links
Allows memory graph creation.

| Field | Type |
|-------|------|
| id | UUID PK |
| memory_id | UUID FK |
| linked_memory_id | UUID FK |
| relationship_type | VARCHAR |

### patient_timeline
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| event_type | VARCHAR |
| reference_id | UUID |
| title | VARCHAR |
| description | TEXT |
| occurred_at | TIMESTAMP |
| created_at | TIMESTAMP |

---

## AI INSIGHTS

### ai_insights
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| session_id | UUID FK |
| type | ENUM | risk/pattern/progress/medication/behavior |
| title | VARCHAR |
| description | TEXT |
| confidence | FLOAT |
| reviewed | BOOLEAN |
| created_at | TIMESTAMP |

### ai_recommendations
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| session_id | UUID FK |
| recommendation | TEXT |
| confidence | FLOAT |
| status | ENUM | pending/accepted/rejected |
| created_at | TIMESTAMP |

---

## RISK SYSTEM

### risk_assessments
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| session_id | UUID FK |
| risk_type | ENUM | self_harm/suicidal_ideation/violence/substance_abuse/crisis |
| score | FLOAT |
| severity | ENUM | low/moderate/high/critical |
| notes | TEXT |
| created_at | TIMESTAMP |

### risk_events
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| assessment_id | UUID FK |
| status | ENUM | open/reviewing/resolved |
| assigned_to | UUID FK |
| resolved | BOOLEAN |
| resolved_at | TIMESTAMP |
| created_at | TIMESTAMP |

---

## ASSESSMENTS

### assessments
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| session_id | UUID FK |
| type | VARCHAR | PHQ-9/GAD-7/PCL-5/AUDIT/DAST/ASRS/WHO-5/custom |
| status | ENUM | pending/in_progress/completed |
| started_at | TIMESTAMP |
| completed_at | TIMESTAMP |
| score | FLOAT |
| interpretation | TEXT |
| created_at | TIMESTAMP |

### assessment_questions
| Field | Type |
|-------|------|
| id | UUID PK |
| assessment_type | VARCHAR |
| question_text | TEXT |
| display_order | INTEGER |
| scale_min | INTEGER |
| scale_max | INTEGER |

### assessment_answers
| Field | Type |
|-------|------|
| id | UUID PK |
| assessment_id | UUID FK |
| question_id | UUID FK |
| answer_value | INTEGER |
| answer_text | TEXT |

---

## FILE MANAGEMENT

### files
| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| patient_id | UUID FK |
| session_id | UUID FK |
| uploaded_by | UUID FK |
| file_name | VARCHAR |
| file_type | VARCHAR |
| mime_type | VARCHAR |
| file_size_bytes | BIGINT |
| storage_path | TEXT |
| encrypted | BOOLEAN |
| created_at | TIMESTAMP |

---

## REPORTS

### reports
| Field | Type |
|-------|------|
| id | UUID PK |
| session_id | UUID FK |
| patient_id | UUID FK |
| therapist_id | UUID FK |
| type | ENUM | SOAP/DAP/BIRP/custom/patient_summary/treatment_review |
| content | JSONB |
| version | INTEGER |
| status | ENUM | draft/reviewed/signed/archived |
| signed_at | TIMESTAMP |
| created_at | TIMESTAMP |

---

## BILLING

### invoices
| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| patient_id | UUID FK |
| amount | DECIMAL |
| currency | VARCHAR |
| status | ENUM | draft/sent/paid/overdue/cancelled |
| issued_at | TIMESTAMP |
| paid_at | TIMESTAMP |

### payments
| Field | Type |
|-------|------|
| id | UUID PK |
| invoice_id | UUID FK |
| provider | VARCHAR | stripe/paypal/manual |
| provider_payment_id | VARCHAR |
| amount | DECIMAL |
| currency | VARCHAR |
| status | ENUM | pending/completed/failed/refunded |
| created_at | TIMESTAMP |

### subscriptions
| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| plan | ENUM | free/professional/practice/enterprise |
| status | ENUM | trial/active/past_due/suspended/cancelled |
| trial_ends_at | TIMESTAMP |
| renewal_date | TIMESTAMP |
| created_at | TIMESTAMP |

---

## RADAR SYSTEM

### radar_requests
| Field | Type |
|-------|------|
| id | UUID PK |
| patient_id | UUID FK |
| urgency | ENUM | low/medium/high/emergency |
| language | VARCHAR |
| specializations | JSONB |
| budget | DECIMAL |
| status | ENUM | pending/matched/accepted/expired |
| created_at | TIMESTAMP |

### radar_matches
| Field | Type |
|-------|------|
| id | UUID PK |
| request_id | UUID FK |
| therapist_id | UUID FK |
| match_score | FLOAT |
| accepted | BOOLEAN |
| accepted_at | TIMESTAMP |
| created_at | TIMESTAMP |

---

## COMMUNICATIONS

### conversations
| Field | Type |
|-------|------|
| id | UUID PK |
| type | ENUM | patient_therapist/internal/support |
| created_at | TIMESTAMP |

### messages
| Field | Type |
|-------|------|
| id | UUID PK |
| conversation_id | UUID FK |
| sender_id | UUID FK |
| content | TEXT |
| read | BOOLEAN |
| created_at | TIMESTAMP |

---

## NOTIFICATIONS

### notifications
| Field | Type |
|-------|------|
| id | UUID PK |
| user_id | UUID FK |
| type | VARCHAR |
| title | VARCHAR |
| body | TEXT |
| read | BOOLEAN |
| action_url | TEXT |
| created_at | TIMESTAMP |

---

## AUDIT SYSTEM (Required for Compliance)

### audit_logs
| Field | Type |
|-------|------|
| id | UUID PK |
| user_id | UUID FK |
| organization_id | UUID FK |
| action | VARCHAR |
| resource_type | VARCHAR |
| resource_id | UUID |
| old_value | JSONB |
| new_value | JSONB |
| ip_address | VARCHAR |
| user_agent | TEXT |
| created_at | TIMESTAMP |

**Every change recorded. Append-only. No updates or deletes allowed.**

---

## API SYSTEM

### api_keys
| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| name | VARCHAR |
| hashed_key | TEXT |
| permissions | JSONB |
| last_used_at | TIMESTAMP |
| created_at | TIMESTAMP |

### webhooks
| Field | Type |
|-------|------|
| id | UUID PK |
| organization_id | UUID FK |
| url | TEXT |
| events | JSONB |
| secret | TEXT |
| active | BOOLEAN |
| created_at | TIMESTAMP |

---

## EVENT SYSTEM

### events
| Field | Type |
|-------|------|
| id | UUID PK |
| event_type | VARCHAR |
| payload | JSONB |
| created_at | TIMESTAMP |
| processed_at | TIMESTAMP |

**Event types:** SessionStarted | PatientCreated | ReportGenerated | PaymentCompleted | RadarMatched

---

## ANALYTICS WAREHOUSE TABLES

Separate environment (data warehouse):

**Fact Tables:** Fact_Sessions | Fact_Patients | Fact_Revenue | Fact_Usage | Fact_AICosts | Fact_Assessments | Fact_Outcomes

**Dimension Tables:** Dim_Date | Dim_Organization | Dim_Therapist | Dim_Patient | Dim_Country | Dim_Plan

---

## VECTOR DATABASE

**Used for:**
- Patient memory embeddings
- Transcript embeddings
- Report embeddings
- Knowledge embeddings

**Supports semantic search via pgvector.**

---

## FUTURE HEALTHCARE INTEROPERABILITY

Additional tables reserved for:
- FHIR Resources
- HL7 Messages
- Insurance Claims
- Prescriptions
- Lab Results
- Hospital Systems
- External EHR Integrations

---

## DATABASE SCALE TARGETS

| Year | Sessions |
|------|---------|
| Year 1 | 100K sessions |
| Year 3 | 10M sessions |
| Year 5 | 100M+ sessions |

---

## STRATEGIC VALUE

Most competitors store notes. **24Therapy stores:**

Notes | Sessions | Memory | Relationships | Progress | Patterns | Outcomes | Clinical Intelligence | Behavioral Intelligence | Operational Intelligence

**This database becomes one of the most valuable assets of the company and one of the primary reasons a future acquirer would pay a premium.**
