-- 0188: THE BOOKS HOLD IN THE DATABASE, NOT ONLY IN THE CODE. Additive.
--
-- "Append-only, always balanced" was true of `journal()` and of nothing else:
-- two migrations (0151, 0155) rewrote ledger rows, and any UPDATE would have
-- succeeded. This makes three rules facts about the table.
--
--   1. A posting key per business event. `journal()` stamps the key and the leg
--      number on each leg of a keyed posting; the unique index makes a second
--      posting of the same event fail instead of doubling the books.
--   2. No UPDATE. The one UPDATE let through is the one a foreign key issues:
--      emptying organization_id, user_id or created_by when that account is
--      deleted (each is ON DELETE SET NULL). Nothing else on the row may change.
--      DELETE is allowed: the verifiers and the demo reset remove the rows their
--      own fixtures posted, the app and the scripts share one database role, so
--      no role or SECURITY DEFINER function can tell them apart, and no file
--      under app/ or lib/ deletes a ledger row (tests/safety.test.ts).
--   3. Each transaction id sums to zero at COMMIT. A deferred constraint
--      trigger, so a posting in parts inside one database transaction is
--      checked once it is whole.
--
-- Also: the EGP figure and the rate actually charged on a leg (patient payments
-- and payouts), the payouts provider's `unknown` state, and the bank statement
-- figure staff enter when they confirm a transfer.
--
-- Safe to apply before the deploy (H16): the running build issues no UPDATE on
-- ledger_entries and posts only balanced transactions.

ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "posting_key" text;
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "leg" smallint;
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "egp_minor" integer;
--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "fx_rate_micro" integer;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_key_has_leg"
    CHECK (("posting_key" IS NULL) = ("leg" IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_egp_has_rate"
    CHECK ("egp_minor" IS NULL OR ("fx_rate_micro" IS NOT NULL AND "fx_rate_micro" > 0));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ledger_entries_posting_key_unique"
  ON "ledger_entries" ("posting_key", "leg")
  WHERE "posting_key" IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "ledger_entries_no_update"() RETURNS trigger AS $$
DECLARE
  emptied constant text[] := ARRAY['organization_id', 'user_id', 'created_by'];
BEGIN
  IF (to_jsonb(NEW) - emptied) IS DISTINCT FROM (to_jsonb(OLD) - emptied)
     OR (NEW."organization_id" IS NOT NULL AND NEW."organization_id" IS DISTINCT FROM OLD."organization_id")
     OR (NEW."user_id" IS NOT NULL AND NEW."user_id" IS DISTINCT FROM OLD."user_id")
     OR (NEW."created_by" IS NOT NULL AND NEW."created_by" IS DISTINCT FROM OLD."created_by") THEN
    RAISE EXCEPTION 'ledger_entries is append only: post a reversing transaction instead'
      USING ERRCODE = '0A000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "ledger_entries_append_only" ON "ledger_entries";
--> statement-breakpoint
CREATE TRIGGER "ledger_entries_append_only"
  BEFORE UPDATE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION "ledger_entries_no_update"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "ledger_txn_must_balance"() RETURNS trigger AS $$
DECLARE
  delta bigint;
BEGIN
  SELECT COALESCE(SUM("amount_cents"), 0) INTO delta
    FROM "ledger_entries"
   WHERE "txn_id" = NEW."txn_id";
  IF delta <> 0 THEN
    RAISE EXCEPTION 'ledger transaction % is out by % cents', NEW."txn_id", delta
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "ledger_entries_txn_balances" ON "ledger_entries";
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "ledger_entries_txn_balances"
  AFTER INSERT ON "ledger_entries"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ledger_txn_must_balance"();
--> statement-breakpoint
ALTER TABLE "payout_requests" DROP CONSTRAINT IF EXISTS "payout_requests_provider_state_known";
--> statement-breakpoint
ALTER TABLE "payout_requests"
  ADD CONSTRAINT "payout_requests_provider_state_known"
  CHECK ("provider_state" IS NULL OR "provider_state" IN ('sending', 'sent', 'failed', 'unknown'));
--> statement-breakpoint
ALTER TABLE "manual_payments" ADD COLUMN IF NOT EXISTS "statement_amount_minor" integer;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "manual_payments"
    ADD CONSTRAINT "manual_payments_statement_matches"
    CHECK ("statement_amount_minor" IS NULL OR "statement_amount_minor" = "amount_cents");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
