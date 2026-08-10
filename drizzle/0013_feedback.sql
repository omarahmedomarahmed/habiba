-- The patient's side of a session.
--
-- Feedback is gated behind the report: a patient completes it to receive their
-- brief, which turns an eight-percent response rate into something close to
-- total, and collects the email address at the moment somebody actually wants
-- to give it rather than before they have had any help.
--
-- Two star ratings, kept apart. "The therapist was excellent, the app kept
-- freezing" is one of the most useful sentences anyone can send us, and a
-- single rating destroys it.
--
-- Reports are a separate table because they have a lifecycle. A one-star
-- review is data; "he did not turn up and I paid" is a refund and a suspension,
-- and somebody has to be recorded as having decided that.

CREATE TABLE IF NOT EXISTS "session_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "therapist_id" uuid NOT NULL,
  "therapist_stars" integer NOT NULL,
  "service_stars" integer NOT NULL,
  "therapist_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "service_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "comment" text,
  "patient_email" text,
  "brief_sent_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "therapist_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "detail" text,
  "patient_email" text,
  "status" text DEFAULT 'open' NOT NULL,
  "resolution" text,
  "resolved_at" timestamp with time zone,
  "resolved_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_session_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_feedback" ADD CONSTRAINT "session_feedback_therapist_fk"
    FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_session_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_org_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_therapist_fk"
    FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_reports" ADD CONSTRAINT "session_reports_resolved_by_fk"
    FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "session_feedback_session_unique" ON "session_feedback" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_feedback_therapist_idx" ON "session_feedback" USING btree ("therapist_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_reports_status_idx" ON "session_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_reports_therapist_idx" ON "session_reports" USING btree ("therapist_id");
