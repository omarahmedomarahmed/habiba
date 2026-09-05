/** Ad-hoc SQL against the working database, for verification steps (H1). */
import { connect } from "./db";
const { pool } = connect();
pool
  .query(process.argv[2]!)
  .then((r) => { console.log(JSON.stringify(r.rows, null, 1)); return pool.end(); })
  .catch(async (e) => { console.error("ERR", e.message); await pool.end(); process.exit(1); });
