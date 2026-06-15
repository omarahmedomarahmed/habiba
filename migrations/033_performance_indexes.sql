-- Migration 033: Missing performance indexes identified in audit
-- Adds composite index for common therapist schedule queries

-- Composite index on (therapist_id, scheduled_at) for therapist schedule queries
-- e.g. WHERE therapist_id = $1 AND scheduled_at BETWEEN $2 AND $3 ORDER BY scheduled_at
CREATE INDEX IF NOT EXISTS idx_sessions_therapist_scheduled
  ON sessions (therapist_id, scheduled_at DESC);

-- Composite index on (organization_id, status, scheduled_at) for dashboard queries
-- e.g. WHERE organization_id = $1 AND status IN ('scheduled','in_progress') ORDER BY scheduled_at
CREATE INDEX IF NOT EXISTS idx_sessions_org_status_scheduled
  ON sessions (organization_id, status, scheduled_at DESC);

-- Index on risk_assessments (session_id, created_at) for crisis dedup queries
-- (dedup check runs on every transcript segment — must be fast)
CREATE INDEX IF NOT EXISTS idx_risk_assessments_session_created
  ON risk_assessments (session_id, created_at DESC);

-- Index on risk_assessments (alert_status, created_at) for sweeper cron
CREATE INDEX IF NOT EXISTS idx_risk_assessments_sweeper
  ON risk_assessments (alert_status, created_at)
  WHERE alert_status = 'pending';

-- Index on phi_access_log (created_at) for retention purge cron
-- (purge queries filter on created_at > 6 years — without index it scans the full table)
CREATE INDEX IF NOT EXISTS idx_phi_access_log_created_at
  ON phi_access_log (created_at);
