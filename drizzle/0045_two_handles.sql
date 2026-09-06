-- Sprint 13R — two handles, one lock, and the way out of it. PLAN.md §3b, C86–C88.
--
-- Additive for uptime (H16). Sprint 22.9 validates every NOT VALID check once
-- the purge has emptied the tables.

-- ---------------------------------------------------------------------------
-- 13R.6 / C86 — the email becomes optional.
--
-- §3b, as the founder rewrote it: the phone is mandatory on every account, the
-- address is optional on every account. Sprint 13 read "identity is a phone
-- number" as "and nothing else" and still demanded an address — which excludes
-- exactly the people this product is for.
ALTER TABLE "patient_accounts" ALTER COLUMN "email" DROP NOT NULL;

-- 🔴 The index is rebuilt with Postgres's DEFAULT null handling, and the
-- default is the whole point.
--
-- `NULLS DISTINCT` (the default) means two rows with a NULL email do not
-- collide, so any number of address-less accounts coexist while every real
-- address stays unique. 0043 used `NULLS NOT DISTINCT` one table away, for the
-- claim key, where a NULL genuinely means "the same absent thing" — here the
-- same keyword would collapse every address-less account into one and the
-- second person without an email could never sign up.
--
-- Same keyword, opposite meaning, one table apart. It is spelled out rather
-- than left to the default so that nobody "tidies" it later.
DROP INDEX IF EXISTS "patient_accounts_email_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "patient_accounts_email_unique"
  ON "patient_accounts" ("email")
  NULLS DISTINCT
  WHERE "deleted_at" IS NULL AND "email" IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 13R.1 / C87 — the name-attempt budget stops resetting.
--
-- The hole: `answerName` set `status = 'expired'` on the third wrong name.
-- `person_claims_open_unique` is partial on `WHERE status = 'pending'`, so the
-- locked row left the index; `startClaim`'s upsert then found no conflict and
-- inserted a **fresh** row at `name_attempts DEFAULT 0`. Three guesses per code
-- request, unbounded, against somebody's first name.
--
-- So the budget moves off the claim row and onto the pair it is actually
-- protecting: this account, this record. A new claim inherits the spent budget
-- because the budget was never the claim's to hold.
CREATE TABLE IF NOT EXISTS "claim_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "patient_account_id" uuid NOT NULL,
  "patient_id" uuid NOT NULL,

  "attempts" integer NOT NULL DEFAULT 0,
  /** Set when the budget runs out. 13R.2 — its own state, not `expired`. */
  "locked_at" timestamp with time zone,

  /* 13R.3–13R.4 — the way out, and who opened it. */
  "released_at" timestamp with time zone,
  "released_by_user_id" uuid,
  "release_reason" text,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "claim_attempts"
    ADD CONSTRAINT "claim_attempts_account_fk"
    FOREIGN KEY ("patient_account_id") REFERENCES "patient_accounts"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "claim_attempts"
    ADD CONSTRAINT "claim_attempts_patient_fk"
    FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "claim_attempts"
    ADD CONSTRAINT "claim_attempts_releaser_fk"
    FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One budget per (account, record). This is the constraint that makes the
-- budget un-resettable: a new claim row cannot bring a new budget with it.
CREATE UNIQUE INDEX IF NOT EXISTS "claim_attempts_pair_unique"
  ON "claim_attempts" ("patient_account_id", "patient_id");

-- Support looks this up by record, to answer "why can my patient not get in?"
CREATE INDEX IF NOT EXISTS "claim_attempts_locked_idx"
  ON "claim_attempts" ("patient_id")
  WHERE "locked_at" IS NOT NULL AND "released_at" IS NULL;
