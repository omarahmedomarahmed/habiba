import { sql } from "drizzle-orm";
import { connect } from "./db";
async function main(){const {pool,db}=connect();
const r=await db.execute(sql`
 SELECT tc.table_name, tc.constraint_name FROM information_schema.table_constraints tc
 WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'
   AND tc.table_name IN ('patient_accounts','patient_auth_sessions','person_claims','person_invites','person_documents','document_chunks','person_diagnoses','content_flags','person_profiles','observations','homework_items','assistant_threads','assistant_messages','availability_slots')
 ORDER BY tc.table_name, tc.constraint_name`);
const byTable: Record<string,string[]> = {};
for (const row of r.rows as any[]) (byTable[row.table_name] ??= []).push(row.constraint_name);
for (const [t,cs] of Object.entries(byTable)) console.log(t.padEnd(24), cs.length, cs.join(" "));
await pool.end();}
main();
