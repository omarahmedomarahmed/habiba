-- 🔴 60.1 to 60.6 — WHAT THE EMPLOYER COVERS, AND WHY IT IS FROZEN.
--
-- Until now a pot either paid for a session or it did not: `payFromPot` spends
-- the whole gross or refuses. Every real corporate conversation is a
-- percentage, and the moment there is one, three rulings arrive with it.
--
-- 🔴 C311 — FROZEN ONTO THE SESSION AT BOOKING AND NEVER RE-READ.
--
-- The obvious build reads `coverage_bps` off the pot when the money moves. Then
-- an employer lowering their percentage on a Tuesday changes what a patient
-- owes for a session they booked on Monday, after the patient saw a number and
-- agreed to it. A price somebody was shown is a price they are owed.
--
-- 🔴 C344 — AN INCREASE MAY REACH UNSTARTED BOOKINGS; A DECREASE NEVER DOES.
--
-- The asymmetry is deliberate and it is not generosity. A decrease is a person
-- being asked for money they were not expecting, and there is no version of
-- that which is acceptable without notice. An increase is the same person being
-- asked for less than they agreed to, which needs no protection at all.
--
-- 🔴 C345 — 0% IS A LEGAL SETTING, and it is not the same as removal.
--
-- An employer who stops paying but keeps somebody enrolled keeps them on the
-- roster, keeps their badge, and stops the money. C234 already separates a
-- badge from funding; this is that separation with a number on it.
ALTER TABLE sponsor_pots
  ADD COLUMN IF NOT EXISTS coverage_bps integer NOT NULL DEFAULT 10000;

-- 🔴 FIVE PER CENT STEPS, in the database rather than in a select box.
-- A form can be bypassed and an API cannot be, and "60%" is a number a finance
-- team agreed to rather than an arbitrary basis point.
ALTER TABLE sponsor_pots DROP CONSTRAINT IF EXISTS sponsor_pots_coverage_step;
ALTER TABLE sponsor_pots ADD CONSTRAINT sponsor_pots_coverage_step
  CHECK (coverage_bps BETWEEN 0 AND 10000 AND coverage_bps % 500 = 0)
  NOT VALID;
ALTER TABLE sponsor_pots VALIDATE CONSTRAINT sponsor_pots_coverage_step;

-- 🔴 C311's notice window, as two columns rather than as a job that edits the
-- live number on a timer. A pending change is visible to everybody who needs to
-- see it — the sponsor, an operator, and the patient's next booking screen —
-- and it applies itself by being in the past rather than by anything running.
ALTER TABLE sponsor_pots
  ADD COLUMN IF NOT EXISTS pending_coverage_bps integer;

ALTER TABLE sponsor_pots
  ADD COLUMN IF NOT EXISTS pending_coverage_from timestamptz;

ALTER TABLE sponsor_pots DROP CONSTRAINT IF EXISTS sponsor_pots_pending_coverage_pair;
ALTER TABLE sponsor_pots ADD CONSTRAINT sponsor_pots_pending_coverage_pair
  CHECK (
    (pending_coverage_bps IS NULL AND pending_coverage_from IS NULL)
    OR (
      pending_coverage_bps IS NOT NULL
      AND pending_coverage_from IS NOT NULL
      AND pending_coverage_bps BETWEEN 0 AND 10000
      AND pending_coverage_bps % 500 = 0
    )
  )
  NOT VALID;
ALTER TABLE sponsor_pots VALIDATE CONSTRAINT sponsor_pots_pending_coverage_pair;

-- 🔴 AND THE FROZEN COPY, on the payment, which is the whole of C311.
--
-- Three numbers rather than one, because a percentage alone does not survive a
-- rounding argument. The shares are what each side actually owes, in cents,
-- decided once and stored, so a refund apportions on the same figures the
-- patient was shown rather than re-deriving them from a percentage that may
-- since have moved (C315).
ALTER TABLE session_payments
  ADD COLUMN IF NOT EXISTS coverage_bps integer NOT NULL DEFAULT 0;

ALTER TABLE session_payments
  ADD COLUMN IF NOT EXISTS sponsor_share_cents integer NOT NULL DEFAULT 0;

ALTER TABLE session_payments
  ADD COLUMN IF NOT EXISTS patient_share_cents integer NOT NULL DEFAULT 0;

-- 🔴 THE SHARES ADD UP TO THE GROSS, in the database.
--
-- Rounding a percentage produces two numbers that are each correct and do not
-- sum, and the cent falls out of the books in a direction nobody chose. One
-- share is computed and the other is the remainder; this is what refuses the
-- version where both are computed.
--
-- Historical rows are all zero coverage with zero shares, which fails this, so
-- it is scoped to rows that actually carry a split.
ALTER TABLE session_payments DROP CONSTRAINT IF EXISTS session_payments_shares_sum;
ALTER TABLE session_payments ADD CONSTRAINT session_payments_shares_sum
  CHECK (
    coverage_bps = 0
    OR sponsor_share_cents + patient_share_cents = gross_cents
  )
  NOT VALID;
ALTER TABLE session_payments VALIDATE CONSTRAINT session_payments_shares_sum;

ALTER TABLE session_payments DROP CONSTRAINT IF EXISTS session_payments_coverage_step;
ALTER TABLE session_payments ADD CONSTRAINT session_payments_coverage_step
  CHECK (coverage_bps BETWEEN 0 AND 10000 AND coverage_bps % 500 = 0)
  NOT VALID;
ALTER TABLE session_payments VALIDATE CONSTRAINT session_payments_coverage_step;

COMMENT ON COLUMN session_payments.coverage_bps IS
  'C311. The employer percentage as it stood when this session was BOOKED, frozen. Never re-read from the pot: a price somebody was shown is a price they are owed, and an employer lowering their percentage on a Tuesday must not change what a patient owes for a session they agreed to on Monday.';

COMMENT ON COLUMN sponsor_pots.pending_coverage_from IS
  'C311. A reduction takes effect after a notice window rather than immediately. The pending pair applies itself by being in the past, so there is no job whose failure leaves an employer paying a percentage they changed.';
