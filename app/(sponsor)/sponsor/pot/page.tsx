import type { Metadata } from "next";
import Link from "next/link";

import { CoverageForm } from "@/components/sponsor/coverage-form";
import { cancelPotPayment, declarePotTransfer, openPotPayment } from "./actions";
import { PaymentPopup } from "@/components/billing/payment-popup";
import { TaxDetails } from "@/components/sponsor/tax-details";
import { TopUpForm } from "@/components/sponsor/top-up-form";
import { companyTaxDetails } from "@/lib/billing/eta/company";
import { documentsFor } from "@/lib/billing/eta/issue";
import { potReturnsFor } from "@/lib/billing/pot-return";
import { manualEntry, potTopUpLadder, sponsorNeedsTransfer } from "@/lib/billing/manual-entry";
import { localeTag } from "@/lib/i18n/config";
import { ExpiryNotice, expiryState } from "@/components/sponsor/expiry-notice";
import { Card } from "@/components/clinician/kit";
import { Meter } from "@/components/visual/primitives";
import { topUpHistory } from "@/lib/billing/invoice";

import { potTerms } from "@/lib/data/sponsor-admin";
import { coverageFor, reportablePot } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
import { AskMoneyBack } from "@/components/sponsor/ask-money-back";
import { formatDate } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { requireSponsor } from "@/lib/sponsor-auth/guard";
import { Money } from "@/components/ui/money";
import { SponsorHeading } from "@/components/sponsor/heading";
import { rich, slot } from "@/lib/i18n/rich";

/** W3: the tab title in the reader's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("meta.yourPot"), robots: { index: false } };
}
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

  const [pot, terms, history, coverage, tax, etaDocs, returns] = await Promise.all([
    /* K6: behind the headcount floor as well as the session floor. */
    reportablePot(actor.sponsorId),
    potTerms(actor.sponsorId),
    topUpHistory(actor.sponsorId),
    /* 🔴 60.1 / C311 — the live percentage and any pending change, separately. */
    coverageFor(actor.sponsorId),
    /* 🔴 0147 — what ETA needs to invoice them, and what it has issued. */
    companyTaxDetails(actor.sponsorId),
    documentsFor(actor.sponsorId),
    /* 🔴 C8 — money we are sending back, or sent, which they never saw. */
    potReturnsFor(actor.sponsorId),
  ]);
  const egp = (minor: number) => <Money cents={minor} currency={"EGP"} />;

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

  const fmt = (cents: number) => <Money cents={cents} />;

  /* W2-S08: the pot stops paying on its date; say so before, and after. */
  const expiry = expiryState(terms?.expiresAt ?? null);

  return (
    <div className="space-y-6">
      <SponsorHeading title={t("sponsor.nav.pot")} />
      {expiry && terms?.expiresAt ? (
        <ExpiryNotice
          text={
            expiry === "expired"
              ? t("sponsor.expiredOn", { date: day(terms.expiresAt) })
              : t("sponsor.expiresOn", { date: day(terms.expiresAt) })
          }
        />
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
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
        /*
          🔴 B3 — what the company paid in, under its own label, because its own
          money in names nobody. Still no meter: a bar needs the spend.
        */
        <Card className="p-5 sm:p-6">
          <p className="text-[13px] font-semibold text-navy-400">{t("sponsor.funded")}</p>
          <p className="mt-1 text-[34px] leading-tight font-bold tracking-tight tabular-nums text-navy-700">
            {fmt(pot.fundedCents)}
          </p>
          {pot.underHeadcount ? (
            <p className="mt-1 text-xs leading-relaxed text-navy-400">
              {t("sponsor.fundedHeld", { floor: settings.sponsor.activityFloor })}
            </p>
          ) : null}
        </Card>
      ) : (
        <Card className="p-5 sm:p-6">
          <Meter
            usedLabel={fmt(pot.balanceCents)}
            ofLabel={
              lastTopUpCents > 0
                ? rich(t("sponsor.ofLastTopUp", { amount: slot(0) }), [fmt(lastTopUpCents)])
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
          /*
            🔴 B18 — null is not zero. This passed `balanceCents ?? 0`, so a pot
            holding $100 read "your balance of EGP 0 covers about 0 sessions".
            With the balance held back, the preview counts what they put in.
          */
          balanceUsd={pot.balanceCents === null ? null : pot.balanceCents / 100}
          fundedUsd={pot.fundedCents / 100}
          sessionPriceUsd={settings.sponsor.averageSessionCents / 100}
        />
      ) : null}

      </div>
      <div className="flex min-w-0 flex-col gap-4">
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
          minimumCents={settings.sponsor.minTopUpCents}
          rateLabel={rail.rateLabel}
          steps={ladder?.steps}
          onChoose={openPotPayment}
          /*
            🔴 B20 — the cart opens on the TAP, at the rung the stepper starts
            on, and a step taken moves it. It used to open whenever the stepper
            mounted, including when a confirmation refreshed the open sheet.
          */
          onOpen={ladder?.steps[0] ? openPotPayment.bind(null, ladder.steps[0].creditCents) : undefined}
          onCancel={cancelPotPayment}
        />
      ) : null}

      {/*
        🔴 W3 / C233: the terms sit beside the way in on the transfer rail too,
        which is the only rail an Egyptian company has.
      */}
      {terms?.refundPolicy && terms.expiresAt ? (
        actor.role === "admin" && !rail.needed ? (
          <TopUpForm
            minimumCents={settings.sponsor.minTopUpCents}
            terms={{
              refundPolicy: terms.refundPolicy,
              expiresLabel: day(terms.expiresAt),
            }}
          />
        ) : (
          /* A viewer, or anybody on the transfer rail, reads the terms here. */
          <Card className="p-5 sm:p-6">
            <p className="text-sm font-bold text-navy-700">{t("sponsor.refundTerms")}</p>
            <p className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-navy-400">
              {terms.refundPolicy}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-navy-400">
              {t("sponsor.expiresOn", { date: day(terms.expiresAt) })}
            </p>
          </Card>
        )
      ) : null}

      {!terms?.refundPolicy || !terms.expiresAt ? (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-navy-400">{t("sponsor.noPot")}</p>
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
        <Card className="p-5 sm:p-6">
          <h2 className="text-[17px] font-bold text-navy-700">{t("sponsor.invoices")}</h2>
          <ul className="mt-3 divide-y divide-navy-100">
            {history.map((entry) => (
              <li key={entry.txnId}>
                <Link
                  href={`/sponsor/pot/${entry.txnId}`}
                  className="flex items-baseline justify-between gap-3 py-2.5 text-sm font-semibold text-navy-600 hover:text-brand-700"
                >
                  <span>{day(entry.at)}</span>
                  <span className="tabular-nums">{fmt(entry.amountCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {returns.some((r) => r.state !== "cancelled") ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-[17px] font-bold text-navy-700">{t("sponsor.returns.title")}</h2>
          <ul className="mt-3 divide-y divide-navy-100">
            {returns
              .filter((r) => r.state !== "cancelled")
              .map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-sm text-navy-600">
                  <span>{day(r.decidedAt ?? r.createdAt)}</span>
                  <span className="tabular-nums">{egp(r.egpMinor)}</span>
                  <span className="text-xs text-navy-400">
                    {r.state === "sent" ? t("sponsor.returns.sent") : t("sponsor.returns.requested")}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      ) : null}

      {actor.role === "admin" && history.length > 0 ? <AskMoneyBack /> : null}

      {/*
        🔴 0147 — THE TAX AUTHORITY'S DOCUMENTS, one per top-up and one per
        return. The PDF is the Authority's own, fetched when asked for. A
        document waiting on the company says so, next to the form that ends
        the wait.
      */}
      {etaDocs.length > 0 ? (
        <Card className="p-5 sm:p-6">
          <h2 className="text-[17px] font-bold text-navy-700">{t("sponsor.eta.title")}</h2>
          <ul className="mt-3 divide-y divide-navy-100">
            {etaDocs.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-sm text-navy-600">
                <span>
                  {t(doc.kind === "invoice" ? "sponsor.eta.invoice" : "sponsor.eta.creditNote")} · {day(doc.createdAt)}
                </span>
                <span className="tabular-nums">{egp(doc.totalMinor)}</span>
                {doc.state === "valid" ? (
                  <a href={`/sponsor/pot/eta/${doc.id}`} className="text-brand-700 hover:underline">
                    {t("sponsor.eta.valid")}
                  </a>
                ) : (
                  <span className="text-xs text-navy-400">
                    {doc.state === "waiting"
                      ? t(doc.waitingFor?.startsWith("company") ? "sponsor.eta.waitingYou" : "sponsor.eta.waiting")
                      : t(`sponsor.eta.${doc.state}`)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {actor.role === "admin" && tax.entity === "eg" ? (
        <TaxDetails legalName={tax.legalName} rin={tax.rin} address={tax.address} />
      ) : null}
      </div>
      </div>
    </div>
  );
}
