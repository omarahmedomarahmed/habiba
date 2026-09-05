ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "session_type" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint

ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "currency" text DEFAULT 'usd' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "vat_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "vat_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "payer_country" text;--> statement-breakpoint
ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "presented_cents" integer;--> statement-breakpoint
ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "presented_currency" text;--> statement-breakpoint
ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "fx_rate_micro" integer;--> statement-breakpoint
ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "fx_quoted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "session_payments" ADD COLUMN IF NOT EXISTS "platform_fee_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "fx_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"base_currency" text NOT NULL,
	"quote_currency" text NOT NULL,
	"rate_micro" integer NOT NULL,
	"source" text DEFAULT 'static' NOT NULL,
	"quoted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fx_quotes_pair_idx" ON "fx_quotes" USING btree ("base_currency","quote_currency","expires_at");--> statement-breakpoint

/*
 * Backfill session_type from what is actually derivable, and no further.
 *
 * A radar session is identifiable: it has a guest name and no patient row at
 * creation, and a therapist_radar row that pointed at it. That is not recorded
 * historically, so the only honest signals are the price and the modality.
 * Everything else stays 'direct', which is the truthful default rather than a
 * guess dressed as data.
 */
UPDATE "sessions" SET "session_type" = 'paid_link' WHERE "price_cents" > 0;--> statement-breakpoint

/*
 * Existing payments were all USD with no VAT and a 10% cut, which is exactly
 * what they were. The cut rate is written explicitly rather than left at the
 * column default, so a row from before sprint 1 cannot later be misread as
 * having been charged 15%.
 */
UPDATE "session_payments" SET "platform_fee_bps" = 1000 WHERE "platform_fee_bps" = 0;
