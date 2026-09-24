-- W2-A03: money on the transfer rail that arrived and did not do its job is
-- work on a screen, never a log line.
--
-- Four things went to `log.warn` or `log.error` and nowhere else: a confirmed
-- transfer whose grant threw ("Tell an engineer"), a transfer for a session
-- that was cancelled while it was checked, a bill paid when nothing was due,
-- and a transfer larger than the bill. A4 says money that arrives with no
-- claim is "a line somebody has to decide about, never silently kept", and
-- these four were kept silently.
--
-- The row that recorded the money carries the exception, when it was raised,
-- and, once somebody decides, who did and what they did. A decision without a
-- sentence is refused by the CHECK, the same rule as a rejection.
ALTER TABLE "manual_payments" ADD COLUMN IF NOT EXISTS "exception" text;
--> statement-breakpoint
ALTER TABLE "manual_payments" ADD COLUMN IF NOT EXISTS "exception_detail" text;
--> statement-breakpoint
ALTER TABLE "manual_payments" ADD COLUMN IF NOT EXISTS "exception_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "manual_payments" ADD COLUMN IF NOT EXISTS "exception_resolved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "manual_payments" ADD COLUMN IF NOT EXISTS "exception_resolved_by" uuid
  REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "manual_payments" ADD COLUMN IF NOT EXISTS "exception_resolution" text;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "manual_payments"
    ADD CONSTRAINT "manual_payments_exception_known"
    CHECK ("exception" IS NULL OR "exception" IN ('grant_failed', 'not_payable', 'overpaid'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "manual_payments"
    ADD CONSTRAINT "manual_payments_exception_resolved_with_reason"
    CHECK (
      "exception_resolved_at" IS NULL
      OR (
        "exception_resolution" IS NOT NULL
        AND length(btrim("exception_resolution")) >= 10
        AND "exception_resolved_by" IS NOT NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "manual_payments_open_exception_idx"
  ON "manual_payments" ("exception_at")
  WHERE "exception" IS NOT NULL AND "exception_resolved_at" IS NULL;
