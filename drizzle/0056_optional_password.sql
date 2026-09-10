-- Sprint 25.11, 25.12, C119 - the password becomes optional for a patient.
--
-- 🔴 This EDITS 13R rather than extending it.
--
-- 13R made a password mandatory on a patient account, and §3b then made the
-- phone the handle that is never missing and the email a real second way in.
-- The two do not fit: a guest who joined a session with a phone number and no
-- email has no password, has never chosen one, and cannot be asked to choose
-- one at the end of a session without turning "your record is yours" into a
-- form. A code to the number they already proved is a stronger factor than a
-- password they invent under time pressure and forget.
--
-- So `password_hash` becomes nullable, and a code to a proven handle is always
-- a valid sign-in. An account with a password keeps it; nothing is backfilled
-- and no existing row changes.
--
-- Additive in the sense that matters: dropping NOT NULL cannot fail, cannot
-- rewrite the table, and the running deployment keeps working because every
-- account it can see still has a hash.

ALTER TABLE "patient_accounts"
  ALTER COLUMN "password_hash" DROP NOT NULL;

-- 🔴 And the rule that replaces it: an account must be reachable by something.
--
-- A row with no password, no phone and no email is an account nobody can ever
-- sign in to, and support cannot rescue. `NOT VALID` for the deploy gap, then
-- validated below, because the table is small and every row in it has a phone.
DO $$
BEGIN
  ALTER TABLE "patient_accounts"
    ADD CONSTRAINT "patient_accounts_reachable"
    CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "patient_accounts" VALIDATE CONSTRAINT "patient_accounts_reachable";
