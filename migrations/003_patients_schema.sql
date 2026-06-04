-- ============================================================
-- 24Therapy.ai — Migration 003: Patients Schema
-- Patients, Profiles, Contacts, Consents, Files, Timeline,
-- Goals, Mood, Life Events, Relationships, Journal
-- ============================================================

-- ============================================================
-- PATIENTS (most important entity)
-- ============================================================
CREATE TABLE patients (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    primary_therapist_id    UUID REFERENCES therapists(id) ON DELETE SET NULL,
    user_id                 UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,  -- if patient has portal login
    external_patient_id     VARCHAR(100),   -- EHR or external system ID
    first_name              VARCHAR(100) NOT NULL,
    last_name               VARCHAR(100),
    preferred_name          VARCHAR(100),
    date_of_birth           DATE,
    gender                  VARCHAR(50),
    pronouns                VARCHAR(50),
    email                   VARCHAR(255),
    phone                   VARCHAR(50),
    address                 JSONB DEFAULT '{}',    -- {street, city, state, country, postal_code}
    emergency_contact       JSONB DEFAULT '{}',    -- {name, relationship, phone, email}
    status                  VARCHAR(50) NOT NULL DEFAULT 'active',
    anonymous_mode          BOOLEAN NOT NULL DEFAULT FALSE,
    on_medication           BOOLEAN NOT NULL DEFAULT FALSE,
    source                  VARCHAR(50),           -- 'referral', 'marketplace', 'radar', 'manual', 'import'
    referring_therapist_id  UUID REFERENCES therapists(id),
    intake_completed_at     TIMESTAMPTZ,
    last_session_at         TIMESTAMPTZ,
    total_sessions          INTEGER NOT NULL DEFAULT 0,
    tags                    TEXT[] DEFAULT '{}',   -- high_risk, vip, follow_up, etc.
    notes                   TEXT,                  -- private therapist notes
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    
    CONSTRAINT patients_status_check CHECK (
        status IN ('active', 'inactive', 'discharged', 'waitlist', 'on_hold')
    )
);

CREATE INDEX idx_patients_org ON patients(organization_id);
CREATE INDEX idx_patients_primary_therapist ON patients(primary_therapist_id);
CREATE INDEX idx_patients_user ON patients(user_id);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_tags ON patients USING GIN(tags);
CREATE INDEX idx_patients_deleted ON patients(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_last_session ON patients(last_session_at);

-- ============================================================
-- PATIENT PROFILES (extended demographics)
-- ============================================================
CREATE TABLE patient_profiles (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
    occupation          VARCHAR(200),
    employer            VARCHAR(200),
    relationship_status VARCHAR(50),
    has_children        BOOLEAN,
    number_of_children  SMALLINT,
    education_level     VARCHAR(100),
    living_situation    VARCHAR(100),
    religion            VARCHAR(100),
    nationality         VARCHAR(100),
    insurance_provider  VARCHAR(200),
    insurance_number    VARCHAR(100),
    insurance_info      JSONB DEFAULT '{}',
    medical_history     JSONB DEFAULT '[]',        -- Array of conditions
    allergies           TEXT[] DEFAULT '{}',
    additional_notes    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- THERAPIST-PATIENT ASSIGNMENTS (many-to-many)
-- ============================================================
CREATE TABLE therapist_patient_assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id    UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    role            VARCHAR(50) DEFAULT 'primary',
    assigned_by     UUID REFERENCES users(id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    notes           TEXT,
    
    CONSTRAINT assignment_role_check CHECK (role IN ('primary', 'secondary', 'consulting', 'supervisor')),
    UNIQUE(therapist_id, patient_id)
);

CREATE INDEX idx_assignments_therapist ON therapist_patient_assignments(therapist_id);
CREATE INDEX idx_assignments_patient ON therapist_patient_assignments(patient_id);

-- ============================================================
-- PATIENT CONTACTS
-- ============================================================
CREATE TABLE patient_contacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    relationship    VARCHAR(100),
    name            VARCHAR(200) NOT NULL,
    phone           VARCHAR(50),
    email           VARCHAR(255),
    is_emergency    BOOLEAN NOT NULL DEFAULT FALSE,
    is_authorized   BOOLEAN NOT NULL DEFAULT FALSE,    -- Authorized to receive info
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_contacts_patient ON patient_contacts(patient_id);

-- ============================================================
-- PATIENT CONSENTS (HIPAA/GDPR)
-- ============================================================
CREATE TABLE patient_consents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    consent_type    VARCHAR(100) NOT NULL,    -- 'therapy', 'recording', 'ai_scribe', 'data_processing', 'marketing'
    version         VARCHAR(20) NOT NULL,     -- Document version
    granted         BOOLEAN NOT NULL DEFAULT TRUE,
    accepted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    withdrawn_at    TIMESTAMPTZ,
    ip_address      VARCHAR(45),
    evidence_url    VARCHAR(1000),            -- Signed document URL
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consents_patient ON patient_consents(patient_id);
CREATE INDEX idx_consents_type ON patient_consents(consent_type, patient_id);

-- ============================================================
-- PATIENT FILES
-- ============================================================
CREATE TABLE patient_files (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    session_id      UUID,                    -- Will reference sessions(id) after migration 006
    file_name       VARCHAR(255) NOT NULL,
    file_url        VARCHAR(1000) NOT NULL,   -- Encrypted S3 URL
    file_type       VARCHAR(100),            -- MIME type
    file_size_bytes INTEGER,
    category        VARCHAR(50),             -- 'referral', 'assessment', 'report', 'intake', 'other'
    description     TEXT,
    uploaded_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_files_patient ON patient_files(patient_id);

-- ============================================================
-- PATIENT TIMELINE EVENTS
-- ============================================================
CREATE TABLE patient_timeline_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    event_type      VARCHAR(100) NOT NULL,   -- 'session_completed', 'medication_changed', 'assessment_completed', etc.
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    metadata        JSONB DEFAULT '{}',      -- Context-specific data
    reference_id    UUID,                    -- FK to related entity (session, assessment, etc.)
    reference_type  VARCHAR(50),             -- 'session', 'assessment', 'medication', etc.
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeline_patient ON patient_timeline_events(patient_id);
CREATE INDEX idx_timeline_type ON patient_timeline_events(event_type, patient_id);
CREATE INDEX idx_timeline_created ON patient_timeline_events(patient_id, created_at DESC);

-- ============================================================
-- PATIENT GOALS
-- ============================================================
CREATE TABLE patient_goals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    therapist_id    UUID REFERENCES therapists(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(50),             -- 'symptom', 'functioning', 'relationship', 'behavioral', etc.
    status          VARCHAR(50) DEFAULT 'active',
    priority        VARCHAR(20) DEFAULT 'medium',
    target_date     DATE,
    progress_score  INTEGER DEFAULT 0,       -- 0-100
    completed_at    TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT goal_status_check CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
    CONSTRAINT goal_priority_check CHECK (priority IN ('low', 'medium', 'high'))
);

CREATE INDEX idx_goals_patient ON patient_goals(patient_id);
CREATE INDEX idx_goals_status ON patient_goals(status, patient_id);

-- ============================================================
-- GOAL PROGRESS UPDATES
-- ============================================================
CREATE TABLE goal_progress_updates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id         UUID NOT NULL REFERENCES patient_goals(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES patients(id),
    note            TEXT,
    progress_score  INTEGER,                 -- 0-100
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_progress_goal ON goal_progress_updates(goal_id);

-- ============================================================
-- PATIENT MOOD TRACKING
-- ============================================================
CREATE TABLE patient_mood_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    score           SMALLINT NOT NULL,           -- 1-10
    emotions        TEXT[] DEFAULT '{}',          -- e.g. ['anxious', 'sad', 'hopeful']
    notes           TEXT,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source          VARCHAR(50) DEFAULT 'manual', -- 'manual', 'app', 'ai_companion'
    
    CONSTRAINT mood_score_range CHECK (score BETWEEN 1 AND 10)
);

CREATE INDEX idx_mood_patient ON patient_mood_entries(patient_id);
CREATE INDEX idx_mood_recorded ON patient_mood_entries(patient_id, recorded_at DESC);

-- ============================================================
-- PATIENT LIFE EVENTS
-- ============================================================
CREATE TABLE patient_life_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id),
    event_type      VARCHAR(100) NOT NULL,    -- 'marriage', 'divorce', 'job_loss', 'bereavement', 'move', etc.
    title           VARCHAR(255),
    description     TEXT,
    event_date      DATE,
    impact_level    VARCHAR(20) DEFAULT 'medium',
    is_positive     BOOLEAN,
    ai_extracted    BOOLEAN DEFAULT FALSE,    -- Extracted by AI from session
    source_session_id UUID,                  -- Will reference sessions
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT life_event_impact_check CHECK (impact_level IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX idx_life_events_patient ON patient_life_events(patient_id);

-- ============================================================
-- PATIENT RELATIONSHIPS (for AI context)
-- ============================================================
CREATE TABLE patient_relationships (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    relationship_type   VARCHAR(50) NOT NULL,    -- 'parent', 'partner', 'child', 'sibling', 'employer', 'friend'
    person_name         VARCHAR(200),
    person_age          INTEGER,
    notes               TEXT,
    ai_extracted        BOOLEAN DEFAULT FALSE,
    source_session_id   UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_relationships_patient ON patient_relationships(patient_id);

-- ============================================================
-- PATIENT JOURNAL ENTRIES (future patient-facing feature)
-- ============================================================
CREATE TABLE patient_journal_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    title           VARCHAR(255),
    content         TEXT NOT NULL,
    mood_score      SMALLINT,
    tags            TEXT[] DEFAULT '{}',
    is_private      BOOLEAN NOT NULL DEFAULT TRUE,  -- Patient can share with therapist
    shared_with_therapist BOOLEAN DEFAULT FALSE,
    ai_analyzed     BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_patient ON patient_journal_entries(patient_id, created_at DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_profiles_updated_at
    BEFORE UPDATE ON patient_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at
    BEFORE UPDATE ON patient_goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
