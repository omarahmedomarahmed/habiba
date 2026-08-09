-- Viewing reservations.
--
-- A clinician went `pending` the moment anyone opened their booking sheet, and
-- the person doing the booking then saw "someone is booking them" and lost the
-- form. A lock has to know whose it is.

ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "reserved_by" text;
