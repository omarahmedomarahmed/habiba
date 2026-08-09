-- Unify billing onto a single `invoices` table.
--
-- `session_charges` only ever recorded metered session bills, so a therapist
-- who paid for a subscription saw no record of it anywhere. Two tables for
-- "money the customer owes us" is also how a ledger and a dashboard drift
-- apart. Existing rows are carried across rather than dropped.

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "session_id" uuid,
  "amount_cents" integer NOT NULL,
  "discount_cents" integer DEFAULT 0 NOT NULL,
  "discount_reason" text,
  "discounted_by" uuid,
  "status" text NOT NULL,
  "description" text NOT NULL,
  "stripe_checkout_session_id" text,
  "stripe_payment_intent_id" text,
  "period_start" timestamp with time zone,
  "period_end" timestamp with time zone,
  "issued_at" timestamp with time zone DEFAULT now() NOT NULL,
  "paid_at" timestamp with time zone
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_session_id_sessions_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_discounted_by_users_id_fk"
    FOREIGN KEY ("discounted_by") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

-- One bill per session: this is what makes the reconciler cron racing a live
-- session completion a no-op instead of a double charge.
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_session_unique" ON "invoices" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_org_idx" ON "invoices" USING btree ("organization_id","issued_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoices_checkout_idx" ON "invoices" USING btree ("stripe_checkout_session_id");--> statement-breakpoint

-- Carry existing session charges across. 'pending' becomes 'due'.
INSERT INTO "invoices" (
  "id", "organization_id", "kind", "session_id", "amount_cents", "status",
  "description", "stripe_checkout_session_id", "stripe_payment_intent_id",
  "issued_at", "paid_at"
)
SELECT
  "id", "organization_id", 'session', "session_id", "amount_cents",
  CASE WHEN "status" = 'pending' THEN 'due' ELSE "status" END,
  "description", NULL, "stripe_payment_intent_id", "charged_at", "paid_at"
FROM "session_charges"
ON CONFLICT DO NOTHING;
--> statement-breakpoint

DROP TABLE IF EXISTS "session_charges";--> statement-breakpoint

-- Admin-granted credit applied to a subscriber's next renewal.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "upcoming_discount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "upcoming_discount_reason" text;--> statement-breakpoint

-- The copilot is a fourth kind of AI request; the column is free text so no
-- constraint change is needed, but the index below keeps per-kind rollups fast
-- on the admin usage dashboard.
CREATE INDEX IF NOT EXISTS "ai_request_logs_kind_idx" ON "ai_request_logs" USING btree ("kind","created_at");
