-- Sprint 13 — claim by phone. PLAN.md §3b.
--
-- Additive for uptime (H16). Every row here is test data being purged, so the
-- presence checks are `NOT VALID` exactly as 0042's were: they bind every write
-- from this moment and never scan what is already there. Sprint 22.9 validates
-- all of them once the tables are empty.

-- ---------------------------------------------------------------------------
-- 13.1 — one phone number, one patient account.
--
-- 🔴 This is §3b's invariant, and it lives here rather than in a service so
-- that it holds against a script, a backfill, an admin tool and whatever the
-- next sprint writes. A second account **cannot** take a claimed number, and no
-- application code has to remember that.
--
-- Partial on `deleted_at IS NULL`, matching `patient_accounts_email_unique`: a
-- deleted account must not hold a number hostage. Somebody who closes their
-- account and comes back is a person we want back, not a support ticket.
CREATE UNIQUE INDEX IF NOT EXISTS "patient_accounts_phone_unique"
  ON "patient_accounts" ("phone")
  WHERE "deleted_at" IS NULL AND "phone" IS NOT NULL;

-- The number is the identity now, so an account without one is not an
-- identity. `NOT VALID` for the deploy gap, as above.
DO $$
BEGIN
  ALTER TABLE "patient_accounts"
    ADD CONSTRAINT "patient_accounts_phone_present"
    CHECK ("phone" IS NOT NULL) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 13.11 / 13.12 — where the patient is.
--
-- Nullable is the **column**, not the experience: signup arrives pre-filled
-- with the detected zone and editable, so this is empty only for accounts made
-- before this ships or for somebody who cleared it deliberately. 13.13 sets the
-- precedence — this beats `patients.timezone`, which beats the therapist's,
-- which beats UTC — and claiming never copies one into the other.
ALTER TABLE "patient_accounts" ADD COLUMN IF NOT EXISTS "timezone" text;

-- ---------------------------------------------------------------------------
-- 13.5 / 13.6 — proving the number is not proving the record.
--
-- The old flow verified a code and claimed the record in the same act. §3b
-- splits them, because a household shares a handset, numbers are recycled, and
-- a therapist mistypes a digit. So a claim now carries the state of a
-- two-question challenge:
--
--   seen_therapist   null = not asked · true = yes · false = no, remembered
--   name_attempts    how many times a name has been offered and refused
--
-- `name_attempts` is a column rather than a rate-limit key because the limit is
-- per *claim*, not per caller: the thing being protected is one record's name,
-- and an attacker with a fresh IP must not get a fresh budget against it.
ALTER TABLE "person_claims" ADD COLUMN IF NOT EXISTS "seen_therapist" boolean;
ALTER TABLE "person_claims" ADD COLUMN IF NOT EXISTS "name_attempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "person_claims" ADD COLUMN IF NOT EXISTS "challenged_at" timestamp with time zone;

-- Which clinician's record this attempt is about.
--
-- §3b's step 8: two therapists may hold the same number, and the person answers
-- for each separately. "Separately" needs the claim to know which therapist it
-- is asking about — a claim keyed only on the person cannot ask two questions
-- about two records.
ALTER TABLE "person_claims" ADD COLUMN IF NOT EXISTS "patient_id" uuid;

DO $$
BEGIN
  ALTER TABLE "person_claims"
    ADD CONSTRAINT "person_claims_patient_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One live attempt per (account, patient record) rather than per (account,
-- person). The old partial unique index was per person, which under §3b would
-- let one therapist's record block the question about the other's.
--
-- `NULLS NOT DISTINCT` because the invite route (6.10) creates claims with no
-- `patient_id`: under Postgres's default, two NULLs never collide, so the old
-- guarantee — one live invite attempt per (account, person) — would have been
-- silently dropped by adding a nullable column to the key.
DROP INDEX IF EXISTS "person_claims_open_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "person_claims_open_unique"
  ON "person_claims" ("patient_account_id", "person_id", "patient_id")
  NULLS NOT DISTINCT
  WHERE "status" = 'pending';

-- A "no" is remembered so nobody is asked twice (13.6). Reading that back is a
-- per-account question asked on every patient screen, so it gets an index.
CREATE INDEX IF NOT EXISTS "person_claims_declined_idx"
  ON "person_claims" ("patient_account_id", "patient_id")
  WHERE "status" = 'rejected';
