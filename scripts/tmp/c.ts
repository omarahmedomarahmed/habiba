import { db } from "../../lib/db";
import { sql } from "drizzle-orm";
async function main(){
  const r = await db.execute(sql`SELECT conname, pg_get_constraintdef(oid) def, convalidated FROM pg_constraint WHERE conname = 'patient_auth_tokens_purpose_known'`);
  console.log((r as any).rows);
  const l = await db.execute(sql`SELECT count(*)::int n FROM drizzle.__drizzle_migrations`);
  console.log("ledger", (l as any).rows[0].n);
}
main();
