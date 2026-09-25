-- 🔴 0171: MONEY KEEPS ITS WORD (the money fixes, K4 K14 K16c K17 ME20).
--
-- Additive, defaulted or nullable, `IF NOT EXISTS` where Postgres allows it, so
-- the running deployment survives the gap (H16) and applying it twice does no
-- harm.

-- K4: a "credit without proof" request whose cart was cancelled, discarded or
-- expired closes as `void`, decided by nobody, instead of staying open with a
-- Complete that can never succeed. Every other state keeps its rule.
ALTER TABLE "pending_approvals" DROP CONSTRAINT IF EXISTS "pending_approvals_state";
--> statement-breakpoint
ALTER TABLE "pending_approvals" ADD CONSTRAINT "pending_approvals_state"
  CHECK ("state" IN ('asked', 'done', 'declined', 'void'));
--> statement-breakpoint
ALTER TABLE "pending_approvals" DROP CONSTRAINT IF EXISTS "pending_approvals_decided";
--> statement-breakpoint
ALTER TABLE "pending_approvals" ADD CONSTRAINT "pending_approvals_decided" CHECK (
  ("state" = 'asked' AND "decided_by" IS NULL AND "decided_at" IS NULL)
  OR ("state" = 'void' AND "decided_by" IS NULL AND "decided_at" IS NOT NULL)
  OR ("state" IN ('done', 'declined') AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL)
);
--> statement-breakpoint
-- K14: an invitation that bought the practice a seat gives it back when it is
-- cancelled.
ALTER TABLE "clinician_invitations" ADD COLUMN IF NOT EXISTS "bought_seat" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- K17: the renewal reminders (7, 3, 1 days) already sent for a month, so each
-- is sent once.
ALTER TABLE "renewal_obligations" ADD COLUMN IF NOT EXISTS "reminded_days" integer[] DEFAULT '{}'::integer[] NOT NULL;
--> statement-breakpoint
-- K16c: the unspent part of an expired wallet credit already released from the
-- books, so an expiry is posted once and a hold released later is posted as
-- the difference.
ALTER TABLE "patient_credits" ADD COLUMN IF NOT EXISTS "expired_cents" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- ME20: one charger per completed session, claimed before credit is spent or
-- a fee netted.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "charge_claimed_at" timestamp with time zone;
--> statement-breakpoint
-- K20 (founder decision): a transfer for a booking cancelled before it was paid
-- goes to the patient's wallet by default, and a patient who asks gets it back
-- as a refund instead. That refund has no session payment behind it, only the
-- transfer, so a refund row names exactly one of the two.
ALTER TABLE "refund_requests" ALTER COLUMN "session_payment_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD COLUMN IF NOT EXISTS "manual_payment_id" uuid REFERENCES "manual_payments"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_one_subject";
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_one_subject"
  CHECK (num_nonnulls("session_payment_id", "manual_payment_id") = 1);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refund_requests_one_live_per_transfer"
  ON "refund_requests" ("manual_payment_id") WHERE status IN ('owed', 'sent');
