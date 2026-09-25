import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A01: one role table drives the console's nav and its guards, staff land
 * on a page they can use, every refusal is on the record (A5), and staff work
 * payouts and verifications under the four-eyes rules (D9).
 */

const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));
const ROOT = "app/(admin)/admin";

function pagesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...pagesUnder(path));
    else if (entry === "page.tsx" || entry === "route.ts") out.push(path);
  }
  return out;
}

function routeOf(file: string): string {
  const rel = file.slice("app/(admin)".length).replace(/\/(page\.tsx|route\.ts)$/, "");
  return rel || "/admin";
}

/** The roles a page's own guard admits, read from its source. */
function guardRoles(source: string): string[] | null {
  if (/await requireStaff\(\)/.test(source)) return ["staff", "manager", "super_admin"];
  if (/await requireManager\(\)/.test(source)) return ["manager", "super_admin"];
  if (/await requireRole\("super_admin"\)/.test(source)) return ["super_admin"];
  return null;
}

test("every console page has a row in the table, and its guard agrees with the row", async () => {
  const { ADMIN_PAGES } = await import("../lib/admin/access");
  const files = pagesUnder(ROOT);
  const disagree: string[] = [];

  for (const file of files) {
    const route = routeOf(file);
    const row = ADMIN_PAGES[route];
    const guard = guardRoles(read(file));
    if (!row) disagree.push(`${route}: no row`);
    else if (!guard) disagree.push(`${route}: no guard found`);
    else if ([...row].sort().join() !== [...guard].sort().join()) {
      disagree.push(`${route}: table ${row.join("|")}, guard ${guard.join("|")}`);
    }
  }

  // Every row names a page that exists, so the table cannot keep a stale door.
  const routes = new Set(files.map(routeOf));
  for (const route of Object.keys(ADMIN_PAGES)) {
    if (!routes.has(route)) disagree.push(`${route}: row with no page`);
  }

  // CONTROL: the walk found the console, so "none disagree" is not "none read".
  assert.ok(files.length >= 30, `only ${files.length} pages found`);
  assert.deepEqual(disagree, []);
});

test("the nav is filtered through the table, not through booleans of its own", async () => {
  const layout = read("app/(admin)/layout.tsx");
  assert.match(layout, /mayOpen\(actor\.role/);
  assert.doesNotMatch(layout, /isOwner|isManager/, "the nav keeps a second list");

  const { mayOpen } = await import("../lib/admin/access");
  const hrefs = [...layout.matchAll(/href: "(\/admin[^"]*)"/g)].map((m) => m[1]!);
  assert.ok(hrefs.length >= 20, `only ${hrefs.length} nav entries found`);

  // The six links the inventory found bouncing the roles they were shown to.
  for (const href of ["/admin", "/admin/radar"]) assert.equal(mayOpen("staff", href), false);
  for (const href of ["/admin/ratings", "/admin/audit", "/admin/usage", "/admin/errors"]) {
    assert.equal(mayOpen("manager", href), false);
  }
  assert.equal(mayOpen("staff", "/admin/payouts"), true);
  assert.equal(mayOpen("staff", "/admin/patients/5f0c"), true);
  assert.equal(mayOpen("staff", "/admin/sponsors"), false);
  // Fails closed: a path with no row, or no role, is nobody's.
  assert.equal(mayOpen("super_admin", "/admin/nowhere"), false);
  assert.equal(mayOpen(null, "/admin/payouts"), false);

  /*
   * 🔴 A17: Total View had a row and a guard and no link, so it was reached by
   * typing the address. It is in the nav now, and the table still keeps it
   * from everybody but the owners its elevation gate admits.
   */
  assert.ok(hrefs.includes("/admin/tv"), "Total View has a door in the nav");
  assert.equal(mayOpen("super_admin", "/admin/tv"), true);
  for (const role of ["staff", "manager"] as const) {
    assert.equal(mayOpen(role, "/admin/tv"), false, `CONTROL: ${role} is not shown Total View`);
  }
});

test("a staff sign-in lands on a page staff can open", async () => {
  const { landingFor, mayOpen } = await import("../lib/admin/access");
  for (const role of ["staff", "manager", "super_admin"] as const) {
    assert.equal(mayOpen(role, landingFor(role)), true, `${role} lands on a door that bounces them`);
  }

  const signIn = read("lib/auth/actions.ts");
  assert.match(signIn, /landingFor\(/, "sign-in still sends every back office account to /admin");
  assert.match(read("app/(admin)/layout.tsx"), /landingFor\(actor\.role\)/, "the logo still links to /admin");
});

test("a refusal is audited, and a back office refusal stays in the console", async () => {
  const guard = read("lib/auth/guard.ts");
  const requireRole = guard.slice(guard.indexOf("export async function requireRole("));
  const body = requireRole.slice(0, requireRole.indexOf("\n}\n"));
  assert.match(body, /refuse\(/, "requireRole redirects without writing anything down");

  const refuse = guard.slice(guard.indexOf("async function refuse("));
  assert.match(refuse.slice(0, refuse.indexOf("\n}\n")), /await audit\(/);
  assert.match(refuse.slice(0, refuse.indexOf("\n}\n")), /refusalDestination\(/);

  const { refusalDestination } = await import("../lib/admin/access");
  assert.equal(refusalDestination("staff", "/admin/vault"), "/admin/not-yours?from=%2Fadmin%2Fvault");
  assert.equal(refusalDestination("therapist", "/admin/vault"), "/dashboard");
});

test("D9: staff work payouts and verifications", () => {
  const payouts = read("app/(admin)/admin/payouts/actions.ts");
  const exported = [...payouts.matchAll(/^export async function (\w+)[\s\S]*?\n}\n/gm)];
  assert.ok(exported.length >= 5);
  for (const match of exported) {
    assert.match(match[0], /await requireStaff\(\)/, `${match[1]} is still the founder's alone`);
  }

  const admin = read("app/(admin)/admin/actions.ts");
  const decide = admin.slice(admin.indexOf("export async function decideTherapistVerification"));
  assert.match(decide.slice(0, 400), /await requireStaff\(\)/);

  // Nobody decides their own verification.
  const verification = read("lib/data/verification.ts");
  const decideLib = verification.slice(verification.indexOf("export async function decideVerification"));
  assert.match(decideLib.slice(0, 3000), /ne\(therapistVerifications\.userId, opts\.adminUserId\)/);
  const recheck = verification.slice(verification.indexOf("async function decideRecheck"));
  assert.match(recheck.slice(0, 1500), /ne\(therapistVerifications\.userId, opts\.adminUserId\)/);
});

test("D9: staff read licence documents, and only through the audited route", async () => {
  const { mayReadIdentity } = await import("../lib/documents/identity-rule");
  assert.equal(mayReadIdentity({ userId: "a", role: "staff" }, "b"), true);
  assert.equal(mayReadIdentity({ userId: "a", role: "manager" }, "b"), true);
  assert.equal(mayReadIdentity({ userId: "a", role: "therapist" }, "b"), false);
  assert.equal(mayReadIdentity({ userId: "b", role: "therapist" }, "b"), true);
  assert.equal(mayReadIdentity(null, "b"), false);

  // The local-disk fallback writes no audit row, so it stays the owner's.
  const { localUploadAllowed } = await import("../lib/documents/identity-access");
  assert.equal(localUploadAllowed("licence/b/x.jpg", { userId: "a", role: "staff" } as never), false);
});

test("D9 / 0161: four eyes, the same rule for payouts and refunds, behind a switch", async () => {
  const { fourEyesProblem } = await import("../lib/billing/four-eyes");
  const base = {
    actorUserId: "me",
    payeeUserId: "clinician",
    editorUserId: "clinician",
    amountCents: 50_000,
    thresholdCents: 20_000,
    ownerUserId: "colleague",
    movesMoney: true,
    twoPeople: true,
  };

  assert.equal(fourEyesProblem(base), null);
  assert.equal(fourEyesProblem({ ...base, payeeUserId: "me" }), "payee");
  assert.equal(fourEyesProblem({ ...base, editorUserId: "me" }), "editor");
  assert.equal(fourEyesProblem({ ...base, ownerUserId: "me" }), "second_person");
  assert.equal(fourEyesProblem({ ...base, ownerUserId: null }), "second_person");
  // Below the threshold one person is enough; an act that moves no money needs no second.
  assert.equal(fourEyesProblem({ ...base, ownerUserId: null, amountCents: 20_000 }), null);
  assert.equal(fourEyesProblem({ ...base, ownerUserId: null, movesMoney: false }), null);

  // 🔴 0161 / ruling 13: with the switch off only the payee rule stands, and it always does.
  const one = { ...base, twoPeople: false };
  assert.equal(fourEyesProblem({ ...one, editorUserId: "me" }), null);
  assert.equal(fourEyesProblem({ ...one, ownerUserId: null }), null);
  assert.equal(fourEyesProblem({ ...one, payeeUserId: "me" }), "payee");

  // Every act on a payout asks, not only approval; the refund queue asks the same function.
  const payouts = read("lib/billing/payouts.ts");
  for (const fn of ["approvePayout", "markPayoutSent", "claimPayout", "rejectPayout", "confirmPayout"]) {
    const body = payouts.slice(payouts.indexOf(`export async function ${fn}(`));
    assert.match(body.slice(0, body.indexOf("\n}\n")), /fourEyes/, `${fn} does not ask`);
  }
  const refunds = read("lib/billing/refunds.ts");
  for (const fn of ["markRefundSent"]) {
    const body = refunds.slice(refunds.indexOf(`export async function ${fn}(`));
    assert.match(body.slice(0, body.indexOf("\n}\n")), /fourEyesProblem\(/, `${fn} keeps its own rule`);
  }
});

/*
 * 🔴 A18: a throw on a console page used to reach `app/global-error.tsx`,
 * which replaces the root layout and takes the nav with it, and a slow page
 * showed nothing at all until every query came back.
 */
test("🔴 A18 the console has its own error and loading boundaries, inside its layout", () => {
  const error = readFileSync("app/(admin)/error.tsx", "utf8");
  assert.match(error, /^"use client";/, "an error boundary is a client component or Next refuses it");
  assert.match(error, /onClick=\{reset\}/, "it offers the retry");
  assert.match(read("app/(admin)/loading.tsx"), /export default/);
  // CONTROL: the global boundary is still the last resort for the layout itself.
  assert.match(read("app/global-error.tsx"), /onClick=\{reset\}/);
});
