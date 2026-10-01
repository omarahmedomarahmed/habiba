-- 🔴 0185 / F2: A CRISIS ALERT LEAVES THE BUILDING, AND GOES TO A BACKUP. Additive.
--
-- Due diligence found that a crisis alert was one in-app row: a clinician who was not
-- looking at the app learned nothing until they next opened it. Every alert now also
-- goes out of band at once (email, and WhatsApp where configured), and if nobody
-- acknowledges it within `crisis.escalateAfterMinutes` (default 15) it goes to the
-- clinic's other clinicians and managers, then to the platform's managers.
--
-- `acknowledged_at` and `acknowledged_by` already exist and are now written.
-- Every row from before this migration keeps `escalate_at` NULL and
-- `out_of_band_attempts` 0, so nothing old is sent or escalated. Safe to apply before
-- the deploy (H16): the running build neither reads nor writes these columns, and
-- every one has a default.

ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "escalate_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "escalation_stage" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "escalated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "escalated_to" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "out_of_band_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "out_of_band_attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "out_of_band_channels" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "risk_assessments_escalate_idx" ON "risk_assessments" ("escalate_at")
 WHERE acknowledged_at IS NULL;
