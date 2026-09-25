-- 🔴 0168: A BOOKING CAN BE CANCELLED BY THE PATIENT, AND MOVED (ruling 16).
--
-- A patient who cancels a paid booking at least `rules.refunds.
-- patientCancelWindowHours` before it starts gets everything back; later, the
-- money stays with the clinician unless the clinician agrees to return it.
-- The session has to say who cancelled, when, and whether a late
-- cancellation's money is still held, so "the clinician agrees" is one
-- conditional UPDATE from `held` to `refunded` that only one press can win.
--
-- A booking can also move to another open hour of the same clinician without
-- being charged again; the count and the time of the last move are kept.
--
-- Additive, nullable or defaulted, `IF NOT EXISTS`, so the running deployment
-- survives the gap and applying it by hand to development ahead of the runner
-- does no harm.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "cancelled_by" text;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "late_cancel" text;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "rescheduled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "reschedule_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_cancelled_by";
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cancelled_by"
  CHECK ("cancelled_by" IS NULL OR "cancelled_by" IN ('patient', 'therapist', 'us'))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_cancelled_by";
--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_late_cancel";
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_late_cancel"
  CHECK ("late_cancel" IS NULL OR "late_cancel" IN ('held', 'refunded'))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "sessions" VALIDATE CONSTRAINT "sessions_late_cancel";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_late_cancel_idx" ON "sessions" ("therapist_id") WHERE "late_cancel" = 'held';
--> statement-breakpoint
-- The patient's app hears about a moved session, and about a message a
-- channel could not carry (an unapproved WhatsApp template, no email).
ALTER TABLE "patient_notifications" DROP CONSTRAINT IF EXISTS "patient_notifications_kind";
--> statement-breakpoint
ALTER TABLE "patient_notifications" ADD CONSTRAINT "patient_notifications_kind"
  CHECK ("kind" IN (
    'benefit_started', 'benefit_ended', 'benefit_paused', 'verify_needed',
    'session_invited', 'session_started', 'payment_confirmed', 'access_requested',
    'session_cancelled', 'benefit_terms', 'session_rescheduled', 'message_fallback'
  ))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "patient_notifications" VALIDATE CONSTRAINT "patient_notifications_kind";
