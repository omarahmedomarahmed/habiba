/**
 * 🔴 TASK 40: NO PERSONAL FILE IS A PUBLIC BLOB.
 *
 * Licences, IDs, transfer receipts, support attachments, a patient's photo
 * and their documents are written private and read only through a route that
 * has decided who is asking. The headshot is the one public kind, on purpose.
 *
 * Proves it three ways:
 *   - the source: every `put(` in the product, what access it asks for, and
 *     every read of a stored file going through `fetchStored`;
 *   - the rule: which kinds are private, and how a private address is told
 *     from a public one;
 *   - the database: no personal column still points at a public blob (the
 *     move for older files is `npm run blobs:private`).
 *
 *   npm run verify:blobs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { sql } from "drizzle-orm";

import { stripCommentsKeepingLines } from "./_dashes";
import { reporter } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();
const ROOT = new URL("..", import.meta.url).pathname;
/* Code only: a comment that says what used to be written is not a write. */
const read = (path: string) => stripCommentsKeepingLines(readFileSync(join(ROOT, path), "utf8"));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(name)) out.push(rel);
  }
  return out;
}

async function main() {
  const files = ["app", "lib", "components"].flatMap(sourceFiles);

  /* ---------------------------------------------------------- writers -- */
  const importers = files.filter((file) => /from "@vercel\/blob"|import\("@vercel\/blob"\)/.test(read(file)));
  check(
    "only the upload module talks to blob storage",
    importers.length === 1 && importers[0] === "lib/uploads.ts",
    importers.join(", "),
  );
  const publicWrites = files.flatMap((file) =>
    [...read(file).matchAll(/access:\s*"public"/g)].map(() => file),
  );
  const uploads = read("lib/uploads.ts");
  /*
   * 🔴 Two public writes, both here: the headshot's, and the fallback while no
   * private store is configured, which a configured store never reaches.
   */
  const fallbackAt = uploads.indexOf("if (process.env.BLOB_PRIVATE_READ_WRITE_TOKEN) throw error;");
  check(
    "🔴 public writes are the headshot's and the no-private-store fallback, nowhere else",
    publicWrites.length === 2 && publicWrites.every((file) => file === "lib/uploads.ts") && fallbackAt > 0 &&
      uploads.indexOf('access: "public"', fallbackAt) > fallbackAt &&
      uploads.indexOf('access: "public"', fallbackAt) - fallbackAt < 500,
    publicWrites.join(", "),
  );
  const publicAt = uploads.indexOf('access: "public"', uploads.indexOf("export async function uploadDocument"));
  const before = uploads.slice(Math.max(0, publicAt - 400), publicAt);
  check(
    "…reached only after every private kind has returned",
    /if \(isPrivateKind\(opts\.kind\)\) \{\s*return \{ url: await putPrivate\(/.test(before),
  );
  check(
    "the private writer asks for private access and never caches",
    /export async function putPrivate[\s\S]{0,400}access: "private"[\s\S]{0,200}cacheControlMaxAge: 0/.test(uploads),
  );
  const documents = read("lib/data/documents.ts");
  check(
    "🔴 a patient's documents are written through the private writer",
    /putPrivate\(path, file, file\.type\)/.test(documents) && !/\bput\(/.test(documents),
  );

  /* ---------------------------------------------------------- the rule -- */
  const { PRIVATE_KINDS } = await import("../lib/uploads");
  check(
    "🔴 credentials, support attachments, avatars and receipts are private; the headshot is not",
    ["credential", "support", "avatar", "receipt"].every((kind) => (PRIVATE_KINDS as readonly string[]).includes(kind)) &&
      !(PRIVATE_KINDS as readonly string[]).includes("headshot"),
    JSON.stringify(PRIVATE_KINDS),
  );
  check(
    "a private address is told from a public one by its host",
    /hostname\.endsWith\("\.private\.blob\.vercel-storage\.com"\)/.test(uploads) &&
      /if \(!isPrivateBlobUrl\(url\)\) return fetch\(url, init\);[\s\S]{0,200}get\(url, \{ access: "private"/.test(uploads),
  );

  /* ----------------------------------------------------------- readers -- */
  const readers = [
    "app/api/uploads/[id]/route.ts",
    "app/api/documents/[id]/route.ts",
    "app/api/patient/avatar/[personId]/route.ts",
    "app/(admin)/admin/transfers/receipt/[id]/route.ts",
    "lib/documents/extract.ts",
  ];
  const unguarded = readers.filter((file) => {
    const text = read(file);
    return !/fetchStored\(/.test(text) || /await fetch\((decision\.storedUrl|document\.blobUrl|row\.avatarUrl|absolute|blobUrl)\b/.test(text);
  });
  check("🔴 every read of a stored file goes through `fetchStored`, after its route's own check", unguarded.length === 0, unguarded.join(", "));
  check(
    "🔴 a payer's own receipt is never handed back to the browser as an address",
    !/href=\{live\.proofUrl\}/.test(read("components/billing/pay-by-transfer.tsx")) &&
      /hasProof: Boolean\(live\.proofUrl\)/.test(read("lib/billing/manual-entry.ts")),
  );

  /* ---------------------------------------------------------- database -- */
  if (process.env.DATABASE_URL) {
    const { db, pool } = connect();
    const columns = [
      ["therapist_verifications", "id_front_url"],
      ["therapist_verifications", "id_back_url"],
      ["therapist_verifications", "license_doc_url"],
      ["people", "avatar_url"],
      ["manual_payments", "proof_url"],
      ["person_documents", "blob_url"],
      ["support_attachments", "storage_key"],
    ] as const;
    const left: string[] = [];
    for (const [table, column] of columns) {
      const rows = (
        await db.execute(sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)}
                              WHERE ${sql.identifier(column)} LIKE '%.public.blob.vercel-storage.com/%'`)
      ).rows as { n: number }[];
      if (Number(rows[0]?.n ?? 0) > 0) left.push(`${table}.${column}: ${rows[0]!.n}`);
    }
    check(
      "🔴 no personal column still points at a public blob (move older ones with `npm run blobs:private -- --apply`)",
      left.length === 0,
      left.join(", "),
    );
    await pool.end();
  }

  finish("private blobs");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
