import assert from "node:assert/strict";
import { test } from "node:test";

import { journalProblems, migrationHash, migrationStatus, type JournalEntry } from "../scripts/_migration-ledger";

const base: JournalEntry[] = [
  { idx: 0, when: 1000, tag: "0000_first" },
  { idx: 1, when: 2000, tag: "0001_second" },
];

test("appending entries in order is fine", () => {
  assert.deepEqual(journalProblems(base, [...base, { idx: 2, when: 3000, tag: "0002_third" }]), []);
  assert.deepEqual(journalProblems(base, base), []);
  assert.deepEqual(journalProblems([], [{ idx: 0, when: 1, tag: "0000_first" }]), []);
});

test("an edited, removed or reordered past entry is refused", () => {
  assert.equal(journalProblems(base, [base[0]!]).length, 1, "removed");
  assert.equal(journalProblems(base, [base[0]!, { ...base[1]!, when: 2500 }]).length, 1, "restamped");
  assert.equal(journalProblems(base, [base[0]!, { ...base[1]!, tag: "0001_renamed" }]).length, 1, "renamed");
  assert.ok(journalProblems(base, [base[1]!, base[0]!]).length >= 2, "reordered");
});

test("a new entry with the wrong idx or an earlier stamp is refused", () => {
  assert.equal(journalProblems(base, [...base, { idx: 5, when: 3000, tag: "0002_x" }]).length, 1);
  assert.equal(journalProblems(base, [...base, { idx: 2, when: 2000, tag: "0002_x" }]).length, 1);
});

test("status splits the journal into applied, pending, changed and skipped", () => {
  const journal = [
    { ...base[0]!, hash: migrationHash("a") },
    { ...base[1]!, hash: migrationHash("b") },
    { idx: 2, when: 3000, tag: "0002_third", hash: migrationHash("c") },
  ];

  const fresh = migrationStatus(journal, []);
  assert.deepEqual(fresh.pending, ["0000_first", "0001_second", "0002_third"]);

  const behind = migrationStatus(journal, [
    { hash: migrationHash("a"), created_at: "1000" },
    { hash: migrationHash("b"), created_at: 2000 },
  ]);
  assert.deepEqual(behind, { applied: 2, pending: ["0002_third"], changed: [], skipped: [] });

  const edited = migrationStatus(journal, [
    { hash: migrationHash("a, edited later"), created_at: 1000 },
    { hash: migrationHash("c"), created_at: 3000 },
  ]);
  assert.deepEqual(edited.changed, ["0000_first"]);
  assert.deepEqual(edited.skipped, ["0001_second"], "an entry behind the last applied one is never applied");
  assert.deepEqual(edited.pending, []);
});
