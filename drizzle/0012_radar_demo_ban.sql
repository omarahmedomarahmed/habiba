-- Seeded demonstration accounts, and administrator suspensions.
--
-- `demo` is exempt from the heartbeat expiry: nobody is holding a browser open
-- for a fixture. That exemption is why this is a column and not a naming
-- convention — the admin radar counts them separately, so "twelve online" can
-- never quietly mean twelve fixtures.
--
-- `suspended_until` is deliberately not a status value. A ban has to survive
-- the clinician toggling themselves back on, and a status the owner can
-- overwrite is not a ban. NULL reason with a far-future date is the
-- indefinite case, released by hand.

ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "suspended_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "suspended_reason" text;
