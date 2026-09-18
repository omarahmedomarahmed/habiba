-- 🔴 76.56 — WHAT IS IN THE BANK, WHAT IS BURNING, AND HOW LONG IT LASTS.
--
-- `/admin/financial-model` forecasts `cashUsd`, `runwayMonths` and
-- `deepestDeficitUsd`. `/admin/actuals` measured none of them, because it had
-- no idea how much money the company started with: it accumulated the `cash`
-- ledger account from zero, so a company that raised fifty thousand dollars and
-- had spent thirty of it reported a balance of minus thirty thousand with a
-- straight face.
--
-- That is the §6 shape one more time. The number was not wrong about the rows
-- it added up. It was silent about the one row nothing had ever written.
--
-- ## Two tables, because there are two kinds of money nothing in the product
-- ## posts
--
-- `capital_contributions` is money that came IN and is not revenue: a founder's
-- own savings, an angel cheque, a grant. It arrives in a bank account and no
-- session, invoice or payment causes it, so no ledger row exists for it and no
-- ledger row should: the ledger is what the product did.
--
-- `other_costs` is money that went OUT and nothing in the product bought:
-- Daily's video bill, the bank's charge on a transfer, hosting, an accountant.
-- `lib/data/actuals.ts` already names all four in `NOT_MEASURED_HERE` and says
-- the fix for three of them is "a monthly figure typed in". This is that.
--
-- ## 🔴 WHY THEY ARE NOT LEDGER ENTRIES, which was the first design
--
-- Posting capital and the video bill into `ledger_entries` would put them in
-- every existing money screen at once — the vault, the reconciliation, a
-- therapist's own statement — and every one of those screens is about money
-- that moved between us and a customer. An accountant's invoice is not. Worse,
-- `verify:actuals` and `scripts/baseline.ts` both count ledger rows, so a typed
-- figure would read as trading.
--
-- The rule this repository keeps arriving at: a row means one thing, and a
-- second meaning bolted onto it is found later by somebody reading a total that
-- does not add up.
--
-- ## And what these tables must never become
--
-- Not a bookkeeping system. No double entry, no accounts, no reconciliation.
-- Two lists of amounts with dates and a note, typed by a founder who already
-- knows the numbers, existing so that one screen can subtract them. The day
-- somebody wants a trial balance, they want accounting software.

-- Money in that is not revenue.
CREATE TABLE IF NOT EXISTS "capital_contributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

  -- 🔴 CENTS OF USD, like every other money column here, and the screen reveals
  -- the pound value off the operator's own rate. A second currency in a money
  -- column is how two screens come to disagree about one number.
  "amount_cents" integer NOT NULL,

  -- The month it landed. Days are ignored by the reader, same as a salary.
  "received_on" date NOT NULL,

  -- Whose money. Free text: "founders", "angel round", "grant". An enum here
  -- would be a taxonomy meeting for a table with four rows in it.
  "source" text NOT NULL,

  "note" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "capital_contributions_when_idx"
  ON "capital_contributions" ("received_on");

-- 🔴 CAPITAL IS NOT NEGATIVE. Money going back out to an investor is a
-- different act with different tax consequences, and typing it as a negative
-- contribution would make one number mean two things. There is no screen for
-- it because it has never happened.
ALTER TABLE "capital_contributions" DROP CONSTRAINT IF EXISTS "capital_contributions_positive";
ALTER TABLE "capital_contributions"
  ADD CONSTRAINT "capital_contributions_positive" CHECK ("amount_cents" > 0);

-- Money out that nothing in the product bought.
CREATE TABLE IF NOT EXISTS "other_costs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

  -- 🔴 WHICH OF THE THINGS `NOT_MEASURED_HERE` NAMES. Kept as text and checked
  -- rather than as a Postgres enum, because adding a value to an enum is a
  -- migration and the fifth kind of cost turns up on a Tuesday.
  "kind" text NOT NULL,

  -- The month it belongs to, which is not always the month it was paid. A video
  -- bill for March arriving in April is March's cost, and putting it in April
  -- moves it out of the month whose sessions caused it.
  "month" date NOT NULL,

  "amount_cents" integer NOT NULL,
  "note" text,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "other_costs_month_idx" ON "other_costs" ("month");

-- One figure per kind per month, or the same bill gets typed twice on two
-- visits to the screen and the month quietly costs double. The screen edits by
-- replacing rather than by failing.
CREATE UNIQUE INDEX IF NOT EXISTS "other_costs_one_per_kind_per_month"
  ON "other_costs" ("kind", "month");

ALTER TABLE "other_costs" DROP CONSTRAINT IF EXISTS "other_costs_not_negative";
ALTER TABLE "other_costs"
  ADD CONSTRAINT "other_costs_not_negative" CHECK ("amount_cents" >= 0);

ALTER TABLE "other_costs" DROP CONSTRAINT IF EXISTS "other_costs_known_kind";
ALTER TABLE "other_costs"
  ADD CONSTRAINT "other_costs_known_kind" CHECK ("kind" IN (
    'video', 'bank_charges', 'hosting', 'software', 'professional', 'marketing', 'other'
  ));
