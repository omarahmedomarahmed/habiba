-- ============================================================
-- 24Therapy MVP schema — organizations billing columns
-- The billing module (Stripe subscribe + webhook) reads/writes
-- organizations.stripe_customer_id and organizations.plan_id.
-- Added here as a follow-up migration so it applies to databases
-- already created from 001–012 without re-running those files.
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS plan_id            UUID REFERENCES subscription_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON organizations (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_plan_id            ON organizations (plan_id);
