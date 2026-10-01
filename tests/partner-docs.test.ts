import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { PARTNER_DOC_EXAMPLES, exampleJson, readConsentBody, readSessionBody } from "../lib/partner/bodies";

/*
 * DD-2: the request bodies printed on /developers and /integrations are read
 * by the routes' own parsers, so a documented body that would get a 400 fails.
 */

const parse = (text: string) => JSON.parse(text) as Record<string, unknown>;

test("the documented POST /sessions body is accepted by the route's reader", () => {
  const read = readSessionBody(parse(exampleJson(PARTNER_DOC_EXAMPLES.session)));
  assert.ok(read.ok, read.ok ? "" : read.error);
});

test("the documented POST /consent body is accepted by the route's reader", () => {
  const read = readConsentBody(parse(exampleJson(PARTNER_DOC_EXAMPLES.consent)));
  assert.ok(read.ok, read.ok ? "" : read.error);
});

test("control: the camelCase bodies the docs used to print are refused", () => {
  assert.equal(
    readSessionBody({
      subjectRef: "YOUR-REF",
      clinicianEmail: "dr@example.com",
      startedAt: "2026-09-12T14:00:00Z",
      durationMinutes: 50,
      externalMeetingId: "M-8814",
    }).ok,
    false,
  );
  assert.equal(readConsentBody({ subjectRef: "x", scope: "history", askedBy: "dr", channel: "sms" }).ok, false);
  assert.equal(readConsentBody({ ...PARTNER_DOC_EXAMPLES.consent, state: "pending" }).ok, false);
  assert.equal(readConsentBody({ ...PARTNER_DOC_EXAMPLES.consent, answered_at: "not a time" }).ok, false);
});

test("both routes read their body through these readers, and both pages print these examples", () => {
  assert.match(readFileSync("app/api/partner/v1/sessions/route.ts", "utf8"), /readSessionBody\(body\)/);
  assert.match(readFileSync("app/api/partner/v1/consent/route.ts", "utf8"), /readConsentBody\(body\)/);
  for (const page of ["app/(public)/developers/page.tsx", "app/(public)/integrations/page.tsx"]) {
    const source = readFileSync(page, "utf8");
    assert.match(source, /exampleJson\(PARTNER_DOC_EXAMPLES\.session\)/, page);
    assert.match(source, /exampleJson\(PARTNER_DOC_EXAMPLES\.consent\)/, page);
    assert.doesNotMatch(source, /"subjectRef"|"clinicianEmail"|"externalMeetingId"/, page);
  }
});
