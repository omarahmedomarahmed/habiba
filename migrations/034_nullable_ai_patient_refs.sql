-- 034: Offline session support, radar columns, CRM module
-- ============================================================

-- AI tables: drop NOT NULL on patient_id to support offline sessions
ALTER TABLE ai_session_notes     ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE ai_session_summaries ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE session_intelligence  ALTER COLUMN patient_id DROP NOT NULL;

-- Radar: add columns referenced by radar.service.ts acceptRequest + getRadarAnalytics
ALTER TABLE radar_requests
  ADD COLUMN IF NOT EXISTS matched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS matched_therapist_id UUID REFERENCES therapists(id);

-- CRM leads table for admin sales pipeline
CREATE TABLE IF NOT EXISTS crm_leads (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(255)  NOT NULL,
  email           VARCHAR(255),
  phone           VARCHAR(50),
  stage           VARCHAR(50)   NOT NULL DEFAULT 'new',
  source          VARCHAR(100),
  notes           TEXT,
  assigned_to     UUID          REFERENCES users(id) ON DELETE SET NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crm_leads_org   ON crm_leads (organization_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON crm_leads (stage);
