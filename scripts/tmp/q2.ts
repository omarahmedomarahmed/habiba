import { db } from "../../lib/db";
import { sql } from "drizzle-orm";
async function main(){
  const r = await db.execute(sql`SELECT u.email, u.role, u.verification_status, v.state, v.country, v.license_number, v.submitted_at
    FROM users u LEFT JOIN therapist_verifications v ON v.user_id = u.id ORDER BY u.created_at`);
  for (const row of (r as any).rows) console.log(JSON.stringify(row));
}
main();
