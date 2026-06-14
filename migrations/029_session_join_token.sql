-- Add join_token, join_name, started_by_patient_at to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS join_token UUID DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS join_name VARCHAR(255);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS started_by_patient_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_join_token ON sessions(join_token);
