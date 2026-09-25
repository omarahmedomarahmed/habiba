/**
 * 🔴 Task 40: MOVE PERSONAL FILES STORED BEFORE THE CHANGE INTO PRIVATE STORAGE.
 *
 * New uploads are private (`lib/uploads.ts`, `PRIVATE_KINDS`). Files stored
 * earlier are public blobs with unguessable addresses, and stay readable at
 * those addresses until they are moved. This copies each one into private
 * storage under the same path, points the row at the copy (a conditional
 * UPDATE on the old value, so a row changed meanwhile is left alone), and,
 * only when asked, deletes the public original.
 *
 *   npm run blobs:private                      # lists, changes nothing
 *   npm run blobs:private -- --apply           # copies and repoints
 *   npm run blobs:private -- --apply --delete-public
 *
 * Headshots are left public: they are published on the radar by design.
 * Needs `BLOB_READ_WRITE_TOKEN`, and `BLOB_PRIVATE_READ_WRITE_TOKEN` when the
 * main store is public. Run against production only by the operator, from
 * the runbook in `docs/TAKEOVER.md`.
 */
import { sql } from "drizzle-orm";

import { connect } from "./db";

const COLUMNS = [
  { table: "therapist_verifications", column: "id_front_url" },
  { table: "therapist_verifications", column: "id_back_url" },
  { table: "therapist_verifications", column: "license_doc_url" },
  { table: "people", column: "avatar_url" },
  { table: "manual_payments", column: "proof_url" },
  { table: "person_documents", column: "blob_url" },
  { table: "support_attachments", column: "storage_key" },
] as const;

function isPublicBlob(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  const deletePublic = process.argv.includes("--delete-public");
  const { db, pool } = connect();
  const { putPrivate } = await import("../lib/uploads");
  const { del } = await import("@vercel/blob");

  let found = 0;
  let moved = 0;
  for (const { table, column } of COLUMNS) {
    const rows = (
      await db.execute(sql`SELECT id, ${sql.identifier(column)} AS url FROM ${sql.identifier(table)}
                            WHERE ${sql.identifier(column)} LIKE 'https://%'`)
    ).rows as { id: string; url: string }[];
    const publicRows = rows.filter((row) => isPublicBlob(row.url));
    found += publicRows.length;
    console.log(`${table}.${column}: ${publicRows.length} public`);
    if (!apply) continue;

    for (const row of publicRows) {
      const response = await fetch(row.url);
      if (!response.ok) {
        console.log(`  skipped ${table} ${row.id.slice(0, 8)}: the public copy answered ${response.status}`);
        continue;
      }
      const body = Buffer.from(await response.arrayBuffer());
      const type = response.headers.get("content-type") ?? "application/octet-stream";
      const path = new URL(row.url).pathname.replace(/^\//, "");
      const privateUrl = await putPrivate(path, body, type);
      const updated = (
        await db.execute(sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${privateUrl}
                              WHERE id = ${row.id} AND ${sql.identifier(column)} = ${row.url} RETURNING id`)
      ).rows.length;
      if (updated === 0) {
        console.log(`  left ${table} ${row.id.slice(0, 8)}: the row changed meanwhile`);
        continue;
      }
      moved += 1;
      if (deletePublic) await del(row.url);
    }
  }

  console.log(`\n${found} public file(s) found, ${moved} moved${apply ? "" : " (dry run: add --apply)"}.`);
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
