-- ============================================================
-- 24Therapy MVP schema — plans, subscriptions, session charges, quotas, AI credits
-- Generated fresh for the MVP database reset (docs/PRODUCT_MVP.md).
-- Runs in order via scripts/migrate.js on every backend deploy.
-- ============================================================

-- ============================================================
-- 010_billing.sql
-- 24Therapy — Billing Engine
-- All columns defined up-front — no ALTER TABLE needed later.
-- ============================================================

-- ------------------------------------------------------------
-- subscription_plans
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                      UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_key                VARCHAR(50)   NOT NULL,
  name                    VARCHAR(100)  NOT NULL,
  tagline                 VARCHAR(255),
  description             TEXT,
  monthly_price_usd       NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_monthly_usd       NUMERIC(10,2) GENERATED ALWAYS AS (monthly_price_usd) STORED,
  annual_price_usd        NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_annual_usd        NUMERIC(10,2) GENERATED ALWAYS AS (annual_price_usd) STORED,
  currency                VARCHAR(10)   NOT NULL DEFAULT 'USD',
  max_therapists          INTEGER,
  max_patients            INTEGER,
  max_sessions_month      INTEGER,
  session_limit           INTEGER,
  ai_notes_included       INTEGER,
  price_per_session_usd   NUMERIC(10,2),
  features                JSONB,
  stripe_price_id_monthly VARCHAR(255),
  stripe_price_id_annual  VARCHAR(255),
  is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
  is_featured             BOOLEAN       NOT NULL DEFAULT FALSE,
  badge_text              VARCHAR(100),
  cta_text                VARCHAR(100)  NOT NULL DEFAULT 'Get Started',
  trial_days              INTEGER       NOT NULL DEFAULT 0,
  add_ons                 JSONB         NOT NULL DEFAULT '[]',
  highlight_color         VARCHAR(50),
  feature_bullets         JSONB         NOT NULL DEFAULT '[]',
  color_scheme            VARCHAR(20)   NOT NULL DEFAULT 'blue',
  audience                VARCHAR(50)   NOT NULL DEFAULT 'therapist',
  faq                     JSONB         NOT NULL DEFAULT '[]',
  promotion_text          VARCHAR(255),
  promotion_expires_at    TIMESTAMPTZ,
  display_order           INTEGER       NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT subscription_plans_key UNIQUE (plan_key)
);


CREATE OR REPLACE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id        UUID        NOT NULL REFERENCES organizations(id),
  plan_id                UUID        NOT NULL REFERENCES subscription_plans(id),
  billing_cycle          VARCHAR(20) NOT NULL DEFAULT 'monthly',
  status                 VARCHAR(50) NOT NULL DEFAULT 'trial',
  trial_ends_at          TIMESTAMPTZ,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT FALSE,
  cancelled_at           TIMESTAMPTZ,
  cancellation_reason    TEXT,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id     VARCHAR(255),
  metadata               JSONB,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subscriptions_org_unique UNIQUE (organization_id),
  CONSTRAINT subscriptions_stripe_sub_unique UNIQUE (stripe_subscription_id)
);


CREATE INDEX IF NOT EXISTS idx_subscriptions_organization_id ON subscriptions (organization_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status          ON subscriptions (status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub_id   ON subscriptions (stripe_subscription_id);


CREATE OR REPLACE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- invoices
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID          NOT NULL REFERENCES organizations(id),
  patient_id      UUID          REFERENCES patients(id),
  invoice_type    VARCHAR(50)   NOT NULL DEFAULT 'subscription',
  invoice_number  VARCHAR(100),
  amount_subtotal NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_total    NUMERIC(10,2) NOT NULL,
  currency        VARCHAR(10)   NOT NULL DEFAULT 'USD',
  status          VARCHAR(50)   NOT NULL DEFAULT 'draft',
  stripe_invoice_id VARCHAR(255),
  issued_at       TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  void_at         TIMESTAMPTZ,
  notes           TEXT,
  pdf_url         TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT invoices_number_unique UNIQUE (invoice_number),
  CONSTRAINT invoices_stripe_id_unique UNIQUE (stripe_invoice_id)
);


CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices (organization_id);

CREATE INDEX IF NOT EXISTS idx_invoices_patient_id      ON invoices (patient_id);

CREATE INDEX IF NOT EXISTS idx_invoices_status          ON invoices (status);


CREATE OR REPLACE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- invoice_line_items
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID          NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT          NOT NULL,
  quantity    INTEGER       NOT NULL DEFAULT 1,
  unit_price  NUMERIC(10,2) NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  session_id  UUID          REFERENCES sessions(id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id          UUID          NOT NULL REFERENCES invoices(id),
  organization_id     UUID          NOT NULL REFERENCES organizations(id),
  payment_method      VARCHAR(50),
  provider            VARCHAR(50)   NOT NULL DEFAULT 'stripe',
  provider_payment_id VARCHAR(255),
  amount              NUMERIC(10,2) NOT NULL,
  currency            VARCHAR(10)   NOT NULL DEFAULT 'USD',
  status              VARCHAR(50)   NOT NULL DEFAULT 'pending',
  failure_code        VARCHAR(100),
  failure_message     TEXT,
  refunded_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  receipt_url         TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT payments_provider_id_unique UNIQUE (provider_payment_id)
);


CREATE INDEX IF NOT EXISTS idx_payments_invoice_id      ON payments (invoice_id);

CREATE INDEX IF NOT EXISTS idx_payments_organization_id ON payments (organization_id);

CREATE INDEX IF NOT EXISTS idx_payments_status          ON payments (status);


CREATE OR REPLACE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ------------------------------------------------------------
-- session_charges  (PAYG billing per-session)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_charges (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id      UUID          NOT NULL REFERENCES organizations(id),
  therapist_id         UUID          NOT NULL REFERENCES therapists(id),
  session_id           UUID          NOT NULL REFERENCES sessions(id),
  amount_usd           NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_usd         NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_due_usd       NUMERIC(10,2),
  plan_key             VARCHAR(50)   NOT NULL,
  description          VARCHAR(255),
  charged_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  stripe_charge_id     VARCHAR(255),
  stripe_checkout_url  TEXT,
  paid_at              TIMESTAMPTZ,
  status               VARCHAR(20)   NOT NULL DEFAULT 'pending'
);


CREATE INDEX IF NOT EXISTS idx_session_charges_therapist_id    ON session_charges (therapist_id);

CREATE INDEX IF NOT EXISTS idx_session_charges_organization_id ON session_charges (organization_id);

CREATE INDEX IF NOT EXISTS idx_session_charges_session_id      ON session_charges (session_id);


-- ------------------------------------------------------------
-- therapist_session_quota  (Starter plan included sessions)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS therapist_session_quota (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id    UUID    NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  organization_id UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start    DATE    NOT NULL,
  included        INTEGER NOT NULL DEFAULT 20,
  rollover_in     INTEGER NOT NULL DEFAULT 0,
  used            INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT therapist_session_quota_unique UNIQUE (therapist_id, period_start)
);


CREATE INDEX IF NOT EXISTS idx_therapist_session_quota_period ON therapist_session_quota (therapist_id, period_start DESC);


-- ------------------------------------------------------------
-- ai_assistant_credits
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_assistant_credits (
  therapist_id UUID    PRIMARY KEY REFERENCES therapists(id) ON DELETE CASCADE,
  balance      INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ------------------------------------------------------------
-- pricing_audit_log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pricing_audit_log (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id         UUID        NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  plan_key        VARCHAR(50) NOT NULL,
  change_type     VARCHAR(50) NOT NULL,
  changed_by      UUID        REFERENCES users(id),
  changed_by_role VARCHAR(50),
  old_values      JSONB,
  new_values      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX IF NOT EXISTS idx_pricing_audit_log_plan_id    ON pricing_audit_log (plan_id);

CREATE INDEX IF NOT EXISTS idx_pricing_audit_log_created_at ON pricing_audit_log (created_at);
