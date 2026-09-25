/**
 * 🔴 0170: WHAT THE PRODUCT SENT TO SOMEBODY WHO DOES NOT EXIST.
 *
 *     npm run sim:inbox -- <address or phone> [--last 5]
 *     npm run on:production -- sim:inbox -- dr.nour.sim@example.com
 *
 * Reads `sim_outbox` and prints each message's subject, the links in it and any
 * six-digit code, so a simulated person can follow a set-password link or type
 * a sign-in code the way a real one would from their inbox. Reads only.
 */
import { sql } from "drizzle-orm";

import { connect } from "./db";

async function main() {
  const [who, ...rest] = process.argv.slice(2);
  if (!who) {
    console.error("usage: npm run sim:inbox -- <address or phone> [--last N]");
    process.exit(1);
  }
  const lastAt = rest.indexOf("--last");
  const last = lastAt >= 0 ? Math.max(1, Number(rest[lastAt + 1]) || 5) : 5;
  const { db, pool } = connect();
  const rows = (await db.execute(sql`
    SELECT channel, subject, body, kind, created_at FROM sim_outbox
     WHERE to_address = ${who.trim().toLowerCase()}
     ORDER BY created_at DESC LIMIT ${last}`)).rows as {
    channel: string; subject: string | null; body: string; kind: string | null; created_at: string;
  }[];
  if (rows.length === 0) console.log(`nothing for ${who}`);
  for (const r of rows) {
    const text = r.body.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    const links = [...new Set([...r.body.matchAll(/https?:\/\/[^\s"'<>]+/g)].map((m) => m[0].replace(/&amp;/g, "&")))];
    const codes = [...new Set([...text.matchAll(/\b\d{6}\b/g)].map((m) => m[0]))];
    console.log(`\n${new Date(r.created_at).toISOString()}  ${r.channel}  ${r.kind ?? ""}`);
    console.log(`  subject: ${r.subject ?? ""}`);
    if (codes.length) console.log(`  codes:   ${codes.join(", ")}`);
    for (const l of links) console.log(`  link:    ${l}`);
    console.log(`  text:    ${text.slice(0, 400)}`);
  }
  await pool.end();
}

void main();
