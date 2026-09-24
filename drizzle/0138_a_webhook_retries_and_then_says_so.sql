-- W2-X03: a webhook is retried on a schedule, and then it says it failed.
--
-- Deliveries were drained once a day inside the billing cron, six attempts a
-- day apart, and a delivery that used them all said "Pending" for ever. Now the
-- hourly wake drains them, each failure schedules the next try further out
-- (5 minutes, 30 minutes, 2 hours, 5 hours, then every 10 hours, about three
-- days in all: `lib/partner/retry.ts`), and the last failure writes
-- `failed_at`. The partner can redeliver by hand and send a test event.
--
-- Additive (H16): two nullable columns, one widened CHECK, one index.
ALTER TABLE "partner_webhook_deliveries" ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp with time zone DEFAULT now();
--> statement-breakpoint
ALTER TABLE "partner_webhook_deliveries" ADD COLUMN IF NOT EXISTS "failed_at" timestamp with time zone;
--> statement-breakpoint
-- A delivery that already spent the old six attempts failed; say so. The rest
-- still waiting are due at the next wake.
UPDATE "partner_webhook_deliveries"
   SET "failed_at" = now(), "next_attempt_at" = NULL
 WHERE "delivered_at" IS NULL AND "failed_at" IS NULL AND "attempts" >= 6;
--> statement-breakpoint
UPDATE "partner_webhook_deliveries"
   SET "next_attempt_at" = NULL
 WHERE "delivered_at" IS NOT NULL;
--> statement-breakpoint
-- Delivered or failed, never both: a redelivery that succeeds clears the failure.
DO $$
BEGIN
  ALTER TABLE "partner_webhook_deliveries" ADD CONSTRAINT "partner_webhook_deliveries_one_outcome"
    CHECK ("delivered_at" IS NULL OR "failed_at" IS NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "partner_webhook_deliveries" VALIDATE CONSTRAINT "partner_webhook_deliveries_one_outcome";
--> statement-breakpoint
-- `ping` is the test event. It is not in WEBHOOK_EVENTS, so nobody subscribes
-- to it; it is sent only when the partner presses the button.
ALTER TABLE "partner_webhook_deliveries" DROP CONSTRAINT IF EXISTS "partner_webhook_deliveries_event";
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "partner_webhook_deliveries" ADD CONSTRAINT "partner_webhook_deliveries_event"
    CHECK ("event" IN ('session.completed', 'note.approved', 'grant.revoked', 'record.claimed',
                       'subject.unlinked', 'ping')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "partner_webhook_deliveries" VALIDATE CONSTRAINT "partner_webhook_deliveries_event";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "partner_webhook_deliveries_due_idx"
  ON "partner_webhook_deliveries" ("next_attempt_at")
  WHERE "delivered_at" IS NULL AND "failed_at" IS NULL;
