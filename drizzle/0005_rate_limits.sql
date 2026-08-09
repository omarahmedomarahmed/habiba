-- Rate limits, in Postgres.
--
-- Serverless has no shared memory, so an in-process counter resets whenever a
-- lambda is recycled — which is not a rate limit. One table, one atomic UPSERT,
-- no extra service to run.

CREATE TABLE IF NOT EXISTS "rate_limits" (
  "key" text PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "window_start" timestamp with time zone DEFAULT now() NOT NULL,
  "note" text,
  "expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "rate_limits_expires_idx" ON "rate_limits" USING btree ("expires_at");
