import { sql } from "drizzle-orm";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";
const db = dbFor(DEFAULT_REGION);
async function main() {
  const rows = (await db.execute(sql.raw(process.argv.slice(2).join(" ")))).rows;
  console.log(JSON.stringify(rows, null, 1));
}
void main();
