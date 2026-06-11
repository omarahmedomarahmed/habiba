-- ============================================================
-- 016_schema_fixes.sql
-- 24Therapy.ai — Schema Bug Fixes
-- Fixes 4 code/schema mismatches identified in audit (2026-06-11)
-- Safe to run on a DB that already has migrations 001–015.
-- ============================================================

-- ============================================================
-- Fix 1: billing column aliases
-- billing.service.ts queries price_monthly_usd + session_limit
-- but migration 010 only has monthly_price_usd / annual_price_usd
-- ============================================================

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS session_limit INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS price_monthly_usd NUMERIC(10,2);

UPDATE subscription_plans
  SET price_monthly_usd = monthly_price_usd
  WHERE price_monthly_usd IS NULL;

-- ============================================================
-- Fix 2: therapist_specializations junction table
-- therapists.service.ts does JOIN therapist_specializations ts ON ts.specialization_id = st.id
-- but migration 002 stores specializations as TEXT[] on therapists table
-- We create the junction table and back-fill from the array column
-- ============================================================

CREATE TABLE IF NOT EXISTS therapist_specializations (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id     UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  specialization_id UUID,                -- nullable: for future taxonomy FK
  specialization   VARCHAR(100) NOT NULL, -- denormalized from TEXT[]
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(therapist_id, specialization)
);

CREATE INDEX IF NOT EXISTS idx_therapist_spec_therapist ON therapist_specializations(therapist_id);

-- Back-fill from existing TEXT[] array
INSERT INTO therapist_specializations (therapist_id, specialization)
SELECT id, unnest(specializations)
FROM therapists
WHERE specializations IS NOT NULL AND array_length(specializations, 1) > 0
ON CONFLICT DO NOTHING;

-- ============================================================
-- Fix 3: accepting_new_patients column
-- therapists.service.ts sets accepting_new_patients but migration 002 has no such column
-- ============================================================

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS accepting_new_patients BOOLEAN DEFAULT true;

UPDATE therapists
  SET accepting_new_patients = COALESCE(marketplace_enabled, true)
  WHERE accepting_new_patients IS NULL;

-- ============================================================
-- Fix 4: patient_consents — add columns migration 012 expects
-- Migration 003 creates patient_consents with a simpler schema
-- Migration 012 CREATE TABLE IF NOT EXISTS is skipped (003 runs first)
-- but the extra columns (consent_version_id, accepted, etc.) are never added
-- ============================================================

ALTER TABLE patient_consents
  ADD COLUMN IF NOT EXISTS consent_version_id UUID,
  ADD COLUMN IF NOT EXISTS accepted           BOOLEAN,
  ADD COLUMN IF NOT EXISTS withdrawn_reason   TEXT,
  ADD COLUMN IF NOT EXISTS user_agent         TEXT,
  ADD COLUMN IF NOT EXISTS signature          TEXT,
  ADD COLUMN IF NOT EXISTS method             VARCHAR(50) DEFAULT 'click';
