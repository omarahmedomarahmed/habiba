-- Two signatures on a note instead of one, and a way to nudge an unrated
-- session exactly once.
--
-- The clinical record and the patient's copy were approved by the same button,
-- which forced one decision to wait on the other. They are separate columns
-- now: `status` still means "this is a document", and `patient_status` means
-- "this is what I am content for them to read".

ALTER TABLE "session_notes"
  ADD COLUMN IF NOT EXISTS "patient_status" text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS "patient_approved_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "patient_approved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Backfill.
--
-- Every note already approved was approved under the old rule, where signing
-- released the brief. Leaving those at 'draft' would retract a decision the
-- clinician already made — and, worse, would silently stop a brief that is
-- sitting waiting for a patient who has not rated the session yet.
UPDATE "session_notes"
   SET "patient_status" = 'approved',
       "patient_approved_at" = "approved_at",
       "patient_approved_by" = "approved_by"
 WHERE "status" = 'approved' AND "patient_status" = 'draft';

ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "rating_reminder_at" timestamptz;
