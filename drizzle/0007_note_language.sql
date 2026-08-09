-- Notes in the language the session was actually held in.
--
-- A clinician working in Arabic should sign an Arabic note, not translate one
-- back in their head. The English copy sits alongside as a convenience for a
-- supervisor, an insurer or us — never as a replacement for the signed record.

ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "language" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "content_en" jsonb;
