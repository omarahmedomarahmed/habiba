-- ============================================================
-- 007_clinical.sql
-- 24Therapy.ai — Clinical: Diagnoses, Risk, Treatment Plans,
--                Assessments, Templates
-- ============================================================

-- ------------------------------------------------------------
-- patient_diagnoses
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_diagnoses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  therapist_id    UUID         NOT NULL REFERENCES therapists(id) ON DELETE RESTRICT,
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  diagnosis_code  VARCHAR(20),
  diagnosis_name  VARCHAR(255) NOT NULL,
  description     TEXT,
  severity        VARCHAR(50),
  status          VARCHAR(50)  NOT NULL DEFAULT 'active',
  onset_date      DATE,
  remission_date  DATE,
  notes           TEXT,
  is_primary      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT patient_diagnoses_status_check CHECK (
    status IN ('active','remission','resolved','ruled_out')
  )
);

CREATE INDEX IF NOT EXISTS idx_patient_diagnoses_patient_id   ON patient_diagnoses (patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_diagnoses_therapist_id ON patient_diagnoses (therapist_id);

CREATE OR REPLACE TRIGGER trg_patient_diagnoses_updated_at
  BEFORE UPDATE ON patient_diagnoses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
-- treatment_plan_progress_notes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treatment_plan_progress_notes (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  treatment_plan_id   UUID        NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
  patient_id          UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  note                TEXT        NOT NULL,
  progress_indicator  VARCHAR(50),
  goals_reviewed      JSONB       NOT NULL DEFAULT '[]',
  created_by          UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treatment_plan_progress_plan_id ON treatment_plan_progress_notes (treatment_plan_id);

-- ------------------------------------------------------------
-- clinical_note_templates
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinical_note_templates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  format           VARCHAR(20)  NOT NULL,
  template_content JSONB        NOT NULL,
  is_default       BOOLEAN      NOT NULL DEFAULT FALSE,
  is_global        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER trg_clinical_note_templates_updated_at
  BEFORE UPDATE ON clinical_note_templates
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
-- assessment_questions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id     UUID        NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
  question_text   TEXT        NOT NULL,
  question_code   VARCHAR(50),
  display_order   INTEGER     NOT NULL,
  scale_min       INTEGER     NOT NULL DEFAULT 0,
  scale_max       INTEGER     NOT NULL DEFAULT 3,
  scale_labels    JSONB,
  reverse_scored  BOOLEAN     NOT NULL DEFAULT FALSE,
  subscale        VARCHAR(100),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_questions_template_id ON assessment_questions (template_id);

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

-- ------------------------------------------------------------
-- assessment_answers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_answers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  result_id     UUID        NOT NULL REFERENCES assessment_results(id) ON DELETE CASCADE,
  question_id   UUID        NOT NULL REFERENCES assessment_questions(id) ON DELETE RESTRICT,
  answer_value  INTEGER     NOT NULL,
  answered_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assessment_answers_result_question_key UNIQUE (result_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_answers_result_id ON assessment_answers (result_id);

-- ------------------------------------------------------------
-- assessment_trends
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_trends (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID    NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  template_id       UUID    NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
  period_start      DATE    NOT NULL,
  period_end        DATE    NOT NULL,
  result_count      INTEGER NOT NULL DEFAULT 0,
  avg_score         FLOAT,
  min_score         FLOAT,
  max_score         FLOAT,
  trend_direction   VARCHAR(50),
  trend_change_pct  FLOAT,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assessment_trends_unique UNIQUE (patient_id, template_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_assessment_trends_patient_template ON assessment_trends (patient_id, template_id);

-- ------------------------------------------------------------
-- custom_assessment_sections
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_assessment_sections (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id   UUID        NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
  title         VARCHAR(255),
  description   TEXT,
  display_order INTEGER     NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_assessment_sections_template ON custom_assessment_sections (template_id);

-- ------------------------------------------------------------
-- assessment_schedules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assessment_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  template_id     UUID        NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
  therapist_id    UUID REFERENCES therapists(id) ON DELETE SET NULL,
  frequency       VARCHAR(50),
  next_due_at     TIMESTAMPTZ,
  last_sent_at    TIMESTAMPTZ,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_schedules_patient_id  ON assessment_schedules (patient_id);
CREATE INDEX IF NOT EXISTS idx_assessment_schedules_next_due    ON assessment_schedules (next_due_at);

CREATE OR REPLACE TRIGGER trg_assessment_schedules_updated_at
  BEFORE UPDATE ON assessment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
