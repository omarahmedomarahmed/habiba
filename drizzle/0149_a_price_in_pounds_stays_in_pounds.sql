-- 🔴 0149: A THERAPIST'S PRICE IN POUNDS WAS CHARGED AS DOLLARS.
--
-- 16.5 let a clinician price in EGP and stored the pounds in
-- users.session_rate_cents with rate_currency 'egp', and copied both onto
-- each session. Nothing that charges, splits, funds from a pot or pays out
-- reads the currency: every one of them treats price_cents as US cents, so a
-- 1,500 EGP session would have been asked for as $1,500.
--
-- Now the pounds they typed live in rate_egp_minor and never drift, and
-- session_rate_cents is always dollars, re-derived whenever the operator
-- moves the rate. Sessions are priced in dollars at the rate of the day they
-- were booked, which is what the books are kept in.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rate_egp_minor" integer;
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_rate_egp_minor_nonnegative";
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_rate_egp_minor_nonnegative" CHECK ("rate_egp_minor" IS NULL OR "rate_egp_minor" >= 0);
--> statement-breakpoint
UPDATE "users"
   SET "rate_egp_minor" = "session_rate_cents",
       "session_rate_cents" = ROUND("session_rate_cents" * 1000000.0 / COALESCE(
         (SELECT NULLIF(("value"->>'egpRateMicro')::bigint, 0) FROM "platform_settings" WHERE "key" = 'payouts'),
         50000000))::int
 WHERE lower("rate_currency") = 'egp' AND "rate_egp_minor" IS NULL;
--> statement-breakpoint
UPDATE "sessions"
   SET "price_cents" = ROUND("price_cents" * 1000000.0 / COALESCE(
         (SELECT NULLIF(("value"->>'egpRateMicro')::bigint, 0) FROM "platform_settings" WHERE "key" = 'payouts'),
         50000000))::int,
       "price_currency" = 'usd'
 WHERE lower("price_currency") = 'egp' AND "payment_status" IN ('pending', 'not_required');
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "rate_currency" SET DEFAULT 'egp';
