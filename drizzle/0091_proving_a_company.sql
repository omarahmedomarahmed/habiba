-- 🔴 61.1 to 61.9 — PROVING A COMPANY IS A COMPANY.
--
-- A joining code funds therapy out of somebody's pot. Until now the only thing
-- standing between a stranger and a corporate account was an operator reading
-- an application form and pressing activate.
--
-- 🔴 C318 — TWO PROOFS, AND NEITHER ALONE ISSUES A CODE.
--
-- An email code proves somebody holds a mailbox at the domain. A DNS TXT record
-- proves somebody controls the domain. They are different facts and each is
-- individually forgeable by the wrong person: an employee with a mailbox is not
-- authorised to commit their employer to anything, and a contractor who can add
-- a DNS record may never have had an address there.
--
-- 🔴 C348 — OR A COUNTERSIGNED AGREEMENT, because university IT does not always
-- add a record this quarter. That path is admin-approved and is recorded as
-- what it is rather than faked as a proof nobody performed.
--
-- 🔴 C319 — AND PROVING A DOMAIN IS NOT CONSENTING TO BE NAMED. `listed_publicly`
-- stays off by default and is a separate act: the patient-app banner shows
-- opted-in sponsors only, because "we buy therapy for our staff" is a fact about
-- a company that a company gets to publish.
CREATE TABLE IF NOT EXISTS sponsor_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES sponsors (id) ON DELETE CASCADE,

  -- 61.3 — a LIST. One organisation is acme.com and acme.co.uk and
  -- acme-group.net, and each is proved on its own.
  domain text NOT NULL,

  -- 🔴 THE TWO PROOFS, as two timestamps rather than one boolean.
  --
  -- A boolean would answer "is this proved" and lose "proved how and when",
  -- which is the question asked when somebody disputes an account a year later.
  mailbox_proved_at timestamptz,
  dns_proved_at timestamptz,

  -- 🔴 C348's third path, and it is deliberately NOT one of the two above.
  -- A countersigned agreement is a human decision, so it names the human.
  agreement_approved_at timestamptz,
  agreement_approved_by uuid REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT sponsor_domains_agreement_pair
    CHECK ((agreement_approved_at IS NULL) = (agreement_approved_by IS NULL)),

  -- What the operator asks IT to publish, and what we look for. Generated per
  -- domain so one organisation's record cannot prove another's.
  dns_token text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per domain per sponsor, and a domain belongs to one sponsor: two
-- companies cannot both prove acme.com, because the second one to do it would
-- be enrolling the first one's staff.
CREATE UNIQUE INDEX IF NOT EXISTS sponsor_domains_domain_unique
  ON sponsor_domains (lower(domain));

CREATE INDEX IF NOT EXISTS sponsor_domains_sponsor_idx
  ON sponsor_domains (sponsor_id);

COMMENT ON TABLE sponsor_domains IS
  'C318. Two proofs, and neither alone issues an enrolment code: an email code proves a mailbox, a DNS TXT record proves the domain. They are different facts and each is individually forgeable by the wrong person. C348 permits a countersigned agreement instead, admin approved, recorded as what it is.';

-- 🔴 61.8 / C321 — PROVISIONAL ENROLMENT, so an HR match can start funding
-- before a mailbox is confirmed.
--
-- The alternative is making somebody wait for an email before their benefit
-- works, which in practice means they pay for the first session themselves and
-- never come back. A provisional enrolment funds, and it is capped.
ALTER TABLE enrolments DROP CONSTRAINT IF EXISTS enrolments_state;
ALTER TABLE enrolments ADD CONSTRAINT enrolments_state
  CHECK ("state" IN ('active', 'provisional', 'paused', 'removed')) NOT VALID;
ALTER TABLE enrolments VALIDATE CONSTRAINT enrolments_state;

-- 🔴 61.9 / C350 — HOW MANY SESSIONS A PROVISIONAL PERSON MAY SPEND.
--
-- Counted on the row rather than derived, because the question asked at booking
-- is "has this person had their one" and deriving it means a join to sessions
-- from the money path, which is the join C244 spends the whole sprint avoiding.
ALTER TABLE enrolments
  ADD COLUMN IF NOT EXISTS provisional_sessions_used integer NOT NULL DEFAULT 0;

ALTER TABLE enrolments DROP CONSTRAINT IF EXISTS enrolments_provisional_count;
ALTER TABLE enrolments ADD CONSTRAINT enrolments_provisional_count
  CHECK (provisional_sessions_used >= 0) NOT VALID;
ALTER TABLE enrolments VALIDATE CONSTRAINT enrolments_provisional_count;

COMMENT ON COLUMN enrolments.provisional_sessions_used IS
  'C350. How many sessions this person has funded before confirming their mailbox. Counted on the row rather than derived, because deriving it means joining the money path to sessions, which is the join C244 exists to prevent.';
