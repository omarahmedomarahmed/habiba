-- W1-28a: a refund we owe on the manual rail is a row somebody works.
--
-- A bank-transfer payment has no charge to reverse, so `refundSessionPayment`
-- refuses it. Since W1-12 and W1-13 the product says "refund owed" honestly
-- (a no-show, a clinician's cancellation), and then nothing held the promise:
-- no queue, no owner, no ledger reversal. This is that queue, shaped like the
-- payout queue it sits beside: owed, sent with proof, confirmed; or cancelled
-- with a reason.
--
-- Two rules live here rather than only in code:
--   * at most one LIVE row (owed or sent) per payment, so two paths that both
--     say "refund owed" for one payment make one row, and
--   * a row that is sent or confirmed carries its proof and the ledger
--     transaction that reversed the payment, so "sent" cannot exist without
--     the books saying so.
CREATE TABLE IF NOT EXISTS "refund_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_payment_id" uuid NOT NULL REFERENCES "session_payments"("id") ON DELETE RESTRICT,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL,
  "payee_name" text,
  "payee_method" text,
  "payee_identifier" text,
  "payee_account_name" text,
  "status" text DEFAULT 'owed' NOT NULL,
  "reason" text NOT NULL,
  "cancelled_reason" text,
  "requested_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "sent_by_user_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "sent_at" timestamp with time zone,
  "proof_url" text,
  "ledger_txn_id" uuid,
  "confirmed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "refund_requests_status_known"
    CHECK ("status" IN ('owed', 'sent', 'confirmed', 'cancelled')),
  CONSTRAINT "refund_requests_amount_positive" CHECK ("amount_cents" > 0),
  CONSTRAINT "refund_requests_sent_has_proof"
    CHECK ("status" NOT IN ('sent', 'confirmed')
           OR ("proof_url" IS NOT NULL AND "ledger_txn_id" IS NOT NULL
               AND "sent_by_user_id" IS NOT NULL AND "sent_at" IS NOT NULL)),
  CONSTRAINT "refund_requests_cancel_has_reason"
    CHECK ("status" <> 'cancelled' OR "cancelled_reason" IS NOT NULL),
  CONSTRAINT "refund_requests_sender_not_requester"
    CHECK ("sent_by_user_id" IS NULL OR "requested_by_user_id" IS NULL
           OR "sent_by_user_id" <> "requested_by_user_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refund_requests_one_live_per_payment"
  ON "refund_requests" ("session_payment_id")
  WHERE "status" IN ('owed', 'sent');

CREATE INDEX IF NOT EXISTS "refund_requests_open_idx"
  ON "refund_requests" ("created_at")
  WHERE "status" IN ('owed', 'sent');
