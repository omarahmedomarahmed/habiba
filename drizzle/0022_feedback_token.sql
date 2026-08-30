-- Give the rating page its own key.
--
-- It used to be reached with `join_token` — the same secret that opens the
-- video room. That made the two things one thing: a patient forwarding "rate
-- your session" to a friend was also handing over the key to the room, and a
-- rating link that has to keep working for days therefore had to keep a room
-- key alive for days.
--
-- Separate tokens let each one have the lifetime it actually needs: the join
-- token stays short-lived and tied to the appointment, and the feedback token
-- outlives the session on purpose, because a patient who closes the tab should
-- still be able to rate the session on Thursday.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS feedback_token text;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_feedback_token_unique
  ON sessions (feedback_token);

-- Backfill every session that already has a join token, so links already in
-- the wild keep resolving. `gen_random_uuid()` twice gives 32 hex characters,
-- which matches the entropy of the tokens the application mints.
UPDATE sessions
   SET feedback_token = replace(gen_random_uuid()::text, '-', '')
                     || replace(gen_random_uuid()::text, '-', '')
 WHERE feedback_token IS NULL
   AND join_token IS NOT NULL;
