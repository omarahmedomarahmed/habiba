-- Sessions that end.
--
-- A session ran until somebody pressed End. If nobody did — a laptop that
-- slept, a clinician who closed the tab — it stayed `in_progress` with a null
-- duration forever, holding a recording open and a radar slot occupied. One
-- such row is already in this database.
--
-- `extended_at` records the clinician choosing to continue past the half hour
-- the patient paid for; `auto_ended_reason` records the two cases where the
-- product ended it instead of a person.

ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "extended_at" timestamptz,
  ADD COLUMN IF NOT EXISTS "auto_ended_reason" text;

-- Everything already completed was ended by a person, so the reason stays null
-- for all of it. Nothing to backfill.
