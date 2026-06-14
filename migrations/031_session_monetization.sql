-- ============================================================
-- 031_session_monetization.sql
-- Session price gate, patient payments, therapist wallet,
-- booking offerings, booking sessions, schema fixes
-- ============================================================

-- ── 1. Session price gate ────────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_price_cents               INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS patient_payment_status            VARCHAR(30) NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS patient_stripe_payment_intent_id  VARCHAR(255),
  ADD COLUMN IF NOT EXISTS patient_stripe_checkout_session_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS patient_paid_at                   TIMESTAMPTZ;

-- ── 2. Offline bill tracking ──────────────────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS offline_bill_status    VARCHAR(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS offline_bill_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offline_bill_stripe_url TEXT;

-- ── 3. Therapist wallet ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS therapist_wallet (
  therapist_id             UUID PRIMARY KEY REFERENCES therapists(id) ON DELETE CASCADE,
  balance_cents            INTEGER NOT NULL DEFAULT 0,
  lifetime_earned_cents    INTEGER NOT NULL DEFAULT 0,
  lifetime_withdrawn_cents INTEGER NOT NULL DEFAULT 0,
  currency                 VARCHAR(3) NOT NULL DEFAULT 'USD',
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id        UUID NOT NULL REFERENCES therapists(id),
  type                VARCHAR(30) NOT NULL,
  amount_cents        INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  reference_type      VARCHAR(50),
  reference_id        UUID,
  description         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_therapist_id
  ON wallet_transactions (therapist_id, created_at DESC);

-- ── 4. Payout requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payout_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id  UUID NOT NULL REFERENCES therapists(id),
  amount_cents  INTEGER NOT NULL,
  bank_details  JSONB,
  status        VARCHAR(30) NOT NULL DEFAULT 'pending',
  admin_note    TEXT,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  processed_by  UUID REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_payout_requests_therapist_id
  ON payout_requests (therapist_id, requested_at DESC);

-- ── 5. Booking offerings (per-therapist duration+price config) ───────────────
CREATE TABLE IF NOT EXISTS therapist_booking_offerings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id  UUID NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
  duration_mins INTEGER NOT NULL,
  price_cents   INTEGER NOT NULL,
  currency      VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_offerings_therapist_duration UNIQUE (therapist_id, duration_mins)
);

-- ── 6. Booking sessions (self-scheduled by patient) ─────────────────────────
CREATE TABLE IF NOT EXISTS booking_sessions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  therapist_id                UUID NOT NULL REFERENCES therapists(id),
  offering_id                 UUID NOT NULL REFERENCES therapist_booking_offerings(id),
  patient_name                VARCHAR(255) NOT NULL,
  patient_email               VARCHAR(255) NOT NULL,
  scheduled_at                TIMESTAMPTZ NOT NULL,
  duration_mins               INTEGER NOT NULL,
  price_cents                 INTEGER NOT NULL,
  currency                    VARCHAR(3) NOT NULL DEFAULT 'USD',
  status                      VARCHAR(30) NOT NULL DEFAULT 'pending_payment',
  stripe_checkout_session_id  VARCHAR(255),
  stripe_payment_intent_id    VARCHAR(255),
  paid_at                     TIMESTAMPTZ,
  session_id                  UUID REFERENCES sessions(id),
  join_token                  UUID,
  confirmation_sent_at        TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT booking_sessions_stripe_checkout_unique UNIQUE (stripe_checkout_session_id)
);
CREATE INDEX IF NOT EXISTS idx_booking_sessions_therapist_id
  ON booking_sessions (therapist_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_booking_sessions_patient_email
  ON booking_sessions (patient_email);

-- ── 7. Fix session_fees column naming discrepancy ────────────────────────────
ALTER TABLE session_fees
  ADD COLUMN IF NOT EXISTS platform_amount NUMERIC(10,2)
    GENERATED ALWAYS AS (platform_fee) STORED,
  ADD COLUMN IF NOT EXISTS therapist_amount NUMERIC(10,2)
    GENERATED ALWAYS AS (therapist_payout) STORED,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);

UPDATE session_fees sf
SET organization_id = s.organization_id
FROM sessions s
WHERE s.id = sf.session_id AND sf.organization_id IS NULL;

-- ── 8. organizations.stripe_customer_id ─────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id
  ON organizations (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ── 9. Seed wallets for existing therapists ──────────────────────────────────
INSERT INTO therapist_wallet (therapist_id)
SELECT id FROM therapists
ON CONFLICT (therapist_id) DO NOTHING;

-- ── 10. Auto-create wallet trigger for new therapists ────────────────────────
CREATE OR REPLACE FUNCTION create_therapist_wallet()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO therapist_wallet (therapist_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_therapist_wallet ON therapists;
CREATE TRIGGER trg_create_therapist_wallet
  AFTER INSERT ON therapists
  FOR EACH ROW EXECUTE FUNCTION create_therapist_wallet();
