-- ============================================================
-- 24Therapy.ai — Migration 002: Therapists Schema
-- Therapists, Credentials, Specializations, Availability, Invitations
-- ============================================================

-- ============================================================
-- THERAPISTS
-- ============================================================
CREATE TABLE therapists (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id         UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id                 UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    public_slug             VARCHAR(100) UNIQUE,     -- /therapists/dr-sara-ahmed
    display_name            VARCHAR(200),            -- e.g. "Dr. Sara Ahmed"
    title                   VARCHAR(50),             -- Dr., Prof., etc.
    license_number          VARCHAR(100),
    license_country         VARCHAR(2),
    license_state           VARCHAR(100),
    license_type            VARCHAR(100),            -- e.g. 'LCSW', 'Psychologist', 'Psychiatrist'
    license_status          VARCHAR(50) DEFAULT 'pending',
    specializations         TEXT[] DEFAULT '{}',     -- array of specialization codes
    languages               TEXT[] DEFAULT '{}',     -- array of language codes
    years_experience        INTEGER,
    bio                     TEXT,
    education               JSONB DEFAULT '[]',      -- Array of {degree, institution, year}
    certifications          JSONB DEFAULT '[]',      -- Array of {name, issuer, year, expiry}
    therapy_modalities      TEXT[] DEFAULT '{}',     -- CBT, DBT, ACT, psychodynamic, etc.
    session_types           TEXT[] DEFAULT '{}',     -- video, phone, in_person
    session_duration_mins   INTEGER DEFAULT 50,
    session_fee_min         NUMERIC(10,2),
    session_fee_max         NUMERIC(10,2),
    currency                VARCHAR(3) DEFAULT 'USD',
    accepts_insurance       BOOLEAN DEFAULT FALSE,
    insurance_providers     TEXT[] DEFAULT '{}',
    availability_status     VARCHAR(50) DEFAULT 'offline',
    marketplace_enabled     BOOLEAN DEFAULT FALSE,
    marketplace_featured    BOOLEAN DEFAULT FALSE,
    verification_status     VARCHAR(50) DEFAULT 'pending',
    verification_notes      TEXT,
    verified_by             UUID REFERENCES users(id),
    verified_at             TIMESTAMPTZ,
    rating                  NUMERIC(3,2),            -- 0.00 to 5.00
    review_count            INTEGER NOT NULL DEFAULT 0,
    total_sessions          INTEGER NOT NULL DEFAULT 0,
    radar_active            BOOLEAN NOT NULL DEFAULT FALSE,
    radar_response_rate     NUMERIC(5,2),            -- % of radar requests accepted
    timezone                VARCHAR(100) DEFAULT 'UTC',
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,

    CONSTRAINT therapists_license_status_check CHECK (
        license_status IN ('active', 'expired', 'pending', 'suspended', 'unknown')
    ),
    CONSTRAINT therapists_availability_check CHECK (
        availability_status IN ('available', 'busy', 'offline', 'on_break')
    ),
    CONSTRAINT therapists_verification_check CHECK (
        verification_status IN ('pending', 'under_review', 'approved', 'rejected', 'suspended')
    )
);

CREATE INDEX idx_therapists_org ON therapists(organization_id);
CREATE INDEX idx_therapists_user ON therapists(user_id);
CREATE INDEX idx_therapists_slug ON therapists(public_slug);
CREATE INDEX idx_therapists_verification ON therapists(verification_status);
CREATE INDEX idx_therapists_marketplace ON therapists(marketplace_enabled) WHERE marketplace_enabled = TRUE;
CREATE INDEX idx_therapists_availability ON therapists(availability_status, radar_active);
CREATE INDEX idx_therapists_languages ON therapists USING GIN(languages);
CREATE INDEX idx_therapists_specializations ON therapists USING GIN(specializations);
CREATE INDEX idx_therapists_deleted ON therapists(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- THERAPIST CREDENTIALS (documents)
-- ============================================================
CREATE TABLE therapist_credentials (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id    UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    document_type   VARCHAR(50) NOT NULL,        -- 'license', 'degree', 'certification', 'insurance', 'id', 'cv'
    document_name   VARCHAR(255),
    document_url    VARCHAR(1000) NOT NULL,       -- Encrypted S3 URL
    expiration_date DATE,
    status          VARCHAR(50) DEFAULT 'pending',
    rejection_reason TEXT,
    verified_by     UUID REFERENCES users(id),
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT credentials_type_check CHECK (
        document_type IN ('license', 'degree', 'certification', 'insurance', 'id', 'cv', 'other')
    ),
    CONSTRAINT credentials_status_check CHECK (
        status IN ('pending', 'under_review', 'verified', 'rejected', 'expired')
    )
);

CREATE INDEX idx_credentials_therapist ON therapist_credentials(therapist_id);
CREATE INDEX idx_credentials_status ON therapist_credentials(status);

-- ============================================================
-- THERAPIST SPECIALIZATION TAXONOMY (lookup table)
-- ============================================================
CREATE TABLE specialization_taxonomy (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code        VARCHAR(50) UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(50),                -- 'mood', 'anxiety', 'trauma', 'life', 'relationship', etc.
    description TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    sort_order  INTEGER DEFAULT 0
);

INSERT INTO specialization_taxonomy (code, name, category) VALUES
('anxiety', 'Anxiety', 'mood'),
('depression', 'Depression', 'mood'),
('adhd', 'ADHD', 'neurodevelopmental'),
('trauma', 'Trauma & PTSD', 'trauma'),
('ptsd', 'PTSD', 'trauma'),
('ocd', 'OCD', 'anxiety'),
('grief', 'Grief & Loss', 'life'),
('addiction', 'Addiction & Substance Use', 'behavioral'),
('relationships', 'Relationship Issues', 'relationship'),
('couples', 'Couples Therapy', 'relationship'),
('family', 'Family Therapy', 'relationship'),
('eating_disorders', 'Eating Disorders', 'behavioral'),
('burnout', 'Burnout', 'mood'),
('sleep', 'Sleep Issues', 'health'),
('self_esteem', 'Self-Esteem', 'personal'),
('parenting', 'Parenting', 'life'),
('career', 'Career & Work Stress', 'life'),
('student', 'Student Support', 'life'),
('lgbtq', 'LGBTQ+ Issues', 'identity'),
('cultural', 'Cultural & Identity Issues', 'identity'),
('chronic_illness', 'Chronic Illness', 'health'),
('bipolar', 'Bipolar Disorder', 'mood'),
('psychosis', 'Psychosis', 'severe'),
('anger', 'Anger Management', 'behavioral'),
('phobias', 'Phobias', 'anxiety');

-- ============================================================
-- THERAPIST AVAILABILITY SCHEDULE
-- ============================================================
CREATE TABLE therapist_availability (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id    UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    day_of_week     SMALLINT NOT NULL,      -- 0=Sunday, 1=Monday... 6=Saturday
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    timezone        VARCHAR(100) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_day_of_week CHECK (day_of_week BETWEEN 0 AND 6),
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX idx_availability_therapist ON therapist_availability(therapist_id);
CREATE INDEX idx_availability_day ON therapist_availability(day_of_week, is_active);

-- ============================================================
-- THERAPIST AVAILABILITY EXCEPTIONS (blocked dates)
-- ============================================================
CREATE TABLE therapist_availability_exceptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id    UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
    exception_date  DATE NOT NULL,
    exception_type  VARCHAR(20) DEFAULT 'blocked',   -- 'blocked' or 'available'
    start_time      TIME,                            -- null = full day
    end_time        TIME,
    reason          VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_availability_exceptions_therapist ON therapist_availability_exceptions(therapist_id, exception_date);

-- ============================================================
-- THERAPIST INVITATIONS
-- ============================================================
CREATE TABLE therapist_invitations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    invited_by      UUID NOT NULL REFERENCES users(id),
    email           VARCHAR(255) NOT NULL,
    token_hash      VARCHAR(255) UNIQUE NOT NULL,
    status          VARCHAR(50) DEFAULT 'pending',
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE TRIGGER update_therapists_updated_at
    BEFORE UPDATE ON therapists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
