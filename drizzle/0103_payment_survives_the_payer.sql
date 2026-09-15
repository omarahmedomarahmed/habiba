-- 🔴 SPRINT 73c — C367: THE PAYMENT RECORD MUST SURVIVE THE PAYER BEING DELETED.
--
-- 0102 put `ON DELETE SET NULL` on the three payer columns and then a CHECK requiring exactly
-- one of them non-null. Those two rules contradict each other, and `verify:sprint43` said so
-- the first time it ran against the new table: deleting a user would null `user_id`, the
-- CHECK would refuse, and the delete would fail with a constraint error naming a table the
-- person deleting an account has never heard of.
--
-- The same shape on `decided_by`: SET NULL, beside a CHECK requiring it non-null on any
-- decided row. Deleting the staff member who confirmed a payment would break the row they
-- confirmed.
--
-- ## 🔴 WHICH RULE WINS, AND WHY IT IS THIS ONE
--
-- This table is the ONLY record that money moved. There is no processor to reconcile
-- against, no webhook, no chargeback. So it has to outlive everybody named on it: a company
-- that closed, a therapist who left, the operator who checked the receipt.
--
-- That means `SET NULL` is right and the CHECK was wrong. But "exactly one payer" was
-- protecting something real — a row naming two payers makes every "who paid this" query
-- ambiguous — so it is not simply dropped. It becomes:
--
--   * `payer_kind`, NOT NULL, which records WHICH kind of payer it was and never goes away.
--   * The CHECK relaxed to AT MOST one id, so a deletion nulls an id without breaking a row.
--
-- The evidence survives and the ambiguity does not. A payment whose payer was deleted still
-- says "a company paid this" and the audit log still says which one.
--
-- Additive (H16).

ALTER TABLE manual_payments
  ADD COLUMN IF NOT EXISTS payer_kind text;

-- Backfill from whichever id is set. Nothing is in this table yet on any database, so this
-- is belt and braces rather than a migration of real rows.
UPDATE manual_payments
   SET payer_kind = CASE
     WHEN user_id IS NOT NULL THEN 'user'
     WHEN patient_account_id IS NOT NULL THEN 'patient'
     WHEN sponsor_id IS NOT NULL THEN 'sponsor'
     ELSE 'unknown'
   END
 WHERE payer_kind IS NULL;

ALTER TABLE manual_payments
  ALTER COLUMN payer_kind SET NOT NULL;

ALTER TABLE manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_one_payer;

ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_payer_kind_valid
    CHECK (payer_kind IN ('user', 'patient', 'sponsor'));

-- 🔴 AT MOST one, not exactly one. A deleted payer leaves zero ids and a `payer_kind` that
-- still says what they were.
ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_at_most_one_payer
    CHECK (
      (user_id IS NOT NULL)::int
      + (patient_account_id IS NOT NULL)::int
      + (sponsor_id IS NOT NULL)::int <= 1
    );

-- 🔴 AND THE ID MUST MATCH THE KIND WHILE IT EXISTS. Without this, `payer_kind = 'sponsor'`
-- beside a `user_id` would be a row that lies about itself, which is worse than the
-- ambiguity the original CHECK was written to prevent.
ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_kind_matches_id
    CHECK (
      (payer_kind = 'user' AND patient_account_id IS NULL AND sponsor_id IS NULL)
      OR (payer_kind = 'patient' AND user_id IS NULL AND sponsor_id IS NULL)
      OR (payer_kind = 'sponsor' AND user_id IS NULL AND patient_account_id IS NULL)
    );

-- The decision keeps its timestamp; WHO decided it may be deleted, and the audit log holds
-- that permanently. A decided payment with no `decided_at` would still be a broken record.
ALTER TABLE manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_decision_is_attributed;

ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_decision_is_dated
    CHECK (state NOT IN ('confirmed', 'rejected') OR decided_at IS NOT NULL);

COMMENT ON COLUMN manual_payments.payer_kind IS
  'Sprint 73c / C367. WHICH kind of payer, kept forever. The id beside it may be nulled when that person or company is deleted; this is the half of the record that has to outlive them, because this table is the only evidence the money moved.';
