-- 0074 — clinics and hospitals. PLAN.md 54.1 to 54.6, §3f, C259 to C267. Additive.
--
-- 🔴 THE FIRST THING TO READ IS WHY THIS IS NOT `sponsors`, AND IT IS C259.
--
--   **A CLINIC IS AN `organizations` ROW. A SPONSOR IS NOT.** Opposite answers,
--   both correct, and a session reading sprints 53 and 54 back to back will
--   otherwise share one table and take four weeks to find out why.
--
-- A clinic EMPLOYS clinicians and its therapists' patients sit INSIDE its tenancy,
-- which is exactly what `actor.organization_id` already scopes across 63 queries in
-- 33 files. So a clinic is the organisation, and a clinic manager is a new kind of
-- user inside it holding zero clinical access.
--
-- A sponsor PAYS FOR CARE IT MUST NEVER SEE, so putting one here would place a
-- paying employer inside the boundary that separates caseloads (C230).
--
-- 🔴 The consequence, and the thing that makes this sprint's wall different from
-- sprint 53's: a clinic manager's principal CARRIES AN ORGANISATION ID, and that id
-- is the key to every clinical query in the product. A sponsor could not reach a
-- chart if it tried, because the shape does not fit. A clinic manager could. So the
-- wall is not the type system here: it is `lib/data/clinic.ts`'s select lists and a
-- verifier running as a clinic manager against RENDERED OUTPUT.

-- ------------------------------------------------ a clinic IS this row (54.1) --
--
-- 🔴 `solo` on every existing row, which is what they are: one clinician who signed
-- up for themselves, an organisation of one (C266).
--
-- Not a boolean. `is_clinic` leaves "what is a row that is neither" unanswerable the
-- first time a third kind arrives, and a training institute (C271) is already on the
-- horizon reading as a clinic for every purpose that matters.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'solo' NOT NULL;

-- 🔴 NULL on a solo row, and that is the shape rather than an omission.
--
-- A solo practice was never held and never approved: the clinician's own licence
-- verification is the gate. Back-filling `active` onto every existing row would be a
-- lie about a state they were never in, in a column an operator reads to decide.
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "clinic_state" text;

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "contact_name" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "contact_email" text;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "contact_phone" text;

ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_kind";
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_kind"
  CHECK ("kind" IN ('solo', 'clinic')) NOT VALID;
ALTER TABLE "organizations" VALIDATE CONSTRAINT "organizations_kind";

ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_clinic_state";
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_clinic_state"
  CHECK ("clinic_state" IS NULL OR "clinic_state" IN ('held', 'active', 'suspended', 'closed'))
  NOT VALID;
ALTER TABLE "organizations" VALIDATE CONSTRAINT "organizations_clinic_state";

-- 🔴 AND THE TWO COLUMNS HAVE TO AGREE, which is the constraint worth having.
--
-- A `solo` row with a clinic state is a row somebody will read as a held practice.
-- A `clinic` row with no state is a clinic that is neither held nor active and that
-- `getClinicActor` would refuse to sign anybody into, silently, for ever. Both are
-- the kind of half-state an operator debugs for an afternoon.
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_clinic_state_matches_kind";
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_clinic_state_matches_kind"
  CHECK (
    ("kind" = 'solo' AND "clinic_state" IS NULL)
    OR ("kind" = 'clinic' AND "clinic_state" IS NOT NULL)
  ) NOT VALID;
ALTER TABLE "organizations" VALIDATE CONSTRAINT "organizations_clinic_state_matches_kind";

CREATE INDEX IF NOT EXISTS "organizations_clinic_idx"
  ON "organizations" ("kind", "clinic_state");

-- ------------------------------------------- a manager is NOT a Role (54.2) --
--
-- 🔴 *Not a `Role` on the back office enum, which is ours.* `ROLES` is therapist,
-- staff, manager and super_admin; the last three are OUR people, and adding a fifth
-- would put a customer's practice manager one enum value away from the console that
-- prices the product.
--
-- So: a separate table, its own auth, its own cookie, its own sign-in, exactly like
-- `sponsor_users`. Unlike them it carries an `organization_id`, because that is
-- C259's whole point.
CREATE TABLE IF NOT EXISTS "clinic_managers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "password_hash" text,
  "role" text DEFAULT 'viewer' NOT NULL,
  "last_sign_in_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

DO $$
BEGIN
  ALTER TABLE "clinic_managers"
    ADD CONSTRAINT "clinic_managers_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "clinic_managers" DROP CONSTRAINT IF EXISTS "clinic_managers_role";
ALTER TABLE "clinic_managers" ADD CONSTRAINT "clinic_managers_role"
  CHECK ("role" IN ('admin', 'viewer')) NOT VALID;
ALTER TABLE "clinic_managers" VALIDATE CONSTRAINT "clinic_managers_role";

-- 🔴 Unique ACROSS clinics, not within one.
--
-- `users` is unique on (organization_id, email) because a clinician may legitimately
-- hold a solo account and a clinic account under C261. A MANAGER may not: one
-- address, one practice, so "who is signing in" is never a question the sign-in has
-- to answer by guessing which clinic was meant.
CREATE UNIQUE INDEX IF NOT EXISTS "clinic_managers_email_unique"
  ON "clinic_managers" ("email") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "clinic_managers_org_idx"
  ON "clinic_managers" ("organization_id");

CREATE TABLE IF NOT EXISTS "clinic_auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_manager_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "absolute_expires_at" timestamp with time zone NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

DO $$
BEGIN
  ALTER TABLE "clinic_auth_sessions"
    ADD CONSTRAINT "clinic_auth_sessions_clinic_manager_id_fk"
    FOREIGN KEY ("clinic_manager_id") REFERENCES "clinic_managers"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "clinic_auth_sessions_token_hash_unique"
  ON "clinic_auth_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "clinic_auth_sessions_manager_idx"
  ON "clinic_auth_sessions" ("clinic_manager_id");

-- ------------------------------------- the invitation, and C267 (54.4 to 54.6) --
--
-- 🔴 C267 — THE CLINIC CANNOT VOUCH FOR A LICENCE, AND THERE IS NO COLUMN HERE
-- THAT WOULD LET IT.
--
-- No `verified`, no `licence_number`, no `verified_by`, no document reference. An
-- invitation creates an `unverified` user and the clinic can see that verification
-- is pending and chase it. The obvious build lets a hospital mark its own therapists
-- verified, because the hospital employs them and already checked; accept it once and
-- "only certified therapists" becomes "certified, or somebody said so", and C106's
-- database invariant is bypassed by the most credible-looking route available.
CREATE TABLE IF NOT EXISTS "clinician_invitations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "first_name" text,
  "last_name" text,
  "token_hash" text NOT NULL,
  "state" text DEFAULT 'sent' NOT NULL,
  "terms_shown_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "accepted_user_id" uuid,
  "expires_at" timestamp with time zone NOT NULL,
  "invited_by_manager_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "clinician_invitations"
    ADD CONSTRAINT "clinician_invitations_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "clinician_invitations"
    ADD CONSTRAINT "clinician_invitations_accepted_user_id_fk"
    FOREIGN KEY ("accepted_user_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "clinician_invitations"
    ADD CONSTRAINT "clinician_invitations_invited_by_manager_id_fk"
    FOREIGN KEY ("invited_by_manager_id") REFERENCES "clinic_managers"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "clinician_invitations" DROP CONSTRAINT IF EXISTS "clinician_invitations_state";
ALTER TABLE "clinician_invitations" ADD CONSTRAINT "clinician_invitations_state"
  CHECK ("state" IN ('sent', 'accepted', 'revoked', 'expired')) NOT VALID;
ALTER TABLE "clinician_invitations" VALIDATE CONSTRAINT "clinician_invitations_state";

-- 🔴 C261 — NO PRIVATE PATIENTS, AND THE DATABASE REFUSES AN ACCEPTANCE THAT WAS
-- NEVER TOLD.
--
-- *It is stated in the invitation, before they accept, not discovered afterwards.*
-- `terms_shown_at` is stamped when the invitation screen renders the sentence, and an
-- acceptance without it is refused. So the promise is a constraint rather than a
-- paragraph somebody remembered to render, which is the difference between a rule and
-- a habit.
ALTER TABLE "clinician_invitations"
  DROP CONSTRAINT IF EXISTS "clinician_invitations_terms_before_acceptance";
ALTER TABLE "clinician_invitations"
  ADD CONSTRAINT "clinician_invitations_terms_before_acceptance"
  CHECK ("accepted_at" IS NULL OR "terms_shown_at" IS NOT NULL) NOT VALID;
ALTER TABLE "clinician_invitations"
  VALIDATE CONSTRAINT "clinician_invitations_terms_before_acceptance";

-- 🔴 And an accepted invitation names the clinician it became.
--
-- An `accepted` row with no `accepted_user_id` is an acceptance nobody can trace to
-- an account, which is the row a clinic would point at while asking why their
-- therapist cannot sign in.
ALTER TABLE "clinician_invitations"
  DROP CONSTRAINT IF EXISTS "clinician_invitations_accepted_complete";
ALTER TABLE "clinician_invitations"
  ADD CONSTRAINT "clinician_invitations_accepted_complete"
  CHECK (
    "state" <> 'accepted'
    OR ("accepted_at" IS NOT NULL AND "accepted_user_id" IS NOT NULL)
  ) NOT VALID;
ALTER TABLE "clinician_invitations"
  VALIDATE CONSTRAINT "clinician_invitations_accepted_complete";

CREATE UNIQUE INDEX IF NOT EXISTS "clinician_invitations_token_unique"
  ON "clinician_invitations" ("token_hash");

-- One live invitation per address per clinic. A resend replaces it.
CREATE UNIQUE INDEX IF NOT EXISTS "clinician_invitations_live_unique"
  ON "clinician_invitations" ("organization_id", "email") WHERE "state" = 'sent';

CREATE INDEX IF NOT EXISTS "clinician_invitations_org_idx"
  ON "clinician_invitations" ("organization_id", "state");
