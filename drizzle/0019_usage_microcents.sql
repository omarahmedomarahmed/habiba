-- Money, at a precision that can actually hold the numbers.
--
-- `cost_cents` is an integer, and every cost was rounded into it. A thirty
-- second transcription costs 0.15 cents and a gpt-4o-mini copilot call costs
-- about 0.014 — both round to zero. The result was accounting that existed,
-- ran on every call, and reported nothing:
--
--     kind        calls   audio_s   recorded
--     transcribe    115       902     0 cents
--     copilot        10         -     0 cents
--     note           12         -     9 cents  (3 of them zero)
--
-- 127 of 139 calls, 91%, recorded exactly zero. Any per-therapist analytics
-- built on this would have shown every clinician costing nothing, and the
-- first person to notice would have been whoever compared it to the OpenAI
-- invoice.
--
-- Microcents — a thousandth of a cent — because the smallest thing we bill for
-- is a few hundredths of a cent and integers are the only sane way to hold
-- money. A float would reintroduce the same class of bug more quietly.
--
-- The backfill recomputes history from the tokens and audio seconds already
-- stored, so the existing rows become accurate rather than staying zero. The
-- rates are the same ones the application uses: gpt-4o 250/1000 cents per
-- million in/out, gpt-4o-mini 15/60, transcription 0.3 cents per audio minute.

ALTER TABLE "ai_request_logs"
  ADD COLUMN IF NOT EXISTS "cost_microcents" bigint NOT NULL DEFAULT 0;

UPDATE "ai_request_logs"
SET "cost_microcents" = CASE
  WHEN kind = 'transcribe'
    THEN round((audio_seconds / 60.0) * 0.3 * 1000)
  WHEN model = 'gpt-4o-mini'
    THEN round(((input_tokens / 1000000.0) * 15 + (output_tokens / 1000000.0) * 60) * 1000)
  ELSE
    round(((input_tokens / 1000000.0) * 250 + (output_tokens / 1000000.0) * 1000) * 1000)
END
WHERE "cost_microcents" = 0;

-- Per-therapist analytics reads by user over a date range; the existing
-- indexes cover organisation and session but not this.
CREATE INDEX IF NOT EXISTS "ai_request_logs_user_idx"
  ON "ai_request_logs" ("user_id", "created_at" DESC);
