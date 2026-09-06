-- Sprint 14 — no-show recovery. PLAN.md 14.1–14.8.
--
-- Additive (H16). Nothing is backfilled: the purge in 22 answers every
-- historical row.

-- ---------------------------------------------------------------------------
-- 14.5 — a session can be handed to another clinician.
--
-- Nothing transferred a session before this. The alternative — cancel one and
-- create another — loses the thread: the patient's booking, what they paid, and
-- the fact that they were let down all live on the original row, and a fresh
-- session starts with none of it.
--
-- So the row moves, and remembers where it came from. `reassigned_from_user_id`
-- is who did not turn up; the therapist column becomes whoever did.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "reassigned_from_user_id" uuid;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "reassigned_at" timestamp with time zone;

DO $$
BEGIN
  ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_reassigned_from_fk"
    FOREIGN KEY ("reassigned_from_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 14.1 / 14.2 — the wait, recorded rather than inferred.
--
-- `patient_joined_at` already exists. What was missing is the other end: when
-- somebody was offered a replacement, and whether they took one. Without it
-- "we left a patient in an empty room" is a claim nobody can check.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "no_show_at" timestamp with time zone;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "recovery_offered_at" timestamp with time zone;
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "recovery_outcome" text;

DO $$
BEGIN
  ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_recovery_outcome_known"
    CHECK ("recovery_outcome" IS NULL OR "recovery_outcome" IN ('reassigned','refunded','abandoned'))
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 14.6 — the difference becomes credit the PATIENT holds.
--
-- `session_credits` is the therapist's prepaid sessions and is not this.
-- A patient who paid $40 and was seen by somebody charging $30 is owed $10, and
-- refunding ten dollars to a card costs more in fees than it returns — so it
-- becomes credit against their next session.
--
-- 🔴 Applied **after VAT** (§3): the VAT was remitted to a government that is
-- not giving it back because a clinician overslept. The credit is against the
-- therapist's price, and the next session's VAT is computed on what is left.
--
-- Expires twelve months from issue, like the therapist's credits, and for the
-- same reason: money owed forever is a liability with no end.
CREATE TABLE IF NOT EXISTS "patient_credits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "person_id" uuid NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'usd',
  "spent_cents" integer NOT NULL DEFAULT 0,

  /** Which let-down produced it. Every cent traces to one session. */
  "from_session_id" uuid,
  "reason" text NOT NULL,

  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "patient_credits"
    ADD CONSTRAINT "patient_credits_person_fk"
    FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "patient_credits"
    ADD CONSTRAINT "patient_credits_session_fk"
    FOREIGN KEY ("from_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Money owed is never negative and never over-spent. Both are the kind of
-- error that is silent in application code and loud here.
DO $$
BEGIN
  ALTER TABLE "patient_credits"
    ADD CONSTRAINT "patient_credits_amount_positive"
    CHECK ("amount_cents" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "patient_credits"
    ADD CONSTRAINT "patient_credits_spend_within"
    CHECK ("spent_cents" >= 0 AND "spent_cents" <= "amount_cents");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "patient_credits_live_idx"
  ON "patient_credits" ("person_id", "expires_at")
  WHERE "spent_cents" < "amount_cents";
