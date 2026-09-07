/**
 * Harness only: clear the sign-in throttle between roles.
 *
 * The walkthrough signs in as six different people many times over; the
 * product's per-caller limit (5 in 15 minutes from one connection) is doing
 * exactly its job when it stops that. This clears the counter between steps.
 * It changes no product code and is never run by anything but this script.
 */
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const rows = await sql`DELETE FROM rate_limits RETURNING key`;
console.log(`   (harness) cleared ${rows.length} rate-limit rows`);
