-- ============================================================
-- 24Therapy.ai — Migration 004: Clinical Schema
-- Diagnoses, Risk Assessments, Treatment Plans, Clinical Notes
-- ============================================================

-- ============================================================
-- DIAGNOSES (clinical documentation)
-- ============================================================
CREATE TABLE patient_diagnoses (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    therapist_id    UUID NOT NULL REFERENCES therapists(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    diagnosis_code  VARCHAR(20),             -- ICD-10 or DSM-5 code
    diagnosis_name  VARCHAR(255) NOT NULL,
    description     TEXT,
    severity        VARCHAR(50),             -- mild, moderate, severe
    status          VARCHAR(50) DEFAULT 'active',
    onset_date      DATE,
    remission_date  DATE,
    notes           TEXT,
    is_primary      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT diagnosis_status_check CHECK (status IN ('active', 'remission', 'resolved', 'ruled_out'))
);

CREATE INDEX idx_diagnoses_patient ON patient_diagnoses(patient_id);
CREATE INDEX idx_diagnoses_therapist ON patient_diagnoses(therapist_id);

-- ============================================================
-- RISK ASSESSMENTS
-- ============================================================
CREATE TABLE risk_assessments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    therapist_id    UUID REFERENCES therapists(id),
    session_id      UUID,                    -- Reference to sessions (added via FK later)
    organization_id UUID NOT NULL REFERENCES organizations(id),
    risk_type       VARCHAR(50) NOT NULL,    -- 'self_harm', 'suicide', 'violence', 'substance', 'medical', 'general'
    risk_level      VARCHAR(20) NOT NULL,    -- 'low', 'moderate', 'elevated', 'high', 'critical'
    indicators      TEXT[] DEFAULT '{}',     -- Specific indicators observed
    ai_detected     BOOLEAN DEFAULT FALSE,   -- Was this flagged by AI?
    ai_confidence   NUMERIC(3,2),            -- AI confidence if ai_detected
    clinical_notes  TEXT,
    action_taken    TEXT,
    safety_plan     TEXT,
    reviewed_by     UUID REFERENCES users(id),
    reviewed_at     TIMESTAMPTZ,
    follow_up_date  DATE,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT risk_type_check CHECK (
        risk_type IN ('self_harm', 'suicide', 'violence', 'substance', 'medical', 'general')
    ),
    CONSTRAINT risk_level_check CHECK (
        risk_level IN ('low', 'moderate', 'elevated', 'high', 'critical')
    )
);

CREATE INDEX idx_risk_patient ON risk_assessments(patient_id);
CREATE INDEX idx_risk_level ON risk_assessments(risk_level, patient_id);
CREATE INDEX idx_risk_created ON risk_assessments(created_at DESC);

-- ============================================================
-- TREATMENT PLANS
-- ============================================================
CREATE TABLE treatment_plans (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    therapist_id        UUID NOT NULL REFERENCES therapists(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    title               VARCHAR(255) NOT NULL,
    presenting_problem  TEXT,
    primary_diagnosis   VARCHAR(20),          -- ICD/DSM code
    treatment_approach  TEXT[] DEFAULT '{}',   -- e.g. ['CBT', 'DBT', 'Mindfulness']
    goals               JSONB DEFAULT '[]',    -- Array of goal objects
    interventions       JSONB DEFAULT '[]',    -- Array of planned interventions
    frequency           VARCHAR(100),          -- e.g. "Weekly", "Biweekly"
    estimated_duration  VARCHAR(100),          -- e.g. "3-6 months"
    status              VARCHAR(50) DEFAULT 'draft',
    reviewed_date       DATE,
    review_date         DATE,                  -- Next scheduled review
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT treatment_status_check CHECK (status IN ('draft', 'active', 'completed', 'on_hold', 'discontinued'))
);

CREATE INDEX idx_treatment_patient ON treatment_plans(patient_id);
CREATE INDEX idx_treatment_status ON treatment_plans(status, patient_id);

-- ============================================================
-- TREATMENT PLAN PROGRESS NOTES
-- ============================================================
CREATE TABLE treatment_plan_progress_notes (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    treatment_plan_id   UUID NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
    patient_id          UUID NOT NULL REFERENCES patients(id),
    note                TEXT NOT NULL,
    progress_indicator  VARCHAR(50),   -- 'progressing', 'on_track', 'struggling', 'significant_progress'
    goals_reviewed      JSONB DEFAULT '[]',
    created_by          UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLINICAL NOTE TEMPLATES (org-specific)
-- ============================================================
CREATE TABLE clinical_note_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    format          VARCHAR(20) NOT NULL,     -- 'soap', 'dap', 'birp', 'narrative', 'custom'
    template_content JSONB NOT NULL,          -- Structured template definition
    is_default      BOOLEAN DEFAULT FALSE,
    is_global       BOOLEAN DEFAULT FALSE,    -- Available to all orgs
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER update_diagnoses_updated_at
    BEFORE UPDATE ON patient_diagnoses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_risk_assessments_updated_at
    BEFORE UPDATE ON risk_assessments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_treatment_plans_updated_at
    BEFORE UPDATE ON treatment_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
