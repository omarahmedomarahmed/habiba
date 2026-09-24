-- W2-A04: a payout marked sent that never arrived can say so.
--
-- `markPayoutSent` posts the ledger when the money leaves the bank. When the
-- transfer bounces, or the clinician says nothing came, the only button was
-- "Confirm arrival" and `rejectPayout` refuses a sent payout, so the books said
-- the clinician had been paid and the queue could not be told otherwise.
--
-- `returned` is that state. The move from `sent` is guarded like every other
-- move on this table, and the reversing ledger post rides on the won move (the
-- W1-04 rule), so a second press reverses nothing. The row carries when, why
-- and the reversing transaction, so "returned" cannot exist without the books
-- saying so.
--
-- Widened, not replaced: every existing row holds one of the original five, so
-- VALIDATE is a scan that cannot fail.
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "returned_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "returned_reason" text;
--> statement-breakpoint
ALTER TABLE "payout_requests" ADD COLUMN IF NOT EXISTS "returned_ledger_txn_id" uuid;
--> statement-breakpoint
ALTER TABLE "payout_requests" DROP CONSTRAINT IF EXISTS "payout_requests_status_known";
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_status_known"
    CHECK ("status" IN ('requested', 'approved', 'sent', 'confirmed', 'rejected', 'returned'))
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "payout_requests" VALIDATE CONSTRAINT "payout_requests_status_known";
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "payout_requests"
    ADD CONSTRAINT "payout_requests_returned_was_sent"
    CHECK (
      "status" <> 'returned'
      OR (
        "sent_at" IS NOT NULL
        AND "returned_at" IS NOT NULL
        AND "returned_reason" IS NOT NULL
        AND "returned_ledger_txn_id" IS NOT NULL
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
