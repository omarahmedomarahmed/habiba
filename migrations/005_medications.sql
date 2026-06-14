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

-- ------------------------------------------------------------
-- patient_medication_history
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_medication_history (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_medication_id UUID         NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,
  patient_id            UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  change_type           VARCHAR(50)  NOT NULL,
  previous_dosage       VARCHAR(100),
  new_dosage            VARCHAR(100),
  previous_status       VARCHAR(50),
  new_status            VARCHAR(50),
  previous_frequency    VARCHAR(100),
  new_frequency         VARCHAR(100),
  reason                TEXT,
  changed_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  notes                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_patient_med_history_med_id  ON patient_medication_history (patient_medication_id);
CREATE INDEX IF NOT EXISTS idx_patient_med_history_patient ON patient_medication_history (patient_id);

-- ------------------------------------------------------------
-- medication_adherence_logs
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medication_adherence_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_medication_id UUID        NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,
  patient_id            UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  logged_date           DATE        NOT NULL,
  taken                 BOOLEAN,
  dose_taken            VARCHAR(100),
  notes                 TEXT,
  side_effects_reported TEXT[]      NOT NULL DEFAULT '{}',
  source                VARCHAR(50) NOT NULL DEFAULT 'manual',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adherence_logs_med_id       ON medication_adherence_logs (patient_medication_id);
CREATE INDEX IF NOT EXISTS idx_adherence_logs_patient_date ON medication_adherence_logs (patient_id, logged_date DESC);
