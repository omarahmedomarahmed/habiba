-- 🔴 0165: A SCHEDULED JOB THAT STOPS IS NOTICED, AND SO IS A RUN OF ERRORS.
--
-- Launch blockers, 25 September 2026. Errors went only to `error_events` and
-- nothing read that table unless somebody opened /admin/errors. A cron job that
-- stopped running (a lost CRON_SECRET, a schedule deleted in a dashboard, a
-- throw at the top of the job) was noticed by nobody, and the crisis sweep is
-- one of those jobs.
--
-- 1. `cron_heartbeats`: one row per job, written by the cron route after every
--    run. `last_success_at` moves only when no step failed, so a job that runs
--    every hour and fails the same step every hour still goes overdue.
--    Seeded with the five scheduled jobs at the moment this runs, so a job
--    that NEVER runs after the deploy is overdue at twice its interval rather
--    than invisible for want of a row.
--
-- 2. `ops_alerts`: one row per problem per day. The hourly check inserts
--    before it sends and sends only when the insert landed, so two runs in the
--    same minute cannot both email, and nobody gets the same alert 24 times.
--
-- 3. `cron_leases`: a lease a sweep takes before it sends anything unprompted.
--    Claimed with a conditional upsert, so two overlapping runs of the
--    check-in sweep cannot both read "last sent seven hours ago" and both send.
CREATE TABLE IF NOT EXISTS "cron_heartbeats" (
  "job" text PRIMARY KEY NOT NULL,
  "last_run_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "failed_steps" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "cron_heartbeats" ("job", "last_success_at")
VALUES ('crisis', now()), ('reminders', now()), ('billing', now()), ('retention', now()), ('extract', now())
ON CONFLICT ("job") DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ops_alerts" (
  "key" text NOT NULL,
  "day" date NOT NULL,
  "sent_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("key", "day")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cron_leases" (
  "name" text PRIMARY KEY NOT NULL,
  "held_until" timestamp with time zone NOT NULL
);
