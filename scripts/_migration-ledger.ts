/**
 * Pure checks on the migration journal, shared by `verify:journal` (CI) and
 * `db:status` (production, read only). No database and no git in here.
 */
import { createHash } from "node:crypto";

export type JournalEntry = { idx: number; when: number; tag: string; breakpoints?: boolean };

/**
 * What a branch did to the journal it started from. Drizzle applies by `when`,
 * and production already holds every entry `main` had, so the journal may only
 * grow at the end: an edited, removed or reordered past entry means production
 * and a fresh database no longer agree.
 */
export function journalProblems(base: JournalEntry[], head: JournalEntry[]): string[] {
  const problems: string[] = [];

  base.forEach((entry, i) => {
    const now = head[i];
    if (!now) {
      problems.push(`${entry.tag} was removed (position ${String(i)})`);
      return;
    }
    if (now.tag !== entry.tag || now.idx !== entry.idx || now.when !== entry.when) {
      problems.push(
        `position ${String(i)} was ${entry.tag} (idx ${String(entry.idx)}, when ${String(entry.when)}) ` +
          `and is now ${now.tag} (idx ${String(now.idx)}, when ${String(now.when)})`,
      );
    }
  });

  for (let i = Math.max(base.length, 1); i < head.length; i += 1) {
    const previous = head[i - 1]!;
    const entry = head[i]!;
    if (entry.idx !== previous.idx + 1) {
      problems.push(`${entry.tag} has idx ${String(entry.idx)}, expected ${String(previous.idx + 1)}`);
    }
    if (entry.when <= previous.when) {
      problems.push(`${entry.tag} is stamped at or before ${previous.tag}, so drizzle would skip it`);
    }
  }

  return problems;
}

/** The hash drizzle stores for a migration: sha256 of the whole file. */
export function migrationHash(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export type LedgerRow = { hash: string; created_at: string | number };

export type MigrationStatus = {
  applied: number;
  /** In the journal and newer than the last applied one: `db:migrate` would apply these. */
  pending: string[];
  /** Applied with a different file than the repository holds now. */
  changed: string[];
  /** Older than the last applied one and not in the ledger: drizzle would skip them for ever. */
  skipped: string[];
};

/** Compares the journal (with each file's hash) to `drizzle.__drizzle_migrations`. */
export function migrationStatus(
  journal: (JournalEntry & { hash: string })[],
  ledger: LedgerRow[],
): MigrationStatus {
  const byWhen = new Map(ledger.map((row) => [Number(row.created_at), row.hash]));
  const last = ledger.reduce((max, row) => Math.max(max, Number(row.created_at)), -Infinity);

  const pending: string[] = [];
  const changed: string[] = [];
  const skipped: string[] = [];

  for (const entry of journal) {
    const stored = byWhen.get(entry.when);
    if (stored !== undefined) {
      if (stored !== entry.hash) changed.push(entry.tag);
    } else if (entry.when > last) {
      pending.push(entry.tag);
    } else {
      skipped.push(entry.tag);
    }
  }

  return { applied: ledger.length, pending, changed, skipped };
}
