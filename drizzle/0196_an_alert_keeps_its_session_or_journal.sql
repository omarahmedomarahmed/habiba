-- DD-2 gate: 0194's CHECK named person_id, which ON DELETE SET NULL can empty.
-- Every alert is written with a session or a journal reference (journal_ref has no foreign key and
-- is never emptied), so the check needs only those two and no column a delete can null.
ALTER TABLE "risk_assessments" DROP CONSTRAINT IF EXISTS "risk_assessments_subject_kept_chk";
DO $$ BEGIN
  ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_session_or_journal_chk"
    CHECK ("session_id" IS NOT NULL OR "journal_ref" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
