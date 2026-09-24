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

import {
  organizations,
  patientCredits,
  patients,
  people,
  sessions,
  therapistRadar,
  users,
} from "../lib/db/schema";
import { writesTo, readSource } from "./_verify";
import { dbFor } from "../lib/db";
import { DEFAULT_REGION } from "../lib/db/region";

/*
 * 🔴 30.1 — an operator tool writes to the region its DATABASE_URL names.
 *
 * `dbFor(DEFAULT_REGION)` rather than a bare handle, because after this
 * sprint there is no bare handle: a script that plants fixtures is planting
 * them in a jurisdiction, and saying which one is the point. When Cairo is
 * live a script that needs to touch it passes "eg" and nothing else changes.
 */
const db = dbFor(DEFAULT_REGION);

let failures = 0;
let checks = 0;

function check(label: string, ok: boolean, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`  ${ok ? "ok " : "FAIL"}  ${label}${detail ? `, ${detail}` : ""}`);
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
  /*
   * 🔴 C147 — this script WRITES, so it says where and refuses production.
   */
  writesTo();

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
      tooDear.every((r) => r.sessionRateCents <= 3000),
      `${tooDear.length} offered, dearest ${Math.max(0, ...tooDear.map((r) => r.sessionRateCents))}`,
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
        // In the waiting room: recovery is for somebody who is actually there.
        patientJoinedAt: new Date(Date.now() - 59 * 60_000),
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
      "🔴 14.6 the difference becomes patient credit, $30 paid, $20 charged, $10 back",
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
        /*
         * Overdue and waiting, so the ONLY reason left to refuse is the price.
         * Without these the write is refused as "not overdue" and this check
         * passes while testing nothing.
         */
        scheduledAt: new Date(Date.now() - 60 * 60_000),
        patientJoinedAt: new Date(Date.now() - 59 * 60_000),
      })
      .returning({ id: sessions.id });
    if (second) made.push(second.id);

    const overpriced = await reassignSession({ sessionId: second!.id, toUserId: cheaper!.id });
    check(
      "🔴 14.3 the price ceiling is re-checked at the write, not only in the list",
      !overpriced.ok && /charges more/.test(overpriced.error),
      overpriced.ok ? "ACCEPTED, a let-down patient could be charged more" : overpriced.error,
    );

    /*
     * 🔴 THE SESSION ID IS A CAPABILITY ONLY ONCE THE SESSION IS OVERDUE.
     *
     * Before this, `started_at IS NULL` was the only condition, which every
     * session booked for next week meets: anybody holding an id could refund
     * it, move it (and its chart) to another clinician, or stamp a no-show on
     * the clinician's public score, days early. The cheap replacement is back
     * at $20 so only the clock can refuse.
     */
    await db.update(users).set({ sessionRateCents: 2000 }).where(eq(users.id, cheaper!.id));
    const { refundNoShow, recoveryDue } = await import("../lib/data/recovery");
    const early = async (label: string, values: { scheduledAt: Date | null; patientJoinedAt: Date | null }) => {
      const [row] = await db
        .insert(sessions)
        .values({
          organizationId: absent!.organizationId,
          therapistId: absent!.id,
          patientId: patient!.id,
          status: "scheduled",
          modality: "video",
          guestName: `verify14 ${label}`,
          feedbackToken: `verify14-token-${label}`,
          priceCents: 3000,
          ...values,
        })
        .returning({ id: sessions.id });
      if (row) made.push(row.id);
      return row!.id;
    };
    const tomorrow = await early("tomorrow", {
      scheduledAt: new Date(Date.now() + 24 * 60 * 60_000),
      patientJoinedAt: new Date(),
    });
    const nobodyCame = await early("nobody", {
      scheduledAt: new Date(Date.now() - 60 * 60_000),
      patientJoinedAt: null,
    });
    const justStarted = await early("grace", {
      scheduledAt: new Date(Date.now() - 2 * 60_000),
      patientJoinedAt: new Date(Date.now() - 3 * 60_000),
    });
    for (const [label, id] of [
      ["a session booked for tomorrow", tomorrow],
      ["a session nobody is waiting in", nobodyCame],
      ["a session two minutes late, inside the grace period", justStarted],
    ] as const) {
      const moveEarly = await reassignSession({ sessionId: id, toUserId: cheaper!.id });
      const refundEarly = await refundNoShow({ sessionId: id });
      const [still] = await db
        .select({ status: sessions.status, therapistId: sessions.therapistId, outcome: sessions.recoveryOutcome })
        .from(sessions)
        .where(eq(sessions.id, id))
        .limit(1);
      check(
        `🔴 14.2 ${label} cannot be moved or refunded by its id`,
        !moveEarly.ok && !refundEarly.ok && still?.status === "scheduled" &&
          still?.therapistId === absent!.id && still?.outcome === null,
        `move ${moveEarly.ok ? "ACCEPTED" : "refused"}, refund ${refundEarly.ok ? "ACCEPTED" : "refused"}, now ${still?.status}`,
      );
    }
    /* Control: the rule says yes to exactly the case the feature exists for. */
    check(
      "14.2 control: overdue by five minutes with the patient waiting IS due",
      recoveryDue({
        scheduledAt: new Date(Date.now() - 5 * 60_000 - 1000),
        startedAt: null,
        patientJoinedAt: new Date(Date.now() - 6 * 60_000),
        status: "scheduled",
      }),
    );

    /*
     * 🔴 W1-12: A REFUND THAT DID NOT HAPPEN IS NOT CALLED ONE.
     *
     * A bank-transfer payment has no Stripe charge (`capture: "platform"`, no
     * intent), so `refundSessionPayment` refuses it. `refundNoShow` used to mark
     * the session `refunded` first and only log the refusal, and the patient was
     * then told they had their money back. The money is still here; so says the row.
     */
    const byTransfer = await early("transfer", {
      scheduledAt: new Date(Date.now() - 60 * 60_000),
      patientJoinedAt: new Date(Date.now() - 59 * 60_000),
    });
    await db.execute(sql`
      INSERT INTO session_payments (organization_id, therapist_id, session_id, gross_cents,
                                    platform_fee_cents, therapist_net_cents, capture, status, paid_at)
      VALUES (${absent!.organizationId}, ${absent!.id}, ${byTransfer}, 3000, 450, 2550,
              'platform', 'paid', now())`);
    const owed = await refundNoShow({ sessionId: byTransfer });
    const [owedSession] = await db
      .select({ outcome: sessions.recoveryOutcome, status: sessions.status })
      .from(sessions)
      .where(eq(sessions.id, byTransfer))
      .limit(1);
    const owedPayment = await db.execute<{ status: string }>(sql`
      SELECT status FROM session_payments WHERE session_id = ${byTransfer}`);
    check(
      "🔴 W1-12 a transfer payment the no-show job could not refund is not marked refunded",
      owed.ok && owed.outcome === "refund_owed" && owedSession?.outcome !== "refunded" &&
        owedPayment.rows[0]?.status === "paid",
      `result ${owed.ok ? owed.outcome : owed.error}, session ${owedSession?.status}/${owedSession?.outcome}, payment ${owedPayment.rows[0]?.status}`,
    );

    /*
     * 🔴 W1-13: A CLINICIAN CANCELS A PAID APPOINTMENT.
     *
     * Paid by transfer, so the refund cannot go back by itself: the answer is a
     * refund OWED, the payment still `paid`, and never a row calling it refunded.
     */
    const { afterClinicianCancel } = await import("../lib/data/clinician-cancel");
    const booked = await early("clinician-cancel", {
      scheduledAt: new Date(Date.now() + 24 * 60 * 60_000),
      patientJoinedAt: null,
    });
    await db.execute(sql`
      INSERT INTO session_payments (organization_id, therapist_id, session_id, gross_cents,
                                    platform_fee_cents, therapist_net_cents, capture, status, paid_at)
      VALUES (${absent!.organizationId}, ${absent!.id}, ${booked}, 3000, 450, 2550,
              'platform', 'paid', now())`);
    await db.update(sessions).set({ status: "cancelled" }).where(eq(sessions.id, booked));
    const cancelled = await afterClinicianCancel({
      actorUserId: absent!.id,
      sessionId: booked,
      reason: "I am unwell today",
    });
    const cancelledPayment = await db.execute<{ status: string }>(sql`
      SELECT status FROM session_payments WHERE session_id = ${booked}`);
    check(
      "🔴 W1-13 a paid appointment the clinician cancels is refunded or owed, never silently kept",
      cancelled.outcome === "refund_owed" && cancelledPayment.rows[0]?.status === "paid",
      `outcome ${cancelled.outcome}, payment ${cancelledPayment.rows[0]?.status}`,
    );

    /*
     * 🔴 W1-07: THE ACTIONS ASK FOR PROOF, NOT AN ID.
     *
     * `takeRefund(sessionId)` refunded any overdue session for whoever held its
     * id. The proof now is the patient's own join link, or a signed-in patient
     * whose person owns the session. Planted with no contact details, so the
     * control's apology has nobody to reach.
     */
    const { takeRefund, takeReplacement } = await import(
      "../app/(patient)/sessions/[id]/recovery-actions"
    );
    const plantOverdue = async (joinToken: string) => {
      const [row] = await db
        .insert(sessions)
        .values({
          organizationId: absent!.organizationId,
          therapistId: absent!.id,
          status: "scheduled",
          modality: "video",
          guestName: "verify14 w107",
          joinToken,
          feedbackToken: `${joinToken}-rate`,
          priceCents: 0,
          scheduledAt: new Date(Date.now() - 60 * 60_000),
          patientJoinedAt: new Date(Date.now() - 59 * 60_000),
        })
        .returning({ id: sessions.id });
      if (row) made.push(row.id);
      return row!;
    };
    const overdue = await plantOverdue(`verify14-join-a-${Date.now()}`);
    const joinToken = `verify14-join-b-${Date.now()}`;
    const withLink = await plantOverdue(joinToken);
    const byIdRefund = await (takeRefund as (proof: unknown) => Promise<unknown>)(overdue!.id).catch(
      (error: Error) => ({ error: error.message }),
    );
    const byIdMove = await (
      takeReplacement as (proof: unknown, userId: string) => Promise<unknown>
    )(overdue!.id, cheaper!.id).catch((error: Error) => ({ error: error.message }));
    const [untouched] = await db
      .select({ status: sessions.status, therapistId: sessions.therapistId })
      .from(sessions)
      .where(eq(sessions.id, overdue!.id))
      .limit(1);
    check(
      "🔴 W1-07 an overdue session cannot be refunded or moved by its bare id",
      untouched?.status === "scheduled" && untouched?.therapistId === absent!.id,
      `refund ${JSON.stringify(byIdRefund)}, move ${JSON.stringify(byIdMove)}, now ${untouched?.status}`,
    );
    const byToken = await takeRefund({ token: joinToken }).catch((error: Error) => ({
      error: error.message,
    }));
    const [refundedRow] = await db
      .select({ outcome: sessions.recoveryOutcome })
      .from(sessions)
      .where(eq(sessions.id, withLink.id))
      .limit(1);
    check(
      "W1-07 control: the same session IS recovered with the patient's join link",
      /*
       * Unpaid, so W1-12's honest outcome is "cancelled": nothing went back
       * because nothing was paid. Either recovered state proves the link is
       * accepted; a refused proof leaves the outcome empty.
       */
      refundedRow?.outcome === "refunded" || refundedRow?.outcome === "cancelled",
      `outcome ${refundedRow?.outcome}, ${JSON.stringify(byToken)}`,
    );

    /*
     * 🔴 W1-08: A CLAIM IS NOT A PROOF.
     *
     * "They never joined" refunded the patient and took the clinician off the
     * radar on the report alone. Here the room's own record says the clinician
     * DID start the session, so the claim must wait in the admin queue and the
     * clinician must stay on the board. Planted clinician, never a found one.
     */
    const { reportSession } = await import("../app/feedback/[token]/actions");
    const [claimed] = await db
      .insert(users)
      .values({
        organizationId,
        email: `verify14-w108-${Date.now()}@example.com`,
        passwordHash: "x".repeat(60),
        firstName: "verify14",
        lastName: "w108",
        role: "therapist" as const,
      })
      .returning({ id: users.id });
    await db
      .insert(therapistRadar)
      .values({ userId: claimed!.id, organizationId, status: "online" });
    const claimToken = `verify14-w108-${Date.now()}`;
    const [attended] = await db
      .insert(sessions)
      .values({
        organizationId,
        therapistId: claimed!.id,
        status: "completed",
        modality: "video",
        guestName: "verify14 w108",
        feedbackToken: claimToken,
        priceCents: 3000,
        scheduledAt: new Date(Date.now() - 90 * 60_000),
        startedAt: new Date(Date.now() - 89 * 60_000),
        endedAt: new Date(Date.now() - 40 * 60_000),
      })
      .returning({ id: sessions.id });
    if (attended) made.push(attended.id);
    const claim = await reportSession({ token: claimToken, kind: "no_show", detail: "", email: "" });
    const { releaseHold, callerKey } = await import("../lib/rate-limit");
    await releaseHold(await callerKey("report"));
    const [radarAfter] = await db
      .select({ suspendedUntil: therapistRadar.suspendedUntil })
      .from(therapistRadar)
      .where(eq(therapistRadar.userId, claimed!.id))
      .limit(1);
    const { sessionReports } = await import("../lib/db/schema");
    const [queued] = await db
      .select({ status: sessionReports.status, kind: sessionReports.kind })
      .from(sessionReports)
      .where(eq(sessionReports.sessionId, attended!.id))
      .limit(1);
    check(
      "🔴 W1-08 a no-show claim against a session the clinician started is queued, not actioned",
      queued?.kind === "no_show" && queued?.status === "open" && !radarAfter?.suspendedUntil,
      `report ${queued?.status ?? "missing"}, radar ${radarAfter?.suspendedUntil ? "SUSPENDED" : "untouched"}, ${JSON.stringify(claim)}`,
    );
    check(
      "W1-08 …and the patient is told a person will decide",
      "noShow" in claim && claim.noShow === "review",
      JSON.stringify(claim),
    );

    /*
     * 🔴 W1-11: THE ROOM'S "SOMETHING IS WRONG" BOX STORED NOTHING.
     *
     * It passed the JOIN token to an action that looks up the FEEDBACK token,
     * ignored the refusal, and told the patient "Sent to 24Therapy". The room
     * now has its own action; this plants a live session, reports from it by
     * its join link, and reads the queue.
     */
    const roomToken = `verify14-room-${Date.now()}`;
    const live = await plantOverdue(roomToken);
    const joinActions = (await import("../app/join/[token]/actions")) as Record<string, unknown>;
    const reportFromRoom = joinActions.reportFromRoom as
      | ((input: { token: string; detail: string }) => Promise<{ ok?: boolean; error?: string }>)
      | undefined;
    const fromRoom = reportFromRoom
      ? await reportFromRoom({ token: roomToken, detail: "verify14 the clinician said something wrong" })
      : { error: "no reportFromRoom action" };
    await releaseHold(await callerKey("report"));
    const [stored] = await db
      .select({ status: sessionReports.status, detail: sessionReports.detail })
      .from(sessionReports)
      .where(eq(sessionReports.sessionId, live.id))
      .limit(1);
    check(
      "🔴 W1-11 a report from inside the room, by its join link, lands in the report queue",
      Boolean(fromRoom.ok) && stored?.status === "open" && Boolean(stored?.detail?.includes("verify14")),
      JSON.stringify(fromRoom),
    );
    const bogus = reportFromRoom
      ? await reportFromRoom({ token: `${roomToken}-nope`, detail: "verify14 a report with a dead link" })
      : { error: "no reportFromRoom action" };
    await releaseHold(await callerKey("report"));
    check("W1-11 …and a dead link comes back as an error, not as sent", Boolean(bogus.error) && !bogus.ok);
    const room = readSource("components/join/patient-room.tsx");
    check(
      "🔴 W1-11 the room calls its own action and reads the result",
      room.includes("reportFromRoom(") && !/reportSession\(/.test(room),
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
    const source = readSource("lib/ai/assistant.ts");
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
