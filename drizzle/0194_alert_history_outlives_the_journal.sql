-- 0194: A CRISIS ALERT OUTLIVES THE JOURNAL AND THE PERSON IT CAME FROM.
--
-- Review: 0192 hung journal alerts off journals and people with ON DELETE CASCADE, so
-- deleting a journal entry (or erasing a person) deleted the alert row, even while it
-- was escalating to a clinician or the platform on-call. Both foreign keys are now
-- ON DELETE SET NULL, and `journal_ref` keeps which journal raised the alert, with no
-- foreign key. The subject check is replaced: every row keeps a session, a person or
-- that stored reference.
--
-- Safe to apply before the deploy (H16): a nullable column, a backfill and constraint
-- swaps. The running build never writes journal_ref, and every row it writes for a
-- journal also names the person, so the new check holds for it.

ALTER TABLE "risk_assessments" ADD COLUMN IF NOT EXISTS "journal_ref" uuid;
--> statement-breakpoint
UPDATE "risk_assessments" SET "journal_ref" = "journal_id" WHERE "journal_ref" IS NULL AND "journal_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "risk_assessments" DROP CONSTRAINT IF EXISTS "risk_assessments_subject_chk";
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_subject_kept_chk"
    CHECK ("session_id" IS NOT NULL OR "person_id" IS NOT NULL OR "journal_ref" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- The 0192 foreign keys were declared inline, so their names are Postgres defaults. Drop
-- whatever foreign key sits on each column, then add it back with SET NULL.
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT c.conname
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'risk_assessments'::regclass
       AND c.contype = 'f'
       AND a.attname IN ('journal_id', 'person_id')
  LOOP
    EXECUTE format('ALTER TABLE "risk_assessments" DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_journal_id_journals_id_fk"
  FOREIGN KEY ("journal_id") REFERENCES "journals"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_person_id_people_id_fk"
  FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE SET NULL;
