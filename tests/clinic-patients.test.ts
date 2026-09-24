import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-C08 (founder's decision D2): the clinic sees each clinician's patients
 * as a first name and a last initial, and nothing clinical. The rows are
 * proved against a database in verify:sprint63; this file holds the shape.
 */

const read = (file: string) => readFileSync(file, "utf8");

test("the wall has a per-clinician patient list, names only", () => {
  const wall = read("lib/data/clinic.ts");
  const start = wall.indexOf("export async function patientsByClinician");
  assert.ok(start > 0, "no patient list in the clinic wall");
  const body = wall.slice(start, start + 3000);
  const select = body.slice(body.indexOf(".select({"), body.indexOf("})", body.indexOf(".select({")));
  // Names and the clinician they belong to. Nothing else leaves the database.
  assert.deepEqual(
    [...select.matchAll(/(\w+):/g)].map((match) => match[1]).sort(),
    ["firstName", "lastName", "therapistId"],
  );
  assert.match(body, /shortenForClinic\(/, "a full name reaches the practice");
  assert.match(body, /refuseWithout\(actor, "schedule\.read"\)/);
  assert.match(body, /scopeToAssigned\(actor, "schedule\.read"\)/, "an assistant sees every clinician's list");
});

test("the clinicians page shows it", () => {
  assert.match(read("app/(clinic)/clinic/people/page.tsx"), /patientsByClinician\(/);
  assert.match(read("components/clinic/people-list.tsx"), /person\.patients/);
});

test("the homepage no longer says there is no caseload count", () => {
  assert.doesNotMatch(read("lib/content/defaults.ts"), /no caseload count/);
});

test("a clinician joining is told the practice sees their patient list", () => {
  const form = read("components/clinic/join-form.tsx");
  assert.match(form, /clinic\.join\.sees\.patients/);
  // And not the two things no clinic screen shows (radar standing, prices).
  assert.doesNotMatch(form, /clinic\.join\.sees\.(radar|prices)/);
});
