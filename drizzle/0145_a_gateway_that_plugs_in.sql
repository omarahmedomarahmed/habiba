-- Egypt's card gateway and payouts provider, ready before the contracts are.
--
-- The Egyptian entity will collect card payments through a local gateway
-- (hosted checkout, a signed callback, a transaction that can be refunded) and
-- may pay clinicians through a payouts provider (send, then a signed callback
-- saying it arrived or failed). Neither is contracted. What can be built now
-- is everything around them, so the day the keys arrive only an adapter is
-- written: one row per attempt to take money through a gateway, and the
-- provider's side of a payout on the payout request itself.
--
-- `gateway_payments` is provider-agnostic on purpose: the vendor's name is a
-- value in `provider`, never a column, so a second gateway is a second adapter
-- and not a migration.
CREATE TABLE IF NOT EXISTS "gateway_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text NOT NULL,
  "purpose" text NOT NULL,
  "ref_id" uuid NOT NULL,
  "session_payment_id" uuid REFERENCES "session_payments"("id") ON DELETE SET NULL,
  "amount_minor" integer NOT NULL,
  "currency" text NOT NULL,
  "usd_cents" integer NOT NULL,
  "vat_cents" integer DEFAULT 0 NOT NULL,
  "provider_ref" text NOT NULL,
  "provider_txn_id" text,
  "state" text DEFAULT 'created' NOT NULL,
  "refunded_minor" integer DEFAULT 0 NOT NULL,
  "failure" text,
  "paid_at" timestamp with time zone,
  "failed_at" timestamp with time zone,
  "refunded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "gateway_payments"
    ADD CONSTRAINT "gateway_payments_purpose_known" CHECK ("purpose" IN ('session'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "gateway_payments"
    ADD CONSTRAINT "gateway_payments_state_known"
    CHECK ("state" IN ('created', 'paid', 'failed', 'refunded'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "gateway_payments"
    ADD CONSTRAINT "gateway_payments_amount_positive" CHECK ("amount_minor" > 0 AND "usd_cents" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "gateway_payments"
    ADD CONSTRAINT "gateway_payments_currency_known" CHECK ("currency" IN ('egp'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "gateway_payments"
    ADD CONSTRAINT "gateway_payments_paid_has_txn"
    CHECK ("state" NOT IN ('paid', 'refunded') OR ("provider_txn_id" IS NOT NULL AND "paid_at" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gateway_payments_provider_ref_unique"
  ON "gateway_payments" ("provider", "provider_ref");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gateway_payments_ref_idx" ON "gateway_payments" ("purpose", "ref_id");
--> statement-breakpoint
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "provider" text;
--> statement-breakpoint
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "provider_ref" text;
--> statement-breakpoint
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "provider_state" text;
--> statement-breakpoint
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "provider_error" text;
--> statement-breakpoint
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "provider_sender_user_id" uuid
  REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_provider_state_known"
    CHECK ("provider_state" IS NULL OR "provider_state" IN ('sending', 'sent', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_provider_has_ref"
    CHECK ("provider_state" IS NULL OR ("provider" IS NOT NULL AND "provider_ref" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payout_requests_provider_ref_unique"
  ON "payout_requests" ("provider", "provider_ref") WHERE "provider_ref" IS NOT NULL;
