import { db } from "../../lib/db";
import { sql } from "drizzle-orm";
async function main(){
  const r = await db.execute(sql`SELECT p.id, p.first_name, p.last_name, p.phone, p.source, pe.id AS person_id, pe.claimed_at FROM patients p LEFT JOIN people pe ON pe.id = p.person_id`);
  console.log((r as any).rows);
}
main();
