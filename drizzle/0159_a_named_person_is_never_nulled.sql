-- 🔴 0159: A PERSON A RULE REQUIRES IS NEVER SET TO NULL BY A DELETE.
--
-- `verify:sprint43` (0079 / 0082): a foreign key that is ON DELETE SET NULL
-- beside a CHECK that requires the column contradicts itself, and the delete
-- that would null it fails with an error naming the wrong rule. Three did:
-- the two people 0157 names on a cancelled refund, and the practice 0150
-- names as a transfer's payer. People and practices are closed, not deleted,
-- so RESTRICT says what is true.
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_cancel_asked_by_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_cancel_asked_by_user_id_fkey"
  FOREIGN KEY ("cancel_asked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_cancelled_by_user_id_fkey";
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_cancelled_by_user_id_fkey"
  FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "manual_payments" DROP CONSTRAINT IF EXISTS "manual_payments_organization_id_fkey";
--> statement-breakpoint
ALTER TABLE "manual_payments" ADD CONSTRAINT "manual_payments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT;
