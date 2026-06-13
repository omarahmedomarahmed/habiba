-- ============================================================
-- 24Therapy.ai — Migration 005: Medications Schema
-- Medications Catalog, Patient Medications, History, Side Effects
-- ============================================================

-- ============================================================
-- MEDICATIONS MASTER CATALOG
-- ============================================================
CREATE TABLE medications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(255) NOT NULL,
    generic_name        VARCHAR(255),
    brand_names         TEXT[] DEFAULT '{}',
    classification      VARCHAR(100),           -- 'SSRI', 'SNRI', 'Antipsychotic', 'Benzodiazepine', etc.
    drug_class          VARCHAR(100),
    controlled_substance BOOLEAN DEFAULT FALSE,
    schedule            VARCHAR(10),             -- DEA Schedule: I, II, III, IV, V
    description         TEXT,
    common_uses         TEXT[] DEFAULT '{}',     -- ['depression', 'anxiety', 'ocd']
    common_side_effects TEXT[] DEFAULT '{}',
    contraindications   TEXT,
    max_daily_dose      VARCHAR(100),
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_medications_name ON medications USING GIN(to_tsvector('english', name));
CREATE INDEX idx_medications_classification ON medications(classification);

-- Pre-populate with common psychiatric medications
INSERT INTO medications (name, generic_name, classification, common_uses) VALUES
('Prozac', 'Fluoxetine', 'SSRI', ARRAY['depression', 'anxiety', 'ocd', 'ptsd']),
('Zoloft', 'Sertraline', 'SSRI', ARRAY['depression', 'anxiety', 'ptsd', 'ocd']),
('Lexapro', 'Escitalopram', 'SSRI', ARRAY['depression', 'anxiety']),
('Effexor', 'Venlafaxine', 'SNRI', ARRAY['depression', 'anxiety', 'panic']),
('Cymbalta', 'Duloxetine', 'SNRI', ARRAY['depression', 'anxiety', 'pain']),
('Wellbutrin', 'Bupropion', 'NDRI', ARRAY['depression', 'adhd', 'smoking_cessation']),
('Xanax', 'Alprazolam', 'Benzodiazepine', ARRAY['anxiety', 'panic']),
('Ativan', 'Lorazepam', 'Benzodiazepine', ARRAY['anxiety', 'insomnia']),
('Klonopin', 'Clonazepam', 'Benzodiazepine', ARRAY['anxiety', 'panic', 'seizures']),
('Abilify', 'Aripiprazole', 'Atypical Antipsychotic', ARRAY['bipolar', 'schizophrenia', 'depression_adjunct']),
('Seroquel', 'Quetiapine', 'Atypical Antipsychotic', ARRAY['bipolar', 'schizophrenia', 'depression_adjunct']),
('Risperdal', 'Risperidone', 'Atypical Antipsychotic', ARRAY['bipolar', 'schizophrenia']),
('Lithium', 'Lithium Carbonate', 'Mood Stabilizer', ARRAY['bipolar']),
('Lamictal', 'Lamotrigine', 'Mood Stabilizer', ARRAY['bipolar', 'depression']),
('Depakote', 'Valproic Acid', 'Mood Stabilizer', ARRAY['bipolar', 'seizures']),
('Adderall', 'Amphetamine Salts', 'Stimulant', ARRAY['adhd']),
('Ritalin', 'Methylphenidate', 'Stimulant', ARRAY['adhd']),
('Strattera', 'Atomoxetine', 'NRI', ARRAY['adhd']),
('Ambien', 'Zolpidem', 'Sedative-Hypnotic', ARRAY['insomnia']),
('Trazodone', 'Trazodone', 'SARI', ARRAY['depression', 'insomnia']),
('Buspar', 'Buspirone', 'Anxiolytic', ARRAY['anxiety', 'gad']),
('Remeron', 'Mirtazapine', 'NaSSA', ARRAY['depression', 'anxiety', 'insomnia']),
('Anafranil', 'Clomipramine', 'TCA', ARRAY['ocd', 'depression']);

-- ============================================================
-- PATIENT MEDICATIONS (active/historical prescriptions)
-- ============================================================
CREATE TABLE patient_medications (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id          UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    medication_id       UUID REFERENCES medications(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    medication_name     VARCHAR(255) NOT NULL,   -- Stored directly in case of custom/unlisted
    dosage              VARCHAR(100),             -- e.g. "10mg"
    frequency           VARCHAR(100),             -- e.g. "Once daily in the morning"
    route               VARCHAR(50),              -- 'oral', 'injectable', 'topical', etc.
    start_date          DATE,
    end_date            DATE,
    status              VARCHAR(50) DEFAULT 'active',
    prescribed_by       VARCHAR(200),             -- External prescriber name (not platform user)
    prescriber_type     VARCHAR(50),              -- 'psychiatrist', 'gp', 'neurologist', etc.
    reason              TEXT,                     -- Why prescribed
    notes               TEXT,
    adherence_status    VARCHAR(50) DEFAULT 'unknown',
    side_effects_noted  TEXT[] DEFAULT '{}',
    effectiveness_notes TEXT,
    added_by            UUID REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT med_status_check CHECK (
        status IN ('active', 'paused', 'completed', 'discontinued', 'unknown')
    ),
    CONSTRAINT adherence_check CHECK (
        adherence_status IN ('consistent', 'occasional_miss', 'frequent_miss', 'not_taking', 'unknown')
    )
);

CREATE INDEX idx_patient_meds_patient ON patient_medications(patient_id);
CREATE INDEX idx_patient_meds_status ON patient_medications(status, patient_id);

-- ============================================================
-- MEDICATION CHANGE HISTORY (full audit trail)
-- ============================================================
CREATE TABLE patient_medication_history (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_medication_id   UUID NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,
    patient_id              UUID NOT NULL REFERENCES patients(id),
    change_type             VARCHAR(50) NOT NULL,   -- 'started', 'dose_increased', 'dose_decreased', 'paused', 'discontinued', 'resumed'
    previous_dosage         VARCHAR(100),
    new_dosage              VARCHAR(100),
    previous_status         VARCHAR(50),
    new_status              VARCHAR(50),
    previous_frequency      VARCHAR(100),
    new_frequency           VARCHAR(100),
    reason                  TEXT,
    changed_by              UUID REFERENCES users(id),
    changed_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes                   TEXT
);

CREATE INDEX idx_med_history_patient_med ON patient_medication_history(patient_medication_id);
CREATE INDEX idx_med_history_patient ON patient_medication_history(patient_id);

-- ============================================================
-- MEDICATION ADHERENCE LOGS (patient-reported or AI-tracked)
-- ============================================================
CREATE TABLE medication_adherence_logs (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_medication_id   UUID NOT NULL REFERENCES patient_medications(id) ON DELETE CASCADE,
    patient_id              UUID NOT NULL REFERENCES patients(id),
    logged_date             DATE NOT NULL,
    taken                   BOOLEAN,
    dose_taken              VARCHAR(100),
    notes                   TEXT,
    side_effects_reported   TEXT[] DEFAULT '{}',
    source                  VARCHAR(50) DEFAULT 'manual',   -- 'manual', 'ai_extracted', 'patient_app'
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_adherence_patient_med ON medication_adherence_logs(patient_medication_id);
CREATE INDEX idx_adherence_date ON medication_adherence_logs(patient_id, logged_date DESC);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER update_patient_medications_updated_at
    BEFORE UPDATE ON patient_medications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Reviewed: 2026-06-13 — 24Therapy audit
