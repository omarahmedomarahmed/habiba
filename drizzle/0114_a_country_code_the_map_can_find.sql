-- A country code the map can find.
--
-- The public radar globe has been empty since the demo cast was seeded. Two clinicians
-- are online in Cairo, the list beside the globe shows both, the counter says "2
-- therapists available now", and there is not one dot on the world.
--
-- `therapist_radar.country` is documented in the schema as "ISO-3166 alpha-2", which is
-- uppercase by definition, and every write path in the product honours that:
--
--   app/(app)/on-call/actions.ts:62        .slice(0, 2).toUpperCase()
--   app/(app)/onboarding/actions.ts:78     .slice(0, 2).toUpperCase()
--   app/(admin)/admin/actions.ts:796       .slice(0, 2).toUpperCase()
--   lib/geocode.ts:87                      countryCode.toUpperCase()
--
-- `scripts/seed-demo.ts` does not, because it writes the row as raw SQL and reached for
-- the wrong 'eg'. There are two in this codebase and they are not the same value:
-- `organizations.region` is a MARKET code and is lowercase on purpose ('eg', 'us'), and
-- the line above this INSERT uses it correctly. The INSERT then put that same market
-- code into the radar's ISO country column, and into `region`, which is supposed to hold
-- a governorate:
--
--     VALUES (..., 'eg', 'eg', 'Cairo', now(), true)
--                   ^^^^  ^^^^
--                country  region
--
-- Observed on production, from /api/radar today:
--
--     Sara Demo        country='eg'  region='eg'  city='Cairo'  status=online
--     Omar Abdelgawad  country='eg'  region='eg'  city='Cairo'  status=online
--
-- WHY ONLY THE MAP BROKE, and this is the part worth keeping. Half the readers of this
-- column normalise and half do not, so one bad value behaved correctly in the places
-- that would have made it obvious and vanished only where nobody could see why:
--
--   getCountrySettings   uppercases its argument     VAT and pricing were CORRECT
--   countryName          uppercases its argument     the card said "Egypt"
--   countryFlag          uppercases its argument     the flag was CORRECT
--   countryPoint         does NOT                    placed at the fallback point
--   Globe                does NOT                    WORLD['eg'] is undefined, NO DOT
--
-- Three readers right, two wrong, and the three that were right are the loud ones. A
-- clinician whose card says Egypt, beside an Egyptian flag, priced in Egyptian pounds,
-- reads as correctly configured to anybody checking, which is why this sat on production
-- with the globe empty and nobody could see what was missing.
--
-- And one that is not cosmetic. 50.1b closes a country by `notInArray(country, closed)`,
-- with the closed set coming from `taxonomy_entries`, whose codes are seeded from
-- `countries.json` and are uppercase. An operator closing EG would NOT have taken a
-- clinician stored as 'eg' off the radar. The audit log would have recorded the closure
-- and the clinician would have stayed bookable. That is the same shape of failure as
-- 0112 two migrations ago, on the column immediately beside the one 0112 fixed, in the
-- same INSERT statement, and it was not noticed then because nothing asserted it.
--
-- So: repair what is there, then make the column refuse to be wrong again. The repair
-- runs first because the constraint would not validate against the existing rows.
--
-- NULL stays legal. The schema is explicit that a clinician with no country is not
-- hidden from the radar, only from the map, and turning that into a write failure would
-- block a signup over a field the product treats as optional.

UPDATE therapist_radar
   SET country = upper(country)
 WHERE country IS NOT NULL
   AND country <> upper(country);

UPDATE therapist_verifications
   SET country = upper(country)
 WHERE country IS NOT NULL
   AND country <> upper(country);

-- The governorate the seed overwrote with a market code. Narrow on purpose: demo rows
-- only, and only where `region` is still holding the country instead of a place name.
UPDATE therapist_radar
   SET region = 'Cairo Governorate'
 WHERE demo IS TRUE
   AND city = 'Cairo'
   AND upper(region) = 'EG';

ALTER TABLE therapist_radar
  ADD CONSTRAINT therapist_radar_country_iso
  CHECK (country IS NULL OR country ~ '^[A-Z]{2}$');

ALTER TABLE therapist_verifications
  ADD CONSTRAINT therapist_verifications_country_iso
  CHECK (country IS NULL OR country ~ '^[A-Z]{2}$');
