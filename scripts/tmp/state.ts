import { db } from "../../lib/db";
import { sql } from "drizzle-orm";
async function main(){
  const r = await db.execute(sql`
    SELECT 'users' t, count(*)::int n FROM users
    UNION ALL SELECT 'patients', count(*)::int FROM patients
    UNION ALL SELECT 'content_pages', count(*)::int FROM content_pages
    UNION ALL SELECT 'ledger', count(*)::int FROM drizzle.__drizzle_migrations
    UNION ALL SELECT 'not_valid_checks', count(*)::int FROM pg_constraint WHERE contype='c' AND NOT convalidated`);
  console.log(process.env.DATABASE_URL?.split("@")[1]?.split("/")[0]);
  for (const row of (r as any).rows) console.log(row.t.padEnd(18), row.n);
}
main();
