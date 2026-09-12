-- Sprint 37 — the voices of a recording, and the refusal to name them.
--
-- 🔴 37.2 says an unrecognised voice is "Speaker 3", never a guess, and 37.3
-- says N speakers with no invented identities. Sprint 36's finding was that a
-- rule which lives in a service is a convention, so both are put where they
-- cannot be forgotten: in the columns that exist, the columns that do not, and
-- a trigger that refuses the write.

-- 🔴 One row per distinct voice in one session's recording.
--
-- What is deliberately ABSENT is the point of the table:
--
--   - There is **no display name, alias or nickname column.** A voice's label
--     on screen is either the person the session record already names, or
--     "Speaker N" computed from `ordinal`. There is nowhere to type "Mum", and
--     nowhere for a meeting provider's participant name to land — 41.5, two
--     sprints early: identity comes from the session we created, never from a
--     display name.
--   - `bound_by` has **no value meaning "a model decided"**. The only two ways
--     a voice acquires a person are `track` (the recording already knew,
--     because a video session captured two tracks) and `operator` (a named
--     human said so, with their id and the date on the row). A schema that
--     cannot express an inferred identity is a schema in which 37.2 cannot
--     quietly stop being true.
CREATE TABLE IF NOT EXISTS "session_voices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE RESTRICT,

  -- The provider's opaque label for this voice: "spk_0", "B", "2".
  "label" text NOT NULL,

  -- 1-based position in the order the voices are first heard. "Speaker 3" is
  -- the third voice in the room, counted the way a person reading the
  -- transcript counts.
  "ordinal" integer NOT NULL,

  -- NULL is the normal, permanent, honest outcome for a voice nothing proves.
  "role" text,
  "patient_id" uuid REFERENCES "patients"("id") ON DELETE RESTRICT,
  "bound_by" text,
  "bound_by_user_id" uuid REFERENCES "users"("id") ON DELETE RESTRICT,
  "bound_at" timestamp with time zone,

  -- Speaking time, so a clinician can see that "Speaker 3" said four minutes.
  "speaking_ms" integer DEFAULT 0 NOT NULL,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_voices_label_unique"
  ON "session_voices" ("session_id", "label");

-- Two voices cannot be the same speaker number.
CREATE UNIQUE INDEX IF NOT EXISTS "session_voices_ordinal_unique"
  ON "session_voices" ("session_id", "ordinal");

-- One clinician per session, so two voices cannot both be the therapist.
-- Patients are NOT constrained this way: a couples session has two of them.
CREATE UNIQUE INDEX IF NOT EXISTS "session_voices_one_therapist"
  ON "session_voices" ("session_id")
  WHERE "role" = 'therapist';

-- ...but one named patient cannot be two voices either.
CREATE UNIQUE INDEX IF NOT EXISTS "session_voices_patient_unique"
  ON "session_voices" ("session_id", "patient_id")
  WHERE "patient_id" IS NOT NULL;

ALTER TABLE "session_voices" DROP CONSTRAINT IF EXISTS "session_voices_role";
ALTER TABLE "session_voices"
  ADD CONSTRAINT "session_voices_role"
  CHECK ("role" IS NULL OR "role" IN ('therapist', 'patient')) NOT VALID;
ALTER TABLE "session_voices" VALIDATE CONSTRAINT "session_voices_role";

-- 🔴 The enum with the missing value. There is no 'model', no 'inferred', no
-- 'auto'. Adding one is a migration with somebody's name on it.
ALTER TABLE "session_voices" DROP CONSTRAINT IF EXISTS "session_voices_bound_by";
ALTER TABLE "session_voices"
  ADD CONSTRAINT "session_voices_bound_by"
  CHECK ("bound_by" IS NULL OR "bound_by" IN ('track', 'operator')) NOT VALID;
ALTER TABLE "session_voices" VALIDATE CONSTRAINT "session_voices_bound_by";

-- A voice has a person AND how we know AND when, or it has none of the three.
ALTER TABLE "session_voices" DROP CONSTRAINT IF EXISTS "session_voices_binding_is_whole";
ALTER TABLE "session_voices"
  ADD CONSTRAINT "session_voices_binding_is_whole"
  CHECK (
    ("role" IS NULL) = ("bound_by" IS NULL)
    AND ("role" IS NULL) = ("bound_at" IS NULL)
  ) NOT VALID;
ALTER TABLE "session_voices" VALIDATE CONSTRAINT "session_voices_binding_is_whole";

-- A human's say-so is a named human's say-so.
ALTER TABLE "session_voices" DROP CONSTRAINT IF EXISTS "session_voices_operator_is_named";
ALTER TABLE "session_voices"
  ADD CONSTRAINT "session_voices_operator_is_named"
  CHECK ("bound_by" <> 'operator' OR "bound_by_user_id" IS NOT NULL) NOT VALID;
ALTER TABLE "session_voices" VALIDATE CONSTRAINT "session_voices_operator_is_named";

-- A patient id belongs to a patient voice, and a therapist is not a patient.
ALTER TABLE "session_voices" DROP CONSTRAINT IF EXISTS "session_voices_patient_is_patient";
ALTER TABLE "session_voices"
  ADD CONSTRAINT "session_voices_patient_is_patient"
  CHECK ("patient_id" IS NULL OR "role" = 'patient') NOT VALID;
ALTER TABLE "session_voices" VALIDATE CONSTRAINT "session_voices_patient_is_patient";

ALTER TABLE "session_voices" DROP CONSTRAINT IF EXISTS "session_voices_ordinal_positive";
ALTER TABLE "session_voices"
  ADD CONSTRAINT "session_voices_ordinal_positive"
  CHECK ("ordinal" >= 1) NOT VALID;
ALTER TABLE "session_voices" VALIDATE CONSTRAINT "session_voices_ordinal_positive";

-- 🔴 Which voice said this line. Additive and nullable: every row written
-- before this sprint, and every row from a two-track capture that needs no
-- diarisation at all, has no voice and is unaffected.
ALTER TABLE "transcript_segments" ADD COLUMN IF NOT EXISTS "voice_id" uuid
  REFERENCES "session_voices"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "transcript_segments_voice_idx"
  ON "transcript_segments" ("voice_id")
  WHERE "voice_id" IS NOT NULL;

-- 🔴 37.2 AS A CONSTRAINT: an unrecognised voice cannot be written as a person.
--
-- The rule a service would hold is "when the voice has no role, write
-- 'unknown'". Here the database refuses the row instead, so the rule survives
-- the next author, the next path into this table, and sprint 41's bot:
--
--   - a line on a voice nothing proves must say `unknown`;
--   - a line on a bound voice may say `unknown` (refusing is always allowed)
--     or that voice's own role, and nothing else;
--   - a line cannot point at a voice from a different session at all.
--
-- The cost is one primary-key lookup per row, and only for rows that carry a
-- voice: the ingest path writes `voice_id` NULL and returns on the first line
-- of the function.
CREATE OR REPLACE FUNCTION "transcript_segments_voice_agrees"() RETURNS trigger AS $$
DECLARE
  v_role text;
  v_session uuid;
BEGIN
  IF NEW."voice_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "role", "session_id" INTO v_role, v_session
    FROM "session_voices" WHERE "id" = NEW."voice_id";

  IF v_session IS DISTINCT FROM NEW."session_id" THEN
    RAISE EXCEPTION 'a transcript line cannot point at a voice from another session'
      USING ERRCODE = '23514';
  END IF;

  IF v_role IS NULL AND NEW."speaker" <> 'unknown' THEN
    RAISE EXCEPTION 'an unrecognised voice is a numbered speaker, never a person: line claims %', NEW."speaker"
      USING ERRCODE = '23514';
  END IF;

  IF v_role IS NOT NULL AND NEW."speaker" <> 'unknown' AND NEW."speaker" <> v_role THEN
    RAISE EXCEPTION 'this line claims % but its voice is bound to %', NEW."speaker", v_role
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "transcript_segments_voice_agrees" ON "transcript_segments";
CREATE TRIGGER "transcript_segments_voice_agrees"
  BEFORE INSERT OR UPDATE ON "transcript_segments"
  FOR EACH ROW EXECUTE FUNCTION "transcript_segments_voice_agrees"();

-- 🔴 A voice's identity is fixed, and unbinding takes the name off the lines.
--
-- The label and the ordinal are what "Speaker 3" means, so they cannot move
-- after anybody has read them. The role may be set once from nothing and may
-- be taken away — a mistake must be correctable — but it may never be swapped
-- straight from one person to another, which is the shape of a correction
-- nobody reviewed.
--
-- And when a voice IS unbound, every line that named that person is put back
-- to `unknown` in the same statement. Otherwise the moment after somebody
-- admits they were wrong about a voice, the transcript still says they were
-- right, and 37.2 would be true only of new rows.
CREATE OR REPLACE FUNCTION "session_voices_identity_is_fixed"() RETURNS trigger AS $$
BEGIN
  IF NEW."session_id" IS DISTINCT FROM OLD."session_id"
     OR NEW."label" IS DISTINCT FROM OLD."label"
     OR NEW."ordinal" IS DISTINCT FROM OLD."ordinal" THEN
    RAISE EXCEPTION 'a voice keeps its label and its number for the life of the recording'
      USING ERRCODE = '0A000';
  END IF;

  IF OLD."role" IS NOT NULL AND NEW."role" IS NOT NULL AND NEW."role" IS DISTINCT FROM OLD."role" THEN
    RAISE EXCEPTION 'unbind this voice before binding it to somebody else'
      USING ERRCODE = '0A000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "session_voices_no_repoint" ON "session_voices";
CREATE TRIGGER "session_voices_no_repoint"
  BEFORE UPDATE ON "session_voices"
  FOR EACH ROW EXECUTE FUNCTION "session_voices_identity_is_fixed"();

CREATE OR REPLACE FUNCTION "session_voices_unbind_clears_lines"() RETURNS trigger AS $$
BEGIN
  IF OLD."role" IS NOT NULL AND NEW."role" IS NULL THEN
    UPDATE "transcript_segments"
      SET "speaker" = 'unknown'
      WHERE "voice_id" = NEW."id" AND "speaker" <> 'unknown';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "session_voices_unbind_clears_lines" ON "session_voices";
CREATE TRIGGER "session_voices_unbind_clears_lines"
  AFTER UPDATE ON "session_voices"
  FOR EACH ROW EXECUTE FUNCTION "session_voices_unbind_clears_lines"();
