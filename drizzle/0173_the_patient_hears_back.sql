-- 🔴 0173: THE PATIENT SIDE HEARS BACK, AND ITS CODES STOP CANCELLING EACH OTHER. Additive.
--
-- 1. Three things the patient's app is now told about (patient_notifications.kind):
--    `payment_submitted` (a transfer claim reached us, K10), `homework_set` and
--    `assessment_sent` (a clinician set a step or sent a questionnaire, K18). Each used
--    to reach nobody, or only an inbox the person might not have given us.
--
-- 2. Two token purposes (patient_auth_tokens.purpose): `sign_in` and `email_add`. The
--    sign-in code, the add-an-email code and the claim's handle code all shared
--    `handle_verify`, and each reads the NEWEST live row of its purpose, so asking for
--    one made the other's code "wrong or expired" (K19). `handle_verify` stays, for the
--    claim's handle code; rows already issued keep working until they expire.
--
-- 3. `transcript_segments.chunk_id` (K11): the recorder's own id for an uploaded chunk.
--    The room numbered chunks from the count of lines it loaded, so after a rejoin or in
--    a second tab two different chunks carried the same number and the second was
--    dropped as a "retry". The server now assigns the sequence and a retry is recognised
--    by this id instead. Null on every row written before, and on the ingest bot's,
--    which is recognised by its own number as before (`seq:N`).
--
-- ⚠️ The kind list below is the whole list as of 0169. A later migration that changes
-- the same constraint must carry these three.

ALTER TABLE "patient_notifications" DROP CONSTRAINT IF EXISTS "patient_notifications_kind";
--> statement-breakpoint
ALTER TABLE "patient_notifications" ADD CONSTRAINT "patient_notifications_kind"
  CHECK ("kind" IN (
    'benefit_started', 'benefit_ended', 'benefit_paused', 'verify_needed',
    'session_invited', 'session_started', 'payment_confirmed', 'access_requested',
    'session_cancelled', 'benefit_terms', 'session_rescheduled', 'message_fallback',
    'payment_submitted', 'homework_set', 'assessment_sent'
  ))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "patient_notifications" VALIDATE CONSTRAINT "patient_notifications_kind";
--> statement-breakpoint
ALTER TABLE "patient_auth_tokens" DROP CONSTRAINT IF EXISTS "patient_auth_tokens_purpose_known";
--> statement-breakpoint
ALTER TABLE "patient_auth_tokens" ADD CONSTRAINT "patient_auth_tokens_purpose_known"
  CHECK ("purpose" IN ('password_reset', 'handle_verify', 'sign_in', 'email_add'))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "patient_auth_tokens" VALIDATE CONSTRAINT "patient_auth_tokens_purpose_known";
--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD COLUMN IF NOT EXISTS "chunk_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "transcript_segments_session_chunk_unique"
  ON "transcript_segments" ("session_id", "chunk_id") WHERE "chunk_id" IS NOT NULL;
