-- Admin control over the radar's country, language and specialty lists.
--
-- An override layer over the built-in lists rather than a replacement for
-- them. Absence of a row means "enabled", so a fresh database is a working
-- radar and not an empty one waiting for a seed script.

CREATE TABLE IF NOT EXISTS "taxonomy_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "code" text NOT NULL,
  "label" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "custom" boolean DEFAULT false NOT NULL,
  "updated_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "taxonomy_entries" ADD CONSTRAINT "taxonomy_entries_updated_by_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "taxonomy_entries_kind_code_unique" ON "taxonomy_entries" USING btree ("kind","code");
