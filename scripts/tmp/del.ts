import { db } from "../../lib/db";
import { sql } from "drizzle-orm";
async function main(){
  await db.execute(sql`DELETE FROM patients WHERE id = 'a4d5ac21-fb33-4675-9e94-66045ab474a2'`);
  await db.execute(sql`DELETE FROM people WHERE id = '7299d1b0-851a-407d-a24c-fdba0eb5ec20'`);
  const r = await db.execute(sql`SELECT count(*)::int n FROM patients`);
  console.log("patients now:", (r as any).rows[0].n);
}
main();
