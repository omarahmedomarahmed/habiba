-- 🔴 SPRINT 74 — A TRANSFER HAS TWO AMOUNTS, AND THE TABLE ONLY RECORDED ONE.
--
-- 0102 gave `manual_payments` an `amount_cents` and a `currency` defaulting to EGP, and
-- `grantPotTopUp` then does `balance_cents = balance_cents + amount_cents`.
--
-- `sponsor_pots.balance_cents` is USD cents. So a company that sends 10,000 EGP — about
-- $200 — and types 10000 gets 1,000,000 credited to a dollar balance. Fifty times what
-- they paid, with no processor anywhere to reverse it.
--
-- ## 🔴 THE TWO NUMBERS ARE BOTH FACTS AND NEITHER IS DERIVABLE LATER
--
--   * What the payer SENT, in the currency they sent it. This is what an operator
--     matches against a bank statement, and it is the only number the payer ever saw.
--   * What it SETTLES, in USD cents. This is what the session costs, what the invoice
--     says, what the pot is denominated in.
--
-- Deriving either from the other at confirmation time means a rate that moved between
-- the declaration and the operator's morning, which is a payer credited a different
-- number from the one they were quoted.
--
-- So the rate is applied ONCE, when the row is opened, and both sides of it are stored.
-- `amount_cents` keeps its meaning — minor units of `currency` — and this is the other
-- half.
--
-- Nothing is in this table on any database, so the backfill is belt and braces.
--
-- Additive (H16).

ALTER TABLE manual_payments
  ADD COLUMN IF NOT EXISTS settles_cents integer;

UPDATE manual_payments SET settles_cents = amount_cents WHERE settles_cents IS NULL;

ALTER TABLE manual_payments
  ALTER COLUMN settles_cents SET NOT NULL;

ALTER TABLE manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_settles_positive;

ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_settles_positive CHECK (settles_cents > 0);

COMMENT ON COLUMN manual_payments.settles_cents IS
  'Sprint 74. USD cents: what this transfer is worth to us, fixed when the row was opened. amount_cents beside it is what the payer sends, in minor units of currency. Both are stored because the rate must not move between the quote and the operator reading a bank statement, and because a pot, an invoice and a session price are all denominated in dollars while every payer on this rail sends pounds.';
