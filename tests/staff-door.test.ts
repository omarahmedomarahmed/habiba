import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * AE56 and AE57: the back office door.
 *
 * A staff member who idled out at /admin carried a stale cookie, so the guard
 * sent them to /session-expired, which always redirected to /login, where the
 * practice form refuses a back office account. And both staff pages rendered
 * an empty h1 above the form's own heading.
 */

const read = (file: string) => readFileSync(file, "utf8");

test("AE56: an admin path goes back to the staff door, with or without a cookie", async () => {
  const { signInDoorFor, STAFF_SIGN_IN } = await import("../lib/routing");
  assert.equal(signInDoorFor("/admin/transfers"), STAFF_SIGN_IN);
  assert.equal(signInDoorFor("/admin"), STAFF_SIGN_IN);
  // Control: everybody else still goes to the practice door.
  assert.equal(signInDoorFor("/dashboard"), "/login");
  assert.equal(signInDoorFor(null), "/login");

  // Both places that bounce use the one answer; the route used to hard-code /login.
  const route = read("app/session-expired/route.ts");
  assert.match(route, /new URL\(signInDoorFor\(next\), env\.appUrl\)/);
  assert.doesNotMatch(route, /new URL\("\/login"/);
  assert.match(read("lib/auth/guard.ts"), /const door = signInDoorFor\(next\)/);
  // The staff door says why they are there, as the practice door does.
  assert.match(read("app/(auth)/staff/sign-in/page.tsx"), /params\.expired \? t\("tauth\.noticeExpired"\)/);
});

test("AE57: the quiet shell never renders an empty heading", () => {
  const shell = read("components/auth/auth-shell.tsx");
  const quiet = shell.slice(shell.indexOf("export async function QuietAuthShell"));
  assert.match(quiet, /\{title \? <h1/);
  for (const page of ["app/(auth)/staff/sign-in/page.tsx", "app/(auth)/staff/second-step/page.tsx"]) {
    assert.doesNotMatch(read(page), /<QuietAuthShell title=""/, `${page} asks for an empty h1`);
  }
});
