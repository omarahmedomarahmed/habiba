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
   * 🔴 75.7 — WHY THE FIGURE IS BIGGER THAN THE FEE THEY WERE QUOTED.
   *
   * An Egyptian patient is asked for 1,140 pounds for a 1,000 pound session.
   * Without a line saying so that reads as a mistake or a markup, and a payer
   * who thinks they are being overcharged does not transfer, they email. Empty
   * where there is no tax, so nothing is said that is not true.
   */
  taxNote: string;
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

/* ------------------------------------------------------------ the VAT -- */

/**
 * 🔴 WHAT AN EGYPTIAN PAYER ACTUALLY OWES FOR A SESSION, VAT INCLUDED.
 *
 * ## The hole this closes
 *
 * The card branch of `/pay/[token]` has always run `sessionMoney` with the
 * country's `vatBps` and charged `patientTotalCents`. The TRANSFER branch quoted
 * `session.priceCents` and stopped. Every Egyptian practice takes the transfer
 * branch, and `collectionProblem` refuses the Stripe branch for a `paymob`
 * country anyway, so **no Egyptian session ever collected the 14% that
 * `country_settings` says is owed**, on the only rail this market has.
 *
 * `lib/settings/defs.ts` already says why that matters in its own words: a
 * guessed 0% is an under-collection somebody eventually owes. It was being
 * violated by the product's only live rail.
 *
 * ## Why it is one function and not two call sites
 *
 * The page QUOTES the figure and the action DECLARES it, and they used to
 * compute it separately from the same input. Two places deriving one number is
 * how a payer is shown one amount and charged another, which on a rail with no
 * processor means an operator matching a bank line that does not exist.
 *
 * ## The order of operations, which is the part a tax authority cares about
 *
 * VAT is computed on the settlement amount in USD and the TOTAL is then
 * converted to pounds, never the other way round. `presentedTotal` in
 * `lib/settings/defs.ts` makes the same argument for the same reason: both give
 * nearly the same number and only one of them is defensible.
 */
export async function sessionTransferMoney(input: {
  organizationId: string;
  priceCents: number;
}): Promise<{ grossCents: number; vatCents: number; vatBps: number; settlesCents: number }> {
  const [row] = await db
    .select({ region: organizations.region })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);

  const { getCountrySettings, vatOn } = await import("@/lib/settings");
  const country = await getCountrySettings(row?.region ?? null);

  /*
   * Zero is a real answer for a country nobody has configured a rate for, and
   * it is the honest one: we do not invent a tax rate for a jurisdiction we
   * have not set up. Egypt IS set up, at 1400 bps.
   */
  const vatBps = country?.vatBps ?? 0;
  const gross = Math.max(0, Math.round(input.priceCents));
  const vat = vatOn(gross, vatBps);

  return { grossCents: gross, vatCents: vat, vatBps, settlesCents: gross + vat };
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
  /**
   * 🔴 75.7 — the tax inside `settlesCents`, when there is any, so the screen
   * can say why the figure is larger than the fee. Passed rather than looked up
   * because the caller has already computed it and two derivations of one number
   * is how a payer is shown one amount and charged another.
   */
  vatCents?: number;
  /** 🔴 19.4 — the reader's language, so the figure is in their numerals. */
  locale: string;
}): Promise<ManualEntry> {
  if (!input.needed) {
    return {
      needed: false,
      details: { label: "", fields: [], cardsComingSoon: false, unconfigured: true },
      live: { state: "none" },
      amountLabel: "",
      taxNote: "",
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
   * Empty when there is no tax, so the screen never says something untrue about
   * a jurisdiction that does not charge one.
   */
  const taxNote =
    input.vatCents && input.vatCents > 0
      ? formatMoney(egpMinorFor(input.vatCents, rateMicro), "EGP", input.locale)
      : "";

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
      taxNote,
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
    taxNote,
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
