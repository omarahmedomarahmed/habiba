-- 🔴 0183: THE HOUR BEFORE, AND THE CLOCK THAT WAITS FOR BOTH PEOPLE. Additive.
--
-- The founder: "send email reminders of session starting in 1 hr then 30 mins then
-- 15 mins, then at 5 mins before the session tell them they can start it now, and
-- don't count the 50 mins until the therapist joins if they started the session early."
--
-- `session_reminders` is the claim for each of those four messages: one row per session,
-- per mark, per booked instant, inserted before the message leaves, so a minute tick
-- that runs twice sends nothing twice. `scheduled_for` is in the key so a booking moved
-- to another hour is reminded afresh.
--
-- `sessions.clock_started_at` is the instant the fifty minutes start: when both people
-- are there. Backfilled from `started_at` for every session that already started, so the
-- history reads exactly as before. Safe to apply before the deploy (H16): the running
-- build neither reads nor writes either of them.

CREATE TABLE IF NOT EXISTS "session_reminders" (
  "session_id" uuid NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
  "mark" integer NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "outcome" text DEFAULT 'sent' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "session_reminders_pk" PRIMARY KEY ("session_id", "mark", "scheduled_for"),
  CONSTRAINT "session_reminders_mark" CHECK ("mark" IN (60, 30, 15, 5)),
  CONSTRAINT "session_reminders_outcome" CHECK ("outcome" IN ('sent', 'unreachable', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "clock_started_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "sessions" SET "clock_started_at" = "started_at"
 WHERE "started_at" IS NOT NULL AND "clock_started_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_scheduled_upcoming_idx" ON "sessions" ("scheduled_at")
 WHERE status = 'scheduled';
--> statement-breakpoint
-- The minute tick that sends them is a scheduled job like the others, so the watchdog
-- holds a heartbeat for it from the start (0165's rule: a job that never runs is late).
INSERT INTO "cron_heartbeats" ("job", "last_success_at")
VALUES ('tick', now())
ON CONFLICT ("job") DO NOTHING;
