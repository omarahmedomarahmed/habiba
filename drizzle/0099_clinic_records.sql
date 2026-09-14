-- 🔴 SPRINT 67 — THE CLINIC'S OWN RECORDS CONNECTION.
--
-- `lib/ehr/` already does SMART-on-FHIR and `/clinic/records` already begins a
-- connection. What is missing is that it reads like an engineer's screen, has no plan
-- gate, and goes silent the moment anything fails.
--
-- Additive (H16).

-- 🔴 67.4 — CONNECTED MEANS A TOKEN THAT WORKS, TESTED AGAINST THEIR SERVER.
--
-- *Not "we stored a URL".*
--
-- `connected_at` is when the OAuth exchange completed, which is the moment a token
-- arrived and says nothing about whether it still works. A hospital rotating a client
-- secret, revoking our registration, or letting a refresh token expire leaves
-- `connected_at` exactly where it was and leaves a practice reading "connected" off a
-- screen while every filing fails.
--
-- This is stamped when a call to their server actually returns something, which is
-- what the indicator reads.
ALTER TABLE ehr_connections ADD COLUMN IF NOT EXISTS last_success_at timestamptz;

-- And what went wrong the last time one did not, so a practice can see it rather than
-- ask us. Cleared on the next success, because a stale error beside a working
-- connection is worse than no error: somebody chases a problem that is fixed.
ALTER TABLE ehr_connections ADD COLUMN IF NOT EXISTS last_error text;

COMMENT ON COLUMN ehr_connections.last_success_at IS
  '67.4. When a call to their FHIR server last returned something. connected_at is when the OAuth exchange completed and says nothing about whether the token still works: a hospital rotating a secret leaves connected_at where it was while every filing fails.';

-- 🔴 67.5 — THE WRITEBACK LOG NAMES WHICH CLINICIAN APPROVED THE NOTE.
--
-- *Every note we filed, which patient reference, which clinician approved it, the
-- response, and the error when there was one.*
--
-- The clinician is the half that is missing and the half §7 makes load-bearing: a
-- practice looking at a failed filing needs to know whose note it was, because that
-- is the person who has to be told their note is not in the hospital chart.
--
-- 🔴 AND IT IS A USER ID, NOT A NAME. The screen resolves it; the row does not carry
-- a copy that goes stale when somebody changes their name, and a log table holding
-- names is a log table somebody exports.
ALTER TABLE ehr_writebacks
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL;

-- The HTTP status their server returned. `last_error` already holds the message; this
-- is what an engineer at the practice actually reads first.
ALTER TABLE ehr_writebacks ADD COLUMN IF NOT EXISTS response_status integer;

COMMENT ON COLUMN ehr_writebacks.approved_by_user_id IS
  '67.5. Whose note this was. A practice looking at a failed filing needs to know who has to be told their note is not in the hospital chart, and §7 makes that person a named clinician rather than a system.';

-- 🔴 67.8 — AND THERE IS NO COLUMN HERE THAT COULD HOLD NOTE CONTENT.
--
-- The log carries a reference and a status. `note_id` points at our own row, which is
-- behind the clinical guard; `fhir_document_reference_id` is THEIR id for the
-- document they now hold. Neither is text somebody could read off a screen a practice
-- manager is looking at, and that is what 67.8 asks the 58.6 matrix to prove.
COMMENT ON TABLE ehr_writebacks IS
  '67.5 / 67.8. What we filed, where it went, and what their server said. A reference and a status, never note content: nothing on the clinic''s records page is clinical, and the import graph proves it rather than this sentence.';
