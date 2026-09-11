-- Sprint 35 — risk intelligence.
--
-- Additive, and deliberately small. 35.3 says persistence, dedup, notification
-- and the sweeper cron survive untouched, so `risk_assessments` keeps every
-- column and every index it had; this adds the structure the classifier
-- produces beside them.

-- 🔴 The findings, with the sentence that produced each one.
--
-- `indicators` (text[]) stays exactly as it was and still holds the matched
-- phrases, because the keyword floor still writes it and every reader of it
-- keeps working. What it cannot hold is EVIDENCE: an indicator with the line
-- that shows it, and the model's own confidence in having found it.
--
-- A clinician reading an alert needs the quote more than the label. "ideation"
-- on its own is a word a system produced; "ideation, because he said *I just
-- want to go to sleep and not wake up*" is a thing a person can act on, argue
-- with, or recognise as a misread of an idiom. This is 33.1's rule arriving in
-- the risk table: no quote, no finding.
ALTER TABLE "risk_assessments"
  ADD COLUMN IF NOT EXISTS "findings" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- Which model said so. A risk record that outlives a model upgrade and cannot
-- say which version produced it is a record nobody can audit backwards.
ALTER TABLE "risk_assessments"
  ADD COLUMN IF NOT EXISTS "model" text;

-- 🔴 How many findings were DROPPED for quoting something the transcript does
-- not contain.
--
-- Recorded rather than discarded, because it is invisible by construction: a
-- dropped finding leaves no trace in the output, so without this column the
-- rate at which the classifier invents a sentence is a number nobody has. It
-- is the same argument as the straddle count in diarisation (3.4), and it is
-- the first thing to look at when a model is swapped.
ALTER TABLE "risk_assessments"
  ADD COLUMN IF NOT EXISTS "unquoted_findings" integer DEFAULT 0 NOT NULL;

-- A model row must say which model. A keyword row must not pretend to.
--
-- Validated immediately, like every other constraint in this repository: every
-- existing row is `source = 'keyword'` with a NULL model, so the backlog is
-- empty, and `VALIDATE CONSTRAINT` takes a SHARE UPDATE EXCLUSIVE lock that
-- does not block the reads or writes the transcript path makes during a live
-- session. That is the whole reason the NOT VALID / VALIDATE pair exists.
ALTER TABLE "risk_assessments" DROP CONSTRAINT IF EXISTS "risk_assessments_model_named";
ALTER TABLE "risk_assessments"
  ADD CONSTRAINT "risk_assessments_model_named"
  CHECK (("source" = 'model') = ("model" IS NOT NULL)) NOT VALID;
ALTER TABLE "risk_assessments" VALIDATE CONSTRAINT "risk_assessments_model_named";

-- The dropped count belongs to a model row and nothing else.
ALTER TABLE "risk_assessments" DROP CONSTRAINT IF EXISTS "risk_assessments_unquoted_is_model_only";
ALTER TABLE "risk_assessments"
  ADD CONSTRAINT "risk_assessments_unquoted_is_model_only"
  CHECK ("source" = 'model' OR "unquoted_findings" = 0) NOT VALID;
ALTER TABLE "risk_assessments" VALIDATE CONSTRAINT "risk_assessments_unquoted_is_model_only";
