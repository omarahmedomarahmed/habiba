-- W1-23: a licence change after approval is reviewed.
--
-- An approved clinician could rewrite their credentials, licence type, region
-- and number in /settings, and the licence body and number on the onboarding
-- form, with no review, while patients were shown "Licence checked".
--
-- Now a change after approval is a REQUEST held beside the approval:
--
--   pending_licence       the new details, as the clinician typed them
--   recheck_submitted_at  when they asked; puts the row in the operator's queue
--
-- The checked columns keep what an operator actually checked, and the state
-- stays `approved`, so the clinician stays cleared while the operator decides
-- (setting the state back would drop them from every `approved` check, the
-- radar, bookings, the grant trigger, which is the opposite of the ruling). An
-- approval moves the pending details into the checked columns; a rejection
-- discards them. An expired licence is the other path (0117): there the state
-- does go back, and the clinician is not cleared.
ALTER TABLE "therapist_verifications" ADD COLUMN IF NOT EXISTS "pending_licence" jsonb;
ALTER TABLE "therapist_verifications" ADD COLUMN IF NOT EXISTS "recheck_submitted_at" timestamp with time zone;
