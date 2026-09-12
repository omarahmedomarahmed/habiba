-- Sprint 47 — a note carries how it was made.
--
-- 🔴 Additive. H16: nothing applies migrations on deploy, so this runs against
-- production before main moves.

-- 🔴 47.1 / C212. `clinician` is the DEFAULT and that is the decision: a note
-- whose origin we cannot establish is a note nobody can vouch for a transcript
-- behind. The honest answer rather than the flattering one.
ALTER TABLE "session_notes"
  ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'clinician' NOT NULL;

-- 47.2 / C213. Only meaningful on `partial`; null everywhere else. A badge
-- saying "partially recorded" with no duration is one nobody can act on.
ALTER TABLE "session_notes"
  ADD COLUMN IF NOT EXISTS "off_record_seconds" integer;

-- 🔴 THE BACKFILL, and why this one is legitimate when 0066's was not.
--
-- Sprint 46 deliberately did not backfill `session_credits`, because valuing a
-- past purchase would have meant re-deriving it from settings that have since
-- changed. This is the opposite case: `recording_consent` and
-- `transcript_segments` are historical facts recorded at the time, so reading
-- them is reading history rather than inventing it.
--
-- 🔴 It reads the SEGMENTS as well as the consent, and that is not what 47.1
-- literally says. Consent alone would badge a session `transcript` when the
-- patient agreed and the capture then failed, which is a note written from
-- memory wearing a transcript's badge -- a lie in the flattering direction,
-- which is the exact failure C212 exists to prevent. Consent is permission;
-- segments are evidence. Only a session with both is `transcript`.
--
-- Everything else stays `clinician` by the column default, untouched.
UPDATE "session_notes" n
SET "provenance" = 'transcript'
FROM "sessions" s
WHERE n."session_id" = s."id"
  AND s."recording_consent" = 'granted'
  AND EXISTS (SELECT 1 FROM "transcript_segments" t WHERE t."session_id" = s."id");

-- 🔴 Then the part-recorded ones, from the same gap arithmetic the radar
-- investigation screen has used since sprint 33: a silence longer than the
-- threshold between two consecutive segments is time the clinician spent off
-- record. Narrowed to rows the statement above set, so a session with no
-- segments cannot be demoted from `clinician` into `partial`.
WITH gaps AS (
  SELECT
    t."session_id",
    SUM(t."start_ms" - t."prev_end") / 1000 AS off_seconds
  FROM (
    SELECT
      "session_id",
      "start_ms",
      LAG("end_ms") OVER (PARTITION BY "session_id" ORDER BY "sequence") AS "prev_end"
    FROM "transcript_segments"
  ) t
  -- 20_000ms, which is OFF_RECORD_THRESHOLD_MS in lib/data/feedback.ts. The
  -- two must agree or a backfilled note and a freshly saved one would disagree
  -- about the same session.
  WHERE t."prev_end" IS NOT NULL AND t."start_ms" - t."prev_end" > 20000
  GROUP BY t."session_id"
)
UPDATE "session_notes" n
SET "provenance" = 'partial',
    "off_record_seconds" = g.off_seconds
FROM gaps g
WHERE n."session_id" = g."session_id"
  AND n."provenance" = 'transcript';

CREATE INDEX IF NOT EXISTS "session_notes_provenance_idx"
  ON "session_notes" ("provenance");
