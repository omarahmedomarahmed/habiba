# 24Therapy.ai — Part 21: Complete Database Architecture (Volumes 1 & 2)
## Core Multi-Tenant Schema, User Architecture, Organizations, Sessions, AI Memory Infrastructure, Clinical Records & Workflow Systems

---

# VOLUME 1: CORE PLATFORM SCHEMA

## DATABASE PHILOSOPHY

Most startups design databases around screens. **Enterprise healthcare platforms design databases around reality.**

24Therapy must model: People | Organizations | Patients | Sessions | Clinical records | AI memory | Compliance | Billing | Marketplace activity

**The data model should survive for 10+ years.** The UI can change. The database is the foundation.

---

## DATABASE REQUIREMENTS (Scale Matrix)

| Deployment Type | Therapists | Patients |
|----------------|-----------|---------|
| Solo Therapist | 1 | 100 |
| Small Practice | 10 | 10,000 |
| Large Organization | 500 | Millions |
| White Label | Custom | Custom |
| Enterprise | Multiple orgs | Unlimited |

---

## DATABASE TYPE & EXTENSIONS

**Primary:** PostgreSQL

**Extensions required:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgvector";     -- Vector embeddings
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Column-level encryption
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Full-text search trigrams
```

---

## MULTI-TENANT ARCHITECTURE

**Critical design decision.** Every record belongs to an organization.

```
Platform
  └── Organization
        └── Users
        └── Therapists
        └── Patients
              └── Sessions
                    └── Transcripts
                    └── AI Notes
                    └── Memories
```

**Why this structure?**
- Supports: Solo Therapist → Practice → Enterprise without schema redesign
- Enables row-level security (RLS) in PostgreSQL
- Prevents cross-tenant data leakage
- Enables white-label deployments

---

## PRIMARY IDENTIFIERS

**Never use integer IDs. Use UUIDs everywhere.**

```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()
```

**Benefits:** Security | Scalability | Distributed systems | Merging | Replication | Acquisition readiness

---

## ORGANIZATIONS TABLE

```sql
CREATE TABLE organizations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(255) NOT NULL,
  legal_name       VARCHAR(255),
  slug             VARCHAR(100) UNIQUE NOT NULL,
  organization_type VARCHAR(50) DEFAULT 'solo',
    -- Values: solo, practice, clinic, hospital, university, enterprise, white_label
  country          VARCHAR(100),
  timezone         VARCHAR(100) DEFAULT 'UTC',
  currency         VARCHAR(10) DEFAULT 'USD',
  logo_url         TEXT,
  website          TEXT,
  primary_email    VARCHAR(255),
  primary_phone    VARCHAR(50),
  subscription_plan VARCHAR(50) DEFAULT 'free',
    -- Values: free, professional, practice, enterprise
  status           VARCHAR(50) DEFAULT 'active',
    -- Values: active, inactive, suspended
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);
```

---

## ORGANIZATION SETTINGS TABLE

```sql
CREATE TABLE organization_settings (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id           UUID UNIQUE NOT NULL REFERENCES organizations(id),
  brand_color               VARCHAR(10) DEFAULT '#0A2342',
  secondary_color           VARCHAR(10) DEFAULT '#1F5EFF',
  logo_url                  TEXT,
  favicon_url               TEXT,
  default_language          VARCHAR(20) DEFAULT 'en',
  default_timezone          VARCHAR(100) DEFAULT 'UTC',
  default_session_duration  INTEGER DEFAULT 50,
  allow_anonymous_sessions  BOOLEAN DEFAULT FALSE,
  enable_radar              BOOLEAN DEFAULT FALSE,
  enable_marketplace        BOOLEAN DEFAULT FALSE,
  enable_medication_module  BOOLEAN DEFAULT TRUE,
  enable_ai_memory          BOOLEAN DEFAULT TRUE,
  enable_api_access         BOOLEAN DEFAULT FALSE,
  enable_white_label        BOOLEAN DEFAULT FALSE,
  ai_note_format            VARCHAR(50) DEFAULT 'SOAP',
  retention_days_recordings INTEGER DEFAULT 365,
  retention_days_transcripts INTEGER DEFAULT 1825,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);
```

---

## USERS TABLE

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  email           VARCHAR(255) UNIQUE NOT NULL,
  phone           VARCHAR(50),
  password_hash   TEXT,
  auth_provider   VARCHAR(50) DEFAULT 'local',
    -- Values: local, google, microsoft, apple
  email_verified  BOOLEAN DEFAULT FALSE,
  phone_verified  BOOLEAN DEFAULT FALSE,
  mfa_enabled     BOOLEAN DEFAULT FALSE,
  mfa_secret      TEXT,  -- encrypted
  status          VARCHAR(50) DEFAULT 'pending',
    -- Values: active, inactive, suspended, pending, deleted
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_status ON users(status);
```

---

## USER PROFILES TABLE

```sql
CREATE TABLE user_profiles (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id),
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  avatar_url    TEXT,
  date_of_birth DATE,
  gender        VARCHAR(50),
  language      VARCHAR(20) DEFAULT 'en',
  timezone      VARCHAR(100) DEFAULT 'UTC',
  bio           TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ROLES & PERMISSIONS TABLES

```sql
CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  is_system       BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- System roles: super_admin, admin, manager, therapist, assistant, billing, support, patient

CREATE TABLE permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key         VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  category    VARCHAR(100)
);

-- Examples: view_patient, edit_patient, delete_patient, view_session, export_reports,
--           manage_billing, manage_team, manage_settings, view_recordings, view_transcripts,
--           manage_radar, view_analytics, manage_api_keys

CREATE TABLE role_permissions (
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id),
  role_id         UUID NOT NULL REFERENCES roles(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id, organization_id)
);
```

---

## THERAPIST PROFILES TABLE

```sql
CREATE TABLE therapists (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID UNIQUE NOT NULL REFERENCES users(id),
  organization_id          UUID NOT NULL REFERENCES organizations(id),
  license_number           VARCHAR(100),
  license_country          VARCHAR(100),
  license_verified         BOOLEAN DEFAULT FALSE,
  license_verified_at      TIMESTAMPTZ,
  specializations          TEXT[] DEFAULT '{}',
    -- Values: anxiety, depression, trauma, adhd, ocd, relationships, addiction, grief, stress, burnout
  languages                TEXT[] DEFAULT '{en}',
  years_experience         INTEGER,
  education                TEXT,
  bio                      TEXT,
  hourly_rate              DECIMAL(10,2),
  currency                 VARCHAR(10) DEFAULT 'USD',
  accepting_new_patients   BOOLEAN DEFAULT TRUE,
  radar_enabled            BOOLEAN DEFAULT FALSE,
  radar_response_time_avg  INTEGER,  -- seconds
  verified                 BOOLEAN DEFAULT FALSE,
  rating                   DECIMAL(3,2) DEFAULT 0.00,
  total_reviews            INTEGER DEFAULT 0,
  total_sessions           INTEGER DEFAULT 0,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE therapist_availability (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID NOT NULL REFERENCES therapists(id),
  weekday      INTEGER NOT NULL,  -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  timezone     VARCHAR(100) DEFAULT 'UTC',
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assistants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  manager_id      UUID REFERENCES therapists(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## PATIENTS TABLE

```sql
CREATE TABLE patients (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id        UUID NOT NULL REFERENCES organizations(id),
  primary_therapist_id   UUID REFERENCES therapists(id),
  user_id                UUID REFERENCES users(id),  -- if patient has account
  external_reference     VARCHAR(255),  -- for EHR imports
  first_name             VARCHAR(100) NOT NULL,
  last_name              VARCHAR(100) NOT NULL,
  date_of_birth          DATE,
  gender                 VARCHAR(50),
  email                  VARCHAR(255),
  phone                  VARCHAR(50),
  address                TEXT,
  city                   VARCHAR(100),
  country                VARCHAR(100),
  language               VARCHAR(20) DEFAULT 'en',
  status                 VARCHAR(50) DEFAULT 'active',
    -- Values: active, inactive, archived, transferred
  retention_date         DATE,  -- HIPAA retention
  archive_date           DATE,
  deletion_date          DATE,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  deleted_at             TIMESTAMPTZ
);

CREATE INDEX idx_patients_organization ON patients(organization_id);
CREATE INDEX idx_patients_therapist ON patients(primary_therapist_id);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);

-- Supporting tables
CREATE TABLE patient_preferences (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id             UUID UNIQUE NOT NULL REFERENCES patients(id),
  preferred_language     VARCHAR(20) DEFAULT 'en',
  preferred_session_type VARCHAR(50),  -- video, audio, chat, in_person
  allow_sms              BOOLEAN DEFAULT TRUE,
  allow_email            BOOLEAN DEFAULT TRUE,
  allow_phone            BOOLEAN DEFAULT FALSE,
  allow_notifications    BOOLEAN DEFAULT TRUE,
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_demographics (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id       UUID UNIQUE NOT NULL REFERENCES patients(id),
  occupation       VARCHAR(255),
  education_level  VARCHAR(100),
  marital_status   VARCHAR(50),
  household_size   INTEGER,
  income_bracket   VARCHAR(50),
  country_of_origin VARCHAR(100),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES patients(id),
  flag_type   VARCHAR(100) NOT NULL,
    -- Values: medication_management, requires_follow_up, high_priority, vip, inactive_risk, documentation_review
  flag_value  TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_tags (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id),
  tag        VARCHAR(100) NOT NULL,
  UNIQUE(patient_id, tag)
);

CREATE TABLE patient_files (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   UUID NOT NULL REFERENCES patients(id),
  uploaded_by  UUID REFERENCES users(id),
  file_name    VARCHAR(255) NOT NULL,
  file_type    VARCHAR(100),
  mime_type    VARCHAR(100),
  storage_url  TEXT NOT NULL,
  file_size    BIGINT,
  encrypted    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_import_jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  uploaded_by     UUID REFERENCES users(id),
  file_name       VARCHAR(255),
  status          VARCHAR(50) DEFAULT 'pending',
    -- Values: pending, processing, completed, failed
  rows_processed  INTEGER DEFAULT 0,
  rows_success    INTEGER DEFAULT 0,
  rows_failed     INTEGER DEFAULT 0,
  error_details   JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_relationships (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID NOT NULL REFERENCES patients(id),
  related_patient_id UUID REFERENCES patients(id),  -- if also a patient
  related_person_name VARCHAR(255),
  relationship_type VARCHAR(50),
    -- Values: parent, child, spouse, guardian, sibling, partner
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_status_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES patients(id),
  old_status  VARCHAR(50),
  new_status  VARCHAR(50) NOT NULL,
  changed_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_consents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   UUID NOT NULL REFERENCES patients(id),
  consent_type VARCHAR(100) NOT NULL,
    -- Values: privacy_policy, recording_consent, telehealth_consent, ai_assistance_consent, data_processing_consent
  version      VARCHAR(20) NOT NULL,
  accepted     BOOLEAN NOT NULL,
  accepted_at  TIMESTAMPTZ,
  ip_address   VARCHAR(50),
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

# VOLUME 2: SESSIONS, AI, CLINICAL WORKFLOW SCHEMA

## CLINICAL WORKFLOW PHILOSOPHY

**The entire platform revolves around one core object: Session**

```
Patient
  ↓ Session
  ↓ Transcript
  ↓ AI Processing
  ↓ Documentation
  ↓ Memory Updates
  ↓ Reports
  ↓ Treatment Updates
  ↓ Follow-ups
```

If the session architecture is designed correctly, almost everything else becomes easier.

---

## SESSIONS TABLE (Primary Clinical Object)

```sql
CREATE TABLE sessions (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id        UUID NOT NULL REFERENCES organizations(id),
  patient_id             UUID NOT NULL REFERENCES patients(id),
  therapist_id           UUID NOT NULL REFERENCES therapists(id),
  appointment_id         UUID,  -- FK to appointments table
  session_type           VARCHAR(50) NOT NULL DEFAULT 'therapy_session',
    -- Values: therapy_session, consultation, intake_session, follow_up,
    --         crisis_session, group_session, family_session, couples_session,
    --         assessment_session, medication_review, supervision_session
  session_mode           VARCHAR(50) DEFAULT 'video',
    -- Values: video, audio, chat, in_person
  status                 VARCHAR(50) DEFAULT 'scheduled',
    -- Values: draft, scheduled, confirmed, waiting, live, completed,
    --         processed, signed, archived, cancelled, no_show, refunded
  scheduled_at           TIMESTAMPTZ,
  started_at             TIMESTAMPTZ,
  ended_at               TIMESTAMPTZ,
  duration_minutes       INTEGER,
  session_title          VARCHAR(255),
  session_summary        TEXT,
  recording_enabled      BOOLEAN DEFAULT TRUE,
  transcription_enabled  BOOLEAN DEFAULT TRUE,
  ai_assistance_enabled  BOOLEAN DEFAULT TRUE,
  room_url               TEXT,  -- WebRTC room URL
  radar_id               UUID,  -- if from Radar instant match
  source                 VARCHAR(50) DEFAULT 'manual',
    -- Values: manual, radar, booking, import
  cancellation_reason    TEXT,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_organization ON sessions(organization_id);
CREATE INDEX idx_sessions_patient ON sessions(patient_id);
CREATE INDEX idx_sessions_therapist ON sessions(therapist_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_scheduled_at ON sessions(scheduled_at);

CREATE TABLE session_participants (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  role       VARCHAR(50) NOT NULL,
    -- Values: therapist, patient, observer, supervisor, interpreter
  joined_at  TIMESTAMPTZ,
  left_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE session_notes (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID NOT NULL REFERENCES sessions(id),
  therapist_id UUID NOT NULL REFERENCES therapists(id),
  content      TEXT NOT NULL,
  version      INTEGER DEFAULT 1,
  approved     BOOLEAN DEFAULT FALSE,
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE session_recordings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES sessions(id),
  recording_url    TEXT,
  storage_path     TEXT,
  duration_seconds INTEGER,
  file_size_bytes  BIGINT,
  encrypted        BOOLEAN DEFAULT TRUE,
  storage_provider VARCHAR(50) DEFAULT 'aws_s3',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TRANSCRIPT SYSTEM

```sql
CREATE TABLE transcripts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID UNIQUE NOT NULL REFERENCES sessions(id),
  language   VARCHAR(20) DEFAULT 'en',
  status     VARCHAR(50) DEFAULT 'processing',
    -- Values: processing, completed, failed
  model_used VARCHAR(100),  -- e.g., 'whisper-1'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Largest table in platform — partition by created_at
CREATE TABLE transcript_segments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcript_id   UUID NOT NULL REFERENCES transcripts(id),
  speaker         VARCHAR(100),  -- speaker label from diarization
  speaker_type    VARCHAR(50),   -- therapist, patient, ai, assistant
  text            TEXT NOT NULL,
  timestamp_start FLOAT NOT NULL,  -- seconds from start
  timestamp_end   FLOAT NOT NULL,
  confidence      FLOAT DEFAULT 1.0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE transcript_bookmarks (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id),
  timestamp  FLOAT NOT NULL,
  label      VARCHAR(255),
  notes      TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transcript_tags (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  segment_id    UUID NOT NULL REFERENCES transcript_segments(id),
  tag           VARCHAR(100),
    -- Examples: anxiety, trauma, medication, family, sleep, depression, risk
  confidence    FLOAT DEFAULT 1.0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## AI SESSION DOCUMENTATION

```sql
CREATE TABLE ai_session_notes (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id         UUID NOT NULL REFERENCES sessions(id),
  patient_id         UUID NOT NULL REFERENCES patients(id),
  therapist_id       UUID NOT NULL REFERENCES therapists(id),
  note_type          VARCHAR(50) NOT NULL,
    -- Values: SOAP, DAP, BIRP, custom, patient_summary, treatment_review, progress_note
  content            JSONB NOT NULL,  -- Structured note content
  raw_text           TEXT,            -- Plain text version
  version            INTEGER DEFAULT 1,
  status             VARCHAR(50) DEFAULT 'draft',
    -- Values: draft, reviewed, edited, approved, signed, archived
  prompt_key         VARCHAR(100),    -- Reference to prompt_registry
  model_used         VARCHAR(100),    -- e.g., 'gpt-4o'
  tokens_used        INTEGER,
  generation_time_ms INTEGER,
  therapist_edits    JSONB,           -- Track what therapist changed
  acceptance_type    VARCHAR(50),     -- accepted, minor_edit, major_edit, rejected
  signed_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_session_summaries (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id   UUID UNIQUE NOT NULL REFERENCES sessions(id),
  summary_text TEXT NOT NULL,
  key_themes   TEXT[],
  action_items TEXT[],
  model_used   VARCHAR(100),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ai_session_intelligence (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id      UUID NOT NULL REFERENCES sessions(id),
  topics          JSONB,   -- Array of topics discussed
  emotions        JSONB,   -- Emotional indicators detected
  risk_indicators JSONB,   -- Risk language flagged
  medications     JSONB,   -- Medications mentioned
  life_events     JSONB,   -- Life events disclosed
  goals           JSONB,   -- Goals mentioned or updated
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## PATIENT MEMORY SYSTEM (The Moat)

```sql
CREATE TABLE patient_memories (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id               UUID NOT NULL REFERENCES patients(id),
  therapist_id             UUID REFERENCES therapists(id),
  category                 VARCHAR(100) NOT NULL,
    -- Values: identity, clinical, behavioral, goals, relationships,
    --         events, preferences, symptoms, medications, treatment, strengths
  memory_text              TEXT NOT NULL,
  embedding                VECTOR(1536),  -- pgvector for semantic search
  importance_score         FLOAT DEFAULT 0.5,
  confidence_score         FLOAT DEFAULT 0.8,
  clinical_relevance_score FLOAT DEFAULT 0.5,
  recency_score            FLOAT DEFAULT 1.0,
  source_session_id        UUID REFERENCES sessions(id),
  status                   VARCHAR(50) DEFAULT 'active',
    -- Values: active, archived, reviewed, needs_review
  therapist_verified       BOOLEAN DEFAULT FALSE,
  tags                     TEXT[] DEFAULT '{}',
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memories_patient ON patient_memories(patient_id);
CREATE INDEX idx_memories_category ON patient_memories(category);
CREATE INDEX idx_memories_embedding ON patient_memories USING ivfflat (embedding vector_cosine_ops);

CREATE TABLE memory_links (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  memory_id         UUID NOT NULL REFERENCES patient_memories(id),
  linked_memory_id  UUID NOT NULL REFERENCES patient_memories(id),
  relationship_type VARCHAR(100),
    -- Values: causes, related_to, contradicts, updates, supports
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_timeline (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES patients(id),
  event_type  VARCHAR(100) NOT NULL,
    -- Values: session, diagnosis, assessment, medication, goal, life_event,
    --         report, file_upload, risk_event, medication_change
  reference_id UUID,  -- ID of the referenced object
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_timeline_patient ON patient_timeline(patient_id);
CREATE INDEX idx_timeline_occurred ON patient_timeline(occurred_at DESC);
```

---

## PROMPT REGISTRY TABLE

```sql
CREATE TABLE prompt_registry (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_key         VARCHAR(100) UNIQUE NOT NULL,
    -- Examples: SOAP_NOTE_V12, SESSION_SUMMARY_V5, MEMORY_EXTRACTION_V8
  prompt_text        TEXT NOT NULL,
  system_message     TEXT,
  purpose            TEXT,
  version            INTEGER DEFAULT 1,
  is_active          BOOLEAN DEFAULT TRUE,
  author_id          UUID REFERENCES users(id),
  acceptance_rate    FLOAT,
  edit_rate          FLOAT,
  rejection_rate     FLOAT,
  avg_tokens_used    INTEGER,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);
```

---

## AI COST TRACKING

```sql
CREATE TABLE ai_usage_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  session_id      UUID REFERENCES sessions(id),
  agent_type      VARCHAR(100),
    -- Values: transcription, documentation, memory, copilot, risk, matching
  model           VARCHAR(100),
  prompt_tokens   INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens    INTEGER DEFAULT 0,
  cost_usd        DECIMAL(10,6) DEFAULT 0,
  latency_ms      INTEGER,
  success         BOOLEAN DEFAULT TRUE,
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## APPOINTMENTS & SCHEDULING

```sql
CREATE TABLE appointments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  therapist_id    UUID NOT NULL REFERENCES therapists(id),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 50,
  session_type    VARCHAR(50) DEFAULT 'therapy_session',
  session_mode    VARCHAR(50) DEFAULT 'video',
  status          VARCHAR(50) DEFAULT 'pending',
    -- Values: pending, confirmed, completed, cancelled, no_show
  notes           TEXT,
  reminder_sent   BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## TREATMENT PLANS & GOALS

```sql
CREATE TABLE treatment_plans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID NOT NULL REFERENCES patients(id),
  therapist_id    UUID NOT NULL REFERENCES therapists(id),
  title           VARCHAR(255),
  description     TEXT,
  approach        VARCHAR(100),  -- CBT, DBT, ACT, EMDR, etc.
  status          VARCHAR(50) DEFAULT 'active',
  start_date      DATE,
  end_date        DATE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE treatment_goals (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id          UUID NOT NULL REFERENCES treatment_plans(id),
  title            VARCHAR(255) NOT NULL,
  description      TEXT,
  target_date      DATE,
  status           VARCHAR(50) DEFAULT 'pending',
    -- Values: pending, active, completed, paused, abandoned
  progress_percent INTEGER DEFAULT 0,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
```

---

## ASSESSMENTS

```sql
CREATE TABLE assessment_templates (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type_key    VARCHAR(100) UNIQUE NOT NULL,  -- PHQ-9, GAD-7, PCL-5, etc.
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  is_standard BOOLEAN DEFAULT TRUE,  -- FALSE for custom
  scoring_formula TEXT,
  max_score   INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assessment_questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     UUID NOT NULL REFERENCES assessment_templates(id),
  question_text   TEXT NOT NULL,
  display_order   INTEGER NOT NULL,
  scale_min       INTEGER DEFAULT 0,
  scale_max       INTEGER DEFAULT 3,
  scale_labels    JSONB
);

CREATE TABLE assessment_results (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id     UUID NOT NULL REFERENCES patients(id),
  session_id     UUID REFERENCES sessions(id),
  template_id    UUID NOT NULL REFERENCES assessment_templates(id),
  status         VARCHAR(50) DEFAULT 'pending',
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  total_score    FLOAT,
  interpretation VARCHAR(255),
  administered_by UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assessment_answers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  result_id     UUID NOT NULL REFERENCES assessment_results(id),
  question_id   UUID NOT NULL REFERENCES assessment_questions(id),
  answer_value  INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## MEDICATIONS

```sql
CREATE TABLE patient_medications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES patients(id),
  name          VARCHAR(255) NOT NULL,
  dosage        VARCHAR(100),
  frequency     VARCHAR(100),
  route         VARCHAR(100),  -- oral, injection, etc.
  prescribed_by VARCHAR(255),
  prescriber_type VARCHAR(50),  -- psychiatrist, gp, specialist
  start_date    DATE,
  end_date      DATE,
  is_active     BOOLEAN DEFAULT TRUE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE medication_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id UUID NOT NULL REFERENCES patient_medications(id),
  field_changed VARCHAR(100),
  old_value     TEXT,
  new_value     TEXT,
  changed_by    UUID REFERENCES users(id),
  change_reason TEXT,
  changed_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## RISK ASSESSMENT SYSTEM

```sql
CREATE TABLE risk_assessments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  UUID NOT NULL REFERENCES patients(id),
  session_id  UUID REFERENCES sessions(id),
  risk_type   VARCHAR(100) NOT NULL,
    -- Values: self_harm, suicidal_ideation, violence, substance_abuse, crisis, self_neglect
  score       FLOAT,
  severity    VARCHAR(50),
    -- Values: low, moderate, high, critical
  indicators  TEXT[],  -- Specific language/behaviors detected
  notes       TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE risk_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID NOT NULL REFERENCES patients(id),
  assessment_id UUID REFERENCES risk_assessments(id),
  status        VARCHAR(50) DEFAULT 'open',
    -- Values: open, reviewing, escalated, resolved, closed
  assigned_to   UUID REFERENCES users(id),
  resolution    TEXT,
  resolved      BOOLEAN DEFAULT FALSE,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## AUDIT LOG (Immutable — Append Only)

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  action          VARCHAR(255) NOT NULL,
    -- Examples: patient.viewed, session.created, report.approved, file.downloaded
  resource_type   VARCHAR(100) NOT NULL,
  resource_id     UUID,
  old_value       JSONB,
  new_value       JSONB,
  ip_address      VARCHAR(50),
  user_agent      TEXT,
  session_id      TEXT,  -- HTTP session, not therapy session
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- IMPORTANT: No UPDATE or DELETE permissions on this table
-- Row-level security prevents all modifications
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_organization ON audit_logs(organization_id);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
```

---

## DATABASE SCALE & PARTITIONING

### Partition strategy for large tables

```sql
-- transcript_segments: partition by month
CREATE TABLE transcript_segments_2024_01 PARTITION OF transcript_segments
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- audit_logs: partition by quarter
CREATE TABLE audit_logs_2024_q1 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
```

### Scale projections

| Year | Sessions | Transcript Segments | Memories |
|------|---------|-------------------|---------|
| Year 1 | 100K | 50M | 5M |
| Year 3 | 10M | 5B | 500M |
| Year 5 | 100M | 50B | 5B |

**Schema must support growth from Day 1 without redesign.**

---

## STRATEGIC VALUE SUMMARY

**Most competitors store notes. 24Therapy stores everything:**

- Notes + Sessions + Memory + Relationships + Progress
- Patterns + Outcomes + Clinical Intelligence
- Behavioral Intelligence + Operational Intelligence

**This database becomes one of the most valuable assets of the company and one of the primary reasons a future acquirer would pay a premium for 24Therapy.**
