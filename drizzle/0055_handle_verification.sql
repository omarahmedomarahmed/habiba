-- Sprint 25.14, 25.15, C121 - a code that proves a handle, on the same table.
--
-- 🔴 Nothing about any record may be shown before the handle is proven, and
-- the claim screen was showing an initial and the fact that "a therapist keeps
-- notes for someone with your phone number" to anybody who signed up with a
-- stranger's number. `openChallenges` already refused to speak without a
-- verified handle; `suggestionsFor`, on the screen a patient actually lands
-- on, did not.
--
-- Proving a handle is the same mechanic as resetting a password: a six-digit
-- code, hashed, expiring, with a bounded number of guesses. It is the same
-- table, with one more purpose allowed.
--
-- A CHECK cannot be widened in place, so it is dropped and re-added. That is a
-- metadata change plus one scan on a table with almost nothing in it, and the
-- running deployment survives the gap: every value it writes today
-- ('password_reset') is still allowed by the new constraint.

ALTER TABLE "patient_auth_tokens"
  DROP CONSTRAINT IF EXISTS "patient_auth_tokens_purpose_known";

ALTER TABLE "patient_auth_tokens"
  ADD CONSTRAINT "patient_auth_tokens_purpose_known"
  CHECK ("purpose" IN ('password_reset', 'handle_verify'));
