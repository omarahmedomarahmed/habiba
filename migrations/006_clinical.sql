-- ============================================================
-- 24Therapy MVP schema — risk assessments, treatment plans, assessments
-- Generated fresh for the MVP database reset (docs/PRODUCT_MVP.md).
-- Runs in order via scripts/migrate.js on every backend deploy.
-- ============================================================


-- ------------------------------------------------------------
-- risk_assessments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS risk_assessments (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id           UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  therapist_id         UUID REFERENCES therapists(id) ON DELETE SET NULL,
  session_id           UUID REFERENCES sessions(id) ON DELETE SET NULL,
  organization_id      UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_type            VARCHAR(50)  NOT NULL,
  risk_level           VARCHAR(20)  NOT NULL,
  indicators           TEXT[]       NOT NULL DEFAULT '{}',
  ai_detected          BOOLEAN      NOT NULL DEFAULT FALSE,
  ai_confidence        NUMERIC(3,2),
  clinical_notes       TEXT,
  action_taken         TEXT,
  safety_plan          TEXT,
  reviewed_by          UUID REFERENCES users(id),
  reviewed_at          TIMESTAMPTZ,
  follow_up_date       DATE,
  resolved_at          TIMESTAMPTZ,
  source               VARCHAR(20)  NOT NULL DEFAULT 'ai',
  alert_status         VARCHAR(20)  NOT NULL DEFAULT 'pending',
  alert_delivered_at   TIMESTAMPTZ,
  acknowledged_by      UUID REFERENCES users(id),
  acknowledged_at      TIMESTAMPTZ,
  conversation_id      UUID,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT risk_assessments_type_check CHECK (
    risk_type IN ('self_harm','suicide','violence','substance','medical','general')
  ),
  CONSTRAINT risk_assessments_level_check CHECK (
    risk_level IN ('low','moderate','elevated','high','critical')
  )
);


CREATE INDEX IF NOT EXISTS idx_risk_assessments_patient_id         ON risk_assessments (patient_id);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_level_patient       ON risk_assessments (risk_level, patient_id);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_created_desc        ON risk_assessments (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_org_alert_created   ON risk_assessments (organization_id, alert_status, created_at);


CREATE OR REPLACE TRIGGER trg_risk_assessments_updated_at
  BEFORE UPDATE ON risk_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- treatment_plans
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatment_plans (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  therapist_id        UUID         NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  organization_id     UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title               VARCHAR(255) NOT NULL,
  presenting_problem  TEXT,
  primary_diagnosis   VARCHAR(20),
  treatment_approach  TEXT[]       NOT NULL DEFAULT '{}',
  goals               JSONB        NOT NULL DEFAULT '[]',
  interventions       JSONB        NOT NULL DEFAULT '[]',
  frequency           VARCHAR(100),
  estimated_duration  VARCHAR(100),
  status              VARCHAR(50)  NOT NULL DEFAULT 'draft',
  reviewed_date       DATE,
  review_date         DATE,
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT treatment_plans_status_check CHECK (
    status IN ('draft','active','completed','on_hold','discontinued')
  )
);


CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_id      ON treatment_plans (patient_id);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_status_patient  ON treatment_plans (status, patient_id);


CREATE OR REPLACE TRIGGER trg_treatment_plans_updated_at
  BEFORE UPDATE ON treatment_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- assessment_templates
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_templates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  type_key            VARCHAR(100) NOT NULL,
  name                VARCHAR(255) NOT NULL,
  description         TEXT,
  category            VARCHAR(100),
  is_standard         BOOLEAN      NOT NULL DEFAULT TRUE,
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  estimated_minutes   INTEGER      NOT NULL DEFAULT 10,
  scoring_method      VARCHAR(100) NOT NULL DEFAULT 'sum',
  scoring_formula     JSONB,
  max_score           INTEGER,
  interpretation_guide JSONB,
  clinical_notes      TEXT,
  reference_url       TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT assessment_templates_type_key_key UNIQUE (type_key)
);


CREATE OR REPLACE TRIGGER trg_assessment_templates_updated_at
  BEFORE UPDATE ON assessment_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- assessment_results
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_results (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id        UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_id        UUID REFERENCES sessions(id) ON DELETE SET NULL,
  template_id       UUID        NOT NULL REFERENCES assessment_templates(id) ON DELETE RESTRICT,
  status            VARCHAR(50) NOT NULL DEFAULT 'pending',
  administered_by   UUID REFERENCES users(id),
  administered_via  VARCHAR(50) NOT NULL DEFAULT 'clinician',
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  total_score       FLOAT,
  subscale_scores   JSONB,
  interpretation    VARCHAR(255),
  severity_band     VARCHAR(100),
  clinical_notes    TEXT,
  patient_notes     TEXT,
  is_baseline       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_assessment_results_patient_id     ON assessment_results (patient_id);

CREATE INDEX IF NOT EXISTS idx_assessment_results_session_id     ON assessment_results (session_id);

CREATE INDEX IF NOT EXISTS idx_assessment_results_template_id    ON assessment_results (template_id);

CREATE INDEX IF NOT EXISTS idx_assessment_results_status         ON assessment_results (status);

CREATE INDEX IF NOT EXISTS idx_assessment_results_completed_desc ON assessment_results (completed_at DESC);


CREATE OR REPLACE TRIGGER trg_assessment_results_updated_at
  BEFORE UPDATE ON assessment_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Crisis pipeline indexes (former migration 033)
CREATE INDEX IF NOT EXISTS idx_risk_assessments_session_created ON risk_assessments (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_sweeper ON risk_assessments (alert_status, created_at) WHERE alert_status = 'pending';
