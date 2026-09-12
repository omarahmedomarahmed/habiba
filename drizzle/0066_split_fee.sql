-- Sprint 46 — the split fee, and credit that is money.
--
-- 🔴 Additive, every statement. H16: nothing applies migrations on deploy, so
-- this runs against production before main moves, and code that has not
-- shipped yet must not be able to break code that has.

-- 🔴 46.13 / C251 — two line items, WITHOUT dropping the unique index.
--
-- 46.1 asked for "two line items on one invoice" as an additive change. It
-- cannot be one: `invoices_session_unique` permits exactly one invoice row per
-- session, and it is not decoration. It exists because the reconciler cron and
-- a live completion raced each other and produced two charges for one session,
-- and that index plus ON CONFLICT DO NOTHING is what makes the race a no-op.
--
-- Dropping it would buy the shape and give back the double charge. So the
-- index stays, one invoice per session stays, and the composition goes
-- underneath. `invoices.amount_cents` remains the total, which is why the
-- ledger, the checkout and every existing report kept working without knowing
-- this table exists.
CREATE TABLE IF NOT EXISTS "invoice_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "tier_key" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 🔴 One line of each kind per invoice.
--
-- The same argument as `invoices_session_unique`, one level down. The
-- reconciler now backfills a MISSING LINE rather than a missing invoice, so it
-- races a live completion in exactly the way the parent used to. Without this,
-- a session whose AI fee was slow to post gets two AI fees.
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_lines_invoice_kind_unique"
  ON "invoice_lines" ("invoice_id", "kind");

CREATE INDEX IF NOT EXISTS "invoice_lines_kind_idx"
  ON "invoice_lines" ("kind", "created_at");

-- 🔴 46.4 — credit is money.
--
-- NOTHING IS BACKFILLED. A row bought before this sprint keeps NULL here and
-- is worth (quantity - consumed) * rate_cents, computed on read. Rewriting
-- those rows would be re-deriving somebody's purchase from settings that have
-- since changed, which is the mistake rate_cents exists to prevent.
ALTER TABLE "session_credits" ADD COLUMN IF NOT EXISTS "credit_cents" integer;
ALTER TABLE "session_credits" ADD COLUMN IF NOT EXISTS "spent_cents" integer DEFAULT 0 NOT NULL;
