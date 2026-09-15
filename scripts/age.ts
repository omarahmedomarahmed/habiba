/**
 * Move a wave's rows backwards in time, so three months can happen in one hour.
 *
 *   npm run age -- --marker wave1 --days 90
 *   npm run age -- --marker wave1 --days 90 --dry
 *
 * Specified by `docs/simulation/06-AGEING.md`. The one rule it implements:
 *
 * > **A timestamp in the past is a record of something that happened, and it
 * > moves. A timestamp in the future is a deadline, and it does not.**
 *
 * ## 🔴 No column allow-list, and that is the design
 *
 * This schema has 112 tables. A hand-written list of date columns is a thing
 * somebody forgets the day a migration adds one, and the failure is silent: the
 * new column keeps today's date while everything around it moves, and nothing
 * in the data says so. So every `timestamp` and `timestamptz` column in
 * `public` is discovered from `information_schema` at run time. A column added
 * next year is aged correctly by a script nobody edits.
 *
 * ## How one wave is told from another
 *
 * A marker file, `.simulation-<marker>.json`, written on the first run and
 * refused on the second. It records the instant the wave began, and only rows
 * created at or after that instant are touched, so ageing wave two does not
 * move wave one a second time.
 *
 *   npm run age -- --marker wave1 --start     before the wave acts
 *   npm run age -- --marker wave1 --days 90   after its capture is taken
 *
 * ## What it refuses
 *
 * Production, by name, through `writesTo()`. A second run against the same
 * marker. And a `--days` outside 1 to 400, because a mistyped interval is the
 * one mistake here that cannot be undone by running it again.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { sql } from "drizzle-orm";

import { writesTo } from "./_verify";
import { connect } from "./db";

type Args = { marker: string; days: number; start: boolean; dry: boolean };

function args(): Args {
  const argv = process.argv.slice(2);
  const value = (flag: string) => {
    const at = argv.indexOf(flag);
    return at === -1 ? null : (argv[at + 1] ?? null);
  };
  return {
    marker: value("--marker") ?? "",
    days: value("--days") ? Number(value("--days")) : 0,
    start: argv.includes("--start"),
    dry: argv.includes("--dry"),
  };
}

const markerPath = (marker: string) => `.simulation-${marker}.json`;

type Marker = { marker: string; startedAt: string; agedAt?: string; days?: number };

/**
 * Every date column in `public`, with the table's own primary key so a row can
 * be selected by age rather than by a guess about which column means "created".
 */
type DateColumn = { table: string; column: string };

async function dateColumns(db: ReturnType<typeof connect>["db"]): Promise<DateColumn[]> {
  const rows = await db.execute<{ table_name: string; column_name: string }>(sql`
    SELECT c.table_name, c.column_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema AND t.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND t.table_type = 'BASE TABLE'
       AND c.data_type IN ('timestamp with time zone', 'timestamp without time zone')
       AND c.is_generated = 'NEVER'
       AND c.is_updatable = 'YES'
     ORDER BY c.table_name, c.column_name`);
  return rows.rows.map((r) => ({ table: r.table_name, column: r.column_name }));
}

/** Which tables have a `created_at`, which is how a wave's own rows are found. */
async function tablesWithCreatedAt(db: ReturnType<typeof connect>["db"]): Promise<Set<string>> {
  const rows = await db.execute<{ table_name: string }>(sql`
    SELECT table_name FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'created_at'`);
  return new Set(rows.rows.map((r) => r.table_name));
}

async function main() {
  const opts = args();
  writesTo();

  if (!opts.marker) {
    console.error("\n  --marker is required. It names the wave.\n");
    process.exit(1);
  }

  const path = markerPath(opts.marker);
  const { pool, db } = connect();

  try {
    /* ---------------------------------------------------- starting a wave -- */

    if (opts.start) {
      if (existsSync(path)) {
        console.error(`\n  ${path} already exists. A wave is started once.\n`);
        process.exit(1);
      }
      const now = new Date().toISOString();
      const marker: Marker = { marker: opts.marker, startedAt: now };
      writeFileSync(path, JSON.stringify(marker, null, 2));
      console.log(`\n  Wave "${opts.marker}" starts at ${now}.`);
      console.log(`  Everything created from now on is this wave's, and will age together.\n`);
      return;
    }

    /* ------------------------------------------------------ ageing a wave -- */

    if (!Number.isInteger(opts.days) || opts.days < 1 || opts.days > 400) {
      console.error("\n  --days must be a whole number between 1 and 400.\n");
      process.exit(1);
    }

    if (!existsSync(path)) {
      console.error(`\n  No ${path}. Start the wave first:\n`);
      console.error(`      npm run age -- --marker ${opts.marker} --start\n`);
      process.exit(1);
    }

    const marker = JSON.parse(readFileSync(path, "utf8")) as Marker;

    if (marker.agedAt) {
      /*
       * 🔴 The refusal that matters most. Ageing a wave twice puts it half a
       * year back and NOTHING in the data would say so: every row would still
       * be internally consistent, just wrong, and the only evidence would be a
       * therapist's earnings screen showing a quiet month nobody can explain.
       */
      console.error(
        `\n  Wave "${opts.marker}" was already aged by ${marker.days} days on ${marker.agedAt}.`,
      );
      console.error("  Ageing it again would double the shift and leave no trace. Refusing.\n");
      process.exit(1);
    }

    const since = new Date(marker.startedAt);
    const interval = sql.raw(`INTERVAL '${opts.days} days'`);

    const columns = await dateColumns(db);
    const created = await tablesWithCreatedAt(db);

    console.log(`\n  Ageing wave "${opts.marker}" by ${opts.days} days.`);
    console.log(`  Rows created at or after ${since.toISOString()}.`);
    console.log(`  ${columns.length} date columns across ${new Set(columns.map((c) => c.table)).size} tables.\n`);

    const byTable = new Map<string, DateColumn[]>();
    for (const column of columns) {
      const list = byTable.get(column.table) ?? [];
      list.push(column);
      byTable.set(column.table, list);
    }

    let movedTotal = 0;
    let leftTotal = 0;
    const skipped: string[] = [];

    for (const [table, cols] of byTable) {
      if (!created.has(table)) {
        /*
         * A table with no `created_at` cannot be told apart wave by wave, so it
         * is left alone and NAMED. Silently skipping it is how a set of rows
         * ends up three months out of step with everything around it.
         */
        skipped.push(table);
        continue;
      }

      /*
       * 🔴 THE RULE, AS SQL. `LEAST(col, now())` is not it: that would clamp a
       * future deadline to today, which is a different and much worse edit. The
       * CASE leaves a future value exactly where it is.
       */
      const sets = cols
        .map(
          (c) =>
            `"${c.column}" = CASE WHEN "${c.column}" < now() THEN "${c.column}" - ${`INTERVAL '${opts.days} days'`} ELSE "${c.column}" END`,
        )
        .join(", ");

      /* How many values in this table are in the future, so the report can say. */
      const future = await db.execute<{ n: string }>(
        sql.raw(
          `SELECT ${cols
            .map((c) => `COUNT(*) FILTER (WHERE "${c.column}" >= now())`)
            .join(" + ")} AS n FROM "${table}" WHERE created_at >= '${since.toISOString()}'`,
        ),
      );

      if (opts.dry) {
        const count = await db.execute<{ n: string }>(
          sql.raw(
            `SELECT COUNT(*)::text AS n FROM "${table}" WHERE created_at >= '${since.toISOString()}'`,
          ),
        );
        const n = Number(count.rows[0]?.n ?? 0);
        if (n > 0) {
          console.log(
            `  ${table.padEnd(34)} ${String(n).padStart(6)} rows · ${cols.length} columns · ${Number(future.rows[0]?.n ?? 0)} values left in the future`,
          );
          movedTotal += n;
        }
        continue;
      }

      const result = await db.execute(
        sql.raw(
          `UPDATE "${table}" SET ${sets} WHERE created_at >= '${since.toISOString()}'`,
        ),
      );
      const n = Number((result as { rowCount?: number }).rowCount ?? 0);
      const left = Number(future.rows[0]?.n ?? 0);
      if (n > 0) {
        console.log(
          `  ${table.padEnd(34)} ${String(n).padStart(6)} rows · ${cols.length} columns · ${left} values left in the future`,
        );
        movedTotal += n;
        leftTotal += left;
      }
    }

    console.log(
      `\n  ${opts.dry ? "WOULD MOVE" : "moved"} ${movedTotal} rows. ${leftTotal} values were in the future and stayed there.`,
    );

    if (skipped.length > 0) {
      console.log(`\n  🔴 ${skipped.length} tables have no created_at and were NOT aged:`);
      console.log(`     ${skipped.join(", ")}`);
      console.log("     Named rather than skipped silently. Check none of them matters here.");
    }

    if (!opts.dry) {
      marker.agedAt = new Date().toISOString();
      marker.days = opts.days;
      writeFileSync(path, JSON.stringify(marker, null, 2));
      console.log(`\n  Recorded in ${path}. This wave cannot be aged twice.`);
      console.log("  Now run `npm run verify:migrations`: several CHECK constraints are about");
      console.log("  ordering, so if the shift broke one, the database will say so.\n");
    } else {
      console.log("\n  --dry, nothing was written.\n");
    }
  } finally {
    await pool.end();
  }
}

main();
