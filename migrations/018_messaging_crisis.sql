-- Migration 018: messaging columns + crisis alert tracking
-- Adds: conversations.subject/priority, messages.message_type/metadata,
--        partial unique index for create-or-get, risk_assessments alert tracking

-- ── conversations ────────────────────────────────────────────────────────────
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS subject  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';

-- Partial unique index enables ON CONFLICT upsert in MessagesService
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_patient_therapist_active
  ON conversations (organization_id, patient_id, therapist_id)
  WHERE type = 'patient_therapist' AND status = 'active';

-- ── messages ─────────────────────────────────────────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS message_type VARCHAR(50) DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata     JSONB;

-- Backfill message_type from content_type for existing rows
UPDATE messages SET message_type = content_type WHERE message_type IS NULL;

-- ── risk_assessments alert tracking ──────────────────────────────────────────
ALTER TABLE risk_assessments
  ADD COLUMN IF NOT EXISTS source              VARCHAR(20) DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS alert_status        VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS alert_delivered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS acknowledged_by     UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS acknowledged_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conversation_id     UUID REFERENCES conversations(id);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_alert
  ON risk_assessments (organization_id, alert_status, created_at);
