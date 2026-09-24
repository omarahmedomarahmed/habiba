-- W1-30: a late start beside our own note, never inside it.
--
-- `generateAndStoreNote` prepended the 7.8 stamp ("Recording began at 10:10;
-- the first 10 minutes of this session were not captured and do not exist.")
-- to the summary of every late-recorded session's note, and to its English
-- copy. That is a recording fact written by the machine into clinical text,
-- the pattern 0119 took out of partner drafts. The code no longer writes it:
-- the same fact is the note's provenance (`partial`, `off_record_seconds`),
-- shown above the note.
--
-- Data only, and drafts only, as 0119: a note the clinician signed or a copy
-- they released is their words now and is not ours to rewrite (W1-03). The
-- pattern is exactly what `lateRecordingStamp` produces, anchored at the start,
-- with the blank line the prepend added, so no clinical sentence can match.
UPDATE "session_notes"
   SET "content" = jsonb_set(
         "content", '{summary}',
         to_jsonb(regexp_replace(
           "content"->>'summary',
           '^Recording began at [0-9]{2}:[0-9]{2}( UTC)?; the first [0-9]+ minutes? of this session were not captured and do not exist\.(\n\n)?',
           ''
         ))
       ),
       "updated_at" = now()
 WHERE "status" = 'draft' AND "patient_status" = 'draft'
   AND "content"->>'summary' ~ '^Recording began at [0-9]{2}:[0-9]{2}( UTC)?; the first [0-9]+ minutes? of this session were not captured';

UPDATE "session_notes"
   SET "content_en" = jsonb_set(
         "content_en", '{summary}',
         to_jsonb(regexp_replace(
           "content_en"->>'summary',
           '^Recording began at [0-9]{2}:[0-9]{2}( UTC)?; the first [0-9]+ minutes? of this session were not captured and do not exist\.(\n\n)?',
           ''
         ))
       ),
       "updated_at" = now()
 WHERE "status" = 'draft' AND "patient_status" = 'draft'
   AND "content_en" IS NOT NULL
   AND "content_en"->>'summary' ~ '^Recording began at [0-9]{2}:[0-9]{2}( UTC)?; the first [0-9]+ minutes? of this session were not captured';
