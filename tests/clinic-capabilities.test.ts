import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-C01: a clinic page asks for its capability by name and redirects, and
 * the home renders for every role.
 *
 * `/clinic/people`, `/clinic/bills` and `/clinic/records` called
 * `requireClinic` only, so a staff member who typed the URL reached a data
 * function that threw `ClinicRefused`, and the group has no error boundary.
 * `/clinic` ran `clinicUsage` (reports.read) for anybody, so a role with only
 * schedule.read crashed on the page every refusal redirects to: no working
 * home at all. The usage scoping is proved against a database in
 * verify:sprint63.
 */

const read = (file: string) => readFileSync(file, "utf8");

const PAGES: [string, string][] = [
  ["app/(clinic)/clinic/people/page.tsx", "people.read"],
  ["app/(clinic)/clinic/bills/page.tsx", "bills.read"],
  ["app/(clinic)/clinic/records/page.tsx", "team.manage"],
  ["app/(clinic)/clinic/earnings/page.tsx", "earnings.read"],
  ["app/(clinic)/clinic/team/page.tsx", "team.manage"],
];

test("each clinic page asks for the capability its tab needs", () => {
  for (const [page, capability] of PAGES) {
    assert.match(
      read(page),
      new RegExp(`requireClinicCapability\\("${capability.replace(".", "\\.")}"\\)`),
      `${page} lets any principal reach a query that throws`,
    );
  }
});

test("the home never redirects, and reads only what the principal holds", () => {
  const home = read("app/(clinic)/clinic/page.tsx");
  // Every refused capability redirects HERE, so this page must not refuse.
  assert.doesNotMatch(home, /requireClinicCapability\(/, "the home can bounce to itself");
  assert.match(home, /can\(actor\.capabilities, "schedule\.read"\)/, "the rota runs for anybody");
  assert.match(home, /can\(actor\.capabilities, "reports\.read"\)/, "usage runs for anybody");
});
