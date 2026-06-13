-- Migration 025: Feature Flags
-- Provides a database-backed feature flag system for gradual rollouts,
-- A/B testing, and per-organization capability overrides.

CREATE TABLE IF NOT EXISTS feature_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           VARCHAR(100) NOT NULL UNIQUE,
  name          VARCHAR(200) NOT NULL,
  description   TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT false,
  rollout_pct   SMALLINT NOT NULL DEFAULT 0 CHECK (rollout_pct BETWEEN 0 AND 100),
  tags          TEXT[] NOT NULL DEFAULT '{}',
  category      VARCHAR(50) NOT NULL DEFAULT 'general',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);

-- Seed the flags that the admin UI already references
INSERT INTO feature_flags (key, name, description, enabled, rollout_pct, tags, category) VALUES
  ('ai_copilot_v2', 'AI Copilot v2', 'Next-gen session copilot with emotional state tracking', false, 0, ARRAY['ai', 'beta'], 'ai'),
  ('ai_memory_enhanced', 'Enhanced Memory Layer', 'Cross-session memory with semantic search', true, 100, ARRAY['ai', 'production'], 'ai'),
  ('crisis_auto_escalation', 'Auto Crisis Escalation', 'Automatically escalate high-risk sessions to supervisors', false, 0, ARRAY['safety', 'beta'], 'safety'),
  ('video_recording', 'Session Recording', 'HIPAA-compliant session recording and playback', false, 0, ARRAY['video', 'compliance'], 'video'),
  ('group_therapy', 'Group Therapy Mode', 'Support for group therapy sessions (multi-patient)', false, 0, ARRAY['sessions', 'beta'], 'sessions'),
  ('marketplace_v2', 'Marketplace v2', 'Revamped therapist discovery with AI matching scores', false, 25, ARRAY['marketplace', 'beta'], 'marketplace'),
  ('patient_app', 'Patient Mobile App', 'Native patient app features (mood, journal, homework)', true, 100, ARRAY['patient', 'production'], 'patient'),
  ('telehealth_rooms', 'Native Telehealth Rooms', 'Built-in video without Daily.co dependency', false, 0, ARRAY['video', 'infrastructure'], 'video')
ON CONFLICT (key) DO NOTHING;
