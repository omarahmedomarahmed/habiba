-- 🔴 0172: A SECOND OWNER CAN BE INVITED, AND A POT RETURN IS CANCELLED WITH A REASON.
--
-- A ledger adjustment waits for a second super admin, and the team page could
-- only mint staff and managers, so a company with one founder could never post
-- one. An owner invite is now an act on /admin/team, and once a second owner
-- exists a third needs one of the others to complete it: the same approvals
-- table, one more kind.
ALTER TABLE "pending_approvals" DROP CONSTRAINT IF EXISTS "pending_approvals_kind";
--> statement-breakpoint
ALTER TABLE "pending_approvals" ADD CONSTRAINT "pending_approvals_kind"
  CHECK ("kind" IN ('transfer_without_proof', 'ledger_adjustment', 'owner_invite'));
--> statement-breakpoint
-- A pot return was cancelled by one press with no reason. Now the first person
-- writes the reason and, while company returns need two people, a different
-- person cancels, as a refund's cancel already works.
ALTER TABLE "pot_returns" ADD COLUMN IF NOT EXISTS "cancel_reason" text;
--> statement-breakpoint
ALTER TABLE "pot_returns" ADD COLUMN IF NOT EXISTS "cancel_asked_by" uuid;
--> statement-breakpoint
ALTER TABLE "pot_returns" ADD COLUMN IF NOT EXISTS "cancel_asked_at" timestamp with time zone;
--> statement-breakpoint
-- A return cancelled before this took no reason: it says so, and the person
-- who cancelled it is the one who asked. Then the rule holds for every row.
UPDATE "pot_returns"
   SET "cancel_reason" = COALESCE("cancel_reason", 'Cancelled before 0172, when a cancel took no reason.'),
       "cancel_asked_by" = COALESCE("cancel_asked_by", "decided_by", "requested_by")
 WHERE "state" = 'cancelled';
--> statement-breakpoint
UPDATE "pot_returns" SET "decided_by" = COALESCE("decided_by", "cancel_asked_by")
 WHERE "state" = 'cancelled' AND "decided_by" IS NULL;
--> statement-breakpoint
ALTER TABLE "pot_returns" DROP CONSTRAINT IF EXISTS "pot_returns_cancel_named";
--> statement-breakpoint
ALTER TABLE "pot_returns" ADD CONSTRAINT "pot_returns_cancel_named"
  CHECK ("state" <> 'cancelled' OR ("cancel_reason" IS NOT NULL AND "cancel_asked_by" IS NOT NULL AND "decided_by" IS NOT NULL));
