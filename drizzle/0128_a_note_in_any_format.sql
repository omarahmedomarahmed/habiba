-- W2-F01 / D7: notes in any format, all in the session price, all on the history.
--
-- The founder's decision: SOAP, DAP, BIRP, GIRP, PIE, SIRP, narrative and a
-- clinician's own templates. A format is data (a key, a label, ordered sections
-- each with a guide), so a new one needs no migration. Each format is its own
-- document with today's lifecycle: draft, signed, then locked with addenda
-- (0116). Nothing here touches an invoice: the session's lines are priced from
-- consent and tier (`sessionLines`), never from how many notes it has.
--
-- Additive. Every note already stored becomes a `soap` note and the session's
-- primary one, which is exactly what it was. The old one-note-per-session index
-- is dropped by 0129, apart, because the running deployment still upserts on it.

-- 1. The format a note is written in, and the note that stands for the session.
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "format" text DEFAULT 'soap' NOT NULL;
--> statement-breakpoint
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "is_primary" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_format_known"
    CHECK ("format" ~ '^([a-z]{2,16}|tpl:[0-9a-f-]{36})$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- One note per format per session. The primary is unique per session, and so
-- is a released patient copy: the patient's plain-language copy stays one per
-- session whatever number of formats the chart is written in.
CREATE UNIQUE INDEX IF NOT EXISTS "session_notes_session_format_unique"
  ON "session_notes" ("session_id", "format");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_notes_one_primary"
  ON "session_notes" ("session_id") WHERE "is_primary";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_notes_one_patient_copy"
  ON "session_notes" ("session_id") WHERE "patient_status" = 'approved';
--> statement-breakpoint

-- A note's format is fixed once written. Its sections sit under the content
-- lock of 0116; the key that says what they mean is held here.
CREATE OR REPLACE FUNCTION "session_notes_format_fixed"() RETURNS trigger AS $$
BEGIN
  IF NEW."format" IS DISTINCT FROM OLD."format" THEN
    RAISE EXCEPTION 'session_notes: a note keeps its format, write another'
      USING ERRCODE = '0A000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "session_notes_format_fixed" ON "session_notes";
--> statement-breakpoint
CREATE TRIGGER "session_notes_format_fixed"
  BEFORE UPDATE ON "session_notes"
  FOR EACH ROW EXECUTE FUNCTION "session_notes_format_fixed"();
--> statement-breakpoint

-- 2. A clinician's own formats. Archived, never deleted, so a template's id in
-- `session_notes.format` never points at a row that is gone; the note carries
-- its own headings either way.
CREATE TABLE IF NOT EXISTS "note_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "sections" jsonb NOT NULL,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "note_templates_user" ON "note_templates" ("user_id", "created_at");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "note_templates" ADD CONSTRAINT "note_templates_label_short"
    CHECK (btrim("label") <> '' AND length("label") <= 40);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "note_templates" ADD CONSTRAINT "note_templates_sections_list"
    CHECK (jsonb_typeof("sections") = 'array'
           AND jsonb_array_length("sections") BETWEEN 1 AND 8);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- 3. The format a clinician's notes are drafted in.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "note_format" text DEFAULT 'soap' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_note_format_known"
    CHECK ("note_format" ~ '^([a-z]{2,16}|tpl:[0-9a-f-]{36})$');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
