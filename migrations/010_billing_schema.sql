-- ============================================================
-- 010_billing_schema.sql
-- 24Therapy.ai — Billing, Subscriptions, Payments, Payouts
-- ============================================================
-- Covers:
-- - Organization subscription management
-- - Session fees (marketplace transactions)
-- - Therapist payouts
-- - Invoice generation
-- - Payment processing (Stripe integration)
-- - Revenue analytics
-- ============================================================
-- Depends on: 001_core_schema.sql, 002_therapists_schema.sql,
--             003_patients_schema.sql, 006_sessions_schema.sql
-- ============================================================

-- ============================================================
-- SUBSCRIPTION PLANS (Reference)
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_key            VARCHAR(50) UNIQUE NOT NULL,
        -- free, professional, practice, enterprise
    name                VARCHAR(100) NOT NULL,
    description         TEXT,
    monthly_price_usd   DECIMAL(10,2) DEFAULT 0.00,
    annual_price_usd    DECIMAL(10,2) DEFAULT 0.00,
    currency            VARCHAR(10) DEFAULT 'USD',
    max_therapists      INTEGER,    -- NULL = unlimited
    max_patients        INTEGER,    -- NULL = unlimited
    max_sessions_month  INTEGER,    -- NULL = unlimited
    ai_notes_included   INTEGER,    -- NULL = unlimited (-1 = none)
    features            JSONB,
        -- { "radar": true, "api_access": false, "white_label": false,
        --   "advanced_analytics": true, "custom_branding": false }
    stripe_price_id_monthly VARCHAR(255),
    stripe_price_id_annual  VARCHAR(255),
    is_active           BOOLEAN DEFAULT TRUE,
    display_order       INTEGER DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_plans (plan_key, name, description, monthly_price_usd, annual_price_usd, max_therapists, max_sessions_month, ai_notes_included, features) VALUES
('free',         'Free',         'Get started — pay per session processed',    0,    0,    1,   10,  10,
 '{"radar": false, "api_access": false, "white_label": false, "advanced_analytics": false, "custom_branding": false}'),
('professional', 'Professional', 'Unlimited AI for solo therapists',          99,   990,  1,   NULL, NULL,
 '{"radar": true, "api_access": false, "white_label": false, "advanced_analytics": true, "custom_branding": true}'),
('practice',     'Practice',     'Multi-therapist team plans',                299,  2990, 10,  NULL, NULL,
 '{"radar": true, "api_access": false, "white_label": false, "advanced_analytics": true, "custom_branding": true}'),
('enterprise',   'Enterprise',   'Hospitals, universities, healthcare systems', NULL, NULL, NULL, NULL, NULL,
 '{"radar": true, "api_access": true, "white_label": true, "advanced_analytics": true, "custom_branding": true}')
ON CONFLICT (plan_key) DO NOTHING;

-- ============================================================
-- SUBSCRIPTIONS
-- Organization-level subscription state
-- ============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id     UUID UNIQUE NOT NULL REFERENCES organizations(id),
    plan_id             UUID NOT NULL REFERENCES subscription_plans(id),
    billing_cycle       VARCHAR(20) DEFAULT 'monthly',
        -- monthly, annual
    status              VARCHAR(50) DEFAULT 'trial',
        -- trial, active, past_due, suspended, cancelled, archived
    trial_ends_at       TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end  TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    cancelled_at        TIMESTAMPTZ,
    cancellation_reason TEXT,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id     VARCHAR(255),
    metadata            JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_organization ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status       ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe       ON subscriptions(stripe_subscription_id);

-- ============================================================
-- SUBSCRIPTION HISTORY
-- Track all subscription state changes
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_history (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    from_plan_id    UUID REFERENCES subscription_plans(id),
    to_plan_id      UUID REFERENCES subscription_plans(id),
    old_status      VARCHAR(50),
    new_status      VARCHAR(50),
    reason          TEXT,
    changed_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVOICES
-- Platform subscription invoices + session invoices
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    patient_id      UUID REFERENCES patients(id),  -- for session invoices
    invoice_type    VARCHAR(50) DEFAULT 'subscription',
        -- subscription, session, one_time
    invoice_number  VARCHAR(100) UNIQUE,
    amount_subtotal DECIMAL(10,2) NOT NULL,
    discount_amount DECIMAL(10,2) DEFAULT 0.00,
    tax_amount      DECIMAL(10,2) DEFAULT 0.00,
    amount_total    DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(10) DEFAULT 'USD',
    status          VARCHAR(50) DEFAULT 'draft',
        -- draft, sent, paid, overdue, void, uncollectible
    stripe_invoice_id VARCHAR(255) UNIQUE,
    issued_at       TIMESTAMPTZ,
    due_at          TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    void_at         TIMESTAMPTZ,
    notes           TEXT,
    pdf_url         TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_organization ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_patient      ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status       ON invoices(status);

-- ============================================================
-- INVOICE LINE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_line_items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description   TEXT NOT NULL,
    quantity      INTEGER DEFAULT 1,
    unit_price    DECIMAL(10,2) NOT NULL,
    amount        DECIMAL(10,2) NOT NULL,
    session_id    UUID REFERENCES sessions(id),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- Payment transactions (linked to invoices)
-- ============================================================

CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id          UUID NOT NULL REFERENCES invoices(id),
    organization_id     UUID NOT NULL REFERENCES organizations(id),
    payment_method      VARCHAR(50),
        -- stripe_card, stripe_bank, paypal, manual, voucher
    provider            VARCHAR(50) DEFAULT 'stripe',
    provider_payment_id VARCHAR(255) UNIQUE,  -- Stripe PaymentIntent ID
    amount              DECIMAL(10,2) NOT NULL,
    currency            VARCHAR(10) DEFAULT 'USD',
    status              VARCHAR(50) DEFAULT 'pending',
        -- pending, processing, completed, failed, refunded, partially_refunded
    failure_code        VARCHAR(100),
    failure_message     TEXT,
    refunded_amount     DECIMAL(10,2) DEFAULT 0.00,
    receipt_url         TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice      ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_organization ON payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_status       ON payments(status);

-- ============================================================
-- SESSION FEES (Marketplace)
-- Fees for sessions booked through the marketplace/Radar
-- ============================================================

CREATE TABLE IF NOT EXISTS session_fees (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID UNIQUE NOT NULL REFERENCES sessions(id),
    patient_id          UUID NOT NULL REFERENCES patients(id),
    therapist_id        UUID NOT NULL REFERENCES therapists(id),
    gross_amount        DECIMAL(10,2) NOT NULL,  -- What patient pays
    platform_fee        DECIMAL(10,2) NOT NULL,  -- 24Therapy commission (15-25%)
    platform_fee_pct    FLOAT NOT NULL,           -- e.g., 0.20 = 20%
    therapist_payout    DECIMAL(10,2) NOT NULL,   -- What therapist receives
    currency            VARCHAR(10) DEFAULT 'USD',
    status              VARCHAR(50) DEFAULT 'pending',
        -- pending, authorized, captured, payout_pending, payout_completed, refunded
    payment_id          UUID REFERENCES payments(id),
    refund_amount       DECIMAL(10,2) DEFAULT 0.00,
    refund_reason       TEXT,
    payout_id           UUID,  -- FK to payouts when processed
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- THERAPIST PAYOUTS
-- Scheduled and completed payouts to therapists
-- ============================================================

CREATE TABLE IF NOT EXISTS payouts (
    id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    therapist_id          UUID NOT NULL REFERENCES therapists(id),
    organization_id       UUID NOT NULL REFERENCES organizations(id),
    period_start          DATE NOT NULL,
    period_end            DATE NOT NULL,
    session_count         INTEGER DEFAULT 0,
    gross_earnings        DECIMAL(10,2) DEFAULT 0.00,
    platform_fees         DECIMAL(10,2) DEFAULT 0.00,
    net_payout            DECIMAL(10,2) DEFAULT 0.00,
    currency              VARCHAR(10) DEFAULT 'USD',
    status                VARCHAR(50) DEFAULT 'pending',
        -- pending, processing, completed, failed, cancelled
    stripe_payout_id      VARCHAR(255) UNIQUE,
    stripe_account_id     VARCHAR(255),  -- Therapist's Stripe Connect account
    paid_at               TIMESTAMPTZ,
    failure_message       TEXT,
    metadata              JSONB,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_therapist ON payouts(therapist_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status    ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_payouts_period    ON payouts(period_start, period_end);

-- ============================================================
-- PAYOUT LINE ITEMS
-- Which session fees are included in a payout
-- ============================================================

CREATE TABLE IF NOT EXISTS payout_line_items (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_id     UUID NOT NULL REFERENCES payouts(id),
    session_fee_id UUID NOT NULL REFERENCES session_fees(id),
    amount        DECIMAL(10,2) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(payout_id, session_fee_id)
);

-- ============================================================
-- USAGE METERING
-- Track AI usage for pay-per-use billing (Free tier)
-- ============================================================

CREATE TABLE IF NOT EXISTS usage_records (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    therapist_id    UUID REFERENCES therapists(id),
    resource_type   VARCHAR(100) NOT NULL,
        -- ai_note, transcript_minute, radar_session, api_call, storage_gb
    quantity        FLOAT NOT NULL DEFAULT 1,
    unit            VARCHAR(50),  -- minutes, tokens, calls, GB
    session_id      UUID REFERENCES sessions(id),
    billed          BOOLEAN DEFAULT FALSE,
    billed_amount   DECIMAL(10,8),
    billing_period  DATE,         -- YYYY-MM for month
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_organization ON usage_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_billing      ON usage_records(billing_period, billed);

-- ============================================================
-- COUPONS & PROMOTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS coupons (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code              VARCHAR(100) UNIQUE NOT NULL,
    description       TEXT,
    discount_type     VARCHAR(50),   -- percentage, fixed_amount, free_months
    discount_value    DECIMAL(10,2) NOT NULL,
    currency          VARCHAR(10) DEFAULT 'USD',
    applicable_plans  TEXT[],        -- which plans it can be applied to
    max_uses          INTEGER,       -- NULL = unlimited
    uses_count        INTEGER DEFAULT 0,
    valid_from        TIMESTAMPTZ,
    valid_until       TIMESTAMPTZ,
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coupon_id       UUID NOT NULL REFERENCES coupons(id),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    redeemed_at     TIMESTAMPTZ DEFAULT NOW(),
    discount_applied DECIMAL(10,2),
    UNIQUE(coupon_id, organization_id)
);

-- ============================================================
-- BILLING ANALYTICS VIEW
-- ============================================================

CREATE OR REPLACE VIEW billing_summary AS
SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    sp.plan_key,
    s.status AS subscription_status,
    s.current_period_end,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'completed'), 0) AS total_revenue_usd,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'paid') AS invoices_paid,
    COUNT(DISTINCT i.id) FILTER (WHERE i.status = 'overdue') AS invoices_overdue
FROM organizations o
LEFT JOIN subscriptions s ON s.organization_id = o.id
LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
LEFT JOIN invoices i ON i.organization_id = o.id
LEFT JOIN payments p ON p.invoice_id = i.id
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.name, sp.plan_key, s.status, s.current_period_end;

-- ============================================================
-- REVENUE RECOGNITION TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_subscription_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        -- Update organization subscription status when payment succeeds
        UPDATE subscriptions s
        SET status = 'active', updated_at = NOW()
        FROM invoices i
        WHERE i.id = NEW.invoice_id
          AND i.organization_id = s.organization_id
          AND s.status = 'past_due';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_subscription_update
    AFTER UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_subscription_on_payment();

-- Reviewed: 2026-06-13 — 24Therapy audit
