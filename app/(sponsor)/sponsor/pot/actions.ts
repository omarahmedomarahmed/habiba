"use server";

import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { setCoverage } from "@/lib/data/sponsors";
import { getSettings } from "@/lib/settings";
import { requireSponsorAdmin } from "@/lib/sponsor-auth/guard";

export type TopUpState = { error?: string; ok?: boolean };

/*
 * 🔴 W1-01: `addToPot`, the card rail's action, is GONE. It called `topUpPot`
 * straight from a form, which journalled cash as received and raised the
 * balance with no charge anywhere on the path. `topUpPot` now demands a charge
 * Stripe confirms and is reached only from the webhook; the page tells a company
 * to ask us instead. A checkout that charges first is the only way back.
 */


export type CoverageState = { error?: string; ok?: boolean; message?: string };

/**
 * 🔴 60.1 to 60.6 / C311 / C344 / C345 — what this employer covers.
 *
 * 🔴 `requireSponsorAdmin`, like every other money door here. Changing the
 * percentage changes what every one of their people is asked to pay, which is
 * the same authority as topping up the pot.
 *
 * 🔴 The asymmetry lives in `setCoverage` rather than here, so it holds for the
 * next caller too: an increase is immediate, a decrease waits out the notice
 * window. A rule enforced in a server action is a rule that holds for one
 * button.
 */
export async function setCoveragePercent(
  _prev: CoverageState,
  formData: FormData,
): Promise<CoverageState> {
  const actor = await requireSponsorAdmin();

  const percent = Number(String(formData.get("percent") ?? ""));
  if (!Number.isFinite(percent)) return { error: "Choose a percentage." };

  const settings = await getSettings();

  const result = await setCoverage({
    sponsorId: actor.sponsorId,
    coverageBps: Math.round(percent * 100),
    noticeDays: settings.sponsor.coverageNoticeDays,
    bySponsorUserId: actor.sponsorUserId,
  });

  if (result.error) return { error: result.error };

  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "admin",
    action: "coverage.set",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
    reason: `${percent}%`,
  });

  revalidatePath("/sponsor/pot");

  /*
   * 🔴 The message says WHEN, because a reduction that appears to have saved
   * and changed nothing reads as a bug. It is the notice window doing exactly
   * what it is for.
   */
  /*
   * 🔴 AND IT SAYS IT IN THE READER'S LANGUAGE, WITH A DATE THEY CAN READ.
   *
   * Both halves were English template literals with an ISO slice in them, so an
   * Arabic benefits administrator who lowered their coverage percentage got an
   * English sentence containing "2027-09-21", which the bidi algorithm then
   * rendered "21-09-2027". The one fact this message exists to deliver is WHEN,
   * and it was the fact hardest to read.
   *
   * `getI18n` works here for the same reason it works in `app/pay`: a server
   * action runs inside the request, so the cookie that decides the language is
   * in scope.
   */
  const { getI18n } = await import("@/lib/i18n/server");
  const { t, locale } = await getI18n();
  const { formatDate } = await import("@/lib/utils");

  const from = result.effectiveFrom;
  const immediate = !from || from.getTime() <= Date.now() + 60_000;
  return {
    ok: true,
    message: immediate
      ? t("sponsor.coverageNow", { percent: String(100 - percent) })
      : t("sponsor.coverageFrom", { date: formatDate(from, "UTC", locale) }),
  };
}

/* ======================================================= the Egyptian rail == */

/**
 * 🔴 The Egyptian company's way in, because `topUpPot` refuses their entity.
 *
 * `addToPot` above is the card rail, switched off (W1-01), and the entity gate
 * lives inside `topUpPot` as well. This is the other door, and it does not
 * touch the pot at all. It records a claim that money was sent, and an operator
 * credits the pot when they have seen it arrive.
 *
 * The two never both apply: `sponsorNeedsTransfer` reads the same `entity`
 * column `topUpPot` refuses on, so a sponsor is on exactly one rail.
 */
export async function declarePotTransfer(
  _prev: TopUpState,
  formData: FormData,
): Promise<TopUpState> {
  const actor = await requireSponsorAdmin();

  /*
   * 🔴 DOLLARS, WHICH IS WHAT THE POT IS IN, AND THE POUNDS ARE OURS TO WORK OUT.
   *
   * The minimum on the screen, the balance, the coverage arithmetic and the
   * invoice are all USD. A form that took pounds would put the rate in a finance
   * team's hands and then in ours as well, and two places that know a rate are
   * two places that can disagree. `declarePaid` converts, once, and 0106 stores
   * both sides of it.
   */
  const units = Number(String(formData.get("amount") ?? "").replace(/[, $]/g, ""));
  if (!Number.isFinite(units) || units <= 0) return { error: "Enter the amount you sent." };

  /*
   * 🔴 76.1 — WHAT THE FORM POSTS IS THE CREDIT, AND THE TAX IS ADDED HERE.
   *
   * The stepper's hidden field carries the rung they chose, which is what their
   * pot will receive. It does NOT carry the total, deliberately: a browser that
   * posted the figure to be collected would be a browser that could post a
   * smaller one, and there is no processor on this rail to notice. So the
   * server adds the tax itself, from the same helper the card rail uses.
   */
  const creditCents = Math.round(units * 100);

  /*
   * 🔴 The same floor `topUpPot` enforces on the card rail, asked of the same
   * setting, and asked of the CREDIT on both. A minimum that counted the tax on
   * one rail and not the other would be two different minimums.
   */
  const settings = await getSettings();
  if (creditCents < settings.sponsor.minTopUpCents) {
    const { formatUsd } = await import("@/lib/billing/plans");
    return { error: `The smallest top-up is ${formatUsd(settings.sponsor.minTopUpCents)}.` };
  }

  /*
   * 🔴 AND A CEILING, because the stepper has one and a post is not a stepper.
   * The rungs stop at `maxTopUpCents`; without this, the one payer who can
   * choose their own figure could choose one no screen would ever show.
   */
  if (creditCents > settings.sponsor.maxTopUpCents) {
    const { formatUsd } = await import("@/lib/billing/plans");
    return {
      error: `The largest top-up we can take on this screen is ${formatUsd(settings.sponsor.maxTopUpCents)}. Talk to us for more.`,
    };
  }

  const { entityVatBps, potTopUpMoney } = await import("@/lib/billing/pot");
  const money = potTopUpMoney({
    creditCents,
    vatBps: await entityVatBps("eg"),
  });
  const settlesCents = money.settlesCents;

  const reference = String(formData.get("reference") ?? "").trim();

  const proof = formData.get("proof");
  let proofUrl: string | null = null;
  if (proof instanceof File && proof.size > 0) {
    const { uploadDocument } = await import("@/lib/uploads");
    const stored = await uploadDocument({
      kind: "receipt",
      userId: actor.sponsorUserId,
      label: "pot",
      file: proof,
    });
    if (stored.error) return { error: stored.error };
    proofUrl = stored.url ?? null;
  }

  const { declarePaid, sponsorNeedsTransfer } = await import("@/lib/billing/manual-entry");

  /*
   * 🔴 Asked again here rather than trusted from the screen. A form that renders
   * on a condition is a form somebody can post without meeting it.
   */
  if (!(await sponsorNeedsTransfer(actor.sponsorId))) {
    return { error: "Your account pays by card. Use the form above." };
  }

  const result = await declarePaid({
    purpose: "pot_topup",
    /*
     * 🔴 The sponsor's own id is the ref, so the partial unique index means one
     * live top-up claim per company. A finance team pressing twice while the
     * page loads does not create two claims an operator credits separately.
     */
    refId: actor.sponsorId,
    settlesCents,
    payer: { kind: "sponsor", sponsorId: actor.sponsorId },
    reference,
    proofUrl,
  });

  if (result.error) return { error: result.error };

  await audit({
    /* Explicit, like every other call site: this act has no clinician actor. */
    actor: null,
    sponsorUserId: actor.sponsorUserId,
    category: "billing",
    action: "pot.transfer.declared",
    resourceType: "sponsor",
    resourceId: actor.sponsorId,
    reason: `Declared a bank transfer worth ${settlesCents} cents, reference ${reference || "none"}`,
  });

  revalidatePath("/sponsor/pot");
  return { ok: true };
}


/**
 * 🔴 76.13 — a company chose an amount on the stepper and opened the sheet.
 *
 * The one payer who picks their own figure, so the amount travels in rather
 * than being read off a row. `openCart` retires whatever they had open before,
 * which is what makes changing your mind on the stepper behave the way a
 * finance officer expects: one intention at a time.
 */
export async function openPotPayment(creditCents: number): Promise<void> {
  const actor = await requireSponsorAdmin();

  const { sponsorNeedsTransfer } = await import("@/lib/billing/manual-entry");
  if (!(await sponsorNeedsTransfer(actor.sponsorId))) return;

  const settings = await getSettings();
  const credit = Math.round(creditCents);
  if (credit < settings.sponsor.minTopUpCents) return;
  if (credit > settings.sponsor.maxTopUpCents) return;

  const { entityVatBps, potTopUpMoney } = await import("@/lib/billing/pot");
  const money = potTopUpMoney({ creditCents: credit, vatBps: await entityVatBps("eg") });

  const { openCart } = await import("@/lib/billing/cart");
  const { egpMinorFor, egpRateMicro } = await import("@/lib/billing/manual");

  await openCart({
    purpose: "pot_topup",
    refId: actor.sponsorId,
    amountCents: egpMinorFor(money.settlesCents, await egpRateMicro()),
    settlesCents: money.settlesCents,
    /*
     * 🔴 76.16 — THE CREDIT AND THE TAX, SPLIT, because a company is the one
     * payer whose total is not the thing they are buying. They chose $1,500 of
     * pot and send $1,710, and an operator holding the larger figure has no way
     * to see the smaller one without recomputing a VAT rate by hand. Named in
     * English here because the reader is an operator; the finance team's own
     * screen renders the same two figures from the stepper in their language.
     */
    lineItems: [
      { label: "Pot credit", cents: money.creditCents },
      ...(money.vatCents > 0 ? [{ label: "VAT", cents: money.vatCents }] : []),
    ],
    payer: { kind: "sponsor", sponsorId: actor.sponsorId },
  });
}

export type TaxState = { ok?: boolean; error?: string };

/**
 * 🔴 0147: the company's tax details, for the ETA invoice on each top-up. An
 * admin's act; what was waiting for them is issued on save.
 */
export async function saveTaxDetails(_prev: TaxState, formData: FormData): Promise<TaxState> {
  const actor = await requireSponsorAdmin();
  const { saveCompanyTaxDetails } = await import("@/lib/billing/eta/company");
  const result = await saveCompanyTaxDetails({
    sponsorId: actor.sponsorId,
    legalName: String(formData.get("legalName") ?? ""),
    taxRegistrationNumber: String(formData.get("rin") ?? ""),
    governate: String(formData.get("governate") ?? ""),
    regionCity: String(formData.get("city") ?? ""),
    street: String(formData.get("street") ?? ""),
    buildingNumber: String(formData.get("building") ?? ""),
  });
  if ("error" in result) {
    const { getI18n } = await import("@/lib/i18n/server");
    return { error: (await getI18n()).t(result.error) };
  }
  revalidatePath("/sponsor/pot");
  return { ok: true };
}
