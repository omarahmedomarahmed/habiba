CREATE TABLE IF NOT EXISTS "person_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"document_count" integer DEFAULT 0 NOT NULL,
	"conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"source_id" uuid,
	"ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "homework_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"session_id" uuid,
	"assigned_by_user_id" uuid,
	"organization_id" uuid,
	"title" text NOT NULL,
	"detail" text,
	"source" text DEFAULT 'therapist' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by_account_id" uuid,
	"patient_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "person_profiles" ADD CONSTRAINT "person_profiles_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "observations" ADD CONSTRAINT "observations_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_person_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
 ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
 ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_user_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
 ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_org_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;
 ALTER TABLE "homework_items" ADD CONSTRAINT "homework_items_account_fk" FOREIGN KEY ("completed_by_account_id") REFERENCES "public"."patient_accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- 9.1: one profile per person, replaced wholesale. The unique index is what
-- makes "regenerated, never edited" enforceable rather than aspirational —
-- there is nowhere to keep a second, hand-written copy.
CREATE UNIQUE INDEX IF NOT EXISTS "person_profiles_person_unique" ON "person_profiles" USING btree ("person_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "observations_person_idx" ON "observations" USING btree ("person_id","observed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "observations_source_idx" ON "observations" USING btree ("source","source_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "homework_person_idx" ON "homework_items" USING btree ("person_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "homework_session_idx" ON "homework_items" USING btree ("session_id");

/*
 * Nothing is backfilled from `note_content.patientSteps`.
 *
 * Those steps were drafted into 97 existing notes and never agreed with
 * anybody. Turning them into live homework would hand every patient with an
 * account a list of tasks their therapist never set, dated to sessions that
 * ended months ago — and the first thing they would see on their own screen is
 * a backlog they had already failed. A clinician promotes a drafted step
 * deliberately, one at a time, from the session it belongs to.
 */
