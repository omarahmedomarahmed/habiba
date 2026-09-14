-- 🔴 THE CRISIS LINE BECOMES DATA, WHICH IS WHAT ITS OWN MODULE SAID TO DO.
--
-- `lib/crisis/line.ts` carries a warning it wrote about itself:
--
--   ⚠️ Incomplete until the lines are configured. Each country the platform
--   opens in needs its crisis line entered and checked by a person, it belongs
--   in `country_settings` beside the payment rail, and adding it there is the
--   fix rather than growing this list from memory.
--
-- That was written in sprint 21R and the table still has one entry: the United
-- States. Egypt is the first market. An Egyptian patient in crisis is shown
-- "call your local emergency number", which is honest and is not a number.
--
-- 🔴 WHY THIS MIGRATION SEEDS NOTHING.
--
-- The module's other sentence is the reason, and it is right: *"a WRONG crisis
-- number is worse than none, in the same way and for the same reason that the
-- wrong country's number is."* A number recalled by whoever wrote the migration
-- is exactly the thing that sentence forbids. So the columns arrive empty, an
-- operator enters each one with a phone in their hand, and the admin screen
-- lists every enabled country that has none.
--
-- 🔴 TWO COLUMNS, NOT ONE. The label is what a reader sees and the tel is what
-- the dialler dials, and they are not the same string: a line published as
-- "16328" dials as "16328", but one published as "0800 12 12 14" dials without
-- the spaces, and a `tel:` href built by stripping characters out of a display
-- label is a guess about a phone number.
ALTER TABLE country_settings
  ADD COLUMN IF NOT EXISTS crisis_line_label text;

ALTER TABLE country_settings
  ADD COLUMN IF NOT EXISTS crisis_line_tel text;

-- Who entered it and when, because "is this number still right" is a question
-- somebody asks a year later and the answer is a date and a name.
ALTER TABLE country_settings
  ADD COLUMN IF NOT EXISTS crisis_line_verified_at timestamptz;

ALTER TABLE country_settings
  ADD COLUMN IF NOT EXISTS crisis_line_verified_by uuid REFERENCES users (id) ON DELETE SET NULL;

-- 🔴 BOTH OR NEITHER. A label with no tel renders a number nobody can press;
-- a tel with no label renders a button with no name. Either half alone is a
-- worse state than the honest empty one.
ALTER TABLE country_settings DROP CONSTRAINT IF EXISTS country_settings_crisis_line_paired;
ALTER TABLE country_settings ADD CONSTRAINT country_settings_crisis_line_paired
  CHECK (
    (crisis_line_label IS NULL AND crisis_line_tel IS NULL)
    OR (crisis_line_label IS NOT NULL AND crisis_line_tel IS NOT NULL)
  )
  NOT VALID;
ALTER TABLE country_settings VALIDATE CONSTRAINT country_settings_crisis_line_paired;

-- Digits, and the characters a real published line uses. Not a free string: a
-- `tel:` href is dialled without anybody reading it first.
ALTER TABLE country_settings DROP CONSTRAINT IF EXISTS country_settings_crisis_tel_shape;
ALTER TABLE country_settings ADD CONSTRAINT country_settings_crisis_tel_shape
  CHECK (crisis_line_tel IS NULL OR crisis_line_tel ~ '^\+?[0-9]{3,15}$')
  NOT VALID;
ALTER TABLE country_settings VALIDATE CONSTRAINT country_settings_crisis_tel_shape;

COMMENT ON COLUMN country_settings.crisis_line_tel IS
  'What tel: dials. Entered and checked by a person, never seeded from memory: a wrong crisis number is worse than none. Null means the product says "call your local emergency number", which is always true and always actionable.';
