-- 🔴 SPRINT 73 — THE EGYPTIAN RAIL, AND IT IS A HUMAN BEING.
--
-- `topUpPot` refuses `entity = 'eg'` outright, and it is right to: we cannot take a corporate
-- card payment into an Egyptian entity that does not exist yet. The consequence nobody had
-- costed is that the ENTIRE Egyptian go-to-market has no way to pay us. Three call centres,
-- six clinics, nine therapists and every patient behind them, all unable to hand over money.
--
-- So the fallback rail is a bank transfer and a person who checks it. That is not a stopgap
-- hack: it is how most money moves in Egypt today, and building it properly means the
-- product works on day one instead of waiting on a payment licence.
--
-- ## 🔴 WHY A QUEUE AND NOT A FLAG ON THE THING BEING PAID FOR
--
-- A patient paying for a session, a therapist paying a subscription and a company topping up
-- a pot are three different objects with three different tables. Hanging "awaiting a human"
-- off each of them separately gives three half-built states, three places to forget the
-- rejection path, and no single screen an operator can work. One queue, one state machine,
-- one screen, and the thing being paid for is named by `purpose` and `ref_id`.
--
-- ## 🔴 AND WHY THE ACTION IS TAKEN ON CONFIRMATION, NEVER BEFORE
--
-- The patient sees a session they can join the moment an operator confirms, and not one
-- second earlier. There is no optimistic grant: an unconfirmed transfer is a claim, and a
-- product that acts on a claim about money is a product that can be robbed by typing.
--
-- Additive (H16).

-- ========================================================== the queue ==

CREATE TABLE IF NOT EXISTS manual_payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What this money is for, which decides what confirming it DOES.
  purpose       text NOT NULL,
  -- The row that gets unlocked: a session, an invoice, a pot.
  ref_id        uuid,

  amount_cents  integer NOT NULL,
  currency      text NOT NULL DEFAULT 'EGP',

  -- 🔴 EXACTLY ONE PAYER, and the CHECK below enforces it.
  --
  -- A row naming two payers makes every "who paid this" query ambiguous, and this queue is
  -- the evidence trail for money that moved outside any processor. It is the only record.
  user_id             uuid REFERENCES users(id) ON DELETE SET NULL,
  patient_account_id  uuid REFERENCES patient_accounts(id) ON DELETE SET NULL,
  sponsor_id          uuid REFERENCES sponsors(id) ON DELETE SET NULL,

  organization_id     uuid REFERENCES organizations(id) ON DELETE SET NULL,

  -- awaiting_proof -> submitted -> confirmed | rejected
  state         text NOT NULL DEFAULT 'awaiting_proof',

  -- What they typed off their banking app, and what they uploaded.
  reference     text,
  proof_url     text,
  submitted_at  timestamptz,

  -- 🔴 A rejection without a reason is a support ticket we caused. NOT NULL is not usable
  -- here because the column is empty until a decision exists, so the rule lives in the
  -- CHECK: rejected implies a reason.
  decided_at    timestamptz,
  decided_by    uuid REFERENCES users(id) ON DELETE SET NULL,
  reject_reason text,

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT manual_payments_state_valid
    CHECK (state IN ('awaiting_proof', 'submitted', 'confirmed', 'rejected')),
  CONSTRAINT manual_payments_purpose_valid
    CHECK (purpose IN ('session', 'subscription', 'payg_session', 'pot_topup')),
  CONSTRAINT manual_payments_amount_positive
    CHECK (amount_cents > 0),
  -- Exactly one payer.
  CONSTRAINT manual_payments_one_payer
    CHECK (
      (user_id IS NOT NULL)::int
      + (patient_account_id IS NOT NULL)::int
      + (sponsor_id IS NOT NULL)::int = 1
    ),
  -- 🔴 A rejection carries its reason, in the schema rather than in a code path.
  CONSTRAINT manual_payments_rejection_has_reason
    CHECK (state <> 'rejected' OR (reject_reason IS NOT NULL AND length(btrim(reject_reason)) > 0)),
  -- A decision carries who made it and when.
  CONSTRAINT manual_payments_decision_is_attributed
    CHECK (state NOT IN ('confirmed', 'rejected') OR (decided_at IS NOT NULL AND decided_by IS NOT NULL))
);

-- The operator's queue is "everything still waiting", newest first.
CREATE INDEX IF NOT EXISTS manual_payments_queue_idx
  ON manual_payments (state, submitted_at DESC)
  WHERE state = 'submitted';

CREATE INDEX IF NOT EXISTS manual_payments_payer_idx
  ON manual_payments (user_id, patient_account_id, sponsor_id, created_at DESC);

-- 🔴 One live payment per thing being paid for.
--
-- Without this a patient who taps "I have paid" four times while the page is loading creates
-- four rows, an operator confirms two of them, and the session is paid for twice with no
-- processor to reverse it. Partial, so the history of rejected and confirmed attempts stays.
CREATE UNIQUE INDEX IF NOT EXISTS manual_payments_one_live_per_ref
  ON manual_payments (purpose, ref_id)
  WHERE state IN ('awaiting_proof', 'submitted') AND ref_id IS NOT NULL;

COMMENT ON TABLE manual_payments IS
  'Sprint 73. The Egyptian fallback rail: a bank transfer, a claim, and an operator who checks it. One queue for sessions, subscriptions and pot top-ups, because three half-built states is how a rejection path gets forgotten. The action is taken on confirmation and never before.';

COMMENT ON COLUMN manual_payments.ref_id IS
  'The session, invoice or sponsor whose payment this is. Null only for a top-up that opens a pot.';
