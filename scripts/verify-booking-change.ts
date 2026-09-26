/**
 * 🔴 TASK 40 / RULING 16: A PATIENT CANCELS OR MOVES A BOOKING; A CLINICIAN MOVES ONE.
 *
 * Proves, against the dev database:
 *   - the window is the setting, and its boundary is exact;
 *   - cancelled early: refunded, by the payer's own rail (a transfer is queued
 *     for an operator; a company's money goes back to its pot), exactly once;
 *   - cancelled late: the money is held, and refunded only when the clinician
 *     agrees, exactly once;
 *   - moved: to another open hour of the same clinician, the old one open
 *     again, nothing charged twice; a patient only inside the window, a
 *     clinician any time, and the patient is told;
 *   - a receipt opens for the paying patient only, and not for a session the
 *     company paid in full.
 *
 *   npm run verify:booking-change
 */
import { readFileSync } from "node:fs";

import { sql } from "drizzle-orm";

import { setRulesForThisCheck } from "./_rules";
import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();
const fixture = `bkc${Date.now().toString(36)}`;
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const HOUR = 3_600_000;

async function main() {
  writesTo();
  setRulesForThisCheck({ refunds: { patientCancelWindowHours: 24 } });
  const { db, pool } = connect();
  const rows = async <T,>(text: ReturnType<typeof sql>): Promise<T[]> => (await db.execute(text)).rows as T[];
  const one = async <T,>(text: ReturnType<typeof sql>): Promise<T> => (await rows<T>(text))[0] as T;

  /* ------------------------------------------------------------ pure -- */
  const { insideFreeWindow, placeFits } = await import("../lib/scheduling/cancel-window");
  const at = new Date("2026-10-01T12:00:00Z");
  check(
    "the window's edge: exactly 24 hours before is free, one second later is not",
    insideFreeWindow(at, new Date(at.getTime() - 24 * HOUR), 24) &&
      !insideFreeWindow(at, new Date(at.getTime() - 24 * HOUR + 1000), 24),
  );
  check("a window of 0 hours: free until the start", insideFreeWindow(at, new Date(at.getTime() - 1000), 0));
  check(
    "🔴 CONTROL the window refuses: an hour before a 24-hour window, and after the start of a 0-hour one",
    !insideFreeWindow(at, new Date(at.getTime() - HOUR), 24) && !insideFreeWindow(at, new Date(at.getTime() + 1000), 0),
  );
  check(
    "an online session moves only to an online or either hour; in person likewise",
    placeFits("video", "online") && placeFits("video", "either") && !placeFits("video", "in_person") &&
      placeFits("in_person", "in_person") && !placeFits("in_person", "online"),
  );

  let sponsorId: string | null = null;
  let orgId: string | null = null;
  try {
    const org = await one<{ id: string }>(sql`
      INSERT INTO organizations (name, region, slug) VALUES ('Booking Change Demo', 'eg', ${fixture}) RETURNING id`);
    orgId = org.id;
    const therapist = await one<{ id: string }>(sql`
      INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, session_rate_cents, timezone)
      VALUES (${org.id}, ${`salma.${fixture}@example.com`}, 'Salma', 'Demo', 'therapist', 'x', 2000, 'UTC') RETURNING id`);
    await db.execute(sql`
      INSERT INTO therapist_verifications (user_id, organization_id, state, country, license_body, license_number,
        specialties, languages, submitted_at)
      VALUES (${therapist.id}, ${org.id}, 'approved', 'EG', 'Fixture board', 'X1', '["anxiety"]'::jsonb, '["en"]'::jsonb, now())`);
    const actor = {
      userId: therapist.id,
      organizationId: org.id,
      role: "therapist" as const,
      email: `salma.${fixture}@example.com`,
      timezone: "UTC",
      firstName: "Salma",
      lastName: "Demo",
    };

    const person = async (first: string) => {
      const p = await one<{ id: string }>(sql`
        INSERT INTO people (first_name, last_name, email, region)
        VALUES (${first}, 'Demo', ${`${first.toLowerCase()}.${fixture}@example.com`}, 'eg') RETURNING id`);
      const patient = await one<{ id: string }>(sql`
        INSERT INTO patients (organization_id, therapist_id, person_id, first_name, last_name, email, source)
        VALUES (${org.id}, ${therapist.id}, ${p.id}, ${first}, 'Demo', ${`${first.toLowerCase()}.${fixture}@example.com`}, 'self')
        RETURNING id`);
      return { personId: p.id, patientId: patient.id };
    };
    const mona = await person("Mona");
    const karim = await person("Karim");

    /* An hour on the clinician's calendar, whole and in the future. */
    const base = Math.ceil(Date.now() / HOUR) * HOUR;
    const slot = async (hoursAhead: number, status = "open") =>
      (
        await one<{ id: string }>(sql`
          INSERT INTO availability_slots (therapist_user_id, organization_id, starts_at, status)
          VALUES (${therapist.id}, ${org.id}, ${new Date(base + hoursAhead * HOUR)}, ${status}) RETURNING id`)
      ).id;

    const { bookSlot } = await import("../lib/data/scheduling");
    const book = async (who: { patientId: string }, hoursAhead: number) => {
      const slotId = await slot(hoursAhead);
      const booked = await bookSlot({ slotId, patientId: who.patientId, bookedBy: therapist.id, patientName: "Demo" });
      if (!booked.ok) throw new Error(booked.error);
      return { slotId, sessionId: booked.sessionId };
    };

    const { grantFor } = await import("../lib/billing/manual-grants");
    const payByTransfer = async (sessionId: string) => {
      const transfer = await one<Record<string, unknown>>(sql`
        INSERT INTO manual_payments (purpose, ref_id, amount_cents, currency, settles_cents, payer_kind, organization_id, state, decided_at)
        VALUES ('session', ${sessionId}, 2000, 'USD', 2000, 'session', ${org.id}, 'confirmed', now()) RETURNING *`);
      await grantFor({
        ...(transfer as object),
        refId: sessionId,
        purpose: "session",
        settlesCents: 2000,
        decidedAt: new Date(),
        id: String(transfer.id),
      } as Parameters<typeof grantFor>[0]);
      return (await one<{ id: string }>(sql`SELECT id FROM session_payments WHERE session_id = ${sessionId}`)).id;
    };
    const session = (id: string) =>
      one<{ status: string; cancelled_by: string | null; late_cancel: string | null; scheduled_at: Date; reschedule_count: number }>(sql`
        SELECT status, cancelled_by, late_cancel, scheduled_at, reschedule_count FROM sessions WHERE id = ${id}`);
    const slotRow = (id: string) =>
      one<{ status: string; session_id: string | null }>(sql`SELECT status, session_id FROM availability_slots WHERE id = ${id}`);
    const refundRows = (paymentId: string) =>
      rows<{ reason: string; status: string; amount_cents: number }>(sql`
        SELECT reason, status, amount_cents FROM refund_requests WHERE session_payment_id = ${paymentId}`);

    const { patientCancel, agreeLateRefund, rescheduleBooking } = await import("../lib/data/booking-change");

    /* ------------------------------------------------ cancelled early -- */
    const early = await book(mona, 48);
    const earlyPay = await payByTransfer(early.sessionId);
    const r1 = await patientCancel({ personId: mona.personId, accountId: null, sessionId: early.sessionId });
    const s1 = await session(early.sessionId);
    const q1 = await refundRows(earlyPay);
    const credit = (sessionId: string) =>
      rows<{ id: string; amount_cents: number }>(sql`
        SELECT id, amount_cents FROM patient_credits WHERE from_session_id = ${sessionId}`);
    const c1 = await credit(early.sessionId);
    const p1 = await one<{ status: string }>(sql`SELECT status FROM session_payments WHERE id = ${earlyPay}`);
    check(
      "🔴 board 430, ruling 18: cancelled 48 hours ahead, paid by transfer: cancelled by the patient, and the full amount in their wallet",
      r1.ok && r1.refund === "wallet" && s1.status === "cancelled" && s1.cancelled_by === "patient" &&
        s1.late_cancel === null && q1.length === 0 && p1.status === "refunded" &&
        c1.length === 1 && c1[0]!.amount_cents === 2000,
      JSON.stringify({ r1, s1, q1, p1, c1 }),
    );
    const { walletCreditedTransfers, refundTransferInstead } = await import("../lib/billing/transfer-wallet");
    const listed = (await walletCreditedTransfers()).find((row) => row.refId === early.sessionId);
    check(
      "🔴 board 430: the transfer is listed where staff press Refund instead, pointing at that credit",
      Boolean(listed) && listed!.creditId === c1[0]?.id,
      JSON.stringify(listed ?? null),
    );
    const instead = listed
      ? await refundTransferInstead({ paymentId: listed.id, byUserId: therapist.id, reason: "The patient asked for it back" })
      : { error: "not listed" };
    const q1b = await rows<{ amount_cents: number }>(sql`
      SELECT amount_cents FROM refund_requests WHERE manual_payment_id = ${listed?.id ?? null}`);
    check(
      "🔴 …and Refund instead queues the whole amount once",
      Boolean(instead.ok) && q1b.length === 1 && q1b[0]!.amount_cents === 2000,
      JSON.stringify({ instead, q1b }),
    );
    check("…and the hour is open again for somebody else", (await slotRow(early.slotId)).status === "open");
    const r1b = await patientCancel({ personId: mona.personId, accountId: null, sessionId: early.sessionId });
    check(
      "🔴 a second press cancels nothing and credits nothing twice",
      !r1b.ok && (await credit(early.sessionId)).length === 1 && (await refundRows(earlyPay)).length === 0,
    );

    /* ------------------------------------------------- cancelled late -- */
    const late = await book(mona, 5);
    const latePay = await payByTransfer(late.sessionId);
    const stranger = await patientCancel({ personId: karim.personId, accountId: null, sessionId: late.sessionId });
    check("🔴 somebody else's booking cannot be cancelled by them", !stranger.ok && (await session(late.sessionId)).status === "scheduled");
    const r2 = await patientCancel({ personId: mona.personId, accountId: null, sessionId: late.sessionId });
    const s2 = await session(late.sessionId);
    const paid2 = await one<{ status: string }>(sql`SELECT status FROM session_payments WHERE id = ${latePay}`);
    check(
      "🔴 cancelled 5 hours ahead: cancelled, the money held with the clinician, nothing refunded or queued",
      r2.ok && r2.refund === "held" && s2.late_cancel === "held" && paid2.status === "paid" && (await refundRows(latePay)).length === 0,
      JSON.stringify({ r2, s2, paid2 }),
    );
    const told = await one<{ n: number }>(sql`SELECT count(*)::int AS n FROM notifications WHERE user_id = ${therapist.id}`);
    check("the clinician is told, in the app", told.n >= 2, JSON.stringify(told));

    const agree = await agreeLateRefund(actor as never, late.sessionId);
    const again = await agreeLateRefund(actor as never, late.sessionId);
    const s2b = await session(late.sessionId);
    check(
      "🔴 the clinician agrees: refunded (to the wallet, as it came by transfer; ruling 18), once, however many presses",
      agree.ok && agree.refund === "wallet" && !again.ok && s2b.late_cancel === "refunded" &&
        (await credit(late.sessionId)).length === 1 && (await refundRows(latePay)).length === 0,
      JSON.stringify({ agree, again, s2b }),
    );
    const lateNotice = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM patient_notifications WHERE person_id = ${mona.personId} AND message_key = 'pnotice.lateRefunded'`);
    check("…and the patient is told, in the app", lateNotice.n === 1);

    /* ------------------------------------------------------------ move -- */
    const moving = await book(mona, 49);
    const movingPay = await payByTransfer(moving.sessionId);
    const target = await slot(72);
    const m1 = await rescheduleBooking({
      sessionId: moving.sessionId,
      toSlotId: target,
      by: { kind: "patient", personId: mona.personId, accountId: null },
    });
    const s3 = await session(moving.sessionId);
    const payments3 = await rows<{ id: string; status: string }>(sql`SELECT id, status FROM session_payments WHERE session_id = ${moving.sessionId}`);
    check(
      "🔴 the patient moves a booking inside the window: new time, old hour open, new hour theirs, nothing charged again",
      m1.ok &&
        new Date(s3.scheduled_at).getTime() === base + 72 * HOUR &&
        s3.reschedule_count === 1 &&
        (await slotRow(moving.slotId)).status === "open" &&
        (await slotRow(target)).session_id === moving.sessionId &&
        payments3.length === 1 && payments3[0]!.id === movingPay && payments3[0]!.status === "paid",
      JSON.stringify({ m1, s3, payments3 }),
    );

    const lateMove = await book(mona, 6);
    const other = await slot(96);
    const m2 = await rescheduleBooking({
      sessionId: lateMove.sessionId,
      toSlotId: other,
      by: { kind: "patient", personId: mona.personId, accountId: null },
    });
    check("🔴 a patient cannot move a booking 6 hours out", !m2.ok && m2.error === "pchange.errClosed", JSON.stringify(m2));

    const m3 = await rescheduleBooking({ sessionId: lateMove.sessionId, toSlotId: other, by: { kind: "therapist", actor: actor as never } });
    const movedNotice = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM patient_notifications WHERE person_id = ${mona.personId} AND kind = 'session_rescheduled'`);
    check("🔴 the clinician can, and the patient is told in the app", m3.ok && movedNotice.n === 1, JSON.stringify({ m3, movedNotice }));

    const taken = await book(karim, 120);
    const m4 = await rescheduleBooking({ sessionId: moving.sessionId, toSlotId: taken.slotId, by: { kind: "therapist", actor: actor as never } });
    check("🔴 an hour somebody else holds cannot be moved into", !m4.ok && m4.error === "pchange.errTaken");

    /* --------------------------------------------- company money, back -- */
    const sponsor = await one<{ id: string }>(sql`
      INSERT INTO sponsors (name, kind, entity, currency, state)
      VALUES (${`Booking Change ${fixture}`}, 'company', 'us', 'USD', 'active') RETURNING id`);
    sponsorId = sponsor.id;
    const { openPot } = await import("../lib/data/sponsor-admin");
    await openPot({
      sponsorId: sponsor.id,
      refundPolicy: "Unused balance is refunded within 30 days of written notice.",
      expiresAt: new Date(Date.now() + 365 * 24 * HOUR),
      overdraftCents: 0,
      welcomeCreditCents: 0,
    });
    await db.execute(sql`UPDATE sponsor_pots SET balance_cents = 100000, coverage_bps = 10000 WHERE sponsor_id = ${sponsor.id}`);
    const nada = await person("Nada");
    await db.execute(sql`
      INSERT INTO enrolments (sponsor_id, person_id, state, is_primary, identifier_hash, identifier_kind, last_verified_at)
      VALUES (${sponsor.id}, ${nada.personId}, 'active', true, ${`nada-${fixture}`}, 'domain_email', now())`);
    const balance = async () =>
      Number((await one<{ b: number }>(sql`SELECT balance_cents AS b FROM sponsor_pots WHERE sponsor_id = ${sponsor.id}`)).b);
    const before = await balance();
    const covered = await book(nada, 50);
    const coveredPay = await one<{ id: string; status: string; funding_source: string } | undefined>(sql`
      SELECT id, status, funding_source FROM session_payments WHERE session_id = ${covered.sessionId}`);
    const spent = before - (await balance());
    const r5 = await patientCancel({ personId: nada.personId, accountId: null, sessionId: covered.sessionId });
    const after = await balance();
    const coveredAfter = coveredPay
      ? await one<{ status: string }>(sql`SELECT status FROM session_payments WHERE id = ${coveredPay.id}`)
      : null;
    check(
      "🔴 a session the company paid, cancelled early: the pot has every cent back, and the payment is refunded",
      Boolean(coveredPay) && coveredPay!.funding_source === "pot" && spent > 0 && after === before &&
        r5.ok && coveredAfter?.status === "refunded",
      JSON.stringify({ coveredPay, spent, before, after, r5, coveredAfter }),
    );
    const r5b = await patientCancel({ personId: nada.personId, accountId: null, sessionId: covered.sessionId });
    check("🔴 …and a second press returns nothing twice", !r5b.ok && (await balance()) === before);

    /* 🔴 Board 796/807: a company covering 10%, the employee's share never paid. */
    await db.execute(sql`UPDATE sponsor_pots SET coverage_bps = 1000 WHERE sponsor_id = ${sponsor.id}`);
    const partial = await book(nada, 60);
    const partialPay = await one<{ id: string; patient_share_cents: number } | undefined>(sql`
      SELECT id, patient_share_cents FROM session_payments WHERE session_id = ${partial.sessionId}`);
    const partialReceipt = partialPay ? await (await import("../lib/data/receipts")).receiptFor(nada.personId, partialPay.id) : "no row";
    check(
      "🔴 a 10%-covered booking whose share is unpaid offers no receipt: nothing of theirs was paid",
      Boolean(partialPay) && partialPay!.patient_share_cents > 0 && partialReceipt === null,
      JSON.stringify({ partialPay, partialReceipt }),
    );
    const r6 = await patientCancel({ personId: nada.personId, accountId: null, sessionId: partial.sessionId });
    const { cancelledView } = await import("../lib/data/booking-change");
    const partialView = await cancelledView(nada.personId, partial.sessionId);
    check(
      "🔴 …and cancelling it never says their money is on its way back, then or on a reload",
      r6.ok && r6.refund === "none" && partialView?.money === "none" && (await balance()) === before,
      JSON.stringify({ r6, money: partialView?.money }),
    );

    /* --------------------------------------------------------- receipts -- */
    const { receiptFor } = await import("../lib/data/receipts");
    const own = await receiptFor(mona.personId, movingPay);
    const notOwn = await receiptFor(karim.personId, movingPay);
    const coveredReceipt = coveredPay ? await receiptFor(nada.personId, coveredPay.id) : null;
    check(
      "🔴 a receipt for the paying patient: their total and how they paid",
      own !== null && own.totalCents === 2000 && own.method?.kind === "transfer" && /^R-[0-9A-F]{10}$/.test(own.number),
      JSON.stringify(own),
    );
    check("🔴 …and nobody else's: another patient's id opens nothing", notOwn === null);
    check("a session the company paid in full has no receipt for the patient, who paid nothing", coveredReceipt === null);

    /* ----------------------------------------------------------- source -- */
    const change = read("lib/data/booking-change.ts");
    check(
      "the window is the setting, read at the moment of the change, never a constant",
      /rules\.refunds\.patientCancelWindowHours/.test(change) && !/24 \* 3_?600_?000/.test(change),
    );
    check(
      "every state change is conditional on the state it leaves",
      /eq\(sessions\.status, "scheduled"\)/.test(change) && /eq\(sessions\.lateCancel, "held"\)/.test(change) &&
        /eq\(availabilitySlots\.sessionId, booking\.id\)/.test(change),
    );
    check(
      "the rules editor calls the window applied",
      /value=\{rules\.refunds\.patientCancelWindowHours\}\s*status="applied"/.test(read("components/admin/rules-editor.tsx")),
    );
    const receiptPage = read("app/(patient)/patient/billing/receipt/[id]/page.tsx");
    check(
      "the receipt page asks by the signed-in person, prints, and says it is not a tax invoice",
      /requirePatient\(\)/.test(receiptPage) && /receiptFor\(actor\.personId/.test(receiptPage) &&
        /window\.print\(\)/.test(read("components/patient/print-button.tsx")) && /preceipt\.notInvoice/.test(receiptPage),
    );
  } finally {
    setRulesForThisCheck(null);
    if (orgId) {
      await db.execute(sql`DELETE FROM refund_requests WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM manual_payments WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM session_payments WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM patient_notifications WHERE person_id IN (SELECT person_id FROM patients WHERE organization_id = ${orgId})`);
      await db.execute(sql`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE organization_id = ${orgId})`);
      await db.execute(sql`DELETE FROM delivery_attempts WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM audit_log WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM availability_slots WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM sessions WHERE organization_id = ${orgId}`);
    }
    if (sponsorId) {
      await db.execute(sql`DELETE FROM enrolments WHERE sponsor_id = ${sponsorId}`);
      await db.execute(sql`DELETE FROM audit_log WHERE resource_id IN (SELECT id FROM sponsor_pots WHERE sponsor_id = ${sponsorId})`);
      await db.execute(sql`DELETE FROM ledger_entries WHERE ref_id = ${sponsorId}`);
      await db.execute(sql`DELETE FROM sponsor_money_entries WHERE sponsor_id = ${sponsorId}`).catch(() => undefined);
      await db.execute(sql`DELETE FROM sponsor_pots WHERE sponsor_id = ${sponsorId}`);
      await db.execute(sql`DELETE FROM sponsors WHERE id = ${sponsorId}`);
    }
    if (orgId) {
      const people = await rows<{ person_id: string }>(sql`SELECT person_id FROM patients WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM patients WHERE organization_id = ${orgId}`);
      for (const row of people) await db.execute(sql`DELETE FROM people WHERE id = ${row.person_id}`);
      await db.execute(sql`DELETE FROM therapist_verifications WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM users WHERE organization_id = ${orgId}`);
      await db.execute(sql`DELETE FROM organizations WHERE id = ${orgId}`);
    }
  }

  await pool.end();
  finish("booking change");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
