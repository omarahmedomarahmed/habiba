/**
 * Does the simulation clock move a row the way the clock moving forward would?
 *
 *   npm run verify:clock
 *
 * On a scratch table of its own, so the rest of the database and any gate running beside it
 * are untouched: one row with a past timestamp, a future deadline, a `date` and an
 * `updated_at` trigger. Moved by three days, every one of the three must move by exactly three
 * days, the trigger must not have fired, and it must be back on afterwards.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";
import { shiftDatabase, shiftFor } from "./sim-clock";

const { check, finish } = reporter();
const T = `_clock_check_${Date.now().toString(36)}`;

async function main() {
  writesTo();
  const { db, pool } = connect();
  try {
    await db.execute(sql.raw(`
      CREATE TABLE "${T}" (id int PRIMARY KEY, created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
                           due date NOT NULL, updated_at timestamptz NOT NULL);
      CREATE FUNCTION "${T}_touch"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
      CREATE TRIGGER "${T}_touch" BEFORE UPDATE ON "${T}" FOR EACH ROW EXECUTE FUNCTION "${T}_touch"();
      INSERT INTO "${T}" VALUES (1, '2026-09-10T10:00:00Z', '2026-12-01T10:00:00Z', '2026-09-20', '2026-09-10T10:00:00Z');`));

    await shiftDatabase(db, 3 * 86_400, { dry: false, only: [T] });

    const row = (await db.execute(sql.raw(`SELECT created_at, expires_at, due::text AS due, updated_at FROM "${T}"`))).rows[0] as {
      created_at: Date; expires_at: Date; due: string; updated_at: Date;
    };
    const iso = (d: Date) => new Date(d).toISOString();
    check("🔴 a past timestamp moves back by exactly the shift", iso(row.created_at) === "2026-09-07T10:00:00.000Z", iso(row.created_at));
    check("🔴 a future deadline moves back by the same amount, so it comes due on its simulated day", iso(row.expires_at) === "2026-11-28T10:00:00.000Z", iso(row.expires_at));
    check("🔴 a date column moves by whole days", row.due === "2026-09-17", row.due);
    check("🔴 the updated_at trigger did not stamp the real now", iso(row.updated_at) === "2026-09-07T10:00:00.000Z", iso(row.updated_at));

    const enabled = (await db.execute(sql.raw(`SELECT tgenabled FROM pg_trigger WHERE tgname = '${T}_touch'`))).rows[0] as { tgenabled: string };
    check("🔴 …and the trigger is back on afterwards", enabled?.tgenabled === "O", String(enabled?.tgenabled));

    const clock = { day: 1, realAt: "2026-09-25T10:00:00Z", history: [] };
    check(
      "the shift is the simulated gap minus the real time already gone",
      shiftFor(clock, 3, new Date("2026-09-25T12:00:00Z")) === 2 * 86_400 - 7_200,
      String(shiftFor(clock, 3, new Date("2026-09-25T12:00:00Z"))),
    );
  } finally {
    await db.execute(sql.raw(`DROP TABLE IF EXISTS "${T}"; DROP FUNCTION IF EXISTS "${T}_touch"();`));
    await pool.end();
  }
  finish("clock");
}

void main();
