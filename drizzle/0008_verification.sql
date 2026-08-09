-- Who a clinician actually is.
--
-- We are asking a stranger on the internet to conduct therapy with vulnerable
-- people under our name and take money for it. Its own table because it is a
-- submission with a lifecycle, and because it holds document URLs that must
-- never be selected by a query that only wants a name.

CREATE TABLE IF NOT EXISTS "therapist_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "state" text DEFAULT 'draft' NOT NULL,
  "country" text,
  "license_body" text,
  "license_number" text,
  "license_expiry" text,
  "specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "id_front_url" text,
  "id_back_url" text,
  "license_doc_url" text,
  "headshot_url" text,
  "submitted_at" timestamp with time zone,
  "reviewed_at" timestamp with time zone,
  "reviewed_by" uuid,
  "review_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "therapist_verifications" ADD CONSTRAINT "therapist_verifications_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "therapist_verifications" ADD CONSTRAINT "therapist_verifications_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "therapist_verifications" ADD CONSTRAINT "therapist_verifications_reviewed_by_fk"
    FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "therapist_verifications_user_unique" ON "therapist_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "therapist_verifications_state_idx" ON "therapist_verifications" USING btree ("state","submitted_at");
