-- 🔴 0160: A PAID MONTH ON THE TRANSFER RAIL RENEWS ITSELF, UNLESS CANCELLED.
--
-- Without Stripe nothing raised the next month: an Egyptian plan was billed
-- once, when somebody pressed Subscribe, and a clinic's seats were billed only
-- when the count changed (live walkthrough). The renewal job raises the next
-- month from a paid one. This column is how Cancel stops it: "Cancel" on the
-- transfer rail was a silent no-op, because it only knew how to tell Stripe.
ALTER TABLE "renewal_obligations" ADD COLUMN IF NOT EXISTS "auto_renew" boolean DEFAULT true NOT NULL;
