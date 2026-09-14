-- 🔴 C229, actually built. The anti-differencing floor on a sponsor's pot balance.
--
-- `potBalance` in lib/data/sponsors.ts carries a docblock describing a floor:
-- "a balance is only shown once the period since it last moved has cleared the
-- floor". Its body applied no floor at all, and nothing called it: both sponsor
-- screens rendered the raw live balance from `ledgerPotBalance`.
--
-- So a sponsor reading the balance on Monday and again on Tuesday learns
-- exactly what was spent in between. With one employee seen, that is one named
-- person's session, which is the differencing attack C229 exists to stop and
-- which the weekly heatmap beside it is already suppressed to prevent.
--
-- The fix needs state: a balance can only be republished once enough sessions
-- have happened since the last one the sponsor was allowed to see.
--
-- Additive, with defaults, so the running deployment survives the gap (H16).
ALTER TABLE sponsor_pots
  ADD COLUMN IF NOT EXISTS published_balance_cents integer,
  ADD COLUMN IF NOT EXISTS published_sessions integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN sponsor_pots.published_balance_cents IS
  'C229. The balance the sponsor is allowed to see. NULL means not enough activity has happened yet for any balance to be publishable. Never read the live balance on a sponsor surface.';

COMMENT ON COLUMN sponsor_pots.published_sessions IS
  'C229. The lifetime pot-funded session count at the moment published_balance_cents was last set. The difference against the live count is what has to clear the floor.';
