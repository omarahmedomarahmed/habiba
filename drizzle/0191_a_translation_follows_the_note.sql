-- 0191: A TRANSLATION FOLLOWS THE NOTE, AND HOW TO ADDRESS THE PATIENT. Additive.
--
-- DD-2: the machine English copy of a note was written once and never again, so a
-- clinician's edit left an unreviewed translation saying what the signed note no
-- longer said. `content_en_source` holds md5(content::text) at the moment the
-- translation was written; the app reads the translation only while the two match.
-- Existing translations have no source and are therefore hidden until written again
-- (on signing): we cannot tell which of them were edited after translation.
--
-- DD-2: `patients.address_as` is the clinician's answer to how the patient is
-- referred to in a gendered language ('female', 'male'; null for not said), so an
-- Arabic note does not default to the masculine.
--
-- Both columns are nullable and nothing is backfilled. Safe to apply before the
-- deploy (H16): the running build neither reads nor writes either.

ALTER TABLE "session_notes" ADD COLUMN IF NOT EXISTS "content_en_source" text;
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "address_as" text;
--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_address_as";
--> statement-breakpoint
ALTER TABLE "patients"
  ADD CONSTRAINT "patients_address_as" CHECK ("address_as" IS NULL OR "address_as" IN ('female', 'male')) NOT VALID;
--> statement-breakpoint
ALTER TABLE "patients" VALIDATE CONSTRAINT "patients_address_as";
