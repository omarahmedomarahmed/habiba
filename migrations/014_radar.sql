-- ============================================================
-- 014_radar.sql
-- 24Therapy — Radar Real-Time Matching Engine
-- Tables: radar_requests, radar_broadcasts, radar_matches,
--         radar_sessions, radar_therapist_settings,
--         radar_analytics, radar_availability_log,
--         radar_market_health
-- ============================================================

-- ------------------------------------------------------------
-- radar_requests
-- ------------------------------------------------------------
CREATE TABLE radar_requests (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id      UUID          REFERENCES organizations(id),
  patient_id           UUID          REFERENCES patients(id),
  anonymous_token      VARCHAR(255),
  urgency              VARCHAR(50)   NOT NULL DEFAULT 'medium',
  urgency_reason       TEXT,
  presenting_issues    TEXT[],
  preferred_language   VARCHAR(20)   NOT NULL DEFAULT 'en',
  preferred_gender     VARCHAR(50),
  preferred_session_type VARCHAR(50) NOT NULL DEFAULT 'video',
  budget_per_session   NUMERIC(10,2),
  max_wait_minutes     INTEGER       NOT NULL DEFAULT 30,
  status               VARCHAR(50)   NOT NULL DEFAULT 'pending',
  match_count          INTEGER       NOT NULL DEFAULT 0,
  accepted_match_id    UUID,
  session_id           UUID          REFERENCES sessions(id),
  metadata             JSONB,
  expires_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_radar_requests_status      ON radar_requests (status);
CREATE INDEX idx_radar_requests_patient_id  ON radar_requests (patient_id);
CREATE INDEX idx_radar_requests_created_at  ON radar_requests (created_at DESC);
CREATE INDEX idx_radar_requests_expires_at  ON radar_requests (expires_at);

CREATE TRIGGER trg_radar_requests_updated_at
  BEFORE UPDATE ON radar_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- radar_broadcasts
-- ------------------------------------------------------------
CREATE TABLE radar_broadcasts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id    UUID        NOT NULL REFERENCES radar_requests(id) ON DELETE CASCADE,
  therapist_id  UUID        NOT NULL REFERENCES therapists(id),
  broadcast_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewed_at     TIMESTAMPTZ,
  responded_at  TIMESTAMPTZ,
  response      VARCHAR(50),
  decline_reason TEXT,
  CONSTRAINT radar_broadcasts_unique UNIQUE (request_id, therapist_id)
);

CREATE INDEX idx_radar_broadcasts_request_id   ON radar_broadcasts (request_id);
CREATE INDEX idx_radar_broadcasts_therapist_id ON radar_broadcasts (therapist_id);

-- ------------------------------------------------------------
-- radar_matches
-- ------------------------------------------------------------
CREATE TABLE radar_matches (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id       UUID        NOT NULL REFERENCES radar_requests(id) ON DELETE CASCADE,
  therapist_id     UUID        NOT NULL REFERENCES therapists(id),
  match_score      FLOAT       NOT NULL,
  score_breakdown  JSONB,
  rank             INTEGER,
  accepted         BOOLEAN     NOT NULL DEFAULT FALSE,
  accepted_at      TIMESTAMPTZ,
  session_created  BOOLEAN     NOT NULL DEFAULT FALSE,
  status           VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT radar_matches_unique UNIQUE (request_id, therapist_id)
);

CREATE INDEX idx_radar_matches_request_id    ON radar_matches (request_id);
CREATE INDEX idx_radar_matches_therapist_id  ON radar_matches (therapist_id);
CREATE INDEX idx_radar_matches_score_desc    ON radar_matches (match_score DESC);

-- ------------------------------------------------------------
-- radar_sessions
-- ------------------------------------------------------------
CREATE TABLE radar_sessions (
  id               UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id       UUID          NOT NULL REFERENCES radar_requests(id),
  match_id         UUID          NOT NULL REFERENCES radar_matches(id),
  session_id       UUID          NOT NULL REFERENCES sessions(id),
  fee_amount       NUMERIC(10,2),
  fee_currency     VARCHAR(10)   NOT NULL DEFAULT 'USD',
  platform_fee     NUMERIC(10,2),
  therapist_payout NUMERIC(10,2),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT radar_sessions_request_unique UNIQUE (request_id),
  CONSTRAINT radar_sessions_session_unique UNIQUE (session_id)
);

-- ------------------------------------------------------------
-- radar_therapist_settings
-- ------------------------------------------------------------
CREATE TABLE radar_therapist_settings (
  id                     UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id           UUID          NOT NULL REFERENCES therapists(id),
  radar_enabled          BOOLEAN       NOT NULL DEFAULT FALSE,
  radar_rate_per_session NUMERIC(10,2),
  radar_currency         VARCHAR(10)   NOT NULL DEFAULT 'USD',
  radar_session_duration INTEGER       NOT NULL DEFAULT 30,
  radar_available_now    BOOLEAN       NOT NULL DEFAULT FALSE,
  max_daily_radar        INTEGER       NOT NULL DEFAULT 3,
  auto_accept            BOOLEAN       NOT NULL DEFAULT FALSE,
  auto_accept_criteria   JSONB,
  notification_channels  TEXT[]        NOT NULL DEFAULT '{in_app,push}',
  created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT radar_therapist_settings_unique UNIQUE (therapist_id)
);

CREATE TRIGGER trg_radar_therapist_settings_updated_at
  BEFORE UPDATE ON radar_therapist_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- radar_analytics
-- ------------------------------------------------------------
CREATE TABLE radar_analytics (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  date              DATE        NOT NULL,
  organization_id   UUID        REFERENCES organizations(id),
  total_requests    INTEGER     NOT NULL DEFAULT 0,
  matched_requests  INTEGER     NOT NULL DEFAULT 0,
  accepted_requests INTEGER     NOT NULL DEFAULT 0,
  session_completed INTEGER     NOT NULL DEFAULT 0,
  avg_wait_time_seconds INTEGER,
  avg_match_score   FLOAT,
  no_therapist_count INTEGER    NOT NULL DEFAULT 0,
  emergency_count   INTEGER     NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT radar_analytics_date_org_unique UNIQUE (date, organization_id)
);

-- ------------------------------------------------------------
-- radar_availability_log
-- ------------------------------------------------------------
CREATE TABLE radar_availability_log (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID        NOT NULL REFERENCES therapists(id),
  available    BOOLEAN     NOT NULL,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_radar_availability_log_therapist ON radar_availability_log (therapist_id, changed_at DESC);

-- ------------------------------------------------------------
-- radar_market_health
-- ------------------------------------------------------------
CREATE TABLE radar_market_health (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  date                DATE        NOT NULL,
  language            VARCHAR(20),
  country             VARCHAR(100),
  active_therapists   INTEGER     NOT NULL DEFAULT 0,
  requests_submitted  INTEGER     NOT NULL DEFAULT 0,
  avg_response_time_min FLOAT,
  match_rate_pct      FLOAT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT radar_market_health_unique UNIQUE (date, language, country)
);

-- ------------------------------------------------------------
-- expire_radar_requests()
-- Mark stale/expired pending requests as 'expired'.
-- Called by a cron job.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION expire_radar_requests()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE radar_requests
  SET    status     = 'expired',
         updated_at = NOW()
  WHERE  status    = 'pending'
    AND  expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- calculate_radar_match_score()
-- Basic scoring: language match (40pt), urgency match (30pt),
-- availability (20pt), session type (10pt).
-- Returns 0-100 float.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_radar_match_score(
  p_request_id  UUID,
  p_therapist_id UUID
)
RETURNS FLOAT AS $$
DECLARE
  v_request  radar_requests%ROWTYPE;
  v_settings radar_therapist_settings%ROWTYPE;
  v_score    FLOAT := 0;
BEGIN
  SELECT * INTO v_request  FROM radar_requests          WHERE id = p_request_id;
  SELECT * INTO v_settings FROM radar_therapist_settings WHERE therapist_id = p_therapist_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Language match (40 points)
  IF EXISTS (
    SELECT 1 FROM therapists t
    WHERE  t.id = p_therapist_id
      AND  v_request.preferred_language = ANY(t.languages)
  ) THEN
    v_score := v_score + 40;
  END IF;

  -- Therapist radar-available (20 points)
  IF v_settings.radar_available_now = TRUE AND v_settings.radar_enabled = TRUE THEN
    v_score := v_score + 20;
  END IF;

  -- Session type match (10 points)
  IF v_settings.radar_session_duration IS NOT NULL THEN
    v_score := v_score + 10;
  END IF;

  -- Urgency bonus: high/emergency requests prefer available therapists (30 points)
  IF v_request.urgency IN ('high', 'emergency') AND v_settings.radar_available_now = TRUE THEN
    v_score := v_score + 30;
  ELSIF v_request.urgency = 'medium' THEN
    v_score := v_score + 15;
  END IF;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;
