import type { Metadata } from "next";
import Link from "next/link";

import { CoverageForm } from "@/components/sponsor/coverage-form";
import { TopUpForm } from "@/components/sponsor/top-up-form";
import { TransferTopUp } from "@/components/sponsor/transfer-top-up";
import { manualEntry, sponsorNeedsTransfer } from "@/lib/billing/manual-entry";
import { Card } from "@/components/ui";
import { Meter } from "@/components/visual/primitives";
import { topUpHistory } from "@/lib/billing/invoice";

import { potTerms } from "@/lib/data/sponsor-admin";
import { coverageFor, potBalance } from "@/lib/data/sponsors";
import { getI18n } from "@/lib/i18n/server";
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

  const fmt = (cents: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(cents / 100);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
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
                ? t("sponsor.expiresOn", { date: pot.expiresAt.toISOString().slice(0, 10) })
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
              ? coverage.pendingCoverageFrom.toISOString().slice(0, 10)
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
      {terms?.refundPolicy && terms.expiresAt && actor.role === "admin" && rail.needed ? (
        <TransferTopUp
          fields={rail.details.fields}
          cardsComingSoon={rail.details.cardsComingSoon}
          waiting={rail.live.state === "submitted"}
          minimumLabel={fmt(settings.sponsor.minTopUpCents)}
        />
      ) : null}

      {terms?.refundPolicy && terms.expiresAt && !rail.needed ? (
        actor.role === "admin" ? (
          <TopUpForm
            minimumLabel={fmt(settings.sponsor.minTopUpCents)}
            terms={{
              refundPolicy: terms.refundPolicy,
              expiresLabel: terms.expiresAt.toISOString().slice(0, 10),
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
              {t("sponsor.expiresOn", { date: terms.expiresAt.toISOString().slice(0, 10) })}
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
                  <span>{entry.at.toISOString().slice(0, 10)}</span>
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
