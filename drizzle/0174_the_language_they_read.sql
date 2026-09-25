-- 🔴 0174: THE LANGUAGE A CLINICIAN SAYS THEIR PATIENT READS (B39). Additive.
--
-- A record invitation to a patient who had never signed in went out in English, because
-- `people.locale` is the person's own choice and nobody had made one yet, and the
-- add-patient form had nowhere to say "she reads Arabic". `patients.locale` is the
-- clinician's note. Messages read it only while the person has no choice of their own
-- (`recipientLocale`), so it never overrides them and never sets their screen.
--
-- Null on every existing row: nobody said, which is what the default language already meant.

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "locale" text;
--> statement-breakpoint
ALTER TABLE "patients" DROP CONSTRAINT IF EXISTS "patients_locale";
--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_locale" CHECK ("locale" IS NULL OR "locale" IN ('en', 'ar'));
