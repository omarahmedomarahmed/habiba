import assert from "node:assert/strict";
import { test } from "node:test";

import { eq, sql } from "drizzle-orm";

/**
 * W2-A06, against the database (needs migration 0141): an invited account has
 * no password until its owner redeems the link, the link works once, and an
 * older link stops working when a new one is sent.
 *
 * Plants its own sponsor and user and removes them (H29).
 */

test("an invitation link sets the password once, and a newer link retires the older", async () => {
  const { controlDb: db } = await import("../lib/db");
  const { accountLinks, sponsors, sponsorUsers } = await import("../lib/db/schema");
  const { mintAccountLink, peekAccountLink, redeemAccountLink } = await import("../lib/auth/account-links");
  const { createSponsorUser } = await import("../lib/data/sponsor-admin");
  const { verifyPassword } = await import("../lib/auth/password");

  const tag = `w2a06-${Date.now()}`;
  const [sponsor] = await db
    .insert(sponsors)
    .values({ name: tag, kind: "company", currency: "EGP" } as never)
    .returning({ id: sponsors.id });
  let userId: string | undefined;

  try {
    const created = await createSponsorUser({
      sponsorId: sponsor!.id,
      email: `${tag}@example.com`,
      name: null,
      role: "admin",
    });
    userId = created.id;
    assert.ok(userId, created.error);

    const [before] = await db.select().from(sponsorUsers).where(eq(sponsorUsers.id, userId!));
    assert.equal(before!.passwordHash, null, "an invited account already has a password");

    const first = (await mintAccountLink({ audience: "sponsor", accountId: userId!, createdByUserId: null })).split("/welcome/")[1]!;
    const second = (await mintAccountLink({ audience: "sponsor", accountId: userId!, createdByUserId: null })).split("/welcome/")[1]!;
    assert.equal(await peekAccountLink(first), null, "the older link still works");
    assert.ok(await peekAccountLink(second));

    const both = await Promise.all([
      redeemAccountLink(second, "a-long-enough-password-1"),
      redeemAccountLink(second, "a-different-password-22"),
    ]);
    assert.equal(both.filter((r) => "ok" in r).length, 1, "one link set the password twice");

    const [after] = await db.select().from(sponsorUsers).where(eq(sponsorUsers.id, userId!));
    const matches = [
      await verifyPassword("a-long-enough-password-1", after!.passwordHash!),
      await verifyPassword("a-different-password-22", after!.passwordHash!),
    ];
    assert.equal(matches.filter(Boolean).length, 1);
  } finally {
    if (userId) await db.delete(accountLinks).where(eq(accountLinks.accountId, userId));
    await db.execute(sql`DELETE FROM sponsor_users WHERE sponsor_id = ${sponsor!.id}`);
    await db.delete(sponsors).where(eq(sponsors.id, sponsor!.id));
  }
});
