-- Sprint 26 — the record the patient owns.
--
-- Two tables, one rule each.

-- 26.1 / C111 — the clinical summary belongs to the PATIENT.
--
-- Keyed on `person_id`, not on a clinic's `patients` row, because the summary
-- is about a person and follows them between clinicians. Versioned and
-- APPEND ONLY: therapist B writes version 2, and version 1 with therapist A's
-- name on it is still there and still readable.
--
-- The approving clinician is snapshotted by NAME and licence rather than only
-- by id. A clinician can leave, be deleted, or have their licence lapse, and
-- none of that may change what a patient already holds: a version whose author
-- resolves to "unknown" a year later is not a record of anything.
CREATE TABLE IF NOT EXISTS "clinical_summaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "body" text NOT NULL,

  "approved_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "approved_by_name" text NOT NULL,
  "approved_by_credentials" text,
  "approved_by_license_body" text,
  "approved_by_license_number" text,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
  "session_id" uuid REFERENCES "sessions"("id") ON DELETE SET NULL,

  "approved_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "clinical_summaries_person_version"
  ON "clinical_summaries" ("person_id", "version");

ALTER TABLE "clinical_summaries" DROP CONSTRAINT IF EXISTS "clinical_summaries_version_positive";
ALTER TABLE "clinical_summaries"
  ADD CONSTRAINT "clinical_summaries_version_positive" CHECK ("version" >= 1) NOT VALID;
ALTER TABLE "clinical_summaries" VALIDATE CONSTRAINT "clinical_summaries_version_positive";

ALTER TABLE "clinical_summaries" DROP CONSTRAINT IF EXISTS "clinical_summaries_body_not_blank";
ALTER TABLE "clinical_summaries"
  ADD CONSTRAINT "clinical_summaries_body_not_blank" CHECK (btrim("body") <> '') NOT VALID;
ALTER TABLE "clinical_summaries" VALIDATE CONSTRAINT "clinical_summaries_body_not_blank";

-- 🔴 Append only, enforced by the database rather than by discipline.
--
-- A CHECK cannot express this: "you may INSERT and never UPDATE" is a rule
-- about statements, not about rows. A trigger can, and it is the difference
-- between a promise in a comment and a promise a migration keeps. Without it
-- the rule survives exactly until somebody writes a well-meaning "fix a typo
-- in the summary" action, and a patient's record silently loses the version
-- they read last month.
CREATE OR REPLACE FUNCTION "clinical_summaries_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'clinical_summaries is append only: write a new version'
    USING ERRCODE = '0A000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "clinical_summaries_no_rewrite" ON "clinical_summaries";
CREATE TRIGGER "clinical_summaries_no_rewrite"
  BEFORE UPDATE OR DELETE ON "clinical_summaries"
  FOR EACH ROW EXECUTE FUNCTION "clinical_summaries_append_only"();

-- 26.5 to 26.8 — journals. What a patient writes about their own week.
--
-- They replace patient file uploads and patient-dictated clinical history:
-- a person photographing a prescription was being asked to do a clinician's
-- filing, and a person dictating "my history" was being asked to write a
-- clinical document about themselves. A journal is neither. It is theirs.
--
-- 🔴 `risk_level` and `risk_indicators` exist because C123 rules that a
-- journal is scanned like a transcript. They are written by the same scanner
-- the transcript path uses. Nothing on the patient's screen ever reads them.
CREATE TABLE IF NOT EXISTS "journals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  -- Which account wrote it. Null would mean "a journal nobody wrote".
  "account_id" uuid NOT NULL,
  "source" text NOT NULL DEFAULT 'typed',
  "body" text NOT NULL,
  "risk_level" text,
  "risk_indicators" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "journals_person_idx" ON "journals" ("person_id", "created_at" DESC);

ALTER TABLE "journals" DROP CONSTRAINT IF EXISTS "journals_source_known";
ALTER TABLE "journals"
  ADD CONSTRAINT "journals_source_known" CHECK ("source" IN ('typed', 'dictated')) NOT VALID;
ALTER TABLE "journals" VALIDATE CONSTRAINT "journals_source_known";

ALTER TABLE "journals" DROP CONSTRAINT IF EXISTS "journals_body_not_blank";
ALTER TABLE "journals"
  ADD CONSTRAINT "journals_body_not_blank" CHECK (btrim("body") <> '') NOT VALID;
ALTER TABLE "journals" VALIDATE CONSTRAINT "journals_body_not_blank";

ALTER TABLE "journals" DROP CONSTRAINT IF EXISTS "journals_risk_known";
ALTER TABLE "journals"
  ADD CONSTRAINT "journals_risk_known" CHECK ("risk_level" IS NULL OR "risk_level" IN ('low', 'moderate', 'high')) NOT VALID;
ALTER TABLE "journals" VALIDATE CONSTRAINT "journals_risk_known";

-- 26.9 / C127 — a third party checking an extract.
--
-- The code is printed on the cover page and checked on a public page. It
-- resolves to what we can honestly attest: that this platform holds a record
-- for a person, how many sessions and approved notes it contains, and when the
-- extract was produced. It never resolves to a diagnosis, a name, or a note.
ALTER TABLE "data_exports" ADD COLUMN IF NOT EXISTS "verification_code" text;
ALTER TABLE "data_exports" ADD COLUMN IF NOT EXISTS "person_id" uuid REFERENCES "people"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "data_exports_verification_code"
  ON "data_exports" ("verification_code") WHERE "verification_code" IS NOT NULL;
