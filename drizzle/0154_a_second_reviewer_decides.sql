-- 🔴 0154: A SECOND REVIEWER DECIDES.
--
-- One member of staff could approve a clinician to see patients, or reject
-- them a second time and so delete their identity documents, alone. The
-- founders' rule is four eyes on verifications as on payouts: the first
-- reviewer proposes, and a different one's matching decision applies it.
ALTER TABLE "therapist_verifications" ADD COLUMN IF NOT EXISTS "proposed_approve" boolean;
--> statement-breakpoint
ALTER TABLE "therapist_verifications" ADD COLUMN IF NOT EXISTS "proposed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "therapist_verifications" ADD COLUMN IF NOT EXISTS "proposed_note" text;
--> statement-breakpoint
ALTER TABLE "therapist_verifications" ADD COLUMN IF NOT EXISTS "proposed_at" timestamp with time zone;
