-- 🔴 80.2 — THE FOUR NOTICE KINDS THE DATABASE HAS BEEN REFUSING.
--
-- 79.1 added `session_invited`, `session_started`, `payment_confirmed` and
-- `access_requested` to `PATIENT_NOTICE_KINDS` in `lib/db/schema.ts`, wired
-- `notify()` to write the row, shipped a gate to keep it wired, and deployed it
-- to production as the fix for a clinician inviting a patient and the patient's
-- app saying nothing at all.
--
-- 🔴 THE CHECK FROM 0072 STILL ALLOWED ONLY THE ORIGINAL FOUR.
--
-- So on production, from the moment that deploy landed: the insert raised
-- `patient_notifications_kind`, `notify()` caught it, logged
-- `in-app notice not written` at warn, and carried on to send the email. The
-- patient's app went on showing nothing, the send looked fine, and the gate
-- that exists to prevent exactly this passed on every run, because it reads
-- source and a TypeScript union is not a constraint.
--
-- It was found by running `seed:demo` against dev, which is the first thing to
-- write one of those kinds outside a request handler and therefore the first
-- thing whose failure was not swallowed. Nothing that reads code could have
-- seen it, and neither could anything that reads a log nobody opens.
--
-- `verify:migrations` now reads this CHECK back out of the catalogue and
-- compares it to the TypeScript union, on whichever database it is pointed at,
-- so the two cannot disagree again without a gate going red.

ALTER TABLE "patient_notifications" DROP CONSTRAINT IF EXISTS "patient_notifications_kind";

ALTER TABLE "patient_notifications" ADD CONSTRAINT "patient_notifications_kind"
  CHECK ("kind" IN (
    -- the employer benefit, which is what the table was built for
    'benefit_started', 'benefit_ended', 'benefit_paused', 'verify_needed',
    -- 🔴 79.1: everything else the product tells a patient
    'session_invited', 'session_started', 'payment_confirmed', 'access_requested'
  ))
  NOT VALID;

-- Every existing row holds one of the original four, because the other four
-- were never able to be written. VALIDATE is therefore a scan that cannot fail,
-- and it is run rather than skipped so `22.9` stays true: a CHECK left NOT VALID
-- is a rule the schema does not assert.
ALTER TABLE "patient_notifications" VALIDATE CONSTRAINT "patient_notifications_kind";
