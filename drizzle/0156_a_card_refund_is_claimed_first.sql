-- 🔴 0156: A CARD REFUND IS CLAIMED BEFORE THE GATEWAY IS ASKED.
--
-- The gateway was called before the attempt was claimed, so two callers at
-- once (the console and an automatic path, or two tabs) could both refund it.
-- A claim with a timestamp, so a claim that died with its process lapses.
ALTER TABLE "gateway_payments" ADD COLUMN IF NOT EXISTS "refunding_at" timestamp with time zone;
