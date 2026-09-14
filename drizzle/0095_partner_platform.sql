-- 🔴 SPRINT 68 — THE PARTNER PLATFORM, PROPERLY.
--
-- A telehealth platform has the video, the booking and the clinicians. We provide
-- the intelligence: the transcript, the note their therapist approves, the copilot
-- their therapist talks to, the memory, and the summary their patient reads.
--
-- Four tables, and every one of them exists because a ticket in this sprint needs a
-- row somewhere the code cannot lie about.
--
-- Additive (H16). Nothing here rewrites an existing row.

-- ════════════════════════════════════════════════════════════════════════════
-- 68.1 / 68.2 — CONSENT, AND THE BOUNDARY.
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 THE HARD CASE IS MID-SESSION CONSENT, AND IT IS WHY THIS IS A TABLE.
--
-- Somebody can say yes ten minutes in. We start then, the note covers from then,
-- and the record says the session was PARTLY recorded and when it began. A boolean
-- column would make "consented" and "consented from the start" the same fact, and
-- the note that came out of it would imply we heard the first ten minutes.
--
-- So: an append-only log of consent events. The state of a session is the last
-- event, and the BOUNDARY is the moment of the event that turned it on. Both are
-- derivable from rows nobody has to remember to update.
CREATE TABLE IF NOT EXISTS partner_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  partner_id uuid NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  -- Their id for this session, in their system. Opaque to us, like external_ref.
  external_session_ref text NOT NULL,
  -- Their id for the person, so a consent can be attributed without our account.
  external_subject_ref text NOT NULL,

  -- `given` or `withdrawn`. Never `pending`: the absence of a row IS pending, and a
  -- third state would let somebody write "pending" over a "given" and lose it.
  state text NOT NULL,

  -- 🔴 WHEN THE PATIENT ANSWERED, as their platform reports it. Not when we
  -- received it: a queue that ran three minutes late must not move the boundary of
  -- what was recorded, because the boundary is a claim about a person's afternoon.
  answered_at timestamptz NOT NULL,

  -- Where in the session they answered, in seconds from its start. Zero means
  -- before it began, which is the 68.1 case; anything above zero is 68.2 and is the
  -- number the note's coverage sentence is built from.
  offset_seconds integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_consents DROP CONSTRAINT IF EXISTS partner_consents_state;
ALTER TABLE partner_consents ADD CONSTRAINT partner_consents_state
  CHECK (state IN ('given', 'withdrawn'))
  NOT VALID;
ALTER TABLE partner_consents VALIDATE CONSTRAINT partner_consents_state;

ALTER TABLE partner_consents DROP CONSTRAINT IF EXISTS partner_consents_offset_sane;
ALTER TABLE partner_consents ADD CONSTRAINT partner_consents_offset_sane
  CHECK (offset_seconds >= 0 AND offset_seconds <= 86400)
  NOT VALID;
ALTER TABLE partner_consents VALIDATE CONSTRAINT partner_consents_offset_sane;

CREATE INDEX IF NOT EXISTS partner_consents_session_idx
  ON partner_consents (partner_id, external_session_ref, answered_at DESC);

COMMENT ON TABLE partner_consents IS
  '68.1 / 68.2. An append-only log, because mid-session consent needs a BOUNDARY and a boolean cannot carry one. The state of a session is its last event; what was recorded starts at offset_seconds of the event that turned it on. A note that implied we heard the first ten minutes would be the defect this table exists to prevent.';

-- ════════════════════════════════════════════════════════════════════════════
-- 68.3 / 68.5 / 68.6 — THE SESSION ITSELF, HELD ON THEIR PLATFORM.
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 NOT A ROW IN `sessions`, and the separation is the commercial boundary.
--
-- `sessions` is OUR clinical record: it carries a therapist who is our user, a
-- patient who is our row, a price we charge and a payment we take. A partner's
-- session has none of those. Forcing it into that table would mean every clinical
-- query in the product growing a "unless it is a partner's" branch, and one of them
-- would be forgotten.
--
-- This is the join between their reference and whatever we produced for it.
CREATE TABLE IF NOT EXISTS partner_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  partner_id uuid NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  -- 🔴 68.22 — sandbox or live, ON THE ROW, so a sandbox session can never be
  -- counted, billed, or joined to a real person by any query that forgets to ask.
  environment text NOT NULL DEFAULT 'sandbox',

  external_session_ref text NOT NULL,
  external_subject_ref text NOT NULL,

  -- 🔴 68.10 — an UNCLAIMED person is the normal case, not the exception. A
  -- telehealth platform has a caseload before it has our accounts, so this is null
  -- until somebody claims the record, exactly as `patients.person_id` is.
  person_id uuid REFERENCES people (id) ON DELETE SET NULL,

  -- What we did, and what we refused to do.
  started_at timestamptz,
  ended_at timestamptz,

  -- The consent boundary, denormalised from partner_consents when recording starts,
  -- so the note generator reads one row rather than replaying a log.
  recording_from_seconds integer,

  -- 🔴 68.17 — set when the partner's own limit stopped us. Their session happened
  -- and is theirs; we did not do ours, and `billable` below is false.
  stopped_reason text,

  -- 🔴 68.14 — priced per SESSION, and this is the unit. False for a session we did
  -- not do, which is what "we do not bill for it" means in a column.
  billable boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_sessions DROP CONSTRAINT IF EXISTS partner_sessions_environment;
ALTER TABLE partner_sessions ADD CONSTRAINT partner_sessions_environment
  CHECK (environment IN ('sandbox', 'live'))
  NOT VALID;
ALTER TABLE partner_sessions VALIDATE CONSTRAINT partner_sessions_environment;

-- 🔴 A SANDBOX SESSION MAY NEVER BE BILLED, in the database.
--
-- 68.22 says sandbox reaches no real patient, and the money half of that is just as
-- important: a key in sandbox that could produce a billable row is a key that can
-- run up a bill against an account nobody approved.
ALTER TABLE partner_sessions DROP CONSTRAINT IF EXISTS partner_sessions_sandbox_never_billable;
ALTER TABLE partner_sessions ADD CONSTRAINT partner_sessions_sandbox_never_billable
  CHECK (environment = 'live' OR billable = false)
  NOT VALID;
ALTER TABLE partner_sessions VALIDATE CONSTRAINT partner_sessions_sandbox_never_billable;

-- 🔴 AND A SANDBOX SESSION MAY NEVER NAME A REAL PERSON.
--
-- The same ruling, the other half. `person_id` is a foreign key into `people`, which
-- is the table of real human beings in this product, so a sandbox row holding one
-- would be a test integration joined to somebody's actual record.
ALTER TABLE partner_sessions DROP CONSTRAINT IF EXISTS partner_sessions_sandbox_no_person;
ALTER TABLE partner_sessions ADD CONSTRAINT partner_sessions_sandbox_no_person
  CHECK (environment = 'live' OR person_id IS NULL)
  NOT VALID;
ALTER TABLE partner_sessions VALIDATE CONSTRAINT partner_sessions_sandbox_no_person;

-- 🔴 AND A STOPPED SESSION IS NEVER BILLABLE. 68.17 in one line: *we did not do the
-- session, so we do not bill for it.*
ALTER TABLE partner_sessions DROP CONSTRAINT IF EXISTS partner_sessions_stopped_not_billed;
ALTER TABLE partner_sessions ADD CONSTRAINT partner_sessions_stopped_not_billed
  CHECK (stopped_reason IS NULL OR billable = false)
  NOT VALID;
ALTER TABLE partner_sessions VALIDATE CONSTRAINT partner_sessions_stopped_not_billed;

CREATE UNIQUE INDEX IF NOT EXISTS partner_sessions_ref_unique
  ON partner_sessions (partner_id, external_session_ref);

CREATE INDEX IF NOT EXISTS partner_sessions_billing_idx
  ON partner_sessions (partner_id, environment, billable, created_at);

COMMENT ON TABLE partner_sessions IS
  '68.3 to 68.11. A session held on a partner''s platform, and what we produced for it. Deliberately NOT a row in `sessions`: that table is our clinical record with our therapist, our patient and our payment on it, and forcing a partner''s session into it would grow an "unless it is a partner''s" branch on every clinical query in the product.';

-- ════════════════════════════════════════════════════════════════════════════
-- 68.15 / 68.16 / 68.17 — THE LIMIT THEY SET, AND WE NEVER EXCEED.
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 THE LIMIT IS THEIRS. Not a plan we sold them, not a tier, not something an
-- account manager raises on a call: a number the integrator typed, that we honour
-- exactly, and that they can raise with one tap when an alert arrives.
--
-- One row per partner. The alert stamps are here rather than derived, so an 80%
-- alert is sent ONCE per period and a cron that runs twice in a minute does not
-- send twice: alerting twice is how an alert becomes noise.
CREATE TABLE IF NOT EXISTS partner_limits (
  partner_id uuid PRIMARY KEY REFERENCES partners (id) ON DELETE CASCADE,

  -- 🔴 IN SESSIONS, NOT IN MONEY, because 68.14 prices per session and a limit in a
  -- different unit from the bill is a limit somebody has to do arithmetic to trust.
  monthly_session_limit integer NOT NULL DEFAULT 0,

  -- The period this limit and its alerts belong to. Rolled forward by the billing
  -- job; an alert stamped in a previous period does not suppress this period's.
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),

  alerted_80_at timestamptz,
  alerted_90_at timestamptz,
  -- When we actually stopped. Distinct from reaching the limit: an operator raising
  -- it clears this, and "were we ever off" is a question support has to answer.
  stopped_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_limits DROP CONSTRAINT IF EXISTS partner_limits_bounded;
ALTER TABLE partner_limits ADD CONSTRAINT partner_limits_bounded
  CHECK (monthly_session_limit >= 0 AND monthly_session_limit <= 1000000)
  NOT VALID;
ALTER TABLE partner_limits VALIDATE CONSTRAINT partner_limits_bounded;

COMMENT ON TABLE partner_limits IS
  '68.15 to 68.17. The limit the partner set, in SESSIONS because that is the billing unit. The alert stamps are columns rather than derived so an 80% alert is sent once per period: alerting twice is how an alert becomes noise, and noise is how a real one is missed.';

-- ════════════════════════════════════════════════════════════════════════════
-- 68.12 / 68.13 — THEIR CLINICIAN'S OWN CHOICE.
-- ════════════════════════════════════════════════════════════════════════════
--
-- 🔴 "FOR THERAPISTS ONLY" IS A LABEL, NOT A FILTER WE ENFORCE.
--
-- A general telehealth platform has GPs and physios on it. An opt-in that says *AI
-- notes, transcripts and a copilot that prepares you for sessions, for therapists*
-- lets the right people find it without us deciding who is one. There is no column
-- here recording a profession and no check that reads one.
CREATE TABLE IF NOT EXISTS partner_clinicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  partner_id uuid NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  -- Their id for this clinician, in their system.
  external_clinician_ref text NOT NULL,

  -- 🔴 68.13 — enabling is an ACT, with a time on it. Null is not enabled.
  enabled_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_clinicians_ref_unique
  ON partner_clinicians (partner_id, external_clinician_ref);

COMMENT ON TABLE partner_clinicians IS
  '68.12 / 68.13. A clinician on a partner''s platform who turned our intelligence on. There is no profession column and no check that reads one: "for therapists" is a label on the opt-in, because a platform with GPs and physios on it should not have us deciding who is a therapist.';

-- ════════════════════════════════════════════════════════════════════════════
-- 68.21 — PRODUCTION NEEDS A PERSON.
-- ════════════════════════════════════════════════════════════════════════════
--
-- C264 already rules that activating a partner is the owner's act. These columns are
-- what the owner reads before performing it, submitted by the partner rather than
-- gathered on a call.
ALTER TABLE partners ADD COLUMN IF NOT EXISTS documents_url text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS approved_by_user_id uuid
  REFERENCES users (id) ON DELETE SET NULL;

-- 🔴 AN APPROVAL WITH NO APPROVER IS AN APPROVAL NOBODY MADE.
--
-- The same pairing `sponsor_domains.agreement_approved_by` carries, for the same
-- reason: C264 says activating a partner is the OWNER'S act, and an act with no
-- actor recorded is indistinguishable from a script having done it.
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_approval_pair;
ALTER TABLE partners ADD CONSTRAINT partners_approval_pair
  CHECK ((approved_at IS NULL) = (approved_by_user_id IS NULL))
  NOT VALID;
ALTER TABLE partners VALIDATE CONSTRAINT partners_approval_pair;

COMMENT ON COLUMN partners.approved_at IS
  'C264 / 68.21. When a named human approved this partner for a production key. Paired with approved_by_user_id by a constraint, because an approval with no approver is an approval nobody made.';
