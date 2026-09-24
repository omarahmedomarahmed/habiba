-- 🔴 0152: A REFUND GOES WHERE SOMEBODY ELSE SAID IT GOES.
--
-- The person pressing "sent" also typed the account the refund went to, so
-- under the four-eyes threshold one member of staff could send a patient's
-- refund anywhere and the books would call it refunded. Now the destination
-- is recorded first, by one person, and sent by a different one.
ALTER TABLE "refund_requests" ADD COLUMN IF NOT EXISTS "payee_set_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "refund_requests" DROP CONSTRAINT IF EXISTS "refund_requests_destination_four_eyes";
--> statement-breakpoint
ALTER TABLE "refund_requests" ADD CONSTRAINT "refund_requests_destination_four_eyes"
  CHECK ("status" <> 'sent' OR "payee_set_by_user_id" IS NULL OR "payee_set_by_user_id" <> "sent_by_user_id") NOT VALID;
