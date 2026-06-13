-- ============================================================
-- 014_analytics_schema.sql
-- 24Therapy.ai — Analytics, Events, Metrics, AI Cost Tracking,
--                Business Intelligence, Practice Dashboards
-- ============================================================
-- Covers:
-- - Platform event tracking
-- - Product analytics metrics
-- - AI cost tracking and optimization
-- - Practice health metrics
-- - Therapist performance metrics
-- - Patient outcome metrics
-- - Executive dashboard data
-- ============================================================
-- Depends on: 001_core_schema.sql, 002_therapists_schema.sql,
--             003_patients_schema.sql, 006_sessions_schema.sql
-- ============================================================

-- ============================================================
-- ANALYTICS EVENTS
-- Raw event stream for product analytics (PostHog-style)
-- ============================================================

CREATE TABLE IF NOT EXISTS analytics_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    user_id         UUID REFERENCES users(id),
    patient_id      UUID REFERENCES patients(id),
    therapist_id    UUID REFERENCES therapists(id),
    session_id      UUID REFERENCES sessions(id),
    -- Event details
    event_name      VARCHAR(255) NOT NULL,
        -- Naming convention: object.action
        -- Examples:
        --   user.signed_up, user.logged_in, user.logged_out
        --   patient.created, patient.viewed, patient.exported
        --   session.scheduled, session.started, session.completed, session.cancelled
        --   note.generated, note.approved, note.edited, note.rejected
        --   memory.created, memory.updated, memory.viewed
        --   assessment.sent, assessment.completed, assessment.scored
        --   radar.requested, radar.matched, radar.accepted, radar.expired
        --   subscription.started, subscription.upgraded, subscription.cancelled
        --   report.generated, report.signed, report.shared
        --   ai.transcription_started, ai.note_generated, ai.copilot_suggestion
    event_category  VARCHAR(100),
        -- engagement, clinical, billing, ai, marketplace, compliance
    -- Context
    properties      JSONB DEFAULT '{}',
        -- Arbitrary event properties
        -- { "plan": "professional", "note_type": "SOAP", "duration_ms": 2500 }
    -- Source
    platform        VARCHAR(50),
        -- web, mobile_ios, mobile_android, api
    app_version     VARCHAR(50),
    -- Session tracking
    anonymous_id    VARCHAR(255),   -- For pre-auth tracking
    ip_address      INET,
    user_agent      TEXT,
    referrer        TEXT,
    -- Timing
    created_at      TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create initial partitions
CREATE TABLE IF NOT EXISTS analytics_events_2024 PARTITION OF analytics_events
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS analytics_events_2025 PARTITION OF analytics_events
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS analytics_events_2026 PARTITION OF analytics_events
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX IF NOT EXISTS idx_events_organization ON analytics_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user         ON analytics_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_event_name   ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created      ON analytics_events(created_at DESC);

-- ============================================================
-- AI USAGE & COST TRACKING
-- Per-request cost tracking for model optimization
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_cost_tracking (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id   UUID NOT NULL REFERENCES organizations(id),
    therapist_id      UUID REFERENCES therapists(id),
    session_id        UUID REFERENCES sessions(id),
    -- Request details
    agent_type        VARCHAR(100) NOT NULL,
        -- transcription, documentation, memory, copilot, risk_detection,
        --   matching, summarization, classification, embedding, search
    model_provider    VARCHAR(50) NOT NULL,
        -- openai, anthropic, google, azure, whisper, assembly_ai
    model_name        VARCHAR(100) NOT NULL,
        -- gpt-4o, claude-3-5-sonnet, whisper-1, text-embedding-3-large
    prompt_key        VARCHAR(100),  -- Reference to prompt_registry
    -- Token usage
    prompt_tokens     INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens      INTEGER DEFAULT 0,
    -- Cost (USD)
    input_cost_usd    DECIMAL(10,8) DEFAULT 0,
    output_cost_usd   DECIMAL(10,8) DEFAULT 0,
    total_cost_usd    DECIMAL(10,8) DEFAULT 0,
    -- Performance
    latency_ms        INTEGER,
    success           BOOLEAN DEFAULT TRUE,
    error_type        VARCHAR(100),
    -- Metadata
    billing_month     VARCHAR(7),  -- YYYY-MM for monthly aggregation
    created_at        TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS ai_cost_tracking_2024 PARTITION OF ai_cost_tracking
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE IF NOT EXISTS ai_cost_tracking_2025 PARTITION OF ai_cost_tracking
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS ai_cost_tracking_2026 PARTITION OF ai_cost_tracking
    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

CREATE INDEX IF NOT EXISTS idx_ai_cost_organization ON ai_cost_tracking(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_model        ON ai_cost_tracking(model_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_billing      ON ai_cost_tracking(billing_month);

-- ============================================================
-- DAILY METRICS (Pre-aggregated for dashboard performance)
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_metrics (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date                    DATE NOT NULL,
    organization_id         UUID NOT NULL REFERENCES organizations(id),
    -- Session metrics
    sessions_scheduled      INTEGER DEFAULT 0,
    sessions_completed      INTEGER DEFAULT 0,
    sessions_cancelled      INTEGER DEFAULT 0,
    sessions_no_show        INTEGER DEFAULT 0,
    session_minutes_total   INTEGER DEFAULT 0,
    -- Patient metrics
    patients_active         INTEGER DEFAULT 0,
    patients_new            INTEGER DEFAULT 0,
    patients_churned        INTEGER DEFAULT 0,
    -- AI metrics
    notes_generated         INTEGER DEFAULT 0,
    notes_approved          INTEGER DEFAULT 0,
    notes_rejected          INTEGER DEFAULT 0,
    notes_edited            INTEGER DEFAULT 0,
    memories_created        INTEGER DEFAULT 0,
    transcripts_processed   INTEGER DEFAULT 0,
    -- Revenue metrics
    revenue_usd             DECIMAL(10,2) DEFAULT 0,
    sessions_fees_usd       DECIMAL(10,2) DEFAULT 0,
    -- AI cost metrics
    ai_cost_usd             DECIMAL(10,6) DEFAULT 0,
    ai_tokens_used          INTEGER DEFAULT 0,
    -- User metrics
    active_therapists       INTEGER DEFAULT 0,
    logins_count            INTEGER DEFAULT 0,
    -- Marketplace metrics
    marketplace_views       INTEGER DEFAULT 0,
    marketplace_bookings    INTEGER DEFAULT 0,
    radar_requests          INTEGER DEFAULT 0,
    radar_matched           INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date         ON daily_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_organization ON daily_metrics(organization_id, date DESC);

-- ============================================================
-- PLATFORM-LEVEL DAILY METRICS (Across all orgs)
-- ============================================================

CREATE TABLE IF NOT EXISTS platform_daily_metrics (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date                    DATE UNIQUE NOT NULL,
    -- Growth metrics
    total_organizations     INTEGER DEFAULT 0,
    new_organizations       INTEGER DEFAULT 0,
    total_therapists        INTEGER DEFAULT 0,
    new_therapists          INTEGER DEFAULT 0,
    total_patients          INTEGER DEFAULT 0,
    new_patients            INTEGER DEFAULT 0,
    -- Engagement metrics
    dau                     INTEGER DEFAULT 0,  -- Daily Active Users
    wau                     INTEGER DEFAULT 0,  -- Weekly Active Users
    mau                     INTEGER DEFAULT 0,  -- Monthly Active Users
    -- Clinical metrics
    sessions_today          INTEGER DEFAULT 0,
    session_minutes_today   INTEGER DEFAULT 0,
    notes_generated_today   INTEGER DEFAULT 0,
    -- Revenue metrics
    mrr_usd                 DECIMAL(12,2) DEFAULT 0,
    arr_usd                 DECIMAL(12,2) DEFAULT 0,
    revenue_today_usd       DECIMAL(10,2) DEFAULT 0,
    -- Cost metrics
    ai_cost_today_usd       DECIMAL(10,4) DEFAULT 0,
    infrastructure_cost_usd DECIMAL(10,2) DEFAULT 0,
    -- Key ratios
    avg_sessions_per_therapist FLOAT,
    avg_ai_cost_per_session    DECIMAL(10,4),
    note_acceptance_rate       FLOAT,   -- % approved without major edit
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- THERAPIST PERFORMANCE METRICS
-- Private metrics for therapist and practice owner dashboards
-- ============================================================

CREATE TABLE IF NOT EXISTS therapist_performance_metrics (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id            UUID NOT NULL REFERENCES therapists(id),
    organization_id         UUID NOT NULL REFERENCES organizations(id),
    period_type             VARCHAR(20) NOT NULL,  -- daily, weekly, monthly
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    -- Session metrics
    sessions_scheduled      INTEGER DEFAULT 0,
    sessions_completed      INTEGER DEFAULT 0,
    sessions_cancelled      INTEGER DEFAULT 0,
    sessions_no_show        INTEGER DEFAULT 0,
    completion_rate         FLOAT DEFAULT 0,   -- completed / scheduled
    -- Patient metrics
    patients_active         INTEGER DEFAULT 0,
    patients_new            INTEGER DEFAULT 0,
    patient_retention_rate  FLOAT DEFAULT 0,
    -- Documentation metrics
    notes_generated         INTEGER DEFAULT 0,
    notes_approved_first_try INTEGER DEFAULT 0,
    avg_note_edit_time_min  FLOAT,
    documentation_lag_hours FLOAT,  -- Avg hours from session end to note approval
    -- Revenue metrics
    revenue_gross_usd       DECIMAL(10,2) DEFAULT 0,
    revenue_net_usd         DECIMAL(10,2) DEFAULT 0,
    -- Assessment metrics
    assessments_administered INTEGER DEFAULT 0,
    -- Radar metrics
    radar_requests_received INTEGER DEFAULT 0,
    radar_requests_accepted INTEGER DEFAULT 0,
    radar_acceptance_rate   FLOAT DEFAULT 0,
    avg_radar_response_time_sec INTEGER,
    -- Satisfaction
    avg_patient_rating      FLOAT,
    new_reviews_count       INTEGER DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(therapist_id, period_type, period_start)
);

-- ============================================================
-- PATIENT OUTCOME METRICS
-- Track treatment progress and outcomes over time
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_outcome_metrics (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id              UUID NOT NULL REFERENCES patients(id),
    therapist_id            UUID NOT NULL REFERENCES therapists(id),
    organization_id         UUID NOT NULL REFERENCES organizations(id),
    measurement_date        DATE NOT NULL,
    -- Session engagement
    total_sessions          INTEGER DEFAULT 0,
    attended_sessions       INTEGER DEFAULT 0,
    attendance_rate         FLOAT DEFAULT 0,
    -- Assessment trends
    latest_phq9_score       FLOAT,
    latest_gad7_score       FLOAT,
    phq9_change_from_baseline FLOAT,  -- Negative = improvement
    gad7_change_from_baseline FLOAT,
    -- Goal progress
    total_goals             INTEGER DEFAULT 0,
    completed_goals         INTEGER DEFAULT 0,
    goal_completion_rate    FLOAT DEFAULT 0,
    -- Treatment continuity
    days_in_treatment       INTEGER DEFAULT 0,
    days_since_last_session INTEGER DEFAULT 0,
    -- Overall status
    overall_status          VARCHAR(50),
        -- improving, stable, needs_attention, inactive, discharged
    risk_level              VARCHAR(50),  -- low, moderate, high, critical
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_id, measurement_date)
);

-- ============================================================
-- PRACTICE HEALTH DASHBOARD METRICS
-- Aggregated view for practice owners
-- ============================================================

CREATE TABLE IF NOT EXISTS practice_health_metrics (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id       UUID NOT NULL REFERENCES organizations(id),
    period_type           VARCHAR(20) NOT NULL,  -- weekly, monthly, quarterly
    period_start          DATE NOT NULL,
    period_end            DATE NOT NULL,
    -- Capacity
    total_therapists      INTEGER DEFAULT 0,
    active_therapists     INTEGER DEFAULT 0,
    total_patients        INTEGER DEFAULT 0,
    active_patients       INTEGER DEFAULT 0,
    -- Utilization
    sessions_scheduled    INTEGER DEFAULT 0,
    sessions_completed    INTEGER DEFAULT 0,
    utilization_rate      FLOAT DEFAULT 0,  -- completed / capacity
    -- Revenue
    gross_revenue_usd     DECIMAL(12,2) DEFAULT 0,
    net_revenue_usd       DECIMAL(12,2) DEFAULT 0,
    revenue_per_therapist DECIMAL(10,2) DEFAULT 0,
    -- Documentation health
    notes_pending         INTEGER DEFAULT 0,
    avg_documentation_lag_hours FLOAT,
    documentation_complete_rate FLOAT,
    -- Patient outcomes
    avg_attendance_rate   FLOAT,
    avg_phq9_improvement  FLOAT,
    avg_gad7_improvement  FLOAT,
    high_risk_patients    INTEGER DEFAULT 0,
    -- Growth
    new_patients_acquired INTEGER DEFAULT 0,
    patients_discharged   INTEGER DEFAULT 0,
    patient_churn_rate    FLOAT DEFAULT 0,
    -- AI performance
    ai_note_acceptance_rate FLOAT,
    ai_cost_per_session_usd DECIMAL(10,4),
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, period_type, period_start)
);

-- ============================================================
-- AI MODEL PERFORMANCE METRICS
-- Track model accuracy and quality over time
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_model_metrics (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date                    DATE NOT NULL,
    model_name              VARCHAR(100) NOT NULL,
    agent_type              VARCHAR(100) NOT NULL,
    -- Volume
    total_requests          INTEGER DEFAULT 0,
    successful_requests     INTEGER DEFAULT 0,
    failed_requests         INTEGER DEFAULT 0,
    -- Quality (based on therapist feedback)
    acceptance_rate         FLOAT,  -- % accepted without edit
    minor_edit_rate         FLOAT,  -- % with minor edits
    major_edit_rate         FLOAT,  -- % with major edits
    rejection_rate          FLOAT,  -- % rejected/regenerated
    -- Performance
    avg_latency_ms          INTEGER,
    p95_latency_ms          INTEGER,
    p99_latency_ms          INTEGER,
    -- Cost
    total_tokens            BIGINT DEFAULT 0,
    total_cost_usd          DECIMAL(10,4) DEFAULT 0,
    avg_cost_per_request    DECIMAL(10,6) DEFAULT 0,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, model_name, agent_type)
);

-- ============================================================
-- FUNNEL ANALYTICS
-- Track conversion through key user journeys
-- ============================================================

CREATE TABLE IF NOT EXISTS funnel_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    funnel_name     VARCHAR(100) NOT NULL,
        -- therapist_onboarding, patient_booking, marketplace_conversion,
        --   subscription_upgrade, radar_session
    step_name       VARCHAR(100) NOT NULL,
        -- Step in the funnel (e.g., visit, signup, activation, payment)
    step_order      INTEGER NOT NULL,
    user_id         UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id),
    anonymous_id    VARCHAR(255),
    properties      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel ON funnel_events(funnel_name, step_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_user   ON funnel_events(user_id, funnel_name);

-- ============================================================
-- FUNCTION: Track analytics event
-- ============================================================

CREATE OR REPLACE FUNCTION track_event(
    p_event_name      VARCHAR,
    p_user_id         UUID DEFAULT NULL,
    p_organization_id UUID DEFAULT NULL,
    p_properties      JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO analytics_events (event_name, user_id, organization_id, properties)
    VALUES (p_event_name, p_user_id, p_organization_id, p_properties)
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- MATERIALIZED VIEW: Organization MRR Summary
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS org_mrr_summary AS
SELECT
    o.id AS organization_id,
    o.name,
    sp.plan_key,
    sp.monthly_price_usd,
    s.status AS subscription_status,
    s.billing_cycle,
    CASE s.billing_cycle
        WHEN 'annual'  THEN sp.annual_price_usd / 12
        ELSE sp.monthly_price_usd
    END AS mrr_usd,
    s.current_period_end,
    s.trial_ends_at
FROM organizations o
JOIN subscriptions s ON s.organization_id = o.id
JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE s.status IN ('active', 'trial')
  AND o.deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_mrr_summary ON org_mrr_summary(organization_id);

-- ============================================================
-- FUNCTION: Refresh analytics materialized views
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY org_mrr_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Compute daily organization metrics
-- Called by scheduled job (nightly)
-- ============================================================

CREATE OR REPLACE FUNCTION compute_daily_org_metrics(p_date DATE, p_organization_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO daily_metrics (
        date, organization_id,
        sessions_scheduled, sessions_completed, sessions_cancelled, sessions_no_show,
        patients_active, patients_new, notes_generated, notes_approved,
        revenue_usd, active_therapists
    )
    SELECT
        p_date,
        p_organization_id,
        COUNT(*) FILTER (WHERE s.status != 'cancelled'),
        COUNT(*) FILTER (WHERE s.status = 'completed'),
        COUNT(*) FILTER (WHERE s.status = 'cancelled'),
        COUNT(*) FILTER (WHERE s.status = 'no_show'),
        (SELECT COUNT(*) FROM patients WHERE organization_id = p_organization_id AND status = 'active'),
        (SELECT COUNT(*) FROM patients WHERE organization_id = p_organization_id AND DATE(created_at) = p_date),
        (SELECT COUNT(*) FROM ai_session_notes asn JOIN sessions ss ON ss.id = asn.session_id WHERE ss.organization_id = p_organization_id AND DATE(asn.created_at) = p_date),
        (SELECT COUNT(*) FROM ai_session_notes asn JOIN sessions ss ON ss.id = asn.session_id WHERE ss.organization_id = p_organization_id AND DATE(asn.created_at) = p_date AND asn.status = 'approved'),
        (SELECT COALESCE(SUM(amount_total), 0) FROM invoices WHERE organization_id = p_organization_id AND DATE(paid_at) = p_date AND status = 'paid'),
        (SELECT COUNT(DISTINCT therapist_id) FROM sessions WHERE organization_id = p_organization_id AND DATE(scheduled_at) = p_date AND status = 'completed')
    FROM sessions s
    WHERE s.organization_id = p_organization_id
      AND DATE(s.scheduled_at) = p_date
    ON CONFLICT (date, organization_id) DO UPDATE SET
        sessions_scheduled = EXCLUDED.sessions_scheduled,
        sessions_completed = EXCLUDED.sessions_completed,
        sessions_cancelled = EXCLUDED.sessions_cancelled,
        sessions_no_show   = EXCLUDED.sessions_no_show,
        patients_active    = EXCLUDED.patients_active,
        patients_new       = EXCLUDED.patients_new,
        notes_generated    = EXCLUDED.notes_generated,
        notes_approved     = EXCLUDED.notes_approved,
        revenue_usd        = EXCLUDED.revenue_usd,
        active_therapists  = EXCLUDED.active_therapists;
END;
$$ LANGUAGE plpgsql;

-- Reviewed: 2026-06-13 — 24Therapy audit
