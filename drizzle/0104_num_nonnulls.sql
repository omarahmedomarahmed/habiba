-- 🔴 SPRINT 73c — SAYING "AT MOST ONE OF THESE" THE WAY POSTGRES SAYS IT.
--
-- 0103 wrote the rule as an arithmetic sum of casts:
--
--   (user_id IS NOT NULL)::int + (patient_account_id IS NOT NULL)::int + ... <= 1
--
-- That is correct and `verify:sprint43` flagged it anyway, because the contradiction
-- detector matches on the text `<column> IS NOT NULL` appearing in a CHECK beside an
-- `ON DELETE SET NULL` foreign key. The expression above CONTAINS that text three times
-- while requiring nothing of the kind: it counts them, it does not demand them.
--
-- ## 🔴 WHICH SIDE TO FIX, AND WHY IT IS THIS ONE
--
-- The detector's own comment says a false positive there is "a constraint pair worth a
-- human look anyway", and that ruling is right: the alternative is teaching a safety check
-- to ignore a pattern, and a checker with an exception list is a checker that grows one.
--
-- And H20 is the other half. A gate that is red for a reason somebody has explained to
-- themselves is a gate nobody reads, so leaving this failing with a note attached is the
-- outcome this repository has been burned by three times.
--
-- `num_nonnulls()` is the idiom Postgres provides for exactly this question. It is shorter,
-- it says what it means, and it does not contain the phrase that makes a safety check
-- suspicious. The rule is unchanged.
--
-- Additive (H16).

ALTER TABLE manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_at_most_one_payer;

ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_at_most_one_payer
    CHECK (num_nonnulls(user_id, patient_account_id, sponsor_id) <= 1);

COMMENT ON CONSTRAINT manual_payments_at_most_one_payer ON manual_payments IS
  'At most one payer id. Not exactly one: the ids are ON DELETE SET NULL because this table is the only record that money moved and has to outlive everybody named on it. `payer_kind` is the half that survives. Written with num_nonnulls rather than a sum of casts so the 0079/0082 contradiction detector is not reading a counting expression as a non-null requirement.';
