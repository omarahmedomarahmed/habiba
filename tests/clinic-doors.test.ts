import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-T08 and W2-C07: the practice's doors lead somewhere.
 *
 * The enquiry page and the invited clinician's page rendered with no site
 * header, no logo and no language switch, and both done states were dead
 * ends: "Thank you. We will call you." and "You are in. Verify your licence
 * next." with nothing to press. The invited clinician was not even signed in.
 */

const read = (file: string) => readFileSync(file, "utf8");

test("C07: the enquiry and the invitation render inside the site's own header", () => {
  for (const page of ["app/(clinic)/clinic/apply/page.tsx", "app/(clinic)/clinic/join/[token]/page.tsx"]) {
    assert.match(read(page), /<QuietAuthShell/, `${page} has no header, logo or language switch`);
  }
  // And the portal's rail steps aside for them, as it does for the sign-in door.
  assert.match(read("app/(clinic)/layout.tsx"), /isClinicDoor\(/);
});

test("C07: the enquiry's done state leads somewhere", () => {
  const form = read("components/clinic/apply-form.tsx");
  const done = form.slice(form.indexOf("if (state.sent)"), form.indexOf("return (\n    <Card className=\"p-5\">\n      <form"));
  assert.match(done, /<Link/, "Thank you, and nothing to press");
});

test("T08: accepting an invitation signs the clinician in and takes them on", () => {
  const actions = read("app/(clinic)/clinic/join/[token]/actions.ts");
  for (const name of ["accept", "joinWithAccount"]) {
    const body = actions.slice(actions.indexOf(`export async function ${name}`));
    const end = body.indexOf("\nexport async function", 10);
    const own = end === -1 ? body : body.slice(0, end);
    assert.match(own, /createSession\(/, `${name} leaves them signed out`);
    assert.match(own, /redirect\("\/dashboard"\)/, `${name} leaves them on a dead end`);
  }
});

test("T08: the done card, if it is ever seen, has a way on", () => {
  const form = read("components/clinic/join-form.tsx");
  const done = form.slice(form.indexOf("if (state.ok || existingState.ok)"));
  assert.match(done.slice(0, 600), /href="\/onboarding"/);
});
