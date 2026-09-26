import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * W2-C04 and W2-C05: nobody types another person's password, and a clinic
 * manager or staff member who forgets theirs can get back in.
 *
 * The clinic admin added staff by typing the new person's password into a
 * form; there was no remove, no change of role and no sign-out; and no clinic
 * principal had any reset at all. Now: an invitation link the staff member
 * sets their own password from (the clinician invitation's shape), remove,
 * change role, sign out everywhere, and a reset by email link (the
 * clinician's shape). The database behaviour is in verify:w2c, which needs
 * migration 0131 applied.
 */

const read = (file: string) => readFileSync(file, "utf8");

test("C04: adding staff takes no password, from anybody", () => {
  const team = read("lib/data/clinic-team.ts");
  const start = team.indexOf("export async function addStaff");
  const add = team.slice(start, team.indexOf("\nexport async function", start + 10));
  assert.ok(start > 0 && add.length > 0);
  assert.doesNotMatch(add, /input\.password|hashPassword\(/, "addStaff still takes a password somebody else typed");
  assert.match(add, /passwordHash: null/, "a staff row is created able to sign in before they chose anything");

  const actions = read("app/(clinic)/clinic/team/actions.ts");
  assert.doesNotMatch(actions, /formData\.get\("password"\)/);
  assert.doesNotMatch(read("components/clinic/team.tsx"), /name="password"/);
});

test("C04: the admin can remove, change role, sign out and re-invite", () => {
  const actions = read("app/(clinic)/clinic/team/actions.ts");
  for (const name of ["removeStaff", "changeStaffRole", "signOutStaff", "reinviteStaff"]) {
    const start = actions.indexOf(`export async function ${name}`);
    assert.ok(start > 0, `no ${name}`);
    const body = actions.slice(start, start + 2500);
    assert.match(body, /requireClinicAdmin\(\)/, `${name} is not the admin's`);
    assert.match(body, /await audit\(/, `${name} leaves no record`);
  }
});

test("C04 / C05: one token module, hashed, single use, expiring, and it ends sessions", () => {
  const file = "lib/clinic-auth/tokens.ts";
  assert.ok(existsSync(file));
  const tokens = read(file);
  assert.match(tokens, /createHash\("sha256"\)/, "the raw token is stored");
  assert.match(tokens, /isNull\(clinicAuthTokens\.usedAt\)/, "a link works twice");
  assert.match(tokens, /gt\(clinicAuthTokens\.expiresAt/, "a link never expires");
  assert.match(tokens, /revokeClinicSessionsFor\(/, "a reset leaves an attacker's session alive");
});

test("C05: a forgot-password door and a set-password door, both open", async () => {
  assert.ok(existsSync("app/(clinic)/clinic/forgot-password/page.tsx"));
  assert.ok(existsSync("app/(clinic)/clinic/set-password/page.tsx"));

  const routing = await import("../lib/routing");
  assert.ok(routing.isClinicDoor("/clinic/forgot-password"));
  assert.ok(routing.isClinicDoor("/clinic/set-password"));
  assert.match(read("lib/routing.ts"), /openRoutes: \[CLINIC_APPLY, CLINIC_JOIN, CLINIC_FORGOT, CLINIC_SET_PASSWORD[,\]]/);

  // And the sign-in says where it is.
  assert.match(read("app/(clinic)/clinic/sign-in/page.tsx"), /href="\/clinic\/forgot-password"/);
});
