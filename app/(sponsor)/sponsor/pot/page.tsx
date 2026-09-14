import type { Metadata } from "next";
import Link from "next/link";

import { TopUpForm } from "@/components/sponsor/top-up-form";
import { Card } from "@/components/ui";
import { topUpHistory } from "@/lib/billing/invoice";

import { potTerms } from "@/lib/data/sponsor-admin";
import { potBalance } from "@/lib/data/sponsors";
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
  const [pot, terms, history] = await Promise.all([
    potBalance(actor.sponsorId),
    potTerms(actor.sponsorId),
    topUpHistory(actor.sponsorId),
  ]);

  const fmt = (cents: number) =>
    new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(cents / 100);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Card className="p-4">
        <p className="text-xs font-medium text-slate-500">{t("sponsor.balance")}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
          {pot.balanceCents === null ? t("sponsor.balanceSuppressed") : fmt(pot.balanceCents)}
        </p>
      </Card>

      {terms?.refundPolicy && terms.expiresAt ? (
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
      ) : (
        <Card className="p-5">
          <p className="text-sm leading-relaxed text-slate-600">{t("sponsor.noPot")}</p>
        </Card>
      )}

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
