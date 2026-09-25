import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { stripCommentsKeepingLines } from "../scripts/_dashes";

/**
 * W2-A06: no operator ever types a customer's password; team members are
 * invited by link, and the back office can manage its own team.
 *
 * The round trip through the database (mint, redeem once, refuse the second)
 * is `tests/account-links-db.test.ts`, which needs migration 0141.
 */

const read = (file: string) => stripCommentsKeepingLines(readFileSync(file, "utf8"));

test("no console form asks the operator for somebody's password", () => {
  const dir = "components/admin";
  const offenders = readdirSync(dir)
    .filter((f) => f.endsWith(".tsx"))
    .filter((f) => /name="password"/.test(read(join(dir, f))));
  assert.ok(readdirSync(dir).length > 20, "the scan read the console");
  assert.deepEqual(offenders, []);
});

test("creating a portal or back office account takes no password", () => {
  const creators: [string, string][] = [
    ["lib/data/sponsor-admin.ts", "createSponsorUser"],
    ["lib/data/clinic-admin.ts", "createClinicManager"],
    ["lib/data/partner-admin.ts", "createPartnerUser"],
    ["lib/data/admin-team.ts", "createBackOfficeUser"],
  ];
  for (const [file, fn] of creators) {
    const source = read(file);
    const start = source.indexOf(`export async function ${fn}(`);
    assert.ok(start >= 0, `${fn} is gone`);
    const signature = source.slice(start, source.indexOf("{\n", source.indexOf("Promise<", start)));
    assert.doesNotMatch(signature, /password/, `${fn} still takes a password`);
  }

  // Each operator action invites by email instead.
  for (const [file, audience] of [
    ["app/(admin)/admin/sponsors/actions.ts", "sponsor"],
    ["app/(admin)/admin/clinics/actions.ts", "clinic"],
    ["app/(admin)/admin/partners/actions.ts", "partner"],
    ["app/(admin)/admin/team/actions.ts", "staff"],
  ] as const) {
    assert.match(read(file), new RegExp(`emailAccountLink\\(\\{\\s*audience: "${audience}"`), file);
  }
});

test("a link is stored hashed, spent once, and lands on the right door", async () => {
  const source = read("lib/auth/account-links.ts");
  assert.match(source, /tokenHash: hashOf\(token\)/);
  assert.doesNotMatch(source, /tokenHash: token\b/);
  const redeem = source.slice(source.indexOf("export async function redeemAccountLink("));
  // The spend is guarded, so two submissions of one link set the password once.
  assert.match(redeem.slice(0, 1500), /\.update\(accountLinks\)[\s\S]*isNull\(accountLinks\.usedAt\)/);

  const { SIGN_IN_FOR } = await import("../lib/auth/account-links");
  const { ACCOUNT_AUDIENCES } = await import("../lib/db/schema");
  for (const audience of ACCOUNT_AUDIENCES) assert.ok(SIGN_IN_FOR[audience]?.startsWith("/"), audience);
  assert.equal(SIGN_IN_FOR.staff, "/staff/sign-in");
});

test("the back office manages its own team, and the owner stays out of reach", async () => {
  const { mayOpen } = await import("../lib/admin/access");
  assert.equal(mayOpen("super_admin", "/admin/team"), true);
  assert.equal(mayOpen("manager", "/admin/team"), false);

  const actions = read("app/(admin)/admin/team/actions.ts");
  const exported = [...actions.matchAll(/^export async function (\w+)[\s\S]*?\n}\n/gm)];
  assert.ok(exported.length >= 4, "invite, role, deactivate and a password link");
  for (const [body, name] of exported) {
    assert.match(body, /await requireRole\("super_admin"\)/, `${name} is not the owner's`);
    assert.match(body, /await audit\(/, `${name} is not on the record`);
  }

  const team = read("lib/data/admin-team.ts");
  // Only staff and managers change, never the owner, never yourself.
  assert.match(team, /inArray\(users\.role, \["staff", "manager"\]\)/);
  assert.match(team, /ne\(users\.id, actorUserId\)/);
  // Deactivating signs them out at once rather than when a cookie expires.
  assert.match(team.slice(team.indexOf("setBackOfficeActive")), /revokeAllSessionsForUser/);
});

test("🔴 B24: an invitation names the organisation, the role and the portal, in both languages", async () => {
  const { en, ar } = await import("../lib/i18n/messages");
  for (const reader of ["manager", "company", "partner"] as const) {
    const key = `mail.account.invite.${reader}` as const;
    assert.match(en[key], /\{org\}/, key);
    assert.match(en[key], /\{role\}/, key);
    assert.match(ar[key], /\{org\}/, key);
    assert.match(ar[key], /\{role\}/, key);
  }
  assert.match(en["mail.account.invite.staff"], /\{role\}/);
  assert.match(en["mail.account.inviteNext"], /\{signIn\}/);

  /* Read from the row the link was minted for, never from the form. */
  const links = read("lib/auth/account-links.ts");
  const send = links.slice(links.indexOf("export async function emailAccountLink("));
  assert.match(send, /accountFor\(input\.audience, input\.accountId\)/);
  assert.match(send, /organisation: account\.organisation,\s*role: account\.role/);
  /* CONTROL the old body, which named nobody, is gone from the dictionary. */
  assert.equal((en as Record<string, string>)["aaccess.linkBody"], undefined);

  /* The partner portal's own invitation goes through the same builder. */
  assert.match(read("lib/partner/team.ts"), /sendAccountLink\(\{[\s\S]*reader: "partner"[\s\S]*role,/);
});
