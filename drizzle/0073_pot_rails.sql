-- 0073 — the pot's two corrections. PLAN.md 53.10, 53.19b. Additive.
--
-- Both of these are things 0072 got wrong rather than things sprint 53 grew
-- into, and both are fixed forward instead of by editing 0072: 0072 is already
-- applied somewhere, and a migration whose hash changes after it has run is the
-- H1/H16 failure mode this repository verifies against `information_schema`
-- precisely because `db:migrate` prints success either way.

-- ------------------------------------------ the fifth and sixth crossings (53.10) --
--
-- 🔴 `pot_held_to_connect` and `pot_held_to_manual`. A sponsor prepaid, a session
-- spent it, and we pay the clinician out of money on our own balance.
--
-- Own values rather than `usd_stripe_to_connect`, because `holdsMoney` reads that
-- one as "we never touch it" and a pot is held for longer than anything else on
-- these rails: between a top-up and whenever a third party spends it.
--
-- 🔴 TWO of them, and the split matters. A pot paying an Egyptian clinician is USD
-- into the US entity and EGP out of the Egyptian one, which is cross-border and
-- needs an explicit `entity_transfer`. One combined value would have made
-- `isCrossBorder` answer false for every pot session, which is the §6 family: a
-- predicate reading green because it was asked the wrong question.
--
-- 🔴 THIS IS THE SPRINT 56 DEFECT, PRE-EMPTED. `CROSSINGS` in schema.ts gained a
-- value; this CHECK is where the database learns about it. In sprint 56 the
-- TypeScript enum was extended and the migration's CHECK was not, so a whole
-- verifier check was structurally dead while reading green, and only a CONTROL
-- assertion found it.
ALTER TABLE "session_payments" DROP CONSTRAINT IF EXISTS "session_payments_crossing_known";
ALTER TABLE "session_payments" ADD CONSTRAINT "session_payments_crossing_known"
  CHECK ("crossing" IN (
    'usd_stripe_to_connect', 'egp_local_to_manual',
    'usd_stripe_to_manual', 'egp_local_to_connect',
    'pot_held_to_connect', 'pot_held_to_manual'
  )) NOT VALID;
ALTER TABLE "session_payments" VALIDATE CONSTRAINT "session_payments_crossing_known";

-- ------------------------------------------- the re-verification cycle (53.19b) --
--
-- 🔴 SIX MONTHS, not three. 53.19b says the setting defaults to six and 0072
-- wrote three, which was mine and not a decision.
--
-- The number the product actually reads is `sponsor.verifyCycleMonths` in
-- platform settings, because C247's cycle is an operator's judgement about human
-- patience rather than a fact. This corrects the column default so a row written
-- without one does not disagree with the setting, which is the second-opinion
-- failure: two places holding the same number, one of them stale.
ALTER TABLE "sponsors" ALTER COLUMN "verify_cycle_months" SET DEFAULT 6;

-- 🔴 And the rows 0072 already created, brought to the same number.
--
-- Only the ones still holding the old default: a sponsor whose cycle an operator
-- has already set to something else must not be overwritten by a migration
-- correcting a default.
UPDATE "sponsors" SET "verify_cycle_months" = 6 WHERE "verify_cycle_months" = 3;
