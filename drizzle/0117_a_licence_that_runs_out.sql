-- W1-16: a licence that runs out.
--
-- `therapist_verifications.license_expiry` was asked for, stored and never read
-- by anything, so a clinician approved on a licence that lapsed last month was
-- still on the radar, still bookable and still shown to patients as checked.
--
-- A daily sweep (`sweepLicences`, run inside the `crisis` cron) now reads it.
-- These two columns are what it writes, so it acts once per licence and says so:
--
--   license_expired_at        when the sweep took the clinician off: state goes
--                             back to `submitted`, which is the operator's
--                             re-review queue, and everything that asks for
--                             `approved` (the radar, bookings, sessions, the
--                             partner flag) stops answering yes.
--   license_expiry_warned_at  when the 30 day warning went out, so it goes once.
--
-- Both are cleared when an operator approves the clinician again.
ALTER TABLE "therapist_verifications" ADD COLUMN IF NOT EXISTS "license_expired_at" timestamp with time zone;
ALTER TABLE "therapist_verifications" ADD COLUMN IF NOT EXISTS "license_expiry_warned_at" timestamp with time zone;
