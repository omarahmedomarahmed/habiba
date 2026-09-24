import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W1-02: who may act on an organisation's account.
 *
 * A clinic seat clinician's session carries the CLINIC's organisation id, so
 * every action that did `requireUser` and then acted on `actor.organizationId`
 * let any clinician on a seat change the clinic's seats, cancel its plan, pay
 * or declare its bills and disconnect its record system. The rule: an
 * org-level money or records action runs only for a solo practice. A clinic's
 * account is run from the clinic portal.
 */

const ORG_ACTION_FILES = [
  "app/(app)/billing/actions.ts",
  "app/(app)/settings/records/actions.ts",
];

/** Every exported async function, with its body up to the next top-level export. */
function exportedBodies(source: string): Map<string, string> {
  const bodies = new Map<string, string>();
  const starts = [...source.matchAll(/^export async function (\w+)/gm)];
  for (const [index, match] of starts.entries()) {
    const end = starts[index + 1]?.index ?? source.length;
    bodies.set(match[1]!, source.slice(match.index, end));
  }
  return bodies;
}

test("every org-level billing and records action asks for account authority", () => {
  const unguarded: string[] = [];
  let seen = 0;

  for (const file of ORG_ACTION_FILES) {
    for (const [name, body] of exportedBodies(readFileSync(file, "utf8"))) {
      seen += 1;
      if (!/requireOrgAccount\(/.test(body)) unguarded.push(`${file}#${name}`);
    }
  }

  // CONTROL: the scan found the actions, so "none unguarded" is not "none read".
  assert.ok(seen >= 12, `only ${seen} actions found`);
  assert.deepEqual(unguarded, [], "a seat clinician can reach these");
});

test("a solo practice runs its own account; a clinic seat does not", async () => {
  const { mayRunOrgAccount } = await import("../lib/auth/org-authority");

  assert.equal(mayRunOrgAccount("solo"), true);
  assert.equal(mayRunOrgAccount("clinic"), false);
  // An organisation we could not read is refused, never assumed solo.
  assert.equal(mayRunOrgAccount(null), false);
  assert.equal(mayRunOrgAccount(undefined), false);
});

test("the billing and records pages hide account controls from a seat clinician", () => {
  const billing = readFileSync("app/(app)/billing/page.tsx", "utf8");
  const records = readFileSync("app/(app)/settings/records/page.tsx", "utf8");

  assert.match(billing, /mayRunOrgAccount\(/, "the billing page never asks");
  assert.match(records, /canManage=\{/, "the records page never tells the panel");
});
