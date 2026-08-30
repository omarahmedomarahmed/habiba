-- Mark segments whose speaker was worked out from the words rather than heard
-- on a separate microphone.
--
-- The distinction matters clinically. A two-track video session knows who spoke
-- because the audio arrived on that person's track. A single-microphone session
-- — every in-person session, and every video session where the patient's track
-- never connected — only has the transcript, and an inference over a transcript
-- can be wrong. The record has to say which one it is.
ALTER TABLE transcript_segments
  ADD COLUMN IF NOT EXISTS speaker_inferred boolean NOT NULL DEFAULT false;

-- Everything recorded before this column existed was attributed by track, or
-- left unknown. Neither was inferred, so the default is correct for all of it.
