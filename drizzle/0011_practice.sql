-- A physical practice, and whether people may turn up to it.
--
-- Region and city are free text from the geocoder rather than a picker: a
-- hand-maintained list of first-level divisions for ninety countries is a
-- promise nobody keeps, and the only thing we do with them is group and filter.
--
-- Latitude and longitude are text, not numeric. They are written once from a
-- geocoder, read back as strings into a maps URL, and never arithmetic'd; a
-- float column would invite exactly the "why is the pin 40 metres off"
-- rounding conversation for no benefit.

ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "region" text;--> statement-breakpoint
ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "city" text;--> statement-breakpoint
ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "practice_name" text;--> statement-breakpoint
ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "practice_address" text;--> statement-breakpoint
ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "practice_lat" text;--> statement-breakpoint
ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "practice_lon" text;--> statement-breakpoint
ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "practice_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "therapist_radar" ADD COLUMN IF NOT EXISTS "accepts_walk_ins" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Filtering the map by "who is in this country / this region" is the common
-- read once the globe ships, and it is a scan without this.
CREATE INDEX IF NOT EXISTS "therapist_radar_place_idx" ON "therapist_radar" USING btree ("country","region");
