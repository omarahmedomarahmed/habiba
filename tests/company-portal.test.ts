import assert from "node:assert/strict";
import { test } from "node:test";

import { readSource } from "../scripts/_verify";

/**
 * Wave 2, the company portal: the dead ends a company met with no way forward.
 * `takeover/FIX-PLAN.md` W2-S03, W2-S04 and the rest of the company list.
 *
 * These read the components rather than render them, because what each one
 * asserts is a SHAPE of the control: whether a tap on a reason ends a benefit
 * straight away, whether there is a way back out of a confirm, whether the
 * portal chrome prints. Comments are stripped by `readSource` (C205), so a
 * paragraph describing a Cancel button does not count as one.
 */

/* ------------------------------------------------------------ W2-S03 -- */

test("W2-S03 a company with no joining code can create its first one", () => {
  const actions = readSource("app/(sponsor)/sponsor/code/actions.ts");
  assert.match(actions, /export async function createCode\(/, "no createCode action");
  assert.match(
    actions.slice(actions.indexOf("export async function createCode")),
    /requireSponsorAdmin\(\)[\s\S]*mintFirstCode\(/,
    "createCode must be admin only and go through mintFirstCode",
  );

  const page = readSource("app/(sponsor)/sponsor/code/page.tsx");
  assert.match(page, /<CreateCode\b/, "the no-code state offers nothing to press");
});

test("W2-S03 the poster prints without the portal around it", () => {
  const desk = readSource("components/portal/desk.tsx");
  for (const tag of ["<aside", "<header", "<footer"]) {
    const at = desk.indexOf(tag);
    assert.ok(at >= 0, `${tag} not found in the desk`);
    const open = desk.slice(at, desk.indexOf(">", at));
    assert.match(open, /print:hidden/, `the desk's ${tag} prints with the poster`);
  }

  const page = readSource("app/(sponsor)/sponsor/code/page.tsx");
  assert.match(page, /print:hidden/, "the page heading prints with the poster");

  const bar = readSource("components/billing/pending-bar.tsx");
  assert.match(bar, /print:hidden/, "the pending payment bar prints with the poster");
});

/* ------------------------------------------------------------ W2-S06 -- */

test("W2-S06 a staff number is set up from a preset, and the preset admits what it says", async () => {
  const gate = (await import("../lib/sponsor/gate").catch(() => null)) as
    | typeof import("../lib/sponsor/gate")
    | null;
  assert.ok(gate, "lib/sponsor/gate.ts does not exist");

  const six = gate.presetPattern({ preset: "digits", length: 6, prefix: "" });
  assert.ok(six, "six digits is not a preset");
  const field = { kind: "id_number" as const, domain: null, pattern: six };
  assert.equal(gate.matchesGate(field, "204511"), true);
  assert.equal(gate.matchesGate(field, "2045110"), false);
  assert.equal(gate.matchesGate(field, "20451a"), false);

  /*
   * A prefix typed in capitals, as it is printed on a staff card. `matchesGate`
   * lowercases what the employee types, so a pattern kept in capitals would
   * refuse every one of them.
   */
  const prefixed = gate.presetPattern({ preset: "prefixed", length: 4, prefix: "EMP" });
  assert.ok(prefixed);
  const pf = { kind: "id_number" as const, domain: null, pattern: prefixed };
  assert.equal(gate.matchesGate(pf, "EMP2045"), true);
  assert.equal(gate.matchesGate(pf, "emp2045"), true);
  assert.equal(gate.matchesGate(pf, "XEMP2045"), false);

  /* A prefix is text, never a pattern: a dot matches a dot and nothing else. */
  const dotted = gate.presetPattern({ preset: "prefixed", length: 2, prefix: "A." });
  assert.ok(dotted);
  assert.equal(gate.matchesGate({ kind: "id_number", domain: null, pattern: dotted }, "ab12"), false);

  assert.equal(gate.presetPattern({ preset: "digits", length: 0, prefix: "" }), null);
  assert.equal(gate.presetPattern({ preset: "digits", length: 99, prefix: "" }), null);
});

test("W2-S06 the settings form has a test box and warns about an unproved domain", () => {
  const form = readSource("components/sponsor/gate-settings.tsx");
  assert.match(form, /matchesGate\(/, "no test box running the real gate");
  assert.match(form, /t\("sponsor\.gateUnproved"\)/, "an unproved domain gate is not warned about");
  assert.doesNotMatch(form, /name="pattern"/, "a raw pattern box is still offered");

  const page = readSource("app/(sponsor)/sponsor/settings/page.tsx");
  assert.match(page, /domainProved\(/, "the page never asks whether the domain is proved");

  const enrol = readSource("lib/data/enrolment.ts");
  assert.match(enrol, /from "@\/lib\/sponsor\/gate"/, "enrolment runs a different gate from the test box");
});

/* ------------------------------------------------------------ W2-S07 -- */

test("W2-S07 the verify-cycle screen and the pause job read the same number", () => {
  /*
   * Both screens print `settings.sponsor.verifyCycleMonths` (six); the job read
   * `sponsors.verify_cycle_months`, a column defaulting to three that nothing
   * writes. So a company was told six months and paused its people at three.
   */
  const job = readSource("lib/data/enrolment-verify.ts");
  const pause = job.slice(job.indexOf("export async function pauseUnverified"));
  assert.doesNotMatch(pause, /sponsors\.verifyCycleMonths/, "the job reads the column");
  assert.match(pause, /settings\.sponsor\.verifyCycleMonths/, "the job does not read the setting");

  for (const page of [
    "app/(sponsor)/sponsor/people/page.tsx",
    "app/(sponsor)/sponsor/settings/page.tsx",
  ]) {
    assert.match(readSource(page), /settings\.sponsor\.verifyCycleMonths/, page);
  }
});

/* ------------------------------------------------------------ W2-S04 -- */

test("W2-S04 ending a benefit takes a reason, then a final confirm, and can be cancelled", () => {
  const roster = readSource("components/sponsor/roster-list.tsx");
  /* A reason button only chooses. The act is its own button. */
  assert.doesNotMatch(
    roster,
    /onClick=\{\(\) => remove\(person\.enrolmentId, reason\)\}/,
    "one tap on a reason still ends the benefit",
  );
  assert.match(roster, /t\("sponsor\.cancel"\)/, "no way back out once the panel is open");
  assert.match(roster, /t\("sponsor\.benefitEnded"/, "nothing says the benefit ended");
});

test("W2-S04 replace code, remove field and revoke key each get Cancel and a success line", () => {
  for (const file of [
    "components/sponsor/code-card.tsx",
    "components/sponsor/gate-settings.tsx",
    "components/sponsor/integrations.tsx",
  ]) {
    const source = readSource(file);
    assert.match(source, /<ConfirmAct\b/, `${file} acts on one tap`);
  }

  const confirm = readSource("components/sponsor/confirm-act.tsx");
  assert.match(confirm, /t\("sponsor\.cancel"\)/, "the confirm has no Cancel");
  assert.match(confirm, /done/, "the confirm never reports success");
});
