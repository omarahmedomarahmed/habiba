-- 🔴 C351 — A SECOND REJECTION MUST COST SOMETHING, OR IT IS NOT A DECISION.
--
-- `submitForReview` moves a verification from `rejected` back to `submitted` the
-- moment the form has every field filled in. It does not ask whether anything
-- CHANGED. So a clinician whose licence document was rejected as unreadable can
-- press submit again, with the same unreadable document, and land back at the
-- front of the operator's queue. The operator reads the same file, writes the
-- same reason, and the loop costs them a minute every time and the applicant
-- nothing.
--
-- The rule now: two rejections and the documents go. A third look starts with
-- new files or it does not start.
--
-- Additive (H16). Both columns default for every existing row, so the count
-- begins at zero for people already rejected — a clinician cannot be locked out
-- by history this migration cannot see.

ALTER TABLE therapist_verifications
  ADD COLUMN IF NOT EXISTS rejection_count integer NOT NULL DEFAULT 0;

-- When the documents were taken away, which is the difference between "they
-- never uploaded one" and "we removed the one they did". The onboarding screen
-- says which, because a form that has silently emptied itself reads as a bug and
-- generates the support ticket the reason was written to avoid.
ALTER TABLE therapist_verifications
  ADD COLUMN IF NOT EXISTS documents_cleared_at timestamptz;

COMMENT ON COLUMN therapist_verifications.rejection_count IS
  'C351. How many times an operator has rejected this application. Two is the point at which resubmitting requires new documents rather than a new press of the button. Never reset: a fresh submission is the same person making the same claim.';

COMMENT ON COLUMN therapist_verifications.documents_cleared_at IS
  'C351. When the identity documents were removed after a second rejection. Distinguishes "never uploaded" from "we deleted them", which is what the onboarding screen has to explain, and is also the retention record: we stop holding a stranger''s passport once we have twice decided it does not clear them.';
