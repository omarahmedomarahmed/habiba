-- 🔴 0158: THE TWO REFUND RULES, VALIDATED (H1).
--
-- 0152 and 0157 added their checks NOT VALID so the migration could not fail
-- on rows written before them, and H1 says no constraint stays unvalidated:
-- a NOT VALID check says nothing about the rows already there. 0152's holds
-- for every earlier row (none names who set the destination). 0157's is
-- restated so a cancel from before today, which named nobody, is the one
-- exemption, by date and by naming nobody, and then both are validated.
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_cancel_four_eyes";
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_cancel_four_eyes"
  CHECK (
    "status" <> 'cancelled'
    OR ("cancel_asked_by_user_id" IS NOT NULL AND "cancelled_by_user_id" IS NOT NULL
        AND "cancel_asked_by_user_id" <> "cancelled_by_user_id")
    OR ("cancel_asked_by_user_id" IS NULL AND "cancelled_by_user_id" IS NULL
        AND "cancelled_at" < timestamptz '2026-09-25 00:00:00+00')
  ) NOT VALID;
--> statement-breakpoint
ALTER TABLE "refund_requests" VALIDATE CONSTRAINT "refund_requests_cancel_four_eyes";
--> statement-breakpoint
ALTER TABLE "refund_requests" VALIDATE CONSTRAINT "refund_requests_destination_four_eyes";
