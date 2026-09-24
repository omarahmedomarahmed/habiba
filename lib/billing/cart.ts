import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { manualPayments } from "@/lib/db/schema";
import { log } from "@/lib/logger";

import { openManualPayment, type Payer } from "./manual";

/**
 * 🔴 76.13 — THE PAYMENT SOMEBODY HAS OPENED BUT NOT YET SENT PROOF OF.
 *
 * ## The gap this closes
 *
 * The rail's three states were `awaiting_proof`, `submitted` and decided, and
 * the row only existed from the moment somebody pressed the button. So the
 * commonest real sequence had no record at all:
 *
 *   1. A payer opens the sheet and reads the account number.
 *   2. They switch to their banking app and send the money.
 *   3. The banking app takes a minute. They close the browser, or the phone
 *      locks, or they simply come back tomorrow.
 *   4. Nothing they did was saved. The sheet is gone and so is the amount.
 *
 * They have paid us and there is no claim, which on a rail with no processor
 * means a bank line an operator cannot match and a payer who is certain they
 * paid. The whole rail rests on that middle state being durable, and it was
 * durable from one step too late.
 *
 * So the row opens when the SHEET opens. `awaiting_proof` already meant exactly
 * this and nothing was writing it early enough.
 *
 * ## One open payment per payer, and a new one replaces it
 *
 * A person paying has one thing in mind. A clinician who opens their March bill,
 * changes their mind and opens February is not paying two bills, and two open
 * rows would put two amounts in front of an operator with nothing saying which
 * the payer is acting on.
 *
 * So opening a payment RETIRES the payer's other open ones. It is a delete
 * rather than a state, deliberately: an `awaiting_proof` row carries no money,
 * no proof and no decision. `openManualPayment` says so in its own words —
 * *"a live row is by definition one nobody has acted on"* — and a row that
 * recorded somebody changing their mind is a row an operator has to read past.
 *
 * 🔴 IT NEVER TOUCHES A SUBMITTED ONE. The moment proof arrives the payment is
 * a claim about money, it belongs to the operator, and nothing a payer does
 * afterwards may remove it from the queue.
 */
export async function openCart(input: {
  purpose: Parameters<typeof openManualPayment>[0]["purpose"];
  refId: string | null;
  amountCents: number;
  settlesCents: number;
  currency?: string;
  payer: Payer;
  /**
   * 🔴 76.16 — WHAT IS IN THE CART, frozen here with the total.
   *
   * This is the half that makes the replace rule above readable to a human. A
   * clinician who opened four sessions and came back for eight has one row
   * either way; without the lines an operator sees a number change and cannot
   * tell whether the payer picked differently or a price moved.
   */
  lineItems?: Parameters<typeof openManualPayment>[0]["lineItems"];
}): Promise<{ id?: string; error?: string }> {
  const opened = await openManualPayment(input);
  if (!opened.id) return opened;

  /*
   * 🔴 The payer's IDENTITY column, which is whichever one their kind fills.
   * `manual_payments_one_payer` makes them mutually exclusive, so this is a
   * read of the shape rather than a guess about it.
   */
  const mine =
    input.payer.kind === "sponsor"
      ? eq(manualPayments.sponsorId, input.payer.sponsorId)
      : input.payer.kind === "user"
        ? eq(manualPayments.userId, input.payer.userId)
        : input.payer.kind === "patient"
          ? eq(manualPayments.patientAccountId, input.payer.patientAccountId)
          : input.payer.kind === "organization"
            ? and(eq(manualPayments.payerKind, "organization"), eq(manualPayments.organizationId, input.payer.organizationId))
            : null;

  /*
   * A guest paying for a session has no account at all, which is the entire
   * point of the `session` payer kind: asking somebody to sign up before a
   * crisis session would be the wrong trade. There is no identity to sweep, and
   * the per-ref unique index already stops them opening two for one session.
   */
  if (!mine) return opened;

  const retired = await db
    .delete(manualPayments)
    .where(
      and(
        mine,
        eq(manualPayments.state, "awaiting_proof"),
        ne(manualPayments.id, opened.id),
      ),
    )
    .returning({ id: manualPayments.id });

  if (retired.length > 0) {
    log.info("an earlier open payment was replaced", {
      kept: opened.id,
      retired: retired.length,
    });
  }

  return opened;
}

/*
 * 🔴 76.13 — THERE IS NO `cartFor` HERE, AND THE FIRST DRAFT HAD ONE.
 *
 * It read back the payer's current open, submitted or confirmed payment, which
 * is exactly what `pendingPaymentFor` in `pending.ts` already does for the bar
 * that every portal renders. Two functions answering one question is two places
 * to teach about a new state, and `verify:reachable` caught it as a dead export
 * before it had a second caller to disagree with.
 */

/**
 * 🔴 76.34 — THE PAYER CHANGED THEIR MIND, AND SAID SO.
 *
 * ## Why this has to exist
 *
 * `openCart` above retires an earlier open payment by opening a NEW one, which
 * covers "I meant a different bill" and covers nothing else. The case it does
 * not cover is the one a person actually has: they opened the sheet, read the
 * account number, decided not to send it, and now a red bar across the top of
 * their portal tells them they owe us something they have chosen not to pay.
 *
 * With no way out of that bar the only two exits are paying or ignoring it, and
 * ignoring a warning bar is a habit that carries over to the one that matters.
 *
 * ## 🔴 IT CAN ONLY EVER DELETE AN `awaiting_proof` ROW
 *
 * The moment proof arrives the payment is a CLAIM ABOUT MONEY. It belongs to
 * the operator, the payer may have genuinely sent it, and letting a browser
 * remove it from the queue would be a way to make a transfer disappear from the
 * only record this rail has. The `state` condition is in the WHERE clause
 * rather than checked first, so there is no window between the read and the
 * delete.
 *
 * A delete rather than a `cancelled` state, for the reason `openCart` gives
 * about its own sweep: an `awaiting_proof` row carries no money, no proof and
 * no decision, and a row recording somebody changing their mind is a row an
 * operator has to read past.
 *
 * ## 🔴 AND IT IS SCOPED TO THE PAYER, not to a payment id from a browser
 *
 * The caller passes who they are, which every surface knows from the signed-in
 * actor. Taking an id would mean trusting one, and an id that arrived from a
 * form is an id somebody can change: the first draft of this took `paymentId`
 * and would have let anybody delete anybody's open payment.
 */
export async function cancelCart(
  /*
   * 🔴 THE `session` KIND CARRIES A SESSION ID HERE AND NOT AN ORGANISATION.
   *
   * `Payer`'s own `session` variant holds `organizationId`, because `openCart`
   * is given the session separately as `refId`. There is no second argument
   * here, and matching a guest's open payment by their practice would cancel
   * every guest's payment at that practice. So this one variant is narrowed,
   * and the compiler is what stops the wrong id being passed.
   */
  who: Exclude<Payer, { kind: "session" }> | { kind: "session"; sessionId: string },
): Promise<{ cancelled: number }> {
  const mine =
    who.kind === "sponsor"
      ? eq(manualPayments.sponsorId, who.sponsorId)
      : who.kind === "user"
        ? eq(manualPayments.userId, who.userId)
        : who.kind === "patient"
          ? eq(manualPayments.patientAccountId, who.patientAccountId)
          : who.kind === "organization"
            ? and(eq(manualPayments.payerKind, "organization"), eq(manualPayments.organizationId, who.organizationId))
            : /*
             * 🔴 A GUEST IS IDENTIFIED BY THE SESSION THEY HOLD A LINK TO.
             *
             * They have no account at all, which is the whole point of the
             * `session` payer kind, so the session is the credential and
             * `ref_id` is where it lives.
             */
            eq(manualPayments.refId, who.sessionId);

  const gone = await db
    .delete(manualPayments)
    .where(and(mine, eq(manualPayments.state, "awaiting_proof")))
    .returning({ id: manualPayments.id });

  if (gone.length > 0) {
    log.info("a payer cancelled their open payment", { cancelled: gone.length });
  }

  return { cancelled: gone.length };
}
