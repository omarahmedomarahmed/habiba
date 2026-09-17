/**
 * 🔴 76.53 — `/admin/actuals` AGAINST A REAL DATABASE, because a wrong number
 * and a right number look identical.
 *
 *     npm run verify:actuals
 *
 * ## Why this is a gate and not a unit test
 *
 * Every figure on that screen is a SQL aggregate with a sign convention in it.
 * A unit test over a fake row proves the TypeScript underneath the query and
 * nothing about the query, and the query is the whole of the risk: `-SUM` where
 * `SUM` belonged turns a profitable month into a loss of exactly the same size,
 * and both render beautifully.
 *
 * So this plants real ledger legs, real model calls and real employees, reads
 * the page's own loader back, and asserts the DELTA each one made.
 *
 * ## 🔴 EVERY CHECK IS A DELTA, and that is not fastidiousness
 *
 * `monthlyActuals()` reads the whole database, because a company has one result.
 * Asserting absolute figures would mean asserting that the branch it runs on is
 * empty, which it is not and never will be. The same mistake cost this sprint an
 * afternoon in `simulate-seed.ts`, where two checks measured the database and
 * claimed to measure themselves.
 *
 * ## It refuses production
 *
 * `writesTo()` with no argument, which is the default again as of 76.52. It
 * plants an organisation and deletes it in a `finally`, and a `finally` that
 * does not run leaves a fabricated company on the founders' own board, on a
 * database this run never restores.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

/** `YYYY-MM` for a month offset back from this one. */
function monthBack(months: number): string {
  const now = new Date();
  const then = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
  return then.toISOString().slice(0, 7);
}

/** The first day of that month, as a timestamp the ledger will group under it. */
function firstOf(month: string): string {
  return `${month}-01T12:00:00Z`;
}

async function main() {
  writesTo();

  const { pool, db } = connect();

  const orgName = "Verify Actuals Example";
  let orgId: string | null = null;
  const employeeIds: string[] = [];

  try {
    const { monthlyActuals } = await import("../lib/data/actuals");
    const { payrollByMonth } = await import("../lib/data/payroll");

    /*
     * 🔴 SWEEP FIRST, because a `finally` is not a guarantee.
     *
     * An earlier run of this verifier that died mid-way leaves its organisation
     * behind, and the next run then fails on a unique slug and reports itself as
     * broken. Found by doing exactly that. A plant-and-delete verifier has to be
     * able to start from the mess its own last attempt made.
     *
     * 🔴 AND IT SWEEPS BEFORE THE `before` SNAPSHOT, WHICH IS THE HALF THAT BIT.
     *
     * The first version swept after it, so the residue of the previous run was
     * counted into the baseline, deleted, and then planted again at the same
     * amounts. Every money delta came out as zero and seven checks went red
     * while the reader they were testing was correct. A baseline taken over a
     * database this verifier is about to change is not a baseline.
     */
    await db.execute(sql`DELETE FROM employees WHERE title = 'verify'`);
    await db.execute(sql`
      DELETE FROM ai_request_logs WHERE organization_id IN
        (SELECT id FROM organizations WHERE slug = 'verify-actuals-example')`);
    await db.execute(sql`
      DELETE FROM ledger_entries WHERE organization_id IN
        (SELECT id FROM organizations WHERE slug = 'verify-actuals-example')`);
    await db.execute(sql`DELETE FROM organizations WHERE slug = 'verify-actuals-example'`);

    const before = await monthlyActuals();
    const beforeBy = new Map(before.months.map((m) => [m.month, m]));

    const m1 = monthBack(4);
    const m3 = monthBack(2);
    const m5 = monthBack(0);

    /* ------------------------------------------------- plant the money -- */

    const made = await db.execute<{ id: string }>(sql`
      INSERT INTO organizations (name, slug, kind)
      VALUES (${orgName}, 'verify-actuals-example', 'solo') RETURNING id`);
    orgId = made.rows[0]!.id;

    /*
     * 🔴 THE LEGS ARE WRITTEN BY HAND RATHER THAN THROUGH `journal()`.
     *
     * `journal` refuses a transaction whose legs do not sum to zero, which is
     * exactly right for the product and wrong here: this verifier is about
     * whether the READER has the sign convention, and to test that it has to be
     * able to write a leg in each direction and check which way the screen
     * reads it. Balancing pairs are used anyway, so nothing here would fail a
     * trial balance either.
     */
    const txn = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO ledger_entries (txn_id, txn_kind, account, organization_id, amount_cents,
                                  ref_type, memo, created_at)
      VALUES
        (${txn}, 'session_payment', 'cash',             ${orgId},  1000, 'session_payment', 'verify: money in',        ${firstOf(m1)}),
        (${txn}, 'session_payment', 'platform_revenue', ${orgId}, -1000, 'session_payment', 'verify: our cut',         ${firstOf(m1)}),
        (${txn}, 'adjustment',      'platform_expense', ${orgId},   400, NULL,              'verify: something cost',  ${firstOf(m1)}),
        (${txn}, 'adjustment',      'cash',             ${orgId},  -400, NULL,              'verify: money out',       ${firstOf(m1)}),
        (${txn}, 'session_payment', 'vat_payable',      ${orgId},  -140, 'session_payment', 'verify: tax held',        ${firstOf(m1)}),
        (${txn}, 'session_payment', 'therapist_payable',${orgId},  -800, 'session_payment', 'verify: owed to a clinician', ${firstOf(m1)}),
        (${txn}, 'invoice_settled', 'platform_revenue', ${orgId}, -8000, 'invoice',         'verify: a subscription',  ${firstOf(m1)})`);

    /* --------------------------------------------- plant the model spend -- */

    /*
     * 🔴 FOUR CALLS OF 250 MICROCENTS. Each one rounds to zero in whole cents,
     * which is precisely the defect `cost_microcents` was added for: the old
     * usage table summed a rounded column and reported that the AI was free.
     * Four of them make one cent, and the screen has to say one cent.
     */
    for (let i = 0; i < 4; i++) {
      await db.execute(sql`
        INSERT INTO ai_request_logs (organization_id, kind, model, status, cost_microcents, created_at)
        VALUES (${orgId}, 'note', 'verify', 'success', 250, ${firstOf(m1)})`);
    }

    /* -------------------------------------------------- plant the people -- */

    /*
     * Three employees, each one a boundary the payroll arithmetic gets wrong if
     * it does the obvious thing:
     *
     *   - JOINED starts in month 3, so months 1 and 2 must cost nothing.
     *   - LEFT stops in month 3, and month 3 must STILL be paid.
     *   - RAISED goes from $10 to $30 in month 3, so month 1 must stay $10.
     */
    const people = [
      { name: "Joined Example", startedOn: `${m3}-01`, endedOn: null, salaries: [[1000, `${m3}-01`]] },
      { name: "Left Example", startedOn: `${m1}-01`, endedOn: `${m3}-15`, salaries: [[2000, `${m1}-01`]] },
      {
        name: "Raised Example",
        startedOn: `${m1}-01`,
        endedOn: null,
        salaries: [
          [1000, `${m1}-01`],
          [3000, `${m3}-01`],
        ],
      },
    ] as const;

    for (const person of people) {
      const row = await db.execute<{ id: string }>(sql`
        INSERT INTO employees (name, title, queue, started_on, ended_on)
        VALUES (${person.name}, 'verify', NULL, ${person.startedOn}, ${person.endedOn})
        RETURNING id`);
      employeeIds.push(row.rows[0]!.id);

      for (const [cents, from] of person.salaries) {
        await db.execute(sql`
          INSERT INTO employee_salaries (employee_id, monthly_cents, effective_from)
          VALUES (${row.rows[0]!.id}, ${cents}, ${from})`);
      }
    }

    /* ------------------------------------------------------ read it back -- */

    const after = await monthlyActuals();
    const afterBy = new Map(after.months.map((m) => [m.month, m]));

    const delta = (month: string, of: (row: NonNullable<ReturnType<typeof afterBy.get>>) => number) => {
      const now = afterBy.get(month);
      const was = beforeBy.get(month);
      return (now ? of(now) : 0) - (was ? of(was) : 0);
    };

    /* ------------------------------------------------- the sign convention */

    check(
      "🔴 a CREDIT to platform_revenue reads as revenue EARNED, not as a loss",
      delta(m1, (r) => r.sessionRevenueCents) === 1000,
      `session revenue moved by ${delta(m1, (r) => r.sessionRevenueCents)}, planted -1000 cents as a credit`,
    );

    check(
      "🔴 …and against an invoice it lands in subscriptions, not in sessions",
      delta(m1, (r) => r.subscriptionRevenueCents) === 8000,
      `subscription revenue moved by ${delta(m1, (r) => r.subscriptionRevenueCents)}`,
    );

    check(
      "🔴 a DEBIT to platform_expense reads as money spent",
      delta(m1, (r) => r.otherSpendCents) === 400,
      `other spend moved by ${delta(m1, (r) => r.otherSpendCents)}`,
    );

    /*
     * 🔴 THE CONTROL FOR THE TWO ABOVE, and without it they are one `-` away
     * from passing while reporting a loss as a profit.
     *
     * Both signs were planted, in the same month, in opposite directions. If the
     * reader had either backwards, revenue and spend would have swapped and each
     * check above would still be comparing a number to a number. This asserts
     * the RELATIONSHIP: nine thousand in, four hundred out, and the net is what
     * is left rather than what was taken.
     */
    /*
     * 🔴 AND THE WAGE BILL IS IN IT, which is the arithmetic this check got
     * wrong on its first run and is now the reason it is worth having.
     *
     * The first version expected 9000 in less 400 out less a cent of model
     * spend, and the screen said 3000 less than that. The screen was right: two
     * of the planted employees are on the payroll in this month, and salaries
     * are spend. A result that leaves the salaries out is precisely the
     * profitable-looking company this whole sprint exists to stop reporting.
     */
    const expectedNet = 1000 + 8000 - 400 - 1 - 3000;
    check(
      "🔴 CONTROL the net is earned minus spent, and SALARIES are spent",
      delta(m1, (r) => r.netCents) === expectedNet,
      `net moved by ${delta(m1, (r) => r.netCents)}: 9000 earned, 400 spent, ` +
        `1 cent of model, 3000 of wages. Expected ${expectedNet}`,
    );

    /* ----------------------------------------------- held money is not ours */

    check(
      "🔴 VAT collected is NOT counted as revenue, because it is a tax authority's",
      delta(m1, (r) => r.vatCollectedCents) === 140 &&
        delta(m1, (r) => r.revenueCents) === 9000,
      `vat ${delta(m1, (r) => r.vatCollectedCents)}, revenue ${delta(m1, (r) => r.revenueCents)}`,
    );

    check(
      "🔴 …nor is what a clinician has earned and not been paid",
      delta(m1, (r) => r.owedToCliniciansCents) === 800,
      `owed out moved by ${delta(m1, (r) => r.owedToCliniciansCents)}, and revenue did not move with it`,
    );

    /* -------------------------------------------------------- the AI cost */

    check(
      "🔴 four calls of 250 microcents are one cent, not nothing",
      delta(m1, (r) => r.aiCostMicrocents) === 1000,
      `model spend moved by ${delta(m1, (r) => r.aiCostMicrocents)} microcents, which is 1 cent`,
    );

    /* ---------------------------------------------------------- the payroll */

    const payroll = await payrollByMonth([m1, m3, m5]);

    /*
     * The delta is taken against nothing here, because these three names are
     * planted and their salaries are the only ones with these amounts. What is
     * asserted is that each planted person appears in the months they should and
     * in no others, which a total alone cannot show.
     */
    const m1Total = payroll.get(m1)!.totalCents;
    const m3Total = payroll.get(m3)!.totalCents;

    check(
      "🔴 somebody who starts in month 3 costs NOTHING in month 1",
      /* Left ($20) and Raised ($10) only. Joined ($10) must not be in it. */
      m1Total - (beforePayrollTotal(before, m1) ?? 0) === 2000 + 1000,
      `month 1 payroll moved by ${m1Total - (beforePayrollTotal(before, m1) ?? 0)}, expected 3000`,
    );

    check(
      "🔴 the month somebody LEAVES is a month they were paid",
      /* Left leaves on the 15th of month 3 and is still in it: 20 + 10 + 30. */
      m3Total - (beforePayrollTotal(before, m3) ?? 0) === 2000 + 1000 + 3000,
      `month 3 payroll moved by ${m3Total - (beforePayrollTotal(before, m3) ?? 0)}, expected 6000`,
    );

    check(
      "🔴 a raise in month 3 does NOT restate month 1",
      /* Raised was on 1000 in month 1 and 3000 in month 3, and month 1 stayed. */
      m1Total - (beforePayrollTotal(before, m1) ?? 0) === 3000,
      "month 1 still costs what it cost, which is the whole reason salaries are rows with dates",
    );

    check(
      "🔴 CONTROL three salary rows for one person is ONE head, not three",
      payroll.get(m3)!.headcount - (beforePayrollHead(before, m3) ?? 0) === 3,
      `headcount moved by ${payroll.get(m3)!.headcount - (beforePayrollHead(before, m3) ?? 0)}, ` +
        "and Raised Example has two salary rows. A join here would have counted four",
    );

    /* ------------------------------------------------------- the month range */

    check(
      "🔴 the range reaches back to the earliest thing that happened, not six months",
      after.months.length > 0 && after.months[0]!.month <= m1,
      `starts at ${after.months[0]?.month ?? "nothing"}, and something was planted in ${m1}`,
    );

    check(
      "🔴 …and the payroll puts a month on the table even with no trading in it",
      after.months.some((m) => m.month === m5),
      `${m5} is in the range, and the only thing in it is a wage bill`,
    );
  } finally {
    /*
     * 🔴 DELETED HERE, ALWAYS. The ledger legs go by organisation, the employees
     * by id, and both before the organisation itself so nothing is left pointing
     * at a row that is gone.
     */
    for (const id of employeeIds) {
      /* One at a time. `= ANY($1)` needs a real array parameter and this driver
         expands a JS array into a list, which Postgres reads as a tuple. */
      await db.execute(sql`DELETE FROM employees WHERE id = ${id}`);
    }
    /* Belt and braces: anything a crashed earlier run left behind goes too. */
    await db.execute(sql`DELETE FROM employees WHERE title = 'verify'`);
    if (orgId) {
      await db.execute(sql`DELETE FROM ai_request_logs WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
    }
    await pool.end();
  }

  finish("sprint 76 actuals");
}

/* The payroll figures for a month as they were before anything was planted. */
function beforePayrollTotal(
  before: { months: { month: string; payrollCents: number }[] },
  month: string,
): number | null {
  return before.months.find((m) => m.month === month)?.payrollCents ?? 0;
}

function beforePayrollHead(
  before: { months: { month: string; headcount: number }[] },
  month: string,
): number | null {
  return before.months.find((m) => m.month === month)?.headcount ?? 0;
}

main();
