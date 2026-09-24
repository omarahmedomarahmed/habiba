-- 0142 required `exception_resolved_by` in its CHECK while the column's foreign
-- key is ON DELETE SET NULL, so removing a user who had ever resolved an
-- exception would have been refused by the constraint (the 0079 / 0082 shape
-- verify:sprint44 looks for). The sentence stays required; who decided is kept
-- while they exist and goes when they do, as on every other reviewer column.
ALTER TABLE "manual_payments" DROP CONSTRAINT IF EXISTS "manual_payments_exception_resolved_with_reason";
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
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
