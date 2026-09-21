-- A radar status the product actually understands.
--
-- `therapist_radar.status` is a plain `text` column with a Drizzle `$type<RadarStatus>()`
-- on it. That type exists only in TypeScript: it constrains the query builder and it
-- constrains nothing at all about what reaches the database. `scripts/seed-demo.ts`
-- wrote the string 'available' through a raw INSERT, Postgres accepted it happily, and
-- two clinicians on production have been in that state ever since.
--
-- What it cost, all of it observed live:
--
--   * The board query lists `online | pending | in_session` explicitly, so both
--     clinicians were invisible. The public radar said "No one on shift" and the patient
--     app said "Nobody is online right now" while the same app listed three therapists
--     one section below.
--   * The on-call console computed `online = status !== "offline"`, so it told them
--     "You are visible to the world", and its label chain fell through to "In a session".
--   * The dashboard orb, reading the same row at the same moment, said "Off the radar".
--   * Both switches were dead. Going offline matches `status IN ('online','offline')`,
--     matched nothing, and returned a fallback error inventing a patient who was paying.
--     Going online matches `status = 'offline'`, matched nothing, and returned success.
--
-- So: repair whatever is there, then make the column refuse to be wrong again. The
-- repair runs first because the constraint would not validate against the existing rows.

UPDATE therapist_radar
   SET status = 'offline'
 WHERE status NOT IN ('offline', 'online', 'pending', 'in_session');

ALTER TABLE therapist_radar
  ADD CONSTRAINT therapist_radar_status_known
  CHECK (status IN ('offline', 'online', 'pending', 'in_session'));
