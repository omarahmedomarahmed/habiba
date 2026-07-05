-- ============================================================
-- 24Therapy MVP schema — patients, assignments, timeline, mood, goals, medications
-- Generated fresh for the MVP database reset (docs/PRODUCT_MVP.md).
-- Runs in order via scripts/migrate.js on every backend deploy.
-- ============================================================

-- ============================================================
-- 004_patients.sql
-- 24Therapy.ai — Patients, Profiles, Consents, Goals, Mood, Journal
-- NOTE: session FKs on patient_files, patient_life_events,
--       patient_relationships are added in 006_sessions.sql
-- ============================================================

-- ------------------------------------------------------------
-- patients
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  primary_therapist_id  UUID REFERENCES therapists(id) ON DELETE SET NULL,
  user_id               UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  external_patient_id   VARCHAR(100),
  first_name            VARCHAR(100) NOT NULL,
  last_name             VARCHAR(100),
  preferred_name        VARCHAR(100),
  date_of_birth         DATE,
  gender                VARCHAR(50),
  pronouns              VARCHAR(50),
  email                 VARCHAR(255),
  phone                 VARCHAR(50),
  address               JSONB        NOT NULL DEFAULT '{}',
  emergency_contact     JSONB        NOT NULL DEFAULT '{}',
  status                VARCHAR(50)  NOT NULL DEFAULT 'active',
  anonymous_mode        BOOLEAN      NOT NULL DEFAULT FALSE,
  on_medication         BOOLEAN      NOT NULL DEFAULT FALSE,
  source                VARCHAR(50),
  referring_therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL,
  intake_completed_at   TIMESTAMPTZ,
  last_session_at       TIMESTAMPTZ,
  total_sessions        INTEGER      NOT NULL DEFAULT 0,
  tags                  TEXT[]       NOT NULL DEFAULT '{}',
  notes                 TEXT,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  CONSTRAINT patients_status_check CHECK (
    status IN ('active','inactive','discharged','waitlist','on_hold')
  )
);


CREATE INDEX IF NOT EXISTS idx_patients_organization_id      ON patients (organization_id);

CREATE INDEX IF NOT EXISTS idx_patients_primary_therapist_id ON patients (primary_therapist_id);

CREATE INDEX IF NOT EXISTS idx_patients_user_id              ON patients (user_id);

CREATE INDEX IF NOT EXISTS idx_patients_status               ON patients (status);

CREATE INDEX IF NOT EXISTS idx_patients_tags_gin             ON patients USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_patients_not_deleted          ON patients (id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_last_session_at      ON patients (last_session_at);


CREATE OR REPLACE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- patient_profiles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
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
  insurance_info      JSONB NOT NULL DEFAULT '{}',
  medical_history     JSONB NOT NULL DEFAULT '[]',
  allergies           TEXT[] NOT NULL DEFAULT '{}',
  additional_notes    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT patient_profiles_patient_id_key UNIQUE (patient_id)
);


CREATE OR REPLACE TRIGGER trg_patient_profiles_updated_at
  BEFORE UPDATE ON patient_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- therapist_patient_assignments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_patient_assignments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id    UUID        NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role            VARCHAR(50) NOT NULL DEFAULT 'primary',
  assigned_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  notes           TEXT,
  CONSTRAINT therapist_patient_assignments_unique UNIQUE (therapist_id, patient_id),
  CONSTRAINT therapist_patient_assignments_role_check CHECK (
    role IN ('primary','secondary','consulting','supervisor')
  )
);


CREATE INDEX IF NOT EXISTS idx_tpa_therapist_id ON therapist_patient_assignments (therapist_id);

CREATE INDEX IF NOT EXISTS idx_tpa_patient_id   ON therapist_patient_assignments (patient_id);


-- ------------------------------------------------------------
-- patient_timeline_events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_timeline_events (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type      VARCHAR(100) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  metadata        JSONB        NOT NULL DEFAULT '{}',
  reference_id    UUID,
  reference_type  VARCHAR(50),
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_patient_timeline_patient_id     ON patient_timeline_events (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_timeline_type_patient   ON patient_timeline_events (event_type, patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_timeline_patient_created ON patient_timeline_events (patient_id, created_at DESC);


-- ------------------------------------------------------------
-- patient_goals
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_goals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  therapist_id    UUID REFERENCES therapists(id) ON DELETE SET NULL,
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           VARCHAR(255) NOT NULL,
  description     TEXT,
  category        VARCHAR(50),
  status          VARCHAR(50)  NOT NULL DEFAULT 'active',
  priority        VARCHAR(20)  NOT NULL DEFAULT 'medium',
  target_date     DATE,
  progress_score  INTEGER      NOT NULL DEFAULT 0,
  completed_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT patient_goals_status_check CHECK (
    status IN ('active','completed','paused','cancelled')
  ),
  CONSTRAINT patient_goals_priority_check CHECK (
    priority IN ('low','medium','high')
  )
);


CREATE INDEX IF NOT EXISTS idx_patient_goals_patient_id     ON patient_goals (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_goals_status_patient ON patient_goals (status, patient_id);


CREATE OR REPLACE TRIGGER trg_patient_goals_updated_at
  BEFORE UPDATE ON patient_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- patient_mood_entries
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_mood_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  score           SMALLINT    NOT NULL,
  emotions        TEXT[]      NOT NULL DEFAULT '{}',
  notes           TEXT,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          VARCHAR(50) NOT NULL DEFAULT 'manual',
  CONSTRAINT patient_mood_score_check CHECK (score BETWEEN 1 AND 10)
);


CREATE INDEX IF NOT EXISTS idx_patient_mood_patient_id       ON patient_mood_entries (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_mood_patient_recorded ON patient_mood_entries (patient_id, recorded_at DESC);

-- ============================================================
-- 005_medications.sql
-- 24Therapy.ai — Medications, Patient Medications, Adherence
-- ============================================================

-- ------------------------------------------------------------
-- medications (global reference catalogue)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medications (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 VARCHAR(255) NOT NULL,
  generic_name         VARCHAR(255),
  brand_names          TEXT[]       NOT NULL DEFAULT '{}',
  classification       VARCHAR(100),
  drug_class           VARCHAR(100),
  controlled_substance BOOLEAN      NOT NULL DEFAULT FALSE,
  schedule             VARCHAR(10),
  description          TEXT,
  common_uses          TEXT[]       NOT NULL DEFAULT '{}',
  common_side_effects  TEXT[]       NOT NULL DEFAULT '{}',
  contraindications    TEXT,
  max_daily_dose       VARCHAR(100),
  is_active            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_medications_name_fts
  ON medications USING GIN (to_tsvector('english', name));

CREATE INDEX IF NOT EXISTS idx_medications_classification ON medications (classification);


CREATE OR REPLACE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- patient_medications
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_medications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id          UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_id       UUID REFERENCES medications(id) ON DELETE SET NULL,
  organization_id     UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  medication_name     VARCHAR(255) NOT NULL,
  dosage              VARCHAR(100),
  frequency           VARCHAR(100),
  route               VARCHAR(50),
  start_date          DATE,
  end_date            DATE,
  status              VARCHAR(50)  NOT NULL DEFAULT 'active',
  prescribed_by       VARCHAR(200),
  prescriber_type     VARCHAR(50),
  reason              TEXT,
  notes               TEXT,
  adherence_status    VARCHAR(50)  NOT NULL DEFAULT 'unknown',
  side_effects_noted  TEXT[]       NOT NULL DEFAULT '{}',
  effectiveness_notes TEXT,
  added_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT patient_medications_status_check CHECK (
    status IN ('active','paused','completed','discontinued','unknown')
  ),
  CONSTRAINT patient_medications_adherence_check CHECK (
    adherence_status IN ('consistent','occasional_miss','frequent_miss','not_taking','unknown')
  )
);


CREATE INDEX IF NOT EXISTS idx_patient_medications_patient_id     ON patient_medications (patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_medications_status_patient ON patient_medications (status, patient_id);

CREATE INDEX IF NOT EXISTS idx_patient_medications_medication_id  ON patient_medications (medication_id);


CREATE OR REPLACE TRIGGER trg_patient_medications_updated_at
  BEFORE UPDATE ON patient_medications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
