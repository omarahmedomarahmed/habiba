-- 25.17 / C120 — a therapist's QR code, for a clinic wall.
--
-- 🔴 The table holds NO patient column, and that is the ruling, not an
-- omission. A printed code on a wall is public: anybody can photograph it,
-- and anything it carries is carried to everyone who walks past. So it carries
-- one thing, the clinician, and every patient-specific step (which record,
-- which challenge) happens afterwards behind a proven handle.
--
-- `code` is short because somebody has to be able to read it off a poster and
-- type it. It is unique forever rather than unique-among-live, so a revoked
-- poster can never come back as a different clinician's code.
CREATE TABLE IF NOT EXISTS "therapist_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  -- What the clinician calls this poster, so they know which one to kill.
  "label" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "therapist_codes_code_unique" ON "therapist_codes" ("code");
CREATE INDEX IF NOT EXISTS "therapist_codes_user_idx" ON "therapist_codes" ("user_id", "revoked_at");

-- The shape of the code itself, enforced by the database rather than by the
-- one function that happens to mint them today. Eight characters from an
-- unambiguous alphabet: no O, no 0, no I, no 1.
ALTER TABLE "therapist_codes" DROP CONSTRAINT IF EXISTS "therapist_codes_shape";
ALTER TABLE "therapist_codes"
  ADD CONSTRAINT "therapist_codes_shape" CHECK ("code" ~ '^[A-HJ-NP-Z2-9]{8}$') NOT VALID;
ALTER TABLE "therapist_codes" VALIDATE CONSTRAINT "therapist_codes_shape";
