import type { Metadata } from "next";
import Link from "next/link";

import { CoverageForm } from "@/components/sponsor/coverage-form";
import { declarePotTransfer, openPotPayment } from "./actions";
import { PaymentPopup } from "@/components/billing/payment-popup";
import { TopUpForm } from "@/components/sponsor/top-up-form";
import { manualEntry, potTopUpLadder, sponsorNeedsTransfer } from "@/lib/billing/manual-entry";
import { localeTag } from "@/lib/i18n/config";
import { ExpiryNotice, expiryState } from "@/components/sponsor/expiry-notice";
import { Card } from "@/components/ui";
import { Meter } from "@/components/visual/primitives";
import { topUpHistory } from "@/lib/billing/invoice";

import { potTerms } from "@/lib/data/sponsor-admin";
import { coverageFor, potBalance } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { formatDate } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { requireSponsor } from "@/lib/sponsor-auth/guard";

export const metadata: Metadata = { title: "Your pot", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The pot. PLAN.md 53.11 to 53.13, C233.
 *
 * 🔴 The form is rendered ONLY when the terms exist. Not disabled, not rendered with
 * a warning: not rendered. C233 says the terms are decided before any deal, so a
 * pot without them is a pot that cannot be topped up, and the database agrees —
 * `sponsor_pots_terms_before_money` refuses a balance above zero without them.
 *
 * Three layers saying the same thing, which is deliberate: the constraint is the
 * rule, `topUpPot` is the readable message, and this is the screen that never asks
 * the question it cannot honour.
 */
export default async function SponsorPotPage() {
  const actor = await requireSponsor();
  const { t, locale } = await getI18n();

  /*
   * 🔴 37L.9 — EVERY DATE ON THIS PAGE, IN THE READER'S LANGUAGE.
   *
   * Five of them printed `toISOString().slice(0, 10)`: the expiry on the meter,
   * the expiry in the terms, the date a coverage change takes effect, the date
   * on the top-up form, and the date on every invoice in the history. An ISO
   * slice is not a date anybody reads, and in Arabic it is worse than ugly: the
   * bidi algorithm reorders "2027-09-21" on screen to "21-09-2027", so the year
   * and the day swap ends with nothing to say which is which. A finance officer
   * reading a refund deadline off that is reading a guess.
   *
   * UTC, explicitly: a pot expires on a date, not at an hour in somebody's
   * city, and two people in two offices must read the same one.
   */
  const day = (at: Date) => formatDate(at, "UTC", locale);
  const settings = await getSettings();

  /*
   * 🔴 C377 — the PUBLISHED balance. The live one moves by one session's price
   * the moment one session happens, and this page is where a sponsor would
   * check it twice.
   */
  /*
   * 🔴 73.13 — which rail this sponsor is on, asked of the same `entity` column
   * `topUpPot` refuses. Assembled here so the page renders one form and never
   * both, and never a card form that would refuse them.
   */
  const needsTransfer = await sponsorNeedsTransfer(actor.sponsorId);
  const rail = await manualEntry({
    audience: "company",
    purpose: "pot_topup",
    refId: actor.sponsorId,
    payer: { kind: "sponsor", sponsorId: actor.sponsorId },
    needed: needsTransfer,
    /*
     * 🔴 Null, because a pot is the one place on this rail where the PAYER
     * decides the amount. A session and an invoice cost what they cost.
     */
    settlesCents: null,
    locale: localeTag(locale),
  });

  const [pot, terms, history, coverage] = await Promise.all([
    potBalance(actor.sponsorId),
    potTerms(actor.sponsorId),
    topUpHistory(actor.sponsorId),
    /* 🔴 60.1 / C311 — the live percentage and any pending change, separately. */
    coverageFor(actor.sponsorId),
  ]);

  /* 65.12 — the meter's denominator, and it is the figure the sponsor last authorised. */
  const lastTopUpCents = history[0]?.amountCents ?? 0;

  /*
   * 🔴 76.1 — THE RUNGS OF THE STEPPER, BUILT HERE BECAUSE THE BROWSER MAY NOT.
   *
   * Every label comes back already written in the reader's language. C84 bans
   * `Intl` in a client component, and this is the screen where that rule earns
   * its keep: these are the figures a finance team copies into a banking app,
   * and a number that renders one way on the server and another in the browser
   * is a transfer for the wrong amount.
   *
   * Built only on the transfer rail. The card path is off (W1-01): `TopUpForm`
   * shows the terms and says to ask us.
   */
  const ladder = needsTransfer
    ? await potTopUpLadder({
        entity: "eg",
        coverageBps: coverage?.coverageBps ?? 0,
        locale: localeTag(locale),
      })
    : null;

  const fmt = (cents: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(cents / 100);

  /* W2-S08 — the pot stops paying on its date; say so before, and after. */
  const expiry = expiryState(terms?.expiresAt ?? null);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      {expiry && terms?.expiresAt ? (
        <ExpiryNotice
          text={
            expiry === "expired"
              ? t("sponsor.expiredOn", { date: day(terms.expiresAt) })
              : t("sponsor.expiresOn", { date: day(terms.expiresAt) })
          }
        />
      ) : null}
      {/*
        🔴 65.12 — THE POT, ITS TERMS AND ITS EXPIRY AS A METER WITH THREE STATES.

        A number on its own answers "how much" and not "how long", and how long is the
        question a sponsor actually has. The bar is spent against the last top-up, so it
        runs green, then amber past three quarters, then red past nine tenths, and the
        expiry is the line under it rather than a paragraph three cards down.

        🔴 THE SUPPRESSED CASE KEEPS THE PLAIN CARD, deliberately. C377 publishes a
        balance only once enough sessions have moved, and a meter drawn from a figure we
        are refusing to publish would be a picture of a number that does not exist.
      */}
      {pot.balanceCents === null ? (
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">{t("sponsor.balance")}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {t("sponsor.balanceSuppressed")}
          </p>
        </Card>
      ) : (
        <Card className="p-4">
          <Meter
            usedLabel={fmt(pot.balanceCents)}
            ofLabel={
              lastTopUpCents > 0
                ? t("sponsor.ofLastTopUp", { amount: fmt(lastTopUpCents) })
                : t("sponsor.balance")
            }
            /* Spent, not remaining: the tone ladder in `Meter` runs red as it fills. */
            fraction={
              lastTopUpCents > 0 ? 1 - pot.balanceCents / lastTopUpCents : 0
            }
            note={
              pot.expiresAt
                ? t("sponsor.expiresOn", { date: day(pot.expiresAt) })
                : undefined
            }
          />
        </Card>
      )}

      {/*
        🔴 60.1 / C311 — the percentage, above the money, because it decides
        what the money buys. Admin only, like every other door on this page:
        changing it changes what every one of their people is asked to pay.
      */}
      {coverage && actor.role === "admin" ? (
        <CoverageForm
          coverageBps={coverage.coverageBps}
          pendingCoverageBps={coverage.pendingCoverageBps}
          pendingFromLabel={
            coverage.pendingCoverageFrom
              ? day(coverage.pendingCoverageFrom)
              : null
          }
          noticeDays={settings.sponsor.coverageNoticeDays}
          balanceUsd={(pot.balanceCents ?? 0) / 100}
          sessionPriceUsd={settings.sponsor.averageSessionCents / 100}
        />
      ) : null}

      {/*
        🔴 73.13 — ONE RAIL PER SPONSOR, decided by the same `entity` column
        `topUpPot` refuses on. An Egyptian company cannot be charged a card, so
        it is shown a bank account instead of a form that would refuse them.
      */}
      {/*
        🔴 76.10 — the same sheet every other payer sees, naming this one as a
        COMPANY payment. A finance officer filing this needs to tell at a glance
        that it is their employer's pot and not somebody's session, because the
        bank details underneath are identical for all four payers.
      */}
      {terms?.refundPolicy && terms.expiresAt && actor.role === "admin" && rail.needed ? (
        <PaymentPopup
          storageKey={actor.sponsorId}
          subject={{
            viewerName: actor.email,
            orgName: actor.sponsorName,
            what: t("transfer.subjectPot"),
            payerType: "company",
          }}
          details={rail.details}
          /* 🔴 Empty, and `askAmount` is why: they have not chosen one yet. */
          amountLabel=""
          live={rail.live}
          action={declarePotTransfer}
          askAmount
          minimumLabel={fmt(settings.sponsor.minTopUpCents)}
          rateLabel={rail.rateLabel}
          steps={ladder?.steps}
          onChoose={openPotPayment}
        />
      ) : null}

      {terms?.refundPolicy && terms.expiresAt && !rail.needed ? (
        actor.role === "admin" ? (
          <TopUpForm
            minimumLabel={fmt(settings.sponsor.minTopUpCents)}
            terms={{
              refundPolicy: terms.refundPolicy,
              expiresLabel: day(terms.expiresAt),
            }}
          />
        ) : (
          /* A viewer reads the balance and the terms and cannot move money. */
          <Card className="p-5">
            <p className="text-xs font-semibold text-slate-700">{t("sponsor.refundTerms")}</p>
            <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">
              {terms.refundPolicy}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {t("sponsor.expiresOn", { date: day(terms.expiresAt) })}
            </p>
          </Card>
        )
      ) : null}

      {!terms?.refundPolicy || !terms.expiresAt ? (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("sponsor.noPot")}</p>
        </Card>
      ) : null}

      {/*
        🔴 53.15 — the documents, one per top-up, rendered from the ledger.

        A link rather than an attachment, and no stored file anywhere: the invoice
        is a render of the transaction, so the number on it is by construction the
        number the books show. There is no `invoices` row for a pot top-up, which
        is C226's "no parallel invoice path" holding in the one place it is most
        tempting to break.
      */}
      {history.length > 0 ? (
        <Card className="p-5">
          <p className="text-sm font-semibold text-slate-900">{t("sponsor.invoices")}</p>
          <ul className="mt-2 space-y-1">
            {history.map((entry) => (
              <li key={entry.txnId}>
                <Link
                  href={`/sponsor/pot/${entry.txnId}`}
                  className="flex items-baseline justify-between gap-3 py-1 text-sm text-slate-700 hover:underline"
                >
                  <span>{day(entry.at)}</span>
                  <span className="tabular-nums">{fmt(entry.amountCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
