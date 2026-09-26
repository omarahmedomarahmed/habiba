import assert from "node:assert/strict";
import { test } from "node:test";

import { eq } from "drizzle-orm";

/**
 * Round 2 company and console fixes that need the dev database. Each test
 * plants its own rows and removes them (H29).
 */

test("454: a company nobody has joined sets 10% at once; once somebody joins, a cut waits", async () => {
  const { controlDb: db } = await import("../lib/db");
  const { enrolments, people, sponsorPots, sponsors } = await import("../lib/db/schema");
  const { setCoverage } = await import("../lib/data/sponsors");

  const tag = `b454-${Date.now()}`;
  const [sponsor] = await db
    .insert(sponsors)
    .values({ name: tag, kind: "company", entity: "eg", currency: "egp" })
    .returning({ id: sponsors.id });
  const sponsorId = sponsor!.id;
  await db.insert(sponsorPots).values({ sponsorId, coverageBps: 10_000 });
  let personId: string | null = null;
  try {
    const first = await setCoverage({ sponsorId, coverageBps: 1_000, noticeDays: 30, bySponsorUserId: sponsorId });
    assert.equal(first.error, undefined);
    const [now] = await db.select().from(sponsorPots).where(eq(sponsorPots.sponsorId, sponsorId));
    assert.equal(now!.coverageBps, 1_000, "the agreed 10% is in force straight away");
    assert.equal(now!.pendingCoverageBps, null);

    const [person] = await db.insert(people).values({ firstName: tag }).returning({ id: people.id });
    personId = person!.id;
    await db.insert(enrolments).values({ sponsorId, personId, identifierHash: tag, identifierKind: "listed_email" });

    await setCoverage({ sponsorId, coverageBps: 500, noticeDays: 30, bySponsorUserId: sponsorId });
    const [later] = await db.select().from(sponsorPots).where(eq(sponsorPots.sponsorId, sponsorId));
    assert.equal(later!.coverageBps, 1_000, "with somebody enrolled, a cut does not apply at once");
    assert.equal(later!.pendingCoverageBps, 500);
  } finally {
    await db.delete(enrolments).where(eq(enrolments.sponsorId, sponsorId));
    if (personId) await db.delete(people).where(eq(people.id, personId));
    await db.delete(sponsorPots).where(eq(sponsorPots.sponsorId, sponsorId));
    await db.delete(sponsors).where(eq(sponsors.id, sponsorId));
  }
});
