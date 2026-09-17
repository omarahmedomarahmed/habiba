-- 🔴 76.53 — THE PAYROLL, AND WHY IT IS TWO TABLES RATHER THAN A SALARY COLUMN.
--
-- `/admin/financial-model` forecasts a headcount and a wage bill. Nothing in
-- this database has ever held either, so the one number in the company's
-- accounts that is large, certain and monthly was the one number no screen
-- could read back. During a six month run with four people working the manual
-- queues, that is most of what the six months cost.
--
-- ## Why a history rather than a number on the person
--
-- A single `monthly_salary_cents` on `employees` is one edit away from lying
-- about the past. Give somebody a raise in month 4 and every earlier month's
-- payroll silently rises with it, so the table that exists to say what the six
-- months cost would report what they would have cost if the raise had always
-- been there. That is C311 in a different currency: a price somebody was shown
-- is a price they are owed, and a salary somebody was paid is what that month
-- cost, whatever they are paid now.
--
-- So the salary is a row with a date on it, the screen edits by adding one, and
-- the month's figure reads the row in force that month. An admin who genuinely
-- wants to correct a typo rather than record a raise edits the row's own
-- `effective_from` to the same month, which is a different act and looks like
-- one in the audit log.
--
-- ## What this is NOT
--
-- Not an HR system, not a payroll runner, and it pays nobody. It holds what the
-- founders already know — who is on the payroll and what they cost — so that
-- `/admin/actuals` can put a real number in the column where the forecast puts
-- an assumed one. No bank details, no national ID, no address. A table about
-- employees grows those by accretion unless somebody writes down that it must
-- not, so: it must not.
CREATE TABLE IF NOT EXISTS "employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

  -- 🔴 C225. Everybody in here during the run is invented, surname Demo or
  -- Example. Nothing enforces that in the column, because after the run this
  -- table holds real colleagues and a CHECK that refused their names would be
  -- deleted by the first person it inconvenienced. `verify:synthetic` is where
  -- that rule lives, on the branch where it can be enforced honestly.
  "name" text NOT NULL,

  -- What they do, in the words the founders use. Free text on purpose: a job
  -- title enum in a five person company is a taxonomy meeting nobody needs.
  "title" text NOT NULL,

  -- 🔴 WHICH QUEUE THEY WORK, when they work one. The run's whole staffing
  -- question is how many people the manual rails need, and a wage bill that
  -- cannot be split by queue cannot answer it. Null for a founder.
  "queue" text,

  -- Month granularity is deliberate. A wage bill is monthly, and a start date
  -- with a day in it invites a pro-rata calculation nobody asked for.
  "started_on" date NOT NULL,
  -- Null while they are still here. Set when they leave, and the month they
  -- leave is their last paid month.
  "ended_on" date,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "employees_active_idx" ON "employees" ("started_on", "ended_on");

-- One row per salary this person has been on. The current one is the row with
-- the latest `effective_from` that is not in the future.
CREATE TABLE IF NOT EXISTS "employee_salaries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,

  -- 🔴 CENTS OF USD, like every other money column in this database, and unlike
  -- how anybody in Cairo thinks about a salary. The conversion belongs on the
  -- screen, where `payouts.egpRateMicro` already does it for every other figure
  -- the product shows. A second currency in a money column is how two screens
  -- come to disagree about the same number.
  "monthly_cents" integer NOT NULL,

  -- The first month this salary applies to. Days are ignored by the reader.
  "effective_from" date NOT NULL,

  -- Who typed it. An unexplained change to the wage bill is the kind of thing
  -- somebody asks about six months later.
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "note" text,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "employee_salaries_person_idx"
  ON "employee_salaries" ("employee_id", "effective_from" DESC);

-- Two salaries starting the same month for the same person is an edit somebody
-- made twice, and it would double that month's wage bill in a sum. The unique
-- index makes the second write fail rather than the total drift.
CREATE UNIQUE INDEX IF NOT EXISTS "employee_salaries_one_per_month"
  ON "employee_salaries" ("employee_id", "effective_from");

-- 🔴 A NON-NEGATIVE WAGE. A negative salary is not a correction, it is a typo
-- that would read on the actuals table as a month where staff earned us money.
ALTER TABLE "employee_salaries" DROP CONSTRAINT IF EXISTS "employee_salaries_not_negative";
ALTER TABLE "employee_salaries"
  ADD CONSTRAINT "employee_salaries_not_negative" CHECK ("monthly_cents" >= 0);
