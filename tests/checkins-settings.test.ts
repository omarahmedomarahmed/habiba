import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A08: the check-in settings are editable, and a halted channel can be
 * resumed. The group had no parser, so a stored value was never read.
 */

const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));

test("a stored check-in setting is read, inside its bounds", async () => {
  const { parseGroup, SETTINGS_DEFAULTS } = await import("../lib/settings/defs");
  const stored = parseGroup("checkins", {
    enabled: true,
    everyHours: 12,
    quietFromHour: 22,
    quietToHour: 8,
    muteRateHalt: 0.3,
    measuredSince: "2026-09-24T10:00:00.000Z",
  });
  assert.equal(stored.enabled, true, "the channel cannot be switched on");
  assert.equal(stored.everyHours, 12);
  assert.equal(stored.quietFromHour, 22);
  assert.equal(stored.muteRateHalt, 0.3);
  assert.equal(stored.measuredSince, "2026-09-24T10:00:00.000Z");

  // Out of bounds falls back to the shipped value, never to something worse.
  const wild = parseGroup("checkins", { everyHours: 1, quietToHour: 30, muteRateHalt: 5, measuredSince: "soon" });
  assert.equal(wild.everyHours, SETTINGS_DEFAULTS.checkins.everyHours);
  assert.equal(wild.quietToHour, SETTINGS_DEFAULTS.checkins.quietToHour);
  assert.equal(wild.muteRateHalt, SETTINGS_DEFAULTS.checkins.muteRateHalt);
  assert.equal(wild.measuredSince, null);
  assert.equal(parseGroup("checkins", {}).enabled, false, "off unless somebody turns it on");
});

test("the page edits them, a halt can be resumed, and the sender measures the same way", () => {
  const page = read("app/(admin)/admin/checkins/page.tsx");
  assert.match(page, /<CheckinsEditor/);
  assert.match(page, /muteRate\(settings\.checkins\.measuredSince\)/);
  assert.match(read("lib/checkins/send.ts"), /muteRate\(settings\.checkins\.measuredSince\)/);
  assert.match(read("lib/data/checkins.ts"), /m\.muted_at >= /);

  const actions = read("app/(admin)/admin/checkins/actions.ts");
  for (const fn of ["saveCheckins", "resumeCheckins"]) {
    const body = actions.slice(actions.indexOf(`export async function ${fn}(`));
    assert.match(body.slice(0, 400), /await requireRole\("super_admin"\)/, fn);
    assert.match(body.slice(0, 1600), /await audit\(/, fn);
  }
  assert.match(actions.slice(actions.indexOf("export async function resumeCheckins(")), /reasonProblem\(reason\)/);
});
