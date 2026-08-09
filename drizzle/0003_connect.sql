-- Stripe Connect Express: therapist earnings from paid session links.
--
-- The therapist's money never lands in our balance. A patient payment is a
-- destination charge into their own connected account with our cut taken as an
-- application fee, so Stripe owns KYC, payouts and the tax forms.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "charges_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payouts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_rate_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auto_settle_from_earnings" boolean DEFAULT true NOT NULL;--> statement-breakpoint

-- A priced session cannot be joined until Stripe confirms; the gate is this
-- column, read on the server, not a disabled button on the join page.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "price_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'not_required' NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "therapist_id" uuid NOT NULL,
  "session_id" uuid NOT NULL,
  "payer_name" text,
  "payer_email" text,
  "gross_cents" integer NOT NULL,
  "platform_fee_cents" integer NOT NULL,
  "settled_invoice_cents" integer DEFAULT 0 NOT NULL,
  "therapist_net_cents" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "session_payments" ADD CONSTRAINT "session_payments_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_payments" ADD CONSTRAINT "session_payments_therapist_id_fk"
    FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE restrict;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_payments" ADD CONSTRAINT "session_payments_session_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- One live payment attempt per session: a patient double-tapping Pay must not
-- produce two charges for one seat.
CREATE UNIQUE INDEX IF NOT EXISTS "session_payments_session_unique" ON "session_payments" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_payments_therapist_idx" ON "session_payments" USING btree ("therapist_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_payments_checkout_idx" ON "session_payments" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_payments_status_idx" ON "session_payments" USING btree ("status","paid_at");--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "users_stripe_account_unique" ON "users" USING btree ("stripe_account_id");
