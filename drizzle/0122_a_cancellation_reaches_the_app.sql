-- W1-28b: a clinician's cancellation lands in the patient's app, with the reason.
--
-- W1-13 made `afterClinicianCancel` send the email and WhatsApp with the
-- clinician's reason, and could not write the in-app notice: the kind CHECK
-- (0115) had no cancellation kind. `verify:migrations` compares this CHECK to
-- `PATIENT_NOTICE_KINDS`, which gains `session_cancelled` in the same change.
--
-- `reason` is the one piece of prose a notice may carry: the clinician's own
-- short reason, written FOR the patient (the form says no clinical detail, and
-- `cleanCancelReason` caps it at 300). The message itself stays a key resolved
-- at render. No employer, no sponsor, nothing about a payer (C231).
ALTER TABLE "patient_notifications" DROP CONSTRAINT IF EXISTS "patient_notifications_kind";

ALTER TABLE "patient_notifications" ADD CONSTRAINT "patient_notifications_kind"
  CHECK ("kind" IN (
    'benefit_started', 'benefit_ended', 'benefit_paused', 'verify_needed',
    'session_invited', 'session_started', 'payment_confirmed', 'access_requested',
    'session_cancelled'
  ))
  NOT VALID;

ALTER TABLE "patient_notifications" VALIDATE CONSTRAINT "patient_notifications_kind";

ALTER TABLE "patient_notifications" ADD COLUMN IF NOT EXISTS "reason" text;

ALTER TABLE "patient_notifications" DROP CONSTRAINT IF EXISTS "patient_notifications_reason_short";
ALTER TABLE "patient_notifications" ADD CONSTRAINT "patient_notifications_reason_short"
  CHECK ("reason" IS NULL OR length("reason") <= 300);
