-- When the microphone was last paused.
--
-- Off-record was purely a client-side state: the recorder stopped uploading
-- and nothing on the server knew. That is fine for the clinician, who pressed
-- the button, and wrong for the patient, who consented to being recorded and
-- has no way of seeing that it stopped.
--
-- Null means recording. A timestamp means paused, and doubles as the moment it
-- happened for anyone investigating a complaint later.

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "recording_paused_at" timestamp with time zone;
