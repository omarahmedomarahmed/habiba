ALTER TABLE "transcript_segments" ADD COLUMN IF NOT EXISTS "words_per_minute" integer;--> statement-breakpoint
ALTER TABLE "transcript_segments" ADD COLUMN IF NOT EXISTS "pause_before_ms" integer;
