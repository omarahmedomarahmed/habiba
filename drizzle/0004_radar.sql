-- Crisis Radar: who is available right now.
--
-- The double-booking guarantee is a conditional UPDATE against `status`, not
-- application logic — see `claimTherapist`. `pending_until` makes the claim
-- self-healing when a patient abandons a checkout.

CREATE TABLE IF NOT EXISTS "therapist_radar" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "organization_id" uuid NOT NULL,
  "status" text DEFAULT 'offline' NOT NULL,
  "headline" text,
  "photo_url" text,
  "languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "specialties" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "country" text,
  "pending_session_id" uuid,
  "pending_until" timestamp with time zone,
  "last_seen_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "therapist_radar" ADD CONSTRAINT "therapist_radar_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "therapist_radar" ADD CONSTRAINT "therapist_radar_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "therapist_radar" ADD CONSTRAINT "therapist_radar_pending_session_id_fk"
    FOREIGN KEY ("pending_session_id") REFERENCES "public"."sessions"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "therapist_radar_user_unique" ON "therapist_radar" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "therapist_radar_status_idx" ON "therapist_radar" USING btree ("status","last_seen_at");
