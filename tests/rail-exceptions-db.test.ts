import assert from "node:assert/strict";
import { test } from "node:test";

import { eq, sql } from "drizzle-orm";

/**
 * W2-A03 against the database (needs migration 0142). Plants a practice, a
 * clinician and their payments, and removes them (H29).
 */

test("confirmed money that bought nothing is work, a retry runs once, and carts go", async () => {
  const { controlDb: db } = await import("../lib/db");
  const { manualPayments, organizations, users } = await import("../lib/db/schema");
  const manual = await import("../lib/billing/manual");
  const { grantFor } = await import("../lib/billing/manual-grants");
  const rail = await import("../lib/billing/rail-exceptions");

  const tag = `w2a03-${Date.now()}`;
  const [org] = await db.insert(organizations).values({ name: tag, slug: tag }).returning({ id: organizations.id });
  const [user] = await db
    .insert(users)
    .values({
      organizationId: org!.id,
      email: `${tag}@example.com`,
      passwordHash: "x",
      firstName: "Rail",
      lastName: "Example",
      role: "therapist",
    })
    .returning({ id: users.id });
  const payer = { kind: "user" as const, userId: user!.id, organizationId: org!.id };

  try {
    // 1. A bill paid when nothing was due: confirmed, and raised as "bought nothing".
    const opened = await manual.openManualPayment({
      purpose: "subscription",
      refId: org!.id,
      amountCents: 50_000,
      settlesCents: 1_000,
      payer,
    });
    await manual.submitProof({ paymentId: opened.id!, reference: "REF-W2A03", proofUrl: null });
    await manual.confirmPayment({ paymentId: opened.id!, byUserId: user!.id, onConfirmed: grantFor });
    const open = await rail.openExceptions();
    assert.equal(open.find((row) => row.id === opened.id)?.exception, "not_payable");

    assert.equal((await rail.resolveException({ paymentId: opened.id!, byUserId: user!.id, note: "ok" })).error, "arail.errNote");
    const resolved = await rail.resolveException({
      paymentId: opened.id!,
      byUserId: user!.id,
      note: "Sent the 500 EGP back by InstaPay, receipt in the drive.",
    });
    assert.equal(resolved.ok, true);
    assert.ok(!(await rail.openExceptions()).some((row) => row.id === opened.id));

    // 2. A grant that threw is raised, and two Retry presses run it once.
    await db.execute(sql`UPDATE manual_payments SET exception = 'grant_failed', exception_detail = 'boom',
      exception_at = now(), exception_resolved_at = NULL, exception_resolved_by = NULL, exception_resolution = NULL
      WHERE id = ${opened.id}`);
    const both = await Promise.all([rail.retryGrant({ paymentId: opened.id! }), rail.retryGrant({ paymentId: opened.id! })]);
    assert.equal(both.filter((r) => r.ok).length, 1, "the grant ran twice");

    // 3. An open cart can be discarded, and an old one expires.
    const cart = await manual.openManualPayment({
      purpose: "subscription",
      refId: user!.id,
      amountCents: 10_000,
      settlesCents: 200,
      payer,
    });
    assert.equal(await rail.discardCart(cart.id!), true);
    const old = await manual.openManualPayment({
      purpose: "subscription",
      refId: user!.id,
      amountCents: 10_000,
      settlesCents: 200,
      payer,
    });
    await rail.expireOpenCarts(new Date(Date.now() + (rail.CART_EXPIRY_DAYS + 1) * 86_400_000));
    const [still] = await db.select().from(manualPayments).where(eq(manualPayments.id, old.id!));
    assert.equal(still, undefined, "an open cart outlived its expiry");
  } finally {
    await db.execute(sql`DELETE FROM manual_payments WHERE user_id = ${user!.id}`);
    await db.execute(sql`DELETE FROM audit_log WHERE organization_id = ${org!.id}`);
    await db.delete(users).where(eq(users.id, user!.id));
    await db.delete(organizations).where(eq(organizations.id, org!.id));
  }
});
