-- 🔴 68.5 / 68.6 / 68.9 — WHAT WE PRODUCED, AND WHO APPROVED IT.
--
-- The transcript, the note and the summary live on the partner's session row rather
-- than in `transcript_segments` and `session_notes`. Those two are keyed on
-- `sessions.id`, which is OUR clinical record with our therapist and our patient on
-- it, and a partner's session is deliberately not one of those (0095 says why).
--
-- Additive (H16).

ALTER TABLE partner_sessions ADD COLUMN IF NOT EXISTS transcript_text text;

-- 🔴 68.6 — TWO COLUMNS FOR THE NOTE, AND THE SEPARATION IS §7's FIRST HARD RULE.
--
-- > *Content in a chart needs a named clinician who approved that exact text, and a
-- > partner's server is not one.*
--
-- `note_draft` is what we wrote. `note_approved_text` is what a human read, possibly
-- edited, and put their name to. They are different columns because they are
-- different claims, and a single column would make "the AI wrote this" and "a
-- clinician stands behind this" indistinguishable the moment anybody read the row.
ALTER TABLE partner_sessions ADD COLUMN IF NOT EXISTS note_draft text;
ALTER TABLE partner_sessions ADD COLUMN IF NOT EXISTS note_approved_text text;
-- Their id for the clinician who approved it, in their system. We do not have an
-- account for this person and do not need one: what matters is that the partner can
-- name them, and that the name travels with the text.
ALTER TABLE partner_sessions ADD COLUMN IF NOT EXISTS note_approved_by_ref text;
ALTER TABLE partner_sessions ADD COLUMN IF NOT EXISTS note_approved_at timestamptz;

-- 🔴 APPROVED TEXT WITHOUT AN APPROVER IS THE THING §7 FORBIDS, SO THE DATABASE
-- REFUSES IT.
--
-- All three or none. A row with approved text and no name on it is exactly the
-- artefact "a partner's server is not a clinician" exists to prevent, and a check in
-- application code is one endpoint away from being bypassed.
ALTER TABLE partner_sessions DROP CONSTRAINT IF EXISTS partner_sessions_note_approval_whole;
ALTER TABLE partner_sessions ADD CONSTRAINT partner_sessions_note_approval_whole
  CHECK (
    (note_approved_text IS NULL AND note_approved_by_ref IS NULL AND note_approved_at IS NULL)
    OR (note_approved_text IS NOT NULL AND note_approved_by_ref IS NOT NULL
        AND note_approved_at IS NOT NULL)
  )
  NOT VALID;
ALTER TABLE partner_sessions VALIDATE CONSTRAINT partner_sessions_note_approval_whole;

-- 🔴 68.9 — THE SUMMARY, AND IT IS DELIVERED ONLY AFTER THE NOTE IS APPROVED.
--
-- *Reviewed and edited by their therapist before anybody sees it, like ours.* The
-- patient's summary is written from the session, so a summary reaching a patient
-- before a clinician has approved anything is an AI talking to a patient about their
-- own therapy with nobody in between.
ALTER TABLE partner_sessions ADD COLUMN IF NOT EXISTS summary_text text;
ALTER TABLE partner_sessions ADD COLUMN IF NOT EXISTS summary_delivered_at timestamptz;

ALTER TABLE partner_sessions DROP CONSTRAINT IF EXISTS partner_sessions_summary_after_approval;
ALTER TABLE partner_sessions ADD CONSTRAINT partner_sessions_summary_after_approval
  CHECK (summary_delivered_at IS NULL OR note_approved_at IS NOT NULL)
  NOT VALID;
ALTER TABLE partner_sessions VALIDATE CONSTRAINT partner_sessions_summary_after_approval;

COMMENT ON COLUMN partner_sessions.note_approved_text IS
  '§7 / 68.6. What a named human read and put their name to, which is a different claim from note_draft and therefore a different column. A constraint refuses approved text with no approver: a partner''s server is not a clinician, and no header or field makes it one.';

COMMENT ON COLUMN partner_sessions.summary_delivered_at IS
  '68.9. A constraint refuses delivery before note_approved_at exists. A summary reaching a patient before a clinician approved anything is an AI talking to somebody about their own therapy with nobody in between.';
