import "server-only";

import { eq } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import {
  manualPayments,
  patientAccounts,
  people,
  sessions,
  sponsorUsers,
  sponsors,
  users,
  type ManualPayment,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import { notify, type Recipient } from "@/lib/notify";

/**
 * 🔴 76.14 — THE TWO MOMENTS A PAYER ON THIS RAIL HEARS FROM US.
 *
 * ## Why exactly two
 *
 * There is no processor, so the rail has a middle state that lasts hours and is
 * invisible from anywhere except the product. A payer who has sent money into a
 * bank account and heard nothing has no way to distinguish "being checked" from
 * "lost", and the way that goes wrong is not silence: it is a second transfer,
 * which nobody can reverse.
 *
 * So we speak when the state changes in a way they care about:
 *
 *   **submitted** — we have their claim. Nothing is owed from them now.
 *   **confirmed** — the money landed and the thing they bought is theirs.
 *
 * ## And why not a third
 *
 * Nothing is sent when a payment is merely OPENED. That row exists the moment
 * somebody reads the account number, which is not a decision and very often not
 * even an intention. A message at that point would arrive before most people
 * had done anything, and a sender whose messages arrive before they are true is
 * a sender people stop reading.
 *
 * A rejection is also silent HERE and loud elsewhere: `rejectPayment` already
 * carries the operator's own words, and a generic "there was a problem" racing
 * the real explanation is worse than either alone.
 *
 * ## The patient's confirmation carries the way in
 *
 * A patient paid for one thing: a session. Telling them it is paid and making
 * them find the link again is the product forgetting what the money was for, so
 * the join link is in the message. Everybody else gets a link to their own
 * account, because what they bought is a balance or a plan rather than a door.
 *
 * ## 🔴 A FAILED MESSAGE NEVER FAILS A PAYMENT
 *
 * Every call here is wrapped. The money has already moved and the ledger has
 * already been written by the time these run; throwing would turn a delivery
 * problem into a confirmation that appears not to have happened, and an
 * operator would press Confirm again.
 */

/** Who to tell, resolved from whichever payer column the row carries. */
async function recipientFor(
  payment: ManualPayment,
): Promise<{ to: Recipient; name: string } | null> {
  if (payment.sponsorId) {
    /*
     * Admins only, the same rule `alertPots` follows: a viewer can
     * read the balance and cannot move money, and telling somebody about a
     * payment they had no part in is how a sender gets filtered.
     */
    const [admin] = await db
      .select({ email: sponsorUsers.email })
      .from(sponsorUsers)
      .where(eq(sponsorUsers.sponsorId, payment.sponsorId))
      .limit(1);
    const [sponsor] = await db
      .select({ name: sponsors.name })
      .from(sponsors)
      .where(eq(sponsors.id, payment.sponsorId))
      .limit(1);

    if (!admin?.email) return null;
    return { to: { email: admin.email, phone: null }, name: sponsor?.name ?? "your company" };
  }

  if (payment.userId) {
    const [row] = await db
      /*
       * 🔴 No phone column on a clinician, so email only for this payer, and
       * that is the right answer rather than a gap: a clinician signs in with
       * an address and we have never asked them for a number.
       */
      .select({ email: users.email, first: users.firstName })
      .from(users)
      .where(eq(users.id, payment.userId))
      .limit(1);

    if (!row?.email) return null;
    return { to: { email: row.email, phone: null }, name: row.first ?? "there" };
  }

  if (payment.patientAccountId) {
    const [row] = await db
      .select({
        email: patientAccounts.email,
        phone: people.phone,
        first: people.firstName,
        /* 🔴 79.1 — so a confirmed payment also appears in the patient's app. */
        personId: patientAccounts.personId,
      })
      .from(patientAccounts)
      .leftJoin(people, eq(people.id, patientAccounts.personId))
      .where(eq(patientAccounts.id, payment.patientAccountId))
      .limit(1);

    if (!row?.email && !row?.phone) return null;
    return {
      to: { personId: row.personId, email: row.email ?? null, phone: row.phone ?? null },
      name: row.first ?? "there",
    };
  }

  /*
   * 🔴 A GUEST PAYING FOR A SESSION, which is the person this rail was built
   * for. They have no account, so the only handle we hold is whatever the
   * session itself carries.
   */
  if (payment.purpose === "session" && payment.refId) {
    const [row] = await db
      .select({ name: sessions.guestName, email: sessions.guestEmail })
      .from(sessions)
      .where(eq(sessions.id, payment.refId))
      .limit(1);

    if (!row?.email) return null;
    return { to: { email: row.email, phone: null }, name: row.name ?? "there" };
  }

  return null;
}

/**
 * 🔴 THE FIGURE IN POUNDS, because that is what left their bank.
 *
 * Every message about this rail names the amount, and naming it in dollars
 * would be naming a number the payer never saw: they chose pounds in a banking
 * app and the statement line is in pounds.
 */
async function poundsFor(settlesCents: number): Promise<string> {
  const { egpMinorFor, egpRateMicro } = await import("./manual");
  const { formatMoney } = await import("./plans");
  return formatMoney(egpMinorFor(settlesCents, await egpRateMicro()), "EGP", "en-US");
}

/** The join link, for the one payer whose purchase is a door. */
async function joinLinkFor(payment: ManualPayment): Promise<string | null> {
  if (payment.purpose !== "session" || !payment.refId) return null;

  const [row] = await db
    .select({ token: sessions.joinToken })
    .from(sessions)
    .where(eq(sessions.id, payment.refId))
    .limit(1);

  return row?.token ? `${env.appUrl}/join/${row.token}` : null;
}

/**
 * 🔴 THEIR CLAIM REACHED US. Sent the moment proof is submitted.
 *
 * The body says what happens next and gives no estimate it cannot keep: an
 * operator works the queue oldest first, and a promise of "within an hour" that
 * slips is worse than no promise at all.
 */
export async function noticePaymentSubmitted(paymentId: string): Promise<void> {
  try {
    const [payment] = await db
      .select()
      .from(manualPayments)
      .where(eq(manualPayments.id, paymentId))
      .limit(1);
    if (!payment) return;

    const who = await recipientFor(payment);
    if (!who) return;

    const amount = await poundsFor(payment.settlesCents);

    await notify(who.to, {
      kind: "payment.submitted",
      subject: "We have your transfer",
      body:
        `Hi ${who.name},\n\n` +
        `Thank you. We have your transfer of ${amount} and somebody is checking it against our ` +
        "bank now. You do not need to send anything again.\n\n" +
        "We will message you the moment it is confirmed.",
      link: { label: "Track it", url: `${env.appUrl}` },
      /* The one variable the approved WhatsApp template takes. */
      variables: [amount],
    });
  } catch (error) {
    log.warn("could not tell a payer their claim arrived", {
      payment: ref(paymentId),
      reason: String(error),
    });
  }
}

/**
 * 🔴 THE MONEY LANDED, and for a patient that means a door to walk through.
 */
export async function noticePaymentConfirmed(paymentId: string): Promise<void> {
  try {
    const [payment] = await db
      .select()
      .from(manualPayments)
      .where(eq(manualPayments.id, paymentId))
      .limit(1);
    if (!payment) return;

    const who = await recipientFor(payment);
    if (!who) return;

    const join = await joinLinkFor(payment);
    const amount = await poundsFor(payment.settlesCents);

    await notify(who.to, {
      /*
       * 🔴 79.1 — AND THE JOIN LINK IS IN THE APP, not only in an inbox.
       *
       * A patient paid, went back to the app and had nothing: no record of the
       * payment and no way into the session they had just bought. The link was
       * in an email they had to go and find.
       */
      notice: { kind: "payment_confirmed", key: "pnotice.paymentConfirmed" },
      kind: "payment.confirmed",
      subject: join ? "Your session is paid for" : "Your payment is confirmed",
      body:
        `Hi ${who.name},\n\n` +
        (join
          ? "Your transfer is confirmed and your session is ready. Use the link below when it is " +
            "time, and keep it: it is the same link every time."
          : "Your transfer is confirmed and your account is up to date. Thank you."),
      link: join
        ? { label: "Join your session", url: join }
        : { label: "Open your account", url: `${env.appUrl}` },
      variables: [amount],
    });
  } catch (error) {
    log.warn("could not tell a payer their money landed", {
      payment: ref(paymentId),
      reason: String(error),
    });
  }
}
