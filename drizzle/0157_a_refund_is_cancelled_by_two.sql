-- 🔴 0157 / A16: A REFUND OWED TO A PATIENT IS CANCELLED BY TWO PEOPLE.
--
-- One member of staff could cancel money owed back to a patient, and the row
-- did not say who. Now one person asks, with the reason, and a different
-- person cancels; the database refuses the same person twice and a cancel
-- that names nobody. NOT VALID: rows cancelled before today named nobody.
ALTER TABLE "refund_requests" ADD COLUMN IF NOT EXISTS "cancel_asked_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN IF NOT EXISTS "cancel_asked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_cancel_four_eyes";
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_cancel_four_eyes"
  CHECK (
    "status" <> 'cancelled'
    OR ("cancel_asked_by_user_id" IS NOT NULL AND "cancelled_by_user_id" IS NOT NULL
        AND "cancel_asked_by_user_id" <> "cancelled_by_user_id")
  ) NOT VALID;
