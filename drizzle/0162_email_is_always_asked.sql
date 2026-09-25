-- 🔴 0162: EVERY ENROLMENT RULE ASKS FOR AN EMAIL (founder ruling 15, 25 September 2026).
--
-- A company chooses: a work-domain email, an email on the staff list it
-- uploads, or either one plus an employee ID. An ID alone is no longer a way
-- in, because a shape anyone can guess proves nothing and nobody can be told
-- when they leave.
--
-- The staff list is emails only, and none is stored readable: each row is the
-- same salted hash `enrolments.identifier_hash` uses for this company, so a
-- list can be checked against and joined to enrolments and never read back. An
-- upload replaces the list; a person no longer on it is marked `removed_at`,
-- and their benefit pauses once the grace period in settings has passed.
ALTER TABLE "sponsor_identifier_fields" DROP CONSTRAINT IF EXISTS "sponsor_identifier_kind";
--> statement-breakpoint
ALTER TABLE "sponsor_identifier_fields" ADD CONSTRAINT "sponsor_identifier_kind"
  CHECK ("kind" IN ('domain_email', 'id_number', 'listed_email')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "sponsor_identifier_fields" VALIDATE CONSTRAINT "sponsor_identifier_kind";
--> statement-breakpoint
ALTER TABLE "enrolments" DROP CONSTRAINT IF EXISTS "enrolments_identifier_kind";
--> statement-breakpoint
ALTER TABLE "enrolments" ADD CONSTRAINT "enrolments_identifier_kind"
  CHECK ("identifier_kind" IN ('domain_email', 'id_number', 'listed_email')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "enrolments" VALIDATE CONSTRAINT "enrolments_identifier_kind";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sponsor_email_list" (
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE CASCADE,
  "email_hash" text NOT NULL,
  "uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "removed_at" timestamp with time zone,
  PRIMARY KEY ("sponsor_id", "email_hash")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsor_email_list_removed" ON "sponsor_email_list" ("sponsor_id", "removed_at");
