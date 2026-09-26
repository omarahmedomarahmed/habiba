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
import { organizations, sessions, sponsors } from "@/lib/db/schema";

import {
  egpMinorFor,
  egpRateMicro,
  livePaymentFor,
  openManualPayment,
  paymentsFor,
  submitProof,
  transferDetails,
  type Audience,
  type PaymentLine,
  type Payer,
} from "./manual";
import { formatMoney } from "./plans";
import type { ManualPaymentPurpose } from "@/lib/db/schema";

/**
 * 🔴 Board 490: a turned-down transfer as the payer's page shows it: what was
 * sent, when it was decided, its reference and the operator's reason.
 */
export type RejectedLive = {
  state: "rejected";
  reason: string;
  sentLabel?: string;
  reference?: string | null;
};

/** What a screen renders. Assembled once so no flow has to sequence the calls. */
export type ManualEntry = {
  /** False when this payer has a card rail and should not see a bank account. */
  needed: boolean;
  details: Awaited<ReturnType<typeof transferDetails>>;
  live:
    | { state: "none" }
    | { state: "awaiting_proof"; paymentId: string }
    | {
        state: "submitted";
        paymentId: string;
        submittedAt: string | null;
        /**
         * 🔴 76.4 — WHAT THEY UPLOADED, SO REOPENING SHOWS IT BACK TO THEM.
         *
         * A payer who sends a receipt, closes the page and comes back has one
         * question: did that go through. Re-rendering the upload form is the
         * answer "no idea", and somebody who cannot tell transfers again.
         *
         * 🔴 Task 40: a yes or no, never the stored address. The receipt is a
         * private blob now, and its URL has no business in a browser.
         */
        hasProof: boolean;
      }
    | RejectedLive;
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
  /**
   * 🔴 76.16 — WHAT THE TOTAL IS MADE OF, printed under it.
   *
   * One figure is enough when a payment has one subject. A pay-as-you-go
   * clinician paying for four of their eleven unpaid sessions gets a single
   * number that matches nothing they can see, and the only way to check it is
   * to add up a list on another screen and hope.
   *
   * 🔴 AND THE STORED LINES WIN OVER THE CALLER'S. Once a payment is open, what
   * the payer committed to is a fact and the page's current idea of it is not:
   * an invoice settled by another route between opening and returning would
   * otherwise silently redraw a list that a bank transfer is already in flight
   * against. Frozen at the same moment as the amount, for the same reason.
   *
   * Empty where a payment has one obvious subject, which is most of them, and
   * the heading has already said what it is.
   */
  lines: { label: string; amountLabel: string; credit?: boolean }[];
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

  const { getCountrySettings, getSettings, sessionVatBpsFor, vatOn } = await import("@/lib/settings");
  const [country, settings] = await Promise.all([
    getCountrySettings(row?.region ?? null),
    getSettings(),
  ]);

  /*
   * Zero is a real answer for a country nobody has configured a rate for, and
   * it is the honest one: we do not invent a tax rate for a jurisdiction we
   * have not set up. 🔴 Ruling 2: a session price is healthcare and exempt by
   * default, so the country's rate only applies when the rule says `standard`.
   */
  const vatBps = sessionVatBpsFor(settings.rules, country?.vatBps ?? 0);
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
  /**
   * 🔴 76.16 — what the caller is ABOUT to quote, in USD cents.
   *
   * Only used when nothing is open yet. The moment there is a live row its own
   * stored lines are the answer, because those are the ones the payer read
   * before they went to their bank.
   */
  lines?: PaymentLine[];
  /** 🔴 19.4 — the reader's language, so the figure is in their numerals. */
  locale: string;
}): Promise<ManualEntry> {
  if (!input.needed) {
    return {
      needed: false,
      details: { label: "transfer.labelTransfer", fields: [], cardsComingSoon: false, unconfigured: true },
      live: { state: "none" },
      amountLabel: "",
      taxNote: "",
      rateLabel: "",
      lines: [],
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

  /*
   * 🔴 76.16 — FORMATTED HERE, on the server, for the same reason `amountLabel`
   * is: C84 bans `Intl` inside a client component, and these are figures a payer
   * checks their total against.
   */
  const asLines = (items: PaymentLine[] | null | undefined) =>
    (items ?? []).map((item) => ({
      label: item.label,
      amountLabel: formatMoney(egpMinorFor(item.cents, rateMicro), "EGP", input.locale),
      /*
       * 🔴 76.27 — THE SIGN IS DECIDED HERE, on the server, and travels as a
       * flag. A negative line is a credit: a benefit's share coming off the
       * total rather than another charge going on to it. The browser cannot
       * work this out for itself, because by the time the figure reaches it the
       * amount is a formatted string and a minus sign is a glyph whose position
       * moves between the two scripts this product renders.
       */
      credit: item.cents < 0,
    }));

  if (live) {
    return {
      needed: true,
      details,
      /*
       * 🔴 76.16 — THE OPEN ROW'S OWN TOTAL, not the page's fresher sum.
       *
       * These used to be the same number and stopped being the same number the
       * moment a clinician could pay for four of eleven sessions. They also
       * drift on their own: a bill grows while somebody is at their bank.
       *
       * The row wins, both times. A payer who committed to a figure and went to
       * transfer it must come back to that figure, and an operator matching a
       * bank line needs the screen to agree with the claim rather than with
       * whatever the account owes this minute.
       */
      amountLabel: formatMoney(egpMinorFor(live.settlesCents, rateMicro), "EGP", input.locale),
      taxNote,
      rateLabel,
      /* The payer's own committed list, never the page's newer idea of it. */
      lines: asLines(live.lineItems),
      live:
        live.state === "submitted"
          ? {
              state: "submitted",
              paymentId: live.id,
              submittedAt: live.submittedAt?.toISOString() ?? null,
              hasProof: Boolean(live.proofUrl),
            }
          : { state: "awaiting_proof", paymentId: live.id },
    };
  }

  const history = await paymentsFor(input.payer);
  /*
   * 🔴 Board 490: the NEWEST payment for this thing decides, so a rejection
   * that was followed by a confirmed transfer stops being shown, and one that
   * is still the last word carries what was sent, when, and its reference.
   */
  const latest = history.find(
    (p) => input.refId === null || p.refId === input.refId,
  );
  const lastRejection = latest?.state === "rejected" ? latest : undefined;

  return {
    needed: true,
    details,
    amountLabel,
    taxNote,
    rateLabel,
    lines: asLines(input.lines),
    live: lastRejection
      ? {
          state: "rejected",
          reason: lastRejection.rejectReason ?? "",
          sentLabel: formatMoney(lastRejection.amountCents, lastRejection.currency.toUpperCase(), input.locale),
          reference: lastRejection.reference ?? null,
        }
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
  /** 🔴 76.16 — what it covers, when the caller knows and it is not obvious. */
  lineItems?: PaymentLine[] | null;
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
    lineItems: input.lineItems ?? null,
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

/* --------------------------------------------------- the company's ladder -- */

/** One stop on the top-up stepper, with every figure already in the reader's language. */
export type PotStep = {
  /** What the pot receives, in USD cents. The value posted with the form. */
  creditCents: number;
  /** Credit plus tax, in USD cents. What they actually send. */
  settlesCents: number;
  /** "$100" */
  usdLabel: string;
  /** "5,000 EGP" — the credit, converted. */
  egpLabel: string;
  /** "700 EGP" — the tax on top. Empty where there is none. */
  vatEgpLabel: string;
  /** "5,700 EGP" — what lands in our account. */
  totalEgpLabel: string;
  /** How many sessions this covers at their coverage rate. */
  sessions: number;
};

/**
 * 🔴 76.1 — EVERY LABEL ON THE STEPPER IS BUILT HERE, AND THAT IS THE POINT.
 *
 * ## Why a ladder and not a formatter
 *
 * The obvious build is a number in React state and a `toLocaleString` beside
 * it. C84 bans exactly that: `Intl` inside a client component renders one
 * string on the server pass and another in the browser, and these are the
 * figures a finance team types into a banking app. It is also the difference
 * between Arabic-Indic and Western digits for the language half this market
 * reads in.
 *
 * So the client never formats anything. It holds an INDEX into this array and
 * renders the strings it was handed. Pressing Plus moves the index. There is no
 * arithmetic in the browser at all, which means there is no number the browser
 * could disagree with the server about.
 *
 * ## Why a stepper and not a text box
 *
 * A pot is the one place in this product where the payer chooses the figure,
 * and a free text box in dollars is how somebody sends us $5 or $50,000 by
 * slipping on a zero. There is no processor to reverse either one. The stepper
 * removes the keyboard from the decision, so the set of amounts we accept is
 * exactly the set of amounts we can render.
 */
export async function potTopUpLadder(input: {
  entity: string;
  /** Their coverage share, in basis points. Decides the sessions figure. */
  coverageBps: number;
  locale: string;
}): Promise<{ steps: PotStep[]; rateLabel: string }> {
  const { getSettings } = await import("@/lib/settings");
  const { entityVatBps, potTopUpMoney } = await import("./pot");

  const [settings, vatBps, rateMicro] = await Promise.all([
    getSettings(),
    entityVatBps(input.entity),
    egpRateMicro(),
  ]);

  const { minTopUpCents, topUpStepCents, maxTopUpCents, averageSessionCents } = settings.sponsor;
  const egp = (cents: number) => formatMoney(egpMinorFor(cents, rateMicro), "EGP", input.locale);

  /*
   * 🔴 What ONE session costs THEM, which is the only sum that makes the
   * sessions figure mean anything. At 10% coverage of a $20 session they pay
   * $2, so $100 is 50 sessions. Guarded against zero because a coverage of 0
   * would divide by it, and a sponsor who covers nothing covers no sessions
   * rather than infinitely many.
   */
  const perSessionCents = Math.round((averageSessionCents * input.coverageBps) / 10_000);

  const steps: PotStep[] = [];
  for (let credit = minTopUpCents; credit <= maxTopUpCents; credit += topUpStepCents) {
    const money = potTopUpMoney({ creditCents: credit, vatBps });
    steps.push({
      creditCents: money.creditCents,
      settlesCents: money.settlesCents,
      usdLabel: formatMoney(credit, "USD", input.locale),
      egpLabel: egp(credit),
      vatEgpLabel: money.vatCents > 0 ? egp(money.vatCents) : "",
      totalEgpLabel: egp(money.settlesCents),
      sessions: perSessionCents > 0 ? Math.floor(credit / perSessionCents) : 0,
    });
  }

  return { steps, rateLabel: egp(100) };
}

/**
 * 🔴 WHAT THIS PATIENT OWES FOR THIS SESSION, AFTER THEIR BENEFIT, WITH VAT.
 *
 * The one figure every patient screen shows: the pay page asks for exactly
 * this. Billing listed the share before tax and the session cards the full
 * list price, so a patient read three numbers for one session.
 */
export async function patientOwesTotal(sessionId: string): Promise<number> {
  /* 🔴 Board 373/408 (B49): the session's organisation and what is owed, side by side. */
  const { patientOwesFor } = await import("./session-owed");
  const [[row], owed] = await Promise.all([
    db.select({ organizationId: sessions.organizationId }).from(sessions).where(eq(sessions.id, sessionId)).limit(1),
    patientOwesFor(sessionId),
  ]);
  if (!row) return 0;
  if (owed.grossCents <= 0) return 0;
  const money = await sessionTransferMoney({ organizationId: row.organizationId, priceCents: owed.grossCents });
  return money.settlesCents;
}
