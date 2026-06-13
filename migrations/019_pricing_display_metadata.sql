-- Migration 019: Add display metadata to subscription plans
-- Adds feature_bullets (human-readable feature list for pricing cards)
-- and color_scheme for per-plan UI theming.

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS feature_bullets  JSONB    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS color_scheme     VARCHAR(20) DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS audience         VARCHAR(50) DEFAULT 'therapist';

COMMENT ON COLUMN subscription_plans.feature_bullets IS
  'Array of human-readable feature strings shown on the pricing card';
COMMENT ON COLUMN subscription_plans.color_scheme IS
  'UI color theme for the plan card (blue, purple, teal, slate, enterprise)';
COMMENT ON COLUMN subscription_plans.audience IS
  'Who the plan is for: therapist, patient, enterprise';

-- Back-fill display metadata for the canonical plans
UPDATE subscription_plans SET
  feature_bullets = '[
    "10 AI-scripted sessions / month",
    "Patient profiles & history",
    "Basic scheduling",
    "Email support"
  ]'::jsonb,
  color_scheme = 'slate',
  audience = 'therapist'
WHERE plan_key = 'free';

UPDATE subscription_plans SET
  feature_bullets = '[
    "50 AI notes / month (SOAP/DAP/BIRP)",
    "Session transcription",
    "HIPAA BAA included",
    "Appointment scheduling",
    "Patient mobile app"
  ]'::jsonb,
  color_scheme = 'blue',
  audience = 'therapist'
WHERE plan_key = 'starter';

UPDATE subscription_plans SET
  feature_bullets = '[
    "Unlimited AI notes",
    "Clinical Copilot (live session AI)",
    "Radar patient matching",
    "Patient memory layer",
    "Advanced analytics",
    "Custom branding",
    "HIPAA BAA included"
  ]'::jsonb,
  color_scheme = 'blue',
  audience = 'therapist'
WHERE plan_key = 'professional';

UPDATE subscription_plans SET
  feature_bullets = '[
    "Everything in Professional",
    "Up to 10 therapists",
    "Shared patient management",
    "Multi-location support",
    "Team billing dashboard",
    "Practice performance analytics"
  ]'::jsonb,
  color_scheme = 'teal',
  audience = 'therapist'
WHERE plan_key = 'practice';

UPDATE subscription_plans SET
  feature_bullets = '[
    "Unlimited therapists & patients",
    "SSO / SAML",
    "White-label branding",
    "Custom AI configuration",
    "EHR integration (Epic, Cerner)",
    "Dedicated account manager",
    "Custom SLA & contracts"
  ]'::jsonb,
  color_scheme = 'enterprise',
  audience = 'enterprise'
WHERE plan_key = 'enterprise';

-- Reviewed: 2026-06-13 — 24Therapy audit
