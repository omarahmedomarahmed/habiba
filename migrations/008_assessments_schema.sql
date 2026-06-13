-- ============================================================
-- 008_assessments_schema.sql
-- 24Therapy.ai — Assessments, Templates, Results, Scoring
-- ============================================================
-- Depends on: 001_core_schema.sql, 003_patients_schema.sql, 006_sessions_schema.sql
-- Run after: 007_ai_schema.sql
-- ============================================================

-- ============================================================
-- ASSESSMENT TEMPLATES
-- Standard validated instruments + custom organization templates
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_templates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        -- NULL for system-level templates (PHQ-9, GAD-7, etc.)
    type_key        VARCHAR(100) UNIQUE NOT NULL,
        -- PHQ-9, GAD-7, PCL-5, AUDIT, DAST, ASRS, WHO-5, or custom
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
        -- depression, anxiety, trauma, substance_use, adhd, wellbeing, custom
    is_standard     BOOLEAN DEFAULT TRUE,    -- FALSE for custom org templates
    is_active       BOOLEAN DEFAULT TRUE,
    estimated_minutes INTEGER DEFAULT 10,
    scoring_method  VARCHAR(100) DEFAULT 'sum',
        -- sum, average, subscale, algorithm
    scoring_formula JSONB,                   -- Scoring rules
    max_score       INTEGER,
    interpretation_guide JSONB,
        -- { "minimal": [0,4], "mild": [5,9], "moderate": [10,14], "severe": [15,27] }
    clinical_notes  TEXT,                    -- Guidance for clinicians
    reference_url   TEXT,                    -- Link to validation study
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed standard validated assessments
INSERT INTO assessment_templates (type_key, name, description, category, is_standard, max_score, estimated_minutes, interpretation_guide) VALUES
('PHQ-9',  'Patient Health Questionnaire-9',            'Depression screening and severity measurement', 'depression',     TRUE, 27, 5,
 '{"minimal": [0,4], "mild": [5,9], "moderate": [10,14], "moderately_severe": [15,19], "severe": [20,27]}'),
('GAD-7',  'Generalized Anxiety Disorder-7',            'Anxiety screening and severity measurement',    'anxiety',        TRUE, 21, 5,
 '{"minimal": [0,4], "mild": [5,9], "moderate": [10,14], "severe": [15,21]}'),
('PCL-5',  'PTSD Checklist (DSM-5)',                    'PTSD symptom severity assessment',             'trauma',         TRUE, 80, 10,
 '{"probable_ptsd": [33,80]}'),
('AUDIT',  'Alcohol Use Disorders Identification Test',  'Alcohol use disorder screening',               'substance_use',  TRUE, 40, 10,
 '{"low_risk": [0,7], "hazardous": [8,15], "harmful": [16,19], "dependence": [20,40]}'),
('DAST',   'Drug Abuse Screening Test',                 'Drug abuse screening',                         'substance_use',  TRUE, 10, 5,
 '{"none": [0,0], "low": [1,2], "moderate": [3,5], "high": [6,8], "severe": [9,10]}'),
('ASRS',   'Adult ADHD Self-Report Scale',              'ADHD symptom assessment in adults',            'adhd',           TRUE, 24, 10,
 '{"low": [0,13], "high": [14,24]}'),
('WHO-5',  'WHO-5 Wellbeing Index',                     'General wellbeing measurement',                'wellbeing',      TRUE, 25, 5,
 '{"poor_wellbeing": [0,12], "adequate_wellbeing": [13,25]}')
ON CONFLICT (type_key) DO NOTHING;

-- ============================================================
-- ASSESSMENT QUESTIONS
-- Per-template questions with scale definitions
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_questions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id     UUID NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    question_code   VARCHAR(50),     -- e.g., PHQ9_Q1
    display_order   INTEGER NOT NULL,
    scale_min       INTEGER DEFAULT 0,
    scale_max       INTEGER DEFAULT 3,
    scale_labels    JSONB,
        -- { "0": "Not at all", "1": "Several days", "2": "More than half", "3": "Nearly every day" }
    reverse_scored  BOOLEAN DEFAULT FALSE,
    subscale        VARCHAR(100),    -- for multi-subscale assessments
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PHQ-9 Questions
INSERT INTO assessment_questions (template_id, question_text, question_code, display_order, scale_min, scale_max, scale_labels) 
SELECT id, q.question_text, q.code, q.ord, 0, 3,
       '{"0": "Not at all", "1": "Several days", "2": "More than half the days", "3": "Nearly every day"}'::jsonb
FROM assessment_templates t,
(VALUES 
  ('Little interest or pleasure in doing things',                                            'PHQ9_Q1',  1),
  ('Feeling down, depressed, or hopeless',                                                   'PHQ9_Q2',  2),
  ('Trouble falling or staying asleep, or sleeping too much',                                'PHQ9_Q3',  3),
  ('Feeling tired or having little energy',                                                  'PHQ9_Q4',  4),
  ('Poor appetite or overeating',                                                            'PHQ9_Q5',  5),
  ('Feeling bad about yourself or that you are a failure or have let yourself or your family down', 'PHQ9_Q6', 6),
  ('Trouble concentrating on things such as reading the newspaper or watching television',   'PHQ9_Q7',  7),
  ('Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual', 'PHQ9_Q8', 8),
  ('Thoughts that you would be better off dead or of hurting yourself in some way',          'PHQ9_Q9',  9)
) AS q(question_text, code, ord)
WHERE t.type_key = 'PHQ-9'
ON CONFLICT DO NOTHING;

-- GAD-7 Questions
INSERT INTO assessment_questions (template_id, question_text, question_code, display_order, scale_min, scale_max, scale_labels)
SELECT id, q.question_text, q.code, q.ord, 0, 3,
       '{"0": "Not at all", "1": "Several days", "2": "More than half the days", "3": "Nearly every day"}'::jsonb
FROM assessment_templates t,
(VALUES
  ('Feeling nervous, anxious, or on edge',                                      'GAD7_Q1', 1),
  ('Not being able to stop or control worrying',                                 'GAD7_Q2', 2),
  ('Worrying too much about different things',                                   'GAD7_Q3', 3),
  ('Trouble relaxing',                                                           'GAD7_Q4', 4),
  ('Being so restless that it is hard to sit still',                             'GAD7_Q5', 5),
  ('Becoming easily annoyed or irritable',                                       'GAD7_Q6', 6),
  ('Feeling afraid as if something awful might happen',                          'GAD7_Q7', 7)
) AS q(question_text, code, ord)
WHERE t.type_key = 'GAD-7'
ON CONFLICT DO NOTHING;

-- ============================================================
-- ASSESSMENT RESULTS
-- Patient-level assessment instances
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_results (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id  UUID NOT NULL REFERENCES organizations(id),
    patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    session_id       UUID REFERENCES sessions(id),
    template_id      UUID NOT NULL REFERENCES assessment_templates(id),
    status           VARCHAR(50) DEFAULT 'pending',
        -- pending, sent, in_progress, completed, expired, cancelled
    administered_by  UUID REFERENCES users(id),
    administered_via VARCHAR(50) DEFAULT 'clinician',
        -- clinician, patient_portal, ai_intake
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    total_score      FLOAT,
    subscale_scores  JSONB,           -- For multi-subscale tools
    interpretation   VARCHAR(255),    -- e.g., "Moderate Depression"
    severity_band    VARCHAR(100),    -- e.g., "moderate"
    clinical_notes   TEXT,
    patient_notes    TEXT,            -- Patient's own comments
    is_baseline      BOOLEAN DEFAULT FALSE,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_results_patient     ON assessment_results(patient_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_session     ON assessment_results(session_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_template    ON assessment_results(template_id);
CREATE INDEX IF NOT EXISTS idx_assessment_results_status      ON assessment_results(status);
CREATE INDEX IF NOT EXISTS idx_assessment_results_completed   ON assessment_results(completed_at DESC);

-- ============================================================
-- ASSESSMENT ANSWERS
-- Individual question responses
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_answers (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id     UUID NOT NULL REFERENCES assessment_results(id) ON DELETE CASCADE,
    question_id   UUID NOT NULL REFERENCES assessment_questions(id),
    answer_value  INTEGER NOT NULL,
    answered_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(result_id, question_id)
);

-- ============================================================
-- ASSESSMENT TREND TRACKING
-- Aggregated view for trend analysis per patient per assessment type
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_trends (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id        UUID NOT NULL REFERENCES patients(id),
    template_id       UUID NOT NULL REFERENCES assessment_templates(id),
    period_start      DATE NOT NULL,
    period_end        DATE NOT NULL,
    result_count      INTEGER DEFAULT 0,
    avg_score         FLOAT,
    min_score         FLOAT,
    max_score         FLOAT,
    trend_direction   VARCHAR(50),
        -- improving, worsening, stable, insufficient_data
    trend_change_pct  FLOAT,          -- Percentage change from prior period
    computed_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_id, template_id, period_start)
);

-- ============================================================
-- CUSTOM ASSESSMENT TEMPLATES (Org-Level)
-- Allow organizations to create custom questionnaires
-- ============================================================

CREATE TABLE IF NOT EXISTS custom_assessment_sections (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id  UUID NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
    title        VARCHAR(255),
    description  TEXT,
    display_order INTEGER NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ASSESSMENT REMINDERS
-- Scheduled assessment delivery
-- ============================================================

CREATE TABLE IF NOT EXISTS assessment_schedules (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    patient_id      UUID NOT NULL REFERENCES patients(id),
    template_id     UUID NOT NULL REFERENCES assessment_templates(id),
    therapist_id    UUID REFERENCES therapists(id),
    frequency       VARCHAR(50),
        -- once, weekly, biweekly, monthly, per_session, custom
    next_due_at     TIMESTAMPTZ,
    last_sent_at    TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT TRUE,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT TRIGGERS
-- Every assessment change creates an audit log entry
-- ============================================================

CREATE OR REPLACE FUNCTION audit_assessment_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (action, resource_type, resource_id, old_value, new_value)
        VALUES ('assessment.updated', 'assessment_results', NEW.id, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (action, resource_type, resource_id, new_value)
        VALUES ('assessment.created', 'assessment_results', NEW.id, row_to_json(NEW)::jsonb);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_assessment_results
    AFTER INSERT OR UPDATE ON assessment_results
    FOR EACH ROW EXECUTE FUNCTION audit_assessment_changes();

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_assessment_schedules_patient  ON assessment_schedules(patient_id);
CREATE INDEX IF NOT EXISTS idx_assessment_schedules_next_due ON assessment_schedules(next_due_at);
CREATE INDEX IF NOT EXISTS idx_assessment_trends_patient      ON assessment_trends(patient_id, template_id);

-- Reviewed: 2026-06-13 — 24Therapy audit
