-- 11R.23 / C50 — the parser exists now, so re-queue what was refused for its absence.
--
-- Every PDF and .docx stored before this sprint was written `unsupported` by a
-- codebase that had no parser at all. That label is now wrong for a
-- single-column letter and still right for a two-column one, and the only way
-- to tell them apart is to run the extractor. So they go back to `pending` and
-- the hourly `extract` job decides.
--
-- Additive and idempotent (H16): it touches no schema, and the WHERE clause
-- stops matching the moment the rows are re-processed. Anything the new
-- extractor refuses is written `unsupported` again by the job, not by this.
--
-- Measured before writing: 0 rows in `person_documents` on the branch database,
-- so on today's data this is a no-op. It is here for the documents uploaded
-- between this migration being applied to production and the code that reads
-- them being deployed — H16's gap, in the harmless direction.
--
-- Images and legacy .doc are deliberately excluded: nothing changed for them.

UPDATE "person_documents"
   SET "extraction" = 'pending',
       "extracted_at" = NULL
 WHERE "extraction" = 'unsupported'
   AND lower(split_part("mime_type", ';', 1)) IN (
     'application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
   );
