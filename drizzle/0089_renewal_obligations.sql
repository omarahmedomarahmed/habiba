-- 🔴 59.13 / C310 / C341 — A SUBSCRIPTION IS AN OBLIGATION, AND STRIPE IS ONE
-- IMPLEMENTATION OF IT.
--
-- `subscriptions` today is a mirror of a Stripe object: a plan key, a status
-- string Stripe chose, and a period end Stripe told us about. `entitledTier`
-- reads it and therefore reads Stripe, one table removed.
--
-- Two things are wrong with that, and only the second is about Egypt.
--
-- 🔴 ONE: A MISSED CALLBACK IS A CANCELLED PLAN. `mirrorSubscription` writes
-- what the webhook says. A webhook that never arrives leaves the row saying
-- whatever it said last, and a period end in the past reads as "not entitled".
-- So a clinician who paid can lose their plan because our endpoint was down,
-- and nothing anywhere would say why. C294 already ruled that entitlement is
-- the period paid for rather than a gateway status; this is the row that makes
-- that true rather than asserted.
--
-- 🔴 TWO: THERE IS NO STRIPE IN EGYPT. An Egyptian renewal is an invoice and a
-- payment link through the Egyptian gateway (sprint 64). If the only shape a
-- subscription has is Stripe's, the Egyptian rail needs a parallel billing
-- model, which C226 already refused once for the corporate pot: *a payment
-- method, not a billing system.*
--
-- So: a due date, an amount, a currency, a state, and a nullable reference to
-- whatever gateway produced it. The Stripe subscription becomes one way to
-- settle an obligation. An EGP invoice is another. `entitledTier` reads THIS.
CREATE TABLE IF NOT EXISTS renewal_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,

  -- The plan this obligation buys. A key from `platform_settings`, not a FK:
  -- a retired plan key must not take a paid obligation down with it.
  plan text NOT NULL,

  -- 🔴 Both, because the amount is a decision and the currency is a fact about
  -- where the payer is. Two currencies exist and 0088's rule decides which.
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL CHECK (currency IN ('usd', 'egp')),

  -- The period this obligation pays for. C294: entitlement is the period paid
  -- for, and these two columns are that sentence.
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  CONSTRAINT renewal_obligations_period CHECK (period_end > period_start),

  -- 🔴 `due` is unpaid and not yet late, `paid` is settled, `lapsed` is a due
  -- date that passed unpaid, `void` is an obligation we cancelled (a plan
  -- change, a goodwill write-off). Never a gateway's vocabulary.
  state text NOT NULL DEFAULT 'due'
    CHECK (state IN ('due', 'paid', 'lapsed', 'void')),

  due_at timestamptz NOT NULL,
  paid_at timestamptz,
  CONSTRAINT renewal_obligations_paid_has_date
    CHECK ((state = 'paid') = (paid_at IS NOT NULL)),

  -- 🔴 WHICH RAIL SETTLED IT, and null until something does. A Stripe invoice
  -- id, or an Egyptian gateway reference. Nullable because the obligation
  -- exists before anybody pays it, which is the whole point of the table.
  settled_via text CHECK (settled_via IN ('stripe', 'egypt_gateway', 'manual')),
  settled_ref text,
  CONSTRAINT renewal_obligations_settled_pair
    CHECK ((settled_via IS NULL) = (settled_ref IS NULL)),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 🔴 ONE LIVE OBLIGATION PER ORGANISATION PER PERIOD. Two rows for one month is
-- how a reconciler finds a double charge, so the database refuses to create the
-- ambiguity in the first place. Partial on the states that are still real: a
-- voided obligation may sit beside the one that replaced it.
CREATE UNIQUE INDEX IF NOT EXISTS renewal_obligations_period_unique
  ON renewal_obligations (organization_id, period_start)
  WHERE state <> 'void';

-- What `entitledTier` reads: the obligation covering now, newest first.
CREATE INDEX IF NOT EXISTS renewal_obligations_org_period_idx
  ON renewal_obligations (organization_id, period_end DESC);

-- What the dunning sweep reads: what is due and not yet paid.
CREATE INDEX IF NOT EXISTS renewal_obligations_due_idx
  ON renewal_obligations (state, due_at)
  WHERE state = 'due';

-- 🔴 59.15 — the reconciler reads BOTH directions through this.
CREATE INDEX IF NOT EXISTS renewal_obligations_settled_idx
  ON renewal_obligations (settled_via, settled_ref)
  WHERE settled_ref IS NOT NULL;

COMMENT ON TABLE renewal_obligations IS
  '59.13 / C310 / C341. A subscription as a row we own rather than a mirror of a gateway object. entitledTier reads this, so a missed webhook cannot silently end a plan, and an Egyptian renewal is an invoice against the same table rather than a parallel billing model.';
