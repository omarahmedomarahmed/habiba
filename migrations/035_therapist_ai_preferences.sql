-- ============================================================
-- 035_therapist_ai_preferences.sql
-- Persist per-therapist AI / scribe preferences (Settings → AI & Scribe).
-- Previously the toggles and note-format selectors were client-only state that
-- never saved. Stored as JSONB so the shape can evolve without further migrations.
-- ============================================================

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS ai_preferences JSONB NOT NULL DEFAULT '{}';
