/**
 * The simulation's clock: moves the whole database back in time, so the product's "now" is a
 * later day of the simulated month.
 *
 *   npm run on:production -- sim:clock -- --start            day 1 begins now
 *   npm run on:production -- sim:clock -- --to-day 7         advance to day 7
 *   npm run on:production -- sim:clock -- --to-day 7 --dry   say what would move
 *   npm run on:production -- sim:clock -- --show             which day it is
 *
 * ## Why everything moves, future included
 *
 * Moving every timestamp in every row back by the same amount is exactly the same, to every
 * query in the product, as the clock moving forward by that amount. An invitation that had
 * seven days left has fewer left; a session booked for day 7 is due on day 7; a 30-day notice
 * given on day 1 has run out by day 30. Nothing is special-cased, so nothing can be forgotten,
 * and a column added next year moves without anybody editing this file.
 *
 * The amount is the simulated gap minus the real time that has already passed since the last
 * move, so the product's clock lands on the start of the target day's round however long the
 * previous round took. `.simulation-clock.json` records the day and the real instant it began.
 *
 * `date` columns move by the whole number of days in the shift. `timestamp` columns move by the
 * exact interval. Every row, every table in `public`.
 *
 * ## Triggers are off for the length of the move, in one transaction
 *
 * An `updated_at` trigger would stamp every row with the real now, and the clinical record's
 * no-rewrite trigger would refuse the update outright. So user triggers are disabled per table
 * inside the transaction and re-enabled before it commits; if anything fails, the whole move
 * rolls back and the triggers were never off for anybody else.
 *
 * It refuses production unless reached through `npm run on:production`, whose allow-list is the
 * door. `docs/simulation/02-THE-MONTH.md` says when it runs.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { type Clock, shiftDatabase, shiftFor } from "./_sim-clock";
import { writesTo } from "./_verify";
import { connect } from "./db";

const STATE = process.env.SIM_CLOCK_FILE ?? ".simulation-clock.json";
function flag(name: string): string | null {
  const argv = process.argv.slice(2);
  const i = argv.indexOf(name);
  return i === -1 ? null : (argv[i + 1] ?? null);
}

function readClock(): Clock | null {
  return existsSync(STATE) ? (JSON.parse(readFileSync(STATE, "utf8")) as Clock) : null;
}

async function main() {
  writesTo({ productionIsAllowed: true });
  const clock = readClock();

  if (process.argv.includes("--show")) {
    if (!clock) console.log("\n  The clock has not started. `--start` begins day 1.\n");
    else {
      const hours = (Date.now() - new Date(clock.realAt).getTime()) / 3_600_000;
      console.log(`\n  Day ${String(clock.day)}, begun ${hours.toFixed(1)} real hours ago.\n`);
    }
    return;
  }

  if (process.argv.includes("--start")) {
    if (clock) {
      console.error(`\n  ${STATE} exists: the clock started on ${clock.history[0]?.at ?? clock.realAt}. Refusing to restart it.\n`);
      process.exit(1);
    }
    const now = new Date().toISOString();
    writeFileSync(STATE, JSON.stringify({ day: 1, realAt: now, history: [{ day: 1, shiftSeconds: 0, at: now }] }, null, 2));
    console.log(`\n  Day 1 begins now, ${now}.\n`);
    return;
  }

  const toDay = Number(flag("--to-day"));
  if (!clock) {
    console.error("\n  The clock has not started. Run `--start` before round 1.\n");
    process.exit(1);
  }
  if (!Number.isInteger(toDay) || toDay <= clock.day || toDay > 60) {
    console.error(`\n  --to-day must be a whole day after day ${String(clock.day)}, and at most 60.\n`);
    process.exit(1);
  }

  const realNow = new Date();
  const seconds = shiftFor(clock, toDay, realNow);
  if (seconds <= 0) {
    console.error(`\n  More real time has passed than the gap to day ${String(toDay)}. Pick a later day.\n`);
    process.exit(1);
  }

  const dry = process.argv.includes("--dry");
  const { db, pool } = connect();
  try {
    const done = await shiftDatabase(db, seconds, { dry });
    console.log(
      `\n  ${dry ? "WOULD MOVE" : "moved"} ${String(done.rows)} rows in ${String(done.tables)} tables ` +
        `(${String(done.columns)} date columns) back by ${(seconds / 86_400).toFixed(3)} days.`,
    );
    if (!dry) {
      const next: Clock = {
        day: toDay,
        realAt: realNow.toISOString(),
        history: [...clock.history, { day: toDay, shiftSeconds: seconds, at: realNow.toISOString() }],
      };
      writeFileSync(STATE, JSON.stringify(next, null, 2));
      console.log(`  It is now day ${String(toDay)}. Fire the jobs next (02-THE-MONTH.md), then run verify:migrations.\n`);
    }
  } finally {
    await pool.end();
  }
}

void main();
