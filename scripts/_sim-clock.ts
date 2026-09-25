/**
 * The simulation clock's shared half: the arithmetic and the move, with no main(), so
 * `verify:clock` can import it without running the command. `scripts/sim-clock.ts` is the door.
 */
import { sql } from "drizzle-orm";

import type { connect } from "./db";

export type Clock = { day: number; realAt: string; history: { day: number; shiftSeconds: number; at: string }[] };

const DAY_MS = 86_400_000;

/** The shift that puts the product's now at the start of `toDay`, in whole seconds. */
export function shiftFor(clock: Clock, toDay: number, realNow: Date): number {
  const elapsed = realNow.getTime() - new Date(clock.realAt).getTime();
  return Math.floor(((toDay - clock.day) * DAY_MS - elapsed) / 1000);
}

type Col = { table: string; column: string; type: string };

export async function shiftDatabase(
  db: ReturnType<typeof connect>["db"],
  seconds: number,
  opts: { dry: boolean; only?: string[] },
): Promise<{ tables: number; rows: number; columns: number }> {
  const cols = (
    await db.execute<{ table_name: string; column_name: string; data_type: string }>(sql`
      SELECT c.table_name, c.column_name, c.data_type
        FROM information_schema.columns c
        JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
       WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
         AND c.data_type IN ('timestamp with time zone', 'timestamp without time zone', 'date')
         AND c.is_generated = 'NEVER' AND c.is_updatable = 'YES'
       ORDER BY c.table_name, c.column_name`)
  ).rows.map((r) => ({ table: r.table_name, column: r.column_name, type: r.data_type }) as Col);

  const byTable = new Map<string, Col[]>();
  for (const c of cols) {
    if (opts.only && !opts.only.includes(c.table)) continue;
    byTable.set(c.table, [...(byTable.get(c.table) ?? []), c]);
  }
  const days = Math.round(seconds / 86_400);

  let rows = 0;
  if (opts.dry) {
    for (const table of byTable.keys()) {
      const n = await db.execute<{ n: string }>(sql.raw(`SELECT COUNT(*)::text AS n FROM "${table}"`));
      rows += Number(n.rows[0]?.n ?? 0);
    }
    return { tables: byTable.size, rows, columns: cols.length };
  }

  await db.transaction(async (tx) => {
    for (const [table, list] of byTable) {
      const sets = list
        .map((c) =>
          c.type === "date"
            ? `"${c.column}" = "${c.column}" - ${String(days)}`
            : `"${c.column}" = "${c.column}" - INTERVAL '${String(seconds)} seconds'`,
        )
        .join(", ");
      await tx.execute(sql.raw(`ALTER TABLE "${table}" DISABLE TRIGGER USER`));
      const result = await tx.execute(sql.raw(`UPDATE "${table}" SET ${sets}`));
      await tx.execute(sql.raw(`ALTER TABLE "${table}" ENABLE TRIGGER USER`));
      rows += Number((result as { rowCount?: number }).rowCount ?? 0);
    }
  });
  return { tables: byTable.size, rows, columns: [...byTable.values()].flat().length };
}
