-- 🔴 0161: EVERY RULE IS A SETTING, AND EVERY SETTING HAS A HISTORY.
--
-- Founder rulings of 24 and 25 September 2026 (docs/DECISIONS.md):
--
-- 1. Every tax, document, provider, timing and approval rule is a setting an
--    admin can change after the legal entity, the accountant and counsel have
--    spoken. A setting with no history is a rule nobody can reconstruct, so
--    every write to platform_settings and country_settings leaves a row here
--    with the whole value before and after.
--
-- 2. The two-person rule is a switch per action (ruling 13): off for payouts,
--    company top-ups, verifications and pot returns; on for refunds; and on for
--    the two acts that create money from nothing, a transfer confirmed without
--    proof and a manual ledger adjustment (ruling 13c). A CHECK constraint
--    cannot read a setting, so the constraints that enforced the switchable
--    parts move into code (lib/billing/approvals.ts), tested in both positions
--    by verify:rules. The one rule that is not switchable stays here:
--    payout_requests_approver_not_payee. Nobody approves their own payout.
CREATE TABLE IF NOT EXISTS "settings_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope" text NOT NULL,
  "key" text NOT NULL,
  "before" jsonb,
  "after" jsonb NOT NULL,
  "changed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "settings_history_scope" CHECK ("scope" IN ('platform', 'country'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "settings_history_key_idx" ON "settings_history" ("scope", "key", "changed_at");
--> statement-breakpoint
-- A second person's approval for an act the switches say needs two. The first
-- person asks, with the whole act written down; a different person carries it
-- out exactly as asked, or declines it. Nothing is re-read from a form.
CREATE TABLE IF NOT EXISTS "pending_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "subject_id" text NOT NULL,
  "payload" jsonb NOT NULL,
  "reason" text NOT NULL,
  "asked_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "asked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "state" text DEFAULT 'asked' NOT NULL,
  "decided_by" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "decided_at" timestamp with time zone,
  CONSTRAINT "pending_approvals_kind" CHECK ("kind" IN ('transfer_without_proof', 'ledger_adjustment')),
  CONSTRAINT "pending_approvals_state" CHECK ("state" IN ('asked', 'done', 'declined')),
  CONSTRAINT "pending_approvals_reason" CHECK (length(trim("reason")) > 0),
  CONSTRAINT "pending_approvals_decided" CHECK (
    ("state" = 'asked' AND "decided_by" IS NULL AND "decided_at" IS NULL)
    OR ("state" <> 'asked' AND "decided_by" IS NOT NULL AND "decided_at" IS NOT NULL)
  ),
  CONSTRAINT "pending_approvals_two_people" CHECK ("decided_by" IS NULL OR "decided_by" <> "asked_by")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pending_approvals_one_open" ON "pending_approvals" ("kind", "subject_id") WHERE "state" = 'asked';
--> statement-breakpoint
ALTER TABLE "payout_requests" DROP CONSTRAINT IF EXISTS "payout_requests_approver_not_editor";
--> statement-breakpoint
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_sender_not_requester";
--> statement-breakpoint
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_destination_four_eyes";
--> statement-breakpoint
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_cancel_four_eyes";
--> statement-breakpoint
-- A cancel still names who asked and who cancelled, whoever they are.
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_cancel_named"
  CHECK (
    "status" <> 'cancelled'
    OR ("cancel_asked_by_user_id" IS NOT NULL AND "cancelled_by_user_id" IS NOT NULL)
    OR ("cancel_asked_by_user_id" IS NULL AND "cancelled_by_user_id" IS NULL
        AND "cancelled_at" IS NOT NULL AND "cancelled_at" < timestamptz '2026-09-25 00:00:00+00')
  ) NOT VALID;
--> statement-breakpoint
ALTER TABLE "refund_requests" VALIDATE CONSTRAINT "refund_requests_cancel_named";
--> statement-breakpoint
ALTER TABLE "pot_returns" DROP CONSTRAINT IF EXISTS "pot_returns_four_eyes";
--> statement-breakpoint
-- A sent return still names who asked and who sent it.
ALTER TABLE "pot_returns" ADD CONSTRAINT "pot_returns_sent_named"
  CHECK ("state" <> 'sent' OR "decided_by" IS NOT NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "pot_returns" VALIDATE CONSTRAINT "pot_returns_sent_named";
