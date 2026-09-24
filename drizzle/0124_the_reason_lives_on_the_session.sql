-- W1-28b, corrected: the patient's notice log carries no prose (C231).
--
-- 0122 gave `patient_notifications` a `reason` column so a clinician's
-- cancellation reason could sit in the notice. C231 is that the notice log
-- holds a message key and references only, never text: `verify:sprint53`
-- refuses any column named for prose. So the reason moves to the session it
-- belongs to, and the notice points at that session.
--
-- 0122 never reached production, so no production notice holds a reason; on
-- dev, any reason already written is carried to its session first.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "cancelled_reason" text;
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_cancelled_reason_short";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cancelled_reason_short"
  CHECK ("cancelled_reason" IS NULL OR length("cancelled_reason") <= 300);

ALTER TABLE "patient_notifications" ADD COLUMN IF NOT EXISTS "session_id" uuid
  REFERENCES "sessions"("id") ON DELETE SET NULL;

ALTER TABLE "patient_notifications" DROP CONSTRAINT IF EXISTS "patient_notifications_reason_short";
ALTER TABLE "patient_notifications" DROP COLUMN IF EXISTS "reason";
