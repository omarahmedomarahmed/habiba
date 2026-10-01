/**
 * 🔴 F9: MOVE EVERY SENSITIVE FILE STILL ON THE PUBLIC BLOB STORE TO THE PRIVATE ONE.
 *
 * Until F9, `putPrivate` fell back to the PUBLIC store whenever no private
 * store was configured, so licences, IDs, receipts, support attachments and
 * clinical documents written in that window sit at public (if unguessable)
 * addresses. This finds every such URL in the database, and with `--apply`:
 *
 *   1. copies the file to the private store under the same path,
 *   2. checks the private copy answers,
 *   3. repoints the row with a conditional UPDATE on the old value (a row
 *      changed meanwhile is left alone and reported),
 *   4. and only then deletes the public copy.
 *
 *   npm run blobs:migrate-private                    # dry run: lists, changes nothing
 *   npm run blobs:migrate-private -- --apply         # moves, repoints, deletes the public copy
 *   npm run on:production -- blobs:migrate-private [-- --apply]
 *
 * Headshots are skipped: they are published on the radar by design. Needs
 * `BLOB_READ_WRITE_TOKEN` (to read and delete the public copy) and
 * `BLOB_PRIVATE_READ_WRITE_TOKEN` (to write the private one); `--apply`
 * refuses to start without both. It plants nothing and deletes no row.
 * Never logs a full URL: for these files the address was the key.
 */
import { sql } from "drizzle-orm";

import { writesTo } from "./_verify";
import { connect } from "./db";

/** Every column that stores a sensitive file's address. */
export const SENSITIVE_COLUMNS = [
  { table: "therapist_verifications", column: "id_front_url" },
  { table: "therapist_verifications", column: "id_back_url" },
  { table: "therapist_verifications", column: "license_doc_url" },
  { table: "people", column: "avatar_url" },
  { table: "manual_payments", column: "proof_url" },
  { table: "payout_requests", column: "proof_url" },
  { table: "refund_requests", column: "proof_url" },
  { table: "person_documents", column: "blob_url" },
  { table: "support_attachments", column: "storage_key" },
  { table: "partners", column: "documents_url" },
] as const;

/** Public by design and left alone. */
const PUBLIC_KINDS = ["headshot/"];

export function isPublicSensitiveBlob(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith(".public.blob.vercel-storage.com")) return false;
    const path = parsed.pathname.replace(/^\//, "");
    return !PUBLIC_KINDS.some((kind) => path.startsWith(kind));
  } catch {
    return false;
  }
}

/** The kind and a short tail, never the secret path segment. */
function label(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, "").split("/")[0] ?? "file";
  } catch {
    return "file";
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  writesTo({ productionIsAllowed: true });

  if (apply && (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.BLOB_PRIVATE_READ_WRITE_TOKEN)) {
    console.error(
      "\n  --apply needs BLOB_READ_WRITE_TOKEN and BLOB_PRIVATE_READ_WRITE_TOKEN. Nothing was changed.\n",
    );
    process.exit(1);
  }

  const { db, pool } = connect();
  const { putPrivate } = await import("../lib/uploads");
  const { del, head } = await import("@vercel/blob");

  let found = 0;
  let moved = 0;
  let failed = 0;
  try {
    for (const { table, column } of SENSITIVE_COLUMNS) {
      const exists = (
        await db.execute(sql`SELECT 1 FROM information_schema.columns
                              WHERE table_name = ${table} AND column_name = ${column}`)
      ).rows.length;
      if (!exists) {
        console.log(`${table}.${column}: no such column here, skipped`);
        continue;
      }
      const rows = (
        await db.execute(sql`SELECT id::text AS id, ${sql.identifier(column)} AS url FROM ${sql.identifier(table)}
                              WHERE ${sql.identifier(column)} LIKE 'https://%'`)
      ).rows as { id: string; url: string }[];
      const publicRows = rows.filter((row) => isPublicSensitiveBlob(row.url));
      found += publicRows.length;
      console.log(`${table}.${column}: ${publicRows.length} on the public store`);
      if (!apply) continue;

      for (const row of publicRows) {
        const where = `${table} ${row.id.slice(0, 8)} (${label(row.url)})`;
        try {
          const response = await fetch(row.url);
          if (!response.ok) {
            console.log(`  skipped ${where}: the public copy answered ${response.status}`);
            failed += 1;
            continue;
          }
          const body = Buffer.from(await response.arrayBuffer());
          const type = response.headers.get("content-type") ?? "application/octet-stream";
          const path = new URL(row.url).pathname.replace(/^\//, "");
          const privateUrl = await putPrivate(path, body, type);

          /* The private copy must answer before anything points at it or the public one goes. */
          const copy = await head(privateUrl, { token: process.env.BLOB_PRIVATE_READ_WRITE_TOKEN });
          if (!copy || copy.size !== body.length) {
            console.log(`  skipped ${where}: the private copy did not check out`);
            failed += 1;
            continue;
          }

          const updated = (
            await db.execute(sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${privateUrl}
                                  WHERE id::text = ${row.id} AND ${sql.identifier(column)} = ${row.url} RETURNING id`)
          ).rows.length;
          if (updated === 0) {
            console.log(`  left ${where}: the row changed meanwhile; the public copy is kept`);
            continue;
          }
          await del(row.url, { token: process.env.BLOB_READ_WRITE_TOKEN });
          moved += 1;
        } catch (error) {
          failed += 1;
          console.log(`  failed ${where}: ${error instanceof Error ? error.name : "error"}`);
        }
      }
    }
  } finally {
    await pool.end();
  }

  console.log(
    `\n${found} sensitive file(s) on the public store, ${moved} moved and deleted from it, ${failed} not moved` +
      `${apply ? "" : " (dry run: add --apply)"}.`,
  );
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
