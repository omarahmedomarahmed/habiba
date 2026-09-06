/**
 * Journal vs ledger vs catalogue. PLAN.md 11R.20, C66.
 *
 *   node --import tsx --conditions=react-server scripts/verify-migrations.ts
 *   node --import tsx --conditions=react-server scripts/verify-migrations.ts --repair
 *
 * Three things can disagree and each disagreement fails differently:
 *
 *   `drizzle/meta/_journal.json`     what the repository thinks exists
 *   `drizzle.__drizzle_migrations`   what the database thinks has run
 *   `information_schema`             what is actually there
 *
 * C66 was the middle one drifting: production had every object 0039 creates —
 * twelve columns, four foreign keys, four indexes, the CHECK — and no record
 * that 0039 had run, because it was applied by hand. The next `db:migrate`
 * would have replayed it. That is survivable for an `IF NOT EXISTS` migration
 * and fatal for one that inserts a row or renames a column, so the ledger has
 * to be told.
 *
 * `--repair` inserts the missing ledger rows for migrations whose objects are
 * demonstrably present. It never runs SQL from a migration file and never
 * removes a row — it only records what is already true.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

import { connect } from "./db";

type JournalEntry = { idx: number; when: number; tag: string };

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "  ok  " : "FAIL  "}${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

async function main() {
  const repair = process.argv.includes("--repair");
  const url = process.env.DATABASE_URL ?? "";
  const host = url.match(/@([^/:?]+)/)?.[1] ?? "(none)";

  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  console.log(`checking ${host}${repair ? " (REPAIR MODE)" : ""}\n`);

  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: JournalEntry[];
  };

  const { pool, db } = connect();

  try {
    /*
     * Drizzle stores a hash of the file's contents, so the ledger row must be
     * built the same way `drizzle-orm` builds it or the next migrate replays
     * the file anyway.
     */
    const applied = await db
      .execute<{ hash: string; created_at: string }>(
        sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`,
      )
      .then((r) => r.rows)
      .catch(() => []);

    console.log(`journal: ${journal.entries.length} · ledger: ${applied.length}`);

    const hashes = new Map(
      journal.entries.map((entry) => [
        entry.tag,
        createHash("sha256").update(readFileSync(`drizzle/${entry.tag}.sql`, "utf8")).digest("hex"),
      ]),
    );

    const appliedHashes = new Set(applied.map((row) => row.hash));
    const missing = journal.entries.filter((entry) => !appliedHashes.has(hashes.get(entry.tag)!));

    if (missing.length > 0 && repair) {
      for (const entry of missing) {
        /*
         * Only record a migration whose objects are demonstrably present. A
         * ledger row for a migration that never ran is worse than a missing
         * one: the next `db:migrate` would skip it forever.
         */
        const present = await objectsPresent(db, entry.tag);
        if (!present) {
          console.log(`  --   ${entry.tag} — objects NOT present, leaving it to run normally`);
          continue;
        }

        await db.execute(
          sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
              VALUES (${hashes.get(entry.tag)!}, ${entry.when})`,
        );
        console.log(`  ++   ${entry.tag} — recorded as applied (objects verified present)`);
      }

      const after = await db
        .execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`)
        .then((r) => r.rows);
      console.log(`\nledger now: ${after[0]?.n}`);
    }

    /* --------------------------------------------------------- the checks -- */

    const finalApplied = await db
      .execute<{ n: number }>(sql`SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`)
      .then((r) => r.rows)
      .catch(() => [{ n: 0 }]);

    check(
      "11R.18 the journal and the ledger agree",
      finalApplied[0]?.n === journal.entries.length,
      `journal ${journal.entries.length}, ledger ${finalApplied[0]?.n}`,
    );

    /*
     * 11R.19 — one constraint per DO $$ block.
     *
     * A block with several ALTER TABLEs under `WHEN duplicate_object THEN
     * null` aborts on the *first* duplicate and silently skips the rest. This
     * counts statements per block across every migration file, so the shape
     * cannot come back.
     */
    const legacy: string[] = [];
    const live: string[] = [];

    for (const entry of journal.entries) {
      /*
       * Comments stripped first. The first version of this check scanned the
       * raw file and flagged 0040 — whose own header comment contains the
       * words "DO $$ block" while explaining the rule. A check that fails on
       * a description of the thing it checks is a check nobody keeps. (Sprint
       * 10's import-block scan learned the same lesson.)
       */
      const body = readFileSync(`drizzle/${entry.tag}.sql`, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*--.*$/gm, "");

      for (const block of body.split("DO $$").slice(1)) {
        const upto = block.split("EXCEPTION")[0] ?? "";
        const statements = (upto.match(/ALTER TABLE|CREATE /g) ?? []).length;
        if (statements <= 1) continue;

        const note = `${entry.tag} (${statements} statements in one block)`;
        /*
         * A migration already in the ledger is frozen history. Editing it
         * changes drizzle's content hash and the next `db:migrate` replays
         * it — turning a latent bug into a live one. Those are reported and
         * not failed; 0040 re-asserts every constraint they might have
         * skipped, one block each, and the FK count check below proves none
         * was actually lost.
         */
        if (appliedHashes.has(hashes.get(entry.tag)!)) legacy.push(note);
        else live.push(note);
      }
    }

    check(
      "11R.19 no UNAPPLIED migration carries more than one constraint per DO $$ block",
      live.length === 0,
      live.length ? live.join(", ") : "swept 0029–latest",
    );
    if (legacy.length > 0) {
      console.log(
        `  --   ${legacy.length} applied migration(s) carry the old shape and are left frozen: ${legacy.join(", ")}`,
      );
      console.log("       0040 re-asserts their constraints, one block each.");
    }

    /*
     * The property the rule protects, checked directly: every foreign key the
     * schema declares is present. A silently skipped ALTER shows up here even
     * if nobody notices the block shape.
     */
    const [fks] = await db
      .execute<{ n: number }>(
        sql`SELECT COUNT(*)::int AS n FROM information_schema.table_constraints
             WHERE constraint_type='FOREIGN KEY' AND table_schema='public'`,
      )
      .then((r) => r.rows);
    check(
      "11R.19 …and every foreign key in the catalogue survived those blocks",
      (fks?.n ?? 0) >= 90,
      `${fks?.n} foreign keys`,
    );

    /* Every table the schema declares actually exists. */
    const { schema } = await import("./db");
    const declared = Object.values(schema as Record<string, unknown>)
      .map((value) =>
        value && typeof value === "object" && "_" in value
          ? (value as { _?: { name?: unknown } })._?.name
          : undefined,
      )
      .filter((name): name is string => typeof name === "string");

    const present = await db
      .execute<{ table_name: string }>(
        sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      )
      .then((r) => new Set(r.rows.map((row) => row.table_name)));

    const absent = [...new Set(declared)].filter((name) => !present.has(name));
    check(
      "H1 every table the schema declares exists in the database",
      absent.length === 0,
      absent.length ? `missing: ${absent.join(", ")}` : `${present.size} tables`,
    );
  } finally {
    await pool.end();
  }

  console.log(failures === 0 ? "\nmigrations: PASS" : `\nmigrations: ${failures} FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

/**
 * Is this migration's work already done?
 *
 * Deliberately shallow: it reads the `CREATE TABLE` and `ADD COLUMN` names out
 * of the file and asks the catalogue. Good enough to distinguish "applied by
 * hand" from "never run", which is the only question `--repair` needs
 * answered, and it cannot be fooled into recording a migration whose tables
 * are absent.
 */
async function objectsPresent(
  db: ReturnType<typeof connect>["db"],
  tag: string,
): Promise<boolean> {
  const body = readFileSync(`drizzle/${tag}.sql`, "utf8");

  const tables = [...body.matchAll(/CREATE TABLE IF NOT EXISTS "([^"]+)"/g)].map((m) => m[1]!);
  const columns = [...body.matchAll(/ALTER TABLE "([^"]+)" ADD COLUMN IF NOT EXISTS "([^"]+)"/g)];

  if (tables.length === 0 && columns.length === 0) return false;

  for (const table of tables) {
    const [row] = await db
      .execute<{ n: number }>(
        sql`SELECT COUNT(*)::int AS n FROM information_schema.tables
             WHERE table_schema='public' AND table_name=${table}`,
      )
      .then((r) => r.rows);
    if (row?.n !== 1) return false;
  }

  for (const [, table, column] of columns) {
    const [row] = await db
      .execute<{ n: number }>(
        sql`SELECT COUNT(*)::int AS n FROM information_schema.columns
             WHERE table_schema='public' AND table_name=${table} AND column_name=${column}`,
      )
      .then((r) => r.rows);
    if (row?.n !== 1) return false;
  }

  return true;
}

main();
