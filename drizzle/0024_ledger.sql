-- Double-entry books, and the two things that made them necessary.
--
-- Until now the platform could only take a patient payment as a destination
-- charge into a clinician's own verified account: the money never touched us,
-- so there was nothing to account for. A clinician who had not finished Stripe
-- onboarding simply could not charge, which meant they could not go on the
-- radar for money either.
--
-- Taking the charge ourselves and holding their share fixes that and creates a
-- real obligation. `ledger_entries` is where that obligation lives, and
-- `earnings_transfers` is the record of discharging it.

CREATE TABLE IF NOT EXISTS "ledger_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "txn_id" uuid NOT NULL,
  "txn_kind" text NOT NULL,
  "account" text NOT NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'usd',
  "ref_type" text,
  "ref_id" uuid,
  "memo" text NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ledger_txn_idx" ON "ledger_entries" ("txn_id");
CREATE INDEX IF NOT EXISTS "ledger_account_idx" ON "ledger_entries" ("account", "created_at");
CREATE INDEX IF NOT EXISTS "ledger_user_idx" ON "ledger_entries" ("user_id", "account");
CREATE INDEX IF NOT EXISTS "ledger_org_idx" ON "ledger_entries" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "ledger_ref_idx" ON "ledger_entries" ("ref_type", "ref_id");

CREATE TABLE IF NOT EXISTS "earnings_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "therapist_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "amount_cents" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "stripe_transfer_id" text,
  "stripe_account_id" text,
  "failure_reason" text,
  "released_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "paid_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "earnings_transfers_therapist_idx"
  ON "earnings_transfers" ("therapist_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "earnings_transfers_stripe_unique"
  ON "earnings_transfers" ("stripe_transfer_id");

-- How the money arrived, and how the patient paid.
--
-- `capture` defaults to 'destination' because that is what every existing row
-- was: there was no other option when they were written.
ALTER TABLE "session_payments"
  ADD COLUMN IF NOT EXISTS "capture" text NOT NULL DEFAULT 'destination',
  ADD COLUMN IF NOT EXISTS "stripe_charge_id" text,
  ADD COLUMN IF NOT EXISTS "payment_brand" text,
  ADD COLUMN IF NOT EXISTS "payment_last4" text,
  ADD COLUMN IF NOT EXISTS "receipt_url" text;
