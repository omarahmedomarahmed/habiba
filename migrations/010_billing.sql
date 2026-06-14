-- ============================================================
-- 010_billing.sql
-- 24Therapy.ai — Billing Engine: Plans, Subscriptions,
--                Invoices, Payments, Fees, Payouts, Credits
-- All columns defined up-front — no ALTER TABLE needed later.
-- ============================================================

-- ------------------------------------------------------------
-- subscription_plans
-- ------------------------------------------------------------
CREATE TABLE subscription_plans (
  id                        UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_key                  VARCHAR(50)    NOT NULL UNIQUE,
  name                      VARCHAR(100)   NOT NULL,
  tagline                   VARCHAR(255),
  description               TEXT,
  monthly_price_usd         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  -- Alias columns (GENERATED ALWAYS AS STORED) so legacy code
  -- reading price_monthly_usd / price_annual_usd still works.
  price_monthly_usd         NUMERIC(10,2)  GENERATED ALWAYS AS (monthly_price_usd) STORED,
  annual_price_usd          NUMERIC(10,2)  NOT NULL DEFAULT 0,
  price_annual_usd          NUMERIC(10,2)  GENERATED ALWAYS AS (annual_price_usd) STORED,
  currency                  VARCHAR(10)    NOT NULL DEFAULT 'USD',
  max_therapists            INTEGER,
  max_patients              INTEGER,
  max_sessions_month        INTEGER,
  session_limit             INTEGER,
  ai_notes_included         INTEGER,
  price_per_session_usd     NUMERIC(10,2),
  features                  JSONB          NOT NULL DEFAULT '{}',
  stripe_price_id_monthly   VARCHAR(255),
  stripe_price_id_annual    VARCHAR(255),
  is_active                 BOOLEAN        NOT NULL DEFAULT TRUE,
  is_featured               BOOLEAN        NOT NULL DEFAULT FALSE,
  badge_text                VARCHAR(100),
  cta_text                  VARCHAR(100)   NOT NULL DEFAULT 'Get Started',
  trial_days                INTEGER        NOT NULL DEFAULT 0,
  add_ons                   JSONB          NOT NULL DEFAULT '[]',
  highlight_color           VARCHAR(50),
  feature_bullets           JSONB          NOT NULL DEFAULT '[]',
  color_scheme              VARCHAR(20)    NOT NULL DEFAULT 'blue',
  audience                  VARCHAR(50)    NOT NULL DEFAULT 'therapist',
  faq                       JSONB          NOT NULL DEFAULT '[]',
  promotion_text            VARCHAR(255),
  promotion_expires_at      TIMESTAMPTZ,
  display_order             INTEGER        NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- subscriptions
-- ------------------------------------------------------------
CREATE TABLE subscriptions (
  id                     UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id        UUID         NOT NULL UNIQUE REFERENCES organizations(id),
  plan_id                UUID         NOT NULL REFERENCES subscription_plans(id),
  billing_cycle          VARCHAR(20)  NOT NULL DEFAULT 'monthly',
  status                 VARCHAR(50)  NOT NULL DEFAULT 'trial',
  trial_ends_at          TIMESTAMPTZ,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN      NOT NULL DEFAULT FALSE,
  cancelled_at           TIMESTAMPTZ,
  cancellation_reason    TEXT,
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id     VARCHAR(255),
  metadata               JSONB,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_organization_id        ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_status                 ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- subscription_history
-- ------------------------------------------------------------
CREATE TABLE subscription_history (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  subscription_id  UUID         NOT NULL REFERENCES subscriptions(id),
  from_plan_id     UUID         REFERENCES subscription_plans(id),
  to_plan_id       UUID         REFERENCES subscription_plans(id),
  old_status       VARCHAR(50),
  new_status       VARCHAR(50),
  reason           TEXT,
  changed_by       UUID         REFERENCES users(id),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- invoices
-- ------------------------------------------------------------
CREATE TABLE invoices (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID           NOT NULL REFERENCES organizations(id),
  patient_id       UUID           REFERENCES patients(id),
  invoice_type     VARCHAR(50)    NOT NULL DEFAULT 'subscription',
  invoice_number   VARCHAR(100)   UNIQUE,
  amount_subtotal  NUMERIC(10,2)  NOT NULL,
  discount_amount  NUMERIC(10,2)  NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(10,2)  NOT NULL DEFAULT 0,
  amount_total     NUMERIC(10,2)  NOT NULL,
  currency         VARCHAR(10)    NOT NULL DEFAULT 'USD',
  status           VARCHAR(50)    NOT NULL DEFAULT 'draft',
  stripe_invoice_id VARCHAR(255)  UNIQUE,
  issued_at        TIMESTAMPTZ,
  due_at           TIMESTAMPTZ,
  paid_at          TIMESTAMPTZ,
  void_at          TIMESTAMPTZ,
  notes            TEXT,
  pdf_url          TEXT,
  metadata         JSONB,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX idx_invoices_patient_id      ON invoices(patient_id);
CREATE INDEX idx_invoices_status          ON invoices(status);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- invoice_line_items
-- ------------------------------------------------------------
CREATE TABLE invoice_line_items (
  id          UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID           NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT           NOT NULL,
  quantity    INTEGER        NOT NULL DEFAULT 1,
  unit_price  NUMERIC(10,2)  NOT NULL,
  amount      NUMERIC(10,2)  NOT NULL,
  session_id  UUID           REFERENCES sessions(id),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- payments
-- ------------------------------------------------------------
CREATE TABLE payments (
  id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id          UUID           NOT NULL REFERENCES invoices(id),
  organization_id     UUID           NOT NULL REFERENCES organizations(id),
  payment_method      VARCHAR(50),
  provider            VARCHAR(50)    NOT NULL DEFAULT 'stripe',
  provider_payment_id VARCHAR(255)   UNIQUE,
  amount              NUMERIC(10,2)  NOT NULL,
  currency            VARCHAR(10)    NOT NULL DEFAULT 'USD',
  status              VARCHAR(50)    NOT NULL DEFAULT 'pending',
  failure_code        VARCHAR(100),
  failure_message     TEXT,
  refunded_amount     NUMERIC(10,2)  NOT NULL DEFAULT 0,
  receipt_url         TEXT,
  metadata            JSONB,
  created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_invoice_id      ON payments(invoice_id);
CREATE INDEX idx_payments_organization_id ON payments(organization_id);
CREATE INDEX idx_payments_status          ON payments(status);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- session_fees
-- ------------------------------------------------------------
CREATE TABLE session_fees (
  id                 UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id         UUID           NOT NULL UNIQUE REFERENCES sessions(id),
  patient_id         UUID           NOT NULL REFERENCES patients(id),
  therapist_id       UUID           NOT NULL REFERENCES therapists(id),
  gross_amount       NUMERIC(10,2)  NOT NULL,
  platform_fee       NUMERIC(10,2)  NOT NULL,
  platform_fee_pct   FLOAT          NOT NULL,
  therapist_payout   NUMERIC(10,2)  NOT NULL,
  currency           VARCHAR(10)    NOT NULL DEFAULT 'USD',
  status             VARCHAR(50)    NOT NULL DEFAULT 'pending',
  payment_id         UUID           REFERENCES payments(id),
  refund_amount      NUMERIC(10,2)  NOT NULL DEFAULT 0,
  refund_reason      TEXT,
  payout_id          UUID,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_session_fees_updated_at
  BEFORE UPDATE ON session_fees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- payouts
-- ------------------------------------------------------------
CREATE TABLE payouts (
  id                 UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id       UUID           NOT NULL REFERENCES therapists(id),
  organization_id    UUID           NOT NULL REFERENCES organizations(id),
  period_start       DATE           NOT NULL,
  period_end         DATE           NOT NULL,
  session_count      INTEGER        NOT NULL DEFAULT 0,
  gross_earnings     NUMERIC(10,2)  NOT NULL DEFAULT 0,
  platform_fees      NUMERIC(10,2)  NOT NULL DEFAULT 0,
  net_payout         NUMERIC(10,2)  NOT NULL DEFAULT 0,
  currency           VARCHAR(10)    NOT NULL DEFAULT 'USD',
  status             VARCHAR(50)    NOT NULL DEFAULT 'pending',
  stripe_payout_id   VARCHAR(255)   UNIQUE,
  stripe_account_id  VARCHAR(255),
  paid_at            TIMESTAMPTZ,
  failure_message    TEXT,
  metadata           JSONB,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payouts_therapist_id    ON payouts(therapist_id);
CREATE INDEX idx_payouts_status          ON payouts(status);
CREATE INDEX idx_payouts_period         ON payouts(period_start, period_end);

CREATE TRIGGER trg_payouts_updated_at
  BEFORE UPDATE ON payouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- payout_line_items
-- ------------------------------------------------------------
CREATE TABLE payout_line_items (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  payout_id       UUID           NOT NULL REFERENCES payouts(id),
  session_fee_id  UUID           NOT NULL REFERENCES session_fees(id),
  amount          NUMERIC(10,2)  NOT NULL,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_payout_line_items UNIQUE(payout_id, session_fee_id)
);

-- ------------------------------------------------------------
-- usage_records
-- ------------------------------------------------------------
CREATE TABLE usage_records (
  id              UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID           NOT NULL REFERENCES organizations(id),
  therapist_id    UUID           REFERENCES therapists(id),
  resource_type   VARCHAR(100)   NOT NULL,
  quantity        FLOAT          NOT NULL DEFAULT 1,
  unit            VARCHAR(50),
  session_id      UUID           REFERENCES sessions(id),
  billed          BOOLEAN        NOT NULL DEFAULT FALSE,
  billed_amount   NUMERIC(10,8),
  billing_period  DATE,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_records_organization_id  ON usage_records(organization_id);
CREATE INDEX idx_usage_records_billing_period   ON usage_records(billing_period, billed);

-- ------------------------------------------------------------
-- coupons
-- ------------------------------------------------------------
CREATE TABLE coupons (
  id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  code              VARCHAR(100)   NOT NULL UNIQUE,
  description       TEXT,
  discount_type     VARCHAR(50),
  discount_value    NUMERIC(10,2)  NOT NULL,
  currency          VARCHAR(10)    NOT NULL DEFAULT 'USD',
  applicable_plans  TEXT[],
  max_uses          INTEGER,
  uses_count        INTEGER        NOT NULL DEFAULT 0,
  valid_from        TIMESTAMPTZ,
  valid_until       TIMESTAMPTZ,
  is_active         BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- coupon_redemptions
-- ------------------------------------------------------------
CREATE TABLE coupon_redemptions (
  id               UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id        UUID           NOT NULL REFERENCES coupons(id),
  organization_id  UUID           NOT NULL REFERENCES organizations(id),
  redeemed_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  discount_applied NUMERIC(10,2),

  CONSTRAINT uq_coupon_redemptions UNIQUE(coupon_id, organization_id)
);

-- ------------------------------------------------------------
-- session_charges  (PAYG billing per completed session)
-- ------------------------------------------------------------
CREATE TABLE session_charges (
  id                    UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id       UUID           NOT NULL REFERENCES organizations(id),
  therapist_id          UUID           NOT NULL REFERENCES therapists(id),
  session_id            UUID           NOT NULL REFERENCES sessions(id),
  amount_usd            NUMERIC(10,2)  NOT NULL DEFAULT 0,
  discount_usd          NUMERIC(10,2)  NOT NULL DEFAULT 0,
  amount_due_usd        NUMERIC(10,2),
  plan_key              VARCHAR(50)    NOT NULL,
  description           VARCHAR(255),
  charged_at            TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  stripe_charge_id      VARCHAR(255),
  stripe_checkout_url   TEXT,
  paid_at               TIMESTAMPTZ,
  status                VARCHAR(20)    NOT NULL DEFAULT 'pending'
);

CREATE INDEX idx_session_charges_therapist_id    ON session_charges(therapist_id);
CREATE INDEX idx_session_charges_organization_id ON session_charges(organization_id);
CREATE INDEX idx_session_charges_session_id      ON session_charges(session_id);

-- ------------------------------------------------------------
-- therapist_session_quota  (included-session rollover tracking)
-- ------------------------------------------------------------
CREATE TABLE therapist_session_quota (
  id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id     UUID    NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  organization_id  UUID    NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start     DATE    NOT NULL,
  included         INT     NOT NULL DEFAULT 20,
  rollover_in      INT     NOT NULL DEFAULT 0,
  used             INT     NOT NULL DEFAULT 0,

  CONSTRAINT uq_therapist_quota UNIQUE(therapist_id, period_start)
);

CREATE INDEX idx_therapist_session_quota_period ON therapist_session_quota(therapist_id, period_start DESC);

-- ------------------------------------------------------------
-- ai_assistant_credits  (per-therapist credit balance)
-- ------------------------------------------------------------
CREATE TABLE ai_assistant_credits (
  therapist_id  UUID         PRIMARY KEY REFERENCES therapists(id) ON DELETE CASCADE,
  balance       INT          NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- pricing_audit_log  (tracks plan price/config changes)
-- ------------------------------------------------------------
CREATE TABLE pricing_audit_log (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id          UUID         NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  plan_key         VARCHAR(50)  NOT NULL,
  change_type      VARCHAR(50)  NOT NULL,
  changed_by       UUID         REFERENCES users(id),
  changed_by_role  VARCHAR(50),
  old_values       JSONB,
  new_values       JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pricing_audit_log_plan_id      ON pricing_audit_log(plan_id);
CREATE INDEX idx_pricing_audit_log_created_desc ON pricing_audit_log(created_at DESC);
