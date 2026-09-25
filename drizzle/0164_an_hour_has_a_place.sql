-- 🔴 0164: A BOOKABLE HOUR IS ONLINE, IN PERSON, OR EITHER (founder ruling 5c).
--
-- A therapist chooses, when they open hours, whether a patient can book them
-- to meet online, at their practice, or either; a patient booking an "either"
-- hour picks. Every existing hour was online, so that is the default.
ALTER TABLE "availability_slots" ADD COLUMN IF NOT EXISTS "place" text DEFAULT 'online' NOT NULL;
--> statement-breakpoint
ALTER TABLE "availability_slots" DROP CONSTRAINT IF EXISTS "availability_slots_place";
--> statement-breakpoint
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_place"
  CHECK ("place" IN ('online', 'in_person', 'either')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "availability_slots" VALIDATE CONSTRAINT "availability_slots_place";
