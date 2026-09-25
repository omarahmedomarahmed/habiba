/**
 * 🔴 0169 / RULINGS 7 AND 7b: THE WALLET IS SPENT, AND GIVEN BACK EXACTLY.
 *
 * Proves, against the dev database:
 *   - a booking holds the wallet's share after the benefit, and the patient is
 *     asked only for the rest;
 *   - the claim to paid spends the hold, once, and books the correction;
 *   - a wallet that covers everything pays the session at once, booked at the
 *     full price for the clinician;
 *   - an unpaid session that is cancelled gives the hold back to the credits;
 *   - a refund of a session the wallet paid sends nothing and refills the wallet;
 *   - an in-person session never spends it on the therapist's say;
 *   - a cheaper clinician stepping in on a paid session puts the difference in
 *     the wallet, and the session is booked at the new price;
 *   - the wallet account on the books equals what the patients can spend.
 */
import { sql } from "drizzle-orm";

import { reporter, writesTo } from "./_verify";
import { connect } from "./db";

const { check, finish } = reporter();
const fixture = `wal${Date.now().toString(36)}`;

async function main() {
  writesTo();
  const { db, pool } = connect();
  const one = async <T,>(text: ReturnType<typeof sql>): Promise<T> => (await db.execute(text)).rows[0] as T;

  const org = await one<{ id: string }>(sql`
    INSERT INTO organizations (name, region, slug, kind) VALUES ('Wallet Demo', 'eg', ${fixture}, 'solo') RETURNING id`);
  const therapist = await one<{ id: string }>(sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, session_rate_cents)
    VALUES (${org.id}, ${`mona.${fixture}@example.com`}, 'Mona', 'Demo', 'therapist', 'x', 2000) RETURNING id`);
  const cheaper = await one<{ id: string }>(sql`
    INSERT INTO users (organization_id, email, first_name, last_name, role, password_hash, session_rate_cents)
    VALUES (${org.id}, ${`karim.${fixture}@example.com`}, 'Karim', 'Demo', 'therapist', 'x', 1500) RETURNING id`);
  const person = await one<{ id: string }>(sql`
    INSERT INTO people (first_name, last_name, email, region)
    VALUES ('Salma', 'Demo', ${`salma.${fixture}@example.com`}, 'eg') RETURNING id`);
  const patient = await one<{ id: string }>(sql`
    INSERT INTO patients (organization_id, person_id, first_name, last_name, email, source)
    VALUES (${org.id}, ${person.id}, 'Salma', 'Demo', ${`salma.${fixture}@example.com`}, 'self') RETURNING id`);
  let n = 0;
  const book = async (priceCents: number, modality = "video", when = "now() + interval '2 hours'") => {
    n += 1;
    const s = await one<{ id: string }>(sql`
      INSERT INTO sessions (organization_id, therapist_id, patient_id, status, modality,
                            join_token, feedback_token, price_cents, payment_status, scheduled_at, guest_name)
      VALUES (${org.id}, ${therapist.id}, ${patient.id}, 'scheduled', ${modality}, ${`join-${n}-${fixture}`},
              ${`fb-${n}-${fixture}`}, ${priceCents}, 'pending', ${sql.raw(when)}, 'Salma Demo')
      RETURNING id`);
    return s.id;
  };
  const hold = async (sessionId: string) =>
    one<{ cents: number; state: string } | undefined>(sql`SELECT cents, state FROM wallet_holds WHERE session_id = ${sessionId}`);
  const walletBooks = async () =>
    Number(
      (await one<{ t: number }>(sql`
        SELECT COALESCE(SUM(amount_cents), 0)::int AS t FROM ledger_entries
         WHERE account = 'patient_wallet' AND organization_id = ${org.id}`)).t,
    );

  try {
    const wallet = await import("../lib/billing/wallet");
    const { patientOwesFor, claimSessionPaid } = await import("../lib/billing/session-owed");

    /* CONTROL: an empty wallet holds nothing, and the patient is asked for everything. */
    const empty = await book(2000);
    const none = await wallet.holdWallet(empty);
    const full = await patientOwesFor(empty);
    check(
      "🔴 CONTROL an empty wallet holds nothing and the patient owes the whole price",
      none.heldCents === 0 && !none.paid && full.grossCents === 2000 && full.walletCents === 0 && (await hold(empty)) === undefined,
      JSON.stringify({ none, full }),
    );
    await db.execute(sql`UPDATE sessions SET status = 'cancelled' WHERE id = ${empty}`);

    await wallet.creditWallet({
      personId: person.id,
      cents: 500,
      reason: "Demo credit",
      fromSessionId: null,
      from: [{ account: "platform_revenue", amountCents: 500, organizationId: org.id, memo: "Demo" }],
    });
    check("a credit shows in the balance", (await wallet.walletBalanceCents(person.id)) === 500);

    /* 1 · partly covered by the wallet */
    const partly = await book(2000);
    const held = await wallet.holdWallet(partly);
    const owed = await patientOwesFor(partly);
    check(
      "🔴 a booking holds the wallet's share and the patient is asked only for the rest",
      held.heldCents === 500 && !held.paid && owed.grossCents === 1500 && owed.walletCents === 500,
      JSON.stringify({ held, owed }),
    );
    check("…and the balance is spoken for", (await wallet.walletBalanceCents(person.id)) === 0);
    const twice = await wallet.holdWallet(partly);
    check("…never twice for one session", twice.heldCents === 0 && (await hold(partly))?.cents === 500);

    await claimSessionPaid(partly);
    await claimSessionPaid(partly);
    const spends = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM ledger_entries WHERE txn_kind = 'wallet_spend'
         AND ref_id = (SELECT id FROM wallet_holds WHERE session_id = ${partly})`);
    check(
      "🔴 paying the rest spends the hold, once, and books the correction",
      (await hold(partly))?.state === "spent" && spends.n === 2,
      JSON.stringify({ hold: await hold(partly), legs: spends.n }),
    );

    /* 2 · the wallet covers everything */
    await wallet.creditWallet({
      personId: person.id,
      cents: 3000,
      reason: "Demo credit",
      fromSessionId: null,
      from: [{ account: "platform_revenue", amountCents: 3000, organizationId: org.id, memo: "Demo" }],
    });
    const whole = await book(2000);
    const all = await wallet.holdWallet(whole);
    const wholeRow = await one<{ pay: string; gross: number | null; net: number | null }>(sql`
      SELECT s.payment_status AS pay, sp.gross_cents AS gross, sp.therapist_net_cents AS net
        FROM sessions s LEFT JOIN session_payments sp ON sp.session_id = s.id WHERE s.id = ${whole}`);
    check(
      "🔴 a wallet that covers it all pays the session now, booked at the full price",
      all.paid && wholeRow.pay === "paid" && wholeRow.gross === 2000 && (wholeRow.net ?? 0) > 0 && (await hold(whole))?.state === "spent",
      JSON.stringify({ all, wholeRow }),
    );
    check("…leaving 1000 to spend", (await wallet.walletBalanceCents(person.id)) === 1000, String(await wallet.walletBalanceCents(person.id)));

    /* 3 · cancelled before paying: released */
    const dropped = await book(2000);
    await wallet.holdWallet(dropped);
    await db.execute(sql`UPDATE sessions SET status = 'cancelled' WHERE id = ${dropped}`);
    await wallet.sweepWalletHolds();
    check(
      "🔴 an unpaid session cancelled gives the hold back",
      (await hold(dropped))?.state === "released" && (await wallet.walletBalanceCents(person.id)) === 1000,
    );

    /* 4 · refund of the session the wallet paid */
    const payment = await one<{ id: string }>(sql`SELECT id FROM session_payments WHERE session_id = ${whole}`);
    const { refundSessionPayment } = await import("../lib/billing/connect");
    const back = await refundSessionPayment({ paymentId: payment.id, reason: "Demo refund", adminUserId: null });
    check(
      "🔴 a refund of a wallet-paid session sends nothing and refills the wallet",
      Boolean(back.ok) && back.toPayerCents === 0 && (await hold(whole))?.state === "returned" && (await wallet.walletBalanceCents(person.id)) === 3000,
      JSON.stringify({ back, balance: await wallet.walletBalanceCents(person.id) }),
    );
    const queued = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM refund_requests WHERE session_payment_id = ${payment.id}`);
    check("…and queues nothing for a person to send", queued.n === 0);

    /* 5 · in person, on the therapist's say */
    const room = await book(2000, "in_person");
    const byTherapist = await wallet.holdWallet(room);
    const byPatient = await wallet.holdWallet(room, { byPersonId: person.id });
    check(
      "🔴 in person, the wallet moves only on the patient's own word",
      byTherapist.heldCents === 0 && byPatient.heldCents > 0,
      JSON.stringify({ byTherapist, byPatient }),
    );
    await db.execute(sql`UPDATE sessions SET status = 'cancelled' WHERE id = ${room}`);
    await wallet.sweepWalletHolds();

    /* 6 · a cheaper clinician on a paid session */
    await wallet.creditWallet({
      personId: person.id,
      cents: 5000,
      reason: "Demo credit",
      fromSessionId: null,
      from: [{ account: "platform_revenue", amountCents: 5000, organizationId: org.id, memo: "Demo" }],
    });
    const missed = await book(2000, "video", "now() - interval '10 minutes'");
    await db.execute(sql`UPDATE sessions SET patient_joined_at = now() - interval '8 minutes' WHERE id = ${missed}`);
    await wallet.holdWallet(missed);
    const before = await wallet.walletBalanceCents(person.id);
    const { reassignSession } = await import("../lib/data/recovery");
    const moved = await reassignSession({ sessionId: missed, toUserId: cheaper.id });
    const after = await one<{ price: number; gross: number; therapist: string }>(sql`
      SELECT s.price_cents AS price, sp.gross_cents AS gross, sp.therapist_id AS therapist
        FROM sessions s JOIN session_payments sp ON sp.session_id = s.id WHERE s.id = ${missed}`);
    check(
      "🔴 a cheaper clinician on a paid session: the difference goes to the wallet",
      moved.ok && moved.outcome === "reassigned" && moved.creditCents === 500 &&
        (await wallet.walletBalanceCents(person.id)) === before + 500,
      JSON.stringify({ moved, before, now: await wallet.walletBalanceCents(person.id) }),
    );
    check(
      "…and the session is booked at the new price, for the one who held it",
      after.price === 1500 && after.gross === 1500 && after.therapist === cheaper.id,
      JSON.stringify(after),
    );

    /* 7 · the books */
    const liability = await walletBooks();
    const owedToPatients = await wallet.walletBalanceCents(person.id);
    const heldNow = Number(
      (await one<{ t: number }>(sql`SELECT COALESCE(SUM(cents), 0)::int AS t FROM wallet_holds WHERE person_id = ${person.id} AND state = 'held'`)).t,
    );
    check(
      "🔴 the wallet on the books is what the patient can spend plus what is held",
      -liability === owedToPatients + heldNow,
      JSON.stringify({ liability, owedToPatients, heldNow }),
    );
    const unbalanced = await one<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM (
        SELECT txn_id FROM ledger_entries WHERE organization_id = ${org.id} GROUP BY txn_id HAVING SUM(amount_cents) <> 0) t`);
    check("every transaction this made balances", unbalanced.n === 0);
  } finally {
    await db.execute(sql`DELETE FROM refund_requests WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM wallet_holds WHERE person_id = ${person.id}`);
    await db.execute(sql`DELETE FROM patient_credits WHERE person_id = ${person.id}`);
    await db.execute(sql`DELETE FROM ledger_entries WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM session_payments WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM audit_log WHERE organization_id = ${org.id}`).catch(() => undefined);
    await db.execute(sql`DELETE FROM sessions WHERE patient_id = ${patient.id}`);
    await db.execute(sql`DELETE FROM patients WHERE id = ${patient.id}`);
    await db.execute(sql`DELETE FROM people WHERE id = ${person.id}`);
    await db.execute(sql`DELETE FROM users WHERE organization_id = ${org.id}`);
    await db.execute(sql`DELETE FROM organizations WHERE id = ${org.id}`);
  }

  await pool.end();
  finish("wallet");
}

void main();
