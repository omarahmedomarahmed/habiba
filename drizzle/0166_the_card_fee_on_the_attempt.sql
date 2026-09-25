-- 🔴 0166: THE CARD FEE, FROZEN ON THE ATTEMPT (founder ruling 12).
--
-- The patient pays the card gateway's fee, on the card part of the price
-- only. The fee is worked out from the rules when the checkout opens, added
-- to what the gateway is asked for, and has to be read back when the gateway
-- says "paid" and again on a refund. Nothing on the attempt could hold it:
-- `amount_minor` is the whole charge, `usd_cents` is what settles the
-- session and `vat_cents` is the tax, and recomputing the fee later from the
-- rule or the rate would price an open checkout with a rule changed after it
-- opened, which the rulings forbid.
--
-- Additive and defaulted to zero, so the running deployment survives the gap
-- (H16) and every attempt made before this is correctly an attempt with no
-- fee. `IF NOT EXISTS`, so applying it by hand to a development database
-- ahead of the runner does no harm when the runner reaches it.
ALTER TABLE "gateway_payments" ADD COLUMN IF NOT EXISTS "card_fee_minor" integer DEFAULT 0 NOT NULL;
ALTER TABLE "gateway_payments" ADD COLUMN IF NOT EXISTS "card_fee_cents" integer DEFAULT 0 NOT NULL;
