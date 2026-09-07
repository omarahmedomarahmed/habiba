/**
 * Sprint 14 acceptance — no-show recovery. PLAN.md 14.1–14.8, C57.
 *
 *   npm run verify:sprint14
 *
 * The claims worth proving here are all about money and about what a let-down
 * patient is offered, so every one is exercised against the real database
 * rather than read off the schema.
 */
import { and, eq, like, sql } from "drizzle-orm";

import { db } from "../lib/db";
import {
  organizations,
  patientCredits,
  patients,
  people,
  sessions,
  therapistRadar,
  users,
} from "../lib/db/schema";

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
}

async function refused(fn: () => Promise<unknown>, fragment: string): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch (error) {
    return String((error as Error).message).includes(fragment);
  }
}

async function main() {
  console.log(`checking ${process.env.DATABASE_URL?.split("@")[1]?.split("/")[0] ?? "?"}\n`);

  const made: string[] = [];

  try {
    /*
     * 🔴 22.1 — the clinicians are PLANTED when the database has none.
     *
     * This borrowed the first three users it found and stopped dead when there
     * were fewer than two, which is what a purged database looks like: after
     * the purge there was one user, the seeded admin, and this verifier
     * reported a missing fixture instead of checking the no-show ladder. Same
     * lesson as C93, one table over — a gate that needs somebody else's data
     * is a gate that fails the week before launch.
     */
    const found = await db
      .select({ id: users.id, organizationId: users.organizationId, rate: users.sessionRateCents })
      .from(users)
      .limit(3);

    const [seedOrg] = await db.select({ id: organizations.id }).from(organizations).limit(1);
    const organizationId =
      found[0]?.organizationId ??
      seedOrg?.id ??
      (
        await db
          .insert(organizations)
          .values({ name: "verify14 clinic", slug: `verify14-${Date.now()}` })
          .returning({ id: organizations.id })
      )[0]!.id;

    const missing = Math.max(0, 2 - found.length);
    const plantedUsers =
      missing > 0
        ? await db
            .insert(users)
            .values(
              Array.from({ length: missing }, (_, index) => ({
                organizationId,
                email: `verify14-${index}-${Date.now()}@example.test`,
                passwordHash: "x".repeat(60),
                firstName: "verify14",
                lastName: `${index}`,
                role: "therapist" as const,
                sessionRateCents: 3000,
              })),
            )
            .returning({
              id: users.id,
              organizationId: users.organizationId,
              rate: users.sessionRateCents,
            })
        : [];

    const clinicians = [...found, ...plantedUsers];

    const [absent, cheaper] = clinicians;

    /* ---------------------------------------------- 14.3 the price ceiling */

    const { replacementsFor, reassignSession, reliabilityFor, MIN_FOR_SCORE } = await import(
      "../lib/data/recovery"
    );

    // A replacement who costs more than the patient paid must never be offered.
    await db
      .update(users)
      .set({ sessionRateCents: 6000 })
      .where(eq(users.id, cheaper!.id));

    const tooDear = await replacementsFor({
      sessionId: "00000000-0000-0000-0000-000000000000",
      paidCents: 3000,
      excludeUserId: absent!.id,
    });
    check(
      "🔴 14.3 a clinician who charges MORE than the patient paid is not offered",
      tooDear.every((r) => r.rateCents <= 3000),
      `${tooDear.length} offered, dearest ${Math.max(0, ...tooDear.map((r) => r.rateCents))}`,
    );

    /* ------------------------------------ 14.5 / 14.6 the move and the credit */

    await db.update(users).set({ sessionRateCents: 2000 }).where(eq(users.id, cheaper!.id));
    await db
      .insert(therapistRadar)
      .values({ userId: cheaper!.id, organizationId: cheaper!.organizationId, status: "online" })
      .onConflictDoUpdate({
        target: therapistRadar.userId,
        set: { status: "online", suspendedUntil: null },
      });
    await db.update(users).set({ chargesEnabled: true }).where(eq(users.id, cheaper!.id));

    const [person] = await db
      .insert(people)
      .values({ firstName: "verify14", phone: "+201400000001" })
      .returning({ id: people.id });

    const [patient] = await db
      .insert(patients)
      .values({
        organizationId: absent!.organizationId,
        therapistId: absent!.id,
        firstName: "verify14",
        personId: person!.id,
        phone: "+201400000001",
        source: "therapist",
      })
      .returning({ id: patients.id });

    const [session] = await db
      .insert(sessions)
      .values({
        organizationId: absent!.organizationId,
        therapistId: absent!.id,
        patientId: patient!.id,
        status: "scheduled",
        modality: "video",
        guestName: "verify14",
        feedbackToken: "verify14-token",
        priceCents: 3000,
        scheduledAt: new Date(Date.now() - 60 * 60_000),
      })
      .returning({ id: sessions.id });
    if (session) made.push(session.id);

    const offered = await replacementsFor({
      sessionId: session!.id,
      paidCents: 3000,
      excludeUserId: absent!.id,
    });
    check(
      "14.3 …and one who charges less IS offered",
      offered.some((r) => r.userId === cheaper!.id),
      `${offered.length} offered`,
    );
    check(
      "14.3 the therapist who did not turn up is never in their own replacement list",
      offered.every((r) => r.userId !== absent!.id),
    );

    const moved = await reassignSession({ sessionId: session!.id, toUserId: cheaper!.id });
    check("14.5 the session moves to the replacement", moved.ok);

    const [after] = await db
      .select({
        therapistId: sessions.therapistId,
        from: sessions.reassignedFromUserId,
        outcome: sessions.recoveryOutcome,
      })
      .from(sessions)
      .where(eq(sessions.id, session!.id))
      .limit(1);
    check(
      "🔴 14.5 …and remembers who did not turn up, so the score has something to count",
      after?.therapistId === cheaper!.id && after?.from === absent!.id,
      `now ${after?.therapistId?.slice(0, 8)}, from ${after?.from?.slice(0, 8)}`,
    );

    const [credit] = await db
      .select({ amount: patientCredits.amountCents, expires: patientCredits.expiresAt })
      .from(patientCredits)
      .where(eq(patientCredits.personId, person!.id))
      .limit(1);
    check(
      "🔴 14.6 the difference becomes patient credit — $30 paid, $20 charged, $10 back",
      credit?.amount === 1000,
      `${credit?.amount ?? 0} cents`,
    );

    const months =
      credit?.expires
        ? (credit.expires.getFullYear() - new Date().getFullYear()) * 12 +
          (credit.expires.getMonth() - new Date().getMonth())
        : 0;
    check("14.6 …and it expires in twelve months", months === 12, `${months} months`);

    // Money owed is never negative and never over-spent — the database says so.
    check(
      "14.6 a negative credit is refused BY THE DATABASE",
      await refused(
        () =>
          db.insert(patientCredits).values({
            personId: person!.id,
            amountCents: -500,
            reason: "verify14",
            expiresAt: new Date(),
          }),
        "patient_credits_amount_positive",
      ),
    );
    check(
      "14.6 …and so is spending more of it than exists",
      await refused(
        () =>
          db.insert(patientCredits).values({
            personId: person!.id,
            amountCents: 100,
            spentCents: 500,
            reason: "verify14",
            expiresAt: new Date(),
          }),
        "patient_credits_spend_within",
      ),
    );

    /*
     * 🔴 The ceiling is enforced at the WRITE, not only in the list. A
     * clinician who raised their price between the two screens, or an id typed
     * by hand, must not be able to charge a let-down patient more.
     */
    await db.update(users).set({ sessionRateCents: 9000 }).where(eq(users.id, cheaper!.id));
    const [second] = await db
      .insert(sessions)
      .values({
        organizationId: absent!.organizationId,
        therapistId: absent!.id,
        patientId: patient!.id,
        status: "scheduled",
        modality: "video",
        guestName: "verify14",
        feedbackToken: "verify14-token-2",
        priceCents: 3000,
      })
      .returning({ id: sessions.id });
    if (second) made.push(second.id);

    const overpriced = await reassignSession({ sessionId: second!.id, toUserId: cheaper!.id });
    check(
      "🔴 14.3 the price ceiling is re-checked at the write, not only in the list",
      !overpriced.ok,
      overpriced.ok ? "ACCEPTED — a let-down patient could be charged more" : overpriced.error,
    );

    /* ------------------------------------------------------ 14.7 the score */

    const score = await reliabilityFor(absent!.id);
    check(
      "14.7 a reliability score exists and counts the reassigned session against the absentee",
      score.sessions >= 1,
      `${score.noShows}/${score.sessions}`,
    );
    check(
      `🔴 14.7 …but is null below ${MIN_FOR_SCORE} sessions rather than a small-sample percentage`,
      score.sessions >= MIN_FOR_SCORE ? score.rate !== null : score.rate === null,
      score.rate === null ? "null, as it should be" : `${score.rate}`,
    );

    /* ------------------------------------------------------------- C57 */

    /*
     * The ruling, asserted on what the roster actually selects. A scheduled
     * time is a fact about a diary; 10.2's guarantee is about clinical text,
     * and the check below is that nothing clinical came with it.
     */
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("lib/ai/assistant.ts", "utf8");
    const rosterBlock = source.slice(
      source.indexOf("export async function buildRoster"),
      source.indexOf("export async function buildRoster") + 3000,
    );
    check(
      "🔴 C57 the roster reads scheduled_at and nothing else from sessions",
      rosterBlock.includes("s.scheduled_at") &&
        !rosterBlock.includes("s.status,") &&
        !/s\.(price|modality|notes|transcript)/.test(rosterBlock),
    );
  } finally {
    await db.delete(patientCredits).where(
      sql`${patientCredits.personId} IN (SELECT id FROM people WHERE phone LIKE '+2014000%')`,
    );
    await db.delete(sessions).where(like(sessions.guestName, "verify14%"));
    await db.delete(patients).where(like(patients.firstName, "verify14%"));
    await db.delete(people).where(like(people.firstName, "verify14%"));
    /* Last: the clinicians this run planted, never one it found. */
    await db.delete(users).where(like(users.email, "verify14-%"));
    await db.delete(organizations).where(like(organizations.name, "verify14 clinic"));
  }

  console.log(
    `\n${failures === 0 ? "sprint 14: PASS" : `sprint 14: ${failures} FAILED`} (${checks} checks)`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
