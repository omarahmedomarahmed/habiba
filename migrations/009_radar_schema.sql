-- ============================================================
-- 009_radar_schema.sql
-- 24Therapy.ai — Radar Instant Matching System
-- ============================================================
-- RADAR: Real-time patient-to-therapist matching engine.
-- Patients request immediate or urgent support.
-- Available therapists respond. AI matches and ranks.
-- ============================================================
-- Depends on: 001_core_schema.sql, 002_therapists_schema.sql,
--             003_patients_schema.sql, 006_sessions_schema.sql
-- ============================================================

-- ============================================================
-- RADAR REQUESTS
-- Patient submits an urgent/instant session request
-- ============================================================

CREATE TABLE IF NOT EXISTS radar_requests (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id   UUID REFERENCES organizations(id),
        -- NULL for anonymous marketplace requests
    patient_id        UUID REFERENCES patients(id),
        -- NULL for anonymous users (temporary identity)
    anonymous_token   VARCHAR(255),        -- For unauthenticated sessions
    urgency           VARCHAR(50) NOT NULL DEFAULT 'medium',
        -- low, medium, high, emergency
    urgency_reason    TEXT,                -- Patient's description
    presenting_issues TEXT[],             -- e.g., ['anxiety', 'panic']
    preferred_language VARCHAR(20) DEFAULT 'en',
    preferred_gender  VARCHAR(50),        -- no_preference, male, female, non_binary
    preferred_session_type VARCHAR(50) DEFAULT 'video',
        -- video, audio, chat
    budget_per_session DECIMAL(10,2),
    max_wait_minutes  INTEGER DEFAULT 30, -- How long patient will wait
    status            VARCHAR(50) DEFAULT 'pending',
        -- pending, broadcasting, matched, accepted, session_created,
        -- expired, cancelled, no_therapist_available
    match_count       INTEGER DEFAULT 0,  -- How many therapists were broadcast to
    accepted_match_id UUID,               -- FK to radar_matches (set when accepted)
    session_id        UUID REFERENCES sessions(id),  -- Created after acceptance
    metadata          JSONB,              -- AI intake responses, context
    expires_at        TIMESTAMPTZ,        -- Auto-expire if no match
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_requests_status     ON radar_requests(status);
CREATE INDEX IF NOT EXISTS idx_radar_requests_patient    ON radar_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_radar_requests_created    ON radar_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_radar_requests_expires    ON radar_requests(expires_at);

-- ============================================================
-- RADAR BROADCASTS
-- Records which therapists received a radar notification
-- ============================================================

CREATE TABLE IF NOT EXISTS radar_broadcasts (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id    UUID NOT NULL REFERENCES radar_requests(id) ON DELETE CASCADE,
    therapist_id  UUID NOT NULL REFERENCES therapists(id),
    broadcast_at  TIMESTAMPTZ DEFAULT NOW(),
    viewed_at     TIMESTAMPTZ,      -- When therapist saw the notification
    responded_at  TIMESTAMPTZ,      -- When therapist responded (accept/decline)
    response      VARCHAR(50),      -- accepted, declined, expired
    decline_reason TEXT,
    UNIQUE(request_id, therapist_id)
);

CREATE INDEX IF NOT EXISTS idx_radar_broadcasts_request   ON radar_broadcasts(request_id);
CREATE INDEX IF NOT EXISTS idx_radar_broadcasts_therapist ON radar_broadcasts(therapist_id);

-- ============================================================
-- RADAR MATCHES
-- AI-generated match scores between request and therapist
-- ============================================================

CREATE TABLE IF NOT EXISTS radar_matches (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id        UUID NOT NULL REFERENCES radar_requests(id) ON DELETE CASCADE,
    therapist_id      UUID NOT NULL REFERENCES therapists(id),
    match_score       FLOAT NOT NULL,      -- 0.0 to 1.0 overall match quality
    score_breakdown   JSONB,
        -- {
        --   "language_match": 1.0,
        --   "specialization_match": 0.9,
        --   "availability_score": 0.8,
        --   "response_time_score": 0.7,
        --   "budget_match": 1.0,
        --   "rating_score": 0.85,
        --   "historical_acceptance_rate": 0.9
        -- }
    rank              INTEGER,             -- 1 = best match
    accepted          BOOLEAN DEFAULT FALSE,
    accepted_at       TIMESTAMPTZ,
    session_created   BOOLEAN DEFAULT FALSE,
    status            VARCHAR(50) DEFAULT 'pending',
        -- pending, accepted, declined, expired
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(request_id, therapist_id)
);

CREATE INDEX IF NOT EXISTS idx_radar_matches_request   ON radar_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_radar_matches_therapist ON radar_matches(therapist_id);
CREATE INDEX IF NOT EXISTS idx_radar_matches_score     ON radar_matches(match_score DESC);

-- ============================================================
-- RADAR SESSIONS
-- Sessions that originated from Radar requests
-- ============================================================

CREATE TABLE IF NOT EXISTS radar_sessions (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id   UUID UNIQUE NOT NULL REFERENCES radar_requests(id),
    match_id     UUID NOT NULL REFERENCES radar_matches(id),
    session_id   UUID UNIQUE NOT NULL REFERENCES sessions(id),
    fee_amount   DECIMAL(10,2),
    fee_currency VARCHAR(10) DEFAULT 'USD',
    platform_fee DECIMAL(10,2),       -- 24Therapy commission
    therapist_payout DECIMAL(10,2),   -- Net to therapist
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RADAR THERAPIST SETTINGS
-- Per-therapist Radar availability and pricing
-- ============================================================

CREATE TABLE IF NOT EXISTS radar_therapist_settings (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id          UUID UNIQUE NOT NULL REFERENCES therapists(id),
    radar_enabled         BOOLEAN DEFAULT FALSE,
    radar_rate_per_session DECIMAL(10,2),
    radar_currency        VARCHAR(10) DEFAULT 'USD',
    radar_session_duration INTEGER DEFAULT 30,  -- minutes
    radar_available_now   BOOLEAN DEFAULT FALSE, -- Real-time availability toggle
    max_daily_radar       INTEGER DEFAULT 3,     -- Max Radar sessions per day
    auto_accept           BOOLEAN DEFAULT FALSE, -- Auto-accept if criteria met
    auto_accept_criteria  JSONB,
        -- { "min_match_score": 0.7, "urgency_levels": ["high", "emergency"] }
    notification_channels TEXT[] DEFAULT '{in_app, push}',
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RADAR ANALYTICS
-- Performance tracking for matching algorithm improvement
-- ============================================================

CREATE TABLE IF NOT EXISTS radar_analytics (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date                  DATE NOT NULL,
    organization_id       UUID REFERENCES organizations(id),
    total_requests        INTEGER DEFAULT 0,
    matched_requests      INTEGER DEFAULT 0,
    accepted_requests     INTEGER DEFAULT 0,
    session_completed     INTEGER DEFAULT 0,
    avg_wait_time_seconds INTEGER,          -- Time from request to acceptance
    avg_match_score       FLOAT,
    no_therapist_count    INTEGER DEFAULT 0, -- Requests with no available therapist
    emergency_count       INTEGER DEFAULT 0,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, organization_id)
);

-- ============================================================
-- RADAR THERAPIST AVAILABILITY LOGS
-- Track when therapists toggle availability (real-time feed)
-- ============================================================

CREATE TABLE IF NOT EXISTS radar_availability_log (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id UUID NOT NULL REFERENCES therapists(id),
    available    BOOLEAN NOT NULL,
    changed_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_radar_availability_therapist ON radar_availability_log(therapist_id, changed_at DESC);

-- ============================================================
-- RADAR NETWORK EFFECT TRACKING
-- Measures market liquidity in each region/language
-- ============================================================

CREATE TABLE IF NOT EXISTS radar_market_health (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date                    DATE NOT NULL,
    language                VARCHAR(20),
    country                 VARCHAR(100),
    active_therapists       INTEGER DEFAULT 0,
    requests_submitted      INTEGER DEFAULT 0,
    avg_response_time_min   FLOAT,
    match_rate_pct          FLOAT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, language, country)
);

-- ============================================================
-- FUNCTION: Auto-expire stale Radar requests
-- ============================================================

CREATE OR REPLACE FUNCTION expire_radar_requests()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE radar_requests
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('pending', 'broadcasting')
      AND expires_at < NOW();

    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Calculate therapist Radar match score
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_radar_match_score(
    p_request_id   UUID,
    p_therapist_id UUID
) RETURNS FLOAT AS $$
DECLARE
    v_request       radar_requests%ROWTYPE;
    v_therapist     therapists%ROWTYPE;
    v_settings      radar_therapist_settings%ROWTYPE;
    v_score         FLOAT := 0.0;
    v_language_score   FLOAT := 0.0;
    v_specialty_score  FLOAT := 0.0;
    v_budget_score     FLOAT := 0.0;
    v_rating_score     FLOAT := 0.0;
BEGIN
    SELECT * INTO v_request   FROM radar_requests WHERE id = p_request_id;
    SELECT * INTO v_therapist FROM therapists      WHERE id = p_therapist_id;
    SELECT * INTO v_settings  FROM radar_therapist_settings WHERE therapist_id = p_therapist_id;

    -- Language match (weight: 25%)
    IF v_request.preferred_language = ANY(v_therapist.languages) THEN
        v_language_score := 1.0;
    END IF;

    -- Specialization match (weight: 30%)
    IF v_request.presenting_issues && v_therapist.specializations THEN
        v_specialty_score := 0.8 +
            (array_length(
                ARRAY(SELECT unnest(v_request.presenting_issues) INTERSECT SELECT unnest(v_therapist.specializations)),
            1)::FLOAT /
            GREATEST(array_length(v_request.presenting_issues, 1), 1) * 0.2);
    END IF;

    -- Budget match (weight: 20%)
    IF v_request.budget_per_session IS NULL OR
       v_settings.radar_rate_per_session <= v_request.budget_per_session THEN
        v_budget_score := 1.0;
    ELSE
        v_budget_score := GREATEST(0, 1 - (v_settings.radar_rate_per_session - v_request.budget_per_session) / v_request.budget_per_session);
    END IF;

    -- Rating score (weight: 25%)
    v_rating_score := COALESCE(v_therapist.rating, 3.5) / 5.0;

    -- Composite score
    v_score := (v_language_score * 0.25) +
               (v_specialty_score * 0.30) +
               (v_budget_score * 0.20) +
               (v_rating_score * 0.25);

    RETURN ROUND(v_score::NUMERIC, 4);
END;
$$ LANGUAGE plpgsql;

-- Reviewed: 2026-06-13 — 24Therapy audit
