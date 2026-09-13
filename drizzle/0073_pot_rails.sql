-- 0073 — the pot's two corrections. PLAN.md 53.10, 53.19b. Additive.
--
-- Both of these are things 0072 got wrong rather than things sprint 53 grew
-- into, and both are fixed forward instead of by editing 0072: 0072 is already
-- applied somewhere, and a migration whose hash changes after it has run is the
-- H1/H16 failure mode this repository verifies against `information_schema`
-- precisely because `db:migrate` prints success either way.

-- ------------------------------------------ the fifth and sixth crossings (53.10) --
--
-- 🔴 `pot_held_to_connect` and `pot_held_to_manual`. A sponsor prepaid, a session
-- spent it, and we pay the clinician out of money on our own balance.
--
-- Own values rather than `usd_stripe_to_connect`, because `holdsMoney` reads that
-- one as "we never touch it" and a pot is held for longer than anything else on
-- these rails: between a top-up and whenever a third party spends it.
--
-- 🔴 TWO of them, and the split matters. A pot paying an Egyptian clinician is USD
-- into the US entity and EGP out of the Egyptian one, which is cross-border and
-- needs an explicit `entity_transfer`. One combined value would have made
-- `isCrossBorder` answer false for every pot session, which is the §6 family: a
-- predicate reading green because it was asked the wrong question.
--
-- 🔴 THIS IS THE SPRINT 56 DEFECT, PRE-EMPTED. `CROSSINGS` in schema.ts gained a
-- value; this CHECK is where the database learns about it. In sprint 56 the
-- TypeScript enum was extended and the migration's CHECK was not, so a whole
-- verifier check was structurally dead while reading green, and only a CONTROL
-- assertion found it.
ALTER TABLE "session_payments" DROP CONSTRAINT IF EXISTS "session_payments_crossing_known";
ALTER TABLE "session_payments" ADD CONSTRAINT "session_payments_crossing_known"
  CHECK ("crossing" IN (
    'usd_stripe_to_connect', 'egp_local_to_manual',
    'usd_stripe_to_manual', 'egp_local_to_connect',
    'pot_held_to_connect', 'pot_held_to_manual'
  )) NOT VALID;
ALTER TABLE "session_payments" VALIDATE CONSTRAINT "session_payments_crossing_known";

-- ------------------------------------------- the re-verification cycle (53.19b) --
--
-- 🔴 SIX MONTHS, not three. 53.19b says the setting defaults to six and 0072
-- wrote three, which was mine and not a decision.
--
-- The number the product actually reads is `sponsor.verifyCycleMonths` in
-- platform settings, because C247's cycle is an operator's judgement about human
-- patience rather than a fact. This corrects the column default so a row written
-- without one does not disagree with the setting, which is the second-opinion
-- failure: two places holding the same number, one of them stale.
ALTER TABLE "sponsors" ALTER COLUMN "verify_cycle_months" SET DEFAULT 6;

-- 🔴 And the rows 0072 already created, brought to the same number.
--
-- Only the ones still holding the old default: a sponsor whose cycle an operator
-- has already set to something else must not be overwritten by a migration
-- correcting a default.
UPDATE "sponsors" SET "verify_cycle_months" = 6 WHERE "verify_cycle_months" = 3;

-- ------------------------------------------- proof over pattern (53.19, C246) --
--
-- 🔴 The one-time code that turns an email on the sponsor's domain from a pattern
-- into proof. A short-lived row, and the ADDRESS IS NOT ON IT.
--
-- `enrolments.identifier_hash` is a salted hash with no plaintext column anywhere,
-- because 53.18b stores the identifier for matching and de-duplication only. So a
-- code can only be sent while the person is typing the address: nothing later
-- knows it, which is the strongest form of "never a destination for anything we
-- send except the one verification code".
CREATE TABLE IF NOT EXISTS "enrolment_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "enrolment_id" uuid NOT NULL,
  "code_hash" text NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "enrolment_verifications"
    ADD CONSTRAINT "enrolment_verifications_enrolment_id_fk"
    FOREIGN KEY ("enrolment_id") REFERENCES "enrolments"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "enrolment_verifications_hash_unique"
  ON "enrolment_verifications" ("code_hash");
CREATE INDEX IF NOT EXISTS "enrolment_verifications_enrolment_idx"
  ON "enrolment_verifications" ("enrolment_id", "used_at");

-- 🔴 Five wrong guesses and the code is DEAD, not slow, and the database says so.
--
-- The rate limit in `lib/data/enrolment.ts` is per joining CODE rather than per
-- person, because a limit per person lets one attacker with many accounts grind
-- one code. This counter is the second wall and it is a constraint rather than a
-- convention: a caller that forgot to check would be refused by the write.
ALTER TABLE "enrolment_verifications"
  DROP CONSTRAINT IF EXISTS "enrolment_verifications_attempts_bounded";
ALTER TABLE "enrolment_verifications"
  ADD CONSTRAINT "enrolment_verifications_attempts_bounded"
  CHECK ("attempts" >= 0 AND "attempts" <= 5) NOT VALID;
ALTER TABLE "enrolment_verifications"
  VALIDATE CONSTRAINT "enrolment_verifications_attempts_bounded";
