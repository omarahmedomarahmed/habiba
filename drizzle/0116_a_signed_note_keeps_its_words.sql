-- W1-03: a signed note keeps its words.
--
-- `saveNote` overwrote `session_notes.content` after the chart was signed, and
-- `savePatientNote` did the same to a patient copy that had already been
-- released. The audit row said an edit happened and nothing said what the
-- signed text had been. P4: every version stays, under its author's name.
--
-- After signing, a change is an ADDENDUM: author, time, text, kept for ever and
-- shown under the note in order. Two tables' worth of rule, one each.

-- 1. The addenda. Append only, like `clinical_summaries` (0059).
--
-- Keyed to the NOTE, not only the session: a session will soon carry several
-- notes (one per format), each signed on its own, and an addendum belongs to
-- the document it amends. `session_id` is kept beside it for reading a
-- session's addenda in one pass.
--
-- The author is snapshotted by name as well as id, for the reason 0059 gives:
-- a clinician can leave or be deleted, and an addendum whose author resolves to
-- nobody a year later is not a record of anything.
CREATE TABLE IF NOT EXISTS "note_addenda" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "note_id" uuid NOT NULL REFERENCES "session_notes"("id") ON DELETE CASCADE,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,
  "kind" text NOT NULL,
  "author_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "author_name" text NOT NULL,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "note_addenda_note" ON "note_addenda" ("note_id", "created_at");
CREATE INDEX IF NOT EXISTS "note_addenda_session" ON "note_addenda" ("session_id", "created_at");

ALTER TABLE "note_addenda" DROP CONSTRAINT IF EXISTS "note_addenda_kind";
ALTER TABLE "note_addenda"
  ADD CONSTRAINT "note_addenda_kind" CHECK ("kind" IN ('clinical', 'patient')) NOT VALID;
ALTER TABLE "note_addenda" VALIDATE CONSTRAINT "note_addenda_kind";

ALTER TABLE "note_addenda" DROP CONSTRAINT IF EXISTS "note_addenda_body_not_blank";
ALTER TABLE "note_addenda"
  ADD CONSTRAINT "note_addenda_body_not_blank" CHECK (btrim("body") <> '') NOT VALID;
ALTER TABLE "note_addenda" VALIDATE CONSTRAINT "note_addenda_body_not_blank";

-- No UPDATE, ever, and no DELETE aimed at an addendum. The one delete let
-- through is a CASCADE from the note or the session, which removes the whole
-- record (erasure, a verifier's fixture) rather than rewriting part of it. A
-- cascade runs inside the foreign key's own trigger, so it arrives at depth 2+.
CREATE OR REPLACE FUNCTION "note_addenda_append_only"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'note_addenda is append only: write a new addendum'
    USING ERRCODE = '0A000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "note_addenda_no_rewrite" ON "note_addenda";
CREATE TRIGGER "note_addenda_no_rewrite"
  BEFORE UPDATE OR DELETE ON "note_addenda"
  FOR EACH ROW EXECUTE FUNCTION "note_addenda_append_only"();

-- 2. The lock on the note itself, enforced by the database.
--
-- The chart and the patient's copy share one JSON column, so the rule is per
-- half: once `status` is approved, nothing outside the three patient fields may
-- change; once `patient_status` is approved, those three may not. A draft is
-- untouched by this, and so is every other column (the translation, the
-- provenance, the approval stamps).
CREATE OR REPLACE FUNCTION "session_notes_signed_lock"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'approved'
     AND (NEW."content" - 'patientBrief' - 'patientSteps' - 'patientNext')
         IS DISTINCT FROM (OLD."content" - 'patientBrief' - 'patientSteps' - 'patientNext') THEN
    RAISE EXCEPTION 'session_notes: the clinical note is signed, add an addendum'
      USING ERRCODE = '0A000';
  END IF;
  IF OLD."patient_status" = 'approved'
     AND (NEW."content"->'patientBrief', NEW."content"->'patientSteps', NEW."content"->'patientNext')
         IS DISTINCT FROM (OLD."content"->'patientBrief', OLD."content"->'patientSteps', OLD."content"->'patientNext') THEN
    RAISE EXCEPTION 'session_notes: the patient copy is released, add an addendum'
      USING ERRCODE = '0A000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "session_notes_signed_lock" ON "session_notes";
CREATE TRIGGER "session_notes_signed_lock"
  BEFORE UPDATE ON "session_notes"
  FOR EACH ROW EXECUTE FUNCTION "session_notes_signed_lock"();
