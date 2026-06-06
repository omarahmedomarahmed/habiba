-- ============================================================
-- 015_pricing_management.sql
-- 24Therapy.ai — Pricing Management Schema Extensions
-- Adds admin-editable columns to subscription_plans
-- ============================================================
-- Run after: 010_billing_schema.sql
-- ============================================================

-- Add extended plan management columns to subscription_plans
-- Using ADD COLUMN IF NOT EXISTS for idempotent migrations

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS tagline            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_featured        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS badge_text         VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cta_text           VARCHAR(100) DEFAULT 'Get Started',
  ADD COLUMN IF NOT EXISTS trial_days         INTEGER DEFAULT 14,
  ADD COLUMN IF NOT EXISTS add_ons            JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS highlight_color    VARCHAR(50),
  ADD COLUMN IF NOT EXISTS faq                JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS promotion_text     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS promotion_expires_at TIMESTAMPTZ;

-- Normalize price column name (010 uses monthly_price_usd, service uses price_monthly_usd)
-- Add aliases as generated columns or just ensure both names work in queries
-- The schema file uses: monthly_price_usd, annual_price_usd
-- The billing.service.ts getPlans uses: price_monthly_usd (mismatch)
-- Fix: Rename if existing, or add compatibility columns

DO $$
BEGIN
  -- Rename monthly_price_usd → price_monthly_usd if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'monthly_price_usd'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'price_monthly_usd'
  ) THEN
    ALTER TABLE subscription_plans RENAME COLUMN monthly_price_usd TO price_monthly_usd;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'annual_price_usd'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscription_plans' AND column_name = 'price_annual_usd'
  ) THEN
    ALTER TABLE subscription_plans RENAME COLUMN annual_price_usd TO price_annual_usd;
  END IF;
END $$;

-- Update seed data to add taglines and fix display_order
UPDATE subscription_plans SET
  tagline = 'Solo practitioner essentials',
  cta_text = 'Start Free Trial',
  is_featured = FALSE,
  display_order = 0,
  trial_days = 14
WHERE plan_key = 'free'
  AND tagline IS NULL;

UPDATE subscription_plans SET
  tagline = 'Full AI-powered practice management',
  cta_text = 'Start Free Trial',
  is_featured = TRUE,
  badge_text = 'Most Popular',
  display_order = 1,
  trial_days = 14
WHERE plan_key = 'professional'
  AND tagline IS NULL;

UPDATE subscription_plans SET
  tagline = 'Multi-therapist group practices',
  cta_text = 'Start Free Trial',
  is_featured = FALSE,
  display_order = 2,
  trial_days = 14
WHERE plan_key = 'practice'
  AND tagline IS NULL;

UPDATE subscription_plans SET
  tagline = 'Hospitals, universities, healthcare systems',
  cta_text = 'Contact Sales',
  is_featured = FALSE,
  display_order = 3,
  trial_days = 0
WHERE plan_key = 'enterprise'
  AND tagline IS NULL;

-- Create pricing_audit_log table to track all plan changes by admins
CREATE TABLE IF NOT EXISTS pricing_audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id         UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  plan_key        VARCHAR(50) NOT NULL,
  action          VARCHAR(50) NOT NULL,  -- created, updated, activated, deactivated, deleted
  changed_by      UUID REFERENCES users(id),
  changed_by_role VARCHAR(50),
  old_values      JSONB,
  new_values      JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pricing_audit_plan ON pricing_audit_log(plan_id);
CREATE INDEX IF NOT EXISTS idx_pricing_audit_created ON pricing_audit_log(created_at);

-- Create a view for the public pricing page
CREATE OR REPLACE VIEW public_pricing AS
SELECT
  id, plan_key, name, tagline, description,
  price_monthly_usd, price_annual_usd,
  max_therapists, max_patients, max_sessions_month, ai_notes_included,
  features, is_featured, badge_text, cta_text,
  trial_days, add_ons, highlight_color, display_order
FROM subscription_plans
WHERE is_active = TRUE
ORDER BY display_order ASC, price_monthly_usd ASC NULLS LAST;

COMMENT ON TABLE pricing_audit_log IS 'Audit trail for all subscription plan changes made by admins';
COMMENT ON VIEW public_pricing IS 'Public-facing pricing data — active plans only with display metadata';
