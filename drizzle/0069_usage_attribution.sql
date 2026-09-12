-- Sprint 49 — cost attribution, on the table that already records it.
--
-- 🔴 Additive. H16: nothing applies migrations on deploy, so this runs against
-- production before main moves.
--
-- ## What this migration is NOT
--
-- 49.14 originally read "C221's cost table is a new table, not a column.
-- aiRequestLogs records no tokens and no price." Measured before building:
-- ai_request_logs records model, input_tokens, output_tokens, audio_seconds
-- and cost_microcents, and lib/ai/client.ts has written all of them on every
-- model call since before sprint 33. The verification database holds real
-- tokens and real prices for four call kinds.
--
-- A second usage table would mean thirteen call kinds writing to two places.
-- The two drift, and the first symptom is two different answers to "what did
-- this therapist cost us" on one screen. That is C226's argument about the pot
-- applied here, and C279 below is proof it is not theoretical: the same
-- divergence already happened between two columns of ONE table.
--
-- 🔴 49.14a / C280 — who the call was ABOUT, which is not who made it.
--
-- user_id is the clinician whose request it was. Without the patient, 49.8's
-- per-patient cost cannot be computed at all.
--
-- C280 names what this makes possible: a timestamped record of every model
-- call concerning a person, queryable by person. The shape of somebody's care
-- is legible in the timing and volume of these rows even though not one of
-- them contains a clinical word. Internal cost accounting only. Never
-- patient-facing, never clinic-facing, never sponsor-facing, and inside C244
-- from the day sponsors exist.
--
-- ON DELETE SET NULL rather than CASCADE, deliberately: deleting a patient
-- must not delete what their care cost us. A cost that disappears when a row
-- does is how a margin goes wrong quietly, and the money is ours rather than
-- theirs.
ALTER TABLE "ai_request_logs"
  ADD COLUMN IF NOT EXISTS "patient_id" uuid REFERENCES "patients"("id") ON DELETE SET NULL;

-- 49.8 asks for cost by patient over a range. Nothing is backfilled: a call
-- made before this column existed has no patient recorded and inventing one
-- from a session would be a guess about which of a session's people the model
-- was reasoning about.
CREATE INDEX IF NOT EXISTS "ai_request_logs_patient_idx"
  ON "ai_request_logs" ("patient_id", "created_at");
