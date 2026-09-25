-- 🔴 0176: A NOTE SAYS WHEN ONLY ONE SIDE OF A VIDEO CALL WAS CAPTURED. Additive.
--
-- B61. A video session records two tracks in the clinician's browser: their own
-- microphone and the patient's audio from the call. When the patient's track never
-- arrives (the call did not connect, or it dropped for the whole session), the
-- transcript holds the clinician's words alone, and the note still said "The whole
-- session was captured and this note was drafted from it". A reader then takes what
-- the note says the patient said as heard, when nobody heard it.
--
-- `captured_side` is stamped at save beside `provenance`, for the same reason: it is a
-- fact about the session that produced the note, and the segments that prove it can be
-- deleted under retention. Null is "no single side to name" (both tracks, one room
-- microphone, or no recording). 'clinician' is the only value today.

ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "captured_side" text;
--> statement-breakpoint
ALTER TABLE "session_notes" DROP CONSTRAINT IF EXISTS "session_notes_captured_side";
--> statement-breakpoint
ALTER TABLE "session_notes" ADD CONSTRAINT "session_notes_captured_side"
  CHECK ("captured_side" IS NULL OR "captured_side" IN ('clinician'));
--> statement-breakpoint
-- Notes already written over one side, while their segments are still on file. The
-- same condition as `capturedSideFor` in lib/data/feedback.ts.
UPDATE "session_notes" n
   SET "captured_side" = 'clinician'
  FROM "sessions" s
 WHERE s.id = n.session_id
   AND n.provenance <> 'clinician'
   AND n.captured_side IS NULL
   AND s.modality = 'video'
   AND NOT EXISTS (
     SELECT 1 FROM session_sources src
      WHERE src.session_id = s.id AND src.kind NOT IN ('24t_room', 'in_person'))
   AND EXISTS (SELECT 1 FROM transcript_segments t WHERE t.session_id = s.id)
   AND NOT EXISTS (
     SELECT 1 FROM transcript_segments t
      WHERE t.session_id = s.id AND t.speaker = 'patient' AND t.speaker_inferred = false);
