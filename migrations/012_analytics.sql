-- ============================================================
-- 012_analytics.sql
-- 24Therapy — Analytics: Partitioned Events + Cost Tracking,
--             Daily/Performance/Outcome/Practice/AI Metrics,
--             Funnel Events
-- ============================================================

-- ------------------------------------------------------------
-- analytics_events  (RANGE-partitioned by created_at)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS analytics_events (
  id              UUID         NOT NULL DEFAULT uuid_generate_v4(),
  organization_id UUID         REFERENCES organizations(id),
  user_id         UUID         REFERENCES users(id),
  patient_id      UUID         REFERENCES patients(id),
  therapist_id    UUID         REFERENCES therapists(id),
  session_id      UUID         REFERENCES sessions(id),
  event_name      VARCHAR(255) NOT NULL,
  event_category  VARCHAR(100),
  properties      JSONB        NOT NULL DEFAULT '{}',
  platform        VARCHAR(50),
  app_version     VARCHAR(50),
  anonymous_id    VARCHAR(255),
  ip_address      INET,
  user_agent      TEXT,
  referrer        TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS analytics_events_2025
  PARTITION OF analytics_events
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS analytics_events_2026
  PARTITION OF analytics_events
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS analytics_events_2027
  PARTITION OF analytics_events
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE INDEX IF NOT EXISTS idx_analytics_events_org_created    ON analytics_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created   ON analytics_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created   ON analytics_events (event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_desc   ON analytics_events (created_at DESC);

-- ------------------------------------------------------------
-- ai_cost_tracking  (RANGE-partitioned by created_at)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_cost_tracking (
  id                UUID          NOT NULL DEFAULT uuid_generate_v4(),
  organization_id   UUID          NOT NULL REFERENCES organizations(id),
  therapist_id      UUID          REFERENCES therapists(id),
  session_id        UUID          REFERENCES sessions(id),
  agent_type        VARCHAR(100)  NOT NULL,
  model_provider    VARCHAR(50)   NOT NULL,
  model_name        VARCHAR(100)  NOT NULL,
  prompt_key        VARCHAR(100),
  prompt_tokens     INTEGER       NOT NULL DEFAULT 0,
  completion_tokens INTEGER       NOT NULL DEFAULT 0,
  total_tokens      INTEGER       NOT NULL DEFAULT 0,
  input_cost_usd    NUMERIC(10,8) NOT NULL DEFAULT 0,
  output_cost_usd   NUMERIC(10,8) NOT NULL DEFAULT 0,
  total_cost_usd    NUMERIC(10,8) NOT NULL DEFAULT 0,
  latency_ms        INTEGER,
  success           BOOLEAN       NOT NULL DEFAULT TRUE,
  error_type        VARCHAR(100),
  billing_month     VARCHAR(7),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS ai_cost_tracking_2025
  PARTITION OF ai_cost_tracking
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS ai_cost_tracking_2026
  PARTITION OF ai_cost_tracking
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE TABLE IF NOT EXISTS ai_cost_tracking_2027
  PARTITION OF ai_cost_tracking
  FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');

CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_org_created   ON ai_cost_tracking (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_model_created ON ai_cost_tracking (model_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_billing_month ON ai_cost_tracking (billing_month);

-- ------------------------------------------------------------
-- daily_metrics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_metrics (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  date                  DATE          NOT NULL,
  organization_id       UUID          NOT NULL REFERENCES organizations(id),
  sessions_scheduled    INTEGER       NOT NULL DEFAULT 0,
  sessions_completed    INTEGER       NOT NULL DEFAULT 0,
  sessions_cancelled    INTEGER       NOT NULL DEFAULT 0,
  sessions_no_show      INTEGER       NOT NULL DEFAULT 0,
  session_minutes_total INTEGER       NOT NULL DEFAULT 0,
  patients_active       INTEGER       NOT NULL DEFAULT 0,
  patients_new          INTEGER       NOT NULL DEFAULT 0,
  patients_churned      INTEGER       NOT NULL DEFAULT 0,
  notes_generated       INTEGER       NOT NULL DEFAULT 0,
  notes_approved        INTEGER       NOT NULL DEFAULT 0,
  notes_rejected        INTEGER       NOT NULL DEFAULT 0,
  notes_edited          INTEGER       NOT NULL DEFAULT 0,
  memories_created      INTEGER       NOT NULL DEFAULT 0,
  transcripts_processed INTEGER       NOT NULL DEFAULT 0,
  revenue_usd           NUMERIC(10,2) NOT NULL DEFAULT 0,
  sessions_fees_usd     NUMERIC(10,2) NOT NULL DEFAULT 0,
  ai_cost_usd           NUMERIC(10,6) NOT NULL DEFAULT 0,
  ai_tokens_used        INTEGER       NOT NULL DEFAULT 0,
  active_therapists     INTEGER       NOT NULL DEFAULT 0,
  logins_count          INTEGER       NOT NULL DEFAULT 0,
  marketplace_views     INTEGER       NOT NULL DEFAULT 0,
  marketplace_bookings  INTEGER       NOT NULL DEFAULT 0,
  radar_requests        INTEGER       NOT NULL DEFAULT 0,
  radar_matched         INTEGER       NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT daily_metrics_date_org_unique UNIQUE (date, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date_desc      ON daily_metrics (date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_org_date_desc  ON daily_metrics (organization_id, date DESC);

-- ------------------------------------------------------------
-- platform_daily_metrics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_daily_metrics (
  id                       UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  date                     DATE          NOT NULL,
  total_organizations      INTEGER       NOT NULL DEFAULT 0,
  new_organizations        INTEGER       NOT NULL DEFAULT 0,
  total_therapists         INTEGER       NOT NULL DEFAULT 0,
  new_therapists           INTEGER       NOT NULL DEFAULT 0,
  total_patients           INTEGER       NOT NULL DEFAULT 0,
  new_patients             INTEGER       NOT NULL DEFAULT 0,
  dau                      INTEGER       NOT NULL DEFAULT 0,
  wau                      INTEGER       NOT NULL DEFAULT 0,
  mau                      INTEGER       NOT NULL DEFAULT 0,
  sessions_today           INTEGER       NOT NULL DEFAULT 0,
  session_minutes_today    INTEGER       NOT NULL DEFAULT 0,
  notes_generated_today    INTEGER       NOT NULL DEFAULT 0,
  mrr_usd                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  arr_usd                  NUMERIC(12,2) NOT NULL DEFAULT 0,
  revenue_today_usd        NUMERIC(10,2) NOT NULL DEFAULT 0,
  ai_cost_today_usd        NUMERIC(10,4) NOT NULL DEFAULT 0,
  infrastructure_cost_usd  NUMERIC(10,2) NOT NULL DEFAULT 0,
  avg_sessions_per_therapist FLOAT,
  avg_ai_cost_per_session  NUMERIC(10,4),
  note_acceptance_rate     FLOAT,
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT platform_daily_metrics_date_unique UNIQUE (date)
);

-- ------------------------------------------------------------
-- therapist_performance_metrics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_performance_metrics (
  id                          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id                UUID          NOT NULL REFERENCES therapists(id),
  organization_id             UUID          NOT NULL REFERENCES organizations(id),
  period_type                 VARCHAR(20)   NOT NULL,
  period_start                DATE          NOT NULL,
  period_end                  DATE          NOT NULL,
  sessions_scheduled          INTEGER       NOT NULL DEFAULT 0,
  sessions_completed          INTEGER       NOT NULL DEFAULT 0,
  sessions_cancelled          INTEGER       NOT NULL DEFAULT 0,
  sessions_no_show            INTEGER       NOT NULL DEFAULT 0,
  completion_rate             FLOAT         NOT NULL DEFAULT 0,
  patients_active             INTEGER       NOT NULL DEFAULT 0,
  patients_new                INTEGER       NOT NULL DEFAULT 0,
  patient_retention_rate      FLOAT         NOT NULL DEFAULT 0,
  notes_generated             INTEGER       NOT NULL DEFAULT 0,
  notes_approved_first_try    INTEGER       NOT NULL DEFAULT 0,
  avg_note_edit_time_min      FLOAT,
  documentation_lag_hours     FLOAT,
  revenue_gross_usd           NUMERIC(10,2) NOT NULL DEFAULT 0,
  revenue_net_usd             NUMERIC(10,2) NOT NULL DEFAULT 0,
  assessments_administered    INTEGER       NOT NULL DEFAULT 0,
  radar_requests_received     INTEGER       NOT NULL DEFAULT 0,
  radar_requests_accepted     INTEGER       NOT NULL DEFAULT 0,
  radar_acceptance_rate       FLOAT         NOT NULL DEFAULT 0,
  avg_radar_response_time_sec INTEGER,
  avg_patient_rating          FLOAT,
  new_reviews_count           INTEGER       NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT therapist_perf_metrics_unique UNIQUE (therapist_id, period_type, period_start)
);

-- ------------------------------------------------------------
-- patient_outcome_metrics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_outcome_metrics (
  id                        UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id                UUID        NOT NULL REFERENCES patients(id),
  therapist_id              UUID        NOT NULL REFERENCES therapists(id),
  organization_id           UUID        NOT NULL REFERENCES organizations(id),
  measurement_date          DATE        NOT NULL,
  total_sessions            INTEGER     NOT NULL DEFAULT 0,
  attended_sessions         INTEGER     NOT NULL DEFAULT 0,
  attendance_rate           FLOAT       NOT NULL DEFAULT 0,
  latest_phq9_score         FLOAT,
  latest_gad7_score         FLOAT,
  phq9_change_from_baseline FLOAT,
  gad7_change_from_baseline FLOAT,
  total_goals               INTEGER     NOT NULL DEFAULT 0,
  completed_goals           INTEGER     NOT NULL DEFAULT 0,
  goal_completion_rate      FLOAT       NOT NULL DEFAULT 0,
  days_in_treatment         INTEGER     NOT NULL DEFAULT 0,
  days_since_last_session   INTEGER     NOT NULL DEFAULT 0,
  overall_status            VARCHAR(50),
  risk_level                VARCHAR(50),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT patient_outcome_metrics_unique UNIQUE (patient_id, measurement_date)
);

-- ------------------------------------------------------------
-- practice_health_metrics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS practice_health_metrics (
  id                          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id             UUID          NOT NULL REFERENCES organizations(id),
  period_type                 VARCHAR(20)   NOT NULL,
  period_start                DATE          NOT NULL,
  period_end                  DATE          NOT NULL,
  total_therapists            INTEGER       NOT NULL DEFAULT 0,
  active_therapists           INTEGER       NOT NULL DEFAULT 0,
  total_patients              INTEGER       NOT NULL DEFAULT 0,
  active_patients             INTEGER       NOT NULL DEFAULT 0,
  sessions_scheduled          INTEGER       NOT NULL DEFAULT 0,
  sessions_completed          INTEGER       NOT NULL DEFAULT 0,
  utilization_rate            FLOAT         NOT NULL DEFAULT 0,
  gross_revenue_usd           NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_revenue_usd             NUMERIC(12,2) NOT NULL DEFAULT 0,
  revenue_per_therapist       NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes_pending               INTEGER       NOT NULL DEFAULT 0,
  avg_documentation_lag_hours FLOAT,
  documentation_complete_rate FLOAT,
  avg_attendance_rate         FLOAT,
  avg_phq9_improvement        FLOAT,
  avg_gad7_improvement        FLOAT,
  high_risk_patients          INTEGER       NOT NULL DEFAULT 0,
  new_patients_acquired       INTEGER       NOT NULL DEFAULT 0,
  patients_discharged         INTEGER       NOT NULL DEFAULT 0,
  patient_churn_rate          FLOAT         NOT NULL DEFAULT 0,
  ai_note_acceptance_rate     FLOAT,
  ai_cost_per_session_usd     NUMERIC(10,4),
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT practice_health_metrics_unique UNIQUE (organization_id, period_type, period_start)
);

-- ------------------------------------------------------------
-- ai_model_metrics
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_model_metrics (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  date                  DATE          NOT NULL,
  model_name            VARCHAR(100)  NOT NULL,
  agent_type            VARCHAR(100)  NOT NULL,
  total_requests        INTEGER       NOT NULL DEFAULT 0,
  successful_requests   INTEGER       NOT NULL DEFAULT 0,
  failed_requests       INTEGER       NOT NULL DEFAULT 0,
  acceptance_rate       FLOAT,
  minor_edit_rate       FLOAT,
  major_edit_rate       FLOAT,
  rejection_rate        FLOAT,
  avg_latency_ms        INTEGER,
  p95_latency_ms        INTEGER,
  p99_latency_ms        INTEGER,
  total_tokens          BIGINT        NOT NULL DEFAULT 0,
  total_cost_usd        NUMERIC(10,4) NOT NULL DEFAULT 0,
  avg_cost_per_request  NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT ai_model_metrics_unique UNIQUE (date, model_name, agent_type)
);

-- ------------------------------------------------------------
-- funnel_events
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funnel_events (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_name     VARCHAR(100) NOT NULL,
  step_name       VARCHAR(100) NOT NULL,
  step_order      INTEGER      NOT NULL,
  user_id         UUID         REFERENCES users(id),
  organization_id UUID         REFERENCES organizations(id),
  anonymous_id    VARCHAR(255),
  properties      JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel_step  ON funnel_events (funnel_name, step_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_user_funnel  ON funnel_events (user_id, funnel_name);
