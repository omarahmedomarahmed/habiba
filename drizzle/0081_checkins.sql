-- 0081 — check-ins. PLAN.md 44.1, 44.2, 22R.11, 22R.12, C97. Additive.
--
-- 🔴 THREE TABLES, AND TWO OF THEM ARE DEFINED BY WHAT THEY CANNOT HOLD.
--
-- 44.2: *a check-in is not a clinical assessment: it asks, it never interprets, and a worrying
-- reply goes to the crisis path rather than to a copilot.*
--
-- `checkin_replies` therefore has no score, no mood, no sentiment, no risk level, no summary and no
-- model output. Not "not populated yet" — there is nowhere to put one, so an edit that wanted to
-- interpret a reply has to add a column in a diff somebody reads. The interpretation that DOES
-- happen belongs to `risk_assessments`, written by the same `scanForCrisisLanguage` and
-- `raiseCrisisAlert` a session transcript goes through: one crisis path, reached from two places.
--
-- 🔴 AND `checkin_mutes` IS AN EVENT LOG RATHER THAN A BOOLEAN, WHICH IS THE WHOLE MEASUREMENT.
--
-- C97's warning is that *a person who mutes it is worse off than one who was messaged less*, and
-- the ruling was to measure the mute rate. A boolean on `people` answers "how many are muted
-- today"; a row with a timestamp answers "did lowering the cadence help", which is the only
-- question worth asking. Unmuting stamps `unmuted_at` and keeps the row, because deleting it would
-- erase the evidence that the cadence drove somebody away.

CREATE TABLE IF NOT EXISTS "checkins" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 🔴 The PERSON, not the patient record. Somebody seen by two clinicians has two `patients`
  -- rows, and messaging them twice as often because of our filing is exactly C97's harm.
  "person_id"  uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,

  "channel"    text NOT NULL,
  -- What WE said. Kept so the next one can be worded differently (44.1 asks for that), and it
  -- carries nothing about them by construction: a check-in asks how somebody is.
  "body"       text NOT NULL,
  "locale"     text NOT NULL DEFAULT 'en',

  "sent_at"    timestamptz NOT NULL DEFAULT now(),
  "delivered"  boolean NOT NULL DEFAULT false,

  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "checkins" DROP CONSTRAINT IF EXISTS "checkins_channel";
ALTER TABLE "checkins"
  ADD CONSTRAINT "checkins_channel"
  CHECK ("channel" IN ('email', 'whatsapp')) NOT VALID;
ALTER TABLE "checkins" VALIDATE CONSTRAINT "checkins_channel";

-- The cadence query: the most recent check-in for one person.
CREATE INDEX IF NOT EXISTS "checkins_person_sent_idx" ON "checkins" ("person_id", "sent_at");

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "checkin_replies" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "checkin_id"          uuid NOT NULL REFERENCES "checkins"("id") ON DELETE CASCADE,
  "person_id"           uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,

  -- 🔴 Their words, as they wrote them. The only thing on this row that is theirs.
  "body"                text NOT NULL,

  -- 🔴 A FACT, NOT A FINDING: that this went to the crisis path. No level, no category, no
  -- confidence, because those would be this table interpreting. The finding lives in
  -- `risk_assessments`, written by the ordinary path.
  "crisis_alert_raised" boolean NOT NULL DEFAULT false,

  "received_at"         timestamptz NOT NULL DEFAULT now(),
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "checkin_replies_person_idx"  ON "checkin_replies" ("person_id");
CREATE INDEX IF NOT EXISTS "checkin_replies_checkin_idx" ON "checkin_replies" ("checkin_id");

-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "checkin_mutes" (
  "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "person_id"  uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,

  "muted_at"   timestamptz NOT NULL DEFAULT now(),
  -- Stamped if they turn it back on. The row stays, so the rate stays measurable.
  "unmuted_at" timestamptz,
  -- 'reply' is somebody who had had enough; 'screen' is somebody making a settings choice. A mute
  -- rate that mixed the two would hide the number that matters.
  "via"        text NOT NULL,

  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "checkin_mutes" DROP CONSTRAINT IF EXISTS "checkin_mutes_via";
ALTER TABLE "checkin_mutes"
  ADD CONSTRAINT "checkin_mutes_via"
  CHECK ("via" IN ('reply', 'screen')) NOT VALID;
ALTER TABLE "checkin_mutes" VALIDATE CONSTRAINT "checkin_mutes_via";

-- 🔴 An unmute cannot precede its mute. A row with the two the wrong way round would make the mute
-- rate negative for a window, and a metric that can go negative is a metric nobody trusts.
ALTER TABLE "checkin_mutes" DROP CONSTRAINT IF EXISTS "checkin_mutes_unmute_after_mute";
ALTER TABLE "checkin_mutes"
  ADD CONSTRAINT "checkin_mutes_unmute_after_mute"
  CHECK ("unmuted_at" IS NULL OR "unmuted_at" >= "muted_at") NOT VALID;
ALTER TABLE "checkin_mutes" VALIDATE CONSTRAINT "checkin_mutes_unmute_after_mute";

-- 🔴 ONE LIVE MUTE PER PERSON, partial so the history stays beside it. Without this, muting twice
-- counts somebody twice in the rate, and the rate is the thing this sprint was told to measure.
CREATE UNIQUE INDEX IF NOT EXISTS "checkin_mutes_live_unique"
  ON "checkin_mutes" ("person_id") WHERE "unmuted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "checkin_mutes_muted_at_idx" ON "checkin_mutes" ("muted_at");
