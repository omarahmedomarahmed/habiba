-- ============================================================
-- 003_therapists.sql
-- 24Therapy.ai — Therapists, Credentials, Availability
-- ============================================================

-- ------------------------------------------------------------
-- therapists
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapists (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id         UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id                 UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_slug             VARCHAR(100),
  display_name            VARCHAR(200),
  title                   VARCHAR(50),
  license_number          VARCHAR(100),
  license_country         VARCHAR(2),
  license_state           VARCHAR(100),
  license_type            VARCHAR(100),
  license_status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
  specializations         TEXT[]       NOT NULL DEFAULT '{}',
  languages               TEXT[]       NOT NULL DEFAULT '{}',
  years_experience        INTEGER,
  bio                     TEXT,
  education               JSONB        NOT NULL DEFAULT '[]',
  certifications          JSONB        NOT NULL DEFAULT '[]',
  therapy_modalities      TEXT[]       NOT NULL DEFAULT '{}',
  session_types           TEXT[]       NOT NULL DEFAULT '{}',
  session_duration_mins   INTEGER      NOT NULL DEFAULT 50,
  session_fee_min         NUMERIC(10,2),
  session_fee_max         NUMERIC(10,2),
  currency                VARCHAR(3)   NOT NULL DEFAULT 'USD',
  accepts_insurance       BOOLEAN      NOT NULL DEFAULT FALSE,
  insurance_providers     TEXT[]       NOT NULL DEFAULT '{}',
  availability_status     VARCHAR(50)  NOT NULL DEFAULT 'offline',
  marketplace_enabled     BOOLEAN      NOT NULL DEFAULT FALSE,
  marketplace_featured    BOOLEAN      NOT NULL DEFAULT FALSE,
  verification_status     VARCHAR(50)  NOT NULL DEFAULT 'pending',
  verification_notes      TEXT,
  verified_by             UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at             TIMESTAMPTZ,
  rating                  NUMERIC(3,2),
  review_count            INTEGER      NOT NULL DEFAULT 0,
  total_sessions          INTEGER      NOT NULL DEFAULT 0,
  radar_active            BOOLEAN      NOT NULL DEFAULT FALSE,
  radar_response_rate     NUMERIC(5,2),
  timezone                VARCHAR(100) NOT NULL DEFAULT 'UTC',
  trial_session_used      BOOLEAN      NOT NULL DEFAULT FALSE,
  current_plan_key        VARCHAR(50)  NOT NULL DEFAULT 'pay_per_session',
  accepting_new_patients  BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at              TIMESTAMPTZ,
  CONSTRAINT therapists_user_id_key    UNIQUE (user_id),
  CONSTRAINT therapists_public_slug_key UNIQUE (public_slug),
  CONSTRAINT therapists_license_status_check CHECK (
    license_status IN ('active','expired','pending','suspended','unknown')
  ),
  CONSTRAINT therapists_availability_status_check CHECK (
    availability_status IN ('available','busy','offline','on_break')
  ),
  CONSTRAINT therapists_verification_status_check CHECK (
    verification_status IN ('pending','under_review','approved','rejected','suspended')
  )
);

CREATE INDEX IF NOT EXISTS idx_therapists_organization_id     ON therapists (organization_id);
CREATE INDEX IF NOT EXISTS idx_therapists_user_id             ON therapists (user_id);
CREATE INDEX IF NOT EXISTS idx_therapists_public_slug         ON therapists (public_slug);
CREATE INDEX IF NOT EXISTS idx_therapists_verification_status ON therapists (verification_status);
CREATE INDEX IF NOT EXISTS idx_therapists_marketplace_enabled ON therapists (id) WHERE marketplace_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_therapists_radar_availability  ON therapists (availability_status, radar_active);
CREATE INDEX IF NOT EXISTS idx_therapists_languages_gin       ON therapists USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_therapists_specializations_gin ON therapists USING GIN (specializations);
CREATE INDEX IF NOT EXISTS idx_therapists_not_deleted         ON therapists (id) WHERE deleted_at IS NULL;

CREATE OR REPLACE TRIGGER trg_therapists_updated_at
  BEFORE UPDATE ON therapists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- therapist_credentials
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_credentials (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id     UUID          NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  document_type    VARCHAR(50)   NOT NULL,
  document_name    VARCHAR(255),
  document_url     VARCHAR(1000) NOT NULL,
  expiration_date  DATE,
  status           VARCHAR(50)   NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  verified_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT therapist_credentials_doc_type_check CHECK (
    document_type IN ('license','degree','certification','insurance','id','cv','other')
  ),
  CONSTRAINT therapist_credentials_status_check CHECK (
    status IN ('pending','under_review','verified','rejected','expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_therapist_credentials_therapist_id ON therapist_credentials (therapist_id);

CREATE OR REPLACE TRIGGER trg_therapist_credentials_updated_at
  BEFORE UPDATE ON therapist_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- specialization_taxonomy
-- (structure only — rows inserted in 016_seed_data.sql)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS specialization_taxonomy (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(50)  NOT NULL,
  name        VARCHAR(100) NOT NULL,
  category    VARCHAR(50),
  description TEXT,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order  INTEGER      NOT NULL DEFAULT 0,
  CONSTRAINT specialization_taxonomy_code_key UNIQUE (code)
);

-- ------------------------------------------------------------
-- therapist_availability
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_availability (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID        NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  day_of_week  SMALLINT    NOT NULL,
  start_time   TIME        NOT NULL,
  end_time     TIME        NOT NULL,
  timezone     VARCHAR(100) NOT NULL,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT therapist_availability_day_check  CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT therapist_availability_time_check CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_therapist_availability_therapist_id ON therapist_availability (therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_availability_day_active   ON therapist_availability (day_of_week, is_active);

-- ------------------------------------------------------------
-- therapist_availability_exceptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_availability_exceptions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id   UUID        NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  exception_date DATE        NOT NULL,
  exception_type VARCHAR(20) NOT NULL DEFAULT 'blocked',
  start_time     TIME,
  end_time       TIME,
  reason         VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapist_avail_exceptions_therapist_date
  ON therapist_availability_exceptions (therapist_id, exception_date);

-- ------------------------------------------------------------
-- therapist_invitations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_invitations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by      UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  email           VARCHAR(255) NOT NULL,
  token_hash      VARCHAR(255) NOT NULL,
  status          VARCHAR(50)  NOT NULL DEFAULT 'pending',
  expires_at      TIMESTAMPTZ  NOT NULL,
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT therapist_invitations_token_key UNIQUE (token_hash)
);

-- ------------------------------------------------------------
-- therapist_specializations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_specializations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id      UUID         NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  specialization_id UUID REFERENCES specialization_taxonomy(id) ON DELETE SET NULL,
  specialization    VARCHAR(100) NOT NULL,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT therapist_specializations_unique UNIQUE (therapist_id, specialization)
);

CREATE INDEX IF NOT EXISTS idx_therapist_specializations_therapist_id ON therapist_specializations (therapist_id);
