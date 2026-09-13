-- 0075 — the partner plane. PLAN.md 42.1 to 42.7 and 55.1 to 55.10, §7, C255, C265,
-- C277. Additive.
--
-- 🔴 THIS CARRIES SPRINT 42's TABLES AS WELL AS SPRINT 55's.
--
-- 55's preamble says it *"extends sprint 42 from a set of tables into a product
-- somebody can sign up for and use"*. Sprint 42 was never built: there was not one
-- occurrence of the word `partner` in `lib/db/schema.ts` before this migration. So
-- 42.1, 42.2, 42.3, 42.6 and 42.7 are here, and 55 is the sprint that makes them a
-- product rather than the sprint that assumes they exist.
--
-- 🔴 THE SIXTH PRINCIPAL, AND WHAT IT IS NOT.
--
-- §3f: a partner is a developer at another company who sees keys, docs, webhooks and
-- their own subjects, and never content. §7 is blunter: a therapist never sees an API
-- key, because a therapist holding one is a therapist who got lost in our product.
--
-- So `partner_users` is a third principal beside `sponsor_users` and
-- `clinic_managers`, and like the sponsor's it carries NO organisation id. A partner
-- is outside the tenancy entirely. What reaches a chart is never the partner: it is a
-- CLINICIAN holding a grant a patient gave (C277), signed in through an ordinary
-- `auth_sessions` row that 42.3 mints.
--
-- 🔴 C255 AND C265 ARE SHAPES IN HERE, NOT RULES IN A SERVICE.
--
-- C255: the integration answers a question about one person we already hold and never
-- enumerates. Every HR platform worth integrating, and SCIM itself, is built around
-- PROVISIONING: pull the directory, sync it, keep it. Build any of that and we hold a
-- complete staff list for every client, which is what three enrolment designs were
-- spent removing.
--
-- C265: a key that can ask "does this person work here" is an identity oracle pointed
-- at our own patients. So: `partner_api_keys.sponsor_id` scopes a key to exactly ONE
-- sponsor, and `enrolment_attestations` makes "somebody offered this identifier
-- minutes ago" a row with an expiry rather than a claim in a comment.

-- ---------------------------------------------------------- the partner (42.1) --

CREATE TABLE IF NOT EXISTS "partners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "state" text DEFAULT 'held' NOT NULL,
  "contact_name" text,
  "contact_email" text,
  "contact_phone" text,
  "intent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "partners" DROP CONSTRAINT IF EXISTS "partners_state";
ALTER TABLE "partners" ADD CONSTRAINT "partners_state"
  CHECK ("state" IN ('held', 'active', 'suspended', 'closed')) NOT VALID;
ALTER TABLE "partners" VALIDATE CONSTRAINT "partners_state";

CREATE UNIQUE INDEX IF NOT EXISTS "partners_slug_unique" ON "partners" ("slug");
CREATE INDEX IF NOT EXISTS "partners_state_idx" ON "partners" ("state");

CREATE TABLE IF NOT EXISTS "partner_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "email" text NOT NULL,
  "name" text,
  "password_hash" text,
  "role" text DEFAULT 'developer' NOT NULL,
  "last_sign_in_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

DO $$
BEGIN
  ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "partner_users" DROP CONSTRAINT IF EXISTS "partner_users_role";
ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_role"
  CHECK ("role" IN ('admin', 'developer')) NOT VALID;
ALTER TABLE "partner_users" VALIDATE CONSTRAINT "partner_users_role";

CREATE UNIQUE INDEX IF NOT EXISTS "partner_users_email_unique"
  ON "partner_users" ("email") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "partner_users_partner_idx" ON "partner_users" ("partner_id");

CREATE TABLE IF NOT EXISTS "partner_auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_user_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
  "absolute_expires_at" timestamp with time zone NOT NULL,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone
);

DO $$
BEGIN
  ALTER TABLE "partner_auth_sessions" ADD CONSTRAINT "partner_auth_sessions_user_fk"
    FOREIGN KEY ("partner_user_id") REFERENCES "partner_users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "partner_auth_sessions_token_hash_unique"
  ON "partner_auth_sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "partner_auth_sessions_user_idx"
  ON "partner_auth_sessions" ("partner_user_id");

-- ------------------------------------------------- the key, and C265 (42.1, 55.2) --
--
-- 🔴 Hashed, so a leaked table is not a set of working keys. The raw key is returned
-- once at creation; a `prefix` is kept in clear so a developer can tell two keys apart
-- and an operator can name one in a support conversation without holding the secret.
--
-- 🔴 `sponsor_id` IS C265 IN A COLUMN. *The endpoint is scoped to one sponsor.* Null
-- means the key answers about nobody, which is the correct default and is why the
-- scope alone is not enough.
--
-- 🔴 `suspended_at` is set BY THE LIMITER, not by a human: *an abnormal rate suspends
-- the key rather than alerting somebody to read a chart later.*
CREATE TABLE IF NOT EXISTS "partner_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "label" text NOT NULL,
  "key_hash" text NOT NULL,
  "prefix" text NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "environment" text DEFAULT 'sandbox' NOT NULL,
  "sponsor_id" uuid,
  "last_used_at" timestamp with time zone,
  "suspended_at" timestamp with time zone,
  "suspended_reason" text,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "partner_api_keys" ADD CONSTRAINT "partner_api_keys_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "partner_api_keys" ADD CONSTRAINT "partner_api_keys_sponsor_id_fk"
    FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "partner_api_keys" DROP CONSTRAINT IF EXISTS "partner_api_keys_environment";
ALTER TABLE "partner_api_keys" ADD CONSTRAINT "partner_api_keys_environment"
  CHECK ("environment" IN ('sandbox', 'live')) NOT VALID;
ALTER TABLE "partner_api_keys" VALIDATE CONSTRAINT "partner_api_keys_environment";

-- 🔴 AND THE DATABASE REFUSES AN EMPLOYMENT KEY WITH NO SPONSOR.
--
-- C265's scoping is not advice. A key holding `employment:verify` without a sponsor is
-- exactly the identity oracle the ruling forbids, so it cannot be stored: the check
-- reads the scopes array, which means the constraint holds however the row was written
-- and not only when it came through our own function.
ALTER TABLE "partner_api_keys"
  DROP CONSTRAINT IF EXISTS "partner_api_keys_employment_needs_sponsor";
ALTER TABLE "partner_api_keys"
  ADD CONSTRAINT "partner_api_keys_employment_needs_sponsor"
  CHECK (
    NOT ("scopes" @> '["employment:verify"]'::jsonb) OR "sponsor_id" IS NOT NULL
  ) NOT VALID;
ALTER TABLE "partner_api_keys"
  VALIDATE CONSTRAINT "partner_api_keys_employment_needs_sponsor";

-- 🔴 And a suspension says why, because a developer asking "why did my key stop"
-- deserves an answer and a null reason is how a support queue fills up.
ALTER TABLE "partner_api_keys"
  DROP CONSTRAINT IF EXISTS "partner_api_keys_suspension_has_reason";
ALTER TABLE "partner_api_keys"
  ADD CONSTRAINT "partner_api_keys_suspension_has_reason"
  CHECK ("suspended_at" IS NULL OR "suspended_reason" IS NOT NULL) NOT VALID;
ALTER TABLE "partner_api_keys"
  VALIDATE CONSTRAINT "partner_api_keys_suspension_has_reason";

CREATE UNIQUE INDEX IF NOT EXISTS "partner_api_keys_hash_unique"
  ON "partner_api_keys" ("key_hash");
CREATE INDEX IF NOT EXISTS "partner_api_keys_partner_idx"
  ON "partner_api_keys" ("partner_id", "revoked_at");

-- ------------------------------------------- webhooks carry an id (42.4, 55.10) --
--
-- 🔴 *A webhook carries an event and an id, never content. A leaked webhook URL then
-- leaks nothing.* So there is NO payload column on the delivery table, and the absence
-- is the feature: a partner receiving a delivery knows something happened and has to
-- ask, with a key we can revoke, to learn what.
CREATE TABLE IF NOT EXISTS "partner_webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "url" text NOT NULL,
  "secret_sealed" text NOT NULL,
  "events" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "disabled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "partner_webhooks" ADD CONSTRAINT "partner_webhooks_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 HTTPS ONLY, in the database. A webhook URL is where a signed delivery goes, and
-- an http:// endpoint is a delivery readable by anybody on the path. An operator
-- setting one up on a Friday should not be able to.
ALTER TABLE "partner_webhooks" DROP CONSTRAINT IF EXISTS "partner_webhooks_https";
ALTER TABLE "partner_webhooks" ADD CONSTRAINT "partner_webhooks_https"
  CHECK ("url" LIKE 'https://%') NOT VALID;
ALTER TABLE "partner_webhooks" VALIDATE CONSTRAINT "partner_webhooks_https";

CREATE INDEX IF NOT EXISTS "partner_webhooks_partner_idx"
  ON "partner_webhooks" ("partner_id", "disabled_at");

CREATE TABLE IF NOT EXISTS "partner_webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "webhook_id" uuid NOT NULL,
  "event" text NOT NULL,
  "subject_id" uuid,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_status" integer,
  "last_error" text,
  "delivered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "partner_webhook_deliveries" ADD CONSTRAINT "partner_webhook_deliveries_hook_fk"
    FOREIGN KEY ("webhook_id") REFERENCES "partner_webhooks"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "partner_webhook_deliveries" DROP CONSTRAINT IF EXISTS "partner_webhook_deliveries_event";
ALTER TABLE "partner_webhook_deliveries" ADD CONSTRAINT "partner_webhook_deliveries_event"
  CHECK ("event" IN ('session.completed', 'note.approved', 'grant.revoked', 'record.claimed'))
  NOT VALID;
ALTER TABLE "partner_webhook_deliveries" VALIDATE CONSTRAINT "partner_webhook_deliveries_event";

CREATE INDEX IF NOT EXISTS "partner_webhook_deliveries_hook_idx"
  ON "partner_webhook_deliveries" ("webhook_id", "created_at");
CREATE INDEX IF NOT EXISTS "partner_webhook_deliveries_pending_idx"
  ON "partner_webhook_deliveries" ("created_at") WHERE "delivered_at" IS NULL;

-- -------------------------------------------------- two partners send "P123" (42.2) --
--
-- 🔴 UNIQUE ON `(partner_id, external_ref)`, and that sentence is the whole table. An
-- external reference is meaningless without the partner it came from, and a unique
-- index on `external_ref` alone would have let the second partner to integrate collide
-- with the first one's patients.
CREATE TABLE IF NOT EXISTS "partner_subjects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "partner_id" uuid NOT NULL,
  "external_ref" text NOT NULL,
  "person_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "partner_subjects" ADD CONSTRAINT "partner_subjects_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "partner_subjects" ADD CONSTRAINT "partner_subjects_person_id_fk"
    FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "partner_subjects_partner_ref_unique"
  ON "partner_subjects" ("partner_id", "external_ref");
CREATE INDEX IF NOT EXISTS "partner_subjects_person_idx" ON "partner_subjects" ("person_id");

-- -------------------------------- the row that makes the oracle impossible (C265) --
--
-- > *Only ever answers about an identifier a person has themselves submitted through
-- > enrolment in the last few minutes. It is not a lookup API; it is a step inside one
-- > flow, and it can never be called with an identifier nobody offered.*
--
-- That cannot be enforced by a rate limit or a scope. It needs a record of the
-- offering, with an expiry, and this is it: `enrol` writes one when somebody types an
-- identifier, and the endpoint answers only about a row that exists and has not
-- expired and has not already answered.
--
-- 🔴 THE IDENTIFIER IS THE SAME SALTED HASH `enrolments` HOLDS. So the endpoint hashes
-- what the partner sends and looks for a match: it can CONFIRM what somebody offered
-- and can never be read to enumerate what anybody offered. A stolen table is not a
-- list of work addresses.
--
-- 🔴 AND IT IS CONSUMED. `answered_at` is stamped on use, so one offering licences one
-- question. Without that a single enrolment would licence unlimited questions about
-- one person for the length of the window, which is a smaller oracle rather than none.
CREATE TABLE IF NOT EXISTS "enrolment_attestations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sponsor_id" uuid NOT NULL,
  "identifier_hash" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "answered_at" timestamp with time zone,
  "answered_by_key_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "enrolment_attestations" ADD CONSTRAINT "enrolment_attestations_sponsor_fk"
    FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "enrolment_attestations" ADD CONSTRAINT "enrolment_attestations_key_fk"
    FOREIGN KEY ("answered_by_key_id") REFERENCES "partner_api_keys"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 🔴 An answered attestation NAMES THE KEY THAT ASKED, because C265 requires every
-- call audited with the sponsor, the key and the outcome. A row marked answered by
-- nobody is an audit with a hole in it.
ALTER TABLE "enrolment_attestations"
  DROP CONSTRAINT IF EXISTS "enrolment_attestations_answer_names_key";
ALTER TABLE "enrolment_attestations"
  ADD CONSTRAINT "enrolment_attestations_answer_names_key"
  CHECK ("answered_at" IS NULL OR "answered_by_key_id" IS NOT NULL) NOT VALID;
ALTER TABLE "enrolment_attestations"
  VALIDATE CONSTRAINT "enrolment_attestations_answer_names_key";

CREATE INDEX IF NOT EXISTS "enrolment_attestations_lookup_idx"
  ON "enrolment_attestations" ("sponsor_id", "identifier_hash");
CREATE INDEX IF NOT EXISTS "enrolment_attestations_expiry_idx"
  ON "enrolment_attestations" ("expires_at");

-- ------------------------------------ who pays, who read it, how (42.6, 42.7, 42.3) --
--
-- 🔴 `organizations.partner_id` says who PAYS and is NOT a tenancy. A partner is
-- outside the boundary; the caseload inside a practice belongs to the clinicians in it
-- exactly as it does anywhere else. C277 is the same point from the patient's side.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "billing_mode" text DEFAULT 'self' NOT NULL;

DO $$
BEGIN
  ALTER TABLE "organizations" ADD CONSTRAINT "organizations_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_billing_mode";
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_billing_mode"
  CHECK ("billing_mode" IN ('self', 'partner_billed')) NOT VALID;
ALTER TABLE "organizations" VALIDATE CONSTRAINT "organizations_billing_mode";

-- 🔴 And a partner-billed practice must name the partner being billed. A
-- `partner_billed` row with a null partner is an invoice with nowhere to go, found at
-- the end of a month.
ALTER TABLE "organizations" DROP CONSTRAINT IF EXISTS "organizations_partner_billed_names_partner";
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_partner_billed_names_partner"
  CHECK ("billing_mode" <> 'partner_billed' OR "partner_id" IS NOT NULL) NOT VALID;
ALTER TABLE "organizations" VALIDATE CONSTRAINT "organizations_partner_billed_names_partner";

CREATE INDEX IF NOT EXISTS "organizations_partner_idx" ON "organizations" ("partner_id");

-- 🔴 42.7 — so "who read this" answers "THEIR SERVER, ON BEHALF OF DR X".
--
-- Both columns, because either alone is a worse answer than none. `partner_id` without
-- `via` cannot tell a partner's own server call from a clinician clicking inside an
-- embedded widget; `via` without `partner_id` says a call came through an integration
-- and not which one.
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE "audit_log" ADD COLUMN IF NOT EXISTS "via" text;

DO $$
BEGIN
  ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_via_known";
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_via_known"
  CHECK ("via" IS NULL OR "via" IN ('partner_api', 'partner_launch')) NOT VALID;
ALTER TABLE "audit_log" VALIDATE CONSTRAINT "audit_log_via_known";

CREATE INDEX IF NOT EXISTS "audit_log_partner_idx" ON "audit_log" ("partner_id", "created_at");

-- 🔴 42.3 — A LAUNCH MINTS ONE OF THESE, SO THERE STAYS EXACTLY ONE WAY TO BE SIGNED
-- IN.
--
-- The alternative is a second session mechanism for embedded clinicians, which means
-- every guard in the product growing an "or a partner launch" branch, and the day one
-- of them forgets is the day a widget reaches a screen it should not. Instead a
-- launched clinician IS signed in, ordinarily, with a row that remembers where they
-- came from and expires sooner.
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "partner_id" uuid;
ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "created_via" text;

DO $$
BEGIN
  ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_partner_id_fk"
    FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_created_via_known";
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_created_via_known"
  CHECK ("created_via" IS NULL OR "created_via" IN ('partner_api', 'partner_launch'))
  NOT VALID;
ALTER TABLE "auth_sessions" VALIDATE CONSTRAINT "auth_sessions_created_via_known";

-- 🔴 A launched session must name the partner it was launched from.
--
-- `created_via = 'partner_launch'` with a null partner is a session the audit cannot
-- attribute, which is the one thing 42.7 exists to prevent.
ALTER TABLE "auth_sessions" DROP CONSTRAINT IF EXISTS "auth_sessions_launch_names_partner";
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_launch_names_partner"
  CHECK ("created_via" IS NULL OR "partner_id" IS NOT NULL) NOT VALID;
ALTER TABLE "auth_sessions" VALIDATE CONSTRAINT "auth_sessions_launch_names_partner";
