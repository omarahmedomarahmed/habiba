import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { manualPayments, patients, sessions, users } from "@/lib/db/schema";

import type { Translate } from "@/lib/i18n/server";

import { egpMinorFor, egpRateMicro } from "./manual";
import { formatMoney } from "./plans";

/**
 * 🔴 76.4 — IS THERE MONEY IN FLIGHT FOR THIS PERSON, FOR THE BAR AT THE TOP.
 *
 * ## Why every layout asks
 *
 * The Egyptian rail's middle state lasts hours and used to be visible on
 * exactly one screen. A payer who minimised the popup and went to look at their
 * calendar had no way back and no way to tell whether anything was happening.
 * A patient in that position books again, a company emails, a clinician assumes
 * their subscription failed, and all three send a second transfer that nobody
 * can reverse.
 *
 * ## Why it reads the row and not a cache
 *
 * `manual_payments` IS the record on this rail. There is no webhook and no
 * processor, so the only true answer to "has this been checked yet" is the
 * state column, and any copy of it is a second opinion that can be stale in the
 * one direction that matters.
 *
 * ## Confirmed payments are included, briefly and on purpose
 *
 * A payer who never sees the outcome learns nothing from having waited. So a
 * recently confirmed payment comes back too, marked `done`, and the browser is
 * what remembers whether this person has dismissed it: "has read a banner" is
 * not a fact worth a column.
 */
export type PendingPayment = {
  paymentId: string;
  /** What the money is for, already in the reader's language. */
  what: string;
  /** "1,140 EGP", formatted here because a client component may not (C84). */
  amount: string;
  /** Where the popup for it lives. */
  href: string;
  /**
   * 🔴 76.13 — WHICH OF THE THREE STAGES, because they ask for different things.
   *
   *   open      they have opened a payment and sent us no proof. The bar is a
   *             way back to the sheet, and the most useful thing in the product
   *             for somebody who transferred the money and closed the browser.
   *   submitted the claim is with an operator. Nothing to do but wait.
   *   confirmed the money landed. For a patient that means a session to join.
   *
   * `done` was a boolean and could not tell the first two apart, which is the
   * distinction that matters most: one of them is waiting on US and the other
   * is waiting on THEM.
   */
  stage: "open" | "submitted" | "confirmed";
  /**
   * 🔴 76.37 — WHAT THE SHEET REMEMBERS ITSELF UNDER, so the bar can OPEN it.
   *
   * The bar used to be a link to the page the sheet lives on, which is a page
   * with a ledger, a plan card and an invoice list on it. Somebody who tapped a
   * red bar saying they owe us money landed on their billing screen and had to
   * find the thing again, which is the opposite of what a bar that follows you
   * around the product is for.
   *
   * `PaymentPopup` opens itself when `pay:<storageKey>` is set, and it reads
   * that on mount. So the bar writes the key and then navigates, and the sheet
   * is already open when the page paints. One mechanism, already there, used
   * from one more place.
   */
  storageKey: string;
};

/** How long a confirmed payment keeps saying so, before it is simply history. */
const CELEBRATE_FOR_MS = 48 * 60 * 60 * 1000;

/**
 * 🔴 ONE QUERY SHAPE FOR THREE PAYERS, and the payer kind decides the columns.
 *
 * A patient's live payment is found by the SESSION, because a patient may have
 * no account at all: the guest paying at eleven at night is the person this
 * rail was built for. A clinician's is found by their organisation and a
 * company's by its sponsor id.
 */
export async function pendingPaymentFor(
  who:
    | { kind: "organization"; organizationId: string }
    | { kind: "sponsor"; sponsorId: string }
    | { kind: "session"; sessionId: string },
  t: Translate,
  locale: string,
): Promise<PendingPayment | null> {
  const where =
    who.kind === "organization"
      ? eq(manualPayments.organizationId, who.organizationId)
      : who.kind === "sponsor"
        ? eq(manualPayments.sponsorId, who.sponsorId)
        : eq(manualPayments.refId, who.sessionId);

  const [row] = await db
    .select({
      id: manualPayments.id,
      purpose: manualPayments.purpose,
      refId: manualPayments.refId,
      state: manualPayments.state,
      settlesCents: manualPayments.settlesCents,
      amountCents: manualPayments.amountCents,
      currency: manualPayments.currency,
      decidedAt: manualPayments.decidedAt,
    })
    .from(manualPayments)
    .where(
      and(
        where,
        /*
         * 🔴 `awaiting_proof` IS EXCLUDED, deliberately.
         *
         * That row opens the moment somebody presses the button, before they
         * have sent anything. A bar saying "waiting to be checked" over a
         * payment nobody has made yet would train every payer to ignore it,
         * and this bar only works while it is always true.
         */
        /*
         * 🔴 76.13 — `awaiting_proof` IS INCLUDED NOW, and excluding it was the
         * defect rather than the caution.
         *
         * The note that stood here said a bar over a payment nobody has made
         * yet would train every payer to ignore it. That was written when the
         * row opened on the BUTTON PRESS, where it really did mean nothing. It
         * opens when the sheet opens now, which makes it the record of somebody
         * who went to their banking app, and the person likeliest to have paid
         * us with no claim attached.
         *
         * The bar says something different for it, because it is asking them to
         * finish rather than telling them to wait.
         */
        inArray(manualPayments.state, ["awaiting_proof", "submitted", "confirmed"]),
      ),
    )
    .orderBy(desc(manualPayments.createdAt))
    .limit(1);

  if (!row) return null;

  const stage =
    row.state === "awaiting_proof" ? "open" : row.state === "submitted" ? "submitted" : "confirmed";

  const done = stage === "confirmed";
  if (done) {
    const at = row.decidedAt?.getTime() ?? 0;
    if (!at || Date.now() - at > CELEBRATE_FOR_MS) return null;
  }

  /*
   * 🔴 The figure in POUNDS, because that is what left their bank, and
   * formatted here because a client component may not format money (C84).
   */
  /*
   * 🔴 K16g (ME39): the pounds stored on the row, which is what the sheet
   * quoted and what they sent. Recomputing from `settles_cents` at today's
   * rate named a different figure the moment an operator moved the rate.
   */
  const amount =
    row.currency.toUpperCase() === "EGP"
      ? formatMoney(row.amountCents, "EGP", locale)
      : formatMoney(egpMinorFor(row.settlesCents, await egpRateMicro()), "EGP", locale);

  /*
   * 🔴 The key each surface already uses, and they differ because the payers do.
   * A clinician's sheet is keyed on their PRACTICE, a company's on its sponsor,
   * and a patient's on the session, which is the only identity a guest has.
   */
  const storageKey =
    who.kind === "organization"
      ? who.organizationId
      : who.kind === "sponsor"
        ? who.sponsorId
        : who.sessionId;

  return {
    paymentId: row.id,
    what: await describe(row.purpose, row.refId, t, who.kind === "organization"),
    amount,
    href: hrefFor(row.purpose, row.refId),
    stage,
    storageKey,
  };
}

/**
 * 🔴 WHAT IT IS FOR, IN WORDS THE PAYER RECOGNISES.
 *
 * "pot_topup" is our word. "Your pot top-up" is theirs, and a session is named
 * by the clinician they are seeing rather than by an identifier, because a
 * person with two sessions in flight has to be able to tell which one this is.
 */
async function describe(
  purpose: string,
  refId: string | null,
  t: Translate,
  /**
   * 🔴 B68: the bar is on the CLINICIAN's pages, and names the other person.
   *
   * A session payment was always described by its clinician, which is right
   * for the patient who paid and read "Session with Amira Demo" to Amira on her
   * own screens. On the practice's bar the other person is the patient.
   */
  forPractice: boolean,
): Promise<string> {
  if (purpose === "pot_topup") return t("transfer.subjectPot");
  if (purpose === "subscription") return t("transfer.subjectBill");

  if (purpose === "session" && refId) {
    const [row] = forPractice
      ? await db
          .select({
            first: sql<string | null>`coalesce(${patients.firstName}, ${sessions.guestName})`,
            last: patients.lastName,
          })
          .from(sessions)
          .leftJoin(patients, eq(patients.id, sessions.patientId))
          .where(eq(sessions.id, refId))
          .limit(1)
      : await db
          .select({ first: users.firstName, last: users.lastName })
          .from(sessions)
          .leftJoin(users, eq(users.id, sessions.therapistId))
          .where(eq(sessions.id, refId))
          .limit(1);

    const name = [row?.first, row?.last].filter(Boolean).join(" ");
    if (name) return t("transfer.subjectSessionWith", { name });
  }

  return t("transfer.subjectSession");
}

function hrefFor(purpose: string, refId: string | null): string {
  if (purpose === "pot_topup") return "/sponsor/pot";
  if (purpose === "subscription") return "/billing";
  return refId ? `/sessions/${refId}` : "/";
}
