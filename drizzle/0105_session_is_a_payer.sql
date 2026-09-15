-- 🔴 SPRINT 74 — A GUEST PAYING FOR A SESSION HAS NO ACCOUNT, AND THE SESSION IS WHO THEY ARE.
--
-- 0102 gave `manual_payments` three payer kinds: a user, a patient account, a sponsor. That
-- covers a therapist paying a subscription and a company topping up a pot, and it does not
-- cover the commonest payment this product will ever take.
--
-- Somebody finds a therapist on the radar at eleven at night, is handed a join link, and is
-- asked for money. They have no account. They may never make one. `resolveJoinToken` returns
-- a `guestName` and nothing else, because that is genuinely all we know and asking for more
-- before a crisis session would be the wrong trade.
--
-- ## 🔴 SO THE PAYER IS THE SESSION, AND THAT IS NOT A FUDGE
--
-- The alternative was to force an account, or to leave `payer_kind` null for guests, or to
-- pick one of the three existing kinds and mean something else by it. All three are worse:
-- the first changes the product to suit the schema, and the other two make "who paid this"
-- unanswerable for most rows in the table.
--
-- A session identifies its payer as precisely as anything can: it has the therapist, the
-- price, the time, and the join token the person held. `ref_id` already points at it. This
-- makes that relationship sayable rather than implied.
--
-- Additive (H16).

ALTER TABLE manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_payer_kind_valid;

ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_payer_kind_valid
    CHECK (payer_kind IN ('user', 'patient', 'sponsor', 'session'));

ALTER TABLE manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_kind_matches_id;

-- 🔴 A `session` payer carries NO id of its own, and must carry a `ref_id`: the session it
-- is for IS the identification. Without the second half a session payment could exist
-- pointing at nothing, which is a payment nobody can trace to anything.
ALTER TABLE manual_payments
  ADD CONSTRAINT manual_payments_kind_matches_id
    CHECK (
      (payer_kind = 'user' AND patient_account_id IS NULL AND sponsor_id IS NULL)
      OR (payer_kind = 'patient' AND user_id IS NULL AND sponsor_id IS NULL)
      OR (payer_kind = 'sponsor' AND user_id IS NULL AND patient_account_id IS NULL)
      OR (
        payer_kind = 'session'
        AND user_id IS NULL
        AND patient_account_id IS NULL
        AND sponsor_id IS NULL
        AND ref_id IS NOT NULL
      )
    );

COMMENT ON CONSTRAINT manual_payments_kind_matches_id ON manual_payments IS
  'The id must match the kind while it exists, and a session payer carries no id at all: the session in ref_id is the identification, because a guest paying off the radar has no account and forcing one before a crisis session would be the wrong trade.';
