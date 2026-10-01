/**
 * The migration journal only grows at the end.
 *
 *     npm run verify:journal
 *
 * Production already holds every migration `main` had when this branch forked,
 * and it is migrated by hand before a merge. So against that fork point:
 *
 *   - every past journal entry is unchanged (tag, idx, when) and in place;
 *   - every new entry is appended with the next idx and a later `when`;
 *   - no SQL file of a past entry was edited or deleted.
 *
 * The base is `git merge-base HEAD origin/main` (override with JOURNAL_BASE).
 * CI checks out the full history for this. Outside CI a missing base is
 * reported as deferred rather than failing a laptop with a shallow clone.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { journalProblems, type JournalEntry } from "./_migration-ledger";
import { reporter } from "./_verify";

const { check, skipUnless, finish } = reporter();

function git(args: string[]): { ok: boolean; out: string } {
  const run = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: run.status === 0, out: (run.stdout ?? "").trim() };
}

async function main(): Promise<void> {
  const wanted = process.env.JOURNAL_BASE ?? "origin/main";
  const base = git(["merge-base", "HEAD", wanted]);
  const inCi = Boolean(process.env.GITHUB_ACTIONS);

  if (!base.ok && inCi) {
    check(`the journal base ${wanted} is available`, false, "fetch the full history in the workflow");
    finish("verify:journal");
  }

  await skipUnless(base.ok, "a clone with origin/main", `no merge base with ${wanted}`, () => {
    const ref = base.out;
    const before = git(["show", `${ref}:drizzle/meta/_journal.json`]);
    check("the base journal was read", before.ok, ref.slice(0, 12));
    if (!before.ok) return;

    const baseEntries = (JSON.parse(before.out) as { entries: JournalEntry[] }).entries;
    const headEntries = (JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as { entries: JournalEntry[] })
      .entries;

    const problems = journalProblems(baseEntries, headEntries);
    check(
      "no past journal entry was edited, removed or reordered, and new ones are appended in order",
      problems.length === 0,
      problems.slice(0, 6).join("; ") ||
        `${String(baseEntries.length)} past entries kept, ${String(headEntries.length - baseEntries.length)} added`,
    );

    /* Working tree against the base, so an uncommitted edit is caught locally too. */
    const diff = git(["diff", "--name-status", "--no-renames", ref, "--", "drizzle"]);
    const pastFiles = new Set(baseEntries.map((entry) => `drizzle/${entry.tag}.sql`));
    const touched = diff.out
      .split("\n")
      .filter(Boolean)
      .map((line) => line.split("\t"))
      .filter(([status, path]) => status !== "A" && path !== undefined && pastFiles.has(path))
      .map(([status, path]) => `${status!} ${path!}`);
    check(
      "no migration that main already had was edited or deleted",
      diff.ok && touched.length === 0,
      touched.slice(0, 6).join(", ") || `${String(pastFiles.size)} past files unchanged`,
    );
  });

  finish("verify:journal");
}

void main();
