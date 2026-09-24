-- W2-S10 (FIX-PLAN D1): a company sees every pot-funded session's money, and nobody's name.
--
-- The founder's decision, 2026-09-24: a company sees each session's money entry
-- (price, coverage, covered amount, the employee's share) with analytics,
-- filters, sorting and export, and never a name, a therapist or a specialty.
-- C244 forbids company reporting from joining sessions, dates or names, and this
-- table is its one sanctioned exception: it is WRITTEN at payment time from the
-- session's own figures and then READ with no join at all.
--
-- What the columns deliberately leave out, so no query can ever put it back:
--   * no session id, person id, patient id, therapist id or payment id: an entry
--     cannot be walked back to anybody, by the company or by us;
--   * no created_at: the only date is the Monday of the week it was paid
--     (`week_start`), because a live entry at a small company identifies the
--     person, and enrolled employees were told "not a date";
--   * `shuffle` is random at insert, the order within a published batch, so the
--     row order carries no timing either.
--
-- `enrolments.ledger_told_at` is when that employee was told, in the app, that
-- the company now sees this. An entry is written only for a session paid after
-- it, so nobody's earlier sessions appear in a view they were never told about.
-- The notice is its own kind, `benefit_terms`; `verify:migrations` compares
-- this CHECK to `PATIENT_NOTICE_KINDS`, which gains it in the same change.
CREATE TABLE IF NOT EXISTS "sponsor_money_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sponsor_id" uuid NOT NULL,
  "kind" text DEFAULT 'session' NOT NULL,
  "week_start" date NOT NULL,
  "price_cents" integer NOT NULL,
  "coverage_bps" integer NOT NULL,
  "covered_cents" integer NOT NULL,
  "employee_cents" integer NOT NULL,
  "shuffle" integer NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "sponsor_money_entries" ADD CONSTRAINT "sponsor_money_entries_sponsor_fk"
    FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "sponsor_money_entries" ADD CONSTRAINT "sponsor_money_entries_kind"
    CHECK ("kind" IN ('session', 'refund'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "sponsor_money_entries" ADD CONSTRAINT "sponsor_money_entries_coverage"
    CHECK ("coverage_bps" BETWEEN 0 AND 10000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "sponsor_money_entries" ADD CONSTRAINT "sponsor_money_entries_amounts"
    CHECK ("price_cents" >= 0 AND "covered_cents" >= 0 AND "employee_cents" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "sponsor_money_entries" ADD CONSTRAINT "sponsor_money_entries_monday"
    CHECK (extract(isodow FROM "week_start") = 1);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sponsor_money_entries_sponsor_week_idx"
  ON "sponsor_money_entries" ("sponsor_id", "week_start");
--> statement-breakpoint
ALTER TABLE "enrolments" ADD COLUMN IF NOT EXISTS "ledger_told_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "patient_notifications" DROP CONSTRAINT IF EXISTS "patient_notifications_kind";
--> statement-breakpoint
ALTER TABLE "patient_notifications" ADD CONSTRAINT "patient_notifications_kind"
  CHECK ("kind" IN (
    'benefit_started', 'benefit_ended', 'benefit_paused', 'verify_needed',
    'session_invited', 'session_started', 'payment_confirmed', 'access_requested',
    'session_cancelled', 'benefit_terms'
  ))
  NOT VALID;
--> statement-breakpoint
ALTER TABLE "patient_notifications" VALIDATE CONSTRAINT "patient_notifications_kind";
