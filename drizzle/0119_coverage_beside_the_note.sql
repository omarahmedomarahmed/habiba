-- W1-24: coverage beside the note, never inside it.
--
-- `draftNote` prepended our coverage sentence ("Recording started 10 minutes
-- into this session. ...") to every partner note draft, so consent and
-- recording text written by the machine sat inside a chart entry. The code now
-- stores the clinical text alone and returns coverage as its own field.
--
-- This takes the sentence back off drafts already stored. Only `note_draft`:
-- `note_approved_text` is what a partner's clinician signed, and a signed text
-- is not ours to rewrite (W1-03). The three shapes are exactly what
-- `coverageSentence` produces, anchored at the start, so no clinical sentence
-- can match.
UPDATE "partner_sessions"
   SET "note_draft" = regexp_replace(
         "note_draft",
         '^(This session was recorded from the start\.|This session was not recorded\. Nothing here was written from audio\.|Recording started [0-9]+ minutes? into this session\. Nothing before that was recorded, and nothing here was written from it\.)\s*',
         ''
       ),
       "updated_at" = now()
 WHERE "note_draft" ~ '^(This session was recorded from the start\.|This session was not recorded\. |Recording started [0-9]+ minutes? into this session\. )';
