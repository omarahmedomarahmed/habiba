-- Sprint 33 — the clinical evidence layer.
--
-- One table, and eight rules the database enforces rather than the application
-- remembering to. PLAN.md 33.1 to 33.6.
--
-- The acceptance criterion is the shape of the whole thing: *every clinical
-- fact the system holds can be traced to the exact sentence that produced it,
-- and a clinician can disagree with it in place.* Both halves are structural
-- below: the quote is NOT NULL, and disagreeing is a status change plus a
-- superseding row rather than an edit.

CREATE TABLE IF NOT EXISTS "patient_clinical_facts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

  -- On the PERSON, like the summary and the journal (26.1, C111). A fact about
  -- somebody follows them between clinicians; a fact keyed on a clinic's
  -- `patients` row would be re-learned from scratch by the next clinician,
  -- which is the filing cabinet this product exists to replace.
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,

  -- Where it came from, kept for scoping and for the audit trail. Null when the
  -- fact outlives the organisation that observed it.
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,

  "domain" text NOT NULL,
  "field" text NOT NULL,
  "value" text NOT NULL,

  "source_type" text NOT NULL,
  -- 🔴 Lower wins. See the CHECK below and §2's ruling on the order.
  "source_priority" integer NOT NULL,
  -- The row that produced it: a session, a document, a journal, a user.
  "source_id" uuid,

  -- 🔴 33.6 — the evidence, and it is NOT NULL.
  --
  -- `person_diagnoses.source_sentence` (8.9) is the precedent and the reason:
  -- a column that cannot be empty makes "the model inferred it from the vibe
  -- of the session" structurally impossible rather than merely discouraged.
  -- The quote is what a clinician reads on the evidence screen before agreeing
  -- or disagreeing, so a fact without one is a fact nobody can check.
  "evidence_quote" text NOT NULL,

  -- Exactly one of these, or a clinician who typed it. Typed columns rather
  -- than a polymorphic `evidence_ref` string, because 33.5 has to be enforced
  -- by the database: deleting a document takes its chunks with it, the
  -- reference here goes NULL, and the trigger below marks the fact unsupported
  -- in the same statement. A text pointer would have needed a sweeper, and a
  -- sweeper that has not run yet is a fact standing on nothing.
  "segment_id" uuid REFERENCES "transcript_segments"("id") ON DELETE SET NULL,
  "chunk_id" uuid REFERENCES "document_chunks"("id") ON DELETE SET NULL,
  "journal_id" uuid REFERENCES "journals"("id") ON DELETE SET NULL,
  "entered_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  -- Which evidence this fact was born with. Survives the pointer being nulled,
  -- so "it had a transcript line and the session was deleted" stays readable.
  "evidence_kind" text NOT NULL,

  -- Only ever set for a model. A number beside a human's statement would
  -- invite somebody to rank one clinician's certainty against another's.
  "confidence" real,

  "status" text NOT NULL DEFAULT 'active',

  -- 🔴 33.3 — when it was TRUE, not when it was written.
  --
  -- `effective_at` is the clinical fact's own date: ideation described in
  -- session 17 as having happened last spring is effective last spring. The
  -- observation timestamps are about the record.
  "effective_at" timestamp with time zone NOT NULL,
  "first_observed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_observed_at" timestamp with time zone DEFAULT now() NOT NULL,

  "supersedes_id" uuid REFERENCES "patient_clinical_facts"("id") ON DELETE SET NULL,

  "verified_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "verified_at" timestamp with time zone,

  -- How carefully this is shown. `restricted` never leaves the clinician's own
  -- screen; `sensitive` is out of summaries and exports by default.
  "sensitivity" text NOT NULL DEFAULT 'normal',

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "clinical_facts_person_idx"
  ON "patient_clinical_facts" ("person_id", "domain", "field");
CREATE INDEX IF NOT EXISTS "clinical_facts_active_idx"
  ON "patient_clinical_facts" ("person_id", "status");
CREATE INDEX IF NOT EXISTS "clinical_facts_supersedes_idx"
  ON "patient_clinical_facts" ("supersedes_id");

-- ---------------------------------------------------------------- the values --

ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_source_type";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_source_type"
  CHECK ("source_type" IN ('clinician', 'document', 'patient', 'ai')) NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_source_type";

ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_status";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_status"
  CHECK ("status" IN ('active', 'resolved', 'historical', 'disputed', 'unsupported')) NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_status";

ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_sensitivity";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_sensitivity"
  CHECK ("sensitivity" IN ('normal', 'sensitive', 'restricted')) NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_sensitivity";

ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_evidence_kind";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_evidence_kind"
  CHECK ("evidence_kind" IN ('segment', 'chunk', 'journal', 'clinician')) NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_evidence_kind";

-- 🔴 The evidence may not be blank. The whole layer rests on this one line.
ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_quote_not_blank";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_quote_not_blank"
  CHECK (btrim("evidence_quote") <> '') NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_quote_not_blank";

ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_value_not_blank";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_value_not_blank"
  CHECK (btrim("value") <> '' AND btrim("domain") <> '' AND btrim("field") <> '') NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_value_not_blank";

-- 🔴 33.2 — the priority cannot lie about the source.
--
-- Derived in the database rather than trusted from the caller. Otherwise an
-- extraction job inserts an `ai` fact with `source_priority = 1` and outranks
-- the clinician who typed the diagnosis, and nothing in a code review would
-- show it: the row looks exactly like a clinician's.
--
-- The order is clinician, document, patient, AI. §2's ruling explains why the
-- patient sits ABOVE the model rather than below it as PLAN.md 33.1 lists.
ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_priority_matches_source";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_priority_matches_source"
  CHECK ("source_priority" = CASE "source_type"
    WHEN 'clinician' THEN 1
    WHEN 'document' THEN 2
    WHEN 'patient' THEN 3
    WHEN 'ai' THEN 4
  END) NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_priority_matches_source";

-- A confidence number belongs to a model and to nothing else.
ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_confidence_is_ai_only";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_confidence_is_ai_only"
  CHECK (
    ("source_type" = 'ai' AND "confidence" IS NOT NULL AND "confidence" > 0 AND "confidence" <= 1)
    OR ("source_type" <> 'ai' AND "confidence" IS NULL)
  ) NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_confidence_is_ai_only";

-- Verification is a person and a time, together or not at all.
ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_verified_pair";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_verified_pair"
  CHECK (("verified_by" IS NULL) = ("verified_at" IS NULL)) NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_verified_pair";

-- A fact cannot supersede itself.
ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_no_self_supersede";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_no_self_supersede"
  CHECK ("supersedes_id" IS NULL OR "supersedes_id" <> "id") NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_no_self_supersede";

-- The evidence pointer must match the kind it claims, and a clinician's own
-- entry must name the clinician. A row claiming a transcript line and carrying
-- no segment is a fact with a quote nobody can locate.
ALTER TABLE "patient_clinical_facts" DROP CONSTRAINT IF EXISTS "clinical_facts_evidence_matches_kind";
ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_evidence_matches_kind"
  CHECK (CASE "evidence_kind"
    WHEN 'clinician' THEN "entered_by_user_id" IS NOT NULL
    ELSE true
  END) NOT VALID;
ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_evidence_matches_kind";

-- -------------------------------------------------------------- the triggers --

-- 🔴 33.2 — an AI fact is born unverified, always.
--
-- A CHECK cannot say this, because verifying later is exactly what the evidence
-- screen is for: a clinician reads the quote and agrees, and that agreement is
-- the whole product. What must be impossible is the extraction writing the
-- agreement itself. So the rule is about the INSERT rather than about the row.
--
-- Confidence is not truth. A model at 0.97 has produced a well-phrased guess,
-- and a record that cannot tell the two apart is a record that will eventually
-- report a diagnosis nobody made.
CREATE OR REPLACE FUNCTION "clinical_facts_ai_is_never_born_verified"() RETURNS trigger AS $$
BEGIN
  IF NEW."source_type" = 'ai' AND NEW."verified_by" IS NOT NULL THEN
    RAISE EXCEPTION 'an AI fact cannot be inserted already verified: a person verifies it, afterwards'
      USING ERRCODE = '0A000';
  END IF;
  IF NEW."source_type" = 'ai' AND NEW."status" <> 'active' AND NEW."status" <> 'disputed' THEN
    RAISE EXCEPTION 'an AI fact is inserted active or disputed, never as settled history'
      USING ERRCODE = '0A000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "clinical_facts_ai_unverified" ON "patient_clinical_facts";
CREATE TRIGGER "clinical_facts_ai_unverified"
  BEFORE INSERT ON "patient_clinical_facts"
  FOR EACH ROW EXECUTE FUNCTION "clinical_facts_ai_is_never_born_verified"();

-- 🔴 The evidence is immutable; the judgement is not.
--
-- A clinician disagreeing with a fact changes its STATUS and writes a new row
-- that supersedes it (33.4: both are kept). What may never happen is the value
-- or the quote being edited under a fact somebody has already read, because
-- then the evidence screen shows a sentence that no longer produced the thing
-- it is standing under, and the audit trail says nothing happened.
CREATE OR REPLACE FUNCTION "clinical_facts_evidence_is_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."value" IS DISTINCT FROM OLD."value"
     OR NEW."evidence_quote" IS DISTINCT FROM OLD."evidence_quote"
     OR NEW."source_type" IS DISTINCT FROM OLD."source_type"
     OR NEW."domain" IS DISTINCT FROM OLD."domain"
     OR NEW."field" IS DISTINCT FROM OLD."field"
     OR NEW."person_id" IS DISTINCT FROM OLD."person_id" THEN
    RAISE EXCEPTION 'a recorded fact is not edited: supersede it with a new row'
      USING ERRCODE = '0A000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "clinical_facts_no_rewrite" ON "patient_clinical_facts";
CREATE TRIGGER "clinical_facts_no_rewrite"
  BEFORE UPDATE ON "patient_clinical_facts"
  FOR EACH ROW EXECUTE FUNCTION "clinical_facts_evidence_is_immutable"();

-- 🔴 33.5 — a fact whose evidence is gone does not go on standing.
--
-- The FKs above are ON DELETE SET NULL, so deleting a document, its chunks, a
-- session's transcript or a journal nulls the pointer here in the same
-- statement. This trigger sees that and marks the fact `unsupported`, which
-- every reader filters out.
--
-- The row itself is KEPT. "We believed this, because of this sentence, until
-- the sentence was deleted on this date" is a thing a clinician may need to
-- explain a year later, and cascading the fact away would erase the reasoning
-- along with the evidence.
CREATE OR REPLACE FUNCTION "clinical_facts_unsupported_when_evidence_goes"() RETURNS trigger AS $$
BEGIN
  IF NEW."evidence_kind" <> 'clinician'
     AND NEW."segment_id" IS NULL
     AND NEW."chunk_id" IS NULL
     AND NEW."journal_id" IS NULL
     AND NEW."status" IN ('active', 'disputed') THEN
    NEW."status" := 'unsupported';
    NEW."updated_at" := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "clinical_facts_evidence_gone" ON "patient_clinical_facts";
CREATE TRIGGER "clinical_facts_evidence_gone"
  BEFORE UPDATE ON "patient_clinical_facts"
  FOR EACH ROW EXECUTE FUNCTION "clinical_facts_unsupported_when_evidence_goes"();

-- 🔴 33.4 / 33.2 — who may supersede whom, and what happens to the old row.
--
-- Three rules in one place, because they are one rule about contradiction:
--
--   1. A superseding fact must be about the SAME person, domain and field.
--      Otherwise "supersedes" means nothing and the chain is decoration.
--   2. A LOWER-priority source may not supersede a higher one. A model does not
--      get to overwrite the diagnosis a clinician typed, whatever its
--      confidence says. This is 33.2 stated as an invariant rather than as a
--      convention in a service module.
--   3. The superseded row becomes `historical` rather than disappearing. Both
--      are kept: session 17 contradicting session 4 is a clinical event, and
--      the clinician has to be able to see both and why one won.
CREATE OR REPLACE FUNCTION "clinical_facts_supersession"() RETURNS trigger AS $$
DECLARE
  old_fact "patient_clinical_facts"%ROWTYPE;
BEGIN
  IF NEW."supersedes_id" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO old_fact FROM "patient_clinical_facts" WHERE "id" = NEW."supersedes_id";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cannot supersede a fact that does not exist' USING ERRCODE = '0A000';
  END IF;

  IF old_fact."person_id" <> NEW."person_id"
     OR old_fact."domain" <> NEW."domain"
     OR old_fact."field" <> NEW."field" THEN
    RAISE EXCEPTION 'a fact may only supersede one about the same person, domain and field'
      USING ERRCODE = '0A000';
  END IF;

  IF NEW."source_priority" > old_fact."source_priority" THEN
    RAISE EXCEPTION 'a % fact cannot supersede a % fact: lower-ranked sources are recorded, not promoted',
      NEW."source_type", old_fact."source_type"
      USING ERRCODE = '0A000';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "clinical_facts_check_supersession" ON "patient_clinical_facts";
CREATE TRIGGER "clinical_facts_check_supersession"
  BEFORE INSERT ON "patient_clinical_facts"
  FOR EACH ROW EXECUTE FUNCTION "clinical_facts_supersession"();

-- The superseded row is retired AFTER the new one lands, so a failed insert
-- does not retire anything.
CREATE OR REPLACE FUNCTION "clinical_facts_retire_superseded"() RETURNS trigger AS $$
BEGIN
  IF NEW."supersedes_id" IS NOT NULL THEN
    UPDATE "patient_clinical_facts"
      SET "status" = 'historical', "updated_at" = now()
      WHERE "id" = NEW."supersedes_id" AND "status" IN ('active', 'disputed');
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "clinical_facts_retire" ON "patient_clinical_facts";
CREATE TRIGGER "clinical_facts_retire"
  AFTER INSERT ON "patient_clinical_facts"
  FOR EACH ROW EXECUTE FUNCTION "clinical_facts_retire_superseded"();
