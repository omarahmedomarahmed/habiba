-- The rating a patient gives on the way in.
--
-- "How easy was it to find someone?" is a question about us, and the only
-- honest moment to ask it is while they are waiting — before the session
-- colours the answer, and while they have nothing else to do. The rating about
-- the *therapist* belongs after, and stays anonymous.
--
-- Both live in one row rather than two tables, so `therapist_stars` has to be
-- nullable: the row now exists from the moment they arrive and is completed
-- when they leave.

ALTER TABLE "session_feedback" ALTER COLUMN "therapist_stars" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session_feedback" ADD COLUMN IF NOT EXISTS "arrived_at" timestamp with time zone;
