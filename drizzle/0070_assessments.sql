-- Sprint 56 — assessments. The structured signal a transcript cannot produce.
--
-- 🔴 Additive. H16: nothing applies migrations on deploy, so this runs against
-- production before main moves.

-- 🔴 56.1 / 56.2 — an instrument is CONTENT, so a new one is added without a
-- deploy. The licence is a column rather than a convention.
CREATE TABLE IF NOT EXISTS "instruments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "name" jsonb NOT NULL,
  "attribution" text NOT NULL,
  "licence" text NOT NULL,
  -- 56.11 — the languages this instrument publishes in, stated rather than
  -- inferred. The first version of the constraint below counted the keys of
  -- `name` with a subquery, which Postgres refuses in a CHECK and which was a
  -- proxy anyway: an instrument's NAME being English-only says nothing about
  -- its questions. An explicit column is something the publish path sets on
  -- purpose and a constraint can read without guessing.
  "locales" text[] DEFAULT ARRAY['en']::text[] NOT NULL,
  "questions" jsonb NOT NULL,
  "bands" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "translation_reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "translation_reviewed_at" timestamp with time zone,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "instruments_key_version"
  ON "instruments" ("key", "version");

-- 🔴 56.2 / C278 — A LICENSED INSTRUMENT CANNOT BE PUBLISHED.
--
-- PHQ-9 and GAD-7 are free to use. Beck's inventories, the Y-BOCS and most of
-- the rest are licensed and cost money per administration. Shipping one
-- without a licence is not a product decision, it is copyright infringement
-- inside a clinical record, and the person who would discover it is a
-- publisher's lawyer rather than a tester.
--
-- The row may EXIST unpublished, waiting for paperwork. It cannot reach a
-- patient. Enforced here rather than in a service because "we only ship free
-- instruments" is precisely the kind of rule that survives until the first
-- person who wants a particular instrument badly enough.
ALTER TABLE "instruments"
  DROP CONSTRAINT IF EXISTS "instruments_free_only";

ALTER TABLE "instruments"
  ADD CONSTRAINT "instruments_free_only"
  CHECK (
    "published_at" IS NULL
    OR "licence" IN ('public_domain', 'free_with_attribution')
  );

-- 🔴 56.11 — a person publishes the translation.
--
-- "Clinical Arabic is a different register and the AI may draft it, but a
-- person publishes." A mistranslated instrument is not a typo: it changes what
-- is being measured, and the score goes onto a chart and stays there.
--
-- `locales` says which languages this instrument publishes in. Publishing one
-- that is English-only needs no reviewer; publishing one with any other
-- language needs a named person who read it.
ALTER TABLE "instruments"
  DROP CONSTRAINT IF EXISTS "instruments_translation_reviewed";

ALTER TABLE "instruments"
  ADD CONSTRAINT "instruments_translation_reviewed"
  CHECK (
    "published_at" IS NULL
    OR "locales" <@ ARRAY['en']::text[]
    OR "translation_reviewed_by" IS NOT NULL
  );

-- 56.4 / 56.5 / 56.6 — one instrument, given to one person, once.
CREATE TABLE IF NOT EXISTS "assessment_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "instrument_id" uuid NOT NULL REFERENCES "instruments"("id") ON DELETE restrict,
  "patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE cascade,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE cascade,
  "assigned_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "session_id" uuid REFERENCES "sessions"("id") ON DELETE set null,
  "mode" text NOT NULL,
  "status" text DEFAULT 'assigned' NOT NULL,
  "score" integer,
  "instrument_version" integer DEFAULT 1 NOT NULL,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "assessment_assignments_patient_idx"
  ON "assessment_assignments" ("patient_id", "created_at");
CREATE INDEX IF NOT EXISTS "assessment_assignments_session_idx"
  ON "assessment_assignments" ("session_id");
CREATE INDEX IF NOT EXISTS "assessment_assignments_status_idx"
  ON "assessment_assignments" ("status", "updated_at");

-- 🔴 56.7 — one answer, and how long it took.
--
-- The timing is the point. A transcript says what somebody said; it cannot say
-- that they answered eight questions in four seconds each and then sat on
-- "thoughts that you would be better off dead" for ninety. That hesitation is
-- clinical information no conversation reliably surfaces, and the only way to
-- lose it is not to record it.
CREATE TABLE IF NOT EXISTS "assessment_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "assignment_id" uuid NOT NULL REFERENCES "assessment_assignments"("id") ON DELETE cascade,
  "question_key" text NOT NULL,
  "value" integer NOT NULL,
  "answer_ms" integer,
  "answered_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- One answer per question. A patient changing their mind UPDATES; two rows for
-- one question double-count in the score, and the score reaches a chart.
CREATE UNIQUE INDEX IF NOT EXISTS "assessment_responses_unique"
  ON "assessment_responses" ("assignment_id", "question_key");

-- 56.10 — a score is a clinical fact with provenance, like every other since 33.
ALTER TABLE "patient_clinical_facts"
  ADD COLUMN IF NOT EXISTS "assessment_id" uuid;

-- 🔴 `assessment` must be ALLOWED before it can be BOUNDED.
--
-- The first draft of this migration added 'assessment' to FACT_EVIDENCE_KINDS
-- in schema.ts and wrote the conclusion bound below, and never touched this
-- enumeration from 0062. Every assessment-sourced fact was refused — not by
-- the bound, by the list — so 56.10 was dead and the 56.8 check passed for the
-- wrong reason: the write it expected to be refused WAS refused, by a rule
-- that was also refusing the writes that are supposed to succeed.
--
-- It was caught by a CONTROL asserting that a score can still be cited. That
-- is the §6 family, and the CONTROL is the only reason this line exists.
ALTER TABLE "patient_clinical_facts"
  DROP CONSTRAINT IF EXISTS "clinical_facts_evidence_kind";

ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "clinical_facts_evidence_kind"
  CHECK ("evidence_kind" IN ('segment', 'chunk', 'journal', 'clinician', 'assessment')) NOT VALID;

ALTER TABLE "patient_clinical_facts" VALIDATE CONSTRAINT "clinical_facts_evidence_kind";

-- 🔴 56.8 — C214's bound, in a second costume, on the same constraint.
--
-- The copilot may cite a score and its date. It may never turn a score into a
-- conclusion about the person. A PHQ-9 of 19 is a number somebody chose nine
-- answers to produce; "moderately severe depression" is a diagnosis, and a
-- diagnosis reached by arithmetic from a questionnaire, written into a chart
-- by a machine, is exactly the anchoring C214 exists to prevent.
--
-- Extends `facts_journal_never_concludes` rather than adding a second
-- constraint, because one rule about what evidence may conclude is easier to
-- keep true than two.
ALTER TABLE "patient_clinical_facts"
  DROP CONSTRAINT IF EXISTS "facts_journal_never_concludes";

ALTER TABLE "patient_clinical_facts"
  ADD CONSTRAINT "facts_journal_never_concludes"
  CHECK (
    "evidence_kind" NOT IN ('journal', 'assessment')
    OR "domain" NOT IN ('diagnosis', 'risk')
  );
