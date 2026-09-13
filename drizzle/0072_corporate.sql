-- Sprint 53 — corporate. A company or a university pays, and never learns who went.
--
-- 🔴 Additive. H16: nothing applies migrations on deploy, so this runs against
-- production before main moves.
--
-- 🔴 A SPONSOR IS NOT AN `organizations` ROW (C230, C259).
--
-- `organizations` is the therapist's practice and `actor.organization_id` scopes
-- every clinical query in the product. Putting a paying employer there would put
-- them inside the tenancy boundary that separates clinical caseloads, which is
-- the worst place in this schema for somebody whose entire product promise is
-- that they never see care.
--
-- And a CLINIC is one, which is the trap C259 exists for: a clinic employs
-- clinicians and its therapists' patients sit inside its tenancy. Sprints 53 and
-- 54 do not share a table.

CREATE TABLE IF NOT EXISTS "sponsors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "kind" text NOT NULL,
  "state" text DEFAULT 'held' NOT NULL,

  -- 🔴 C236 — unlisted is the DEFAULT. The picker would otherwise be a public
  -- list of our corporate customers, and some will sign precisely on the
  -- condition that nobody knows.
  "listed_publicly" boolean DEFAULT false NOT NULL,

  "entity" text NOT NULL,
  "currency" text NOT NULL,

  "contact_name" text,
  "contact_email" text,
  "contact_phone" text,
  "contact_best_time" text,

  -- 🔴 C256 — the re-verification cycle is PER SPONSOR on a fixed calendar.
  -- Anchoring it to each person's enrolment would make "last verified" their
  -- join date shifted by whole cycles, and a sponsor could read off who joined
  -- the week after a restructure was announced.
  "verify_cycle_started_at" timestamp with time zone,
  "verify_cycle_months" integer DEFAULT 3 NOT NULL,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "sponsors_state_idx" ON "sponsors" ("state");
CREATE INDEX IF NOT EXISTS "sponsors_listed_idx"
  ON "sponsors" ("listed_publicly") WHERE "listed_publicly" = true;

ALTER TABLE "sponsors" DROP CONSTRAINT IF EXISTS "sponsors_kind";
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_kind"
  CHECK ("kind" IN ('company', 'university')) NOT VALID;
ALTER TABLE "sponsors" VALIDATE CONSTRAINT "sponsors_kind";

ALTER TABLE "sponsors" DROP CONSTRAINT IF EXISTS "sponsors_state";
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_state"
  CHECK ("state" IN ('held', 'active', 'suspended', 'closed')) NOT VALID;
ALTER TABLE "sponsors" VALIDATE CONSTRAINT "sponsors_state";

-- 🔴 A sponsor's own users. Never an `Actor`, never in `users`.
--
-- A separate table rather than a role on `users`, because `users.role` is read
-- by `require_role` and every back-office guard, and one wrong allowed-list
-- would hand an HR administrator a clinical screen.
CREATE TABLE IF NOT EXISTS "sponsor_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE cascade,
  "email" text NOT NULL,
  "name" text,
  "password_hash" text,
  "role" text DEFAULT 'viewer' NOT NULL,
  "last_sign_in_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_users_email_unique"
  ON "sponsor_users" ("email") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "sponsor_users_sponsor_idx" ON "sponsor_users" ("sponsor_id");

ALTER TABLE "sponsor_users" DROP CONSTRAINT IF EXISTS "sponsor_users_role";
ALTER TABLE "sponsor_users" ADD CONSTRAINT "sponsor_users_role"
  CHECK ("role" IN ('admin', 'viewer')) NOT VALID;
ALTER TABLE "sponsor_users" VALIDATE CONSTRAINT "sponsor_users_role";

CREATE TABLE IF NOT EXISTS "sponsor_auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sponsor_user_id" uuid NOT NULL REFERENCES "sponsor_users"("id") ON DELETE cascade,
  "token_hash" text NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "absolute_expires_at" timestamp with time zone NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_auth_sessions_token_hash_unique"
  ON "sponsor_auth_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "sponsor_auth_sessions_user_idx"
  ON "sponsor_auth_sessions" ("sponsor_user_id");

-- 🔴 53.9 / C237 / C120 — the joining code, PRINTED ON A WALL.
--
-- The code carries the sponsor's identity only: never a person, never an
-- entitlement. Anybody can photograph it, exactly as with C120's clinic poster.
CREATE TABLE IF NOT EXISTS "sponsor_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE cascade,
  "code" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_codes_code_unique" ON "sponsor_codes" ("code");
CREATE INDEX IF NOT EXISTS "sponsor_codes_sponsor_idx" ON "sponsor_codes" ("sponsor_id");

-- 🔴 53.7 / C238 — what the sponsor may ask for, and the CLOSED LIST is the rule.
--
-- Left open, a client asks for a national ID number, a manager's name or a
-- department, and we have built a form that collects sensitive data on their
-- behalf into our database.
CREATE TABLE IF NOT EXISTS "sponsor_identifier_fields" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "domain" text,
  "pattern" text,
  "shape_hint" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "sponsor_identifier_fields_sponsor_idx"
  ON "sponsor_identifier_fields" ("sponsor_id");

ALTER TABLE "sponsor_identifier_fields" DROP CONSTRAINT IF EXISTS "sponsor_identifier_kind";
ALTER TABLE "sponsor_identifier_fields" ADD CONSTRAINT "sponsor_identifier_kind"
  CHECK ("kind" IN ('domain_email', 'id_number')) NOT VALID;
ALTER TABLE "sponsor_identifier_fields" VALIDATE CONSTRAINT "sponsor_identifier_kind";

-- 🔴 C248 — THE HINT IS A DESCRIPTION OF THE SHAPE, NEVER A SPECIMEN VALUE.
--
-- "for example, 20215544" is a working template handed to anybody who scans a
-- poster. "Eight digits beginning with your year of entry" is not.
--
-- Enforced in the database rather than in the form, because the form is one
-- writer and an admin tool is the next one. A hint containing a run of four or
-- more digits is a specimen; a domain may be named, because a domain is public,
-- and a sample local part may not, so an @ is refused too.
ALTER TABLE "sponsor_identifier_fields" DROP CONSTRAINT IF EXISTS "sponsor_identifier_no_specimen";
ALTER TABLE "sponsor_identifier_fields" ADD CONSTRAINT "sponsor_identifier_no_specimen"
  CHECK (
    "shape_hint" IS NULL
    OR ("shape_hint" !~ '[0-9]{4}' AND "shape_hint" NOT LIKE '%@%')
  ) NOT VALID;
ALTER TABLE "sponsor_identifier_fields" VALIDATE CONSTRAINT "sponsor_identifier_no_specimen";

-- 🔴 ENROLMENT. THERE IS NO ROSTER AND NO APPROVAL QUEUE (C227).
CREATE TABLE IF NOT EXISTS "enrolments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE restrict,
  -- The PERSON, not a patient row. A benefit belongs to the person and follows
  -- them across clinicians, which is what makes C234 true.
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE cascade,
  "state" text DEFAULT 'active' NOT NULL,
  "is_primary" boolean DEFAULT true NOT NULL,

  -- 🔴 53.18b — THE IDENTIFIER IS A GATE AND NOTHING ELSE, so it is HASHED.
  --
  -- A hash cannot be returned to a sponsor, cannot be emailed, and cannot be
  -- read by a support agent with a screenshot. It still de-duplicates, which is
  -- C246's "one identifier used once, ever".
  "identifier_hash" text NOT NULL,
  "identifier_kind" text NOT NULL,

  -- 🔴 C256 — the same date for everybody in one organisation.
  "last_verified_at" timestamp with time zone,

  "removed_at" timestamp with time zone,
  "removal_reason" text,
  "paused_at" timestamp with time zone,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 🔴 C246 — ONE IDENTIFIER, USED ONCE, EVER, across every sponsor.
--
-- Not per sponsor: an identifier that crossed one gate must not cross another.
-- A unique index rather than a service check, because two people submitting the
-- same guessed student number in the same second is exactly the case a
-- check-then-insert loses.
CREATE UNIQUE INDEX IF NOT EXISTS "enrolments_identifier_unique"
  ON "enrolments" ("identifier_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "enrolments_person_sponsor_unique"
  ON "enrolments" ("person_id", "sponsor_id") WHERE "removed_at" IS NULL;

-- 🔴 C249 — exactly ONE primary per person. "The primary pot pays" is
-- meaningless if two rows claim it, and a service that sets one and clears the
-- other has a window between the two statements.
CREATE UNIQUE INDEX IF NOT EXISTS "enrolments_one_primary"
  ON "enrolments" ("person_id") WHERE "is_primary" = true AND "removed_at" IS NULL;

CREATE INDEX IF NOT EXISTS "enrolments_sponsor_idx" ON "enrolments" ("sponsor_id", "state");

ALTER TABLE "enrolments" DROP CONSTRAINT IF EXISTS "enrolments_state";
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_state"
  CHECK ("state" IN ('active', 'paused', 'removed')) NOT VALID;
ALTER TABLE "enrolments" VALIDATE CONSTRAINT "enrolments_state";

ALTER TABLE "enrolments" DROP CONSTRAINT IF EXISTS "enrolments_identifier_kind";
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_identifier_kind"
  CHECK ("identifier_kind" IN ('domain_email', 'id_number')) NOT VALID;
ALTER TABLE "enrolments" VALIDATE CONSTRAINT "enrolments_identifier_kind";

-- 🔴 C234 / §3e — the removal reason is a FIXED LIST, never free text.
--
-- A sponsor typing a reason is a sponsor writing a sentence about an individual
-- into our database, which is the one act C227 says they never perform.
ALTER TABLE "enrolments" DROP CONSTRAINT IF EXISTS "enrolments_removal_reason";
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_removal_reason"
  CHECK (
    "removal_reason" IS NULL
    OR "removal_reason" IN ('left', 'graduated', 'ended', 'administrative')
  ) NOT VALID;
ALTER TABLE "enrolments" VALIDATE CONSTRAINT "enrolments_removal_reason";

-- 🔴 A removed enrolment has a reason, and a reason means it is removed.
-- Half-set state here is how "when did their funding end" becomes unanswerable.
ALTER TABLE "enrolments" DROP CONSTRAINT IF EXISTS "enrolments_removal_complete";
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_removal_complete"
  CHECK (("removed_at" IS NULL) = ("removal_reason" IS NULL)) NOT VALID;
ALTER TABLE "enrolments" VALIDATE CONSTRAINT "enrolments_removal_complete";

-- 🔴 THE POT IS A PAYMENT METHOD, NOT A BILLING SYSTEM (C226, 53.10).
CREATE TABLE IF NOT EXISTS "sponsor_pots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE restrict,
  "balance_cents" integer DEFAULT 0 NOT NULL,
  -- 🔴 C239 amended: the overdraft is per SPONSOR, not per patient. A sponsor
  -- with 400 enrolled people and an empty pot could otherwise go 400 sessions
  -- negative at once, each individually permitted.
  "overdraft_cents" integer DEFAULT 0 NOT NULL,
  "refund_policy" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "sponsor_pots_sponsor_unique"
  ON "sponsor_pots" ("sponsor_id");

-- 🔴 C233 — REFUND AND EXPIRY TERMS BEFORE ANY MONEY IS TAKEN.
--
-- *Decided and written on the page before a single deal is signed, never
-- afterwards.* The database is where that becomes true rather than remembered:
-- a pot holding money must have terms. An empty pot need not, because a held
-- sponsor has no terms yet and nothing to refund.
--
-- C232's amendment makes this the precondition it is: refund terms are
-- precisely what counsel will change, so taking $5,000 first means a migration
-- against real money.
ALTER TABLE "sponsor_pots" DROP CONSTRAINT IF EXISTS "sponsor_pots_terms_before_money";
ALTER TABLE "sponsor_pots" ADD CONSTRAINT "sponsor_pots_terms_before_money"
  CHECK (
    "balance_cents" = 0
    OR ("refund_policy" IS NOT NULL AND "expires_at" IS NOT NULL)
  ) NOT VALID;
ALTER TABLE "sponsor_pots" VALIDATE CONSTRAINT "sponsor_pots_terms_before_money";

-- 🔴 C239 — the overdraft is BOUNDED, and the bound is in the database.
--
-- A session already started always completes and is always paid, so the balance
-- may go negative. It may not go further negative than the overdraft this
-- sponsor was granted.
ALTER TABLE "sponsor_pots" DROP CONSTRAINT IF EXISTS "sponsor_pots_overdraft_bounded";
ALTER TABLE "sponsor_pots" ADD CONSTRAINT "sponsor_pots_overdraft_bounded"
  CHECK ("balance_cents" >= -"overdraft_cents" AND "overdraft_cents" >= 0) NOT VALID;
ALTER TABLE "sponsor_pots" VALIDATE CONSTRAINT "sponsor_pots_overdraft_bounded";

-- 🔴 C231 — the patient's own notification log. TWO logs, and this is theirs.
--
-- A permanently undeletable entry saying an employer enrolled you and later
-- removed you is a fact about the EMPLOYMENT RELATIONSHIP, retained forever in
-- a record C234 promises the payer cannot touch, and it travels in an export.
--
-- So there is NO sponsor_id column here and no prose. A removal reads "your
-- benefit has ended" with no employer named and no reason. The payer's acts live
-- in `audit`, where they already belong.
CREATE TABLE IF NOT EXISTS "patient_notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "message_key" text NOT NULL,
  "dismissed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "patient_notifications_person_idx"
  ON "patient_notifications" ("person_id", "created_at");

ALTER TABLE "patient_notifications" DROP CONSTRAINT IF EXISTS "patient_notifications_kind";
ALTER TABLE "patient_notifications" ADD CONSTRAINT "patient_notifications_kind"
  CHECK ("kind" IN ('benefit_started', 'benefit_ended', 'benefit_paused', 'verify_needed'))
  NOT VALID;
ALTER TABLE "patient_notifications" VALIDATE CONSTRAINT "patient_notifications_kind";

-- 🔴 53.10 / C226 — ONE new funding source, on the payment row that already
-- exists. No session type, no corporate invoice path, no second ledger.
--
-- 🔴 NOT nullable-as-a-signal. `card` is the default and every existing row is
-- one, which is what those payments were. A null would make "sponsored" an
-- ABSENCE, and C243 is the eighth occurrence of the §6 family for exactly that
-- reason: an absence is what somebody finds by sorting a column.
ALTER TABLE "session_payments"
  ADD COLUMN IF NOT EXISTS "funding_source" text DEFAULT 'card' NOT NULL;

ALTER TABLE "session_payments" DROP CONSTRAINT IF EXISTS "session_payments_funding_source";
ALTER TABLE "session_payments" ADD CONSTRAINT "session_payments_funding_source"
  CHECK ("funding_source" IN ('card', 'pot')) NOT VALID;
ALTER TABLE "session_payments" VALIDATE CONSTRAINT "session_payments_funding_source";
