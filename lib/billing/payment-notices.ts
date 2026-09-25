import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import {
  manualPayments,
  patientAccounts,
  patients,
  people,
  sessions,
  sponsorUsers,
  users,
  type ManualPayment,
} from "@/lib/db/schema";
import { env } from "@/lib/env";
import { log, ref } from "@/lib/logger";
import { localeTag, type Locale } from "@/lib/i18n/config";
import { wordsFor, type Words } from "@/lib/i18n/message-words";
import type { Who } from "@/lib/i18n/preference";
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

/**
 * Who to tell, resolved from whichever payer column the row carries, and the
 * words to tell them in (ruling 8): a patient's or a clinician's own choice.
 * A company login has no saved language, so it gets the default.
 */
async function recipientFor(
  payment: ManualPayment,
): Promise<{ to: Recipient; words: Words; hi: string; portal: string } | null> {
  const found = await payerOf(payment);
  if (!found) return null;
  const words = await wordsFor(found.who);
  return {
    to: { ...found.to, locale: words.locale, reader: found.reader },
    words,
    hi: found.name ? words.t("pmsg.hi", { name: found.name }) : words.t("pmsg.hiThere"),
    portal: `${env.appUrl}${found.portal}`,
  };
}

/**
 * 🔴 B28 / B47: WHERE "OPEN YOUR ACCOUNT" GOES, for each kind of payer.
 *
 * Every one of these links used to be the bare app address, which is the
 * public home page: a company admin who pressed "Track it" landed on the
 * marketing site, signed out, with no way from there to the pot they had just
 * paid into. Each payer's own portal page for what they bought.
 */
const PORTAL = {
  company: "/sponsor/pot",
  clinician: "/billing",
  patient: "/patient/billing",
} as const;

async function payerOf(
  payment: ManualPayment,
): Promise<{
  to: Recipient;
  name: string | null;
  who: Who | null;
  reader: "patient" | "clinician" | "company";
  portal: string;
} | null> {
  if (payment.sponsorId) {
    /*
     * Admins only, the same rule `alertPots` follows: a viewer can
     * read the balance and cannot move money, and telling somebody about a
     * payment they had no part in is how a sender gets filtered.
     */
    /*
     * 🔴 ME69: the comment above said admins and the query did not ask. It took
     * the first login of any role, deleted ones included, so a payment notice
     * could go to a viewer or to somebody who had left the company.
     */
    const [admin] = await db
      .select({ email: sponsorUsers.email, name: sponsorUsers.name })
      .from(sponsorUsers)
      .where(
        and(
          eq(sponsorUsers.sponsorId, payment.sponsorId),
          eq(sponsorUsers.role, "admin"),
          isNull(sponsorUsers.deletedAt),
        ),
      )
      .orderBy(sponsorUsers.createdAt)
      .limit(1);

    if (!admin?.email) return null;
    /*
     * 🔴 B28 / B47: the greeting is the PERSON reading it. It said "Hi Cairo
     * Foundry", the company's name, to the admin who made the transfer. A login
     * with no name on it gets "Hi," rather than the company's.
     */
    return {
      to: { email: admin.email, phone: null },
      name: admin.name?.trim().split(/\s+/)[0] || null,
      who: null,
      reader: "company",
      portal: PORTAL.company,
    };
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
    return {
      to: { email: row.email, phone: null },
      name: row.first ?? null,
      who: { userId: payment.userId },
      reader: "clinician",
      portal: PORTAL.clinician,
    };
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

    /* A person with no handle still has an app to be told in (K10). */
    if (!row?.email && !row?.phone && !row?.personId) return null;
    return {
      to: { personId: row.personId, email: row.email ?? null, phone: row.phone ?? null },
      name: row.first ?? null,
      who: row.personId ? { personId: row.personId } : null,
      reader: "patient",
      portal: PORTAL.patient,
    };
  }

  /*
   * 🔴 A GUEST PAYING FOR A SESSION, which is the person this rail was built
   * for. They have no account, so the only handle we hold is whatever the
   * session itself carries.
   */
  if (payment.purpose === "session" && payment.refId) {
    const [row] = await db
      .select({
        name: sessions.guestName,
        email: sessions.guestEmail,
        personId: patients.personId,
      })
      .from(sessions)
      .leftJoin(patients, eq(patients.id, sessions.patientId))
      .where(eq(sessions.id, payment.refId))
      .limit(1);

    /*
     * 🔴 K10: A SIGNED-IN PATIENT PAYS THROUGH THE SAME LINK, and is a person.
     *
     * The session payer carries no account, so this used to reach only the
     * receipt email typed on the page: a patient in the app who typed none was
     * told nothing when their claim arrived or their money landed. When the
     * session's chart belongs to a person with a live account, they are told
     * like any account holder: their app, their phone or address, their language.
     */
    if (row?.personId) {
      const [account] = await db
        .select({ email: patientAccounts.email, phone: patientAccounts.phone, first: people.firstName, personPhone: people.phone })
        .from(patientAccounts)
        .innerJoin(people, eq(people.id, patientAccounts.personId))
        .where(and(eq(patientAccounts.personId, row.personId), isNull(patientAccounts.deletedAt)))
        .limit(1);
      if (account) {
        return {
          to: {
            personId: row.personId,
            email: account.email ?? row.email ?? null,
            phone: account.phone ?? account.personPhone ?? null,
          },
          name: account.first ?? row.name ?? null,
          who: { personId: row.personId },
          reader: "patient",
          portal: PORTAL.patient,
        };
      }
    }

    if (!row?.email) return null;
    /* A guest has no account to open; every message to them carries the join link instead. */
    return { to: { email: row.email, phone: null }, name: row.name ?? null, who: null, reader: "patient", portal: PORTAL.patient };
  }

  return null;
}

/**
 * 🔴 THE FIGURE IN POUNDS, because that is what left their bank.
 *
 * Every message about this rail names the amount, and naming it in dollars
 * would be naming a number the payer never saw: they chose pounds in a banking
 * app and the statement line is in pounds.
 *
 * 🔴 K16g (ME39): the pounds stored on the row, the figure the sheet quoted
 * and the payer sent. Converting `settles_cents` at today's rate quoted a
 * different number the moment an operator changed the rate in between.
 */
async function poundsFor(
  payment: Pick<ManualPayment, "amountCents" | "currency" | "settlesCents">,
  /**
   * 🔴 B9: the reader's language. Always `en-US` before, so an Arabic
   * message, email and WhatsApp alike, ended "EGP 1,000" in English. The
   * same tag `<Money>` uses on screen, Western digits included.
   */
  locale: Locale,
): Promise<string> {
  const { formatDisplay } = await import("@/lib/money/convert");
  const tag = localeTag(locale);
  if (payment.currency.toUpperCase() === "EGP") return formatDisplay(payment.amountCents, "EGP", tag);
  const { egpMinorFor, egpRateMicro } = await import("./manual");
  return formatDisplay(egpMinorFor(payment.settlesCents, await egpRateMicro()), "EGP", tag);
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

    const join = await joinLinkFor(payment);
    const amount = await poundsFor(payment, who.words.locale);
    const { t } = who.words;

    await notify(who.to, {
      /* 🔴 K10: and in the app, so a payer with no inbox still sees it arrived. */
      notice: {
        kind: "payment_submitted",
        key: "pnotice.paymentSubmitted",
        ...(payment.purpose === "session" && payment.refId ? { sessionId: payment.refId } : {}),
      },
      kind: "payment.submitted",
      subject: t("pmsg.pay.submittedSubject"),
      body: `${who.hi}\n\n${t("pmsg.pay.submitted", { amount })}`,
      /* 🔴 B47: to the page that shows this payment, never the public home page. */
      link: { label: t("pmsg.pay.track"), url: join ?? who.portal },
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
    const amount = await poundsFor(payment, who.words.locale);
    const { t } = who.words;

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
      subject: t(join ? "pmsg.pay.sessionPaidSubject" : "pmsg.pay.confirmedSubject"),
      body: `${who.hi}\n\n${t(join ? "pmsg.pay.sessionPaid" : "pmsg.pay.confirmed")}`,
      link: join
        ? { label: t("pmsg.pay.join"), url: join }
        : { label: t("pmsg.pay.account"), url: who.portal },
      variables: [amount],
    });
  } catch (error) {
    log.warn("could not tell a payer their money landed", {
      payment: ref(paymentId),
      reason: String(error),
    });
  }
}

/**
 * 🔴 25 September inventory: a rejected transfer told the payer nothing, while
 * the operator's screen said "they have been told why". The reason the
 * operator typed goes to them, with the way back to try again.
 */
export async function noticePaymentRejected(paymentId: string): Promise<void> {
  try {
    const [payment] = await db
      .select()
      .from(manualPayments)
      .where(eq(manualPayments.id, paymentId))
      .limit(1);
    if (!payment || payment.state !== "rejected") return;

    const who = await recipientFor(payment);
    if (!who) return;

    const join = await joinLinkFor(payment);
    const amount = await poundsFor(payment, who.words.locale);
    const { t } = who.words;
    await notify(who.to, {
      kind: "payment.rejected",
      subject: t("pmsg.pay.rejectedSubject"),
      body: `${who.hi}\n\n${t("pmsg.pay.rejected", { reason: payment.rejectReason ?? t("pmsg.pay.noReason") })}`,
      link: join
        ? { label: t("pmsg.pay.page"), url: join }
        : { label: t("pmsg.pay.account"), url: who.portal },
      variables: [amount],
    });
  } catch (error) {
    log.warn("could not tell a payer their transfer was rejected", {
      payment: ref(paymentId),
      reason: String(error),
    });
  }
}
