-- Sprint 12 — the sweep. PLAN.md §4 · THE RESET.
--
-- Additive for uptime (H16), not for the data: every row this database holds is
-- test data and is being purged in sprint 22.

-- ---------------------------------------------------------------------------
-- 12.2 — every session is ratable.
--
-- `bookSlot` never minted a `feedback_token`, so a session booked from a public
-- profile could never be rated and its patient could never receive a brief.
-- C26 recorded the same defect in twenty historical rows; this was the same
-- defect still being created, in code, today.
--
-- Enforced as a CHECK marked NOT VALID rather than as `SET NOT NULL`, and the
-- distinction is the whole point:
--
--   SET NOT NULL scans the table and FAILS on the twenty existing null rows.
--   NOT VALID enforces on every insert and update from this moment, and does
--   not look at what is already there.
--
-- So the rule binds now, the deploy survives the gap, and nothing is
-- backfilled — a token minted today for a session held in August would assert
-- that a rating was possible, which is false. Sprint 22 purges those rows and
-- can then VALIDATE the constraint and convert it to a real NOT NULL.
DO $$
BEGIN
  ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_feedback_token_present"
    CHECK ("feedback_token" IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 12.4 — a therapist-created patient record carries a phone number (§3b).
--
-- The number is the identity in this market and it is how a therapist invites
-- somebody to claim their record. Same NOT VALID reasoning: 0 of 66 existing
-- patients have a phone, so `SET NOT NULL` would fail outright, and every one
-- of those rows is going.
--
-- 🔴 Scoped to `source = 'therapist'` deliberately, and this is not a
-- weakening. §3b makes the number mandatory *when a therapist creates a
-- record*, because that is the moment somebody is present who knows it and can
-- be told why we are asking. A `join_link` patient typed their own name into a
-- booking form where §3b says email is a complete fallback — requiring a phone
-- there would refuse a real booking from somebody who only has an address.
--
-- The E.164 shape is checked for both, because a column that only WhatsApp
-- validates is a column that eventually holds something WhatsApp bounces.
DO $$
BEGIN
  ALTER TABLE "patients"
    ADD CONSTRAINT "patients_phone_present"
    CHECK (
      ("source" = 'therapist' AND "phone" IS NOT NULL)
      OR "source" <> 'therapist'
    ) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "patients"
    ADD CONSTRAINT "patients_phone_e164"
    CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{6,14}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One constraint per DO block (C66): a duplicate on the first silently skips
-- everything after it in the same block.
DO $$
BEGIN
  ALTER TABLE "patient_accounts"
    ADD CONSTRAINT "patient_accounts_phone_e164"
    CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{6,14}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "people"
    ADD CONSTRAINT "people_phone_e164"
    CHECK ("phone" IS NULL OR "phone" ~ '^\+[1-9][0-9]{6,14}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
