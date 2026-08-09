-- Per-patient copilot conversation.
--
-- One thread per patient. The uniqueness constraint is the isolation guarantee:
-- there is no shape of query that produces a thread spanning two patients.

CREATE TABLE IF NOT EXISTS "copilot_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "patient_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "therapist_id" uuid NOT NULL,
  "guidance" text,
  "last_message_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "copilot_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "session_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "copilot_threads" ADD CONSTRAINT "copilot_threads_patient_id_fk"
    FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "copilot_threads" ADD CONSTRAINT "copilot_threads_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "copilot_threads" ADD CONSTRAINT "copilot_threads_therapist_id_fk"
    FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_thread_id_fk"
    FOREIGN KEY ("thread_id") REFERENCES "public"."copilot_threads"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_session_id_fk"
    FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "copilot_threads_patient_unique" ON "copilot_threads" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "copilot_threads_therapist_idx" ON "copilot_threads" USING btree ("therapist_id","last_message_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "copilot_messages_thread_idx" ON "copilot_messages" USING btree ("thread_id","created_at");
