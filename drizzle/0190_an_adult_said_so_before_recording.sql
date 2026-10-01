-- 0190: A CLINICIAN CONFIRMS THE PATIENT IS AN ADULT BEFORE ANYTHING IS RECORDED. Additive.
--
-- DD-2 B1: the 18 or over check ran only on the patient's own signup. A chart a
-- clinician typed, a guest link and an in-person session had none, so a minor's
-- session could be recorded and sent to the AI provider. Now the clinician ticks a
-- required box (or answers in the room), and who confirmed and when is kept on the
-- chart and on the session. Recording and transcription refuse a session with no
-- confirmation on the session, its chart, or the patient's own account.
--
-- Every column is nullable and nothing is backfilled: a chart from before this
-- migration was confirmed by nobody, and a null says exactly that. NOTE for the
-- deploy: until this is applied the new build cannot read these columns, so apply
-- it first (H16).

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "adult_confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "adult_confirmed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "adult_confirmed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "adult_confirmed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
