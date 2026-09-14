/**
 * What the models have cost on this database, and whether it is past the line.
 *
 *   npm run spend                    what has been spent, broken down
 *   npm run spend -- --budget 10     and exit 1 if it is over $10
 *   npm run spend -- --budget 10 --warn 70
 *
 * ## Why a script rather than a paragraph in a plan
 *
 * The simulation runs on a **$10 top-up that must not run out in the middle**.
 * A budget written into a document is a number somebody reads once; a budget is
 * only real if something checks it, and the only honest place to check it is
 * `ai_request_logs`, which the product writes on every single model call.
 *
 * So the orchestrator runs this after every wave and stops when it says stop.
 * Nothing here estimates: every figure is a sum over rows the product wrote at
 * the time of the call.
 *
 * ## 🔴 It reads `cost_microcents` and nothing else
 *
 * `cost_cents` is deprecated and rounds 91% of calls to zero (49.14 / C279). A
 * budget guard reading it would report $0.00 through the entire run and then be
 * surprised by the invoice, which is the exact failure that column carries a
 * fifty-line warning about.
 *
 * ## What it cannot see
 *
 * Calls this product did not make. Agent reasoning, the orchestrator's own
 * thinking, and anything typed into a chat window are not in this table and are
 * not billed to the same key unless you point them there. The number here is
 * **what the simulation's product usage cost**, which is the number the budget
 * was set against, and the report says so.
 */
import { sql } from "drizzle-orm";

import { connect } from "./db";

type Args = { budget: number | null; warnPct: number; json: boolean };

function args(): Args {
  const argv = process.argv.slice(2);
  const value = (flag: string) => {
    const at = argv.indexOf(flag);
    return at === -1 ? null : (argv[at + 1] ?? null);
  };
  return {
    budget: value("--budget") ? Number(value("--budget")) : null,
    warnPct: value("--warn") ? Number(value("--warn")) : 70,
    json: argv.includes("--json"),
  };
}

const usd = (microcents: number) => `$${(microcents / 100_000).toFixed(4)}`;

async function main() {
  const opts = args();
  const { pool, db } = connect();

  try {
    const total = await db.execute<{ micro: string; calls: string; errors: string }>(sql`
      SELECT COALESCE(SUM(cost_microcents), 0)::text AS micro,
             COUNT(*)::text AS calls,
             COUNT(*) FILTER (WHERE status = 'error')::text AS errors
        FROM ai_request_logs`);

    const byKind = await db.execute<{ kind: string; micro: string; calls: string }>(sql`
      SELECT kind, COALESCE(SUM(cost_microcents), 0)::text AS micro, COUNT(*)::text AS calls
        FROM ai_request_logs GROUP BY kind ORDER BY SUM(cost_microcents) DESC`);

    const byModel = await db.execute<{ model: string; micro: string; calls: string }>(sql`
      SELECT model, COALESCE(SUM(cost_microcents), 0)::text AS micro, COUNT(*)::text AS calls
        FROM ai_request_logs GROUP BY model ORDER BY SUM(cost_microcents) DESC`);

    const sessions = await db.execute<{ n: string }>(sql`
      SELECT COUNT(*)::text AS n FROM sessions WHERE status = 'completed'`);

    const micro = Number(total.rows[0]?.micro ?? 0);
    const calls = Number(total.rows[0]?.calls ?? 0);
    const done = Number(sessions.rows[0]?.n ?? 0);

    if (opts.json) {
      console.log(
        JSON.stringify({
          microcents: micro,
          usd: micro / 100_000,
          calls,
          completedSessions: done,
          byKind: byKind.rows,
          byModel: byModel.rows,
        }),
      );
    } else {
      console.log(`\nModel spend on this database\n`);
      console.log(`  ${usd(micro)} over ${calls} calls`);
      if (done > 0) {
        console.log(`  ${usd(micro / done)} per completed session, across ${done} of them`);
        /*
         * 🔴 The extrapolation, labelled, because quoting the simulation's
         * six-minute session as the unit economics is the most flattering
         * mistake this exercise can produce.
         */
        console.log(
          `  ≈ ${usd((micro / done) * 8)} per REAL fifty-minute session, extrapolated, not measured`,
        );
      }
      console.log("");
      for (const row of byKind.rows) {
        console.log(
          `  ${row.kind.padEnd(16)} ${usd(Number(row.micro)).padStart(10)}  ${String(row.calls).padStart(5)} calls`,
        );
      }
      console.log("");
      for (const row of byModel.rows) {
        console.log(
          `  ${row.model.padEnd(24)} ${usd(Number(row.micro)).padStart(10)}  ${String(row.calls).padStart(5)} calls`,
        );
      }
    }

    if (opts.budget !== null) {
      const spentUsd = micro / 100_000;
      const pct = (spentUsd / opts.budget) * 100;
      console.log(
        `\n  Budget $${opts.budget.toFixed(2)} · spent ${usd(micro)} · ${pct.toFixed(1)}% used\n`,
      );

      if (pct >= 100) {
        console.log("  🔴 OVER BUDGET. Stop the run, report what was reached, do not top up quietly.");
        process.exitCode = 1;
      } else if (pct >= opts.warnPct) {
        console.log(
          `  🟡 Past ${opts.warnPct}%. Finish the wave in flight, then decide what to cut before the next one.`,
        );
      } else {
        console.log("  🟢 Inside the budget.");
      }

      /*
       * 🔴 The honest caveat, printed every time rather than in a document.
       *
       * This table holds what THE PRODUCT spent. An agent's own reasoning is
       * billed to the same key and is invisible here, so a run that is at 60%
       * on this number is not necessarily at 60% on the invoice.
       */
      console.log(
        "\n  This counts what the PRODUCT spent. Agent reasoning on the same key is not in this table.",
      );
    }

    console.log("");
  } finally {
    await pool.end();
  }
}

main();
