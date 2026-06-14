-- ============================================================
-- 004_patients.sql
-- 24Therapy.ai — Patients, Profiles, Consents, Goals, Mood, Journal
-- NOTE: session FKs on patient_files, patient_life_events,
--       patient_relationships are added in 006_sessions.sql
-- ============================================================

-- ------------------------------------------------------------
-- patients
-- ------------------------------------------------------------
CREATE TABLE patients (
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

CREATE INDEX idx_patients_organization_id      ON patients (organization_id);
CREATE INDEX idx_patients_primary_therapist_id ON patients (primary_therapist_id);
CREATE INDEX idx_patients_user_id              ON patients (user_id);
CREATE INDEX idx_patients_status               ON patients (status);
CREATE INDEX idx_patients_tags_gin             ON patients USING GIN (tags);
CREATE INDEX idx_patients_not_deleted          ON patients (id) WHERE deleted_at IS NULL;
CREATE INDEX idx_patients_last_session_at      ON patients (last_session_at);

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- patient_profiles
-- ------------------------------------------------------------
CREATE TABLE patient_profiles (
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

CREATE TRIGGER trg_patient_profiles_updated_at
  BEFORE UPDATE ON patient_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- therapist_patient_assignments
-- ------------------------------------------------------------
CREATE TABLE therapist_patient_assignments (
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

CREATE INDEX idx_tpa_therapist_id ON therapist_patient_assignments (therapist_id);
CREATE INDEX idx_tpa_patient_id   ON therapist_patient_assignments (patient_id);

-- ------------------------------------------------------------
-- patient_contacts
-- ------------------------------------------------------------
CREATE TABLE patient_contacts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  relationship  VARCHAR(100),
  name          VARCHAR(200) NOT NULL,
  phone         VARCHAR(50),
  email         VARCHAR(255),
  is_emergency  BOOLEAN      NOT NULL DEFAULT FALSE,
  is_authorized BOOLEAN      NOT NULL DEFAULT FALSE,
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_contacts_patient_id ON patient_contacts (patient_id);

-- ------------------------------------------------------------
-- consent_versions
-- (defined here so patient_consents FK resolves in this file)
-- ------------------------------------------------------------
CREATE TABLE consent_versions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consent_type   VARCHAR(100) NOT NULL,
  version        VARCHAR(20)  NOT NULL,
  title          VARCHAR(255) NOT NULL,
  content        TEXT         NOT NULL,
  summary        TEXT,
  effective_date DATE         NOT NULL,
  language       VARCHAR(20)  NOT NULL DEFAULT 'en',
  is_required    BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT consent_versions_unique UNIQUE (consent_type, version, language)
);

-- ------------------------------------------------------------
-- patient_consents
-- ------------------------------------------------------------
CREATE TABLE patient_consents (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id         UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id    UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  consent_type       VARCHAR(100) NOT NULL,
  version            VARCHAR(20)  NOT NULL,
  granted            BOOLEAN      NOT NULL DEFAULT TRUE,
  accepted_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at         TIMESTAMPTZ,
  withdrawn_at       TIMESTAMPTZ,
  withdrawn_reason   TEXT,
  ip_address         VARCHAR(45),
  user_agent         TEXT,
  evidence_url       VARCHAR(1000),
  signature          TEXT,
  method             VARCHAR(50)  NOT NULL DEFAULT 'click',
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  consent_version_id UUID REFERENCES consent_versions(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_consents_patient_id   ON patient_consents (patient_id);
CREATE INDEX idx_patient_consents_type_patient ON patient_consents (consent_type, patient_id);

-- ------------------------------------------------------------
-- patient_files
-- (session_id FK to sessions is added in 006_sessions.sql)
-- ------------------------------------------------------------
CREATE TABLE patient_files (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id      UUID          NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id      UUID,   -- FK constraint added in 006_sessions.sql
  file_name       VARCHAR(255)  NOT NULL,
  file_url        VARCHAR(1000) NOT NULL,
  file_type       VARCHAR(100),
  file_size_bytes INTEGER,
  category        VARCHAR(50),
  description     TEXT,
  uploaded_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_patient_files_patient_id ON patient_files (patient_id);
CREATE INDEX idx_patient_files_session_id ON patient_files (session_id);

-- ------------------------------------------------------------
-- patient_timeline_events
-- ------------------------------------------------------------
CREATE TABLE patient_timeline_events (
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

CREATE INDEX idx_patient_timeline_patient_id     ON patient_timeline_events (patient_id);
CREATE INDEX idx_patient_timeline_type_patient   ON patient_timeline_events (event_type, patient_id);
CREATE INDEX idx_patient_timeline_patient_created ON patient_timeline_events (patient_id, created_at DESC);

-- ------------------------------------------------------------
-- patient_goals
-- ------------------------------------------------------------
CREATE TABLE patient_goals (
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

CREATE INDEX idx_patient_goals_patient_id     ON patient_goals (patient_id);
CREATE INDEX idx_patient_goals_status_patient ON patient_goals (status, patient_id);

CREATE TRIGGER trg_patient_goals_updated_at
  BEFORE UPDATE ON patient_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- goal_progress_updates
-- ------------------------------------------------------------
CREATE TABLE goal_progress_updates (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id        UUID        NOT NULL REFERENCES patient_goals(id) ON DELETE CASCADE,
  patient_id     UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  note           TEXT,
  progress_score INTEGER,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_goal_progress_goal_id ON goal_progress_updates (goal_id);

-- ------------------------------------------------------------
-- patient_mood_entries
-- ------------------------------------------------------------
CREATE TABLE patient_mood_entries (
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

CREATE INDEX idx_patient_mood_patient_id       ON patient_mood_entries (patient_id);
CREATE INDEX idx_patient_mood_patient_recorded ON patient_mood_entries (patient_id, recorded_at DESC);

-- ------------------------------------------------------------
-- patient_life_events
-- (source_session_id FK to sessions is added in 006_sessions.sql)
-- ------------------------------------------------------------
CREATE TABLE patient_life_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  organization_id   UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type        VARCHAR(100) NOT NULL,
  title             VARCHAR(255),
  description       TEXT,
  event_date        DATE,
  impact_level      VARCHAR(20)  NOT NULL DEFAULT 'medium',
  is_positive       BOOLEAN,
  ai_extracted      BOOLEAN      NOT NULL DEFAULT FALSE,
  source_session_id UUID,   -- FK constraint added in 006_sessions.sql
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT patient_life_events_impact_check CHECK (
    impact_level IN ('low','medium','high','critical')
  )
);

CREATE INDEX idx_patient_life_events_patient_id ON patient_life_events (patient_id);
CREATE INDEX idx_patient_life_events_session_id ON patient_life_events (source_session_id);

-- ------------------------------------------------------------
-- patient_relationships
-- (source_session_id FK to sessions is added in 006_sessions.sql)
-- ------------------------------------------------------------
CREATE TABLE patient_relationships (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id        UUID         NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50)  NOT NULL,
  person_name       VARCHAR(200),
  person_age        INTEGER,
  notes             TEXT,
  ai_extracted      BOOLEAN      NOT NULL DEFAULT FALSE,
  source_session_id UUID,   -- FK constraint added in 006_sessions.sql
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_relationships_patient_id ON patient_relationships (patient_id);
CREATE INDEX idx_patient_relationships_session_id ON patient_relationships (source_session_id);

CREATE TRIGGER trg_patient_relationships_updated_at
  BEFORE UPDATE ON patient_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- patient_journal_entries
-- ------------------------------------------------------------
CREATE TABLE patient_journal_entries (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id            UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  title                 VARCHAR(255),
  content               TEXT        NOT NULL,
  mood_score            SMALLINT,
  tags                  TEXT[]      NOT NULL DEFAULT '{}',
  is_private            BOOLEAN     NOT NULL DEFAULT TRUE,
  shared_with_therapist BOOLEAN     NOT NULL DEFAULT FALSE,
  ai_analyzed           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patient_journal_patient_created ON patient_journal_entries (patient_id, created_at DESC);

CREATE TRIGGER trg_patient_journal_updated_at
  BEFORE UPDATE ON patient_journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
