-- 0192: A JOURNAL CRISIS HIT IS A CRISIS ALERT, AND A SESSION SAYS WHEN LIVE RISK DETECTION WAS OFF.
--
-- Due diligence: a crisis hit in a patient journal was an in-app row only, with no
-- email, no escalation and nobody told when no clinician held a grant. It now goes
-- through the same risk_assessments row and escalation ladder as a session alert, so a
-- row may hang off a journal instead of a session. A row with no clinician (nobody holds
-- a grant) goes straight to the platform on-call, so therapist and organization may be
-- null too. Every row still names a session or a journal.
--
-- `sessions.live_risk_off_at` is when transcription was refused because the patient
-- paused AI, which also turns off live crisis detection. Null means it never was.
--
-- Safe to apply before the deploy (H16): dropping NOT NULL and adding nullable columns
-- changes nothing the running build reads or writes.

ALTER TABLE "risk_assessments" ALTER COLUMN "session_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ALTER COLUMN "therapist_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ALTER COLUMN "organization_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "journal_id" uuid REFERENCES "journals"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "person_id" uuid REFERENCES "people"("id") ON DELETE CASCADE;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_subject_chk"
    CHECK ("session_id" IS NOT NULL OR "journal_id" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "risk_assessments_person_idx" ON "risk_assessments" ("person_id", "created_at")
 WHERE journal_id IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "live_risk_off_at" timestamp with time zone;
