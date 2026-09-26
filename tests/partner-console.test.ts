import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { eq, inArray } from "drizzle-orm";

import { writesTo } from "../scripts/_verify";
import { controlDb } from "../lib/db";
import { organizations, partnerApiKeys, partners, users } from "../lib/db/schema";

/**
 * Board 611 and 612, against the dev database.
 *
 * 611: nothing ever put a practice on a partner's bill, so a live key could
 * never write back, launch or deliver notes. The console now can, and a partner
 * cannot.
 *
 * 612: a key's last-used time never moved, because the update was a lazy
 * drizzle query that nothing awaited.
 */

writesTo();

const tag = `pc${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const made = { partners: [] as string[], orgs: [] as string[], users: [] as string[] };
let helio = "";
let other = "";
let practice = "";
const clinicianEmail = `${tag}.clinician@example.com`;

before(async () => {
  const [a, b] = await controlDb
    .insert(partners)
    .values([
      { name: `${tag} Helio`, slug: `${tag}-helio`, state: "active" },
      { name: `${tag} Other`, slug: `${tag}-other`, state: "active" },
    ])
    .returning({ id: partners.id });
  helio = a!.id;
  other = b!.id;
  made.partners.push(helio, other);

  const [org] = await controlDb
    .insert(organizations)
    .values({ name: `${tag} Practice`, slug: `${tag}-practice` })
    .returning({ id: organizations.id });
  practice = org!.id;
  made.orgs.push(practice);

  const [user] = await controlDb
    .insert(users)
    .values({
      organizationId: practice,
      email: clinicianEmail,
      passwordHash: "x",
      firstName: "Test",
      lastName: "Clinician",
    })
    .returning({ id: users.id });
  made.users.push(user!.id);
});

after(async () => {
  if (made.users.length) await controlDb.delete(users).where(inArray(users.id, made.users));
  if (made.orgs.length) {
    await controlDb.delete(organizations).where(inArray(organizations.id, made.orgs));
  }
  if (made.partners.length) {
    await controlDb.delete(partnerApiKeys).where(inArray(partnerApiKeys.partnerId, made.partners));
    await controlDb.delete(partners).where(inArray(partners.id, made.partners));
  }
});

const billing = async () => {
  const [row] = await controlDb
    .select({ partnerId: organizations.partnerId, mode: organizations.billingMode })
    .from(organizations)
    .where(eq(organizations.id, practice));
  return row!;
};

test("611: staff attach a practice by a clinician's email, as partner-billed", async () => {
  const { attachPracticeToPartner, practicesFor } = await import("../lib/data/partner-admin");
  const result = await attachPracticeToPartner({ partnerId: helio, needle: clinicianEmail.toUpperCase() });
  assert.equal(result.practice?.id, practice);
  assert.deepEqual(await billing(), { partnerId: helio, mode: "partner_billed" });
  assert.deepEqual((await practicesFor(helio)).map((p) => p.id), [practice]);
});

test("611: another partner cannot take a practice that is already on a bill", async () => {
  const { attachPracticeToPartner } = await import("../lib/data/partner-admin");
  const result = await attachPracticeToPartner({ partnerId: other, needle: `${tag}-practice` });
  assert.equal(result.error, "apartner.practiceOtherPartner");
  assert.deepEqual(await billing(), { partnerId: helio, mode: "partner_billed" });
});

test("611: an unknown practice is refused in words", async () => {
  const { attachPracticeToPartner } = await import("../lib/data/partner-admin");
  assert.equal(
    (await attachPracticeToPartner({ partnerId: helio, needle: `${tag}-nobody` })).error,
    "apartner.practiceNotFound",
  );
  assert.equal((await attachPracticeToPartner({ partnerId: helio, needle: "  " })).error, "apartner.practiceNotFound");
});

test("611: detaching puts the practice back on its own bill, and only from its own partner", async () => {
  const { detachPracticeFromPartner, practicesFor } = await import("../lib/data/partner-admin");
  assert.equal(
    (await detachPracticeFromPartner({ partnerId: other, organizationId: practice })).error,
    "apartner.practiceNotAttached",
  );
  assert.deepEqual(await detachPracticeFromPartner({ partnerId: helio, organizationId: practice }), { ok: true });
  assert.deepEqual(await billing(), { partnerId: null, mode: "self" });
  assert.deepEqual(await practicesFor(helio), []);
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

test("611: only the console can attach, behind the staff role, with an audit and a reason", () => {
  const callers = [...walk("app"), ...walk("lib"), ...walk("components")]
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => /attachPracticeToPartner|detachPracticeFromPartner/.test(readFileSync(f, "utf8")));
  assert.deepEqual(callers.sort(), ["app/(admin)/admin/partners/actions.ts", "lib/data/partner-admin.ts"]);

  const actions = readFileSync("app/(admin)/admin/partners/actions.ts", "utf8");
  for (const fn of ["attachPractice", "detachPractice"]) {
    const start = actions.indexOf(`export async function ${fn}(`);
    const body = actions.slice(start, actions.indexOf("\n}\n", start));
    assert.match(body, /requireRole\("super_admin"\)/, `${fn} is staff only`);
    assert.match(body, /reasonRefused\(/, `${fn} needs a reason`);
    assert.match(body, /await audit\(/, `${fn} is audited`);
  }
});

test("612: a used key records when, once a minute at most", async () => {
  const { authenticateKey, lastUsedIsStale } = await import("../lib/partner/keys");
  const raw = `24t_sk_test_${tag}${randomBytes(16).toString("hex")}`;
  const [key] = await controlDb
    .insert(partnerApiKeys)
    .values({
      partnerId: helio,
      label: "test",
      keyHash: createHash("sha256").update(raw).digest("hex"),
      prefix: raw.slice(0, 16),
      scopes: ["session:write"],
      environment: "sandbox",
    })
    .returning({ id: partnerApiKeys.id });

  const lastUsed = async () =>
    (
      await controlDb
        .select({ at: partnerApiKeys.lastUsedAt })
        .from(partnerApiKeys)
        .where(eq(partnerApiKeys.id, key!.id))
    )[0]!.at;

  assert.equal(await lastUsed(), null);
  const first = await authenticateKey(`Bearer ${raw}`, "session:write");
  assert.ok("key" in first, JSON.stringify(first));
  const stamped = await lastUsed();
  assert.ok(stamped, "the first call stamps last-used");

  await authenticateKey(`Bearer ${raw}`, "session:write");
  assert.equal((await lastUsed())?.getTime(), stamped.getTime(), "a second call inside the minute writes nothing");

  const now = new Date();
  assert.equal(lastUsedIsStale(null, now), true);
  assert.equal(lastUsedIsStale(new Date(now.getTime() - 30_000), now), false);
  assert.equal(lastUsedIsStale(new Date(now.getTime() - 61_000), now), true);
});

test("612: no drizzle query is fired with void, which never runs it", () => {
  const offenders = [...walk("app"), ...walk("lib")]
    .filter((f) => /\.tsx?$/.test(f))
    .filter((f) => /void\s+(controlDb|db|dbFor\([^)]*\)|tx)\s*\.\s*(update|insert|delete|select)/.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders, []);
});

test("620: the partner's webhook form says what events do, never our build status", async () => {
  const list = readFileSync("components/partner/webhook-list.tsx", "utf8");
  assert.doesNotMatch(list, /t\("devs\.needsLink"\)/, "the build-status notice is back on a customer screen");
  assert.match(list, /t\(EVENT_WORDS\[event\]\)/);

  const { en, ar } = await import("../lib/i18n/messages");
  const keys = Object.keys(en).filter((k) => k === "dev.eventsIntro" || k.startsWith("dev.event."));
  assert.equal(keys.length, 6, "an intro and one line per event");
  for (const key of keys) {
    const words: string = en[key as keyof typeof en];
    assert.doesNotMatch(words, /not built|not live|build/i, `${key} talks about our build`);
    assert.ok(ar[key as keyof typeof ar], `${key} has Arabic`);
  }
});
