-- Sprint 27 — portability, which is the whole pitch.

-- 🔴 27.1 / C106 — a grant can only be HELD by a clinician whose verification
-- is approved. In the database, not in a code path.
--
-- A CHECK cannot do this: it constrains one row and the fact lives in another
-- table. So it is a trigger, which is also the only way to catch the case that
-- actually worries: not the insert, but an UPDATE that flips a long-standing
-- pending row to `granted` months after the clinician's approval lapsed.
--
-- `pending` is deliberately NOT gated (27.3): a patient may invite somebody who
-- has not finished verification, and the request waiting is the whole point.
-- What cannot happen is that request activating.
CREATE OR REPLACE FUNCTION "history_grants_require_verified"() RETURNS trigger AS $$
DECLARE
  approved boolean;
BEGIN
  IF NEW.status <> 'granted' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "therapist_verifications" v
    WHERE v.user_id = NEW.therapist_user_id AND v.state = 'approved'
  ) INTO approved;

  IF NOT approved THEN
    RAISE EXCEPTION 'history_grants: a grant cannot be held by a clinician whose verification is not approved'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "history_grants_verified_only" ON "history_grants";
CREATE TRIGGER "history_grants_verified_only"
  BEFORE INSERT OR UPDATE ON "history_grants"
  FOR EACH ROW EXECUTE FUNCTION "history_grants_require_verified"();

-- 27.2 / C102b — the patient invite.
--
-- The patient generates a code and hands it to their next therapist. Redeeming
-- it does NOT create access: it creates a REQUEST, which the patient then
-- approves in one tap. The patient gets the initiative and nobody gets a back
-- door, which is the difference between "invite your therapist" and the thing
-- this table must never become, a way to send a record.
CREATE TABLE IF NOT EXISTS "patient_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  -- Who made it. A patient account, never a clinician.
  "account_id" uuid NOT NULL,
  "code" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "redeemed_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "redeemed_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "patient_invites_code_unique" ON "patient_invites" ("code");
CREATE INDEX IF NOT EXISTS "patient_invites_person_idx" ON "patient_invites" ("person_id", "created_at" DESC);

ALTER TABLE "patient_invites" DROP CONSTRAINT IF EXISTS "patient_invites_shape";
ALTER TABLE "patient_invites"
  ADD CONSTRAINT "patient_invites_shape" CHECK ("code" ~ '^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$') NOT VALID;
ALTER TABLE "patient_invites" VALIDATE CONSTRAINT "patient_invites_shape";

-- Single use, in the database rather than in the redeem function.
ALTER TABLE "patient_invites" DROP CONSTRAINT IF EXISTS "patient_invites_redemption_complete";
ALTER TABLE "patient_invites"
  ADD CONSTRAINT "patient_invites_redemption_complete"
  CHECK (("redeemed_by_user_id" IS NULL) = ("redeemed_at" IS NULL)) NOT VALID;
ALTER TABLE "patient_invites" VALIDATE CONSTRAINT "patient_invites_redemption_complete";

-- 27.7 / C108 — "ask my previous therapist to add my history".
--
-- 🔴 An explicit row rather than a message, because C108's ruling is that a
-- silent request is worse than a refusal. The clinician sees it in a queue and
-- either adds something or declines **with a reason the patient reads**. We
-- cannot promise cooperation, so the product promises visibility instead.
CREATE TABLE IF NOT EXISTS "history_asks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "account_id" uuid NOT NULL,
  "therapist_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  -- What the patient wrote, in their words. Optional.
  "note" text,
  -- 🔴 Read by the patient verbatim, so it is never null on a decline.
  "decline_reason" text,
  "answered_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "history_asks_therapist_idx" ON "history_asks" ("therapist_user_id", "status");
CREATE INDEX IF NOT EXISTS "history_asks_person_idx" ON "history_asks" ("person_id", "created_at" DESC);

-- One open ask per pair, so a patient cannot be made to nag and a clinician
-- cannot be buried. Partial, so asking again after an answer is allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "history_asks_open_unique"
  ON "history_asks" ("person_id", "therapist_user_id") WHERE "status" = 'pending';

ALTER TABLE "history_asks" DROP CONSTRAINT IF EXISTS "history_asks_status_known";
ALTER TABLE "history_asks"
  ADD CONSTRAINT "history_asks_status_known"
  CHECK ("status" IN ('pending', 'added', 'declined')) NOT VALID;
ALTER TABLE "history_asks" VALIDATE CONSTRAINT "history_asks_status_known";

-- 🔴 C108, in the schema: a decline without a reason is not a decline.
ALTER TABLE "history_asks" DROP CONSTRAINT IF EXISTS "history_asks_decline_has_reason";
ALTER TABLE "history_asks"
  ADD CONSTRAINT "history_asks_decline_has_reason"
  CHECK ("status" <> 'declined' OR btrim(COALESCE("decline_reason", '')) <> '') NOT VALID;
ALTER TABLE "history_asks" VALIDATE CONSTRAINT "history_asks_decline_has_reason";
