-- Migration 030: Make patient_id nullable for link-based & offline sessions
-- Adds offline session fields, AI insights columns, and report sharing support

-- Sessions: patient joins AFTER creation (link-based) or may be guest-only (offline)
ALTER TABLE sessions ALTER COLUMN patient_id DROP NOT NULL;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS patient_email VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS patient_name_guest VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS follow_up_recommendation TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ai_insights JSONB DEFAULT '{}';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auto_generate_note BOOLEAN DEFAULT TRUE;

-- Transcripts: created when session starts, patient may not be linked yet
ALTER TABLE transcripts ALTER COLUMN patient_id DROP NOT NULL;

-- Transcript segments: may be produced before patient is linked
ALTER TABLE transcript_segments ALTER COLUMN patient_id DROP NOT NULL;

-- AI session notes: offline sessions have guest patients (created as patients row, not users)
ALTER TABLE ai_session_notes ALTER COLUMN patient_id DROP NOT NULL;

-- Index for fast lookup of sessions with no patient yet (link-based waiting)
CREATE INDEX IF NOT EXISTS idx_sessions_no_patient ON sessions(organization_id) WHERE patient_id IS NULL;
