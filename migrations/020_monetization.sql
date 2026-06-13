-- Migration 020: Monetization Engine
-- Updates plan pricing to founder-locked values, extends session_charges,
-- adds therapist_session_quota, ai_assistant_credits.

-- ── 1. Update subscription_plans with locked pricing ─────────────────────────

-- Add price_per_session_usd column for PAYG plans
ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS price_per_session_usd NUMERIC(10,2);

-- Deactivate legacy free_trial plan (replaced by PAYG "first session free" mechanic)
UPDATE subscription_plans SET is_active = false, trial_days = 0
WHERE plan_key = 'free_trial';

-- Reset trial_days to 0 on all plans (no more 14-day trials)
UPDATE subscription_plans SET trial_days = 0;

-- Upsert pay_per_session plan (the new default for all therapists)
INSERT INTO subscription_plans (
  plan_key, name, tagline, description,
  monthly_price_usd, annual_price_usd,
  max_therapists, max_sessions_month,
  price_per_session_usd,
  ai_notes_included, features,
  is_active, is_featured, badge_text, cta_text,
  trial_days, display_order
) VALUES (
  'pay_per_session',
  'Pay As You Go',
  'First session free, then $6 per session',
  'No monthly commitment. $6 per completed session. First session on us.',
  0, 0,
  1, NULL,
  6.00,
  NULL,
  '{"radar":false,"api_access":false,"white_label":false,"advanced_analytics":false,"custom_branding":false,"pay_per_session":true}'::jsonb,
  true, false, NULL, 'Start free',
  0, 0
)
ON CONFLICT (plan_key) DO UPDATE SET
  name                  = EXCLUDED.name,
  tagline               = EXCLUDED.tagline,
  description           = EXCLUDED.description,
  monthly_price_usd     = EXCLUDED.monthly_price_usd,
  annual_price_usd      = EXCLUDED.annual_price_usd,
  price_per_session_usd = EXCLUDED.price_per_session_usd,
  max_sessions_month    = EXCLUDED.max_sessions_month,
  ai_notes_included     = EXCLUDED.ai_notes_included,
  features              = EXCLUDED.features,
  is_active             = EXCLUDED.is_active,
  cta_text              = EXCLUDED.cta_text,
  trial_days            = EXCLUDED.trial_days,
  display_order         = EXCLUDED.display_order;

-- Upsert starter plan ($59/mo, 20 sessions, rollover)
INSERT INTO subscription_plans (
  plan_key, name, tagline, description,
  monthly_price_usd, annual_price_usd,
  max_therapists, max_sessions_month,
  ai_notes_included, features,
  is_active, is_featured, badge_text, cta_text,
  trial_days, display_order
) VALUES (
  'starter',
  'Starter',
  '20 sessions — 50% off pay-as-you-go',
  '20 sessions/month included (≈$3/session). Unused sessions roll over (up to 20 banked).',
  59, 590,
  1, 20,
  20,
  '{"radar":true,"api_access":false,"white_label":false,"advanced_analytics":false,"custom_branding":false,"rollover":true}'::jsonb,
  true, false, NULL, 'Start Starter',
  0, 1
)
ON CONFLICT (plan_key) DO UPDATE SET
  name                  = EXCLUDED.name,
  tagline               = EXCLUDED.tagline,
  description           = EXCLUDED.description,
  monthly_price_usd     = EXCLUDED.monthly_price_usd,
  annual_price_usd      = EXCLUDED.annual_price_usd,
  max_sessions_month    = EXCLUDED.max_sessions_month,
  ai_notes_included     = EXCLUDED.ai_notes_included,
  features              = EXCLUDED.features,
  is_active             = EXCLUDED.is_active,
  cta_text              = EXCLUDED.cta_text,
  trial_days            = EXCLUDED.trial_days,
  display_order         = EXCLUDED.display_order;

-- Upsert pro plan → display name "Unlimited" ($99/mo)
INSERT INTO subscription_plans (
  plan_key, name, tagline, description,
  monthly_price_usd, annual_price_usd,
  max_therapists, max_sessions_month,
  ai_notes_included, features,
  is_active, is_featured, badge_text, cta_text,
  trial_days, display_order
) VALUES (
  'pro',
  'Unlimited',
  'Unlimited sessions — full platform power',
  'Unlimited sessions, full AI suite, priority processing.',
  99, 990,
  1, NULL,
  NULL,
  '{"radar":true,"api_access":false,"white_label":false,"advanced_analytics":true,"custom_branding":true,"emotional_history":true,"priority_ai":true}'::jsonb,
  true, true, 'Most Popular', 'Start Unlimited',
  0, 2
)
ON CONFLICT (plan_key) DO UPDATE SET
  name                  = EXCLUDED.name,
  tagline               = EXCLUDED.tagline,
  description           = EXCLUDED.description,
  monthly_price_usd     = EXCLUDED.monthly_price_usd,
  annual_price_usd      = EXCLUDED.annual_price_usd,
  max_sessions_month    = EXCLUDED.max_sessions_month,
  ai_notes_included     = EXCLUDED.ai_notes_included,
  features              = EXCLUDED.features,
  is_active             = EXCLUDED.is_active,
  is_featured           = EXCLUDED.is_featured,
  badge_text            = EXCLUDED.badge_text,
  cta_text              = EXCLUDED.cta_text,
  trial_days            = EXCLUDED.trial_days,
  display_order         = EXCLUDED.display_order;

-- Upsert practice plan ($189/mo base, 2+ therapists)
INSERT INTO subscription_plans (
  plan_key, name, tagline, description,
  monthly_price_usd, annual_price_usd,
  max_therapists, max_sessions_month,
  ai_notes_included, features,
  is_active, is_featured, badge_text, cta_text,
  trial_days, display_order
) VALUES (
  'practice',
  'Practice',
  'from $189/mo for 2 therapists',
  'Multi-therapist team plan. Base $189/mo for 2 therapists ($94.50/therapist). +$85/mo per additional seat. 6+ therapists: contact sales.',
  189, 1890,
  NULL, NULL,
  NULL,
  '{"radar":true,"api_access":false,"white_label":false,"advanced_analytics":true,"custom_branding":true,"multi_location":true,"min_seats":2,"per_extra_seat_usd":85}'::jsonb,
  true, false, 'Teams', 'Start with your team',
  0, 3
)
ON CONFLICT (plan_key) DO UPDATE SET
  name                  = EXCLUDED.name,
  tagline               = EXCLUDED.tagline,
  description           = EXCLUDED.description,
  monthly_price_usd     = EXCLUDED.monthly_price_usd,
  annual_price_usd      = EXCLUDED.annual_price_usd,
  max_therapists        = EXCLUDED.max_therapists,
  max_sessions_month    = EXCLUDED.max_sessions_month,
  ai_notes_included     = EXCLUDED.ai_notes_included,
  features              = EXCLUDED.features,
  is_active             = EXCLUDED.is_active,
  badge_text            = EXCLUDED.badge_text,
  cta_text              = EXCLUDED.cta_text,
  trial_days            = EXCLUDED.trial_days,
  display_order         = EXCLUDED.display_order;

-- Deactivate legacy plans that are no longer offered
UPDATE subscription_plans SET is_active = false
WHERE plan_key IN ('free', 'professional')
  AND plan_key NOT IN ('pay_per_session','starter','pro','practice','enterprise');

-- ── 2. Extend session_charges table ──────────────────────────────────────────

ALTER TABLE session_charges
  ADD COLUMN IF NOT EXISTS discount_usd        NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_due_usd      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS description         VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_checkout_url TEXT,
  ADD COLUMN IF NOT EXISTS paid_at             TIMESTAMPTZ;

-- Backfill amount_due_usd from (amount_usd - discount_usd) for existing rows
UPDATE session_charges
SET amount_due_usd = COALESCE(amount_usd, 0) - COALESCE(discount_usd, 0)
WHERE amount_due_usd IS NULL;

-- Partial index for fast pending-bill lookup
CREATE INDEX IF NOT EXISTS idx_session_charges_therapist_pending
  ON session_charges(therapist_id) WHERE status = 'pending';

-- ── 3. Therapist session quota table (Starter rollover) ───────────────────────

CREATE TABLE IF NOT EXISTS therapist_session_quota (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id     UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start     DATE NOT NULL,
  included         INT NOT NULL DEFAULT 20,
  rollover_in      INT NOT NULL DEFAULT 0,
  used             INT NOT NULL DEFAULT 0,
  UNIQUE(therapist_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_therapist_quota_therapist
  ON therapist_session_quota(therapist_id, period_start DESC);

-- ── 4. AI assistant credits table (PAYG: 5 credits per completed session) ────

CREATE TABLE IF NOT EXISTS ai_assistant_credits (
  therapist_id  UUID PRIMARY KEY REFERENCES therapists(id) ON DELETE CASCADE,
  balance       INT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. Backfill therapist plan key ────────────────────────────────────────────

-- Move any therapists still on free_trial → pay_per_session
-- (trial_session_used flag preserves whether they used their free first session)
UPDATE therapists
SET current_plan_key = 'pay_per_session'
WHERE current_plan_key = 'free_trial';

-- Default for new registrations
ALTER TABLE therapists
  ALTER COLUMN current_plan_key SET DEFAULT 'pay_per_session';

-- ── 6. Audit log entry ────────────────────────────────────────────────────────

INSERT INTO pricing_audit_log (plan_key, changed_by, change_type, new_values)
SELECT plan_key, 'migration_020', 'price_update', row_to_json(sp)
FROM subscription_plans sp
WHERE plan_key IN ('pay_per_session','starter','pro','practice')
ON CONFLICT DO NOTHING;

-- Reviewed: 2026-06-13 — 24Therapy audit
