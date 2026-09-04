CREATE TABLE IF NOT EXISTS "session_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"tier_key" text NOT NULL,
	"rate_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"consumed" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "session_credits" ADD CONSTRAINT "session_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_credits_spend_idx" ON "session_credits" USING btree ("organization_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_credits_checkout_idx" ON "session_credits" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
UPDATE "subscriptions" SET "plan" = 'payg', "stripe_subscription_id" = NULL, "current_period_end" = NULL, "cancel_at_period_end" = false, "updated_at" = now() WHERE "plan" <> 'payg';
