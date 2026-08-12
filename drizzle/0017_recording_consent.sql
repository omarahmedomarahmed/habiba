-- Whether the patient actually agreed to be recorded.
--
-- Until now the join page told them: "Your therapist may record it to write
-- their clinical notes." That is notice, and notice is not consent. There was
-- no affirmative act, no record that they had read it, and nothing to produce
-- if the recording were ever disputed — which is the moment the whole question
-- exists for.
--
-- Three columns rather than one boolean, because the three states are
-- genuinely different and collapsing them loses the case:
--
--   null      — never asked. Sessions created before this shipped, and any
--               path that reaches a room without going through the form.
--   granted   — said yes, at a known time, to known wording.
--   declined  — said no. A recorded decision, not an absence of one, and the
--               difference matters: "they never agreed" and "they refused"
--               are opposite facts about the same session.
--
-- The version string is what makes it defensible a year later. Consent is to
-- *particular words*, and those words will be edited; storing which wording
-- was on screen is the difference between evidence and an assertion.

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "recording_consent" text;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "recording_consent_at" timestamp with time zone;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "recording_consent_version" text;
