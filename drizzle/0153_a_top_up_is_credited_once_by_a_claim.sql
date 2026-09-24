-- 🔴 0153: A TOP-UP IS CREDITED ONCE, BY A CLAIM, NOT BY TWO CLOCKS.
--
-- The guard compared the payment's decided_at with sponsor_pots.updated_at,
-- which the application also writes from its own clock (every pot spend,
-- every coverage change). A booking landing between Confirm and the grant, or
-- a clock running ahead, left a confirmed transfer uncredited, and Retry met
-- the same comparison for ever. Now the grant claims the payment, credits the
-- pot and posts the legs in one transaction.
ALTER TABLE "manual_payments" ADD COLUMN IF NOT EXISTS "granted_at" timestamp with time zone;
--> statement-breakpoint
-- Every confirmed pot top-up already credited is marked, so none is credited twice.
UPDATE "manual_payments" p
   SET "granted_at" = COALESCE(p."decided_at", now())
 WHERE p."purpose" = 'pot_topup' AND p."state" = 'confirmed' AND p."granted_at" IS NULL
   AND EXISTS (SELECT 1 FROM "ledger_entries" l
                WHERE l."txn_kind" = 'pot_topup' AND l."ref_type" = 'sponsor' AND l."ref_id" = p."sponsor_id"
                  AND l."account" = 'cash' AND l."amount_cents" = p."settles_cents");
