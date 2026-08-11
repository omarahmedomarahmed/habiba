-- Three scores, asked at the two moments they can honestly be answered.
--
--   service_stars   the app itself — asked the moment the therapist joins,
--                   because finding somebody is the only part they have
--                   experienced yet and the session has not coloured it
--   session_stars   was this half hour any use to you
--   therapist_stars was this the right person
--
-- The last two are asked afterwards and are anonymous. Splitting them matters:
-- "she was excellent but I did not get what I needed today" is a real and
-- common answer, and one combined number erases it.

ALTER TABLE "session_feedback" ADD COLUMN IF NOT EXISTS "session_stars" integer;
