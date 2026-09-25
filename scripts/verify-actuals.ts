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
  /** What the video line was before this run touched it, so it can be put back. */
  let videoWas: number | null = null;

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
    await db.execute(sql`DELETE FROM capital_contributions WHERE source = 'verify'`);
    await db.execute(sql`DELETE FROM other_costs WHERE note = 'verify'`);
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

    /* ------------------------------------------- plant the bank and a bill -- */

    /*
     * 🔴 $500 OF CAPITAL IN MONTH 1, AND IT IS THE CHECK THIS FILE WAS MISSING.
     *
     * Before 76.56 the page accumulated the `cash` ledger account from zero and
     * printed it under a heading that read as the bank balance. It was not: it
     * was what trading had done to the balance. A company that put fifty
     * thousand in and spent thirty reported minus thirty thousand, and thirteen
     * green checks had nothing to say about it, because every one of them
     * measured a delta inside the ledger and the missing row was never in the
     * ledger at all.
     *
     * So: plant capital, assert the balance moves by it, and assert the trading
     * column does NOT. Two assertions, because a reader that added capital into
     * the trading column would pass the first one.
     */
    await db.execute(sql`
      INSERT INTO capital_contributions (amount_cents, received_on, source, note)
      VALUES (50000, ${`${m1}-01`}, 'verify', 'planted by verify:actuals')`);

    /*
     * 🔴 A VIDEO BILL NOTHING IN THE PRODUCT POSTS. The three typed-in kinds
     * exist because `NOT_MEASURED_HERE` said the fix was "a monthly figure typed
     * in" and nothing could type one. A cost that reaches the spend column only
     * when somebody types it needs a check that it reaches it at all.
     */
    /*
     * 🔴 ADDED TO WHATEVER IS ALREADY THERE, AND PUT BACK IN THE `finally`.
     *
     * The first version inserted a row and the unique index refused it, because
     * `screens:prep` had already typed a video bill into the same month on this
     * branch. Deleting the existing row instead would have made the delta
     * negative and failed the check while the reader was right, which is the
     * same trap this file's header is about: a verifier that assumes the branch
     * is empty is a verifier that reports the branch rather than the code.
     */
    const priorVideo = await db.execute<{ amount_cents: number }>(sql`
      SELECT amount_cents FROM other_costs WHERE kind = 'video' AND month = ${`${m1}-01`}`);
    videoWas = priorVideo.rows[0]?.amount_cents ?? null;

    await db.execute(sql`
      INSERT INTO other_costs (kind, month, amount_cents, note)
      VALUES ('video', ${`${m1}-01`}, ${(videoWas ?? 0) + 700}, 'verify')
      ON CONFLICT (kind, month) DO UPDATE SET amount_cents = EXCLUDED.amount_cents`);


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
    const expectedNet = 1000 + 8000 - 400 - 1 - 3000 - 700;
    check(
      "🔴 CONTROL the net is earned minus spent, and SALARIES are spent",
      delta(m1, (r) => r.netCents) === expectedNet,
      `net moved by ${delta(m1, (r) => r.netCents)}: 9000 earned, 400 spent, ` +
        `1 cent of model, 3000 of wages, 700 of video. Expected ${expectedNet}`,
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

    /* ----------------------------------------------------------- the bank */

    check(
      "🔴 capital put in reaches the BANK BALANCE, which trading alone never could",
      delta(m1, (r) => r.bankBalanceCents) === 50000 + 1000 - 400,
      `balance moved by ${delta(m1, (r) => r.bankBalanceCents)}: 50000 put in, ` +
        "1000 in and 400 out of trading",
    );

    check(
      "🔴 CONTROL …and it does NOT reach the trading column, which is a different question",
      delta(m1, (r) => r.cashCents) === 1000 - 400,
      `trading moved by ${delta(m1, (r) => r.cashCents)}, expected 600. ` +
        "A reader that added capital here would have passed the check above and be wrong",
    );

    /*
     * 🔴 THE ONE THAT MATTERS MOST, and the reason `ours` is a separate column.
     *
     * 140 of VAT and 800 owed to a clinician were planted as credits. Both are
     * in the bank account and neither is ours. A screen that divides the whole
     * balance by the burn to get a runway is counting a tax authority's money as
     * months of salary, and it is the commonest way a company that is about to
     * run out believes it is not.
     */
    check(
      "🔴 held money is subtracted: VAT and a clinician's earnings are in the bank, not ours",
      delta(m1, (r) => r.heldForOthersCents) === 140 + 800 &&
        delta(m1, (r) => r.oursCents) === 50000 + 1000 - 400 - 940,
      `held ${delta(m1, (r) => r.heldForOthersCents)}, ours ${delta(m1, (r) => r.oursCents)}`,
    );

    check(
      "🔴 a typed-in cost nothing in the product buys still reaches what the month SPENT",
      delta(m1, (r) => r.typedCostsCents) === 700 && delta(m1, (r) => r.spendCents) === 400 + 1 + 3000 + 700,
      `typed ${delta(m1, (r) => r.typedCostsCents)}, spend ${delta(m1, (r) => r.spendCents)}`,
    );

    /*
     * 🔴 THE BURN IS A THREE MONTH AVERAGE AND THE RUNWAY DIVIDES OURS BY IT.
     *
     * Asserted as a relationship rather than an absolute, for the reason at the
     * top of this file: the branch is not empty. What is checked is that the two
     * agree with each other and with the last row, which is where a screen that
     * divided by the wrong figure would come apart.
     */
    const p = after.position;
    const last = after.months.at(-1)!;

    check(
      "🔴 the position card and the last row of the table are the same numbers",
      p.bankBalanceCents === last.bankBalanceCents &&
        p.oursCents === last.oursCents &&
        p.heldForOthersCents === last.heldForOthersCents,
      `card ${p.oursCents}, table ${last.oursCents}. A card with its own query is a card that disagrees`,
    );

    /* ------------------------------------------------- the burn and runway */

    /*
     * 🔴 THE BURN CHECK HAS TO BE GIVEN A BURN, AND THE SIZE IS MEASURED RATHER
     * THAN GUESSED.
     *
     * The first version planted a flat $200 into the most recent month and
     * asserted that a burn appeared. It did not: this branch had enough revenue
     * in the trailing window to absorb it, `monthlyBurnCents` came back null,
     * and the runway assertion sailed down its "there is no burn, so there is no
     * runway" path having exercised nothing at all. A check that only ever runs
     * its empty branch is the §6 family in the costume of a passing test.
     *
     * So the window is read first and the loss is sized against it. Whatever is
     * already on the branch, the trailing three months end up $100 down.
     */
    const windowNetBefore = after.months.slice(-3).reduce((total, row) => total + row.netCents, 0);
    const pushInto = Math.max(0, windowNetBefore) + 10_000;
    const burnTxn = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO ledger_entries (txn_id, txn_kind, account, organization_id, amount_cents,
                                  ref_type, memo, created_at)
      VALUES
        (${burnTxn}, 'adjustment', 'platform_expense', ${orgId}, ${pushInto}, NULL, 'verify: a losing month', ${firstOf(m5)}),
        (${burnTxn}, 'adjustment', 'cash',             ${orgId}, ${-pushInto}, NULL, 'verify: paid for it',    ${firstOf(m5)})`);

    const burning = await monthlyActuals();
    const b = burning.position;

    check(
      "🔴 a losing trailing window produces a BURN, so this cannot pass by measuring nothing",
      b.monthlyBurnCents !== null && b.monthlyBurnCents > 0 && b.burnWindowMonths === 3,
      b.monthlyBurnCents === null
        ? `no burn, and ${String(pushInto)} cents of loss was planted to make sure there was one`
        : `${String(b.monthlyBurnCents)} cents a month, averaged over ${String(b.burnWindowMonths)}`,
    );

    check(
      "🔴 …and the runway is OURS over the burn, never the whole balance",
      b.monthlyBurnCents !== null &&
        Math.abs(
          (b.runwayMonths ?? 0) - Math.round((Math.max(0, b.oursCents) / b.monthlyBurnCents) * 10) / 10,
        ) < 0.05,
      b.monthlyBurnCents === null
        ? "no burn to divide by"
        : `${String(b.runwayMonths)} months = ${String(b.oursCents)} ours over ` +
          `${String(b.monthlyBurnCents)} a month`,
    );

    /*
     * 🔴 THE CONTROL FOR THE ONE ABOVE, and it is the whole argument for having
     * a separate `ours` column at all.
     *
     * $9.40 of somebody else's money was planted: VAT collected and a
     * clinician's earnings. A screen that divided the BALANCE by the burn would
     * report a strictly longer runway, and the difference is months of salary
     * that a tax authority can ask for back. Asserting the number is not enough;
     * this asserts it is the SMALLER of the two answers.
     */
    check(
      "🔴 CONTROL dividing the balance instead would have given a longer runway",
      b.monthlyBurnCents === null ||
        b.heldForOthersCents <= 0 ||
        /*
         * Unrounded on both sides. `runwayMonths` is to one decimal, so on a
         * balance of $75,000 the planted $26.40 held for others rounds away and
         * the rounded figure can read LONGER than the exact balance one.
         */
        Math.max(0, b.oursCents) / b.monthlyBurnCents < Math.max(0, b.bankBalanceCents) / b.monthlyBurnCents,
      b.monthlyBurnCents === null
        ? "no burn"
        : `${String(b.runwayMonths)} months on ours, ` +
          `${(Math.max(0, b.bankBalanceCents) / b.monthlyBurnCents).toFixed(1)} on the balance. ` +
          `${String(b.heldForOthersCents)} cents of the difference belongs to somebody else`,
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

    /*
     * 🔴 AND A CAPPED RANGE KEEPS THE NEWEST MONTHS. It kept the first ones from
     * the earliest record, so a company older than the cap never saw this month.
     * Two months against a range planted months back is the same shape.
     */
    const capped = await monthlyActuals({ maxMonths: 2 });
    const thisMonth = new Date().toISOString().slice(0, 7);
    check(
      "🔴 a range longer than the cap shows the newest months, ending at this one",
      capped.months.length === 2 && capped.months.at(-1)?.month === thisMonth && after.months.length > 2,
      `${capped.months.map((m) => m.month).join(", ")} of ${String(after.months.length)}`,
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
    await db.execute(sql`DELETE FROM capital_contributions WHERE source = 'verify'`);
    /* Put the branch's own video line back at the figure it was typed at. */
    if (videoWas === null) {
      await db.execute(sql`DELETE FROM other_costs WHERE note = 'verify'`);
    } else {
      await db.execute(sql`
        UPDATE other_costs SET amount_cents = ${videoWas}, note = 'screens'
         WHERE note = 'verify'`);
    }
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
