import { db } from "../../lib/db";
import { sql } from "drizzle-orm";
async function main(){
  for (const q of [
    sql`SELECT id, first_name, claimed_at, claimed_by_account_id FROM people`,
    sql`SELECT id, status, route, therapist_keeps_access, verified_at FROM person_claims`,
    sql`SELECT id, status, scope, granted_at FROM history_grants`,
  ]) { const r = await db.execute(q); console.log(JSON.stringify((r as any).rows)); }
}
main();
