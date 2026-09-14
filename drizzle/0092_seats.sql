-- 🔴 62.1 / C323 — SEATS, AND THE RATE IS RETROACTIVE.
--
--     1 to 2 seats   included in the clinic plan   $179
--     3 to 4 seats   $90 each                      $270 · $360
--     5 or more      $80 each                      $400 · $480 · …
--
-- Reaching a band reprices EVERY seat. A marginal reading gives $439 at five
-- seats against a stated $400, and the gap grows: a clinic reading the public
-- table would be billed a number that never appears on it.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS seats integer NOT NULL DEFAULT 0;

-- 🔴 ZERO IS THE DEFAULT AND IT IS NOT ONE.
--
-- Every organisation that exists today is a solo practice, and a solo practice
-- has no seats: it has a subscription. Defaulting to 1 would bill every one of
-- them for a clinic plan the moment anything reads this column, which is the
-- expensive direction for a default to be wrong in.
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_seats_bounded;
ALTER TABLE organizations ADD CONSTRAINT organizations_seats_bounded
  CHECK (seats >= 0 AND seats <= 500)
  NOT VALID;
ALTER TABLE organizations VALIDATE CONSTRAINT organizations_seats_bounded;

COMMENT ON COLUMN organizations.seats IS
  'C323. How many clinicians this clinic is paying for. The bill is a function of this count and the band it reaches, both from platform_settings, and the band prices every seat rather than only the ones above the threshold. Zero means a solo practice, which has a subscription rather than seats.';

-- 🔴 62.6 / C355 — A SEAT IS NOT BILLED UNTIL THE JOINING THERAPIST'S OWN
-- SUBSCRIPTION PERIOD ENDS.
--
-- A clinician on Practice who accepts a clinic invitation has already paid for
-- the month. Billing the clinic for their seat immediately charges twice for
-- one person, and cancelling the clinician's own plan immediately takes away a
-- month they bought. C329 settles the second half: their subscription is
-- cancelled at PERIOD END. This column is the first half, so the clinic's bill
-- knows which seats are live and which are waiting.
CREATE TABLE IF NOT EXISTS clinic_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  -- When this seat starts costing money. Null until we know, which is the case
  -- while we are waiting for the joining clinician's own period to close.
  billable_from timestamptz,

  -- 62.5 — removal. The clinician keeps unlimited to period end and the seat is
  -- not renewed; it is never refunded, or a clinic cycles seats weekly.
  released_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One live seat per clinician per clinic. A released one stays beside it,
-- because "when did this person stop costing us money" is asked at renewal.
CREATE UNIQUE INDEX IF NOT EXISTS clinic_seats_live_unique
  ON clinic_seats (organization_id, user_id)
  WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS clinic_seats_org_idx
  ON clinic_seats (organization_id, released_at);

COMMENT ON TABLE clinic_seats IS
  'C355 / C329. A seat is not billed until the joining clinician''s own subscription period ends, so nobody pays twice and nobody loses a month they bought. billable_from is null while we are waiting for that period to close.';
