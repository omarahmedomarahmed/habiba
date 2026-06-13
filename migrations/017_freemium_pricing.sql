-- Migration 017: Freemium Pricing Model
-- Adds: free first session, pay-per-session, starter/pro tiers
-- trial_session_used flag on therapists, session_count_month view

-- ── New subscription plan tiers ──────────────────────────────────────────────

-- Update existing plans to match new pricing and add missing tiers
INSERT INTO subscription_plans (plan_key, name, description, monthly_price_usd, annual_price_usd, max_therapists, max_sessions_month, ai_notes_included, features)
VALUES
  ('free_trial',       'Free Session',    'Your first session is on us — full AI features, no credit card',          0,    0,     1,  1,    1,
   '{"radar":false,"api_access":false,"white_label":false,"advanced_analytics":false,"custom_branding":false,"trial":true}'),
  ('pay_per_session',  'Pay As You Go',   'No monthly commitment — pay $12 per session processed',                  0,    0,     1,  0,    NULL,
   '{"radar":false,"api_access":false,"white_label":false,"advanced_analytics":false,"custom_branding":false,"pay_per_session":true}'),
  ('starter',          'Starter',         '20 sessions/month included — $4/session overage',                       49,   490,   1,  20,   20,
   '{"radar":true,"api_access":false,"white_label":false,"advanced_analytics":false,"custom_branding":false}'),
  ('pro',              'Pro',             'Unlimited sessions + emotional AI history + priority processing',        89,   890,   1,  NULL, NULL,
   '{"radar":true,"api_access":false,"white_label":false,"advanced_analytics":true,"custom_branding":true,"emotional_history":true,"priority_ai":true}')
ON CONFLICT (plan_key) DO UPDATE SET
  monthly_price_usd   = EXCLUDED.monthly_price_usd,
  annual_price_usd    = EXCLUDED.annual_price_usd,
  max_sessions_month  = EXCLUDED.max_sessions_month,
  ai_notes_included   = EXCLUDED.ai_notes_included,
  description         = EXCLUDED.description,
  features            = EXCLUDED.features;

-- ── Trial session tracking on therapist ──────────────────────────────────────

ALTER TABLE therapists
  ADD COLUMN IF NOT EXISTS trial_session_used   BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_plan_key     VARCHAR(50) DEFAULT 'free_trial';

-- ── Per-session billing records ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_charges (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID NOT NULL REFERENCES organizations(id),
  therapist_id     UUID NOT NULL REFERENCES therapists(id),
  session_id       UUID NOT NULL REFERENCES sessions(id),
  amount_usd       NUMERIC(10, 2) NOT NULL DEFAULT 0,
  plan_key         VARCHAR(50) NOT NULL,
  charged_at       TIMESTAMPTZ DEFAULT NOW(),
  stripe_charge_id VARCHAR(255),
  status           VARCHAR(20) DEFAULT 'pending'  -- pending, paid, waived (free trial)
);

CREATE INDEX IF NOT EXISTS idx_session_charges_therapist ON session_charges(therapist_id);
CREATE INDEX IF NOT EXISTS idx_session_charges_org       ON session_charges(organization_id);
CREATE INDEX IF NOT EXISTS idx_session_charges_session   ON session_charges(session_id);

-- ── Monthly session count helper view ────────────────────────────────────────

CREATE OR REPLACE VIEW therapist_monthly_session_counts AS
SELECT
  s.therapist_id,
  COUNT(*)                              AS sessions_this_month,
  DATE_TRUNC('month', NOW())::DATE      AS month_start
FROM sessions s
WHERE s.status IN ('in_progress', 'completed')
  AND s.created_at >= DATE_TRUNC('month', NOW())
GROUP BY s.therapist_id;

-- Reviewed: 2026-06-13 — 24Therapy audit
