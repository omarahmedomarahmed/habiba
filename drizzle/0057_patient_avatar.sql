-- 25.7 / C115 — the patient's own picture and their own name.
--
-- `avatar_url` holds the storage path, never a URL a browser is given. The
-- ruling is that the image is served through an authenticated route like a
-- document, so the column is an internal handle and `/api/patient/avatar/:id`
-- is the only way out of it.
--
-- Additive, nullable, nothing backfilled: every existing person keeps the
-- initial-letter circle they have today.
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "avatar_url" text;

-- Who put it there and when, so an admin removing one has something to read
-- and so a removal is distinguishable from never having uploaded.
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "avatar_updated_at" timestamp with time zone;
