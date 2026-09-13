-- 0080 — SMART on FHIR. PLAN.md 43.1, 43.1b, 43.3, 43.4, C266. Additive.
--
-- 🔴 THREE TABLES, AND THE INTERESTING PART IS WHAT IS NOT IN THEM.
--
-- 43.4 says the chart in an EHR is THEIR system of record, not ours. `lib/ehr/policy.ts` is the
-- written decision; this file is that decision in columns. `ehr_launches` holds their patient id
-- and nothing else of theirs: no date of birth, no MRN, no address, no payer, no problem list,
-- no medication. Every one of those arrives in the same `Patient` resource we read to resolve a
-- launch, and persisting what you fetched is one line, which is exactly why there is no column
-- to persist it into.
--
-- 🔴 C266 / 43.1b — `ehr_connections` HAS NO `user_id`, AND THAT ABSENCE IS THE RULING.
--
-- A hospital's FHIR credential is the hospital's. `meeting_connections` carries both a user and
-- an organisation because a Zoom account really does belong to a person; this does not. With a
-- `user_id` the first convenience anybody adds is "let this clinician use their own", and then a
-- therapist leaving a clinic keeps a credential pointed at the hospital's chart.
--
-- A solo therapist needs no second case: `organizations.kind = 'solo'` is already their own row
-- (C259), so one column is the owner in both worlds and 43.1c is two homes for one flow.

CREATE TABLE IF NOT EXISTS "ehr_connections" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 🔴 C266. The owner, and the only owner.
  "organization_id"      uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,

  "vendor"               text NOT NULL,
  "fhir_base_url"        text NOT NULL,
  "issuer"               text NOT NULL,

  -- 🔴 Sealed with AES-256-GCM, never hashed: refreshing needs the token back. Cleared on
  -- revoke, so the row keeps the fact without keeping the credential.
  "access_token_sealed"  text,
  "refresh_token_sealed" text,
  "expires_at"           timestamptz,
  "scopes"               jsonb NOT NULL DEFAULT '[]'::jsonb,

  "tenant_label"         text,

  "connected_at"         timestamptz NOT NULL DEFAULT now(),
  "revoked_at"           timestamptz,
  "revoked_reason"       text,

  "created_at"           timestamptz NOT NULL DEFAULT now(),
  "updated_at"           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "ehr_connections" DROP CONSTRAINT IF EXISTS "ehr_connections_vendor";
ALTER TABLE "ehr_connections"
  ADD CONSTRAINT "ehr_connections_vendor"
  CHECK ("vendor" IN ('epic', 'cerner', 'athena', 'smart_sandbox')) NOT VALID;
ALTER TABLE "ehr_connections" VALIDATE CONSTRAINT "ehr_connections_vendor";

-- 🔴 https ONLY, and by a CHECK rather than by a form.
--
-- A FHIR base URL over http is a bearer token and a patient's chart travelling in clear. The
-- same reasoning as `partner_webhooks_https` in 0075, and the same placement: an operator
-- pasting a sandbox URL on a Friday should not be able to.
--
-- The sandbox is not exempt. A SMART sandbox serves synthetic patients over https like everybody
-- else, and an exemption for testing is the exemption that reaches production.
ALTER TABLE "ehr_connections" DROP CONSTRAINT IF EXISTS "ehr_connections_https";
ALTER TABLE "ehr_connections"
  ADD CONSTRAINT "ehr_connections_https"
  CHECK ("fhir_base_url" LIKE 'https://%' AND "issuer" LIKE 'https://%') NOT VALID;
ALTER TABLE "ehr_connections" VALIDATE CONSTRAINT "ehr_connections_https";

-- 🔴 A REVOKED CONNECTION HOLDS NO CREDENTIAL, by CHECK.
--
-- `revokeConnection` clears both sealed columns, and this is the rule that makes that not merely
-- the current behaviour. A revoked row with a live refresh token is a credential nobody believes
-- exists, which is the worst kind to have: it will not appear on any screen that lists
-- connections, because every one of those filters on `revoked_at IS NULL`.
ALTER TABLE "ehr_connections" DROP CONSTRAINT IF EXISTS "ehr_connections_revoked_holds_no_secret";
ALTER TABLE "ehr_connections"
  ADD CONSTRAINT "ehr_connections_revoked_holds_no_secret"
  CHECK (
    "revoked_at" IS NULL
    OR ("access_token_sealed" IS NULL AND "refresh_token_sealed" IS NULL)
  ) NOT VALID;
ALTER TABLE "ehr_connections" VALIDATE CONSTRAINT "ehr_connections_revoked_holds_no_secret";

-- 🔴 ONE LIVE CONNECTION PER ORGANISATION PER VENDOR. C266 as an index.
--
-- Two live Epic connections under one hospital are two credentials for one chart, and the losing
-- one is whichever a query happens to order first. Partial, so the history of revoked ones stays.
CREATE UNIQUE INDEX IF NOT EXISTS "ehr_connections_live_unique"
  ON "ehr_connections" ("organization_id", "vendor") WHERE "revoked_at" IS NULL;

CREATE INDEX IF NOT EXISTS "ehr_connections_org_idx"
  ON "ehr_connections" ("organization_id");

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ehr_launches" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "connection_id"       uuid NOT NULL REFERENCES "ehr_connections"("id") ON DELETE CASCADE,
  "user_id"             uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,

  -- 🔴 THEIR id for the patient, and the only thing on this table that is theirs.
  -- Nullable because a revoke SEVERS it (43.4's second clock), not because a launch can lack one.
  "fhir_patient_id"     text,
  "patient_id"          uuid REFERENCES "patients"("id") ON DELETE SET NULL,
  "fhir_encounter_id"   text,

  "launched_at"         timestamptz NOT NULL DEFAULT now(),
  -- Stamped when a revoke severs the mapping, so the severing is itself auditable.
  "severed_at"          timestamptz,

  "created_at"          timestamptz NOT NULL DEFAULT now()
);

-- 🔴 A SEVERED LAUNCH HOLDS NO FOREIGN IDENTIFIER, by CHECK.
--
-- This is 43.4's second clock made structural rather than procedural. After a hospital
-- disconnects we must not be able to resolve their patient identifiers; the clinical record we
-- hold survives, because it is the patient's and §7 says they can claim it and leave, including
-- leaving the institution.
--
-- Written as a CHECK because the alternative is trusting that `revokeConnection` always runs its
-- UPDATE, and a sever that silently did not happen looks exactly like one that did.
ALTER TABLE "ehr_launches" DROP CONSTRAINT IF EXISTS "ehr_launches_severed_holds_no_foreign_id";
ALTER TABLE "ehr_launches"
  ADD CONSTRAINT "ehr_launches_severed_holds_no_foreign_id"
  CHECK (
    "severed_at" IS NULL
    OR ("fhir_patient_id" IS NULL AND "fhir_encounter_id" IS NULL)
  ) NOT VALID;
ALTER TABLE "ehr_launches" VALIDATE CONSTRAINT "ehr_launches_severed_holds_no_foreign_id";

CREATE INDEX IF NOT EXISTS "ehr_launches_connection_idx" ON "ehr_launches" ("connection_id");
CREATE INDEX IF NOT EXISTS "ehr_launches_patient_idx"    ON "ehr_launches" ("patient_id");

-- 🔴 The lookup a launch does: "have I seen this hospital's patient before". Scoped to the
-- CONNECTION, because two hospitals will both call somebody 12345 — the identity-collision
-- problem `lib/integrations/registry.ts` has named as unsolved since sprint 28, solved by never
-- treating a foreign id as ours.
CREATE INDEX IF NOT EXISTS "ehr_launches_fhir_patient_idx"
  ON "ehr_launches" ("connection_id", "fhir_patient_id");

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ehr_writebacks" (
  "id"                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "connection_id"               uuid NOT NULL REFERENCES "ehr_connections"("id") ON DELETE CASCADE,
  "note_id"                     uuid NOT NULL REFERENCES "session_notes"("id") ON DELETE CASCADE,

  "state"                       text NOT NULL DEFAULT 'pending',
  "fhir_document_reference_id"  text,
  "last_error"                  text,
  "attempts"                    integer NOT NULL DEFAULT 0,

  "filed_at"                    timestamptz,
  "created_at"                  timestamptz NOT NULL DEFAULT now(),
  "updated_at"                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "ehr_writebacks" DROP CONSTRAINT IF EXISTS "ehr_writebacks_state";
ALTER TABLE "ehr_writebacks"
  ADD CONSTRAINT "ehr_writebacks_state"
  CHECK ("state" IN ('pending', 'filed', 'refused')) NOT VALID;
ALTER TABLE "ehr_writebacks" VALIDATE CONSTRAINT "ehr_writebacks_state";

-- 🔴 A FILED WRITEBACK NAMES WHAT IT FILED, by CHECK.
--
-- `state = 'filed'` with no DocumentReference id is a row claiming a note reached a chart with
-- nothing to look it up by. That is the one state this table exists to make impossible: a gap in
-- a chart that nobody can detect is the worst outcome this sprint can produce.
ALTER TABLE "ehr_writebacks" DROP CONSTRAINT IF EXISTS "ehr_writebacks_filed_names_document";
ALTER TABLE "ehr_writebacks"
  ADD CONSTRAINT "ehr_writebacks_filed_names_document"
  CHECK (
    "state" <> 'filed'
    OR ("fhir_document_reference_id" IS NOT NULL AND "filed_at" IS NOT NULL)
  ) NOT VALID;
ALTER TABLE "ehr_writebacks" VALIDATE CONSTRAINT "ehr_writebacks_filed_names_document";

-- 🔴 ONE FILING PER NOTE PER CONNECTION. Idempotency as an index rather than as a service check,
-- so a retry cannot put two DocumentReferences for one note in somebody's chart.
CREATE UNIQUE INDEX IF NOT EXISTS "ehr_writebacks_note_unique"
  ON "ehr_writebacks" ("note_id", "connection_id");

CREATE INDEX IF NOT EXISTS "ehr_writebacks_state_idx" ON "ehr_writebacks" ("state");
