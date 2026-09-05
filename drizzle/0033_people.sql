CREATE TABLE IF NOT EXISTS "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"email" text,
	"phone" text,
	"claimed_at" timestamp with time zone,
	"claimed_by_user_id" uuid,
	"preferred_country" text,
	"preferred_currency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "people" ADD CONSTRAINT "people_claimed_by_user_id_users_id_fk" FOREIGN KEY ("claimed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "people_claimed_email_unique" ON "people" USING btree ("email") WHERE "claimed_at" IS NOT NULL AND "email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "people_claimed_phone_unique" ON "people" USING btree ("phone") WHERE "claimed_at" IS NOT NULL AND "phone" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "people_email_idx" ON "people" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "people_phone_idx" ON "people" USING btree ("phone");--> statement-breakpoint

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "person_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "patients" ADD CONSTRAINT "patients_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "patients_person_idx" ON "patients" USING btree ("person_id");--> statement-breakpoint

/*
 * 5.3 — every patient becomes its own person. NO MERGING.
 *
 * One row in, one row out, even where two patients share an email. That is not
 * a limitation of the SQL; it is the rule. Measured on this database,
 * `omarabdelgawad001@gmail.com` sits on two patients named "Omar" and "Sam" in
 * two different organisations. Collapsing them on the strength of a matching
 * address would put one person's clinical record inside another's file, and a
 * clinician would then treat them on it.
 *
 * Matching happens later, as a suggestion a human confirms (5.4). This
 * statement deliberately cannot merge anything: it is INSERT ... SELECT with no
 * GROUP BY and no ON CONFLICT.
 *
 * Guarded by `person_id IS NULL` so re-running is a no-op rather than a second
 * person for every patient.
 */
WITH created AS (
  INSERT INTO "people" ("first_name", "last_name", "email", "phone", "created_at")
  SELECT
    p."first_name",
    p."last_name",
    lower(nullif(btrim(p."email"), '')),
    nullif(btrim(p."phone"), ''),
    p."created_at"
  FROM "patients" p
  WHERE p."person_id" IS NULL
  RETURNING "id", "first_name", "last_name", "email", "created_at"
)
UPDATE "patients" tgt
SET "person_id" = c."id"
FROM (
  SELECT
    c."id",
    row_number() OVER (ORDER BY c."created_at", c."id") AS rn
  FROM created c
) c
JOIN (
  SELECT
    p."id" AS patient_id,
    row_number() OVER (ORDER BY p."created_at", p."id") AS rn
  FROM "patients" p
  WHERE p."person_id" IS NULL
) q ON q.rn = c.rn
WHERE tgt."id" = q.patient_id;
