-- A patient asking for their own record.
--
-- The alternative on the table was admin impersonation — log in as the
-- clinician, find the chart, send it on. That gives a support agent a fully
-- authenticated view of a stranger's therapy notes to satisfy a request that
-- was never about the support agent. This does the same job with nobody
-- reading anything: the link goes to the patient, and whoever pressed the
-- button never sees the contents.
--
-- The token is hashed at rest for the same reason a session cookie is. Nothing
-- is snapshotted: the record is rendered when the link is opened, so a leaked
-- backup of this table is a list of timestamps, not a list of charts.

CREATE TABLE IF NOT EXISTS "data_exports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,
  "token_hash" text NOT NULL,
  "delivered_to" text NOT NULL,
  "requested_by" uuid,
  "requested_by_role" text,
  "expires_at" timestamp with time zone NOT NULL,
  "first_opened_at" timestamp with time zone,
  "open_count" integer DEFAULT 0 NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_patient_id_fk"
    FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_requested_by_fk"
    FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "data_exports_token_unique" ON "data_exports" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "data_exports_patient_idx" ON "data_exports" USING btree ("patient_id","created_at");
