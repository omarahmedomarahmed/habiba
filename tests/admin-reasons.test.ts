import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A05: every destructive or customer-visible act in the console asks for a
 * confirm and a reason, and the server checks the same length the screen
 * enables at.
 */

const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));
const bodyOf = (source: string, fn: string) => {
  const start = source.indexOf(`export async function ${fn}(`);
  assert.ok(start >= 0, `${fn} is missing`);
  return source.slice(start, source.indexOf("\n}\n", start));
};

test("one number for a reason, and it is ten", async () => {
  const { MIN_REASON, reasonProblem } = await import("../lib/admin/reason");
  assert.equal(MIN_REASON, 10);
  assert.equal(reasonProblem("too short"), "aconfirm.tooShort");
  assert.equal(reasonProblem("   padded    "), "aconfirm.tooShort");
  assert.equal(reasonProblem(undefined), "aconfirm.tooShort");
  assert.equal(reasonProblem("They asked us to, by email."), null);
});

test("every destructive or customer-visible act checks the reason on the server", () => {
  const acts: [string, string[]][] = [
    [
      "app/(admin)/admin/actions.ts",
      [
        "suspendUser",
        "applyInvoiceDiscount",
        "editInvoice",
        "releaseTherapistEarnings",
        "adjustLedger",
        "applyUpcomingDiscount",
        "setTaxonomyState",
        "removeTaxonomy",
        // 🔴 K23: these took one, four or no characters.
        "refundPatient",
        "resolveReport",
        "decideTherapistVerification",
      ],
    ],
    ["app/(admin)/admin/sponsors/actions.ts", ["activate", "mintCode"]],
    ["app/(admin)/admin/clinics/actions.ts", ["setState"]],
    ["app/(admin)/admin/partners/actions.ts", ["setState", "withdrawProduction"]],
    ["app/(admin)/admin/benefits/actions.ts", ["liftPause"]],
    ["app/(admin)/admin/actuals/actions.ts", ["removeCapitalAction"]],
  ];
  const missing: string[] = [];
  for (const [file, fns] of acts) {
    const source = read(file);
    for (const fn of fns) {
      if (!/reasonRefused\(|reasonProblem\(/.test(bodyOf(source, fn))) missing.push(`${file}#${fn}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("the transfer rejection enables at the number the server refuses below", () => {
  assert.match(read("components/admin/receipt-modal.tsx"), /reason\.trim\(\)\.length < MIN_REASON/);
  assert.doesNotMatch(read("components/admin/receipt-modal.tsx"), /length < 5\b/);
  assert.match(read("lib/billing/manual.ts"), /reason\.length < MIN_REASON/);
});

test("no console screen throws away what an act returned", () => {
  const dir = "components/admin";
  const voided = readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .filter((f) => /void \(await (setState|activate|mintCode|liftPause|suspendUser)\(/.test(read(join(dir, f))));
  assert.deepEqual(voided, []);

  // The one-press versions are gone from the screens the inventory named.
  assert.match(read("components/admin/clinician-row.tsx"), /<ConfirmWithReason/);
  assert.match(read("components/admin/taxonomy-editor.tsx"), /<ConfirmWithReason/);
  assert.match(read("components/admin/paused-benefits.tsx"), /<ConfirmWithReason/);
  assert.match(read("components/admin/sponsor-manager.tsx"), /mintCode\(sponsor\.id, reason\)/);
});

test("K2: no console shortcut gives a verification verdict outside the queue", () => {
  const actions = read("app/(admin)/admin/actions.ts");
  // The shortcut wrote therapist_verifications directly: no documents, no second reviewer, no email.
  assert.doesNotMatch(actions, /export async function verifyUser\(/);
  assert.doesNotMatch(read("lib/data/admin.ts"), /export async function setVerification\(/);
  for (const screen of ["components/admin/clinician-row.tsx", "components/admin/therapist-panel.tsx"]) {
    const source = read(screen);
    assert.doesNotMatch(source, /verifyUser/, `${screen} still decides a verification`);
    assert.match(source, /href="\/admin\/verifications"/, `${screen} does not send the reviewer to the queue`);
  }
  // The only verdict path left is the queue's, which runs decideVerification.
  assert.match(bodyOf(actions, "decideTherapistVerification"), /decideVerification\(/);
});
