import { db } from "../../lib/db";
import { sql } from "drizzle-orm";
async function main(){
  for (const q of [
    sql`SELECT id, first_name, last_name, phone, person_id FROM patients`,
    sql`SELECT id, first_name, phone, claimed_at, claimed_by_account_id FROM people`,
    sql`SELECT id, phone, email FROM patient_accounts`,
    sql`SELECT id, status, route, patient_id, person_id, seen_therapist, name_confirmed_at FROM person_claims`,
    sql`SELECT id, patient_id, redeemed_at, expires_at FROM person_invites`,
  ]) {
    const r = await db.execute(q);
    console.log(JSON.stringify((r as any).rows));
  }
}
main();
