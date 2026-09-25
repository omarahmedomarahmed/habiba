import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A10: a radar ban needs a real reason, taking somebody off the board
 * mid-booking tells the patient, and opening a transcript asks why first.
 */

const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));
const bodyOf = (source: string, fn: string) => {
  const start = source.indexOf(`export async function ${fn}(`);
  assert.ok(start >= 0, `${fn} is missing`);
  return source.slice(start, source.indexOf("\n}\n", start));
};

test("a ban and a release carry a reason nobody filled in for them", () => {
  assert.doesNotMatch(read("components/admin/radar-command.tsx"), /Administrator action/);
  const body = bodyOf(read("app/(admin)/admin/actions.ts"), "setRadarSuspension");
  const check = body.indexOf("reasonRefused(reason)");
  assert.ok(check > 0, "the server does not check the reason");
  assert.ok(check < body.indexOf("releaseFromRadarBan("), "a release is not checked");
  assert.doesNotMatch(body, /\|\| "Released"/);
});

test("force offline cancels a booking in flight and tells the patient, as ours", () => {
  const action = bodyOf(read("app/(admin)/admin/actions.ts"), "forceRadarOffline");
  assert.match(action, /reasonRefused\(reason\)/);
  assert.match(action, /forceOffline\(/);

  const lib = bodyOf(read("lib/data/radar-admin.ts"), "forceOffline");
  assert.match(lib, /before\?\.status === "pending"/, "a live session would be ended");
  assert.match(lib, /eq\(sessions\.status, "scheduled"\)/, "the cancel is not guarded");
  assert.match(lib, /afterClinicianCancel\(\{[\s\S]*byUs: true/);

  const cancel = read("lib/data/clinician-cancel.ts");
  assert.match(cancel, /input\.byUs \? "w2a\.cancelledByUs" : "w1a\.cancelledByClinician"/);
  // The operator's reason is ours; the patient is not sent it as "their reason".
  assert.match(cancel, /input\.byUs \? "" : t\("w1a\.cancelReasonGiven"/);
});

test("the transcript asks why before a word of it renders, and the reason is audited", () => {
  const page = read("app/(admin)/admin/radar/investigate/[id]/page.tsx");
  const gate = page.indexOf("reasonProblem(why)");
  assert.ok(gate > 0, "nothing asks why");
  assert.ok(gate < page.indexOf("await investigate(id)"), "the transcript is read before the reason");
  assert.match(page, /reason: `Report \$\{report\.id\}, \$\{report\.kind\}: \$\{reasonText\(why!\)\}`/);
});
