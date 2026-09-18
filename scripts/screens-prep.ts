/**
 * Local screenshot preparation, and it refuses production.
 *
 *     npm run screens:prep
 *
 * The lesson of the `$3,500 7` cell is that a page can be green on every gate
 * and unreadable on the screen, and the only way to find that out is to look at
 * it. Looking at it needs a password that works and rows that render, and both
 * of those are a small script rather than five minutes of clicking each time.
 *
 * 🔴 It plants. `writesTo()` with no argument, so it cannot be pointed at the
 * production database, where a $50,000 contribution nobody put in would be on
 * the founders' own balance for ever.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();

const EMAIL = "admin@24therapy.test";
const PASSWORD = "Screenshots2026!";

async function main() {
  writesTo();

  const { pool, db } = connect();

  try {
    const { hashPassword } = await import("../lib/auth/password");
    const hash = await hashPassword(PASSWORD);

    const updated = await db.execute<{ id: string }>(sql`
      UPDATE users SET password_hash = ${hash}
       WHERE email = ${EMAIL} AND deleted_at IS NULL
       RETURNING id`);

    check(
      "the local admin has a password this session knows",
      updated.rows.length === 1,
      updated.rows.length === 1 ? `${EMAIL} / ${PASSWORD}` : `no ${EMAIL} on this branch`,
    );

    /* Six months back, so the figures land across the range the page shows. */
    const now = new Date();
    const month = (back: number): string => {
      const then = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
      return then.toISOString().slice(0, 10);
    };

    await db.execute(sql`DELETE FROM capital_contributions WHERE source IN ('founders', 'angel round')`);
    await db.execute(sql`
      INSERT INTO capital_contributions (amount_cents, received_on, source, note)
      VALUES (2500000, ${month(6)}, 'founders', 'the money we started with'),
             (5000000, ${month(3)}, 'angel round', 'first cheque')`);

    await db.execute(sql`DELETE FROM other_costs WHERE note = 'screens'`);
    for (const back of [5, 4, 3]) {
      await db.execute(sql`
        INSERT INTO other_costs (kind, month, amount_cents, note)
        VALUES ('video', ${month(back)}, 4200, 'screens'),
               ('hosting', ${month(back)}, 3500, 'screens')
        ON CONFLICT (kind, month) DO UPDATE SET amount_cents = EXCLUDED.amount_cents`);
    }

    const counted = await db.execute<{ capital: string; costs: string }>(sql`
      SELECT (SELECT COUNT(*)::text FROM capital_contributions) AS capital,
             (SELECT COUNT(*)::text FROM other_costs) AS costs`);

    check(
      "and there is something on the screen to look at",
      Number(counted.rows[0]?.capital ?? 0) >= 2 && Number(counted.rows[0]?.costs ?? 0) >= 6,
      `${counted.rows[0]?.capital ?? 0} contributions, ${counted.rows[0]?.costs ?? 0} cost rows`,
    );
  } finally {
    await pool.end();
  }

  finish("screenshot prep");
}

main();
