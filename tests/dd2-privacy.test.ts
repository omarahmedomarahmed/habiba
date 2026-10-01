import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { ACCESS_STATES, capabilitiesFor, maySeeSharedRecord } from "../lib/access/state";
import { deliverableNoteQuery } from "../lib/partner/api";

/*
 * DD-2 workstream B1: privacy and consent. Each test fails if its fix is undone.
 */

const source = (path: string) => readFileSync(path, "utf8");

/* ------------------------------------------- 1. the shared record follows the grant -- */

test("B1.1 only a live grant or the clinician's own unclaimed file opens the shared record", () => {
  const open = ACCESS_STATES.filter((state) => maySeeSharedRecord(state));
  assert.deepEqual([...open].sort(), ["granted", "unclaimed_bare", "unclaimed_documented"]);
  assert.equal(maySeeSharedRecord("revoked"), false);
  assert.equal(maySeeSharedRecord("no_relationship"), false);
  /* The same line the files and journals follow for a claimed person. */
  for (const state of ["granted", "revoked"] as const) {
    assert.equal(maySeeSharedRecord(state), capabilitiesFor(state).patientFiles);
  }
});

test("B1.1 the clinician's profile page reads the profile, timeline and diagnoses only through the gated loaders", () => {
  const page = source("app/(app)/patients/[id]/documents/page.tsx");
  assert.match(page, /sharedProfileForClinician\(actor, id\)/);
  assert.match(page, /diagnosesForClinician\(actor, id\)/);
  assert.doesNotMatch(page, /listOwnDiagnoses|profileFor\(|timelineFor\(/);

  /* No exported reader of the profile or timeline takes a bare person id. */
  const memory = source("lib/data/memory.ts");
  assert.doesNotMatch(memory, /export async function (profileFor|timelineFor)\b/);
  assert.match(memory, /maySeeSharedRecord\(access\.state\)/);
  assert.match(source("lib/data/diagnoses.ts"), /maySeeSharedRecord\(access\.state\)/);

  /* Only the patient's own screens read the unscoped diagnoses. */
  const callers = ["app/(patient)/patient/profile/page.tsx", "lib/data/export.ts"];
  for (const file of callers) assert.match(source(file), /listOwnDiagnoses/);

  /* The case copilot no longer treats missing capabilities as "no restriction". */
  assert.match(source("lib/ai/case-copilot.ts"), /\n  capabilities: Capabilities;/);
});

/* ---------------------------------------------- 2. the partner sees its own, linked -- */

test("B1.2 a partner's note delivery needs a live link and a session in that partner's own practice", () => {
  const { sql, params } = deliverableNoteQuery("partner-1", "session-1").toSQL();
  assert.match(sql, /"partner_subjects"\."revoked_at" is null/);
  assert.match(sql, /inner join "organizations" on "organizations"\."id" = "sessions"\."organization_id"/);
  assert.match(sql, /"organizations"\."partner_id" = \$\d+/);
  assert.match(sql, /"organizations"\."billing_mode" = \$\d+/);
  assert.match(sql, /"partner_subjects"\."partner_id" = \$\d+/);
  assert.ok(params.filter((p) => p === "partner-1").length >= 2, "both scopes carry the partner id");
  assert.ok(params.includes("partner_billed"));
});

test("B1.2 every partner read by session reference refuses an unlinked person", () => {
  const platform = source("lib/partner/platform.ts");
  const mayAnswer = platform.slice(platform.indexOf("export async function mayAnswer"));
  assert.match(mayAnswer.slice(0, 1500), /subjectUnlinked\(/);
  /* transcript, summary, note and media all pass through mayAnswer */
  for (const route of ["transcript", "summary", "note", "media"]) {
    assert.match(source(`app/api/partner/v1/sessions/[ref]/${route}/route.ts`), /mayAnswer\(/);
  }
  /* memory and copilot through subjectRefusal, which uses the same helper */
  assert.match(source("lib/partner/copilot.ts"), /subjectUnlinked\(input\)/);
});
