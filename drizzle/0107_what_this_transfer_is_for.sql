-- 🔴 SPRINT 76 — A TRANSFER SAYS ITS TOTAL AND NOT ONE WORD ABOUT WHAT IT COVERS.
--
-- `manual_payments` carries `purpose` and a single `ref_id`, and that was enough while
-- every payment settled exactly one thing: a session, or a pot, or "the bill".
--
-- It stopped being enough the moment a clinician could CHOOSE. A pay-as-you-go
-- therapist with eleven unpaid sessions had one control, and it said pay all of it. The
-- product they are actually running is one where three of those eleven are disputed and
-- the other eight need paying today, and the only way to do that was to pay nothing.
--
-- ## 🔴 WHY THE LINES ARE STORED AND NOT DERIVED
--
-- The obvious build reads the chosen invoice ids back and looks them up when the sheet
-- renders. Three things move underneath that, all of them normal:
--
--   * An invoice in the set gets settled another way — held earnings, a card, a credit
--     — between the payer opening the sheet and their bank actually moving. Derived
--     lines would silently drop it and the total would stop matching the transfer that
--     is already in flight.
--   * A price changes. Every figure in this table is frozen for exactly this reason;
--     `settles_cents` was added in 0106 on the same argument, and a total that is frozen
--     beside a composition that is not is worse than either, because the two disagree
--     on the one screen an operator uses to decide.
--   * The row has to outlive its referents. `ref_id` is nullable and the payer columns
--     are ON DELETE SET NULL, because this table is the record that money moved. A
--     deleted invoice must not be able to empty out what a payment said it was for.
--
-- So this is a SNAPSHOT, in the payer's own words, taken when the sheet opened. It is
-- what the popup prints, what the operator reads beside a bank line, and what the
-- confirmation email describes. `ref_id` keeps its job of pointing at the thing to
-- unlock; this says what was bought.
--
-- Shape, deliberately small: `[{ "label": string, "cents": number }]` in USD cents.
-- Null means a payment opened before this column existed, or one with a single obvious
-- subject, and every reader treats null as "print the heading and nothing else" rather
-- than as an error.
--
-- Additive (H16). Nullable with no backfill: an absent snapshot is a real state.

ALTER TABLE manual_payments
  ADD COLUMN IF NOT EXISTS line_items jsonb;

COMMENT ON COLUMN manual_payments.line_items IS
  'Sprint 76. [{label, cents}] in USD cents: what this transfer was said to cover, frozen when the payer opened the sheet. A snapshot rather than a join, for the same reason settles_cents is a number rather than a lookup: the invoices behind it can be settled, repriced or deleted while a bank transfer is in flight, and the composition an operator reads must be the one the payer was shown. Null is a payment with one obvious subject, or one opened before this column.';
