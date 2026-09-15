/**
 * One way in, for all three flows.
 *
 * ## 🔴 WHY A THIRD FILE
 *
 * `manual.ts` owns the queue. `manual-grants.ts` owns what a confirmation
 * unlocks. Neither of them should know that there is a screen, and a screen
 * should not have to assemble four calls in the right order to ask one question.
 *
 * The question every payer's screen asks is the same: **can this person pay by
 * transfer, what details do they need, and is there already one in flight?**
 * That is this file, and it is the only thing the three flows import.
 *
 * ## 🔴 EGYPT IS ASKED OF THE ENTITY, NOT OF A COUNTRY FIELD
 *
 * The rail exists because `topUpPot` refuses `entity = 'eg'`. So the test for
 * "does this person need the manual rail" has to be the same fact, read the same
 * way, or the two will disagree the day somebody adds a country. A patient in
 * Egypt whose therapist bills through the US entity can pay by card and should
 * not be shown a bank account.
 */
import "server-only";

import { eq } from "drizzle-orm";

import { controlDb as db } from "@/lib/db";
import { organizations, sponsors } from "@/lib/db/schema";

import {
  egpMinorFor,
  egpRateMicro,
  livePaymentFor,
  openManualPayment,
  paymentsFor,
  submitProof,
  transferDetails,
  type Audience,
  type Payer,
} from "./manual";
import { formatMoney } from "./plans";
import type { ManualPaymentPurpose } from "@/lib/db/schema";

/** What a screen renders. Assembled once so no flow has to sequence the calls. */
export type ManualEntry = {
  /** False when this payer has a card rail and should not see a bank account. */
  needed: boolean;
  details: Awaited<ReturnType<typeof transferDetails>>;
  live:
    | { state: "none" }
    | { state: "awaiting_proof"; paymentId: string }
    | { state: "submitted"; paymentId: string; submittedAt: string | null }
    | { state: "rejected"; reason: string };
  /**
   * 🔴 THE NUMBER TO SEND, IN POUNDS, FORMATTED ON THE SERVER.
   *
   * Formatted here rather than handed down as cents, for two reasons that are
   * both the same reason. C84: `Intl` inside a client component renders one
   * string on the server pass and another in the browser, and this is the
   * figure somebody types into a banking app. And the rate is a server fact —
   * a client that could compute this number is a client that could be shown a
   * different one.
   */
  amountLabel: string;
  /**
   * 🔴 "50", so a pot screen can say what it converts at.
   *
   * A session and an invoice cost what they cost and the payer only ever sees
   * the pounds. A pot is the one place the payer types a number, and it is in
   * dollars because that is what a pot holds — so without this they are asked
   * for one currency and told to send another with no sum in between.
   */
  rateLabel: string;
};

/* -------------------------------------------------------- who needs this -- */

/**
 * 🔴 Read from the same column `topUpPot` refuses on.
 *
 * Anything else is a second opinion about which rail somebody is on, and two
 * opinions about that is how a company is shown a bank account and then charged
 * a card, or shown neither.
 */
export async function sponsorNeedsTransfer(sponsorId: string): Promise<boolean> {
  const [row] = await db
    .select({ entity: sponsors.entity })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);
  return row?.entity === "eg";
}

/**
 * A clinician's PRACTICE region decides it, not their passport.
 *
 * 🔴 `organizations.region` is the column C118 made required and threads
 * everywhere, and it is the practice's jurisdiction rather than the person's.
 * That is the right question here: a therapist living in Cairo whose practice
 * bills through the US entity has a card rail and should not be handed a bank
 * account, and the reverse is also true.
 */
export async function organizationNeedsTransfer(organizationId: string): Promise<boolean> {
  const [row] = await db
    .select({ region: organizations.region })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return row?.region === "eg";
}

/* ---------------------------------------------------------- the assembly -- */

/**
 * Everything one screen needs, in one call.
 *
 * 🔴 It does NOT open a payment. A screen being rendered is not somebody
 * deciding to pay, and opening a row on every page view would fill the queue
 * with abandoned intentions an operator has to read past. The row is opened when
 * they press the button.
 */
export async function manualEntry(input: {
  audience: Audience;
  purpose: ManualPaymentPurpose;
  refId: string | null;
  payer: Payer;
  needed: boolean;
  /**
   * What the thing costs, in USD cents. Null when the payer chooses the amount
   * themselves, which is only ever a pot top-up.
   */
  settlesCents: number | null;
  /** 🔴 19.4 — the reader's language, so the figure is in their numerals. */
  locale: string;
}): Promise<ManualEntry> {
  if (!input.needed) {
    return {
      needed: false,
      details: { label: "", fields: [], cardsComingSoon: false, unconfigured: true },
      live: { state: "none" },
      amountLabel: "",
      rateLabel: "",
    };
  }

  const [details, rateMicro] = await Promise.all([transferDetails(input.audience), egpRateMicro()]);
  const amountLabel =
    input.settlesCents === null
      ? ""
      : formatMoney(egpMinorFor(input.settlesCents, rateMicro), "EGP", input.locale);
  /* Pounds per dollar, which is what `egpRateMicro` is a millionth of. */
  const rateLabel = formatMoney(egpMinorFor(100, rateMicro), "EGP", input.locale);

  /*
   * 🔴 The live row first, and a REJECTED one second.
   *
   * A payer who was turned down has no live row, so without the second lookup
   * their screen would show the details again with no explanation and they would
   * transfer the same money twice. The rejection has to reach them.
   */
  const live = input.refId ? await livePaymentFor(input.purpose, input.refId) : null;

  if (live) {
    return {
      needed: true,
      details,
      amountLabel,
      rateLabel,
      live:
        live.state === "submitted"
          ? {
              state: "submitted",
              paymentId: live.id,
              submittedAt: live.submittedAt?.toISOString() ?? null,
            }
          : { state: "awaiting_proof", paymentId: live.id },
    };
  }

  const history = await paymentsFor(input.payer);
  const lastRejection = history.find(
    (p) => p.state === "rejected" && (input.refId === null || p.refId === input.refId),
  );

  return {
    needed: true,
    details,
    amountLabel,
    rateLabel,
    live: lastRejection
      ? { state: "rejected", reason: lastRejection.rejectReason ?? "" }
      : { state: "none" },
  };
}

/**
 * They pressed "I have paid": open the row if there is not one, then record it.
 *
 * 🔴 ONE CALL, because two round trips means a payer whose connection dropped
 * between them has a row with no proof on it and no way back to it. The screen
 * has one button and this is one function.
 */
export async function declarePaid(input: {
  purpose: ManualPaymentPurpose;
  refId: string | null;
  /**
   * 🔴 USD CENTS, ALWAYS, AND EVERY CALLER SPEAKS DOLLARS.
   *
   * The pounds are computed here, once, from the operator's rate. A call site
   * that passed pounds would be a call site that had to know the rate, and the
   * moment two of them know it they can disagree — which is how a pot came to
   * be credited fifty times what was sent (0106).
   */
  settlesCents: number;
  payer: Payer;
  reference: string;
  proofUrl: string | null;
}): Promise<{ error?: string; ok?: true }> {
  const rateMicro = await egpRateMicro();

  /*
   * 🔴 EGP, and the column exists so that stops being true one day rather than
   * because it varies today. This rail is Egypt's: the moment there is a second
   * country on it, the currency comes from the payer and not from here.
   */
  const opened = await openManualPayment({
    purpose: input.purpose,
    refId: input.refId,
    amountCents: egpMinorFor(input.settlesCents, rateMicro),
    settlesCents: input.settlesCents,
    currency: "EGP",
    payer: input.payer,
  });
  if (opened.error || !opened.id) return { error: opened.error ?? "That could not be started." };

  const submitted = await submitProof({
    paymentId: opened.id,
    reference: input.reference,
    proofUrl: input.proofUrl,
  });
  if (submitted.error) return { error: submitted.error };

  return { ok: true };
}
